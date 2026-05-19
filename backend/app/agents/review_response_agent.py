"""
ReviewResponseAgent — Negatif Yoruma AI Cevap Taslagi Ureticisi

GÖREV:
  Son N gunde rating <= 2 olan yeni yorumlari tespit eder, her biri icin Gemini'den
  profesyonel + samimi cevap taslagi yazdirir. Satici bu taslagi Trendyol/HB satici
  panelinden yapistirir.

VERİ KAYNAGI:
  - `Review` tablosu (gercek yorum metinleri, MOCK API'dan seed edilmis)
  - `Product` tablosu (kullaniciya ait product_code listesi)
  - `Notification` tablosu (taslak ciktilari burada saklanir — yeni tablo aclamaz)

AI ÇAĞRISI: yorum basina 1, pool="default" — bu havuz yuksek RPD'li model
  (gemini-3.1-flash-lite, RPD 500) ile baslar. Boylece taslak uretimi, kit olan
  gemini-2.5-flash kotasini (RPD 20) tuketmez; o kota gercek analiz ajanlarina kalir.

IDEMPOTENCY:
  - Notification baslignda review_id gomulur; ayni yorum icin tekrar uretilmez.

EVENT'LER:
  - `review_response_drafted` — taslak uretildi (her urun icin)

TETİKLEYİCİ:
  - Schedule (her tick, son 7 gun yorumlari tarar)
  - ReviewAnalyzer'in `high_negative_reviews` event'i (chain edilebilir, opsiyonel)

LİMİT: Tek tick'te max 5 taslak — Gemini quota'sini korumak icin. Daha cok varsa
sonraki tick'te islenir (her zaman en yeni 5'i alir).
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.db.models import Review, Product, Notification
from app.services.gemini_service import ask_gemini
from app.agents.base import BaseAgent, AgentResult, AgentEvent, _now


class ReviewResponseAgent(BaseAgent):
    name = "ReviewResponseAgent"

    LOOKBACK_DAYS = 7                  # son 7 gunden eski yorumlara cevap uretme
    MAX_DRAFTS_PER_DAY = 3             # quota korumasi: gunluk max 3 AI cagrisi
    NEGATIVE_RATING_THRESHOLD = 2      # rating <= 2 = negatif

    async def run(self, user_id: int, db, events_in: list = None) -> AgentResult:
        try:
            # Kullaniciya ait product_code listesi
            user_product_codes = [
                p.product_code for p in db.query(Product).filter(
                    Product.user_id == user_id
                ).distinct().all()
                if p.product_code
            ]
            user_product_codes = list(set(user_product_codes))

            if not user_product_codes:
                return AgentResult(
                    agent_name=self.name, status="ok",
                    details={"note": "Kullanici urunu yok, taslak uretilmedi"},
                )

            # Son LOOKBACK_DAYS gundeki rating <= 2 yorumlar
            cutoff = (datetime.now() - timedelta(days=self.LOOKBACK_DAYS)).date().isoformat()

            negative_reviews = (
                db.query(Review)
                .filter(
                    Review.product_code.in_(user_product_codes),
                    Review.rating <= self.NEGATIVE_RATING_THRESHOLD,
                    Review.date >= cutoff,
                )
                .order_by(Review.date.desc())
                .all()
            )

            if not negative_reviews:
                return AgentResult(
                    agent_name=self.name, status="ok",
                    details={"note": f"Son {self.LOOKBACK_DAYS} gunde negatif yorum yok"},
                )

            # product_code → product_name lookup
            products_by_code = {}
            for p in db.query(Product).filter(Product.user_id == user_id).all():
                if p.product_code and p.product_code not in products_by_code:
                    products_by_code[p.product_code] = p.name

            # Bugun kac taslak olusturulmus kontrol et
            today_prefix = datetime.now().strftime("%Y-%m-%d")
            drafts_today = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.type == "yorum_cevap_taslagi",
                Notification.created_at.like(f"{today_prefix}%")
            ).count()

            remaining_quota = max(0, self.MAX_DRAFTS_PER_DAY - drafts_today)
            if remaining_quota <= 0:
                return AgentResult(
                    agent_name=self.name, status="ok",
                    details={"note": f"Gunluk taslak uretim limiti ({self.MAX_DRAFTS_PER_DAY}) doldu."},
                )

            # Idempotency: hangi review_id'ler icin zaten unread bildirim var?
            existing_titles = {
                n.title for n in db.query(Notification.title).filter(
                    Notification.user_id == user_id,
                    Notification.type == "yorum_cevap_taslagi",
                    Notification.read == False,
                ).all()
            }

            drafts_created = 0
            events_out: List[AgentEvent] = []
            details: Dict[str, Any] = {"drafts": []}

            for review in negative_reviews:
                if drafts_created >= remaining_quota:
                    break

                product_name = products_by_code.get(review.product_code, review.product_code)
                # Baslikta review.id ile idempotency
                title = f"Yorum Cevap Taslagi #{review.id}: {product_name} ({review.rating}★)"
                if title in existing_titles:
                    continue

                # AI cagrisi: cevap taslagi uret
                prompt = (
                    f"Bir musteri asagidaki yorumu birakti. Bu yoruma SATICI olarak "
                    f"profesyonel, samimi, ozur dileyici ama savunmaci olmayan, "
                    f"3-4 cumlelik bir cevap taslagi yaz. Magazaya guven veren bir ton kullan.\n\n"
                    f"URUN: {product_name}\n"
                    f"PAZARYERI: {review.marketplace_name}\n"
                    f"PUAN: {review.rating}/5\n"
                    f"YORUM: \"{review.text}\"\n\n"
                    f"CEVAP TASLAGI:"
                )
                system = (
                    "Sen Turkiye e-ticaret saticilarinin yorumlarina cevap yazan bir "
                    "musteri iliskileri uzmanisin. Cevaplarin kisa, samimi, profesyonel "
                    "olur. Asla agresif/savunmaci yazma. Musteriyi anladigini goster, "
                    "somut bir aksiyon onerisi sun (iletisim, iade, degisim vs.)."
                )

                try:
                    draft = await ask_gemini(
                        prompt, system,
                        endpoint="agents.review_response",
                        pool="default",
                    )
                except Exception as ai_err:
                    # AI hata verdi; bu yorumu skip et, digerine gec
                    continue

                # AI fail-message mi? (gemini_service "Gercek AI/web analizi..." doner)
                if draft.startswith("Gercek AI") or "alinamadi" in draft.lower()[:80]:
                    continue

                msg = (
                    f"{product_name} icin {review.marketplace_name}'de {review.rating} yildizli yorum:\n"
                    f"\"{review.text}\"\n\n"
                    f"--- CEVAP TASLAGI ---\n{draft.strip()}\n\n"
                    f"(Bu taslagi pazaryeri panelinden kopyalayarak yorumu cevaplayabilirsiniz.)"
                )
                n = self._maybe_create_notification(
                    db, user_id, "yorum_cevap_taslagi", title, msg, "info"
                )
                if n:
                    drafts_created += 1
                    details["drafts"].append({
                        "review_id": review.id,
                        "product_code": review.product_code,
                        "product_name": product_name,
                        "marketplace": review.marketplace_name,
                        "rating": review.rating,
                    })
                    events_out.append(AgentEvent(
                        type_="review_response_drafted",
                        data={
                            "review_id": review.id,
                            "product_code": review.product_code,
                            "rating": review.rating,
                        },
                        source_agent=self.name,
                    ))

            db.commit()
            self.last_run = _now()
            return AgentResult(
                agent_name=self.name,
                status="ok",
                items_processed=len(negative_reviews),
                notifications_created=drafts_created,
                events=events_out,
                details=details,
            )

        except Exception as e:
            db.rollback()
            return AgentResult(
                agent_name=self.name, status="error", error=f"{type(e).__name__}: {e}"
            )
