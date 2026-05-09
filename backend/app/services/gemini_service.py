import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

_client = None

def get_client():
    global _client
    if _client is None and API_KEY and API_KEY != "your_gemini_api_key_here":
        from google import genai
        _client = genai.Client(api_key=API_KEY)
    return _client


async def ask_gemini(prompt: str, system_instruction: str = None) -> str:
    client = get_client()
    
    if client is None:
        return _fallback_response(prompt)
    
    try:
        full_prompt = ""
        if system_instruction:
            full_prompt = f"{system_instruction}\n\n{prompt}"
        else:
            full_prompt = prompt
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt
        )
        return response.text
    except Exception as e:
        return f"Gemini API hatasi: {str(e)}"


def _fallback_response(prompt: str) -> str:
    if "yorum" in prompt.lower() or "duygu" in prompt.lower():
        return """## Yorum Analizi Ozeti

**Genel Duygu:** Karisik (Pozitif %45, Negatif %35, Notr %20)

**En Sik Sikayet Edilen Konular:**
1. **Kargo Gecikmeleri** (%35) - Musterilerin en buyuk sikayeti
2. **Urun Kalitesi** (%25) - Plastik kalite ve dayaniklilik sorunlari
3. **Bluetooth Baglanti** (%15) - Baglanti kopma sorunlari

**Oneriler:**
- Kargo firmasini degistirin, tahmini puan artisi: +0.4
- Kalite kontrol surecini sikilastirin
- Urun aciklamasina Bluetooth menzil bilgisi ekleyin"""

    elif "rakip" in prompt.lower():
        return """## Rakip Analizi

**Ana Rakip: SesDunyasi**
- Fiyati sizden %5.5 daha dusuk (849.99 TL vs 899.99 TL)
- Yorum puani daha yuksek (4.5 vs 4.3)
- Satis hacmi %31 daha fazla

**Strateji Onerisi:**
- Fiyat dusurmeyin, kalite algisini guclendirin
- Urun aciklamasina karsilastirma tablosu ekleyin
- Kargo hizinizi one cikaran badge kullanin"""

    elif "finansal" in prompt.lower() or "gelir" in prompt.lower():
        return """## Finansal Durum Ozeti

**Genel Durum:** Pozitif trend, dikkat gereken noktalar var

- Son 5 ayda ortalama kar marji: %24.8
- Nisan ayi net kar: 421.520 TL
- Reklam harcamalari artis trendi (%42 artis)

**Uyari:** Komisyon oranlari toplam gelirin %13'unu olusturuyor.

**Oneri:** Nakit akisiniz pozitif (284.000 TL). Stok artirimi icin uygun donem."""

    elif "saglik" in prompt.lower() or "skor" in prompt.lower():
        return """## Magaza Saglik Skoru: 72/100

**Guclu Yonler:**
- Satis trendi: Yukselis (%8.2 aylik buyume) - 18/20
- Urun cesitliligi: Iyi - 8/10
- Nakit akisi: Pozitif - 8/10

**Gelistirilmesi Gerekenler:**
- Iade orani: %6.96 (hedef: <%5) - 5/10
- Yorum puani: 4.2 (hedef: >4.5) - 6/10
- Stok yonetimi: P004 kritik (34 adet) - 5/10

**Skor Artirma:** Iade oranini %5'e dusururseniz skor 78'e cikar."""

    else:
        return """Merhaba! Ben Basiret AI, e-ticaret danismaninizim. 

Size su konularda yardimci olabilirim:
- Yorum analizi ve musteri duygu durumu
- Rakip karsilastirma ve strateji onerileri  
- Capraz pazaryeri fiyat arbitraji
- Finansal durum analizi
- Magaza saglik skoru
- Tedarik ve indirim firsatlari

Ne hakkinda konusmak istersiniz?"""
