from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import asyncio
import json
import re
import logging
import urllib.parse
from app.dependencies import get_current_user, get_db
from app.db.models import Supplier, PriceAlert, Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_overall_metrics, calculate_marketplace_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search
from app.services.scrapers import search_wholesale

logger = logging.getLogger(__name__)

router = APIRouter()



def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _supplier_to_dict(s: Supplier) -> dict:
    discount = s.discount_pct or 0
    discounted = round((s.current_price or 0) * (1 - discount / 100), 2)
    return {
        "id": s.id,
        "name": s.name,
        "product": s.product,
        "current_price": s.current_price,
        "min_order": s.min_order,
        "shipping_days": s.shipping_days,
        "discount_pct": discount,
        "discounted_price": discounted,
        "has_discount": discount > 0,
        "last_checked_at": s.last_checked_at,
        "source": "db",
    }


def _normalize_search_text(value: str) -> str:
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return (value or "").translate(table).lower()


def _upsert_supplier(db, item: dict, product_name: str) -> None:
    name = item.get("name", "")
    product = item.get("product") or product_name
    existing = db.query(Supplier).filter(Supplier.name == name, Supplier.product == product).first()
    if existing:
        existing.current_price = item.get("current_price", existing.current_price)
        existing.min_order = item.get("min_order", existing.min_order)
        existing.shipping_days = item.get("shipping_days", existing.shipping_days)
        existing.discount_pct = item.get("discount_pct", 0)
        existing.last_checked_at = _now()
    else:
        db.add(Supplier(
            name=name,
            product=product,
            current_price=item.get("current_price", 0),
            min_order=item.get("min_order", 50),
            shipping_days=item.get("shipping_days", 14),
            discount_pct=item.get("discount_pct", 0),
            last_checked_at=_now(),
        ))


def _supplier_matches_product(supplier: Supplier, product_name: str) -> bool:
    haystack = _normalize_search_text(supplier.product)
    words = [w for w in re.split(r"\W+", _normalize_search_text(product_name)) if len(w) >= 3]
    return bool(words) and all(w in haystack for w in words)


@router.get("/suppliers")
def list_suppliers(
    product: Optional[str] = None,
    has_discount: Optional[bool] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    q = db.query(Supplier)
    if product:
        q = q.filter(Supplier.product.ilike(f"%{product}%"))
    suppliers = [_supplier_to_dict(s) for s in q.all()]
    if has_discount is True:
        suppliers = [s for s in suppliers if s["has_discount"]]
    elif has_discount is False:
        suppliers = [s for s in suppliers if not s["has_discount"]]
    suppliers.sort(key=lambda s: s["discounted_price"])
    return {"total": len(suppliers), "suppliers": suppliers}


async def _gemini_wholesale_search(product_name: str) -> list[dict]:
    """
    Gemini Google Search grounding ile Alibaba/AliExpress/DHgate/1688'den
    TOPTAN (B2B) fiyat arar. Sonuçları 'web' kaynaklı supplier dict listesi döner.
    """
    prompt = f"""Google Search grounding kullanarak "{product_name}" icin TOPTAN (B2B/wholesale) fiyatlari bul.

ARANACAK KAYNAKLAR (oncelik sirasi):
1. alibaba.com - fabrika ve ihracatci fiyatlari
2. 1688.com - Cin icindeki en dusuk toptan fiyatlar (Turkce veya Ingilizce ara)
3. dhgate.com - toptan B2B
4. aliexpress.com/wholesale - sadece toptan listelemeleri
5. Turkiye icindeki toptancilar: sahibinden.com toptan ilanlari, n11.com toptan

KESIN KURAL - MIN SIPARIS ADEDI:
- SADECE minimum siparis adedi (MOQ) 50 adet VEYA USTU olan listeleri al.
- MOQ'su 50'nin altinda olan hicbir sonucu listeye EKLEME.
- Eger min_order bilgisi bulunamiyorsa o sonucu ATLA.

DIGER KURALLAR:
- EN FAZLA 6 tedarikci dön. Daha fazlasini EKLEME — yanit kisa olmali.
- Asla hayali fiyat uydurma. Sadece gercekten gordugun fiyatlari yaz.
- Birim fiyati TL'ye cevir; orijinali USD ise yaklasik TL karsiligini yaz.
- Gercek satin alma linkini (url) mutlaka ekle.
- "current_price" SADECE sayi olmali (ornek: 143.75).
- Uzun aciklama yazma; sadece istenen JSON alanlarini doldur.

Buldugun sonuclari ASAGIDAKI JSON dizisi formatinda don. Markdown yok, sadece JSON:
[
  {{"name": "Alibaba - Factory Direct", "current_price": 45.0, "discount_pct": 0, "min_order": 100, "shipping_days": 20, "product": "{product_name}", "url": "https://alibaba.com/..."}},
  {{"name": "1688 - Tedarikci X", "current_price": 38.0, "discount_pct": 0, "min_order": 200, "shipping_days": 25, "product": "{product_name}", "url": "https://1688.com/..."}}
]"""
    system = "Sen sadece JSON donduren bir B2B tedarik botusun. Hic metin aciklamasi yapma, sadece JSON dizisi dondur."

    # ── 1. Google Search grounding ile dene ──
    raw_text = ""
    try:
        result = await ask_gemini_with_search(prompt, system)
        raw_text = (result.get("text") or "").strip()
        if raw_text.startswith("⚠"):  # mock fallback geldi
            raw_text = ""
    except Exception as e_search:
        logger.warning(f"ask_gemini_with_search basarisiz ({type(e_search).__name__})")

    # ── 2. Search grounding basarisizsa search'suz dene ──
    if not raw_text:
        try:
            logger.info("Sourcing: search grounding yok, ask_gemini ile fallback...")
            raw_text = await ask_gemini(prompt, system, endpoint="sourcing_best_price")
            raw_text = (raw_text or "").strip()
            if raw_text.startswith("⚠"):
                raw_text = ""
        except Exception as e_plain:
            logger.error(f"ask_gemini da basarisiz: {type(e_plain).__name__}: {e_plain}")
            raw_text = ""

    if not raw_text:
        return []

    # ── 3. JSON ayikla ve parse et (token limitinde kirpilmis yaniti kurtar) ──
    if "```json" in raw_text:
        raw_text = raw_text.split("```json", 1)[1]
    if "```" in raw_text:
        raw_text = raw_text.rsplit("```", 1)[0]
    raw_text = raw_text.strip()

    ai_data = None
    try:
        ai_data = json.loads(raw_text)
    except Exception:
        # Gemini yaniti token limitinde kirpilabilir ("Unterminated string").
        # Dizinin son TAM nesnesine kadar kes, diziyi kapatip tekrar dene.
        start = raw_text.find('[')
        if start != -1:
            body = raw_text[start:]
            last = body.rfind('}')
            while last > 0 and ai_data is None:
                try:
                    parsed = json.loads(body[:last + 1] + ']')
                    if isinstance(parsed, list):
                        ai_data = parsed
                        logger.warning(f"Sourcing: kirpilmis JSON kurtarildi — {len(parsed)} kayit")
                except Exception:
                    pass
                last = body.rfind('}', 0, last)

    if not isinstance(ai_data, list):
        logger.error(f"Sourcing JSON parse hatasi — kurtarilamadi | raw: {raw_text[:200]}")
        return []

    def _clean_price(val) -> float:
        """Turkce sayi formati guvenli parse — '8.696' (binlik) != 8.696 ondalik.
        Bkz. scrapers/toptanbul.py:_parse_price ayni heuristic."""
        s = re.sub(r'[^\d\.,]', '', str(val))
        if not s:
            return 0.0
        if '.' in s and ',' in s:
            if s.rfind('.') > s.rfind(','):
                s = s.replace(',', '')
            else:
                s = s.replace('.', '').replace(',', '.')
        elif ',' in s:
            s = s.replace(',', '.')
        elif '.' in s:
            # Sadece nokta: binlik mi ondalik mi? "8.696" -> binlik (TR)
            parts = s.split('.')
            if len(parts) > 2 or len(parts[-1]) == 3:
                s = s.replace('.', '')
        try:
            return float(s)
        except ValueError:
            return 0.0

    def _pick(item: dict, *keys):
        # Gemini bazen Turkce/farkli anahtar isimleri kullaniyor — hepsini dene
        for k in keys:
            v = item.get(k)
            if v not in (None, "", []):
                return v
        return None

    def _to_int(val, default: int) -> int:
        if val is None:
            return default
        m = re.search(r'\d+', str(val))
        return int(m.group(0)) if m else default

    suppliers: list[dict] = []
    for idx, item in enumerate(ai_data):
        if not isinstance(item, dict):
            continue
        try:
            cp = _clean_price(_pick(
                item, "current_price", "fiyat", "birim_fiyat", "birim_fiyati",
                "toptan_fiyat", "toptan_fiyati", "price", "unit_price",
            ))
            if cp <= 0:
                continue
            cp = round(cp, 2)

            dpct = _to_int(_pick(item, "discount_pct", "indirim", "indirim_yuzdesi"), 0)
            min_order = _to_int(_pick(
                item, "min_order", "moq", "minimum_siparis", "min_siparis",
                "minimum_order", "min_siparis_adedi",
            ), 50)
            shipping_days = _to_int(_pick(
                item, "shipping_days", "kargo_gun", "teslimat_gun", "kargo", "teslimat",
            ), 18)
            if min_order < 10:
                continue

            sup_name = _pick(
                item, "name", "tedarikci", "tedarikci_adi", "firma", "firma_adi",
                "site", "satici", "kaynak",
            ) or "Web Tedarikci"

            # Ürün adı: product yoksa marka + model birleştir
            prod_title = _pick(item, "product", "urun", "urun_adi", "ürün_adı", "urun_ismi", "ürün")
            if not prod_title:
                marka = _pick(item, "marka", "brand")
                model = _pick(item, "model")
                prod_title = " ".join(str(x) for x in (marka, model) if x) or product_name

            raw_url = str(_pick(item, "url", "link", "kaynak_url", "kaynak_link") or "").strip()
            valid_url = raw_url if raw_url.startswith(("http://", "https://")) else ""
            if not valid_url or len(valid_url) < 10:
                fallback_query = urllib.parse.quote_plus(f"{sup_name} {prod_title} b2b toptan")
                valid_url = f"https://www.google.com/search?q={fallback_query}"

            suppliers.append({
                "id": 9000 + idx,
                "name": str(sup_name)[:100],
                "product": str(prod_title)[:120],
                "current_price": cp,
                "min_order": min_order,
                "shipping_days": shipping_days,
                "discount_pct": dpct,
                "discounted_price": round(cp * (1 - dpct / 100.0), 2),
                "has_discount": dpct > 0,
                "last_checked_at": _now(),
                "url": valid_url,
                "source": "web",
            })
        except Exception:
            continue
    return suppliers


@router.get("/best-price/{product_name}")
async def best_price(product_name: str, user=Depends(get_current_user), db=Depends(get_db)):
    # ── Trendyol scraping + Gemini toptan araması PARALEL çalışır ──
    scraped, gemini_results = await asyncio.gather(
        search_wholesale(product_name),
        _gemini_wholesale_search(product_name),
        return_exceptions=True,
    )
    if isinstance(scraped, BaseException):
        logger.warning(f"Scraping başarısız: {type(scraped).__name__}: {scraped}")
        scraped = []
    if isinstance(gemini_results, BaseException):
        logger.warning(f"Gemini araması başarısız: {type(gemini_results).__name__}: {gemini_results}")
        gemini_results = []

    # Trendyol/scrape sonuçlarını DB'ye kaydet
    for idx, item in enumerate(scraped):
        item.setdefault("id", 9100 + idx)
        item.setdefault("discounted_price", item.get("current_price", 0))
        item.setdefault("has_discount", False)
        _upsert_supplier(db, item, product_name)
    if scraped:
        db.commit()

    suppliers = list(scraped) + list(gemini_results)
    logger.info(
        f"best_price({product_name!r}): {len(suppliers)} sonuç "
        f"(trendyol={len(scraped)}, web={len(gemini_results)})"
    )

    # ── Her ikisi de boşsa DB önbelleğine bak ──
    if not suppliers:
        rows = db.query(Supplier).filter(Supplier.product.ilike(f"%{product_name}%")).all()
        if not rows:
            rows = [s for s in db.query(Supplier).all() if _supplier_matches_product(s, product_name)]
        if rows:
            suppliers = [_supplier_to_dict(s) for s in rows]

    if not suppliers:
        raise HTTPException(status_code=404, detail="Bu urun icin tedarikci bulunamadi")

    # En ucuz = en iyi tedarik kaynağı
    suppliers.sort(key=lambda x: x["discounted_price"])

    best = suppliers[0]
    avg_price = round(sum(s["discounted_price"] for s in suppliers) / len(suppliers), 2)
    savings_vs_avg = round(avg_price - best["discounted_price"], 2)

    return {
        "product": product_name,
        "best_supplier": best,
        "avg_price": avg_price,
        "savings_vs_avg": savings_vs_avg,
        "all_suppliers": suppliers,
    }


@router.get("/scrape/{query}")
async def direct_scrape(
    query: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Toptanbul + AliExpress'i doğrudan scrape eder, DB'ye kaydeder."""
    results = await search_wholesale(query)
    if results:
        for idx, item in enumerate(results):
            item.setdefault("id", 9200 + idx)
            item.setdefault("discounted_price", item.get("current_price", 0))
            item.setdefault("has_discount", False)
            _upsert_supplier(db, item, query)
        db.commit()
    return {
        "query": query,
        "count": len(results),
        "results": results,
        "source": "realtime_scrape" if results else "no_results",
    }


@router.get("/opportunities")
async def sourcing_opportunities(
    use_web: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    use_web=True (default): Gemini Google Search grounding ile gercek web fiyatlarini
    DB tedarikcilerle karsilastirir. False ise sadece DB+AI yorum.
    """
    suppliers = [_supplier_to_dict(s) for s in db.query(Supplier).all()]

    marketplaces = fetch_all_marketplaces(user.id)
    all_metrics = {}
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if mp_data:
            all_metrics[mp] = calculate_marketplace_metrics(mp_data)
    overall = calculate_overall_metrics(all_metrics)

    cash_balance = round(
        sum(
            (h.calculated_profit or 0)
            for h in db.query(Financial).filter(Financial.user_id == user.id).all()
        ),
        2,
    )

    # Tedarikciye konu olan unique urunler
    unique_products = sorted({s["product"] for s in suppliers})

    prompt = f"""Asagidaki toptan tedarikci verilerini analiz et. Turkce yanit ver.
AMAC: En az 50 adet alip Trendyol/HB/n11/Amazon TR'de karla satmak.

DB'DEKI MEVCUT TEDARIKCILER:
{json.dumps(suppliers, ensure_ascii=False, indent=2)}

URUN KATEGORILERI:
{json.dumps(unique_products, ensure_ascii=False)}

FINANSAL DURUM:
- Nakit bakiye: {cash_balance:,.2f} TL
- Aylik net kar: {overall['total_net_after_ads']:,.2f} TL
- Aylik gelir: {overall['total_revenue']:,.2f} TL

GOREV: alibaba.com, 1688.com, dhgate.com, aliexpress.com/wholesale, toptanbul.com,
hepsiburadabusiness.com sitelerinde yukaridaki kategoriler icin GERCEK anlik
fiyat aramasi yap (Google Search ile). Sadece MOQ >= 50 adet olan listeleri dikkate al.

Su basliklarda analiz ver:
1. **En ucuz toptan kaynaklar** (her kategori icin 2-3 ornek, MOQ ve kaynak URL ile)
2. **DB tedarikciler vs web fiyatlari** — daha ucuz alternatif var mi?
3. **Kar marji firsatlari** — toptan alis + Trendyol/HB komisyon sonrasi net kar?
4. **50 adet yatirimi icin sermaye analizi** — nakit yeterli mi?
5. **Hangi urunu kac adet alip nerede satmali?** Somut oneri.
6. **Tedarikci degisim onerisi** — kayilirsa kar marji ne kadar artar?

EN SONA "WEB KAYNAKLARI (Fiyata Gore Sirali)" basligi altinda, buldugun tedarikcileri BIRIM FIYATINA GORE BUYUKTEN KUCUGE (en pahali en ustte) siralayarak Markdown listesi seklinde mutlaka ekle.
Format su sekilde olsun:
- [Firma/Site Adi - X TL](https://link-buraya)
"""
    system = (
        "Sen bir e-ticaret toptan tedarik uzmansin. Amac en az 50 adet toptan alip "
        "Turkiye pazaryerlerinde karla satmak. Google Search ile gercek B2B fiyatlarini "
        "bul, sadece MOQ >= 50 olanlari dikkate al. Somut, kaynakli oneriler sun."
    )

    if use_web:
        result = await ask_gemini_with_search(prompt, system, pool="analyze")
        analysis = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        analysis = await ask_gemini(prompt, system, pool="analyze")
        sources = []
        used_web = False

    return {
        "cash_balance": cash_balance,
        "monthly_net_profit": overall["total_net_after_ads"],
        "discount_count": sum(1 for s in suppliers if s["has_discount"]),
        "db_suppliers": suppliers,
        "ai_analysis": analysis,
        "web_sources": sources,
        "used_web_search": used_web,
    }


@router.get("/real-search/{query}")
async def real_supplier_search(
    query: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Gercek web aramasi: Gemini Google Search grounding ile Alibaba/AliExpress/yerli
    toptancilarda anlik fiyat tarar. Sonuc + kaynak URL'leri doner.
    """
    db_matches = (
        db.query(Supplier).filter(Supplier.product.ilike(f"%{query}%")).all()
    )
    db_dicts = [_supplier_to_dict(s) for s in db_matches]
    db_min = min((d["discounted_price"] for d in db_dicts), default=None)

    prompt = f"""Asagidaki urun icin TOPTAN (B2B/wholesale) tedarikci ara. Amac: en az 50 adet alip Trendyol/HB/n11 gibi Turkiye pazaryerlerinde satin alma fiyatinin uzerinde satmak.

ARANACAK KAYNAKLAR:
- alibaba.com (ihracatci/fabrika fiyatlari)
- 1688.com (Cin icindeki en dusuk toptan)
- dhgate.com (toptan B2B)
- aliexpress.com/wholesale (sadece toptan)
- Turkiye: toptanbul.com, hepsiburadabusiness.com, sahibinden.com toptan ilanlari, n11.com toptan

URUN: "{query}"

KESIN KURAL: Sadece minimum siparis adedi (MOQ) 50 ve uzerinde olan listeleri goster. MOQ < 50 olanlari KESINLIKLE listeme.

Bulduklarini su formatta Turkce listele:
- **Site - Tedarikci:** Birim fiyat (TL veya USD belirt), MOQ: X adet, Kargo: X gun, [Kaynak linki]
  Kisa not (indirim, uretici mi distributoer mu, kalite notu vs.)

En az 5-6 farkli kaynaktan veri getir.

Son olarak "OZET VE KARARLILIK ANALIZI" basligiyla:
- En dusuk birim fiyat: hangi site, kac adet MOQ?
- Sistemdeki kayitli en dusuk fiyat: {db_min if db_min is not None else 'yok'} TL
- Toplam maliyet (50 adet): X TL
- Tahmini satis fiyati Trendyol/HB'de: X TL (piyasa arastir)
- Brut kar marji tahmini: %X
- TAVSIYE: Hangi kaynaktan kac adet alinmali?

EN SONA "WEB KAYNAKLARI (Fiyata Gore Sirali)" basligi altinda, buldugun tedarikcileri BIRIM FIYATINA GORE BUYUKTEN KUCUGE (en pahali en ustte) siralayarak Markdown listesi seklinde mutlaka ekle.
Format su sekilde olsun:
- [Firma/Site Adi - X TL](https://link-buraya)
"""
    system = (
        "Sen bir e-ticaret toptan tedarik uzmansin. Amac karla satis yapabilmek icin "
        "en ucuz toptan kaynagi bulmak (min 50 adet). Google Search ile gercek anlik "
        "B2B fiyatlarini bul. Sadece gercek gordugun verileri yaz, asla uydurma. "
        "Her bilgide kaynagi belirt."
    )
    result = await ask_gemini_with_search(prompt, system, pool="analyze")

    return {
        "query": query,
        "db_matches_count": len(db_dicts),
        "db_lowest_price": db_min,
        "ai_analysis": result["text"],
        "web_sources": result["sources"],
        "used_web_search": result["used_search"],
    }


# ---- Price Alerts ----

class AlertRequest(BaseModel):
    product_name: str
    target_price: float
    supplier_name: str = ""


@router.post("/alerts")
def create_alert(
    req: AlertRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if req.target_price <= 0:
        raise HTTPException(status_code=400, detail="Hedef fiyat 0'dan buyuk olmali")

    alert = PriceAlert(
        user_id=user.id,
        product_name=req.product_name,
        target_price=req.target_price,
        supplier=req.supplier_name or None,
        status="active",
        created_at=_now(),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {
        "message": "Alarm olusturuldu",
        "alert": {
            "id": alert.id,
            "product_name": alert.product_name,
            "target_price": alert.target_price,
            "supplier": alert.supplier,
            "status": alert.status,
            "created_at": alert.created_at,
        },
    }


@router.get("/alerts")
def list_alerts(
    status: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    q = db.query(PriceAlert).filter(PriceAlert.user_id == user.id)
    if status:
        q = q.filter(PriceAlert.status == status)
    alerts = q.order_by(PriceAlert.id.desc()).all()
    return {
        "total": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "product_name": a.product_name,
                "target_price": a.target_price,
                "supplier": a.supplier,
                "status": a.status,
                "created_at": a.created_at,
            }
            for a in alerts
        ],
    }


@router.delete("/alerts/{alert_id}")
def delete_alert(
    alert_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    alert = (
        db.query(PriceAlert)
        .filter(PriceAlert.id == alert_id, PriceAlert.user_id == user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alarm bulunamadi")
    db.delete(alert)
    db.commit()
    return {"message": "Alarm silindi", "id": alert_id}
