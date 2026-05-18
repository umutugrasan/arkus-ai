"""
SourcingAgent — Otonom Tedarik Avcısı

GÖREV:
  Her tick'te periyodik olarak:
   1. DB'deki `suppliers` tablosunda yeni eklenmis/guncel indirimleri kontrol eder
   2. Kullanicinin aktif `price_alerts`'larini tedarikci fiyatlariyla karsilastirir,
      hedef fiyat altina dustugu noktada alert'i TETIKLER + bildirim atar
   3. Kullanicinin sattigi ürün isimlerini supplier ürünleriyle eslestirir, eski tedarikci
      maliyetine kiyasla daha ucuz alternatif varsa bildirim atar

VERİ KAYNAGI: TAMAMEN DB. Şahte veri yok, gerçek tablolarla calisir:
  - `Supplier` (mock-api seed'li veya kullanici sync'i)
  - `Product` (kullanicinin gercek urun listesi)
  - `PriceAlert` (kullanicinin manuel kurdugu alarmlar)

AI ÇAĞRISI: 0 (default). Web search opsiyonel ama ENABLE_AI_SEARCH=False; quota
korumasi icin agent default'ta sadece deterministic DB karsilastirmasi yapar.

EVENT'LER:
  - `supplier_discount` — yeni indirim tespit edildi
  - `price_alert_triggered` — kullanicinin alarmi tetiklendi
  - `cheaper_alternative_found` — mevcut maliyetten ucuz tedarikci

TETİKLEYİCİ: Scheduler (her saat) + manuel `/agents/SourcingAgent/run`

IDEMPOTENCY:
  - Ayni indirim icin tekrar bildirim atmamak: _maybe_create_notification + last_checked_at
  - Tetiklenmis alert'in status'u "triggered"a yukseltilir, ayni tick'te tekrar tetiklenmez
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.db.models import Supplier, Product, PriceAlert, Notification
from app.agents.base import BaseAgent, AgentResult, AgentEvent, _now


class SourcingAgent(BaseAgent):
    name = "SourcingAgent"

    # Operatorel parametreler
    DISCOUNT_NOTIFY_FRESHNESS_HOURS = 24    # son 24 saatte tespit edilen indirimleri haberle
    ALTERNATIVE_PRICE_DELTA_PCT = 10.0      # cost'tan >%10 ucuz alternatif → bildirim
    ENABLE_AI_SEARCH = False                # AI web search opt-in (quota korumasi)

    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        try:
            notif_count = 0
            events_out: List[AgentEvent] = []
            details: Dict[str, Any] = {
                "discount_alerts": [],
                "triggered_alerts": [],
                "cheaper_alternatives": [],
            }

            # ─── 1. Yeni indirim tespit (son 24 saatte guncel + discount_pct > 0) ───
            cutoff = (datetime.now() - timedelta(hours=self.DISCOUNT_NOTIFY_FRESHNESS_HOURS))
            cutoff_iso = cutoff.strftime("%Y-%m-%d %H:%M:%S")

            fresh_discounts = (
                db.query(Supplier)
                .filter(Supplier.discount_pct > 0)
                .all()
            )
            for s in fresh_discounts:
                # last_checked_at son 24 saatte mi?
                is_fresh = True
                if s.last_checked_at:
                    try:
                        last = datetime.strptime(s.last_checked_at[:19], "%Y-%m-%d %H:%M:%S")
                        is_fresh = last >= cutoff
                    except (ValueError, TypeError):
                        is_fresh = True  # parse edilemiyorsa fresh kabul et

                if not is_fresh:
                    continue

                discounted = round((s.current_price or 0) * (1 - (s.discount_pct or 0) / 100), 2)
                title = f"Tedarikci Indirim: {s.name} - {s.product}"
                msg = (
                    f"{s.name} tedarikcisi {s.product} icin %{s.discount_pct} indirim sunuyor. "
                    f"Liste fiyat: {s.current_price} TL → Indirimli: {discounted} TL. "
                    f"MOQ: {s.min_order} adet, Kargo: ~{s.shipping_days} gun."
                )
                n = self._maybe_create_notification(
                    db, user_id, "tedarikci_indirimi", title, msg, "info"
                )
                if n:
                    notif_count += 1
                    details["discount_alerts"].append({
                        "supplier_id": s.id,
                        "name": s.name,
                        "product": s.product,
                        "current_price": s.current_price,
                        "discounted_price": discounted,
                        "discount_pct": s.discount_pct,
                    })
                    events_out.append(AgentEvent(
                        type_="supplier_discount",
                        data={
                            "supplier_id": s.id,
                            "name": s.name,
                            "product": s.product,
                            "discounted_price": discounted,
                            "discount_pct": s.discount_pct,
                        },
                        source_agent=self.name,
                    ))

            # ─── 2. Aktif price_alert'lar tetiklendi mi? ──────────────────────────
            active_alerts = (
                db.query(PriceAlert)
                .filter(PriceAlert.user_id == user_id, PriceAlert.status == "active")
                .all()
            )
            for alert in active_alerts:
                # Eslesen supplier'lari bul (ister product ister supplier ismi ile)
                supplier_q = db.query(Supplier)
                if alert.supplier:
                    supplier_q = supplier_q.filter(Supplier.name == alert.supplier)
                else:
                    supplier_q = supplier_q.filter(Supplier.product.ilike(f"%{alert.product_name}%"))
                matching = supplier_q.all()

                trigger_supplier = None
                for s in matching:
                    discounted = (s.current_price or 0) * (1 - (s.discount_pct or 0) / 100)
                    if discounted > 0 and discounted <= alert.target_price:
                        trigger_supplier = s
                        break

                if trigger_supplier:
                    discounted = round(trigger_supplier.current_price * (1 - (trigger_supplier.discount_pct or 0) / 100), 2)
                    title = f"Alarm Tetiklendi: {alert.product_name} {alert.target_price} TL altinda"
                    msg = (
                        f"{trigger_supplier.name} tedarikcisinde {alert.product_name} "
                        f"hedef fiyat {alert.target_price} TL altina dustu (anlik {discounted} TL). "
                        f"Alim icin uygun zaman."
                    )
                    n = self._maybe_create_notification(
                        db, user_id, "fiyat_alarmi", title, msg, "critical"
                    )
                    if n:
                        notif_count += 1
                        details["triggered_alerts"].append({
                            "alert_id": alert.id,
                            "product_name": alert.product_name,
                            "target_price": alert.target_price,
                            "actual_price": discounted,
                            "supplier": trigger_supplier.name,
                        })
                        events_out.append(AgentEvent(
                            type_="price_alert_triggered",
                            data={
                                "alert_id": alert.id,
                                "product_name": alert.product_name,
                                "target_price": alert.target_price,
                                "actual_price": discounted,
                            },
                            source_agent=self.name,
                        ))
                        # Alert'i triggered olarak isaretle (tekrar tetiklenmesin)
                        alert.status = "triggered"

            # ─── 3. Daha ucuz alternatif tedarikci tespiti ────────────────────────
            # Kullanicinin urunleri vs supplier maliyetleri karsilastirmasi.
            # Mevcut product.cost ile en ucuz supplier discounted_price'i karsilastir.
            user_products = (
                db.query(Product)
                .filter(Product.user_id == user_id)
                .all()
            )
            # Aynı product_code icin tek kart yeter (cross-marketplace duplicate atla)
            seen_codes = set()
            for p in user_products:
                if not p.product_code or p.product_code in seen_codes or not p.cost or p.cost <= 0:
                    continue
                seen_codes.add(p.product_code)

                alt_suppliers = db.query(Supplier).filter(
                    Supplier.product.ilike(f"%{p.name.split()[0]}%")
                ).all()
                if not alt_suppliers:
                    continue

                # En ucuz supplier discounted_price
                cheapest = min(
                    alt_suppliers,
                    key=lambda s: (s.current_price or 0) * (1 - (s.discount_pct or 0) / 100),
                )
                cheap_price = round(
                    (cheapest.current_price or 0) * (1 - (cheapest.discount_pct or 0) / 100), 2
                )
                if cheap_price <= 0:
                    continue

                # Mevcut maliyetten >%10 ucuzsa alert
                savings_pct = round((p.cost - cheap_price) / p.cost * 100, 1)
                if savings_pct < self.ALTERNATIVE_PRICE_DELTA_PCT:
                    continue

                monthly_savings = round((p.cost - cheap_price) * (p.sales_30d or 0), 2)
                title = f"Daha Ucuz Tedarikci: {p.name}"
                msg = (
                    f"{p.name} icin mevcut maliyetiniz {p.cost} TL. "
                    f"{cheapest.name}'de ayni urun {cheap_price} TL (%{savings_pct} tasarruf). "
                    f"Aylik satislariniza gore tahmini tasarruf: ~{monthly_savings} TL."
                )
                n = self._maybe_create_notification(
                    db, user_id, "ucuz_tedarikci", title, msg, "info"
                )
                if n:
                    notif_count += 1
                    details["cheaper_alternatives"].append({
                        "product_code": p.product_code,
                        "product_name": p.name,
                        "current_cost": p.cost,
                        "alternative_cost": cheap_price,
                        "alternative_supplier": cheapest.name,
                        "savings_pct": savings_pct,
                        "estimated_monthly_savings": monthly_savings,
                    })
                    events_out.append(AgentEvent(
                        type_="cheaper_alternative_found",
                        data={
                            "product_code": p.product_code,
                            "savings_pct": savings_pct,
                            "monthly_savings": monthly_savings,
                        },
                        source_agent=self.name,
                    ))

            db.commit()
            self.last_run = _now()
            return AgentResult(
                agent_name=self.name,
                status="ok",
                items_processed=len(fresh_discounts) + len(active_alerts) + len(seen_codes),
                notifications_created=notif_count,
                events=events_out,
                details=details,
            )

        except Exception as e:
            db.rollback()
            return AgentResult(
                agent_name=self.name, status="error", error=f"{type(e).__name__}: {e}"
            )
