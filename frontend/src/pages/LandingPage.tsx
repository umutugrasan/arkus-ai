import { Link } from 'react-router-dom';
import { 
  Bot, 
  LineChart, 
  Search, 
  MessageSquare, 
  ArrowRight, 
  CheckCircle2, 
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f9f8f4] text-slate-800 font-sans selection:bg-[#4a3f44]/20 overflow-x-hidden">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f9f8f4]/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/logos/logo-bird.png" alt="Arkus Logo" className="w-14 h-14 object-contain" />
            <span className="text-3xl font-black text-slate-800 tracking-tighter">
              Arkus
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#ozellikler" className="hover:text-[#4a3f44] transition-colors">Özellikler</a>
            <a href="#nasil-calisir" className="hover:text-[#4a3f44] transition-colors">Nasıl Çalışır</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#4a3f44] transition-colors">
              Giriş Yap
            </Link>
            <Link 
              to="/register" 
              className="bg-[#4a3f44] hover:bg-[#6b6266] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              Hemen Başla
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative">
        {/* Abstract Glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-100 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-[#4a3f44] text-sm font-bold shadow-sm">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>E-Ticarette Yeni Dönem Başladı</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-800 tracking-tight leading-tight">
            E-ticaret Satıcıları için <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4a3f44] to-pink-500">
              Otonom Yapay Zeka Danışmanı
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mx-auto leading-relaxed">
            Sadece verilerinizi göstermekle kalmaz; otonom ajanlarla pazaryerini tarar, kârlı ürünler bulur ve size özel satış stratejileri üretir.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link 
              to="/register" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4a3f44] hover:bg-[#6b6266] text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-[#4a3f44]/20 hover:-translate-y-1"
            >
              Ücretsiz Denemeye Başla
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/login" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-slate-800 px-8 py-4 rounded-xl text-lg font-semibold transition-all border border-gray-200 shadow-sm"
            >
              Paneli İncele
            </Link>
          </div>

          <div className="pt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Kredi Kartı Gerekmez
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Anında Kurulum
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Sınırsız Yapay Zeka
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="ozellikler" className="py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-6">
              Neden Arkus?
            </h2>
            <p className="text-lg text-gray-500">
              Sıradan analiz araçlarının aksine, Arkus size ne yapmanız gerektiğini söyleyen proaktif bir sistemdir.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[#f9f8f4] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Bot className="w-7 h-7 text-[#4a3f44]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Otonom Ajanlar</h3>
              <p className="text-gray-500 leading-relaxed font-medium text-sm">
                Siz sormadan verinizi tarar, rakiplerin fiyat düşüşlerini veya stok tükenmelerini algılayıp aksiyon önerir.
              </p>
            </div>

            <div className="bg-[#f9f8f4] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <LineChart className="w-7 h-7 text-[#4a3f44]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Pazaryeri Arbitrajı</h3>
              <p className="text-gray-500 leading-relaxed font-medium text-sm">
                Trendyol, Hepsiburada ve Amazon arasındaki fiyat farklılıklarını tespit ederek arbitraj fırsatlarını önünüze getirir.
              </p>
            </div>

            <div className="bg-[#f9f8f4] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Search className="w-7 h-7 text-[#4a3f44]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Tedarik Avcısı</h3>
              <p className="text-gray-500 leading-relaxed font-medium text-sm">
                1688, Alibaba ve Toptanbul'u tarayarak size en uygun toptancıları bulur, kâr marjı analizini otomatik yapar.
              </p>
            </div>

            <div className="bg-[#f9f8f4] p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all group">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-[#4a3f44]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Arkus Chat</h3>
              <p className="text-gray-500 leading-relaxed font-medium text-sm">
                "Satışlarım neden düştü?" diye sorun, AI mağazanızın tüm verisini analiz edip sorunun kök nedenini anlatsın.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="nasil-calisir" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
           <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-6">
             Sadece 3 Adımda <span className="text-[#4a3f44]">Kârlılığınızı Katlayın</span>
           </h2>
           <p className="text-lg text-gray-500 mb-16 max-w-2xl mx-auto">
             Arkus karmaşık entegrasyonlar gerektirmez. Güçlü yapay zeka modellerimiz saniyeler içinde mağazanızı analiz etmeye başlar.
           </p>

           <div className="grid md:grid-cols-3 gap-8 text-left">
             <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10"></div>
               <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xl mb-6">1</div>
               <h4 className="text-xl font-bold text-slate-800 mb-2">Mağazanızı Bağlayın</h4>
               <p className="text-gray-500 text-sm font-medium">Pazaryeri API bilgilerinizi sisteme girin. Arkus anında ürünlerinizi, rakiplerinizi ve finansallarınızı senkronize eder.</p>
             </div>
             
             <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10"></div>
               <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mb-6">2</div>
               <h4 className="text-xl font-bold text-slate-800 mb-2">AI Analizi Bekleyin</h4>
               <p className="text-gray-500 text-sm font-medium">Yapay zeka ajanları arka planda müşteri yorumlarını, rakip fiyatlarını ve tedarikçi fırsatlarını 7/24 tarar.</p>
             </div>

             <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10"></div>
               <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xl mb-6">3</div>
               <h4 className="text-xl font-bold text-slate-800 mb-2">Aksiyona Geçin</h4>
               <p className="text-gray-500 text-sm font-medium">Sistem size net yönlendirmeler yapar. Fiyatınızı optimize edin, yeni tedarikçiye geçin veya listelemenizi iyileştirin.</p>
             </div>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between text-gray-500 font-medium text-sm">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img src="/assets/logos/logo-full.png" alt="Arkus Logo" className="h-14 object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>
            <p>© 2026 Arkus. Tüm hakları saklıdır.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-slate-800">Gizlilik Politikası</a>
              <a href="#" className="hover:text-slate-800">Kullanım Şartları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
