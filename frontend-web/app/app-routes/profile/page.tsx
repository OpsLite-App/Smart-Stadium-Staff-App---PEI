'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useTranslation } from 'react-i18next';
import { 
  User,
  Shield,
  Brush,
  UserCog,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  Volume2,
  Vibrate,
  Globe,
  LogOut,
  TrendingUp,
  AlertTriangle,
  Download,
  Calendar,
  Star,
  Award,
  Target,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { theme } from '@/lib/theme';
import { AppButton } from '@/components/ui/AppButton';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';

// Interface para dados do perfil vindo da API
interface ProfileStats {
  incidentsHandled: number;
  successRate: number;
  avgResponseTime: string;
  totalHours: number;
  rating: number;
  badges: Array<{ id: string; name: string; icon: string }>;
}

interface RecentActivity {
  id: string;
  type: 'incident' | 'task' | 'achievement';
  title: string;
  time: string;
  status: 'completed' | 'pending' | 'in-progress';
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  
  // Estados locais
  const [onDuty, setOnDuty] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    incidentsHandled: 0,
    successRate: 0,
    avgResponseTime: '0:00',
    totalHours: 0,
    rating: 0,
    badges: []
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  
  // Estado para o formulário de edição
  const [editForm, setEditForm] = useState({
    phone: '+351 123 456 789',
    location: 'Estádio do Dragão, Porto',
    memberSince: '2020',
    name: user?.email?.split('@')[0] || 'Utilizador'
  });

  // Carregar dados do perfil da API
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      // Simular chamada API - substituir por chamada real
      // const response = await api.getProfileStats(user.id);
      
      // Dados mock para exemplo
      setTimeout(() => {
        setProfileStats({
          incidentsHandled: 1247,
          successRate: 98,
          avgResponseTime: '3:42',
          totalHours: 156,
          rating: 4.8,
          badges: [
            { id: '1', name: '5 Anos de Serviço', icon: '🎖️' },
            { id: '2', name: '1000 Incidentes', icon: '🏆' },
            { id: '3', name: 'Equipa do Mês', icon: '⭐' },
          ]
        });

        setRecentActivity([
          {
            id: '1',
            type: 'incident',
            title: 'Incidente resolvido - Bancada Sul',
            time: 'há 10 minutos',
            status: 'completed'
          },
          {
            id: '2',
            type: 'task',
            title: 'Task de limpeza - Área Comercial',
            time: 'há 25 minutos',
            status: 'completed'
          },
          {
            id: '3',
            type: 'achievement',
            title: 'Badge desbloqueada: 1000 Incidentes',
            time: 'há 2 horas',
            status: 'completed'
          },
          {
            id: '4',
            type: 'incident',
            title: 'SOS - Portão 3 (em andamento)',
            time: 'há 15 minutos',
            status: 'in-progress'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setLoading(false);
    }
  };

  // Funções de edição
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      // Aqui podes chamar a API para salvar
      console.log('Perfil atualizado:', editForm);
      
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsEditing(false);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (lang: 'pt' | 'en') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('user-language', lang);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth-routes/login');
  };

  const getRoleIcon = () => {
    switch(user?.role) {
      case 'Security': return Shield;
      case 'Cleaning': return Brush;
      case 'Supervisor': return UserCog;
      default: return User;
    }
  };

  const getRoleColor = () => {
    switch(user?.role) {
      case 'Security': return '#3B82F6';
      case 'Cleaning': return '#10B981';
      case 'Supervisor': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const RoleIcon = getRoleIcon();
  const roleColor = getRoleColor();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
          <p className="text-gray-600">A carregar perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] pb-20">
      {/* Header/Capa */}
      <div className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] h-32 relative">
        <div className="absolute -bottom-12 left-6">
          <Avatar
            name={user.email.split('@')[0]}
            role={user.role}
            size="xl"
            status={onDuty ? 'online' : 'offline'}
            className="border-4 border-white shadow-lg"
          />
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="px-6 pt-16">
        {/* Informações Básicas */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleInputChange}
                  className="text-2xl font-bold text-[#1F2937] border-b-2 border-[#4F46E5] focus:outline-none mb-2"
                />
              ) : (
                <h1 className="text-2xl font-bold text-[#1F2937]">
                  {user.email.split('@')[0]}
                </h1>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={user.role === 'Security' ? 'primary' : user.role === 'Cleaning' ? 'success' : 'warning'}>
                  <RoleIcon size={12} className="mr-1" />
                  {user.role}
                </Badge>
                <Badge variant={onDuty ? 'success' : 'default'} size="sm">
                  {onDuty ? 'Em Serviço' : 'Fora de Serviço'}
                </Badge>
              </div>
            </div>
            <button 
              onClick={handleEditToggle}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isEditing ? <X size={20} className="text-[#6B7280]" /> : <Edit2 size={20} className="text-[#6B7280]" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Mail size={16} />
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Phone size={16} />
              {isEditing ? (
                <input
                  type="text"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleInputChange}
                  className="text-sm border-b border-gray-300 focus:outline-none focus:border-[#4F46E5] w-full"
                />
              ) : (
                <span className="text-sm">{editForm.phone}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <MapPin size={16} />
              {isEditing ? (
                <input
                  type="text"
                  name="location"
                  value={editForm.location}
                  onChange={handleInputChange}
                  className="text-sm border-b border-gray-300 focus:outline-none focus:border-[#4F46E5] w-full"
                />
              ) : (
                <span className="text-sm">{editForm.location}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Calendar size={16} />
              {isEditing ? (
                <input
                  type="text"
                  name="memberSince"
                  value={editForm.memberSince}
                  onChange={handleInputChange}
                  className="text-sm border-b border-gray-300 focus:outline-none focus:border-[#4F46E5] w-full"
                />
              ) : (
                <span className="text-sm">Membro desde {editForm.memberSince}</span>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50"
              >
                <Save size={18} />
                {loading ? 'A guardar...' : 'Guardar alterações'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target size={16} className="text-blue-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Incidentes</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">
              {profileStats.incidentsHandled}
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Sucesso</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">
              {profileStats.successRate}%
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock size={16} className="text-yellow-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Tempo Médio</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">
              {profileStats.avgResponseTime}
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star size={16} className="text-purple-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Rating</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">
              {profileStats.rating}
            </span>
          </div>
        </div>

        {/* Badges/Conquistas */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
            CONQUISTAS
          </h3>
          <div className="flex flex-wrap gap-2">
            {profileStats.badges.map(badge => (
              <div
                key={badge.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
              >
                <span className="text-xl">{badge.icon}</span>
                <span className="text-sm font-medium text-[#1F2937]">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
            ATIVIDADE RECENTE
          </h3>
          <div className="space-y-4">
            {recentActivity.map(activity => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'incident' ? 'bg-red-100' :
                  activity.type === 'task' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {activity.type === 'incident' && <AlertTriangle size={16} className="text-red-600" />}
                  {activity.type === 'task' && <CheckCircle size={16} className="text-green-600" />}
                  {activity.type === 'achievement' && <Award size={16} className="text-yellow-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1F2937]">{activity.title}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{activity.time}</p>
                </div>
                {activity.status === 'completed' && (
                  <Badge variant="success" size="sm">Concluído</Badge>
                )}
                {activity.status === 'in-progress' && (
                  <Badge variant="warning" size="sm">Em andamento</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preferências */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
            PREFERÊNCIAS
          </h3>
          
          <div className="space-y-4">
            {/* Idioma */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-[#6B7280]" />
                <span className="text-sm text-[#1F2937]">Idioma</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLanguageChange('pt')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    language === 'pt'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  PT
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    language === 'en'
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Notificações Push */}
            <Switch
              label="Notificações Push"
              description="Receber alertas em tempo real"
              checked={pushEnabled}
              onChange={setPushEnabled}
            />

            {/* Som */}
            <Switch
              label="Som de Alertas"
              description="Reproduzir som quando chegar alerta"
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />

            {/* Vibração */}
            <Switch
              label="Vibração"
              description="Vibrar em situações de emergência"
              checked={vibrationEnabled}
              onChange={setVibrationEnabled}
            />

            {/* Estado de Serviço */}
            <Switch
              label="Em Serviço"
              description="Mostrar como disponível para tarefas"
              checked={onDuty}
              onChange={setOnDuty}
            />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="space-y-3">
          <button
            onClick={() => alert('Relatório gerado!')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-[#1F2937] font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={20} />
            Exportar Dados
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-100 transition-colors"
          >
            <LogOut size={20} />
            Terminar Sessão
          </button>
        </div>

        {/* Versão da App */}
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          OpsLite v1.0.2 • {user.role}
        </p>
      </div>
    </div>
  );
}