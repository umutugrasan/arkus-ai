"""
AgentOrchestrator
- Tum ajanlari sirayla calistir
- Onceki ajanlarin emit ettigi event'leri sonraki ajanlara aktarir
- Sonuc raporu (her ajan icin AgentResult listesi) dondurur
- Periyodik tetikleme scheduler tarafindan yapilir
"""

from datetime import datetime
from app.db.database import SessionLocal
from app.db.models import User
from app.agents.review_analyzer_agent import ReviewAnalyzerAgent
from app.agents.competitor_watch_agent import CompetitorWatchAgent
from app.agents.sourcing_agent import SourcingAgent
from app.agents.review_response_agent import ReviewResponseAgent
from app.agents.report_agent import ReportAgent


# Calisma sirasi onemli: once veri analizleri (yorum + rakip + tedarik), sonra
# yorum cevabi taslaklari (negatif yorumlar tespit edildikten sonra), en sonda
# tum event'leri toplayan rapor.
AGENT_PIPELINE = [
    ReviewAnalyzerAgent(),
    CompetitorWatchAgent(),
    SourcingAgent(),
    ReviewResponseAgent(),
    ReportAgent(),
]


async def run_all_agents_for_user(user_id: int) -> dict:
    """Tek bir kullanici icin tum ajan pipeline'ini calistirir."""
    db = SessionLocal()
    try:
        results = []
        events_accumulator = []  # onceki ajanlarin emit ettigi event'ler

        for agent in AGENT_PIPELINE:
            result = await agent.run(user_id, db, events_in=events_accumulator)
            results.append(result)
            # Bu ajanin event'leri sonraki ajanlara aktarilsin
            events_accumulator.extend(result.events)

        return {
            "user_id": user_id,
            "ran_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "agents_run": len(results),
            "total_events_emitted": len(events_accumulator),
            "results": [r.to_dict() for r in results],
        }
    finally:
        db.close()


async def run_all_agents_for_all_users() -> list:
    """Tum kullanicilar icin pipeline. Periyodik scheduler bunu cagirir."""
    db = SessionLocal()
    try:
        users = db.query(User.id).all()
        user_ids = [u.id for u in users]
    finally:
        db.close()

    runs = []
    for uid in user_ids:
        runs.append(await run_all_agents_for_user(uid))
    return runs


def get_agent_status() -> list:
    """Her ajanin son calisma zamani."""
    return [
        {"name": a.name, "last_run": a.last_run}
        for a in AGENT_PIPELINE
    ]
