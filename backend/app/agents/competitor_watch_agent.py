"""
CompetitorWatchAgent
- competitor_price_history tablosunu tarar
- Son snapshot ile 7 gun onceki baseline'i karsilastirir
- |fark| >= %3 ise bildirim olustur + 'competitor_price_changed' event yayar
- >= %5 ise warning, < %5 ise info
"""

from datetime import datetime, date, timedelta
from app.db.models import CompetitorPriceHistory, Product
from app.agents.base import BaseAgent, AgentResult, AgentEvent, _now


class CompetitorWatchAgent(BaseAgent):
    name = "CompetitorWatchAgent"

    CHANGE_THRESHOLD_PCT = 3.0      # >%3 fark = bildirim
    WARNING_THRESHOLD_PCT = 5.0     # >%5 = warning, altinda info

    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        try:
            user_product_ids = [
                p.id for p in db.query(Product).filter(Product.user_id == user_id).all()
            ]
            if not user_product_ids:
                return AgentResult(
                    agent_name=self.name, status="ok",
                    details={"note": "Kullaniciya ait urun yok"},
                )

            snapshots = (
                db.query(CompetitorPriceHistory)
                .filter(CompetitorPriceHistory.product_id.in_(user_product_ids))
                .order_by(CompetitorPriceHistory.captured_at.asc())
                .all()
            )
            if not snapshots:
                return AgentResult(
                    agent_name=self.name, status="ok",
                    details={"note": "Fiyat tarihcesi henuz yok"},
                )

            groups = {}
            for s in snapshots:
                groups.setdefault((s.product_id, s.competitor_name), []).append(s)

            seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
            processed = 0
            notif_count = 0
            events_out = []
            changes = []

            for (pid, name), snaps in groups.items():
                if len(snaps) < 2:
                    continue
                processed += 1
                latest = snaps[-1]
                baseline = next(
                    (s for s in reversed(snaps[:-1]) if s.captured_at <= seven_days_ago),
                    snaps[0],
                )
                if baseline.price == 0:
                    continue
                diff_pct = round((latest.price - baseline.price) / baseline.price * 100, 1)
                if abs(diff_pct) < self.CHANGE_THRESHOLD_PCT:
                    continue

                product = db.query(Product).filter(Product.id == pid).first()
                product_name = product.name if product else f"ID {pid}"
                direction = "dusurdu" if diff_pct < 0 else "yukseltti"
                severity = "warning" if abs(diff_pct) >= self.WARNING_THRESHOLD_PCT else "info"

                title = f"Rakip Fiyat Degisikligi: {name} ({product_name})"
                msg = (
                    f"{name} {product_name} icin fiyatini %{abs(diff_pct)} {direction}. "
                    f"Eski: {baseline.price} TL ({baseline.captured_at}), "
                    f"Yeni: {latest.price} TL ({latest.captured_at})."
                )
                n = self._maybe_create_notification(
                    db, user_id, "rakip_fiyat", title, msg, severity
                )
                if n:
                    notif_count += 1

                change_data = {
                    "product_id": pid,
                    "product_code": product.product_code if product else None,
                    "product_name": product_name,
                    "competitor": name,
                    "old_price": baseline.price,
                    "new_price": latest.price,
                    "change_pct": diff_pct,
                    "direction": direction,
                }
                changes.append(change_data)
                events_out.append(AgentEvent(
                    type_="competitor_price_changed",
                    data=change_data,
                    source_agent=self.name,
                ))

            db.commit()
            self.last_run = _now()
            return AgentResult(
                agent_name=self.name,
                status="ok",
                items_processed=processed,
                notifications_created=notif_count,
                events=events_out,
                details={"changes": changes},
            )

        except Exception as e:
            db.rollback()
            return AgentResult(
                agent_name=self.name, status="error", error=f"{type(e).__name__}: {e}"
            )
