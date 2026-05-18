import hashlib
import time
import logging
import httpx
from .currency import get_usd_to_try

logger = logging.getLogger(__name__)


def _sign(params: dict, app_secret: str) -> str:
    """AliExpress Open Platform HMAC-MD5 imzalama (hem Affiliate hem DS API)."""
    sorted_str = "".join(f"{k}{v}" for k, v in sorted(params.items()))
    to_sign = app_secret + sorted_str + app_secret
    return hashlib.md5(to_sign.encode("utf-8")).hexdigest().upper()


async def _call_api(params: dict, app_secret: str) -> dict:
    params["sign"] = _sign(params, app_secret)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post("https://api-sg.aliexpress.com/sync", data=params)
        return resp.json()


async def _search_affiliate(query: str, max_results: int, app_key: str, app_secret: str) -> list[dict]:
    """Affiliate API: aliexpress.affiliate.product.query"""
    params = {
        "app_key": app_key,
        "method": "aliexpress.affiliate.product.query",
        "sign_method": "md5",
        "timestamp": str(int(time.time() * 1000)),
        "keywords": query,
        "page_no": "1",
        "page_size": str(min(max_results, 20)),
        "target_currency": "TRY",
        "target_language": "TR",
        "sort": "SALE_PRICE_ASC",
        "tracking_id": "arkus_ai",
    }
    data = await _call_api(params, app_secret)

    result = (
        data.get("aliexpress_affiliate_product_query_response", {})
        .get("resp_result", {})
        .get("result", {})
    )
    if not result or result.get("current_record_count", 0) == 0:
        return []
    return result.get("products", {}).get("product", [])


async def _search_ds(query: str, max_results: int, app_key: str, app_secret: str) -> list[dict]:
    """DS (Dropshipping) API: aliexpress.ds.search.item.get"""
    params = {
        "app_key": app_key,
        "method": "aliexpress.ds.search.item.get",
        "sign_method": "md5",
        "timestamp": str(int(time.time() * 1000)),
        "keywords": query,
        "page_index": "1",
        "page_size": str(min(max_results, 20)),
        "locale_site": "en_US",
        "currency": "USD",
        "country": "TR",
        "sort_by": "SALE_PRICE_ASC",
    }
    data = await _call_api(params, app_secret)

    result = (
        data.get("aliexpress_ds_search_item_get_response", {})
        .get("result", {})
    )
    if not result:
        return []
    items = result.get("items", {}).get("item", [])
    return items


async def search_aliexpress_api(query: str, max_results: int = 10) -> list[dict]:
    """
    AliExpress API ile ürün araması.
    Önce DS API dener (ds.aliexpress.com kayıtlıysa),
    sonra Affiliate API dener (portals.aliexpress.com kayıtlıysa).
    Her ikisinde de aynı App Key + App Secret kullanılır.
    """
    from app.config import settings  # lazy import

    app_key = getattr(settings, "ALIEXPRESS_APP_KEY", "")
    app_secret = getattr(settings, "ALIEXPRESS_APP_SECRET", "")
    if not app_key or not app_secret:
        return []

    rate = await get_usd_to_try()

    # 1. DS API dene
    try:
        ds_items = await _search_ds(query, max_results, app_key, app_secret)
        if ds_items:
            return _parse_ds_items(ds_items, max_results, rate, query)
    except Exception as e:
        logger.debug(f"AliExpress DS API başarısız: {e}")

    # 2. Affiliate API dene
    try:
        aff_products = await _search_affiliate(query, max_results, app_key, app_secret)
        if aff_products:
            return _parse_affiliate_products(aff_products, max_results, rate, query)
    except Exception as e:
        logger.warning(f"AliExpress Affiliate API başarısız: {e}")

    logger.info("AliExpress API: sonuç bulunamadı")
    return []


def _parse_ds_items(items: list, max_results: int, rate: float, query: str) -> list[dict]:
    results = []
    for item in items[:max_results]:
        try:
            price_usd = float(item.get("sale_price") or item.get("original_price") or 0)
            if price_usd <= 0:
                continue
            price_try = round(price_usd * rate, 2)
            title = (item.get("subject") or item.get("title") or query)[:120]
            shop_name = item.get("store_info", {}).get("store_name") or "AliExpress Satıcısı"
            item_id = item.get("item_id") or ""
            product_url = f"https://www.aliexpress.com/item/{item_id}.html" if item_id else ""
            results.append({
                "name": f"AliExpress — {shop_name}",
                "product": title,
                "current_price": price_try,
                "price_usd": price_usd,
                "min_order": 1,
                "shipping_days": 15,
                "discount_pct": 0,
                "discounted_price": price_try,
                "has_discount": False,
                "url": product_url,
                "source": "aliexpress",
                "currency": "TRY",
            })
        except Exception:
            continue
    logger.info(f"AliExpress DS API: {len(results)} gerçek ürün dönüyor")
    return results


def _parse_affiliate_products(products: list, max_results: int, rate: float, query: str) -> list[dict]:
    results = []
    for p in products[:max_results]:
        try:
            price_str = p.get("target_sale_price") or p.get("target_original_price") or "0"
            price_usd = float(str(price_str).replace(",", ""))
            if price_usd <= 0:
                continue
            price_try = round(price_usd * rate, 2)
            shop_name = p.get("shop_name") or "AliExpress Satıcısı"
            title = (p.get("product_title") or query)[:120]
            product_url = p.get("promotion_link") or p.get("product_detail_url") or ""
            results.append({
                "name": f"AliExpress — {shop_name}",
                "product": title,
                "current_price": price_try,
                "price_usd": price_usd,
                "min_order": 1,
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
    logger.info(f"AliExpress Affiliate API: {len(results)} gerçek ürün dönüyor")
    return results
