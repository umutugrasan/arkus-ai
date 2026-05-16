import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from app.dependencies import get_current_user, get_db
from app.db.models import ChatHistory
from app.rate_limit import limiter
from app.config import settings
from app.services.gemini_service import ask_gemini_stream
from app.sse import sse_response

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
    from app.agents.arkus_agent import run_arkus_agent
    response = run_arkus_agent(msg.message, user.id)

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


@router.post("/ask/stream")
@limiter.limit(settings.RATE_LIMIT_AI_PER_MIN)
async def ask_stream(
    request: Request,
    msg: ChatMessage,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Streaming chat — token token akan SSE response.
    Frontend EventSource veya fetch+ReadableStream ile dinler.
    Cevap bittiginde otomatik DB'ye yazilir.
    """
    if not msg.message.strip():
        raise HTTPException(status_code=400, detail="Mesaj bos olamaz")

    # Agent context'i ve prompt'u hazirla — zengin context (urun-bazli detay dahil)
    from app.agents.arkus_agent import _build_rich_context
    overview = _build_rich_context(user.id)
    system_instruction = (
        "Sen Arkus AI'sin, profesyonel bir e-ticaret danismanisin.\n\n"
        "Asagidaki SATICI VERILERI sana SAGLANMIS DURUMDADIR — kullanicidan ek bilgi istemene gerek yok:\n"
        f"{json.dumps(overview, ensure_ascii=False, indent=2)}\n\n"
        "ONEMLI KURALLAR:\n"
        "1. Yukaridaki context'te urun-bazli detay vardir:\n"
        "   - 'products_aggregated': urun-toplam satis/ciro/kar\n"
        "   - 'top_selling_products_30d': en cok satan urunler\n"
        "   - 'most_profitable_products_30d': en karli urunler\n"
        "   - 'low_stock_listings' / 'low_rated_listings' / 'high_return_rate_listings'\n"
        "   - 'by_marketplace': her pazaryerinin tum metrikleri\n"
        "2. ASLA 'urun bazinda veri yok' / 'entegrasyon gerekli' gibi cevap VERME — tum veri burada.\n"
        "3. Sorulan rakami context'ten cek, urun adi + sayi seklinde goster.\n"
        "4. Rakamlarla konus, somut 1-2 aksiyon oner. Markdown kullan ama abartma. Turkce yanit ver.\n\n"
        "Cevap formati: kisa giris + rakamlarla durum + somut 1-2 aksiyon onerisi."
    )

    async def event_stream():
        full_text_parts = []
        try:
            yield f"event: meta\ndata: {json.dumps({'user_id': user.id, 'started_at': _now()}, ensure_ascii=False)}\n\n"
            async for chunk in ask_gemini_stream(
                msg.message, system_instruction, endpoint="chat.ask.stream", user_id=user.id
            ):
                if chunk.get("done"):
                    full_text = "".join(full_text_parts)
                    # DB'ye yaz
                    record = ChatHistory(
                        user_id=user.id, question=msg.message,
                        answer=full_text, created_at=_now(),
                    )
                    db.add(record)
                    db.commit()
                    db.refresh(record)
                    event = "error" if chunk.get("error") else "done"
                    yield f"event: {event}\ndata: {json.dumps({'id': record.id, 'full_text': full_text, 'model': chunk.get('model'), 'error': chunk.get('error')}, ensure_ascii=False)}\n\n"
                    return
                txt = chunk.get("text", "")
                if txt:
                    full_text_parts.append(txt)
                    yield f"event: chunk\ndata: {json.dumps({'text': txt}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return sse_response(event_stream())


@router.delete("/history")
def clear_history(user=Depends(get_current_user), db=Depends(get_db)):
    deleted = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user.id)
        .delete()
    )
    db.commit()
    return {"message": "Sohbet gecmisi temizlendi", "deleted_count": deleted}
