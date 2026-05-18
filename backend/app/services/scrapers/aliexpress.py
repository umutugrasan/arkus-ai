import re
import json
import logging
import httpx
from urllib.parse import quote
from .currency import get_usd_to_try

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.aliexpress.com",
    "Connection": "keep-alive",
}

_PRICE_RE = re.compile(r"[\d\.]+")


def _usd_price(text: str) -> float:
    nums = _PRICE_RE.findall(str(text).replace(",", ""))
    return float(nums[0]) if nums else 0.0


def _extract_run_params(html: str) -> list[dict]:
    """
    AliExpress arama sayfasına window.runParams içinde gömülü JSON'u çıkar.
    Farklı AliExpress versiyonları farklı pattern kullanır.
    """
    patterns = [
        r'window\.runParams\s*=\s*(\{.+?\});\s*(?:window|var)\s',
        r'"mods"\s*:\s*\{[^}]*"itemList"\s*:\s*\{[^}]*"content"\s*:\s*(\[.+?\])\s*,\s*"resultCount"',
        r'"items"\s*:\s*(\[.+?\])\s*,\s*"totalCount"',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except (json.JSONDecodeError, IndexError):
                continue
    return []


def _items_from_run_params(data) -> list[dict]:
    """runParams objesinden itemList.content'i çıkar."""
    if isinstance(data, list):
        return data
    try:
        return (
            data.get("data", {})
            .get("root", {})
            .get("fields", {})
            .get("mods", {})
            .get("itemList", {})
            .get("content", [])
        )
    except AttributeError:
        return []


async def search_aliexpress(query: str, max_results: int = 10) -> list[dict]:
    """
    AliExpress toptan arama. Sayfa kaynak kodunda gömülü JSON veriyi çıkarır.
    Engellenmişse veya JS-rendered'sa boş liste döner.
    """
    url = (
        f"https://www.aliexpress.com/wholesale"
        f"?SearchText={quote(query)}&SortType=total_tranpro_desc"
    )
    try:
        async with httpx.AsyncClient(
            timeout=20.0, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            logger.info(f"AliExpress HTTP {resp.status_code} — atlanıyor")
            return []

        html = resp.text

        # Cloudflare / anti-bot kontrolü
        if "cf-browser-verification" in html or "Just a moment" in html:
            logger.info("AliExpress: Cloudflare engeli — Gemini fallback'e geçiliyor")
            return []

        raw_data = _extract_run_params(html)
        items = _items_from_run_params(raw_data)

        if not items:
            logger.info("AliExpress: JSON verisi bulunamadı (tam JS-rendered) — fallback")
            return []

        rate = await get_usd_to_try()
        results: list[dict] = []

        for item in items[:max_results]:
            try:
                # Farklı AliExpress JSON şemaları
                title = (
                    item.get("title", {}).get("displayTitle")
                    or item.get("title", {}).get("seoTitle")
                    or item.get("name")
                    or item.get("subject")
                    or ""
                )
                if not title:
                    continue

                # Fiyat (min price)
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

                # MOQ
                moq_raw = (
                    item.get("minOrderQuantity")
                    or item.get("tradeDesc", "")
                    or ""
                )
                moq = 50
                if isinstance(moq_raw, int):
                    moq = max(moq_raw, 1)
                elif isinstance(moq_raw, str):
                    m = re.search(r"(\d+)", moq_raw)
                    moq = int(m.group(1)) if m else 50

                # Satıcı
                seller = (
                    item.get("store", {}).get("storeName")
                    or item.get("sellerInfo", {}).get("storeName")
                    or "AliExpress Satıcısı"
                )

                # URL
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
                    "min_order": moq,
                    "shipping_days": 20,
                    "discount_pct": 0,
                    "discounted_price": price_try,
                    "has_discount": False,
                    "url": product_url,
                    "source": "aliexpress",
                    "currency": "TRY",
                    "price_usd": price_usd,
                })
            except Exception:
                continue

        logger.info(f"AliExpress: {len(results)} gerçek ürün dönüyor")
        return results

    except Exception as e:
        logger.warning(f"AliExpress scraping hatası: {type(e).__name__}: {e}")
        return []
