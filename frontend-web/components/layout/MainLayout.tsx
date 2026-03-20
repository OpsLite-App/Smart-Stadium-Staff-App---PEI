'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Map, 
  Bell, 
  User, 
  MessageCircle, 
  AlertOctagon,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
  Monitor,
  ArrowRight,
  LayoutDashboard,
  ClipboardList
} from 'lucide-react';
import { useState } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getDefaultRoute = (role?: string) => {
    if (role === 'Supervisor') {
      return '/app-routes/dashboard';
    }

    return '/app-routes/map';
  };

  useEffect(() => {
    if (!user && pathname !== '/auth-routes/login') {
      router.replace('/auth-routes/login');
    }
  }, [user, pathname, router]);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'Supervisor') {
      const blockedMobileOpsRoutes = ['/app-routes/chat', '/app-routes/emergency'];
      if (blockedMobileOpsRoutes.includes(pathname)) {
        router.replace('/app-routes/dashboard');
      }
      return;
    }

    const webOnlySupervisorRoutes = ['/app-routes/analytics', '/app-routes/team'];
    if (webOnlySupervisorRoutes.includes(pathname)) {
      router.replace(getDefaultRoute(user.role));
    }
  }, [user, pathname, router]);

  if (!user) {
    return null;
  }

  // Navegação baseada no role
  const getNavigation = () => {
    const baseNav = [
      { name: 'Mapa', href: '/app-routes/map', icon: Map, current: pathname === '/app-routes/map' },
      { name: 'Dashboard', href: '/app-routes/dashboard', icon: BarChart3, current: pathname === '/app-routes/dashboard' },
    ];

    switch (user.role) {
      case 'Security':
        return [
          ...baseNav,
          { name: 'Alertas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Chat', href: '/app-routes/chat', icon: MessageCircle, current: pathname === '/app-routes/chat' },
          { name: 'Emergência', href: '/app-routes/emergency', icon: AlertOctagon, current: pathname === '/app-routes/emergency' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];
      
      case 'Cleaning':
        return [
          ...baseNav,
          { name: 'Tarefas', href: '/app-routes/tasks', icon: ClipboardList, current: pathname === '/app-routes/tasks' },
          { name: 'Alertas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Chat', href: '/app-routes/chat', icon: MessageCircle, current: pathname === '/app-routes/chat' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];
      
      case 'Supervisor':
        return [
          { name: 'Dashboard', href: '/app-routes/dashboard', icon: LayoutDashboard, current: pathname === '/app-routes/dashboard' },
          { name: 'Analytics', href: '/app-routes/analytics', icon: BarChart3, current: pathname === '/app-routes/analytics' },
          { name: 'Equipa', href: '/app-routes/team', icon: Users, current: pathname === '/app-routes/team' },
          { name: 'Alertas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Mapa', href: '/app-routes/map', icon: Map, current: pathname === '/app-routes/map' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];

      case 'Medical':
        return [
          { name: 'Dashboard', href: '/app-routes/dashboard', icon: LayoutDashboard, current: pathname === '/app-routes/dashboard' },
          { name: 'Alertas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Mapa', href: '/app-routes/map', icon: Map, current: pathname === '/app-routes/map' },
          { name: 'Chat', href: '/app-routes/chat', icon: MessageCircle, current: pathname === '/app-routes/chat' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];
      
      default:
        return baseNav;
    }
  };

  const navigation = getNavigation();
  const isSupervisorWeb = user.role === 'Supervisor';

  const handleNavigation = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  if (isSupervisorWeb) {
    return (
      <div className="min-h-screen bg-[#f2f4f8]">
        <div className="lg:hidden min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e5e7eb)]">
          <div className="max-w-sm w-full rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <Monitor size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Workspace de Supervisão</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              A experiência de `Supervisor` foi pensada para desktop, com dashboards, analytics e gestão de equipa.
            </p>
            <div className="mt-6 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Abre esta conta num ecrã maior para usar a versão web completa.
            </div>
            <button
              onClick={() => router.push('/app-routes/profile')}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Ir para o perfil
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                logout();
                router.push('/auth-routes/login');
              }}
              className="mt-3 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Terminar sessão
            </button>
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-[280px_1fr] min-h-screen">
          <aside className="border-r border-gray-200 bg-white">
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-100 px-6 py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-sm font-bold text-white shadow-sm">
                    O
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">OpsLite</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-600">Supervisor Web</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-5">
                <div className="rounded-2xl bg-[linear-gradient(135deg,#111827,#1f2937)] px-4 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-300">Operações</p>
                  <p className="mt-2 text-2xl font-semibold">Controlo central</p>
                  <p className="mt-2 text-sm text-gray-300">
                    Monitorização, equipa e decisões em tempo real.
                  </p>
                </div>
              </div>

              <nav className="flex-1 space-y-1 px-4">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                      item.current
                        ? 'bg-amber-50 text-amber-800'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </button>
                ))}
              </nav>

              <div className="border-t border-gray-100 px-4 py-5">
                <div className="mb-4 rounded-2xl bg-gray-50 px-4 py-3">
                  <p className="truncate text-sm font-medium text-gray-900">{user.email || 'Utilizador'}</p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    router.push('/auth-routes/login');
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut size={18} />
                  Sair
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="border-b border-gray-200 bg-white/80 px-8 py-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Supervisão</p>
                  <h1 className="mt-1 text-2xl font-semibold text-gray-900">Centro de operações</h1>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  Web workspace ativo
                </div>
              </div>
            </div>

            <div className="px-8 py-8">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <span className="font-semibold text-gray-900">OpsLite</span>
          <div className="w-8" />
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">O</span>
                  </div>
                  <span className="font-bold text-gray-900">OpsLite</span>
                </div>

                <nav className="space-y-1">
                  {navigation.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                        ${item.current
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <item.icon size={20} />
                      {item.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => {
                  logout();
                  router.push('/auth-routes/login');
                }}
                className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 min-h-0 bg-white border-r border-gray-200">
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-4 py-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">O</span>
                </div>
                <span className="font-bold text-gray-900">OpsLite</span>
              </div>

              <nav className="space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                      ${item.current
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <item.icon size={20} />
                    {item.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User size={16} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.email || 'Utilizador'}
                </p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/auth-routes/login');
              }}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut size={20} />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="min-h-screen pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
