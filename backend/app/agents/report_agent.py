"""
ReportAgent
- Onceki ajanlardan gelen event'leri context'e alir
- Genel magaza ozetini hesaplar
- Gemini'den gunluk rapor uretir, reports tablosuna yazar
- Gunde 1 kere calismali (idempotent: ayni gun icin daily rapor varsa atlar)
"""

import json
from datetime import datetime, date
from app.db.models import Report
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import (
    calculate_marketplace_metrics, calculate_overall_metrics,
)
from app.services.gemini_service import ask_gemini
from app.agents.base import BaseAgent, AgentResult, _now


class ReportAgent(BaseAgent):
    name = "ReportAgent"

    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        try:
            # Bugun icin daily rapor zaten var mi? (idempotent)
            today = date.today().isoformat()
            existing = (
                db.query(Report)
                .filter(
                    Report.user_id == user_id,
                    Report.type == "daily",
                    Report.created_at.like(f"{today}%"),
                )
                .first()
            )
            if existing:
                return AgentResult(
                    agent_name=self.name,
                    status="ok",
                    details={"note": "Bugun icin daily rapor zaten var", "report_id": existing.id},
                )

            # Ana metrikler
            marketplaces = fetch_all_marketplaces(user_id)
            all_metrics = {}
            for mp in marketplaces:
                mp_data = fetch_store_info(mp, user_id)
                if mp_data:
                    all_metrics[mp] = calculate_marketplace_metrics(mp_data)
            overall = calculate_overall_metrics(all_metrics)

            # Onceki ajanlardan event'leri rapor context'ine ekle
            events_summary = []
            if events_in:
                for e in events_in:
                    events_summary.append({
                        "type": e.type,
                        "source": e.source_agent,
                        "data": e.data,
                    })

            mp_summary = {
                mp: {
                    "revenue": m["total_revenue"],
                    "profit": m["total_net_profit"],
                    "sales": m["total_sales"],
                    "margin_pct": m["net_margin_pct"],
                }
                for mp, m in all_metrics.items()
            }

            event_note = ""
            if events_summary:
                event_note = (
                    f"\n\nBUGUN ALGILANAN ONEMLI OLAYLAR (diger ajanlardan):\n"
                    f"{json.dumps(events_summary, ensure_ascii=False, indent=2)}\n\n"
                    "Bu olaylari raporun 'Dikkat Edilmesi Gerekenler' kismina dahil et."
                )

            prompt = f"""Asagidaki verilere gore otomatik gunluk magaza ozeti raporu olustur. Turkce yanit ver.

TARIH: {today}

GENEL:
{json.dumps(overall, ensure_ascii=False, indent=2)}

PAZARYERI BAZLI:
{json.dumps(mp_summary, ensure_ascii=False, indent=2)}
{event_note}

Rapor formati:
1. **Gunun Ozeti** (2-3 cumle)
2. **One Cikan Metrikler** (iyi 2, kotu 2)
3. **Dikkat Edilmesi Gerekenler** (agent event'lerini de dahil et)
4. **Bugunku Oncelikli Aksiyonlar** (3 madde)
"""
            system = (
                "Sen bir e-ticaret rapor uzmanisin. Otonom ajan sisteminin gunluk "
                "ozetini yaziyorsun. Diger ajanlardan gelen uyari/event'leri rapora dahil et."
            )
            content = await ask_gemini(prompt, system)

            rep = Report(
                user_id=user_id,
                type="daily",
                title=f"Otomatik Gunluk Rapor - {today}",
                content=content,
                metrics_json={
                    "revenue": overall["total_revenue"],
                    "net_profit": overall["total_net_after_ads"],
                    "sales": overall["total_sales"],
                    "return_rate": overall["overall_return_rate"],
                    "roas": overall["overall_roas"],
                    "marketplaces": mp_summary,
                    "agent_events": events_summary,
                    "generated_by": "ReportAgent",
                },
                created_at=_now(),
            )
            db.add(rep)
            db.commit()
            db.refresh(rep)

            self.last_run = _now()
            return AgentResult(
                agent_name=self.name,
                status="ok",
                items_processed=1,
                details={
                    "report_id": rep.id,
                    "title": rep.title,
                    "events_included": len(events_summary),
                },
            )

        except Exception as e:
            db.rollback()
            return AgentResult(
                agent_name=self.name, status="error", error=f"{type(e).__name__}: {e}"
            )
