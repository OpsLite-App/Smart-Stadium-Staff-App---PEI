// screens/TeamScreen.tsx
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Searchbar, Chip } from 'react-native-paper';
import { theme } from '../theme';

export default function TeamScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Dados da equipa
  const teamMembers = [
    {
      id: '1',
      name: 'João Silva',
      role: 'Security',
      status: 'online',
      shift: 'Manhã (06:00-14:00)',
      incidentsResolved: 42,
      avgResponse: '3:12',
      rating: 95,
      location: 'Portão 01',
      lastActive: 'Há 2 min',
    },
    {
      id: '2',
      name: 'Maria Santos',
      role: 'Cleaning',
      status: 'online',
      shift: 'Tarde (14:00-22:00)',
      incidentsResolved: 38,
      avgResponse: '2:45',
      rating: 98,
      location: 'Área Comercial',
      lastActive: 'Há 5 min',
    },
    {
      id: '3',
      name: 'Carlos Mendes',
      role: 'Supervisor',
      status: 'busy',
      shift: 'Noite (22:00-06:00)',
      incidentsResolved: 56,
      avgResponse: '2:58',
      rating: 96,
      location: 'Sala Comando',
      lastActive: 'Há 1 min',
    },
    {
      id: '4',
      name: 'Ana Rodrigues',
      role: 'Security',
      status: 'offline',
      shift: 'Manhã (06:00-14:00)',
      incidentsResolved: 31,
      avgResponse: '3:45',
      rating: 88,
      location: 'Bancada Sul',
      lastActive: 'Há 2 horas',
    },
    {
      id: '5',
      name: 'Pedro Costa',
      role: 'Medical',
      status: 'online',
      shift: 'Tarde (14:00-22:00)',
      incidentsResolved: 28,
      avgResponse: '4:20',
      rating: 92,
      location: 'Posto Médico',
      lastActive: 'Há 10 min',
    },
    {
      id: '6',
      name: 'Sofia Almeida',
      role: 'Cleaning',
      status: 'online',
      shift: 'Manhã (06:00-14:00)',
      incidentsResolved: 45,
      avgResponse: '2:30',
      rating: 99,
      location: 'WC Piso 2',
      lastActive: 'Há 3 min',
    },
  ];

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Security': return '#4F46E5';
      case 'Cleaning': return '#10B981';
      case 'Supervisor': return '#F59E0B';
      case 'Medical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online': return '#10B981';
      case 'busy': return '#F59E0B';
      case 'offline': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    if (activeFilter !== 'all' && member.role !== activeFilter) return false;
    if (searchQuery && !member.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const roleStats = {
    Security: teamMembers.filter(m => m.role === 'Security').length,
    Cleaning: teamMembers.filter(m => m.role === 'Cleaning').length,
    Supervisor: teamMembers.filter(m => m.role === 'Supervisor').length,
    Medical: teamMembers.filter(m => m.role === 'Medical').length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <Surface style={styles.headerCard} elevation={1}>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="account-group" size={32} color={theme.colors.primary} />
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle}>Gestão de Equipa</Text>
              <Text style={styles.headerSubtitle}>{teamMembers.length} membros • {teamMembers.filter(m => m.status === 'online').length} online</Text>
            </View>
          </View>
        </Surface>

        {/* Estatísticas por Role */}
        <View style={styles.statsGrid}>
          {Object.entries(roleStats).map(([role, count]) => (
            <Surface key={role} style={styles.roleStatCard} elevation={1}>
              <View style={[styles.roleIcon, { backgroundColor: `${getRoleColor(role)}15` }]}>
                <MaterialCommunityIcons 
                  name={role === 'Security' ? 'shield-account' : 
                        role === 'Cleaning' ? 'broom' : 
                        role === 'Medical' ? 'medical-bag' : 'account-tie'} 
                  size={20} 
                  color={getRoleColor(role)} 
                />
              </View>
              <Text style={styles.roleCount}>{count}</Text>
              <Text style={styles.roleLabel}>{role}</Text>
              <Text style={[styles.roleStatus, { color: '#10B981' }]}>
                {teamMembers.filter(m => m.role === role && m.status === 'online').length} online
              </Text>
            </Surface>
          ))}
        </View>

        {/* Pesquisa e Filtros */}
        <Surface style={styles.searchCard} elevation={1}>
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textSecondary} />
            <TextInput
                style={styles.searchInput}
                placeholder="Pesquisar membro..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            ) : null}
            </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            {['all', 'Security', 'Cleaning', 'Supervisor', 'Medical'].map((filter) => (
              <Chip
                key={filter}
                selected={activeFilter === filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.filterChip, activeFilter === filter && { backgroundColor: theme.colors.primary }]}
                textStyle={[styles.filterText, activeFilter === filter && { color: 'white' }]}
              >
                {filter === 'all' ? 'Todos' : filter}
              </Chip>
            ))}
          </ScrollView>
        </Surface>

        {/* Lista de Membros */}
        <Surface style={styles.teamListCard} elevation={1}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>MEMBROS DA EQUIPA</Text>
            <TouchableOpacity style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={16} color="white" />
              <Text style={styles.addButtonText}>ADICIONAR</Text>
            </TouchableOpacity>
          </View>

          {filteredMembers.map((member) => (
            <Surface key={member.id} style={styles.memberCard} elevation={0}>
              <View style={styles.memberHeader}>
                <View style={styles.memberInfo}>
                  <View style={styles.avatarContainer}>
                    <MaterialCommunityIcons 
                      name={member.role === 'Security' ? 'shield-account' : 
                            member.role === 'Cleaning' ? 'broom' : 
                            member.role === 'Medical' ? 'medical-bag' : 'account-tie'} 
                      size={24} 
                      color="white" 
                    />
                  </View>
                  <View style={styles.memberDetails}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(member.status) }]} />
                    </View>
                    <View style={styles.roleRow}>
                      <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) }]}>
                        <Text style={styles.roleBadgeText}>{member.role.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberLocation}>📍 {member.location}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.memberStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{member.incidentsResolved}</Text>
                    <Text style={styles.statLabel}>Resolvidos</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{member.avgResponse}</Text>
                    <Text style={styles.statLabel}>Tempo médio</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: member.rating > 90 ? '#10B981' : '#F59E0B' }]}>
                      {member.rating}%
                    </Text>
                    <Text style={styles.statLabel}>Rating</Text>
                  </View>
                </View>
              </View>

              <View style={styles.memberFooter}>
                <Text style={styles.shiftText}>⏰ {member.shift}</Text>
                <Text style={styles.lastActive}>Último: {member.lastActive}</Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialCommunityIcons name="message-text" size={16} color={theme.colors.primary} />
                  <Text style={styles.actionButtonText}>Mensagem</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialCommunityIcons name="phone" size={16} color="#10B981" />
                  <Text style={styles.actionButtonText}>Chamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialCommunityIcons name="chart-box" size={16} color="#F59E0B" />
                  <Text style={styles.actionButtonText}>Relatório</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <MaterialCommunityIcons name="cog" size={16} color="#6B7280" />
                  <Text style={styles.actionButtonText}>Gerir</Text>
                </TouchableOpacity>
              </View>
            </Surface>
          ))}
        </Surface>

        {/* Ações Rápidas */}
        <Surface style={styles.quickActionsCard} elevation={1}>
          <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="bell-ring" size={24} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Notificar Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color="#10B981" />
              <Text style={styles.quickActionText}>Horários</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="file-chart" size={24} color="#F59E0B" />
              <Text style={styles.quickActionText}>Relatórios</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons name="account-plus" size={24} color="#8B5CF6" />
              <Text style={styles.quickActionText}>Recrutar</Text>
            </TouchableOpacity>
          </View>
        </Surface>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTexts: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  roleStatCard: {
    width: '23%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 2,
  },
  roleLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  roleStatus: {
    fontSize: 9,
    fontWeight: '600',
  },
  
  searchCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: '#F8FAFC',
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F1F5F9',
  },
  filterText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  
  teamListCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  memberCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  memberLocation: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  
  memberStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  
  memberFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  shiftText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  lastActive: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '600',
       color: theme.colors.text,
  },
  
  quickActionsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '23%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 10,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text,
  },
});