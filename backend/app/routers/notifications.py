from fastapi import APIRouter, HTTPException
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces, fetch_suppliers
import json
import os

router = APIRouter()

NOTIF_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "notifications.json")


def _load_notifications():
    if not os.path.exists(NOTIF_PATH):
        return []
    with open(NOTIF_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_notifications(notifs):
    with open(NOTIF_PATH, "w", encoding="utf-8") as f:
        json.dump(notifs, f, ensure_ascii=False, indent=2)


@router.get("/")
def list_notifications(token: str = ""):
    notifs = _load_notifications()
    return {"notifications": notifs}


@router.get("/unread-count")
def unread_count(token: str = ""):
    notifs = _load_notifications()
    count = len([n for n in notifs if not n.get("read", False)])
    return {"unread_count": count}


@router.put("/{notif_id}/read")
def mark_read(notif_id: str):
    notifs = _load_notifications()
    for n in notifs:
        if n["id"] == notif_id:
            n["read"] = True
            _save_notifications(notifs)
            return {"message": "Bildirim okundu olarak isaretlendi"}
    raise HTTPException(status_code=404, detail="Bildirim bulunamadi")


@router.put("/read-all")
def mark_all_read(token: str = ""):
    notifs = _load_notifications()
    for n in notifs:
        n["read"] = True
    _save_notifications(notifs)
    return {"message": "Tum bildirimler okundu"}


@router.post("/generate")
def generate_notifications():
    notifs = _load_notifications()
    new_notifs = []
    next_id = len(notifs) + 1

    # Stok uyarisi
    marketplaces = fetch_all_marketplaces()
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            daily_sales = p["sales_30d"] / 30
            days_left = p["stock"] / daily_sales if daily_sales > 0 else 999
            if days_left < 15:
                new_notifs.append({
                    "id": f"N{next_id:03d}",
                    "type": "stok_uyarisi",
                    "title": f"Dusuk Stok: {p['name']}",
                    "message": f"{mp} - {p['stock']} adet kaldi, {round(days_left, 1)} gunde tukenecek.",
                    "severity": "critical" if days_left < 7 else "warning",
                    "read": False,
                    "created_at": "2026-05-10",
                })
                next_id += 1

    # Yorum puani dususu
    for mp in marketplaces:
        mp_data = fetch_store_info(mp)
        if not mp_data:
            continue
        for p in mp_data["products"]:
            if p["rating"] < 4.0:
                new_notifs.append({
                    "id": f"N{next_id:03d}",
                    "type": "puan_dususu",
                    "title": f"Dusuk Puan: {p['name']}",
                    "message": f"{mp} - Yorum puani {p['rating']}, hedef 4.0 ustu.",
                    "severity": "warning",
                    "read": False,
                    "created_at": "2026-05-10",
                })
                next_id += 1

    # Tedarikci indirimi
    suppliers = fetch_suppliers()
    for s in suppliers:
        if s.get("discount_pct", 0) > 0:
            new_notifs.append({
                "id": f"N{next_id:03d}",
                "type": "tedarikci_indirimi",
                "title": f"Indirim: {s['name']}",
                "message": f"{s['product']} - %{s['discount_pct']} indirim! Fiyat: {s['current_price']} TL",
                "severity": "info",
                "read": False,
                "created_at": "2026-05-10",
            })
            next_id += 1

    notifs.extend(new_notifs)
    _save_notifications(notifs)

    return {"message": f"{len(new_notifs)} yeni bildirim olusturuldu", "new_notifications": new_notifs}