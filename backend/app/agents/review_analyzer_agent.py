"""
ReviewAnalyzerAgent
- Her urun icin son N gun yorumlarini gez
- Cached analiz (review_analyses) yoksa veya >7 gun eski ise yeniden uret
- Negatif oran %40+ ise bildirim atar + 'high_negative_reviews' event yayar
- Bu event Financial Health Agent veya Listing Optimizer'i tetikleyebilir
"""

from datetime import datetime, timedelta
from app.db.models import Review, ReviewAnalysis, Product
from app.services.gemini_service import ask_gemini
from app.agents.base import BaseAgent, AgentResult, AgentEvent, _now


class ReviewAnalyzerAgent(BaseAgent):
    name = "ReviewAnalyzerAgent"

    NEGATIVE_THRESHOLD_PCT = 40.0   # %40+ negatif = bildirim
    CACHE_AGE_DAYS = 7              # 7 gunden eski analizleri yeniden uret

    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        try:
            products = (
                db.query(Product).filter(Product.user_id == user_id).all()
            )
            # Unique product_code -> Product
            unique_products = {}
            for p in products:
                unique_products.setdefault(p.product_code, p)
            products = list(unique_products.values())

            processed = 0
            notif_count = 0
            events_out = []
            details = {"per_product": []}

            for product in products:
                reviews = (
                    db.query(Review)
                    .filter(Review.product_code == product.product_code)
                    .all()
                )
                if not reviews:
                    continue

                processed += 1
                total = len(reviews)
                neg = sum(1 for r in reviews if r.rating <= 2)
                pos = sum(1 for r in reviews if r.rating >= 4)
                neg_pct = round(neg / total * 100, 1)
                pos_pct = round(pos / total * 100, 1)

                # Cache kontrol: son short analiz var mi?
                last_analysis = (
                    db.query(ReviewAnalysis)
                    .filter(
                        ReviewAnalysis.product_id == product.id,
                        ReviewAnalysis.analysis_type == "short",
                    )
                    .order_by(ReviewAnalysis.id.desc())
                    .first()
                )
                needs_refresh = True
                if last_analysis and last_analysis.created_at:
                    try:
                        last_dt = datetime.strptime(
                            last_analysis.created_at[:10], "%Y-%m-%d"
                        )
                        if datetime.now() - last_dt < timedelta(days=self.CACHE_AGE_DAYS):
                            needs_refresh = False
                    except ValueError:
                        pass

                if needs_refresh:
                    reviews_text = "\n".join(
                        f"- [{r.marketplace_name}] {r.rating}/5 - \"{r.text}\""
                        for r in reviews[:50]
                    )
                    prompt = (
                        f"Asagidaki yorumlari analiz et. 3-4 cumlelik Turkce ozet ver. "
                        f"En kritik sikayet ve en cok begenilen yon belirgin olsun.\n\n"
                        f"YORUMLAR:\n{reviews_text}"
                    )
                    system = (
                        "Sen bir e-ticaret yorum analiz uzmanisin. Kisa, "
                        "aksiyon odakli ozet yaz."
                    )
                    content = await ask_gemini(prompt, system, endpoint="agents.review_analyzer", pool="agents")

                    rec = ReviewAnalysis(
                        product_id=product.id,
                        analysis_type="short",
                        content=content,
                        filters={"agent": "ReviewAnalyzerAgent", "reviewed_count": total},
                        created_at=_now(),
                    )
                    db.add(rec)

                details["per_product"].append({
                    "product_code": product.product_code,
                    "name": product.name,
                    "total_reviews": total,
                    "negative_pct": neg_pct,
                    "positive_pct": pos_pct,
                    "analysis_refreshed": needs_refresh,
                })

                # Yuksek negatif -> bildirim + event
                if neg_pct >= self.NEGATIVE_THRESHOLD_PCT:
                    title = f"Yorum Uyarisi: {product.name} negatif yorum %{neg_pct}"
                    msg = (
                        f"{product.name} icin son {total} yorumun %{neg_pct}'si negatif. "
                        f"Acil aksiyon: yorumlari inceleyip kok neden analizi yap."
                    )
                    n = self._maybe_create_notification(
                        db, user_id, "yorum_uyarisi", title, msg, "warning"
                    )
                    if n:
                        notif_count += 1
                    events_out.append(AgentEvent(
                        type_="high_negative_reviews",
                        data={
                            "product_code": product.product_code,
                            "product_name": product.name,
                            "negative_pct": neg_pct,
                            "total_reviews": total,
                        },
                        source_agent=self.name,
                    ))

            db.commit()
            self.last_run = _now()
            return AgentResult(
                agent_name=self.name,
                status="ok",
                items_processed=processed,
                notifications_created=notif_count,
                events=events_out,
                details=details,
            )

        except Exception as e:
            db.rollback()
            return AgentResult(
                agent_name=self.name, status="error", error=f"{type(e).__name__}: {e}"
            )
