import os
import re
import logging
import httpx
from urllib.parse import quote
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_SCRAPER_API_KEY = os.getenv("SCRAPER_API_KEY", "")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
    "Connection": "keep-alive",
}

_PRICE_RE = re.compile(r"[\d\.,]+")


def _parse_price(text: str) -> float:
    text = text.strip().replace("\xa0", "").replace(" ", "")
    nums = _PRICE_RE.findall(text)
    if not nums:
        return 0.0
    raw = nums[0]
    if "," in raw and "." in raw:
        if raw.rfind(".") < raw.rfind(","):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        raw = raw.replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _build_url(target_url: str) -> str:
    """ScraperAPI key varsa ScraperAPI üzerinden, yoksa direkt URL döner."""
    if _SCRAPER_API_KEY:
        encoded = quote(target_url, safe="")
        return (
            f"https://api.scraperapi.com"
            f"?api_key={_SCRAPER_API_KEY}"
            f"&url={encoded}"
            f"&render=true"          # JavaScript render — Trendyol için şart
            f"&country_code=tr"      # Türkiye IP'si
        )
    return target_url


def _parse_cards(html: str, target_url: str, max_results: int) -> list[dict]:
    """Render edilmiş Trendyol HTML'inden ürün kartlarını çıkarır."""
    soup = BeautifulSoup(html, "lxml")

    cards = soup.select(".product-card")
    if not cards:
        for sel in ["div[data-testid='product-card']", "div.prdct-cntnr-wrppr", "div[class*='product']"]:
            cards = soup.select(sel)
            if cards:
                break
    if not cards:
        return []

    results: list[dict] = []
    for card in cards[:max_results]:
        try:
            img = card.select_one("img[alt]")
            name_el = card.select_one("[class*='name']") or card.select_one("[class*='title']")
            name = ""
            if img and img.get("alt") and len(img["alt"]) > 5:
                name = img["alt"].strip()
            elif name_el:
                name = name_el.get_text(strip=True)
            if not name:
                continue

            price_el = card.select_one(".price-value") or card.select_one("[class*='price']")
            price = _parse_price(price_el.get_text()) if price_el else 0.0
            if price <= 0:
                continue

            old_price_el = card.select_one(".strikethrough-price") or card.select_one("[class*='old']")
            old_price = _parse_price(old_price_el.get_text()) if old_price_el else 0.0
            discount_pct = 0
            if old_price > price > 0:
                discount_pct = round((old_price - price) / old_price * 100)

            link_el = card.select_one("a[href]")
            href = link_el["href"] if link_el else ""
            if href and not href.startswith("http"):
                href = "https://www.trendyol.com" + href

            results.append({
                "name": name[:120],
                "product": name[:120],
                "current_price": price,
                "min_order": 1,
                "shipping_days": 3,
                "discount_pct": discount_pct,
                "discounted_price": price,
                "has_discount": discount_pct > 0,
                "url": href or target_url,
                "source": "toptanbul",
                "currency": "TRY",
            })
        except Exception:
            continue
    return results


async def _fetch_once(fetch_url: str, target_url: str, max_results: int) -> list[dict]:
    """Tek bir ScraperAPI/httpx isteği + parse. Boşsa [] döner."""
    timeout = 70.0 if _SCRAPER_API_KEY else 25.0
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True, headers=_HEADERS
    ) as client:
        resp = await client.get(fetch_url)

    html = resp.text
    logger.info(f"Toptanbul: ScraperAPI yanıt HTTP {resp.status_code}, {len(html)} byte")

    if resp.status_code != 200:
        logger.warning(f"Toptanbul HTTP {resp.status_code} — gövde: {html[:300]}")
        return []

    # ScraperAPI bazen hata JSON döner (kredi bitti, geçersiz key vs.)
    if _SCRAPER_API_KEY and ('"error"' in html[:300] or len(html) < 2000):
        logger.warning(f"Toptanbul: ScraperAPI hata yanıtı — {html[:300]}")
        return []

    if "trendyol" not in html.lower() or len(html) < 5000:
        logger.warning(f"Toptanbul: içerik yok (html {len(html)} byte)")
        return []

    return _parse_cards(html, target_url, max_results)


async def search_toptanbul(query: str, max_results: int = 12) -> list[dict]:
    """
    Trendyol'dan perakende satış fiyatlarını çeker.
    - Prodüksiyonda: ScraperAPI HTTP render API (CloudFlare bypass + JS render)
    - Lokalde: Doğrudan httpx
    ScraperAPI render bazen JS tamamlanmadan döner (eksik sayfa, 0 kart);
    boş gelirse render birkaç kez tekrar denenir.
    """
    target_url = f"https://www.trendyol.com/sr?q={quote(query)}"
    fetch_url = _build_url(target_url)

    if _SCRAPER_API_KEY:
        logger.info(f"Toptanbul: ScraperAPI render ile Trendyol ({query})")
    else:
        logger.info(f"Toptanbul: Direkt httpx ile Trendyol ({query})")

    # ScraperAPI render Trendyol için kararsız; 2 deneme — fazlası best_price'ı
    # dakikalarca bekletiyor (her render ~50-75sn).
    max_attempts = 2 if _SCRAPER_API_KEY else 1
    for attempt in range(1, max_attempts + 1):
        try:
            results = await _fetch_once(fetch_url, target_url, max_results)
        except Exception as e:
            logger.warning(f"Toptanbul deneme {attempt} hatası: {type(e).__name__}: {e}")
            results = []

        if results:
            logger.info(f"Toptanbul: {len(results)} Trendyol ürünü döndü (deneme {attempt})")
            return results

        if attempt < max_attempts:
            logger.info(f"Toptanbul: deneme {attempt} boş — render tekrar deneniyor")

    logger.info("Toptanbul: tüm denemeler boş döndü")
    return []
