import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { theme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProgressBar, Surface } from 'react-native-paper';

import AlertCard, { AlertType } from '../components/AlertCard';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';

const ALL_MOCK_ALERTS = [
  {
    id: '1',
    type: 'sos' as AlertType,
    title: 'Desmaio na Bancada Norte',
    location: 'Setor 12, Fila C',
    time: 'Há 2 min',
    description: 'Adepto masculino, aprox 40 anos. Necessita equipa médica urgente.',
    priority: 'HIGH' as const,
  },
  {
    id: '2',
    type: 'crowd' as AlertType,
    title: 'Densidade Elevada Gate 5',
    location: 'Gate 05 - Entrada Principal',
    time: 'Há 5 min',
    description: 'Fila a bloquear a saída de emergência lateral.',
    priority: 'MEDIUM' as const,
  },
  {
    id: '3',
    type: 'bin' as AlertType,
    title: 'Lixeira Cheia - Zona Comercial',
    location: 'Área Comercial, Piso 1',
    time: 'Há 15 min',
    description: 'Lixeira com capacidade a 95%. Necessita esvaziamento.',
    priority: 'MEDIUM' as const,
  },
  {
    id: '4',
    type: 'maintenance' as AlertType,
    title: 'Vazamento no WC Masculino',
    location: 'WC Masculino - Piso 2',
    time: 'Há 25 min',
    description: 'Vazamento no lavatório. Necessita intervenção de manutenção.',
    priority: 'LOW' as const,
  },
  {
    id: '5',
    type: 'sos' as AlertType,
    title: 'Confusão na Saída Sul',
    location: 'Saída Sul, Portão 3',
    time: 'Há 8 min',
    description: 'Discussão entre adeptos. Intervenção segurança necessária.',
    priority: 'HIGH' as const,
  },
];

const GATES = [
  { id: 'G01', value: 0.45, label: '45%' },
  { id: 'G02', value: 0.78, label: '78%' },
  { id: 'G03', value: 0.92, label: '92%' },
  { id: 'G04', value: 0.58, label: '58%' },
  { id: 'G05', value: 0.88, label: '88%' },
  { id: 'G06', value: 0.34, label: '34%' },
  { id: 'G07', value: 0.71, label: '71%' },
  { id: 'G08', value: 0.52, label: '52%' },
];

export default function AlertsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  
  // Estado local para todos os alertas
  const [allAlerts, setAllAlerts] = useState(ALL_MOCK_ALERTS);

  // --- FUNÇÕES HELPER POR ROLE ---

  const getStatsByRole = () => {
    if (!user) return [];
    
    switch(user.role) {
      case 'Security':
        return [
          { label: 'Portões', value: '8', icon: 'door-sliding', color: theme.colors.primary },
          { label: 'Pessoas', value: '12.4K', icon: 'account-group', color: '#10B981' },
          { label: 'SOS Ativos', value: '2', icon: 'alert-circle', color: theme.colors.error },
          { label: 'Zonas Críticas', value: '1', icon: 'map-marker-radius', color: '#F59E0B' },
        ];
      case 'Cleaning':
        return [
          { label: 'Lixeiras Cheias', value: '3', icon: 'trash-can', color: theme.colors.primary },
          { label: 'Zonas Limpas', value: '12/20', icon: 'check-circle', color: '#10B981' },
          { label: 'Tasks Pendentes', value: '7', icon: 'clipboard-list', color: theme.colors.error },
          { label: 'Área Total', value: '5.2K m²', icon: 'floor-plan', color: '#F59E0B' },
        ];
      case 'Supervisor':
        return [
          { label: 'Staff Ativo', value: '24', icon: 'account-group', color: theme.colors.primary },
          { label: 'SOS Resolvidos', value: '98%', icon: 'shield-check', color: '#10B981' },
          { label: 'Tempo Médio Resp.', value: '3:42', icon: 'timer', color: theme.colors.error },
          { label: 'Zonas Monitoradas', value: '15', icon: 'eye', color: '#F59E0B' },
        ];
      default:
        return [];
    }
  };

  const getFilteredAlerts = () => {
    if (!user) return [];
    
    return allAlerts.filter(alert => {
      switch(user.role) {
        case 'Security':
          // Segurança vê apenas alertas de segurança: sos e crowd
          return alert.type === 'sos' || alert.type === 'crowd';
        case 'Cleaning':
          // Limpeza vê apenas alertas de limpeza: bin e maintenance
          return alert.type === 'bin' || alert.type === 'maintenance';
        case 'Supervisor':
          // Supervisor vê todos os alertas
          return true;
        default:
          return false;
      }
    });
  };

  const getSectionTitle = () => {
    if (!user) return 'ALERTAS PRIORITÁRIOS';
    
    switch(user.role) {
      case 'Security':
        return 'ALERTAS DE SEGURANÇA';
      case 'Cleaning':
        return 'TAREFAS DE LIMPEZA';
      case 'Supervisor':
        return 'ALERTAS PRIORITÁRIOS';
      default:
        return 'ALERTAS';
    }
  };

  const getDashboardTitle = () => {
    if (!user) return 'Security Dashboard';
    
    switch(user.role) {
      case 'Security':
        return 'Security Dashboard';
      case 'Cleaning':
        return 'Cleaning Operations';
      case 'Supervisor':
        return 'Supervisor Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getDashboardSubtitle = () => {
    if (!user) return 'Sistema Operacional • Live';
    
    switch(user.role) {
      case 'Security':
        return 'Sistema Operacional • Live';
      case 'Cleaning':
        return 'Operações de Limpeza • Ativo';
      case 'Supervisor':
        return 'Gestão de Operações • Live';
      default:
        return 'Sistema Operacional';
    }
  };

  const getGatesSectionTitle = () => {
    if (!user) return 'ESTADO DOS PORTÕES (LIVE)';
    
    switch(user.role) {
      case 'Security':
        return 'ESTADO DOS PORTÕES (LIVE)';
      case 'Cleaning':
        return 'ZONAS DE LIMPEZA (STATUS)';
      case 'Supervisor':
        return 'MONITORIZAÇÃO DE ZONAS';
      default:
        return 'STATUS';
    }
  };

  const getGatesData = () => {
    if (!user) return GATES;
    
    if (user.role === 'Cleaning') {
      // Para limpeza, mostrar zonas em vez de portões
      return [
        { id: 'ZN1', value: 0.85, label: '85%' },
        { id: 'ZN2', value: 0.45, label: '45%' },
        { id: 'ZN3', value: 0.92, label: '92%' },
        { id: 'ZN4', value: 0.68, label: '68%' },
        { id: 'ZN5', value: 0.33, label: '33%' },
        { id: 'ZN6', value: 0.77, label: '77%' },
        { id: 'ZN7', value: 0.51, label: '51%' },
        { id: 'ZN8', value: 0.89, label: '89%' },
      ];
    }
    
    return GATES;
  };

  // --- LÓGICA DE NEGÓCIO ---

  const handleAccept = (id: string) => {
    // Para supervisor, a mensagem é diferente
    const message = user?.role === 'Supervisor' 
      ? `Task ${id} delegada à equipa!`
      : `Missão ${id} aceite! A notificar central...`;
    
    alert(message);
    
    // Remover alerta da lista após aceitar (simulação)
    setAllAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const getProgressColor = (value: number) => {
    if (value >= 0.9) return theme.colors.error;      // Crítico (>90%)
    if (value >= 0.7) return '#F59E0B';               // Atenção (>70%)
    return '#10B981';                                 // Seguro (Verde)
  };

  const shouldShowGates = user?.role !== 'Cleaning'; // Limpeza não vê portões
  const shouldShowAcceptButton = user?.role !== 'Supervisor'; // Supervisor não aceita, delega

  // --- DADOS COMPUTADOS ---
  const stats = getStatsByRole();
  const filteredAlerts = getFilteredAlerts();
  const gatesData = getGatesData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <AppHeader 
        title={getDashboardTitle()} 
        subtitle={getDashboardSubtitle()} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Surface key={index} style={styles.statCard} elevation={1}>
              <View>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
              <View style={[styles.statIconBox, { backgroundColor: `${stat.color}20` }]}> 
                <MaterialCommunityIcons name={stat.icon as any} size={24} color={stat.color} />
              </View>
            </Surface>
          ))}
        </View>

        {/* SECTION HEADER: ALERTAS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
          {user?.role === 'Supervisor' && (
            <Text style={styles.alertCount}>
              {filteredAlerts.length} alertas ativos
            </Text>
          )}
        </View>

        {/* LISTA DE ALERTAS FILTRADA */}
        <View style={styles.alertsList}>
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((item) => (
              <AlertCard
                key={item.id}
                type={item.type}
                title={item.title}
                location={item.location}
                time={item.time}
                description={item.description}
                priority={item.priority}
                // ✅ CORREÇÃO AQUI - Use sempre IncidentDetails
                onPress={() => navigation.navigate('IncidentDetails', { 
                  id: item.id,
                  role: user?.role,
                  alertType: item.type,
                  title: item.title,
                  location: item.location,
                  // Adiciona flag para identificar tasks de limpeza
                  isCleaningTask: user?.role === 'Cleaning' && (item.type === 'bin' || item.type === 'maintenance')
                })}
                onAccept={shouldShowAcceptButton ? () => handleAccept(item.id) : undefined}
              />
            ))
          ) : (
            <Surface style={styles.emptyState} elevation={1}>
              <MaterialCommunityIcons 
                name={user?.role === 'Cleaning' ? 'broom' : 'shield-check'} 
                size={48} 
                color={theme.colors.textSecondary} 
              />
              <Text style={styles.emptyStateText}>
                {user?.role === 'Cleaning' 
                  ? 'Sem tarefas de limpeza pendentes'
                  : 'Sem alertas ativos no momento'
                }
              </Text>
            </Surface>
          )}
        </View>

        {/* SECTION HEADER: PORTÕES/ZONAS */}
        {shouldShowGates && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{getGatesSectionTitle()}</Text>
            </View>

            {/* GRID DE PORTÕES/ZONAS */}
            <View style={styles.gatesGrid}>
              {gatesData.map((gate) => {
                const color = getProgressColor(gate.value);
                return (
                  <Surface key={gate.id} style={styles.gateCard} elevation={1}>
                    <View style={styles.gateHeader}>
                      <Text style={styles.gateId}>{gate.id}</Text>
                      <Text style={[styles.gatePercent, { color }]}>{gate.label}</Text>
                    </View>
                    <ProgressBar 
                      progress={gate.value} 
                      color={color} 
                      style={styles.progressBar} 
                    />
                    {/* Legenda para supervisor */}
                    {user?.role === 'Supervisor' && gate.value >= 0.7 && (
                      <Text style={styles.supervisorNote}>
                        {gate.value >= 0.9 ? 'Crítico' : 'Atenção'}
                      </Text>
                    )}
                  </Surface>
                );
              })}
            </View>
          </>
        )}

        {/* SEÇÃO ESPECIAL PARA SUPERVISOR */}
        {user?.role === 'Supervisor' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>EQUIPAS ATIVAS</Text>
            </View>
            <Surface style={styles.teamOverview} elevation={1}>
              <View style={styles.teamRow}>
                <View style={[styles.teamDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={styles.teamText}>Segurança: 12 ativos</Text>
              </View>
              <View style={styles.teamRow}>
                <View style={[styles.teamDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.teamText}>Limpeza: 8 ativos</Text>
              </View>
              <View style={styles.teamRow}>
                <View style={[styles.teamDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.teamText}>Médicos: 4 ativos</Text>
              </View>
            </Surface>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', 
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  statCard: {
    width: '48%', 
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  alertCount: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  
  alertsList: {
    marginBottom: 8,
  },
  
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyStateText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },

  gatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  gateCard: {
    width: '23%', 
    minWidth: 70,
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  gateHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  gateId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  gatePercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    backgroundColor: '#E5E7EB',
  },
  supervisorNote: {
    fontSize: 8,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: 'bold',
  },

  teamOverview: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  teamDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  teamText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
});