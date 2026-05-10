"""
BaseAgent — tum otonom ajanlar bunu kalitir.
Ajanlar:
- DB'den veri okur, analiz eder
- Sonuclari DB'ye + notifications tablosuna yazar
- Birbirini tetikleyebilir (events listesi ile)
- Periyodik calisma icin Orchestrator tarafindan invoke edilir
"""

import logging
from datetime import datetime
from abc import ABC, abstractmethod
from app.db.database import SessionLocal
from app.db.models import Notification

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class AgentEvent:
    """Ajanlardan ajanlara iletilen olay."""
    def __init__(self, type_: str, data: dict, source_agent: str):
        self.type = type_  # "new_negative_reviews", "price_changed", vb.
        self.data = data
        self.source_agent = source_agent
        self.created_at = _now()

    def __repr__(self):
        return f"<AgentEvent {self.type} from {self.source_agent}>"


class AgentResult:
    """Bir ajanin tek calisma ciktisi."""
    def __init__(
        self,
        agent_name: str,
        status: str,
        items_processed: int = 0,
        notifications_created: int = 0,
        events: list = None,
        details: dict = None,
        error: str = None,
    ):
        self.agent_name = agent_name
        self.status = status  # ok | partial | error
        self.items_processed = items_processed
        self.notifications_created = notifications_created
        self.events = events or []
        self.details = details or {}
        self.error = error
        self.finished_at = _now()

    def to_dict(self):
        return {
            "agent": self.agent_name,
            "status": self.status,
            "items_processed": self.items_processed,
            "notifications_created": self.notifications_created,
            "events_emitted": [e.type for e in self.events],
            "details": self.details,
            "error": self.error,
            "finished_at": self.finished_at,
        }


class BaseAgent(ABC):
    name = "base"

    def __init__(self):
        self.last_run = None

    @abstractmethod
    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        """Ajan ana isleyis fonksiyonu."""
        ...

    def _maybe_create_notification(
        self, db, user_id, type_, title, message, severity
    ):
        """Ayni baslikta okunmamis bildirim varsa eklemez (idempotent)."""
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.title == title,
                Notification.read == False,
            )
            .first()
        )
        if existing:
            return None
        n = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            message=message,
            severity=severity,
            read=False,
            created_at=_now(),
        )
        db.add(n)
        db.flush()
        return n
