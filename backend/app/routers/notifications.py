import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timedelta
from app.dependencies import get_current_user, get_db
from app.db.models import Notification, Supplier, Product, Marketplace, CompetitorPriceHistory
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.agents.review_response_agent import ReviewResponseAgent

logger = logging.getLogger(__name__)
router = APIRouter()



def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "severity": n.severity,
        "read": n.read,
        "created_at": n.created_at,
    }


def _maybe_add(db, user_id, type_, title, message, severity):
    """Ayni baslikta:
    - Son 1 saat icinde herhangi bir bildirim varsa ekleme (hizli tekrar tarama).
    - Okunmamis bildirim varsa ekleme (aktif uyari zaten listede).
    """
    cutoff_1h = (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    recent = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.title == title,
            Notification.created_at >= cutoff_1h,
        )
        .first()
    )
    if recent:
        return None
    unread_existing = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.title == title,
            Notification.read == False,
        )
        .first()
    )
    if unread_existing:
        return None
    notif = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        severity=severity,
        read=False,
        created_at=_now(),
    )
    db.add(notif)
    db.flush()
    return notif


@router.get("/")
def list_notifications(
    unread_only: bool = False,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read == False)
    if type:
        q = q.filter(Notification.type == type)
    if severity:
        q = q.filter(Notification.severity == severity)
    q = q.order_by(Notification.id.desc()).limit(limit)
    rows = q.all()
    return {"total": len(rows), "notifications": [_to_dict(n) for n in rows]}


@router.get("/unread-count")
def unread_count(user=Depends(get_current_user), db=Depends(get_db)):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)
        .count()
    )
    return {"unread_count": count}


@router.put("/read-all")
def mark_all_read(user=Depends(get_current_user), db=Depends(get_db)):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read == False)
        .update({"read": True})
    )
    db.commit()
    return {"message": "Tum bildirimler okundu", "updated_count": updated}


@router.put("/{notif_id}/read")
def mark_read(
    notif_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    n = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.user_id == user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadi")
    n.read = True
    db.commit()
    return {"message": "Bildirim okundu olarak isaretlendi", "id": notif_id}


@router.post("/generate")
async def generate_notifications(user=Depends(get_current_user), db=Depends(get_db)):
    """
    Otomatik tespit: stok uyarisi, dusuk puan, tedarikci indirimi, rakip fiyat
    DEGISIKLIGI ve negatif yorumlar icin AI cevap taslaklari.
    Ayni baslikta okunmamis bildirim varsa tekrar olusturulmaz (idempotent).
    """
    created = []
    marketplaces = fetch_all_marketplaces(user.id)

    # 1. Stok uyarilari (pazaryeri x urun bazinda)
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            daily = p["sales_30d"] / 30 if p["sales_30d"] else 0
            days_left = round(p["stock"] / daily, 1) if daily > 0 else 999
            if days_left < 15:
                severity = "critical" if days_left < 7 else "warning"
                title = f"Dusuk Stok: {p['name']} ({mp})"
                msg = f"{p['stock']} adet kaldi, ~{days_left} gunde tukenecek."
                n = _maybe_add(db, user.id, "stok_uyarisi", title, msg, severity)
                if n:
                    created.append(_to_dict(n))

    # 2. Dusuk puan
    for mp in marketplaces:
        mp_data = fetch_store_info(mp, user.id)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            if (p.get("rating") or 0) < 4.0 and (p.get("review_count") or 0) >= 50:
                title = f"Dusuk Puan: {p['name']} ({mp})"
                msg = f"Yorum puani {p['rating']}, hedef 4.0+. Inceleme onerilir."
                n = _maybe_add(db, user.id, "puan_dususu", title, msg, "warning")
                if n:
                    created.append(_to_dict(n))

    # 3. Tedarikci indirimleri
    suppliers = db.query(Supplier).filter(Supplier.discount_pct > 0).all()
    for s in suppliers:
        title = f"Indirim: {s.name}"
        discounted = round(s.current_price * (1 - s.discount_pct / 100), 2)
        msg = (
            f"{s.product} - %{s.discount_pct} indirim! "
            f"Liste fiyat {s.current_price} TL, indirimli {discounted} TL. "
            f"MOQ: {s.min_order} adet."
        )
        n = _maybe_add(db, user.id, "tedarikci_indirimi", title, msg, "info")
        if n:
            created.append(_to_dict(n))

    # 4. Rakip fiyat degisikligi (son 7 gunde > %3 fark)
    # Sadece kullaniciya ait urunlerin rakiplerine bak
    user_product_ids = [
        p.id for p in db.query(Product).filter(Product.user_id == user.id).all()
    ]
    if user_product_ids:
        # Her (urun, rakip) icifn son snapshot ve 7 gun once snapshot
        snapshots = (
            db.query(CompetitorPriceHistory)
            .filter(CompetitorPriceHistory.product_id.in_(user_product_ids))
            .order_by(CompetitorPriceHistory.captured_at.asc())
            .all()
        )
        # group_by python tarafinda: {(product_id, name): [snapshots...]}
        groups = {}
        for s in snapshots:
            groups.setdefault((s.product_id, s.competitor_name), []).append(s)

        for (pid, name), snaps in groups.items():
            if len(snaps) < 2:
                continue
            latest = snaps[-1]
            # 7 gun veya daha eski son snapshot
            from datetime import date
            seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
            baseline = next(
                (s for s in reversed(snaps[:-1]) if s.captured_at <= seven_days_ago),
                snaps[0],
            )
            if baseline.price == 0:
                continue
            diff_pct = round((latest.price - baseline.price) / baseline.price * 100, 1)
            if abs(diff_pct) >= 3:
                direction = "dusurdu" if diff_pct < 0 else "yukseltti"
                product = db.query(Product).filter(Product.id == pid).first()
                product_name = product.name if product else f"ID {pid}"
                title = f"Rakip Fiyat Degisikligi: {name} ({product_name})"
                msg = (
                    f"{name} {product_name} icin fiyatini %{abs(diff_pct)} {direction}. "
                    f"Eski: {baseline.price} TL ({baseline.captured_at}), "
                    f"Yeni: {latest.price} TL ({latest.captured_at})."
                )
                severity = "warning" if abs(diff_pct) >= 5 else "info"
                n = _maybe_add(db, user.id, "rakip_fiyat", title, msg, severity)
                if n:
                    created.append(_to_dict(n))

    db.commit()

    # 5. Negatif yorumlar icin AI cevap taslaklari (ReviewResponseAgent).
    #    Bu daha once sadece arka plan scheduler'da tetikleniyordu; "Bildirimleri
    #    Tara" butonunun da uretmesi icin buradan da cagiriyoruz. Gemini hata
    #    verirse digerlerini bozmasin diye sessizce gecilir.
    review_drafts_created = 0
    try:
        agent = ReviewResponseAgent()
        agent_result = await agent.run(user.id, db)
        review_drafts_created = agent_result.notifications_created or 0
        if agent_result.status == "ok" and review_drafts_created > 0:
            # Agent kendi commit'ini yapiyor, ama yine de listeye eklemek icin
            # son review_drafts_created kayitli bildirimi al
            recent_drafts = (
                db.query(Notification)
                .filter(
                    Notification.user_id == user.id,
                    Notification.type == "yorum_cevap_taslagi",
                )
                .order_by(Notification.id.desc())
                .limit(review_drafts_created)
                .all()
            )
            for n in recent_drafts:
                created.append(_to_dict(n))
    except Exception as e:
        logger.warning(f"ReviewResponseAgent tetiklenemedi: {type(e).__name__}: {e}")

    return {
        "message": f"{len(created)} yeni bildirim olusturuldu",
        "new_count": len(created),
        "new_notifications": created,
        "review_drafts_created": review_drafts_created,
    }
