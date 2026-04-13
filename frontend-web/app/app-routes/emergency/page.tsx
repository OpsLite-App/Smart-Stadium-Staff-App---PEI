// app/app-routes/emergency/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { AlertOctagon, DoorOpen, Megaphone, Radio, CheckCircle } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';

export default function EmergencyPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'counting' | 'active'>('idle');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let intervalId: NodeJS.Timeout; // 🔹 Tipo correto
    
    if (mode === 'counting') {
      intervalId = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setMode('active');
            // Vibrar se disponível no browser
            if (navigator.vibrate) {
              navigator.vibrate([500, 500, 500]);
            }
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [mode]);

  const handleCancel = () => {
    setMode('idle');
    setCountdown(3);
  };

  const handleSafety = () => {
    alert(t('emergency.safe_alert'));
    handleCancel();
  };

  const handleReportDanger = () => {
    alert(t('emergency.danger_alert'));
  };

  if (mode === 'active') {
    return (
      <div className="min-h-screen bg-[#DC2626]">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8 mt-8">
            <div className="flex justify-center mb-4">
              <AlertOctagon size={64} className="text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{t('emergency.mode_title')}</h1>
            <p className="text-[#FECACA] font-semibold tracking-wider">{t('emergency.mode_subtitle')}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
            <h2 className="text-lg font-bold text-[#DC2626] mb-4 pb-2 border-b border-[#FEE2E2]">
              {t('emergency.instructions_title')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DoorOpen size={24} className="text-[#DC2626]" />
                <span className="text-[#1F2937] font-medium">{t('emergency.instruction_gates')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Megaphone size={24} className="text-[#DC2626]" />
                <span className="text-[#1F2937] font-medium">{t('emergency.instruction_megaphone')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Radio size={24} className="text-[#DC2626]" />
                <span className="text-[#1F2937] font-medium">{t('emergency.instruction_radio')}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-[#FECACA] text-center mb-4">{t('emergency.location_sharing')}</p>
            <AppButton title={t('emergency.safe')} onClick={handleSafety} fullWidth className="bg-[#10B981] hover:bg-[#059669] text-white font-bold py-3 px-4 rounded-lg mb-3" />
            <AppButton title={t('emergency.report_danger')} onClick={handleReportDanger} mode="outlined" fullWidth className="border-2 border-white text-white hover:bg-white hover:text-[#DC2626] font-bold py-3 px-4 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-[#1F2937] mb-2">{t('emergency.center_title')}</h1>
        <p className="text-[#6B7280] mb-8">{t('emergency.center_subtitle')}</p>

        <button
          onClick={() => setMode('counting')}
          disabled={mode === 'counting'}
          className={`
            w-48 h-48 mx-auto rounded-full mb-8
            flex flex-col items-center justify-center
            transition-all duration-300 shadow-xl
            ${mode === 'counting' 
              ? 'bg-[#DC2626] scale-110' 
              : 'bg-[#EF4444] hover:bg-[#DC2626] hover:scale-105'
            }
            border-8 border-[#FEF2F2]
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {mode === 'counting' ? (
            <span className="text-white text-7xl font-black">{countdown}</span>
          ) : (
            <>
              <AlertOctagon size={48} className="text-white mb-2" />
              <span className="text-white text-2xl font-black">SOS</span>
            </>
          )}
        </button>

        {mode === 'counting' && (
          <div className="text-center">
            <p className="text-[#EF4444] font-bold mb-3">{t('emergency.activating')}</p>
            <button onClick={handleCancel} className="px-8 py-2 bg-white border border-gray-200 rounded-full text-[#1F2937] font-medium hover:bg-gray-50">
              {t('common.cancel')}
            </button>
          </div>
        )}

        <button onClick={() => router.back()} className="mt-8 text-[#6B7280] hover:text-[#1F2937]">
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}