import re
import logging
import httpx
from urllib.parse import quote
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

_PRICE_RE = re.compile(r"[\d\.,]+")


def _parse_price(text: str) -> float:
    text = text.strip().replace("\xa0", "").replace(" ", "")
    nums = _PRICE_RE.findall(text)
    if not nums:
        return 0.0
    raw = nums[0]
    # Turkish format: 1.234,56 → float
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


def _extract_moq(text: str) -> int:
    """'Min sipariş: 100 adet' gibi metinden MOQ çıkar."""
    m = re.search(r"(\d+)\s*(?:adet|pcs|piece|lot|units?)", text, re.IGNORECASE)
    return int(m.group(1)) if m else 50


async def search_toptanbul(query: str, max_results: int = 12) -> list[dict]:
    """
    Toptanbul.com'da arama yapar. Gerçek HTML içeriği varsa parse eder,
    JS-rendered veya engellenmişse boş liste döner (hata fırlatmaz).
    """
    url = f"https://www.toptanbul.com/arama?q={quote(query)}"
    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, headers=_HEADERS
        ) as client:
            resp = await client.get(url)

        if resp.status_code != 200:
            logger.info(f"Toptanbul HTTP {resp.status_code} — atlanıyor")
            return []

        html = resp.text

        # JS-rendered tespiti: ürün içeriği yoksa boş dön
        if "toptanbul" not in html.lower() or len(html) < 5000:
            logger.info("Toptanbul: içerik yok (JS-rendered veya engellendi)")
            return []

        soup = BeautifulSoup(html, "lxml")
        results: list[dict] = []

        # --- Selector zinciri: bilinen ve yaygın class'ları dene ---
        card_selectors = [
            "div.product-card",
            "div.product-item",
            "div.urun-kart",
            "div.item-card",
            "li.product-card",
            "li.product-item",
            "div[class*='product']",
            "article[class*='product']",
        ]

        cards = []
        for sel in card_selectors:
            cards = soup.select(sel)
            if cards:
                logger.info(f"Toptanbul: {len(cards)} kart bulundu ({sel})")
                break

        if not cards:
            logger.info("Toptanbul: ürün kartı bulunamadı — sayfada olmayabilir")
            return []

        for card in cards[:max_results]:
            try:
                # Ürün adı
                name_el = (
                    card.select_one("h2")
                    or card.select_one("h3")
                    or card.select_one("[class*='title']")
                    or card.select_one("[class*='name']")
                    or card.select_one("a[title]")
                )
                name = (name_el.get_text(strip=True) or name_el.get("title", "")) if name_el else ""
                if not name:
                    continue

                # Fiyat
                price_el = (
                    card.select_one("[class*='price']")
                    or card.select_one("[class*='fiyat']")
                    or card.select_one("span.fiyat")
                )
                price = _parse_price(price_el.get_text()) if price_el else 0.0
                if price <= 0:
                    continue

                # URL
                link_el = card.select_one("a[href]")
                href = link_el["href"] if link_el else ""
                if href and not href.startswith("http"):
                    href = "https://www.toptanbul.com" + href

                # MOQ (bazı kartlarda "Min: 50 adet" yazar)
                full_text = card.get_text(" ", strip=True)
                moq = _extract_moq(full_text)

                # Satıcı
                seller_el = card.select_one("[class*='seller']") or card.select_one("[class*='satici']")
                seller = seller_el.get_text(strip=True) if seller_el else "Toptanbul Satıcısı"

                results.append({
                    "name": f"Toptanbul — {seller}",
                    "product": name[:120],
                    "current_price": price,
                    "min_order": moq,
                    "shipping_days": 3,
                    "discount_pct": 0,
                    "discounted_price": price,
                    "has_discount": False,
                    "url": href or url,
                    "source": "toptanbul",
                    "currency": "TRY",
                })
            except Exception:
                continue

        logger.info(f"Toptanbul: {len(results)} gerçek ürün dönüyor")
        return results

    except Exception as e:
        logger.warning(f"Toptanbul scraping hatası: {type(e).__name__}: {e}")
        return []
