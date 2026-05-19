"""
Gemini servisi — purpose-based API key pool + per-key client cache + 2-katmanlı
fallback (pool icinde key cevirme → model cascade → default pool).

Pool tasarimi:
    agents   → otonom ajan tick'leri (ReviewAnalyzer, Competitor, Report ...)
    chat     → conversational arkus_agent (function-calling)
    analyze  → /analyze endpoint'leri (yorum/rakip/finansal/health/sourcing/...)
    vision   → image-analyzer (Gemini Vision)
    default  → ustteki pool'lardan biri bos olursa fallback; ayrica eski caller'lar

Mevcut caller'lar pool parametresi gecmezse default'a duser → backward compat.
Tum pool'lar bos + GEMINI_API_KEY de bos ise client None doner, "AI unavailable".
"""

import os
import time
import threading
import logging
from datetime import datetime
from itertools import cycle
from typing import Optional, Dict, List, Tuple, Any
from dotenv import load_dotenv

from app.config import settings

load_dotenv()

logger = logging.getLogger(__name__)


# ─── Havuz-bazli model deneme sirasi ─────────────────────────────────────────
# Her havuz kendi tercih ettigi modelle BASLAR, ardindan desteklenen TUM diger
# modelleri sirayla dener — boylece hicbir havuz tek modele kisitli kalmaz, bir
# model tukenince digerine gecer. Listede yalnizca bu projede limiti > 0 olan
# modeller var; 0/0 olan (desteklenmeyen) gemini-2.0-flash / 2.0-flash-lite /
# *-pro ve kaldirilan gemini-1.5-flash KASITLI olarak YOK — olu modelin 429'u
# saglam key'i haksiz yere bench'lemesin.

def _dedup(seq: List[str]) -> List[str]:
    """Sirayi koruyarak tekrarlari atar (bos degerleri de eler)."""
    seen: set = set()
    return [m for m in seq if m and not (m in seen or seen.add(m))]


_AGENTS_MODEL = settings.GEMINI_MODEL                                  # agents/vision birincil — sart: 2.5-flash
_FAST_MODEL = os.getenv("GEMINI_MODEL_FAST", "gemini-3.1-flash-lite")   # chat/analyze birincil — yuksek RPD
# Ek desteklenen text modelleri (virgulle, .env > GEMINI_MODELS_EXTRA ile genisletilebilir).
_EXTRA_MODELS = [
    m.strip() for m in
    os.getenv("GEMINI_MODELS_EXTRA", "gemini-2.5-flash-lite,gemini-3-flash-preview").split(",")
    if m.strip()
]

# Desteklenen TUM modeller — havuzun birincili tukenince sirayla buradaki herkes denenir.
_ALL_MODELS = _dedup([_AGENTS_MODEL, _FAST_MODEL, *_EXTRA_MODELS])

# Havuz → model deneme sirasi: once havuzun tercih ettigi model, sonra kalan TUM modeller.
POOL_MODELS: Dict[str, List[str]] = {
    "agents":  _dedup([_AGENTS_MODEL, *_ALL_MODELS]),
    "chat":    _dedup([_FAST_MODEL,   *_ALL_MODELS]),
    "analyze": _dedup([_FAST_MODEL,   *_ALL_MODELS]),
    "vision":  _dedup([_AGENTS_MODEL, *_ALL_MODELS]),
    "default": _dedup([_FAST_MODEL,   *_ALL_MODELS]),
}


def _models_for_pool(pool: str) -> List[str]:
    """Havuza ait model deneme sirasini dondurur (taninmayan havuz → default)."""
    return POOL_MODELS.get(pool) or POOL_MODELS["default"]


# ─── Pool state (module-level, thread-safe) ──────────────────────────────────

# pool_name → ordered key listesi
_pool_keys: Dict[str, List[str]] = {}
# pool_name → round-robin iterator
_pool_iters: Dict[str, Any] = {}
# key → genai.Client instance (cached)
_clients_by_key: Dict[str, Any] = {}
# (key, model) → cooldown bitis timestamp (429 yiyen key+model gecici black-list)
_key_model_cooldown: Dict[Tuple[str, str], float] = {}
# Threading lock — pool init + iterator advance + client cache thread-safe
_lock = threading.Lock()

_KEY_COOLDOWN_SECONDS = 60.0  # 429 alan key 60 sn dinlensin


def _placeholder_key(k: str) -> bool:
    return not k or k.strip() in ("", "your_gemini_api_key_here")


def _init_pools_locked() -> None:
    """Settings'ten 5 pool'u oku, bos pool'lari default'a yansit."""
    default_keys = [k for k in settings.GEMINI_API_KEYS_DEFAULT if not _placeholder_key(k)]

    raw_pools: Dict[str, List[str]] = {
        "agents":  settings.GEMINI_API_KEYS_AGENTS,
        "chat":    settings.GEMINI_API_KEYS_CHAT,
        "analyze": settings.GEMINI_API_KEYS_ANALYZE,
        "vision":  settings.GEMINI_API_KEYS_VISION,
        "default": default_keys,
    }

    for name, keys in raw_pools.items():
        cleaned = [k.strip() for k in keys if not _placeholder_key(k)]
        # Pool bos ise default'a fallback (default'un kendisi degilse)
        if not cleaned and name != "default":
            cleaned = list(default_keys)
        _pool_keys[name] = cleaned
        _pool_iters[name] = cycle(cleaned) if cleaned else None

    pool_summary = {p: len(_pool_keys.get(p, [])) for p in raw_pools}
    logger.info(f"Gemini pools initialized: {pool_summary}")


def _ensure_pools() -> None:
    """Lazy init — ilk cagri pool'lari kurar."""
    if not _pool_keys:
        with _lock:
            if not _pool_keys:
                _init_pools_locked()


def _is_model_cooled_down(key: str, model: str) -> bool:
    """Bu key ve model 429 cooldown'da mi?"""
    until = _key_model_cooldown.get((key, model), 0.0)
    if until > time.time():
        return True
    if until and until <= time.time():
        _key_model_cooldown.pop((key, model), None)
    return False


def _mark_model_429(key: str, model: str) -> None:
    """Bu key ve modeli 60sn kara listeye al."""
    _key_model_cooldown[(key, model)] = time.time() + _KEY_COOLDOWN_SECONDS
    logger.warning(f"Gemini key ...{key[-6:]} model {model} 429 → {_KEY_COOLDOWN_SECONDS}s cooldown")


def _next_key_from_pool(pool: str) -> Optional[str]:
    """Pool'dan siradaki key'i dondur (round-robin)."""
    _ensure_pools()
    keys = _pool_keys.get(pool) or _pool_keys.get("default") or []
    if not keys:
        return None
    it = _pool_iters.get(pool) or _pool_iters.get("default")
    if it is None:
        return None
    return next(it)


def _get_client_for_key(key: str):
    """Verilen key icin client'i cache'den dondur veya olustur."""
    with _lock:
        cli = _clients_by_key.get(key)
        if cli is None:
            from google import genai
            cli = genai.Client(api_key=key)
            _clients_by_key[key] = cli
        return cli


def get_client(pool: str = "default"):
    """
    Geriye uyumlu API: tek client doner. Pool parametresi yeni.
    Pool'da key yoksa None doner — caller "AI unavailable" gosterir.
    """
    key = _next_key_from_pool(pool)
    if not key:
        return None
    return _get_client_for_key(key)


def _is_quota_error(e: Exception) -> bool:
    s = str(e).lower()
    return "429" in s or "resource_exhausted" in s or "quota" in s


def _is_unavailable_error(e: Exception) -> bool:
    s = str(e).lower()
    return "503" in s or "unavailable" in s or "deadline" in s


# ─── Logging helper (degismedi) ──────────────────────────────────────────────

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


# ─── Pool-aware execution: key x model 2D cascade ────────────────────────────

def _try_pool(pool: str, call_fn) -> Tuple[Optional[Any], Optional[str], Optional[Exception]]:
    """
    2-katmanli cascade:
      DIS:  pool icindeki her key icin (cooldown'da olmayan)
      IC:   her model icin (havuza ait POOL_MODELS sirasi)
    429 → modeli 60sn kara listeye al, sonraki modele gec
    503 → ayni key + 1sn bekle + 1 retry; basarisizsa sonraki model
    404 → sonraki model
    Diger hata → log + sonraki model

    Returns: (response, used_model, last_err). response None ise hepsi basarisiz.
    """
    last_err: Optional[Exception] = None
    # Pool'da kac farkli (cooldown'da olmayan) key var — siraladigimiz key
    # round-robin'le geldigi icin, pool boyutu kadar dene
    _ensure_pools()
    pool_size = len(_pool_keys.get(pool) or _pool_keys.get("default") or [])
    if pool_size == 0:
        return None, None, RuntimeError(f"Pool '{pool}' bos (ve default da bos)")

    keys_tried_count = 0
    while keys_tried_count < pool_size:
        key = _next_key_from_pool(pool)
        if not key:
            break
        keys_tried_count += 1
        client = _get_client_for_key(key)

        for model in _models_for_pool(pool):
            if _is_model_cooled_down(key, model):
                continue

            for attempt in range(2):  # 503 icin 1 retry
                try:
                    return call_fn(client, model), model, None
                except Exception as e:
                    last_err = e
                    if _is_quota_error(e):
                        # 429 → bu model i 60sn dondur, sonraki modele atla
                        _mark_model_429(key, model)
                        break  # ic model loop'una devam (sonraki modele gec)
                    if _is_unavailable_error(e) and attempt == 0:
                        logger.warning(f"Gemini {model} 503, 1sn sonra retry...")
                        time.sleep(1.0)
                        continue
                    logger.warning(f"Gemini key ...{key[-6:]} model {model} failed: {type(e).__name__}: {e}")
                    break  # sonraki model

    # Tum pool key'leri tukendi (cooldown veya hata). Default pool'a fallback
    # dene (eger zaten oradaysak degil ve default'ta key varsa).
    if pool != "default" and _pool_keys.get("default"):
        logger.info(f"Pool '{pool}' tamamen tukendi, default pool'a fallback")
        return _try_pool("default", call_fn)
    return None, None, last_err


# ─── Public APIs (geriye uyumlu: pool parametresi opsiyonel) ─────────────────

async def ask_gemini(
    prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
    strict: bool = False,
    pool: str = "default",
) -> str:
    """Gemini text completion. Bkz. modul docstring."""
    t0 = time.perf_counter()
    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

    def _call(client, model):
        return client.models.generate_content(model=model, contents=full_prompt)

    response, used_model, err = _try_pool(pool, _call)
    duration_ms = int((time.perf_counter() - t0) * 1000)

    if response is None:
        err_type = type(err).__name__ if err else "unknown"
        _log_usage(endpoint, used_model, success=False, error_type=err_type,
                   duration_ms=duration_ms, user_id=user_id)
        if strict:
            raise GeminiError(f"Gemini API basarisiz: {err}")
        return _ai_unavailable_message(f"Gemini API basarisiz ({err_type})")

    _log_usage(endpoint, used_model, success=True, duration_ms=duration_ms, user_id=user_id)
    return response.text


async def ask_gemini_stream(
    prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
    use_search: bool = False,
    pool: str = "default",
):
    """
    Streaming text. Pool'dan ilk geçerli key'i seçer; stream sırasında 429 olursa
    sonraki key'e GECMEZ (stream ortasinda key cevirmek karmasik) — bunun yerine
    error chunk dondurur ve caller fallback yapabilir.
    """
    t0 = time.perf_counter()
    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

    # Optional Google Search grounding
    config = None
    if use_search:
        try:
            from google.genai import types as genai_types
            config = genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())]
            )
        except ImportError:
            pass

    # Pool'da hic key yoksa ciktiyi simdiden ver
    _ensure_pools()
    pool_size = len(_pool_keys.get(pool) or _pool_keys.get("default") or [])
    if pool_size == 0:
        yield {"text": "⚠️ Gemini API key tanimli degil.", "done": True, "error": "no_api_key"}
        _log_usage(endpoint, None, success=False, error_type="no_api_key", user_id=user_id)
        return

    last_err = None
    keys_tried = 0
    while keys_tried < pool_size:
        key = _next_key_from_pool(pool)
        if not key:
            break
        keys_tried += 1
        client = _get_client_for_key(key)

        # Bu key icin model cascade (havuza gore)
        for model in _models_for_pool(pool):
            if _is_model_cooled_down(key, model):
                continue
            try:
                kwargs = {"model": model, "contents": full_prompt}
                if config is not None:
                    kwargs["config"] = config
                response_iter = client.models.generate_content_stream(**kwargs)
                chunk_count = 0
                for chunk in response_iter:
                    txt = getattr(chunk, "text", "") or ""
                    if txt:
                        chunk_count += 1
                        yield {"text": txt, "done": False}
                duration_ms = int((time.perf_counter() - t0) * 1000)
                _log_usage(endpoint, model, success=True, used_search=use_search,
                           duration_ms=duration_ms, user_id=user_id)
                yield {"text": "", "done": True, "model": model, "chunks": chunk_count}
                return
            except Exception as e:
                last_err = e
                if _is_quota_error(e):
                    # 429 → bu model cooldown, sonraki modele gec
                    _mark_model_429(key, model)
                    continue
                logger.warning(f"Gemini stream ...{key[-6:]} model {model} failed: {type(e).__name__}: {e}")
                continue

    # Tum pool key'leri tukendi (cooldown/hata). Default'a fallback dene.
    if pool != "default" and _pool_keys.get("default"):
        logger.info(f"Stream pool '{pool}' tukendi, default pool'a fallback")
        async for chunk in ask_gemini_stream(
            prompt, system_instruction, endpoint=endpoint,
            user_id=user_id, use_search=use_search, pool="default",
        ):
            yield chunk
        return

    # Hepsi tukendi
    err_type = type(last_err).__name__ if last_err else "unknown"
    _log_usage(endpoint, None, success=False, used_search=use_search,
               error_type=err_type,
               duration_ms=int((time.perf_counter() - t0) * 1000), user_id=user_id)
    yield {"text": "", "done": True, "error": err_type}


async def ask_gemini_with_search(
    prompt: str,
    system_instruction: str = None,
    endpoint: str = "unknown",
    user_id: Optional[int] = None,
    strict: bool = False,
    pool: str = "default",
) -> dict:
    t0 = time.perf_counter()
    try:
        from google.genai import types as genai_types
    except ImportError:
        _log_usage(endpoint, None, success=False, used_search=True,
                   error_type="sdk_missing", user_id=user_id)
        if strict:
            raise GeminiError("Gemini SDK eksik")
        return {"text": _ai_unavailable_message("Gemini SDK eksik"),
                "sources": [], "used_search": False, "model": None}

    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
    config = genai_types.GenerateContentConfig(
        tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())]
    )

    def _call(client, model):
        return client.models.generate_content(model=model, contents=full_prompt, config=config)

    response, used_model, err = _try_pool(pool, _call)
    duration_ms = int((time.perf_counter() - t0) * 1000)

    if response is None:
        err_type = type(err).__name__ if err else "unknown"
        _log_usage(endpoint, used_model, success=False, used_search=True,
                   error_type=err_type, duration_ms=duration_ms, user_id=user_id)
        logger.warning(f"Google Search grounding failed ({err}), fallback to plain ask_gemini...")

        try:
            fallback_text = await ask_gemini(prompt, system_instruction, endpoint, user_id, strict, pool=pool)
            return {"text": fallback_text, "sources": [], "used_search": False, "model": "fallback"}
        except Exception as fallback_err:
            if strict:
                raise GeminiError(f"Gemini fallback basarisiz: {fallback_err}")
            return {
                "text": _ai_unavailable_message(
                    f"Gemini Google Search grounding ve fallback kullanilamadi ({err_type})"
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
    pool: str = "vision",
) -> dict:
    t0 = time.perf_counter()
    try:
        from google.genai import types as genai_types
        import httpx
        import base64
    except ImportError:
        return {"text": "Vision SDK eksik", "model": None, "used_url": image_source}

    # Image'i bytes'a cevir
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

    def _call(client, model):
        return client.models.generate_content(model=model, contents=[image_part, full_prompt])

    response, used_model, err = _try_pool(pool, _call)
    duration_ms = int((time.perf_counter() - t0) * 1000)

    if response is None:
        err_type = type(err).__name__ if err else "unknown"
        _log_usage(endpoint, used_model, success=False, used_vision=True,
                   error_type=err_type, duration_ms=duration_ms, user_id=user_id)
        return {"text": f"⚠️ Vision analizi yapilamadi ({err_type}).",
                "model": None, "used_url": image_source}

    _log_usage(endpoint, used_model, success=True, used_vision=True,
               duration_ms=duration_ms, user_id=user_id)
    return {"text": response.text, "model": used_model, "used_url": image_source}


# ─── Helpers ──────────────────────────────────────────────────────────────────

class GeminiError(Exception):
    """Strict mode'da Gemini fail durumunda raise edilir."""
    pass


def _ai_unavailable_message(reason: str) -> str:
    return (
        "Gercek AI/web analizi su anda alinamadi.\n\n"
        f"Neden: {reason}.\n\n"
        "Sahte veya mock analiz uretilmedi. Lutfen internet/Gemini erisimini kontrol edip tekrar deneyin."
    )


# Geriye uyumluluk icin API_KEY sembolu (eski caller'lar import edebilir)
API_KEY = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
