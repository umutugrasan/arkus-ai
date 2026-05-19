import asyncio
import logging
import os

from .toptanbul import search_toptanbul
from .toptanbul_playwright import search_toptanbul_playwright
from .aliexpress_api import search_aliexpress_api
from .aliexpress_playwright import search_aliexpress_playwright

logger = logging.getLogger(__name__)

# SCRAPER_API_KEY tanımlıysa production'dayız (Cloud Run).
# Orada ScraperAPI HTTP render kullanılır; Playwright/Chromium fallback'leri
# DEVRE DIŞI bırakılır — Chromium ~300-500MB RAM yer, Cloud Run'da OOM (503)
# hatasına yol açıyor. Local'de (key yok) Playwright fallback'leri çalışır.
_PROD_SCRAPER = bool(os.getenv("SCRAPER_API_KEY", ""))


async def _fetch_toptanbul(query: str, max_results: int) -> list[dict]:
    result = await search_toptanbul(query, max_results)
    if not result and not _PROD_SCRAPER:
        logger.info("Toptanbul httpx boş döndü — Playwright devreye alınıyor")
        result = await search_toptanbul_playwright(query, max_results)
    return result


async def _fetch_aliexpress(query: str, max_results: int) -> list[dict]:
    result = await search_aliexpress_api(query, max_results)
    if not result and not _PROD_SCRAPER:
        logger.info("AliExpress API boş döndü — Playwright devreye alınıyor")
        result = await search_aliexpress_playwright(query, max_results)
    return result


async def search_wholesale(query: str, max_results: int = 10) -> list[dict]:
    """
    Toptan tedarik arama zinciri (paralel):
      1. Toptanbul: httpx/ScraperAPI render → boşsa Playwright (sadece local)
      2. AliExpress: Affiliate API → boşsa Playwright (sadece local)
      Her iki kaynak paralel çalışır.
      Production'da (SCRAPER_API_KEY) yalnızca hafif HTTP yolları kullanılır;
      Chromium fallback'leri OOM nedeniyle devre dışıdır.
      Her ikisi de boşsa → boş liste (çağıran Gemini fallback uygular).
    """
    toptanbul, aliexpress = await asyncio.gather(
        _fetch_toptanbul(query, max_results),
        _fetch_aliexpress(query, max_results),
        return_exceptions=False,
    )

    results = list(toptanbul) + list(aliexpress)
    results.sort(key=lambda x: x.get("current_price", 0))

    logger.info(
        f"search_wholesale({query!r}): {len(results)} sonuç "
        f"(toptanbul={len(toptanbul)}, aliexpress={len(aliexpress)})"
    )
    return results
