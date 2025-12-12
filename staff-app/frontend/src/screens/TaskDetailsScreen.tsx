// screens/TaskDetailsScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import AppHeader from '../components/AppHeader';
import AppButton from '../components/AppButton';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function TaskDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  
  const { taskId, type, title, location } = route.params || {};
  
  // Dados mock baseados no tipo
  const getTaskDetails = () => {
    switch(type) {
      case 'bin':
        return {
          priority: 'HIGH',
          description: 'Lixeira com capacidade a 95%. Necessita esvaziamento urgente.',
          icon: 'trash-can',
          color: theme.colors.error,
          instructions: [
            'Verificar nível de enchimento',
            'Substituir saco de lixo',
            'Limpar exterior da lixeira',
            'Registar no sistema'
          ]
        };
      case 'maintenance':
        return {
          priority: 'MEDIUM', 
          description: 'Vazamento no lavatório. Necessita intervenção de manutenção.',
          icon: 'water-pump',
          color: '#3B82F6',
          instructions: [
            'Identificar origem do vazamento',
            'Isolar área se necessário',
            'Chamar equipa de manutenção',
            'Colocar sinalização'
          ]
        };
      default:
        return {
          priority: 'LOW',
          description: 'Task de limpeza geral.',
          icon: 'broom',
          color: '#10B981',
          instructions: ['Executar limpeza padrão']
        };
    }
  };

  const details = getTaskDetails();
  const coords = { latitude: 41.1615, longitude: -8.5840 }; // Coordenadas mock

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader 
        title="Detalhes da Task" 
        subtitle={`ID: #${taskId}`} 
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Surface style={styles.priorityCard} elevation={1}>
          <View style={[styles.priorityBadge, { backgroundColor: details.color }]}>
            <MaterialCommunityIcons name={details.icon as any} size={20} color="white" />
            <Text style={styles.priorityText}>{details.priority} PRIORITY</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.location}>📍 {location}</Text>
        </Surface>

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              ...coords,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker coordinate={coords} pinColor={details.color} />
          </MapView>
        </View>

        <Surface style={styles.infoCard} elevation={1}>
          <Text style={styles.sectionTitle}>DESCRIÇÃO</Text>
          <Text style={styles.description}>{details.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>INSTRUÇÕES</Text>
          {details.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <View style={[styles.numberCircle, { backgroundColor: details.color }]}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </Surface>

        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]}>
            <MaterialCommunityIcons name="check-circle" size={24} color="white" />
            <Text style={styles.actionText}>INICIAR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}>
            <MaterialCommunityIcons name="map-marker-path" size={24} color="white" />
            <Text style={styles.actionText}>ROTA</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}>
            <MaterialCommunityIcons name="chat" size={24} color="white" />
            <Text style={styles.actionText}>CHAT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <AppButton 
          title="MARCAR COMO CONCLUÍDO" 
          onPress={() => {
            alert(`Task ${taskId} concluída!`);
            navigation.goBack();
          }}
          mode="contained"
          style={{ backgroundColor: '#10B981' }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  priorityCard: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  priorityText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, textAlign: 'center' },
  location: { fontSize: 16, color: theme.colors.textSecondary, marginTop: 4 },

  mapContainer: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: { width: '100%', height: '100%' },

  infoCard: { 
    padding: 20, 
    backgroundColor: 'white', 
    borderRadius: 12,
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: theme.colors.textSecondary, 
    marginBottom: 12 
  },
  description: { 
    fontSize: 14, 
    color: theme.colors.text, 
    lineHeight: 22 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#E5E7EB', 
    marginVertical: 16 
  },
  
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },

  actionsGrid: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 16 
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  actionText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 12 
  },

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