from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.services.marketplace_api import fetch_store_info, fetch_all_marketplaces
from app.services.calculator import calculate_marketplace_metrics, calculate_overall_metrics
from app.services.gemini_service import ask_gemini
import json
import os

router = APIRouter()

HISTORY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "chat_history.json")


def _load_history():
    if not os.path.exists(HISTORY_PATH):
        return []
    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_history(history):
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


class ChatMessage(BaseModel):
    message: str
    token: str = ""


@router.post("/ask")
def ask(msg: ChatMessage, user = Depends(get_current_user)):
    from app.agents.basiret_agent import run_basiret_agent
    
    # Ajan tetikleniyor, tum verileri ajan kendi toplayacak
    response = run_basiret_agent(msg.message, user.id)

    # Gecmise kaydet
    history = _load_history()
    history.append({
        "question": msg.message,
        "answer": response,
        "timestamp": "2026-05-10",
    })
    _save_history(history)

    return {"response": response}


@router.get("/history")
def get_history(token: str = "", user = Depends(get_current_user)):
    history = _load_history()
    return {"history": history}


@router.delete("/history")
def clear_history(token: str = "", user = Depends(get_current_user)):
    _save_history([])
    return {"message": "Sohbet gecmisi temizlendi"}