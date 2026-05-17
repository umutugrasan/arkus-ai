from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json
import re
import logging
import urllib.parse
from app.dependencies import get_current_user, get_db
from app.db.models import Supplier, PriceAlert, Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_overall_metrics, calculate_marketplace_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

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
    }


def _normalize_search_text(value: str) -> str:
    table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return (value or "").translate(table).lower()


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


@router.get("/best-price/{product_name}")
async def best_price(product_name: str, user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.query(Supplier).filter(Supplier.product.ilike(f"%{product_name}%")).all()
    if not rows:
        rows = [s for s in db.query(Supplier).all() if _supplier_matches_product(s, product_name)]
    
    if rows:
        suppliers = [_supplier_to_dict(s) for s in rows]
    else:
        # DB'de yoksa, Google Search (Gemini) uzerinden canli B2B toptanci fiyatlarini arastir
        prompt = f"""Google Search grounding kullanarak "{product_name}" icin TOPTAN (B2B/wholesale) fiyatlari bul.

ARANACAK KAYNAKLAR (oncelik sirasi):
1. alibaba.com - fabrika ve ihracatci fiyatlari
2. 1688.com - Cin icindeki en dusuk toptan fiyatlar (Turkce veya Ingilizce ara)
3. dhgate.com - toptan B2B
4. aliexpress.com/wholesale - sadece toptan listelemeleri
5. Turkiye icindeki toptancilar: toptanbul.com, sahibinden.com/ilan/toptan, n11.com/toptan, hepsiburadabusiness.com

KESIN KURAL - MIN SIPARIS ADEDI:
- SADECE minimum siparis adedi (MOQ) 50 adet VEYA USTU olan listeleri al.
- MOQ'su 50'nin altinda olan hicbir sonucu listeye EKLEME.
- Eger min_order bilgisi bulunamiyorsa o sonucu ATLA.

DIGER KURALLAR:
- Asla hayali fiyat uydurma. Sadece gercekten gordugun fiyatlari yaz.
- Birim fiyat TL veya USD olabilir; USD ise bunu belirt (name alanina "(USD)" ekle).
- Gercek satin alma linkini (url) mutlaka ekle.
- "current_price" SADECE sayi olmali (ornek: 143.75).

Buldugun sonuclari ASAGIDAKI JSON dizisi formatinda don. Markdown yok, sadece JSON:
[
  {{"name": "Alibaba - Factory Direct", "current_price": 45.0, "discount_pct": 0, "min_order": 100, "shipping_days": 20, "product": "{product_name}", "url": "https://alibaba.com/..."}},
  {{"name": "Toptanbul - Toptanci X", "current_price": 55.0, "discount_pct": 5, "min_order": 50, "shipping_days": 3, "product": "{product_name}", "url": "https://toptanbul.com/..."}}
]"""
        system = "Sen sadece JSON donduren bir B2B tedarik botusun. Hic metin aciklamasi yapma, sadece JSON dizisi dondur."

        # ── 1. Deneme: Google Search grounding ile ──
        raw_text = ""
        try:
            result = await ask_gemini_with_search(prompt, system)
            raw_text = (result.get("text") or "").strip()
            if raw_text.startswith("\u26a0"):  # ⚠️ mock fallback geldi
                raw_text = ""
        except Exception as e_search:
            logger.warning(f"ask_gemini_with_search basarisiz ({type(e_search).__name__}), search'suz deneniyor...")

        # ── 2. Fallback: Search grounding basarisizsa search'suz dene ──
        if not raw_text:
            try:
                logger.info("Sourcing: search grounding yok, ask_gemini ile fallback...")
                raw_text = await ask_gemini(prompt, system, endpoint="sourcing_best_price")
                raw_text = (raw_text or "").strip()
                if raw_text.startswith("\u26a0"):
                    raw_text = ""
            except Exception as e_plain:
                logger.error(f"ask_gemini da basarisiz: {type(e_plain).__name__}: {e_plain}")
                raw_text = ""

        # ── 3. JSON ayikla ve parse et ──
        try:
            if not raw_text:
                raise ValueError("Gemini bos yanit dondu.")

            # markdown fence temizle
            if "```json" in raw_text:
                raw_text = raw_text.split("```json", 1)[1]
            if "```" in raw_text:
                raw_text = raw_text.rsplit("```", 1)[0]
            raw_text = raw_text.strip()

            # Sadece JSON dizi kismini cek
            m = re.search(r'\[.*\]', raw_text, re.DOTALL)
            if m:
                raw_text = m.group(0)

            ai_data = json.loads(raw_text)
            suppliers = []
            for idx, item in enumerate(ai_data):
                # Price Parsing Algorithm Fix
                def clean_price(val):
                    s = re.sub(r'[^\d\.,]', '', str(val))
                    if not s: return 0.0
                    if '.' in s and ',' in s:
                        if s.rfind('.') > s.rfind(','):
                            s = s.replace(',', '')
                        else:
                            s = s.replace('.', '').replace(',', '.')
                    elif ',' in s:
                        s = s.replace(',', '.')
                    return float(s)

                try:
                    cp = clean_price(raw_price)
                    if cp <= 0: continue
                except Exception:
                    continue

                dpct = int(item.get("discount_pct") or 0)
                min_order = int(item.get("min_order") or 10)
                shipping_days = int(item.get("shipping_days") or 14)

                if min_order < 10:
                    continue

                # URL Validation and Fallback Algorithm
                raw_url = str(item.get("url") or "").strip()
                sup_name = item.get("name") or "Web Supplier"
                prod_title = item.get("product") or product_name
                
                valid_url = raw_url if (raw_url.startswith("http://") or raw_url.startswith("https://")) else ""
                if not valid_url or len(valid_url) < 10:
                    fallback_query = urllib.parse.quote_plus(f"{sup_name} {prod_title} b2b buy")
                    valid_url = f"https://www.google.com/search?q={fallback_query}"

                suppliers.append({
                    "id": 9000 + idx,
                    "name": sup_name,
                    "product": prod_title,
                    "current_price": cp,
                    "min_order": min_order,
                    "shipping_days": shipping_days,
                    "discount_pct": dpct,
                    "discounted_price": round(cp * (1 - dpct / 100.0), 2),
                    "has_discount": dpct > 0,
                    "last_checked_at": _now(),
                    "url": valid_url,
                })
        except Exception as e:
            logger.error(f"Sourcing JSON parse hatasi: {e} | raw: {raw_text[:300]}")
            suppliers = [_supplier_to_dict(s) for s in rows]

    if not suppliers:
        raise HTTPException(status_code=404, detail="Bu urun icin tedarikci bulunamadi")

    # Backend mantigi olarak cheapest best'tir; frontend de bu sirayi korur.
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
        result = await ask_gemini_with_search(prompt, system)
        analysis = result["text"]
        sources = result["sources"]
        used_web = result["used_search"]
    else:
        analysis = await ask_gemini(prompt, system)
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
    result = await ask_gemini_with_search(prompt, system)

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
