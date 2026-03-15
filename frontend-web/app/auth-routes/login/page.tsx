// app/auth-routes/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { Shield, Brush, UserCog, Eye, EyeOff } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'Security' | 'Cleaning' | 'Supervisor'>('Security');
  const { login, isLoading, user, hydrated } = useAuthStore();
  const router = useRouter();

  const getDefaultRoute = (userRole?: 'Security' | 'Cleaning' | 'Supervisor') => {
    if (userRole === 'Supervisor') {
      return '/app-routes/dashboard';
    }

    return '/app-routes/map';
  };

  // Se já estiver logado, redireciona para o mapa
  useEffect(() => {
    if (hydrated && user) {
      router.replace(getDefaultRoute(user.role));
    }
  }, [user, hydrated, router]);

  // Se ainda está a hidratar, mostra loading
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#4F46E5] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white text-2xl font-bold">O</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937] mb-2">OpsLite</h1>
          <p className="text-[#6B7280] mb-4">A carregar...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5] mx-auto"></div>
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    const success = await login(email, password, role);
    if (success) {
      router.replace(getDefaultRoute(role));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F3F4F6]">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#4F46E5] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-white text-2xl font-bold">O</span>
          </div>
          <h1 className="text-3xl font-bold text-[#1F2937]">OpsLite</h1>
          <p className="text-sm text-[#6B7280] mt-1">Smart Stadium Staff App</p>
        </div>

        <div className="space-y-6">
          {/* Role Selection */}
          <div>
            <label className="block text-xs font-bold text-[#6B7280] mb-3 tracking-wider">
              SELECIONE A SUA FUNÇÃO
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setRole('Security')}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                  ${role === 'Security' 
                    ? 'border-[#4F46E5] bg-[#EEF2FF]' 
                    : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                  }
                `}
              >
                <Shield size={24} className={role === 'Security' ? 'text-[#4F46E5]' : 'text-[#6B7280]'} />
                <span className={`text-xs font-semibold ${role === 'Security' ? 'text-[#4F46E5]' : 'text-[#6B7280]'}`}>
                  Security
                </span>
              </button>

              <button
                onClick={() => setRole('Cleaning')}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                  ${role === 'Cleaning' 
                    ? 'border-[#10B981] bg-[#ECFDF5]' 
                    : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                  }
                `}
              >
                <Brush size={24} className={role === 'Cleaning' ? 'text-[#10B981]' : 'text-[#6B7280]'} />
                <span className={`text-xs font-semibold ${role === 'Cleaning' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
                  Cleaning
                </span>
              </button>

              <button
                onClick={() => setRole('Supervisor')}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                  ${role === 'Supervisor' 
                    ? 'border-[#F59E0B] bg-[#FFFBEB]' 
                    : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                  }
                `}
              >
                <UserCog size={24} className={role === 'Supervisor' ? 'text-[#F59E0B]' : 'text-[#6B7280]'} />
                <span className={`text-xs font-semibold ${role === 'Supervisor' ? 'text-[#F59E0B]' : 'text-[#6B7280]'}`}>
                  Supervisor
                </span>
              </button>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-[#6B7280] mb-1 tracking-wider">
              NOME DE UTILIZADOR
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                placeholder="staff@email.com"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-[#6B7280] mb-1 tracking-wider">
              PALAVRA-PASSE
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="mt-1 text-right">
              <button className="text-xs text-[#4F46E5] hover:underline">
                Esqueceu-se da password?
              </button>
            </div>
          </div>

          {/* Login Button */}
          <AppButton
            title="ENTRAR NO SISTEMA"
            onClick={handleLogin}
            loading={isLoading}
            fullWidth
            className="mt-4"
          />

          {/* Footer */}
          <p className="text-center text-xs text-[#9CA3AF] mt-6">
            © 2026 FC Porto - Stadium Security System
          </p>
        </div>
      </div>
    </div>
  );
}
