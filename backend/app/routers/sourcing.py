from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json
from app.dependencies import get_current_user, get_db
from app.db.models import Supplier, PriceAlert, Financial
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_overall_metrics, calculate_marketplace_metrics
from app.services.gemini_service import ask_gemini, ask_gemini_with_search

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
    
    if rows:
        suppliers = [_supplier_to_dict(s) for s in rows]
    else:
        # DB'de yoksa, Google Search (Gemini) uzerinden canli toptanci fiyatlarini arastir
        prompt = f"""Google Search grounding kullanarak "{product_name}" icin toptan (wholesale) satilan fiyatlari bul.
Alibaba, AliExpress veya benzeri B2B sitelerindeki GERCEK arama sonuclarina bak.
ONEMLI: Asla hayali fiyat uydurma. Sadece gercekten gordugun, dogrulayabildigin fiyatlari listele. Eger fiyati net olarak goremiyorsan o sonucu KESINLIKLE listeye ekleme. Ayrica buldugun gercek SATIN ALMA LINKINI (url) mutlaka ekle.
"current_price" degeri SADECE sayi olmalidir (ornek: 143.75).
Buldugun sonuclari ASAGIDAKI JSON FORMATINDA (array olarak) don. Baska hicbir yazi veya markdown (```json vb.) EKLEME. Sadece list:
[
  {{"name": "Alibaba - Store X", "current_price": 500.0, "discount_pct": 10, "min_order": 50, "shipping_days": 15, "product": "{product_name}", "url": "https://alibaba.com/..."}},
  {{"name": "AliExpress - TechParts", "current_price": 600.0, "discount_pct": 0, "min_order": 1, "shipping_days": 20, "product": "{product_name}", "url": "https://aliexpress.com/..."}}
]"""
        system = "Sen JSON donduren bir bot'sun. Metin aciklamasi yapma, sadece JSON."
        result = await ask_gemini_with_search(prompt, system)
        
        try:
            # parse raw JSON (remove markdown ticks if gemini adds them anyway)
            raw_text = (result.get("text") or "").strip()
            if not raw_text:
                raise ValueError("Gemini bos yanit dondu (Kota asimi veya desteklenmeyen model).")
                
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1]
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("```", 1)[0]
            raw_text = raw_text.strip()
            
            ai_data = json.loads(raw_text)
            suppliers = []
            for idx, item in enumerate(ai_data):
                raw_price = item.get("current_price")
                if raw_price is None:
                    continue  # Fiyati bilinmeyen tedarikciyi atla
                
                try:
                    cp = float(raw_price)
                except ValueError:
                    # Eger "143,75 TL" gibi geldiyse string'i temizleyerek sayi yap
                    import re
                    match = re.search(r"([\d.,]+)", str(raw_price))
                    if match:
                        cp = float(match.group(1).replace(",", "."))
                    else:
                        continue
                        
                dpct = int(item.get("discount_pct") or 0)
                min_order = int(item.get("min_order") or 1)
                shipping_days = int(item.get("shipping_days") or 14)
                
                suppliers.append({
                    "id": 9000 + idx,
                    "name": item.get("name") or "Web Supplier",
                    "product": item.get("product") or product_name,
                    "current_price": cp,
                    "min_order": min_order,
                    "shipping_days": shipping_days,
                    "discount_pct": dpct,
                    "discounted_price": round(cp * (1 - dpct/100.0), 2),
                    "has_discount": dpct > 0,
                    "last_checked_at": _now(),
                    "url": item.get("url")
                })
        except Exception as e:
            print("Gemini JSON Parse Error:", e, result.get("text"))
            # Sadece hata dondur, artik sahte (dummy) 100TL'lik kayit donme!
            raise HTTPException(
                status_code=503, 
                detail="Arama sunuculari su an yogun (Limit Asimi) veya AI yanit veremedi. Lutfen 30 saniye bekleyip tekrar deneyin."
            )

    if not suppliers:
        raise HTTPException(status_code=404, detail="Bu urun icin tedarikci bulunamadi")

    # Fiyata gore yuksekten dusuge siralansin istenmisti front-end tarafinda, ama
    # backend mantigi olarak hala cheapest best'tir. Frontend yuksekten dusuge siraliyor.
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

    prompt = f"""Asagidaki tedarikci verilerini analiz et. Turkce yanit ver.

DB'DEKI MEVCUT TEDARIKCILER (sistemin kayitli verisi):
{json.dumps(suppliers, ensure_ascii=False, indent=2)}

URUN KATEGORILERI:
{json.dumps(unique_products, ensure_ascii=False)}

FINANSAL DURUM:
- Birikmis nakit bakiye: {cash_balance:,.2f} TL
- Aylik net kar: {overall['total_net_after_ads']:,.2f} TL
- Aylik gelir: {overall['total_revenue']:,.2f} TL

GOREV: Su an Alibaba.com, AliExpress.com, ve Turkiye'deki toptan B2B sitelerinde
yukaridaki kategoriler icin **gercek anlik fiyat aramasi yap** (Google Search ile).
Bulduğun web fiyatlarini DB'deki kayitli tedarikci fiyatlariyla karsilastir.

Su basliklarda analiz ver:
1. **Gercek web fiyatlari** (kategori bazinda 2-3 ornek, kaynak siteyle)
2. **DB tedarikciler vs web fiyatlari** karsilastirmasi - daha ucuzu var mi?
3. **Indirimli tedarikci firsatlari** (DB'deki + webde gordugun)
4. **Nakit akisi uygun mu** stok yatirimi icin?
5. **Zamanlama onerisi** (alim icin uygun mu, beklensin mi?)
6. **Tedarikci degisikligi onerisi** - hangi kategoride hangi tedarikciye kayilirsa kar marji ne kadar artar
"""
    system = (
        "Sen bir e-ticaret tedarik zinciri uzmansin. Web aramasiyla gercek tedarikci "
        "fiyatlarini bulup saticilara somut, kaynakli oneriler sunuyorsun."
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

    prompt = f"""Asagidaki urun icin Alibaba.com, AliExpress.com, n11.com, Trendyol toptan,
hepsiburadabusiness.com, hepsiglobal.com gibi B2B/toptan ve uluslararasi tedarik
sitelerinde **gercek anlik fiyat aramasi yap**.

URUN: "{query}"

Bulduklarini su formatta Turkce listele:
- **Site adi - Tedarikci/Magaza adi:** Birim fiyat (TL/USD), MOQ (minimum siparis), kargo suresi.
  Kisa not (varsa indirim, kalite vs.).

En az 4-6 farkli kaynaktan veri getir. Sonra "ÖZET" basligiyla:
- En ucuz fiyat ne, hangi sitede?
- Sistemdeki kayitli en dusuk fiyat: {db_min if db_min is not None else "yok"} TL.
  Web fiyati daha mi iyi, ne kadar tasarruf?
- Tavsiye: hangi kaynaktan alim yapilmali?
"""
    system = (
        "Sen bir e-ticaret tedarik zinciri uzmansin. Google Search ile gercek anlik "
        "tedarikci fiyatlarini buluyorsun. Sadece gerçekten gordugun verileri kullan, "
        "uydurma. Her bilgide kaynagini belli et."
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
