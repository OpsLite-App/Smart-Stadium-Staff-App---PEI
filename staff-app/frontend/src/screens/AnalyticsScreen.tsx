import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, SegmentedButtons } from 'react-native-paper';
import { theme } from '../theme';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const [timeRange, setTimeRange] = useState('today');
  const [activeTab, setActiveTab] = useState('overview');

  // Dados para gráficos
  const responseTimeData = {
    labels: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    datasets: [{
      data: [3.2, 4.1, 3.8, 2.9, 3.5, 4.2],
      color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
      strokeWidth: 2
    }]
  };

  const incidentData = {
    labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
    datasets: [{
      data: [12, 8, 15, 10, 18, 24, 16]
    }]
  };

  const zoneData = [
    { name: 'Portão 01', incidents: 24, color: '#4F46E5', legendFontColor: '#6B7280' },
    { name: 'Área Comercial', incidents: 18, color: '#10B981', legendFontColor: '#6B7280' },
    { name: 'Bancada Norte', incidents: 15, color: '#F59E0B', legendFontColor: '#6B7280' },
    { name: 'WC Piso 2', incidents: 12, color: '#EF4444', legendFontColor: '#6B7280' },
    { name: 'Saída Sul', incidents: 8, color: '#8B5CF6', legendFontColor: '#6B7280' },
  ];

  const kpiData = [
    { label: 'Tempo Médio Resposta', current: '3:42', target: '4:00', progress: 0.92, color: '#10B981' },
    { label: 'Alertas Resolvidos', current: '98%', target: '95%', progress: 1.03, color: '#3B82F6' },
    { label: 'Satisfação Equipa', current: '88%', target: '85%', progress: 1.04, color: '#F59E0B' },
    { label: 'Eficiência Limpeza', current: '92%', target: '90%', progress: 1.02, color: '#8B5CF6' },
  ];

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#4F46E5' }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <Surface style={styles.headerCard} elevation={1}>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="chart-box" size={32} color={theme.colors.primary} />
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle}>Analytics Dashboard</Text>
              <Text style={styles.headerSubtitle}>Dados em tempo real • Atualizado há 2 min</Text>
            </View>
          </View>
          
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'today', label: 'Hoje' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mês' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* KPIs em Destaque */}
        <View style={styles.statsGrid}>
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons name="timer" size={24} color="#4F46E5" />
            <Text style={styles.statValue}>3:42</Text>
            <Text style={styles.statLabel}>Tempo Resp.</Text>
            <Text style={styles.statTrend}>↓ 12%</Text>
          </Surface>
          
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#10B981" />
            <Text style={styles.statValue}>98%</Text>
            <Text style={styles.statLabel}>Resolvidos</Text>
            <Text style={styles.statTrend}>↑ 3%</Text>
          </Surface>
          
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons name="account-group" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Staff Ativo</Text>
            <Text style={styles.statTrend}>→ Estável</Text>
          </Surface>
          
          <Surface style={styles.statCard} elevation={1}>
            <MaterialCommunityIcons name="alert" size={24} color="#EF4444" />
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Alertas Hoje</Text>
            <Text style={styles.statTrend}>↑ 20%</Text>
          </Surface>
        </View>

        {/* Tabs de Navegação */}
        <View style={styles.tabsContainer}>
          {['overview', 'response', 'zones', 'teams'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'overview' ? 'Visão Geral' :
                 tab === 'response' ? 'Tempo Resp.' :
                 tab === 'zones' ? 'Zonas' : 'Equipas'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gráfico de Tempo de Resposta */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Tempo de Resposta por Hora</Text>
            <Text style={styles.chartSubtitle}>Média: 3.6 min • Meta: 4.0 min</Text>
          </View>
          <LineChart
            data={responseTimeData}
            width={screenWidth - 48}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </Surface>

        {/* Gráfico de Incidentes por Zona */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Incidentes por Zona (Semana)</Text>
            <Text style={styles.chartSubtitle}>Total: 103 incidentes</Text>
          </View>
          <BarChart
            data={incidentData}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
          />
        </Surface>

        {/* Gráfico de Pizza - Zonas Críticas */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Distribuição de Incidentes</Text>
            <Text style={styles.chartSubtitle}>Top 5 zonas mais críticas</Text>
          </View>
          <PieChart
            data={zoneData}
            width={screenWidth - 48}
            height={200}
            chartConfig={chartConfig}
            accessor="incidents"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </Surface>

        {/* KPIs Detalhados */}
        <Surface style={styles.kpiCard} elevation={1}>
          <Text style={styles.sectionTitle}>METAS E KPIs</Text>
          {kpiData.map((kpi, index) => (
            <View key={index} style={styles.kpiItem}>
              <View style={styles.kpiInfo}>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <View style={styles.kpiValues}>
                  <Text style={styles.kpiCurrent}>{kpi.current}</Text>
                  <Text style={styles.kpiTarget}> / {kpi.target} meta</Text>
                </View>
              </View>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${Math.min(kpi.progress * 100, 100)}%`, backgroundColor: kpi.color }]} />
                <Text style={[styles.kpiProgress, { color: kpi.color }]}>
                  {kpi.progress > 1 ? '+' : ''}{Math.round((kpi.progress - 1) * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </Surface>

        {/* Insights */}
        <Surface style={styles.insightsCard} elevation={1}>
          <View style={styles.insightsHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#F59E0B" />
            <Text style={styles.insightsTitle}>INSIGHTS RECOMENDADOS</Text>
          </View>
          <View style={styles.insightItem}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>Pico às 21:00</Text> - Aumentar staff no Portão 05
            </Text>
          </View>
          <View style={styles.insightItem}>
            <MaterialCommunityIcons name="trending-up" size={20} color="#10B981" />
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>Eficiência +12%</Text> - Equipa de limpeza superando metas
            </Text>
          </View>
          <View style={styles.insightItem}>
            <MaterialCommunityIcons name="clock-alert" size={20} color="#F59E0B" />
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>Tempo resposta ↑</Text> - Treinar nova equipa de segurança
            </Text>
          </View>
        </Surface>

        {/* Botão de Exportar */}
        <TouchableOpacity style={styles.exportButton}>
          <MaterialCommunityIcons name="file-export" size={20} color="white" />
          <Text style={styles.exportButtonText}>EXPORTAR RELATÓRIO</Text>
        </TouchableOpacity>

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
    marginBottom: 16,
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
  segmentedButtons: {
    marginTop: 8,
  },
  
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  statTrend: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  chartSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
  
  kpiCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 20,
    letterSpacing: 1,
  },
  kpiItem: {
    marginBottom: 20,
  },
  kpiInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  kpiValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  kpiCurrent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  kpiTarget: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  kpiProgress: {
    position: 'absolute',
    right: 0,
    top: -20,
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  insightsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  insightHighlight: {
    fontWeight: 'bold',
    color: '#1F2937',
  },
  
  exportButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  exportButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});