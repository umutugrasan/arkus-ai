import re
import socket
import logging
from urllib.parse import quote
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d\.,]+")

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Erişilebilir Türk e-ticaret/toptan kaynakları
_WHOLESALE_SITES = [
    {
        "url_tpl": "https://www.trendyol.com/sr?q={query}",
        "host": "www.trendyol.com",
        "card_sel": ".product-card",
        "wait_ms": 3000,
        "js": """
            () => {
                // .product-card kendisi <a> tag — href doğrudan ürün sayfası
                const cards = Array.from(document.querySelectorAll('.product-card'));
                return cards.slice(0, 20).map(c => {
                    // Temiz ürün adı: img alt (marka + model dahil)
                    const img = c.querySelector('img[alt]');
                    const nameEl = c.querySelector('[class*="name"]');
                    const cleanName = (img && img.alt && img.alt.length > 5)
                        ? img.alt.replace(/\\.{3}$/, '')
                        : (nameEl ? nameEl.textContent.trim() : '');
                    // Gerçek satış fiyatı: .price-value elementi (promo metni DEĞİL)
                    const priceEl = c.querySelector('.price-value');
                    const oldPriceEl = c.querySelector('.strikethrough-price');
                    return {
                        name: cleanName.slice(0, 120),
                        price: priceEl ? priceEl.textContent.trim() : '',
                        old_price: oldPriceEl ? oldPriceEl.textContent.trim() : '',
                        url: c.href || ''
                    };
                });
            }
        """,
        "source_label": "Trendyol",
        "source_key": "toptanbul",
        "shipping_days": 3,
        "min_order": 1,
    },
]


def _can_resolve(host: str) -> bool:
    try:
        socket.gethostbyname(host)
        return True
    except OSError:
        return False


def _parse_price(text: str) -> float:
    text = (text or "").strip().replace("\xa0", "").replace(" ", "").replace("TL", "").replace("₺", "")
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


async def search_toptanbul_playwright(query: str, max_results: int = 12) -> list[dict]:
    """
    Erişilebilir Türk e-ticaret kaynağında ürün araması (Playwright).
    Gerçek ürün adı, gerçek fiyat ve gerçek ürün linki döner.
    """
    for site in _WHOLESALE_SITES:
        if not _can_resolve(site["host"]):
            logger.info(f"Toptanbul Playwright: {site['host']} DNS çözümlenemedi, atlanıyor")
            continue

        url = site["url_tpl"].format(query=quote(query))
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
                )
                try:
                    page = await browser.new_page(user_agent=_UA)
                    await page.goto(url, wait_until="domcontentloaded", timeout=10000)

                    wait_ms = site.get("wait_ms", 0)
                    if wait_ms:
                        await page.wait_for_timeout(wait_ms)

                    try:
                        await page.wait_for_selector(site["card_sel"], timeout=5000)
                    except Exception:
                        logger.info(f"Toptanbul Playwright: {site['host']} ürün kartı bulunamadı")
                        continue

                    raw_products = await page.evaluate(site["js"])
                finally:
                    await browser.close()

            results: list[dict] = []
            for item in raw_products[:max_results]:
                name = (item.get("name") or "").strip()
                if not name or len(name) < 5:
                    continue

                price = _parse_price(item.get("price", ""))
                if price <= 0:
                    continue  # gerçek fiyat yoksa atla — promo metnine düşme

                old_price = _parse_price(item.get("old_price", ""))
                discount_pct = 0
                if old_price > price > 0:
                    discount_pct = round((old_price - price) / old_price * 100)

                href = item.get("url") or url

                results.append({
                    "name": name[:120],
                    "product": name[:120],
                    "current_price": price,
                    "min_order": site.get("min_order", 1),
                    "shipping_days": site["shipping_days"],
                    "discount_pct": discount_pct,
                    "discounted_price": price,
                    "has_discount": discount_pct > 0,
                    "url": href,
                    "source": site["source_key"],
                    "currency": "TRY",
                })

            if results:
                logger.info(f"Toptanbul Playwright ({site['host']}): {len(results)} ürün döndü")
                return results

        except Exception as e:
            logger.warning(f"Toptanbul Playwright {site['host']} hatası: {type(e).__name__}: {e}")
            continue

    logger.info("Toptanbul Playwright: tüm kaynaklar başarısız")
    return []
