"""
AgentScheduler — periyodik calismayi yonetir.
asyncio.create_task ile arka planda 1 saatte bir tum ajan pipeline'ini calistirir.
.env'de AGENT_INTERVAL_SECONDS ile override edilebilir; 0 ise scheduler kapali.
"""

import asyncio
import logging
from app.agents.orchestrator import (
    run_all_agents_for_all_users,
)
from app.config import settings

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SEC = settings.AGENT_INTERVAL_SECONDS  # .env'den pydantic ile gelir
_scheduler_task = None



async def _scheduler_loop(interval: int):
    """Backend ayakta oldugu surece donen task."""
    logger.info(f"Agent scheduler started with interval={interval}s")
    while True:
        try:
            await asyncio.sleep(interval)
            logger.info("Agent scheduler tick — running all agents for all users")
            runs = await run_all_agents_for_all_users()
            logger.info(f"Agent scheduler done — {len(runs)} user run(s)")
        except asyncio.CancelledError:
            logger.info("Agent scheduler cancelled")
            break
        except Exception as e:
            logger.exception(f"Agent scheduler error: {e}")
            # Hata olsa bile bir sonraki tick'te devam et


def start_scheduler():
    global _scheduler_task
    if DEFAULT_INTERVAL_SEC <= 0:
        logger.info("Agent scheduler disabled (AGENT_INTERVAL_SECONDS=0)")
        return None
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop(DEFAULT_INTERVAL_SEC))
    return _scheduler_task


def stop_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()



