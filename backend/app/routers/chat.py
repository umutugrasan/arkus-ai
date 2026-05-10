from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from app.dependencies import get_current_user, get_db
from app.db.models import ChatHistory
from app.rate_limit import limiter
from app.config import settings

router = APIRouter()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class ChatMessage(BaseModel):
    message: str


@router.post("/ask")
@limiter.limit(settings.RATE_LIMIT_AI_PER_MIN)
def ask(
    request: Request,
    msg: ChatMessage,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if not msg.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj bos olamaz")

    # Agent'i lazy import et — startup'ta circular import olmasin
    from app.agents.basiret_agent import run_basiret_agent
    response = run_basiret_agent(msg.message, user.id)

    record = ChatHistory(
        user_id=user.id,
        question=msg.message,
        answer=response,
        created_at=_now(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "question": record.question,
        "answer": record.answer,
        "created_at": record.created_at,
    }


@router.get("/history")
def get_history(
    limit: int = 50,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    rows = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .order_by(ChatHistory.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "total": len(rows),
        "history": [
            {
                "id": r.id,
                "question": r.question,
                "answer": r.answer,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


@router.delete("/history")
def clear_history(user=Depends(get_current_user), db=Depends(get_db)):
    deleted = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .delete()
    )
    db.commit()
    return {"message": "Sohbet gecmisi temizlendi", "deleted_count": deleted}
