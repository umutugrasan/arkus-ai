import { Link } from 'react-router-dom';
import {
  Bot,
  LineChart,
  Search,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import NavHeader from '@/components/ui/nav-header';
import { ThemeToggle } from '@/components/ui/curtain-theme-toggle';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useI18n } from '@/context/I18nContext';

export default function LandingPage() {
  const { t } = useI18n();

  const features = [
    { icon: Bot, title: t('landing.feat1_title'), desc: t('landing.feat1_desc') },
    { icon: LineChart, title: t('landing.feat2_title'), desc: t('landing.feat2_desc') },
    { icon: Search, title: t('landing.feat3_title'), desc: t('landing.feat3_desc') },
    { icon: MessageSquare, title: t('landing.feat4_title'), desc: t('landing.feat4_desc') },
  ];

  const steps = [
    { n: '1', accent: 'bg-amber-50', badge: 'bg-amber-100 text-amber-600', title: t('landing.step1_title'), desc: t('landing.step1_desc') },
    { n: '2', accent: 'bg-blue-50', badge: 'bg-blue-100 text-blue-600', title: t('landing.step2_title'), desc: t('landing.step2_desc') },
    { n: '3', accent: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-600', title: t('landing.step3_title'), desc: t('landing.step3_desc') },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent)]/20 overflow-x-hidden">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)] backdrop-blur-md border-b border-[var(--border-strong)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/logos/logo-bird.png" alt="Arkus Logo" className="w-14 h-14 object-contain" />
            <span className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">
              Arkus
            </span>
          </div>

          <div className="hidden md:block">
            <NavHeader
              items={[
                { label: t('landing.nav_home'), href: '#top' },
                { label: t('landing.nav_features'), href: '#ozellikler' },
                { label: t('landing.nav_how'), href: '#nasil-calisir' },
                { label: t('landing.contact'), href: '#iletisim' },
              ]}
            />
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle variant="icon" buttonSize={36} duration={550} />

            <Link to="/login" className="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              {t('auth.login')}
            </Link>
            <Link
              to="/register"
              className="bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              {t('landing.get_started')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 relative">
        {/* Abstract Glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-100 dark:bg-amber-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--accent)] text-sm font-bold shadow-sm">
            <img
              src="/assets/logos/logo-bird.png"
              alt="Arkus"
              className="w-5 h-5 object-contain"
            />
            <span>{t('landing.tagline')}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
            {t('landing.hero_title_1')} <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-pink-500">
              {t('landing.hero_title_2')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-[var(--text-muted)] max-w-3xl mx-auto leading-relaxed">
            {t('landing.hero_desc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link
              to="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-xl shadow-black/10 hover:-translate-y-1"
            >
              {t('landing.start_free')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--bg-card)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] px-8 py-4 rounded-xl text-lg font-semibold transition-all border border-[var(--border-strong)] shadow-sm"
            >
              {t('landing.explore')}
            </Link>
          </div>

          <div className="pt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--text-muted)] font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> {t('landing.no_cc')}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> {t('landing.instant_setup')}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> {t('landing.unlimited_ai')}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="ozellikler" className="py-24 bg-[var(--bg-card)] border-y border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-6">
              {t('landing.why_arkus')}
            </h2>
            <p className="text-lg text-[var(--text-muted)]">
              {t('landing.why_desc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-[var(--bg-primary)] p-8 rounded-2xl border border-[var(--border-color)] hover:shadow-lg transition-all group">
                <div className="w-14 h-14 bg-[var(--bg-card)] rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7 text-[var(--accent)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{title}</h3>
                <p className="text-[var(--text-muted)] leading-relaxed font-medium text-sm">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="nasil-calisir" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
           <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-6">
             {t('landing.how_title_1')} <span className="text-[var(--accent)]">{t('landing.how_title_2')}</span>
           </h2>
           <p className="text-lg text-[var(--text-muted)] mb-16 max-w-2xl mx-auto">
             {t('landing.how_desc')}
           </p>

           <div className="grid md:grid-cols-3 gap-8 text-left">
             {steps.map(({ n, accent, badge, title, desc }) => (
               <div key={n} className="bg-[var(--bg-card)] p-8 rounded-2xl border border-[var(--border-color)] shadow-sm relative overflow-hidden">
                 <div className={`absolute top-0 right-0 w-24 h-24 ${accent} rounded-bl-full -z-10`}></div>
                 <div className={`w-12 h-12 ${badge} rounded-full flex items-center justify-center font-bold text-xl mb-6`}>{n}</div>
                 <h4 className="text-xl font-bold text-[var(--text-primary)] mb-2">{title}</h4>
                 <p className="text-[var(--text-muted)] text-sm font-medium">{desc}</p>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* İletişim Section */}
      <section id="iletisim" className="py-24 px-4 sm:px-6 lg:px-8 bg-[var(--bg-card)] border-y border-[var(--border-color)] scroll-mt-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-primary)] border border-[var(--border-strong)] text-[var(--accent)] text-sm font-bold shadow-sm mb-6">
            <Mail className="w-4 h-4 text-amber-500" />
            <span>{t('landing.contact')}</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4 tracking-tight">
            {t('landing.contact_title')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-pink-500">
              {t('landing.contact_subtitle')}
            </span>
          </h2>
          <p className="text-lg text-[var(--text-muted)] mb-10 max-w-2xl mx-auto">
            {t('landing.contact_desc')}
          </p>

          <a
            href="mailto:arkusai.tr@gmail.com"
            className="group inline-flex items-center gap-3 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-fg)] px-8 py-5 rounded-2xl text-lg font-semibold transition-all shadow-xl shadow-black/10 hover:-translate-y-1"
          >
            <Mail className="w-5 h-5" />
            arkusai.tr@gmail.com
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>

          <p className="text-xs text-[var(--text-faint)] mt-6">
            {t('landing.contact_response')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-strong)] bg-[var(--bg-card)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between text-[var(--text-muted)] font-medium text-sm">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img src="/assets/logos/logo-full.png" alt="Arkus Logo" className="h-14 object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>
            <p>{t('landing.footer_copyright')}</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-[var(--text-primary)]">{t('landing.footer_privacy')}</a>
              <a href="#" className="hover:text-[var(--text-primary)]">{t('landing.footer_terms')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
