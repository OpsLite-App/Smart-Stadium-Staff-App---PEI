import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import AppHeader from '../components/AppHeader';
import AppButton from '../components/AppButton';
import { useNavigation } from '@react-navigation/native';
import { useMapStore } from '../stores/useMapStore';
import { useAuthStore } from '../stores/useAuthStore'; // ← IMPORT ADICIONADO

const INCIDENT = {
  id: '1',
  title: 'Desmaio na Bancada Norte',
  location: 'Setor 12, Fila C',
  priority: 'HIGH',
  description: 'Adepto masculino, aprox 40 anos. Reportado por Steward #42. Necessita equipa médica urgente.',
  coords: { latitude: 41.1622, longitude: -8.5838 },
  timeline: [
    { time: '14:32', text: 'Incidente Reportado (Steward 42)' },
    { time: '14:33', text: 'Validado por Supervisor (Cam 04)' },
    { time: '14:35', text: 'Equipa Médica Notificada' },
  ]
};

export default function IncidentDetailsScreen() {
  const navigation = useNavigation<any>();
  const requestRoute = useMapStore(state => state.requestRoute);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore(); // ← NOVA LINHA

  const handleRoute = () => {
    requestRoute(INCIDENT.coords);
    navigation.navigate('App', { screen: 'Mapa' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader 
        title="Detalhes do Incidente" 
        subtitle={`ID: #${INCIDENT.id}`} 
        showBack={true}
        onBackPress={() => navigation.goBack()} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Surface style={styles.priorityCard} elevation={1}>
          <View style={styles.priorityBadge}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="white" />
            <Text style={styles.priorityText}>{INCIDENT.priority} PRIORITY</Text>
          </View>
          <Text style={styles.title}>{INCIDENT.title}</Text>
          <Text style={styles.location}>📍 {INCIDENT.location}</Text>
        </Surface>

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              ...INCIDENT.coords,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={INCIDENT.coords} pinColor={theme.colors.error} />
          </MapView>
          <TouchableOpacity style={styles.expandMapBtn}>
            <MaterialCommunityIcons name="arrow-expand-all" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]} >
            <MaterialCommunityIcons name="check-circle-outline" size={24} color="white" />
            <Text style={styles.actionText}>ACEITAR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={handleRoute}>
            <MaterialCommunityIcons name="navigation" size={24} color="white" />
            <Text style={styles.actionText}>ROTA</Text>
          </TouchableOpacity>
          
          {/* ✅ BOTÃO DE CHAT ATUALIZADO */}
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]} 
            onPress={() => navigation.navigate('Chat', { 
              initialGroup: user?.role === 'Security' ? 'security' : 
                           user?.role === 'Cleaning' ? 'cleaning' : 'all'
            })}
          >
            <MaterialCommunityIcons name="chat-processing" size={24} color="white" />
            <Text style={styles.actionText}>CHAT</Text>
          </TouchableOpacity>
        </View>

        <Surface style={styles.infoCard} elevation={1}>
          <Text style={styles.sectionTitle}>DESCRIÇÃO</Text>
          <Text style={styles.description}>{INCIDENT.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>TIMELINE</Text>
          {INCIDENT.timeline.map((item, index) => (
            <View key={index} style={styles.timelineItem}>
              <Text style={styles.timelineTime}>{item.time}</Text>
              <View style={styles.timelineDot} />
              <Text style={styles.timelineText}>{item.text}</Text>
            </View>
          ))}
        </Surface>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <AppButton 
          title="MARCAR COMO RESOLVIDO" 
          onPress={() => {}} 
          mode="outlined" 
          style={{ borderColor: theme.colors.primary }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  // Prioridade
  priorityCard: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    backgroundColor: theme.colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  priorityText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
  location: { fontSize: 16, color: theme.colors.textSecondary, marginTop: 4 },

  // Mapa
  mapContainer: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  map: { width: '100%', height: '100%' },
  expandMapBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 8,
  },

  // Ações
  actionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  actionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  // Info
  infoCard: { padding: 20, backgroundColor: 'white', borderRadius: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8 },
  description: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  
  // Timeline
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timelineTime: { width: 45, fontSize: 12, fontWeight: 'bold', color: theme.colors.primary },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginHorizontal: 10 },
  timelineText: { flex: 1, fontSize: 13, color: '#4B5563' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16, 
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});