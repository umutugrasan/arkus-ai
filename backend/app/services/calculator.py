"""
Finansal Hesaplama Servisi
Ham verilerden tum finansal metrikleri otomatik hesaplar.
Satici hicbir sey girmez, sistem kendisi hesaplar.
"""


def calculate_product_metrics(product: dict, commission_rate: float):
    """Tek urun icin metrikleri hesapla"""
    price = product["price"]
    cost = product["cost"]
    sales = product["sales_30d"]
    
    revenue = price * sales
    total_cost = cost * sales
    commission_amount = revenue * commission_rate / 100
    shipping_per_item = product.get("shipping_cost", 15)
    total_shipping = shipping_per_item * sales
    
    gross_profit = revenue - total_cost
    net_profit = gross_profit - commission_amount - total_shipping
    
    gross_margin = round(gross_profit / revenue * 100, 2) if revenue > 0 else 0
    net_margin = round(net_profit / revenue * 100, 2) if revenue > 0 else 0
    profit_per_item = round(net_profit / sales, 2) if sales > 0 else 0
    
    return {
        "revenue": round(revenue, 2),
        "total_cost": round(total_cost, 2),
        "commission_amount": round(commission_amount, 2),
        "total_shipping": round(total_shipping, 2),
        "gross_profit": round(gross_profit, 2),
        "net_profit": round(net_profit, 2),
        "gross_margin_pct": gross_margin,
        "net_margin_pct": net_margin,
        "profit_per_item": profit_per_item,
    }


def calculate_marketplace_metrics(mp_data: dict):
    """Tek pazaryeri icin toplam metrikleri hesapla"""
    commission_rate = mp_data["commission_rate"]
    products = mp_data["products"]
    
    total_revenue = 0
    total_cost = 0
    total_commission = 0
    total_shipping = 0
    total_sales = 0
    total_returns = 0
    
    product_metrics = []
    
    for p in products:
        metrics = calculate_product_metrics(p, commission_rate)
        product_metrics.append({
            "id": p["id"],
            "name": p["name"],
            "price": p["price"],
            "cost": p["cost"],
            "stock": p["stock"],
            "sales_30d": p["sales_30d"],
            "rating": p["rating"],
            "return_rate": p.get("return_rate", 0),
            **metrics,
        })
        
        total_revenue += metrics["revenue"]
        total_cost += metrics["total_cost"]
        total_commission += metrics["commission_amount"]
        total_shipping += metrics["total_shipping"]
        total_sales += p["sales_30d"]
        total_returns += round(p["sales_30d"] * p.get("return_rate", 0) / 100)
    
    total_gross = total_revenue - total_cost
    total_net = total_gross - total_commission - total_shipping
    
    ad_spend = mp_data.get("ad_spend_30d", 0)
    total_net_after_ads = total_net - ad_spend
    roas = round(total_revenue / ad_spend, 2) if ad_spend > 0 else 0
    
    return {
        "total_revenue": round(total_revenue, 2),
        "total_cost": round(total_cost, 2),
        "total_commission": round(total_commission, 2),
        "total_shipping": round(total_shipping, 2),
        "total_gross_profit": round(total_gross, 2),
        "total_net_profit": round(total_net, 2),
        "ad_spend": ad_spend,
        "net_after_ads": round(total_net_after_ads, 2),
        "roas": roas,
        "total_sales": total_sales,
        "total_returns": total_returns,
        "return_rate": round(total_returns / total_sales * 100, 2) if total_sales > 0 else 0,
        "gross_margin_pct": round(total_gross / total_revenue * 100, 2) if total_revenue > 0 else 0,
        "net_margin_pct": round(total_net / total_revenue * 100, 2) if total_revenue > 0 else 0,
        "product_metrics": product_metrics,
    }


def calculate_overall_metrics(all_marketplace_metrics: dict):
    """Tum pazaryerlerini birlestirip genel metrikleri hesapla"""
    totals = {
        "total_revenue": 0,
        "total_cost": 0,
        "total_commission": 0,
        "total_shipping": 0,
        "total_ad_spend": 0,
        "total_sales": 0,
        "total_returns": 0,
    }
    
    for mp_name, mp_metrics in all_marketplace_metrics.items():
        totals["total_revenue"] += mp_metrics["total_revenue"]
        totals["total_cost"] += mp_metrics["total_cost"]
        totals["total_commission"] += mp_metrics["total_commission"]
        totals["total_shipping"] += mp_metrics["total_shipping"]
        totals["total_ad_spend"] += mp_metrics["ad_spend"]
        totals["total_sales"] += mp_metrics["total_sales"]
        totals["total_returns"] += mp_metrics["total_returns"]
    
    gross = totals["total_revenue"] - totals["total_cost"]
    net = gross - totals["total_commission"] - totals["total_shipping"]
    net_after_ads = net - totals["total_ad_spend"]
    
    return {
        **totals,
        "total_gross_profit": round(gross, 2),
        "total_net_profit": round(net, 2),
        "total_net_after_ads": round(net_after_ads, 2),
        "overall_gross_margin": round(gross / totals["total_revenue"] * 100, 2) if totals["total_revenue"] > 0 else 0,
        "overall_net_margin": round(net / totals["total_revenue"] * 100, 2) if totals["total_revenue"] > 0 else 0,
        "overall_return_rate": round(totals["total_returns"] / totals["total_sales"] * 100, 2) if totals["total_sales"] > 0 else 0,
        "overall_roas": round(totals["total_revenue"] / totals["total_ad_spend"], 2) if totals["total_ad_spend"] > 0 else 0,
    }


def calculate_arbitrage(product_id: str, listings: list):
    """Ayni urunun farkli pazaryerlerindeki karlilik karsilastirmasi"""
    if len(listings) < 2:
        return None
    
    results = []
    for l in listings:
        commission_amount = l["price"] * l["commission_rate"] / 100
        shipping = l.get("shipping_cost", 15)
        net_per_item = l["price"] - l["cost"] - commission_amount - shipping
        margin = round(net_per_item / l["price"] * 100, 2) if l["price"] > 0 else 0
        
        results.append({
            "marketplace": l["marketplace"],
            "price": l["price"],
            "cost": l["cost"],
            "commission_rate": l["commission_rate"],
            "commission_amount": round(commission_amount, 2),
            "shipping": shipping,
            "net_per_item": round(net_per_item, 2),
            "net_margin_pct": margin,
            "sales_30d": l["sales_30d"],
            "monthly_net_profit": round(net_per_item * l["sales_30d"], 2),
        })
    
    results.sort(key=lambda x: x["net_per_item"], reverse=True)
    
    best = results[0]
    worst = results[-1]
    
    return {
        "product_id": product_id,
        "listings": results,
        "best_marketplace": best["marketplace"],
        "worst_marketplace": worst["marketplace"],
        "profit_gap_per_item": round(best["net_per_item"] - worst["net_per_item"], 2),
        "monthly_opportunity": round(best["monthly_net_profit"] - worst["monthly_net_profit"], 2),
    }