import React, { useState } from 'react';
import { Alert } from 'react-native'; 
import { useNavigation } from '@react-navigation/native'; 
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  Switch 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Divider } from 'react-native-paper';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// i18n imports
import { useTranslation } from 'react-i18next';

// Stores e Componentes
import { useAuthStore } from '../stores/useAuthStore';
import AppButton from '../components/AppButton';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>(); 
  // Estados Locais
  const [onDuty, setOnDuty] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);

  // Função para Trocar Idioma
  const toggleLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem('user-language', lang);
  };

  // ========== DADOS POR ROLE ==========

  // Stats diferentes por role
  const getStatsByRole = () => {
    switch(user?.role) {
      case 'Security':
        return [
          { label: 'Incidentes', value: '127', color: theme.colors.text },
          { label: 'Taxa Sucesso', value: '98%', color: '#10B981' },
          { label: 'Tempo Médio Resp.', value: '3:42', color: theme.colors.primary },
        ];
      case 'Cleaning':
        return [
          { label: 'Áreas Limpas', value: '42', color: '#10B981' },
          { label: 'Lixeiras Vazias', value: '87%', color: theme.colors.primary },
          { label: 'Tempo Médio Task', value: '12:30', color: theme.colors.text },
        ];
      case 'Supervisor':
        return [
          { label: 'Equipa Ativa', value: '24', color: theme.colors.primary },
          { label: 'SOS Resolvidos', value: '98%', color: '#10B981' },
          { label: 'Tempo Médio Resp.', value: '3:42', color: theme.colors.text },
        ];
      default:
        return [
          { label: 'Incidentes', value: '127', color: theme.colors.text },
          { label: 'Taxa Sucesso', value: '98%', color: '#10B981' },
          { label: 'Tempo Médio Resp.', value: '3:42', color: theme.colors.primary },
        ];
    }
  };

  // KPIs diferentes por role
  const getKpisByRole = () => {
    switch(user?.role) {
      case 'Security':
        return [
          { label: 'Tempo de Resposta', value: '3:42 / 4:00', pct: 0.92, color: '#10B981' },
          { label: 'Gestão de Multidões', value: '88%', pct: 0.88, color: '#3B82F6' },
          { label: 'Verificações de Segurança', value: '76%', pct: 0.76, color: '#F59E0B' },
        ];
      case 'Cleaning':
        return [
          { label: 'Eficiência Limpeza', value: '92%', pct: 0.92, color: '#10B981' },
          { label: 'Lixeiras Vazias', value: '87%', pct: 0.87, color: '#3B82F6' },
          { label: 'Tempo por Área', value: '12:30', pct: 0.85, color: '#F59E0B' },
        ];
      case 'Supervisor':
        return [
          { label: 'Performance Equipa', value: '94%', pct: 0.94, color: '#10B981' },
          { label: 'Tempo Médio Resposta', value: '3:42', pct: 0.92, color: '#3B82F6' },
          { label: 'Alertas Resolvidos', value: '98%', pct: 0.98, color: '#F59E0B' },
        ];
      default:
        return [];
    }
  };

  // Zonas críticas diferentes por role
  const getCriticalZonesByRole = () => {
    switch(user?.role) {
      case 'Security':
        return [
          { id: 'G01', value: 85, color: '#4F46E5', label: 'Portão 01' },
          { id: 'G03', value: 92, color: '#7C3AED', label: 'Portão 03' },
          { id: 'G05', value: 78, color: '#2563EB', label: 'Portão 05' },
          { id: 'N22', value: 55, color: '#0891B2', label: 'Norte 22' },
        ];
      case 'Cleaning':
        return [
          { id: 'B14', value: 95, color: '#059669', label: 'Lixeira 14' },
          { id: 'B07', value: 88, color: '#10B981', label: 'Lixeira 07' },
          { id: 'B22', value: 72, color: '#D97706', label: 'Lixeira 22' },
          { id: 'B09', value: 68, color: '#DB2777', label: 'Lixeira 09' },
        ];
      case 'Supervisor':
        return [
          { id: 'G01', value: 85, color: '#4F46E5', label: 'Portão 01' },
          { id: 'B14', value: 95, color: '#059669', label: 'Lixeira 14' },
          { id: 'S18', value: 72, color: '#D97706', label: 'Setor 18' },
          { id: 'N22', value: 55, color: '#0891B2', label: 'Norte 22' },
        ];
      default:
        return [];
    }
  };

  // Performance da equipa (apenas Supervisor)
  const getTeamPerformance = () => {
    if (user?.role !== 'Supervisor') return [];
    
    return [
      { id: 'SEC-12', team: 'Security Squad B', resolved: 24, avg: '3:12', rating: 95, color: '#3B82F6' },
      { id: 'CLN-08', team: 'Cleaning Team C', resolved: 18, avg: '2:45', rating: 98, color: '#10B981' },
      { id: 'MED-07', team: 'Medical Team Alpha', resolved: 15, avg: '4:30', rating: 92, color: '#6366F1' },
    ];
  };

  // Horários de pico diferentes por role
  const getPeakTimesByRole = () => {
    switch(user?.role) {
      case 'Security':
        return [
          { time: '15:00 - 16:00', count: 12, pct: 1.0, color: '#10B981' },
          { time: '20:00 - 21:00', count: 9, pct: 0.75, color: '#3B82F6' },
          { time: '17:00 - 18:00', count: 7, pct: 0.58, color: '#F59E0B' },
        ];
      case 'Cleaning':
        return [
          { time: '14:30 - 15:30', count: 8, pct: 1.0, color: '#10B981' },
          { time: '18:00 - 19:00', count: 6, pct: 0.75, color: '#3B82F6' },
          { time: '21:00 - 22:00', count: 5, pct: 0.63, color: '#F59E0B' },
        ];
      case 'Supervisor':
        return [
          { time: '15:00 - 16:00', count: 12, pct: 1.0, color: '#10B981' },
          { time: '20:00 - 21:00', count: 9, pct: 0.75, color: '#3B82F6' },
          { time: '14:30 - 15:30', count: 8, pct: 0.67, color: '#F59E0B' },
        ];
      default:
        return [];
    }
  };

  // Ações rápidas diferentes por role
  const getQuickActionsByRole = () => {
    const baseActions = [
      { 
        icon: 'clock-check-outline', 
        label: t('profile.actions.end_shift'), 
        color: '#10B981',
        onPress: () => {
          Alert.alert(
            "Terminar Turno",
            "Deseja terminar o turno?",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Confirmar", onPress: () => {
                alert("Turno terminado com sucesso!");
              }}
            ]
          );
        }
      },
    ];

    switch(user?.role) {
      case 'Security':
        return [
          ...baseActions,
          { 
            icon: 'shield-alert-outline', 
            label: t('profile.actions.protocols'), 
            color: theme.colors.error,
            onPress: () => alert("A abrir PDF...")
          },
          { 
            icon: 'book-open-page-variant-outline', 
            label: t('profile.actions.training'), 
            color: theme.colors.primary,
            onPress: () => alert("A carregar...")
          },
          { 
            icon: 'phone-outline', 
            label: t('profile.actions.supervisor'), 
            color: theme.colors.primary,
            onPress: () => alert("A ligar...")
          },
        ];
      case 'Cleaning':
        return [
          ...baseActions,
          { 
            icon: 'clipboard-list', 
            label: 'Lista de Tasks', 
            color: theme.colors.primary,
            onPress: () => navigation.navigate('Tasks') // <-- Navega para tasks
          },
          { 
            icon: 'map-marker-path', 
            label: 'Rota Otimizada', 
            color: '#3B82F6',
            onPress: () => {
              Alert.alert(
                "Rota Calculada",
                "Seguir: WC Piso 1 → Área Comercial → Gate 5",
                [{ text: "OK", onPress: () => {
                  alert("Rota mostrada no mapa!");
                }}]
              );
            }
          },
          { 
            icon: 'truck-outline', 
            label: 'Pedir Suprimentos', 
            color: '#F59E0B',
            onPress: () => {
              Alert.prompt(
                "Pedir Suprimentos",
                "Quantidade e item:",
                (text) => {
                  if (text) {
                    alert(`Pedido enviado: ${text}`);
                  }
                }
              );
            }
          },
        ];
      case 'Supervisor':
        return [
          ...baseActions,
          { 
            icon: 'account-group', 
            label: 'Gerir Equipa', 
            color: theme.colors.primary,
            onPress: () => alert("Abrir gestão...")
          },
          { 
            icon: 'chart-box', 
            label: 'Relatórios', 
            color: '#3B82F6',
            onPress: () => alert("Gerar relatório...")
          },
          { 
            icon: 'radio-handheld', 
            label: 'Comunicação', 
            color: '#F59E0B',
            onPress: () => alert("Abrir rádio...")
          },
        ];
      default:
        return baseActions;
    }
  };

  // Avatar color por role
  const getAvatarColor = () => {
    switch(user?.role) {
      case 'Security': return theme.colors.primary;
      case 'Cleaning': return '#10B981';
      case 'Supervisor': return '#F59E0B';
      default: return theme.colors.primary;
    }
  };

  // Icon do avatar por role
  const getAvatarIcon = () => {
    switch(user?.role) {
      case 'Security': return 'shield-account';
      case 'Cleaning': return 'broom';
      case 'Supervisor': return 'account-tie';
      default: return 'account';
    }
  };

  // ========== DADOS ==========
  const STATS = getStatsByRole();
  const KPI_PROGRESS = getKpisByRole();
  const CRITICAL_ZONES = getCriticalZonesByRole();
  const PEAK_TIMES = getPeakTimesByRole();
  const RESPONDER_PERFORMANCE = getTeamPerformance();
  const QUICK_ACTIONS = getQuickActionsByRole();
  const AVATAR_COLOR = getAvatarColor();
  const AVATAR_ICON = getAvatarIcon();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* CARD DE PERFIL */}
        <Surface style={styles.profileCard} elevation={2}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatarContainer, { backgroundColor: AVATAR_COLOR }]}>
              <MaterialCommunityIcons name={AVATAR_ICON as any} size={48} color="white" />
              <View style={[styles.statusDot, { backgroundColor: onDuty ? '#10B981' : '#9CA3AF' }]} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user?.email ? user.email.split('@')[0] : `${user?.role} Officer`}
              </Text>
              <Text style={[styles.userRole, { color: AVATAR_COLOR }]}>
                {user?.role ? user.role.toUpperCase() : 'OFFICER'}
              </Text>
              
              <View style={styles.tagsRow}>
                <TouchableOpacity 
                  style={[styles.dutyTag, onDuty ? styles.dutyOn : styles.dutyOff]}
                  onPress={() => setOnDuty(!onDuty)}
                >
                  <View style={[styles.miniDot, { backgroundColor: onDuty ? '#10B981' : '#6B7280' }]} />
                  <Text style={[styles.dutyText, { color: onDuty ? '#10B981' : '#6B7280' }]}>
                    {onDuty ? t('profile.duty_on') : t('profile.duty_off')}
                  </Text>
                </TouchableOpacity>
                <View style={styles.locationTag}>
                  <MaterialCommunityIcons name="stadium" size={12} color="#3B82F6" />
                  <Text style={styles.locationText}>Dragão</Text>
                </View>
              </View>
            </View>
          </View>
          <Divider style={{ marginVertical: 20 }} />
          <View style={styles.statsContainer}>
            {STATS.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Surface>

        {/* AÇÕES RÁPIDAS */}
        <Text style={styles.sectionTitle}>{t('profile.actions.title')}</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action, index) => (
            <TouchableOpacity 
              key={index}
              style={[styles.actionCard, { borderColor: action.color }]} 
              onPress={action.onPress}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${action.color}15` }]}>
                <MaterialCommunityIcons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {user?.role === 'Cleaning' && (
          <>
            <Text style={styles.sectionTitle}>MINHAS TASKS</Text>
            <Surface style={styles.statsCard} elevation={1}>
              <View style={styles.taskStats}>
                <View style={styles.taskStat}>
                  <Text style={styles.taskNumber}>3</Text>
                  <Text style={styles.taskLabel}>Pendentes</Text>
                </View>
                <View style={styles.taskStat}>
                  <Text style={styles.taskNumber}>12</Text>
                  <Text style={styles.taskLabel}>Hoje</Text>
                </View>
                <View style={styles.taskStat}>
                  <Text style={styles.taskNumber}>87%</Text>
                  <Text style={styles.taskLabel}>Eficiência</Text>
                </View>
              </View>
            </Surface>
          </>
        )}

        {/* ANALYTICS (apenas Supervisor vê analytics completos) */}
        {(user?.role === 'Supervisor' || user?.role === 'Security') && (
          <>
            <Text style={styles.sectionTitle}>
              {user?.role === 'Supervisor' 
                ? t('profile.analytics.title_stats') 
                : 'ESTATÍSTICAS'}
            </Text>
            <Surface style={styles.statsCard} elevation={1}>
              
              <Text style={styles.subTitle}>
                {user?.role === 'Supervisor' 
                  ? t('profile.analytics.critical_zones') 
                  : 'ZONAS IMPORTANTES'}
              </Text>
              <View style={styles.zonesGrid}>
                {CRITICAL_ZONES.map(zone => (
                  <View key={zone.id} style={[styles.zoneBox, { backgroundColor: zone.color + '15', borderColor: zone.color }]}>
                    <Text style={[styles.zoneId, { color: zone.color }]}>{zone.id}</Text>
                    <Text style={[styles.zoneValue, { color: theme.colors.text }]}>{zone.value}</Text>
                    <Text style={styles.zoneLabel}>{zone.label}</Text>
                  </View>
                ))}
              </View>

              <Divider style={{ marginVertical: 24 }} />

              <Text style={styles.subTitle}>
                {user?.role === 'Supervisor' 
                  ? t('profile.analytics.peak_times') 
                  : 'HORÁRIOS DE PICO'}
              </Text>
              <View style={{ gap: 20 }}>
                {PEAK_TIMES.map((item, index) => (
                  <View key={index}>
                    <View style={styles.timeHeader}>
                      <Text style={styles.timeLabel}>{item.time}</Text>
                      <Text style={[styles.timeCount, {color: item.color}]}>{item.count} {user?.role === 'Cleaning' ? 'tasks' : 'inc.'}</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${item.pct * 100}%`, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>

              {/* PERFORMANCE DA EQUIPA (apenas Supervisor) */}
              {user?.role === 'Supervisor' && RESPONDER_PERFORMANCE.length > 0 && (
                <>
                  <Divider style={{ marginVertical: 24 }} />
                  <Text style={styles.subTitle}>{t('profile.analytics.team_perf')}</Text>
                  <View style={{ gap: 16 }}>
                    {RESPONDER_PERFORMANCE.map((team) => (
                      <View key={team.id} style={styles.teamRow}>
                        <View style={{flex: 1}}>
                          <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                            <Text style={[styles.teamId, {color: team.color}]}>{team.id}</Text>
                            <Text style={styles.teamName}>{team.team}</Text>
                          </View>
                          <Text style={styles.teamStats}>{team.resolved} res. • {team.avg}</Text>
                        </View>
                        <View style={{alignItems: 'flex-end'}}>
                          <Text style={[styles.teamRating, {color: team.color}]}>{team.rating}%</Text>
                          <Text style={styles.ratingLabel}>rating</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </Surface>
          </>
        )}

        {/* KPIs (todos os roles vêem, mas com dados diferentes) */}
        <Text style={styles.sectionTitle}>
          {user?.role === 'Supervisor' 
            ? t('profile.analytics.kpi_progress') 
            : 'MEUS OBJETIVOS'}
        </Text>
        <Surface style={styles.statsCard} elevation={1}>
          <View style={{ gap: 20 }}>
            {KPI_PROGRESS.map((kpi, index) => (
              <View key={index}>
                <View style={styles.timeHeader}>
                  <Text style={styles.timeLabel}>{kpi.label}</Text>
                  <Text style={[styles.timeCount, {color: kpi.color}]}>{kpi.value}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${kpi.pct * 100}%`, backgroundColor: kpi.color }]} />
                </View>
              </View>
            ))}
          </View>
        </Surface>

        {/* PREFERÊNCIAS (comum a todos) */}
        <Text style={styles.sectionTitle}>{t('profile.preferences.title')}</Text>
        <Surface style={styles.preferencesCard} elevation={1}>
          <View style={styles.prefHeader}>
            <MaterialCommunityIcons name="web" size={20} color={theme.colors.primary} />
            <Text style={styles.prefTitle}>Idioma / Language</Text>
          </View>
          
          <View style={styles.langContainer}>
            <TouchableOpacity 
              onPress={() => toggleLanguage('PT')} 
              style={[styles.langBtn, i18n.language === 'PT' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, i18n.language === 'PT' && styles.langTextActive]}>Português</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => toggleLanguage('EN')} 
              style={[styles.langBtn, i18n.language === 'EN' && styles.langBtnActive]}
            >
              <Text style={[styles.langText, i18n.language === 'EN' && styles.langTextActive]}>English</Text>
            </TouchableOpacity>
          </View>

          <Divider style={{marginVertical: 16}}/>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('profile.preferences.push')}</Text>
            <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: theme.colors.primary }} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('profile.preferences.sound')}</Text>
            <Switch value={soundEnabled} onValueChange={setSoundEnabled} trackColor={{ true: theme.colors.primary }} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('profile.preferences.vibration')}</Text>
            <Switch value={vibrationEnabled} onValueChange={setVibrationEnabled} trackColor={{ true: theme.colors.primary }} />
          </View>
        </Surface>

        {/* LOGOUT */}
        <View style={styles.logoutContainer}>
          <AppButton 
            title={t('profile.logout')} 
            onPress={logout}
            mode="outlined"
            icon="logout"
            style={{ borderColor: theme.colors.error, borderWidth: 1 }}
          />
          <Text style={styles.versionText}>OpsLite v1.0.2 • {user?.role || 'User'}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  
  // Perfil
  profileCard: { backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  statusDot: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 3, 
    borderColor: 'white' 
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text },
  userRole: { 
    fontSize: 12, 
    marginBottom: 8, 
    fontWeight: '800', 
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  dutyTag: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1 
  },
  dutyOn: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  dutyOff: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  dutyText: { fontSize: 12, fontWeight: 'bold' },
  locationTag: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#3B82F6', 
    backgroundColor: '#EFF6FF' 
  },
  locationText: { fontSize: 12, color: '#3B82F6', fontWeight: '500' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' },
  
  // Seções
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: theme.colors.textSecondary, 
    marginBottom: 12, 
    letterSpacing: 1, 
    marginLeft: 4, 
    marginTop: 8 
  },
  
  // Ações
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  actionCard: { 
    width: '48%', 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center', 
    borderWidth: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2, 
    marginBottom: 12 
  },
  iconCircle: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  actionText: { fontSize: 14, fontWeight: '600', color: theme.colors.text, textAlign: 'center' },
  
  // Stats Card
  statsCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 24 },
  subTitle: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 16 },
  
  // Zonas
  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  zoneBox: { 
    width: '23%', 
    paddingVertical: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12 
  },
  zoneId: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  zoneValue: { fontSize: 16, fontWeight: 'bold' },
  zoneLabel: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  
  // Progress bars
  timeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  timeLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  timeCount: { fontSize: 13, fontWeight: 'bold' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, width: '100%' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  // Team performance
  teamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamId: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  teamName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  teamStats: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  teamRating: { fontSize: 16, fontWeight: 'bold' },
  ratingLabel: { fontSize: 10, color: theme.colors.textSecondary },
  
  // Preferências
  preferencesCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24 },
  prefHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  prefTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  
  // Idioma
  langContainer: { flexDirection: 'row', gap: 12 },
  langBtn: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    alignItems: 'center' 
  },
  langBtnActive: { backgroundColor: '#EEF2FF', borderColor: theme.colors.primary },
  langText: { fontWeight: '600', color: '#64748B' },
  langTextActive: { color: theme.colors.primary },
  
  // Toggles
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 14, color: theme.colors.text },
  divider: { backgroundColor: '#E2E8F0' },
  
  // Logout
  logoutContainer: { marginBottom: 20 },
  versionText: { textAlign: 'center', color: '#CBD5E1', fontSize: 12, marginTop: 16 },

   taskStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskStat: {
    alignItems: 'center',
    flex: 1,
  },
  taskNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  taskLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },


});