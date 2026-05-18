import httpx
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_cache: dict = {"rate": 38.0, "updated_at": 0.0}
_CACHE_TTL = 3600


async def get_usd_to_try() -> float:
    now = datetime.now(timezone.utc).timestamp()
    if _cache["updated_at"] and (now - _cache["updated_at"]) < _CACHE_TTL:
        return _cache["rate"]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = resp.json()
            rate = float(data["rates"]["TRY"])
            _cache["rate"] = rate
            _cache["updated_at"] = now
            logger.info(f"Döviz kuru güncellendi: 1 USD = {rate:.2f} TL")
            return rate
    except Exception as e:
        logger.warning(f"Döviz kuru alınamadı ({e}), fallback {_cache['rate']:.2f} TL kullanılıyor")
        return _cache["rate"]
