import os
import logging
from urllib.parse import quote
from playwright.async_api import async_playwright
from .toptanbul_playwright import _get_proxy  # ScraperAPI proxy paylaşımlı kullan
from .aliexpress import _items_from_run_params, _usd_price
from .currency import get_usd_to_try

logger = logging.getLogger(__name__)

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

try:
    from playwright_stealth import Stealth as _Stealth
    _STEALTH = _Stealth()
    _HAS_STEALTH = True
except Exception:
    _HAS_STEALTH = False
    _STEALTH = None


async def search_aliexpress_playwright(query: str, max_results: int = 10) -> list[dict]:
    """
    AliExpress Playwright fallback — API key yoksa kullanılır.
    playwright-stealth ile bot tespitini atlamaya çalışır.
    """
    url = f"https://www.aliexpress.com/wholesale?SearchText={quote(query)}&SortType=total_tranpro_desc"
    try:
        async with async_playwright() as p:
            proxy = _get_proxy()
            launch_kwargs: dict = {
                "headless": True,
                "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            }
            if proxy:
                launch_kwargs["proxy"] = proxy
                logger.info("AliExpress Playwright: ScraperAPI proxy aktif")
            browser = await p.chromium.launch(**launch_kwargs)
            try:
                context = await browser.new_context(
                    user_agent=_UA,
                    locale="en-US",
                    ignore_https_errors=True,
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": "https://www.aliexpress.com",
                    },
                )
                page = await context.new_page()

                if _HAS_STEALTH and _STEALTH is not None:
                    try:
                        await _STEALTH.apply_stealth_async(page)
                    except Exception:
                        pass

                await page.goto(url, wait_until="domcontentloaded", timeout=15000)

                # Bot detection kontrolü — tüm body metnini al
                title = await page.title()
                body_text = ""
                try:
                    body_text = await page.inner_text("body")
                    body_text = body_text.lower()
                except Exception:
                    pass

                bot_signals = ["just a moment", "slide to verify", "unusual traffic", "access denied", "captcha"]
                if any(s in title.lower() or s in body_text[:500] for s in bot_signals):
                    logger.info("AliExpress Playwright: bot engeli tespit edildi")
                    return []

                # window.runParams.data dolu olana kadar bekle (max 5s)
                try:
                    await page.wait_for_function(
                        "() => !!(window.runParams && window.runParams.data)",
                        timeout=5000,
                    )
                except Exception:
                    logger.info("AliExpress Playwright: window.runParams zaman aşımı — bot engeli olabilir")
                    return []

                run_params = await page.evaluate("() => window.runParams || null")

            finally:
                await browser.close()

        if not run_params:
            return []

        items = _items_from_run_params(run_params)
        if not items:
            logger.info("AliExpress Playwright: itemList boş")
            return []

        rate = await get_usd_to_try()
        results: list[dict] = []

        for item in items[:max_results]:
            try:
                title = (
                    item.get("title", {}).get("displayTitle")
                    or item.get("title", {}).get("seoTitle")
                    or item.get("name")
                    or item.get("subject")
                    or ""
                )
                if not title:
                    continue

                price_info = item.get("prices", {}) or item.get("price", {}) or {}
                price_usd = _usd_price(
                    price_info.get("minPrice", {}).get("value")
                    or price_info.get("salePrice", {}).get("minAmount")
                    or price_info.get("value")
                    or item.get("salePrice")
                    or 0
                )
                if price_usd <= 0:
                    continue

                price_try = round(price_usd * rate, 2)
                seller = (
                    item.get("store", {}).get("storeName")
                    or item.get("sellerInfo", {}).get("storeName")
                    or "AliExpress Satıcısı"
                )
                item_id = item.get("itemId") or item.get("productId") or ""
                product_url = (
                    item.get("productDetailUrl")
                    or (f"https://www.aliexpress.com/item/{item_id}.html" if item_id else url)
                )
                if not product_url.startswith("http"):
                    product_url = "https:" + product_url

                results.append({
                    "name": f"AliExpress — {seller}",
                    "product": title[:120],
                    "current_price": price_try,
                    "price_usd": price_usd,
                    "min_order": 50,
                    "shipping_days": 20,
                    "discount_pct": 0,
                    "discounted_price": price_try,
                    "has_discount": False,
                    "url": product_url,
                    "source": "aliexpress",
                    "currency": "TRY",
                })
            except Exception:
                continue

        logger.info(f"AliExpress Playwright: {len(results)} gerçek ürün döndü")
        return results

    except Exception as e:
        logger.warning(f"AliExpress Playwright hatası: {type(e).__name__}: {e}")
        return []
