import os
import time
import logging
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from app.config import settings

load_dotenv()

logger = logging.getLogger(__name__)
API_KEY = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

MODEL_CASCADE = [
    settings.GEMINI_MODEL,
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
]

_client = None


def get_client():
    global _client
    if _client is None and API_KEY and API_KEY != "your_gemini_api_key_here":
        from google import genai
        _client = genai.Client(api_key=API_KEY)
    return _client


def _log_usage(
    endpoint: str,
    model: Optional[str],
    success: bool,
    used_search: bool = False,
    used_vision: bool = False,
    error_type: Optional[str] = None,
    duration_ms: Optional[int] = None,
    user_id: Optional[int] = None,
):
    """AI cagrisinin sonucunu ai_usage_logs tablosuna yaz."""
    try:
        from app.db.database import SessionLocal
        from app.db.models import AIUsageLog
        db = SessionLocal()
        try:
            db.add(AIUsageLog(
                user_id=user_id,
                endpoint=endpoint,
                model=model,
                used_search=used_search,
                used_vision=used_vision,
                success=success,
                error_type=error_type,
                duration_ms=duration_ms,
                created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"ai_usage_log yazilamadi: {e}")


def _try_models(call_fn):
    last_err = None
    for model in MODEL_CASCADE:
        try:
            return call_fn(model), model, None
        except Exception as e:
            last_err = e
            logger.warning(f"Gemini model {model} failed: {type(e).__name__}: {e}")
            continue
    return None, None, last_err


async def ask_gemini(
    prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
    strict: bool = False,
) -> str:
    """
    Gemini text completion.
    strict=True: hata olursa fallback verme, Exception raise et (analiz endpoint'leri icin).
    strict=False: hata olursa mock fallback (chat girisi vs.).
    """
    t0 = time.perf_counter()
    client = get_client()
    if client is None:
        _log_usage(endpoint, None, success=False, error_type="no_api_key", user_id=user_id)
        if strict:
            raise GeminiError("Gemini API key tanimli degil")
        return _fallback_response(prompt)

    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

    def _call(model):
        return client.models.generate_content(model=model, contents=full_prompt)

    response, used_model, err = _try_models(_call)
    duration_ms = int((time.perf_counter() - t0) * 1000)

    if response is None:
        _log_usage(
            endpoint, used_model, success=False,
            error_type=type(err).__name__ if err else "unknown",
            duration_ms=duration_ms, user_id=user_id,
        )
        if strict:
            raise GeminiError(f"Gemini API basarisiz: {err}")
        return (
            f"⚠️ Gemini API cagrisi basarisiz ({type(err).__name__ if err else 'unknown'}). "
            "Demo icin mock yanit.\n\n---\n\n" + _fallback_response(prompt)
        )

    _log_usage(endpoint, used_model, success=True, duration_ms=duration_ms, user_id=user_id)
    return response.text


async def ask_gemini_with_search(
    prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
    strict: bool = False,
) -> dict:
    t0 = time.perf_counter()
    client = get_client()
    if client is None:
        _log_usage(endpoint, None, success=False, used_search=True,
                   error_type="no_api_key", user_id=user_id)
        if strict:
            raise GeminiError("Gemini API key tanimli degil")
        return {
            "text": _fallback_response(prompt),
            "sources": [], "used_search": False, "model": None,
        }

    try:
        from google.genai import types as genai_types
    except ImportError:
        _log_usage(endpoint, None, success=False, used_search=True,
                   error_type="sdk_missing", user_id=user_id)
        if strict:
            raise GeminiError("Gemini SDK eksik")
        return {"text": _fallback_response(prompt), "sources": [], "used_search": False, "model": None}

    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
    config = genai_types.GenerateContentConfig(
        tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())]
    )

    def _call(model):
        return client.models.generate_content(model=model, contents=full_prompt, config=config)

    response, used_model, err = _try_models(_call)
    duration_ms = int((time.perf_counter() - t0) * 1000)

    if response is None:
        _log_usage(
            endpoint, used_model, success=False, used_search=True,
            error_type=type(err).__name__ if err else "unknown",
            duration_ms=duration_ms, user_id=user_id,
        )
        if strict:
            raise GeminiError(f"Gemini grounding basarisiz: {err}")
        return {
            "text": (
                f"⚠️ Gemini Google Search grounding kullanilamadi "
                f"({type(err).__name__ if err else 'unknown'}). Mock yanit.\n\n---\n\n"
                + _fallback_response(prompt)
            ),
            "sources": [], "used_search": False, "model": None,
        }

    sources = []
    try:
        grounding = response.candidates[0].grounding_metadata
        if grounding and grounding.grounding_chunks:
            for chunk in grounding.grounding_chunks:
                if chunk.web:
                    sources.append({"title": chunk.web.title, "uri": chunk.web.uri})
    except (AttributeError, IndexError, TypeError):
        pass

    _log_usage(endpoint, used_model, success=True, used_search=True,
               duration_ms=duration_ms, user_id=user_id)
    return {"text": response.text, "sources": sources, "used_search": True, "model": used_model}


async def ask_gemini_vision(
    image_source: str, prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
) -> dict:
    t0 = time.perf_counter()
    client = get_client()
    if client is None:
        _log_usage(endpoint, None, success=False, used_vision=True,
                   error_type="no_api_key", user_id=user_id)
        return {
            "text": "⚠️ Gemini API key tanimli degil.",
            "model": None, "used_url": image_source,
        }

    try:
        from google.genai import types as genai_types
        import httpx
        import base64
    except ImportError:
        return {"text": "Vision SDK eksik", "model": None, "used_url": image_source}

    try:
        if image_source.startswith("data:"):
            header, b64data = image_source.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
            image_bytes = base64.b64decode(b64data)
        elif image_source.startswith("http"):
            async with httpx.AsyncClient(timeout=15.0) as h:
                resp = await h.get(image_source, follow_redirects=True)
                resp.raise_for_status()
                image_bytes = resp.content
                mime_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
                if mime_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                    mime_type = "image/jpeg"
        else:
            return {"text": "Gecersiz image_source", "model": None, "used_url": image_source}
    except Exception as e:
        _log_usage(endpoint, None, success=False, used_vision=True,
                   error_type=f"image_fetch_{type(e).__name__}", user_id=user_id)
        return {"text": f"⚠️ Gorsel indirilemedi ({type(e).__name__}).", "model": None, "used_url": image_source}

    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
    image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    last_err = None
    for model in MODEL_CASCADE:
        try:
            response = client.models.generate_content(model=model, contents=[image_part, full_prompt])
            duration_ms = int((time.perf_counter() - t0) * 1000)
            _log_usage(endpoint, model, success=True, used_vision=True,
                       duration_ms=duration_ms, user_id=user_id)
            return {"text": response.text, "model": model, "used_url": image_source}
        except Exception as e:
            last_err = e
            logger.warning(f"Vision model {model} failed: {type(e).__name__}: {e}")
            continue

    _log_usage(endpoint, None, success=False, used_vision=True,
               error_type=type(last_err).__name__ if last_err else "unknown",
               duration_ms=int((time.perf_counter() - t0) * 1000),
               user_id=user_id)
    return {
        "text": f"⚠️ Vision analizi yapilamadi ({type(last_err).__name__ if last_err else 'unknown'}).",
        "model": None, "used_url": image_source,
    }


class GeminiError(Exception):
    """Strict mode'da Gemini fail durumunda raise edilir."""
    pass


def _fallback_response(prompt: str) -> str:
    if "yorum" in prompt.lower() or "duygu" in prompt.lower():
        return ("## Yorum Analizi Ozeti\n\n"
                "Genel duygu karisik. Kargo gecikmeleri ve urun kalitesi en sik sikayet.\n"
                "Oneri: Kargo firmasini gozden gecirin, kalite kontrolunu sikilastirin.")
    elif "rakip" in prompt.lower():
        return ("## Rakip Analizi\n\n"
                "Ana rakipler benzer fiyat seviyesinde. Kalite algisi ile farklilasin.")
    elif "finansal" in prompt.lower() or "gelir" in prompt.lower():
        return ("## Finansal Durum\n\n"
                "Genel trend pozitif. Reklam ROI'sini takip edin.")
    elif "saglik" in prompt.lower() or "skor" in prompt.lower():
        return ("## Saglik Skoru\n\n"
                "Magazaniz orta-iyi seviyede. Iade orani ve yorum puani gelistirilebilir.")
    else:
        return ("Merhaba! Ben Basiret AI. "
                "Yorum analizi, rakip karsilastirma, arbitraj, finansal analiz ve "
                "saglik skoru konularinda yardimci olabilirim.")
