import { useI18n } from '../../context/I18nContext';
import type { Locale } from '../../i18n';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  const options: { value: Locale; label: string; flag: string }[] = [
    { value: 'tr', label: 'TR', flag: '🇹🇷' },
    { value: 'en', label: 'EN', flag: '🇺🇸' },
  ];

  return (
    <div className={`flex items-center gap-0.5 bg-[var(--bg-muted)] rounded-lg p-0.5 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            locale === opt.value
              ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>{opt.flag}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
