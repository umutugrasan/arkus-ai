import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/curtain-theme-toggle';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

const LAST_UPDATED = '19 Mayıs 2026';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      {/* Header */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/assets/logos/logo-bird.png"
              alt="Arkus AI Logo"
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
            />
            <span className="hidden sm:inline text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tighter">
              Arkus
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <ThemeToggle variant="icon" buttonSize={36} duration={550} />
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              <ArrowLeft size={14} /> Ana sayfa
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--accent)] text-xs font-bold shadow-sm mb-6">
          <ScrollText className="w-3.5 h-3.5" />
          <span>Hizmet Sözleşmesi</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Kullanım Şartları</h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">Son güncelleme: {LAST_UPDATED}</p>

        <div className="space-y-8 text-[var(--text-secondary)] leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">1. Taraflar ve Kapsam</h2>
            <p>
              İşbu Kullanım Şartları, Arkus AI ("Arkus", "platform") ile platformu kullanan gerçek
              veya tüzel kişi ("Kullanıcı") arasındaki ilişkiyi düzenler. Platforma kaydolarak veya
              kullanmaya başlayarak bu şartları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan
              edersiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">2. Hizmetin Tanımı</h2>
            <p>
              Arkus, çoklu pazaryeri (Trendyol, Hepsiburada, Amazon TR, n11 vb.) verilerini bir araya
              getirip yapay zeka destekli analiz, raporlama, rakip takibi, tedarikçi araması, listeleme
              optimizasyonu ve görsel analiz gibi özellikler sunan bir SaaS platformudur. Hizmetin
              içeriği zaman içinde geliştirilebilir, değiştirilebilir veya sınırlandırılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">3. Hesap, Kayıt ve Güvenlik</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Hesap oluşturmak için doğru, güncel ve eksiksiz bilgi vermekle yükümlüsünüz.</li>
              <li>Şifrenizin ve oturum bilgilerinizin gizliliğini korumakla sorumlusunuz.</li>
              <li>Hesabınız üzerinden gerçekleşen tüm işlemler size aittir.</li>
              <li>Yetkisiz erişim şüphesini gecikmeksizin Arkus'a bildirmelisiniz.</li>
              <li>13 yaşından küçükler platformu kullanamaz.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">4. Ücretsiz ve Ücretli Planlar</h2>
            <p>
              Arkus, ücretsiz erişim ve ücretli planlar şeklinde sunulabilir. Ücretli planların
              kapsamı, fiyatı ve ödeme koşulları platform içinde ayrıca duyurulur. Fiyat
              değişiklikleri, yürürlüğe girmeden önce makul süre önce kullanıcıya bildirilir.
              Ücretsiz plan kapsamında bazı özellikler kotalı veya kısıtlı olabilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">5. Kullanıcı Yükümlülükleri</h2>
            <p className="mb-3">Kullanıcı, platformu kullanırken aşağıdakileri yapmamayı kabul eder:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Yürürlükteki mevzuata, kamu düzenine veya genel ahlaka aykırı işlem yapmak,</li>
              <li>Başkasının fikri/sınai mülkiyet haklarını ihlal etmek,</li>
              <li>Platformun çalışmasını engellemeye yönelik kötü niyetli yazılım, otomasyon, scraping veya yoğun istek göndermek,</li>
              <li>Pazaryeri API anahtarlarını sahiplerinin onayı olmadan kullanmak,</li>
              <li>Yapay zekayı kanun dışı içerik üretmek için kötüye kullanmak,</li>
              <li>Sahte hesap açmak, kimliğini gizlemek veya yanıltıcı bilgi vermek.</li>
            </ul>
            <p className="mt-3">
              Bu yükümlülüklere aykırılık halinde Arkus, hesabınızı bildirimsiz askıya alma veya
              kapatma hakkını saklı tutar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">6. Fikri Mülkiyet</h2>
            <p>
              Platformun arayüzü, logoları, marka adı "Arkus", kaynak kodu, içerikleri ve yapay zeka
              modellerine ilişkin tüm fikri ve sınai haklar Arkus AI'ya veya ilgili lisans verenlere
              aittir. Kullanıcının kendi yüklediği veriler (pazaryeri verileri, ürün bilgileri, vb.)
              Kullanıcıya ait olup, hizmetin sağlanması için gerekli olduğu ölçüde işlenir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">7. Hizmet Sunumu, Süreklilik ve Sorumluluk Sınırlaması</h2>
            <p className="mb-3">
              Arkus, hizmetin sürekli ve kesintisiz sunulması için makul çabayı gösterir; ancak
              aşağıdaki durumlardan doğan zararlardan sorumlu tutulamaz:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Pazaryerlerinin API'lerindeki değişiklikler, kotalar veya kesintiler,</li>
              <li>Üçüncü taraf AI sağlayıcılarının (Gemini vb.) erişim sorunları,</li>
              <li>İnternet, sunucu, donanım veya yazılım kaynaklı geçici teknik aksaklıklar,</li>
              <li>Yapay zekanın ürettiği önerilerin ticari sonuçları — AI çıktıları bilgilendiricidir, finansal/ticari karar Kullanıcıya aittir,</li>
              <li>Mücbir sebepler (deprem, salgın, savaş, siber saldırı vb.).</li>
            </ul>
            <p className="mt-3">
              Platformda yer alan kredi/finansman önerileri yalnızca bilgi amaçlıdır ve bağlayıcı
              finansal danışmanlık niteliği taşımaz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">8. Kişisel Verilerin Korunması</h2>
            <p>
              Kişisel verilerin işlenmesi,{' '}
              <Link to="/privacy" className="text-[var(--accent)] hover:underline">
                Gizlilik Politikası
              </Link>
              'nda ayrıntılı olarak açıklanmıştır. Bu Kullanım Şartları'nı kabul etmekle Gizlilik
              Politikası'nı da kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">9. Fesih ve Hesap Kapatma</h2>
            <p>
              Kullanıcı dilediği zaman hesabını kapatabilir. Arkus ise haklı sebeplerin varlığı veya
              bu şartların ihlali halinde hizmeti askıya alma ya da sonlandırma hakkına sahiptir.
              Fesih halinde ödenmiş ücretler, mevzuatta öngörülen istisnalar dışında iade edilmez.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">10. Değişiklikler</h2>
            <p>
              Arkus, bu Kullanım Şartları'nı tek taraflı olarak değiştirme hakkını saklı tutar. Önemli
              değişiklikler önceden e-posta veya platform içi bildirimle iletilir. Değişikliklerin
              yayınlanmasından sonra hizmeti kullanmaya devam etmeniz güncel şartları kabul ettiğiniz
              anlamına gelir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">11. Uygulanacak Hukuk ve Uyuşmazlık Çözümü</h2>
            <p>
              İşbu Kullanım Şartları Türkiye Cumhuriyeti hukukuna tabidir. Şartlardan doğabilecek
              uyuşmazlıkların çözümünde İstanbul Merkez (Çağlayan) Mahkemeleri ve İcra Daireleri
              yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">12. İletişim</h2>
            <p>
              Kullanım Şartları'na ilişkin sorularınız için bize{' '}
              <a href="mailto:arkusai.tr@gmail.com" className="text-[var(--accent)] hover:underline">
                arkusai.tr@gmail.com
              </a>{' '}
              adresinden ulaşabilirsiniz.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[var(--border-color)] pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <ArrowLeft size={14} /> Ana sayfaya dön
          </Link>
        </div>
      </main>
    </div>
  );
}
