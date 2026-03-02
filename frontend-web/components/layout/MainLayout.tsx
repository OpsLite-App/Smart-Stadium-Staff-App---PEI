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
  X
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

  useEffect(() => {
    if (!user && pathname !== '/auth-routes/login') {
      router.replace('/auth-routes/login');
    }
  }, [user, pathname, router]);

  if (!user) {
    return null;
  }

  // Navegação baseada no role
  const getNavigation = () => {
    const baseNav = [
      { name: 'Mapa', href: '/app-routes/map', icon: Map, current: pathname === '/app-routes/map' },
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
          { name: 'Tarefas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Chat', href: '/app-routes/chat', icon: MessageCircle, current: pathname === '/app-routes/chat' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];
      
      case 'Supervisor':
        return [
          ...baseNav,
          { name: 'Alertas', href: '/app-routes/alerts', icon: Bell, current: pathname === '/app-routes/alerts' },
          { name: 'Analytics', href: '/app-routes/analytics', icon: BarChart3, current: pathname === '/app-routes/analytics' },
          { name: 'Equipa', href: '/app-routes/team', icon: Users, current: pathname === '/app-routes/team' },
          { name: 'Perfil', href: '/app-routes/profile', icon: User, current: pathname === '/app-routes/profile' },
        ];
      
      default:
        return baseNav;
    }
  };

  const navigation = getNavigation();

  const handleNavigation = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

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
