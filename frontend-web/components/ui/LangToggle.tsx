'use client';
import { useLangStore } from '@/lib/stores/useLangStore';

export function LangToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLangStore();
  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${className ?? ''}`}
      title={lang === 'pt' ? 'Mudar para inglês' : 'Switch to Portuguese'}
    >
      {lang === 'pt' ? '🇵🇹 PT' : '🇬🇧 EN'}
    </button>
  );
}
