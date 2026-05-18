import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/curtain-theme-toggle';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

const LAST_UPDATED = '19 Mayıs 2026';

export default function PrivacyPolicyPage() {
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

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--accent)] text-xs font-bold shadow-sm mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>KVKK Uyumlu</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Gizlilik Politikası</h1>
        <p className="text-sm text-[var(--text-muted)] mb-10">Son güncelleme: {LAST_UPDATED}</p>

        <div className="space-y-8 text-[var(--text-secondary)] leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">1. Veri Sorumlusu</h2>
            <p>
              Bu Gizlilik Politikası, Arkus AI ("Arkus", "biz", "platform") tarafından sunulan
              hizmetler kapsamında 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili
              mevzuat çerçevesinde, kullanıcılara ait kişisel verilerin işlenmesine ilişkin esasları
              düzenler. Veri sorumlusu sıfatıyla iletişim adresimiz:{' '}
              <a href="mailto:arkusai.tr@gmail.com" className="text-[var(--accent)] hover:underline">
                arkusai.tr@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">2. İşlenen Kişisel Veri Kategorileri</h2>
            <p className="mb-3">Platformumuzu kullanmanız halinde aşağıdaki kişisel veri kategorileri işlenebilir:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Kimlik ve iletişim verileri:</strong> ad-soyad, e-posta adresi, mağaza adı.
              </li>
              <li>
                <strong>Hesap verileri:</strong> şifre (bcrypt ile hash'lenmiş), oturum (JWT) bilgileri,
                e-posta doğrulama kodu.
              </li>
              <li>
                <strong>Pazaryeri entegrasyon verileri:</strong> bağladığınız pazaryeri API anahtarları,
                mağaza URL'leri, ürünler, siparişler, yorumlar, fiyat hareketleri, rakip verileri.
              </li>
              <li>
                <strong>Kullanım ve teknik veriler:</strong> giriş kayıtları, IP adresi, kullanıcı
                aracısı (user agent), oluşturulan rapor ve analiz geçmişi.
              </li>
              <li>
                <strong>Yapay zeka kullanım verileri:</strong> AI servislerine (Gemini) gönderilen
                istekler, modeller, çağrı süreleri.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">3. Kişisel Verilerin İşlenme Amaçları</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Üyelik oluşturma, kimlik doğrulama ve hesap güvenliğinin sağlanması.</li>
              <li>Pazaryeri entegrasyonlarının kurulması ve veri senkronizasyonunun yürütülmesi.</li>
              <li>Finansal panel, raporlama, sağlık skoru, rakip analizi ve AI önerilerinin sunulması.</li>
              <li>Hizmet kalitesinin iyileştirilmesi, hata ayıklama, güvenlik denetimi ve istatistiksel analiz.</li>
              <li>Yasal yükümlülüklerin ifa edilmesi ve resmi makamlara karşı bilgi verme.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">4. Üçüncü Taraflarla Paylaşım</h2>
            <p className="mb-3">
              Kişisel verileriniz, hizmetin sunulması için gerekli olduğu ölçüde aşağıdaki üçüncü
              taraflarla paylaşılabilir:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong>Google / Gemini API:</strong> Yapay zeka destekli analiz ve web araması
                özellikleri için içerik / istek metinleri Google'a iletilir.
              </li>
              <li>
                <strong>Bağladığınız pazaryeri sağlayıcıları</strong> (Trendyol, Hepsiburada, Amazon TR,
                n11 vb.): yalnızca sizin sağladığınız API anahtarıyla, ilgili pazaryerinin kendi
                sunucularına bağlanılır.
              </li>
              <li>
                <strong>Barındırma ve altyapı sağlayıcıları:</strong> Veri tabanı, e-posta ve sunucu
                hizmeti aldığımız kuruluşlar (sözleşmesel gizlilik yükümlülüğü altında).
              </li>
            </ul>
            <p className="mt-3">
              Verileriniz reklam veya pazarlama amacıyla üçüncü taraflara satılmaz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">5. Çerezler (Cookies) ve Yerel Depolama</h2>
            <p>
              Platform, oturum sürekliliği, dil tercihi (TR/EN), tema (açık/koyu) tercihi ve arama
              geçmişi gibi işlevsel verileri tarayıcınızın
              <code className="px-1.5 py-0.5 mx-1 rounded bg-[var(--bg-elevated)] text-xs">localStorage</code>
              alanında saklayabilir. Bu veriler tarafımızca sunucuya iletilmez; kendi tarayıcı
              ayarlarınızdan silebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">6. Saklama Süresi</h2>
            <p>
              Kişisel verileriniz, hesabınız aktif olduğu sürece ve ilgili mevzuatta öngörülen yasal
              saklama süreleri boyunca saklanır. Hesabınızı kapatma talebi iletmeniz halinde,
              verileriniz yasal yükümlülüklerimiz saklı kalmak kaydıyla makul sürede silinir veya
              anonimleştirilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">7. KVKK Madde 11 Kapsamında Haklarınız</h2>
            <p className="mb-3">KVKK m.11 uyarınca aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
              <li>İşlenme amacını ve verilerin amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
              <li>KVKK m.7 çerçevesinde silinmesini veya yok edilmesini talep etme,</li>
              <li>Düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
              <li>Otomatik sistemler aracılığıyla analiz edilmesi sonucunda aleyhinize çıkan sonuçlara itiraz etme,</li>
              <li>Hukuka aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">8. Başvuru ve İletişim</h2>
            <p>
              KVKK kapsamındaki haklarınızı kullanmak veya bu politikaya ilişkin her türlü soru / talep
              için bize{' '}
              <a href="mailto:arkusai.tr@gmail.com" className="text-[var(--accent)] hover:underline">
                arkusai.tr@gmail.com
              </a>{' '}
              adresinden ulaşabilirsiniz. Başvurularınız, mevzuatta öngörülen süre içinde
              yanıtlanacaktır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">9. Politika Değişiklikleri</h2>
            <p>
              Arkus AI, bu Gizlilik Politikasını mevzuat değişiklikleri veya hizmet kapsamındaki
              güncellemeler doğrultusunda revize etme hakkını saklı tutar. Önemli değişikliklerde
              kullanıcılar e-posta veya platform içi bildirimle bilgilendirilir.
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
