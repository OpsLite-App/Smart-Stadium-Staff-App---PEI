import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity,
  Alert 
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Heatmap, Polyline, Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';

// Componentes
import StaffMarker from '../components/StaffMarker';

// Setores
import { useMapStore } from '../stores/useMapStore';
import { useAuthStore } from '../stores/useAuthStore';

// Dados mock para heatmap
const generateCluster = (centerLat: number, centerLng: number, count: number, spread: number) => {
  const points = [];
  for (let i = 0; i < count; i++) {
    points.push({
      latitude: centerLat + (Math.random() - 0.5) * spread,
      longitude: centerLng + (Math.random() - 0.5) * spread,
      weight: 0.5 + Math.random() * 0.5
    });
  }
  return points;
};


const HEATMAP_POINTS = [
  ...generateCluster(41.1625, -8.5830, 150, 0.0010), 
  ...generateCluster(41.1615, -8.5842, 100, 0.0008), 
  ...generateCluster(41.1610, -8.5845, 80, 0.0009),  
  ...generateCluster(41.1630, -8.5825, 60, 0.0012),  
];

// Dados mock para bins/lixeiras (para role Cleaning)
const BIN_LOCATIONS = [
  { id: 'B01', latitude: 41.1615, longitude: -8.5840, status: 'full' },
  { id: 'B02', latitude: 41.1618, longitude: -8.5832, status: 'medium' },
  { id: 'B03', latitude: 41.1620, longitude: -8.5842, status: 'full' },
  { id: 'B04', latitude: 41.1610, longitude: -8.5845, status: 'empty' },
  { id: 'B05', latitude: 41.1613, longitude: -8.5838, status: 'medium' },
];

// Dados mock para zonas críticas (para role Security/Supervisor)
const CRITICAL_ZONES = [
  { id: 'Z01', latitude: 41.1622, longitude: -8.5838, type: 'crowd' },
  { id: 'Z02', latitude: 41.1610, longitude: -8.5840, type: 'security' },
  { id: 'Z03', latitude: 41.1618, longitude: -8.5830, type: 'emergency' },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showBins, setShowBins] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const navigation = useNavigation<any>();

  const { user } = useAuthStore();
  const staff = useMapStore((state) => state.staff);
  const activeRoute = useMapStore((state) => state.activeRoute); 
  const clearRoute = useMapStore((state) => state.clearRoute);
  const updatePositions = useMapStore((state) => state.updatePositions);

  // --- FILTRAGEM POR ROLE ---
  
  // Staff visível baseado no role
  const visibleStaff = useMemo(() => {
    if (!user) return staff;
    
    switch(user.role) {
      case 'Security':
        // Security vê apenas segurança e supervisores
        return staff.filter(member => 
          member.role === 'Security' || member.role === 'Supervisor'
        );
      case 'Cleaning':
        // Cleaning vê apenas limpeza
        return staff.filter(member => member.role === 'Cleaning');
      case 'Supervisor':
        // Supervisor vê toda a equipa
        return staff;
      default:
        return staff;
    }
  }, [staff, user]);

  // Heatmap apenas para Security e Supervisor
  const canViewHeatmap = user?.role === 'Security' || user?.role === 'Supervisor';
  
  // Bins apenas para Cleaning e Supervisor
  const canViewBins = user?.role === 'Cleaning' || user?.role === 'Supervisor';
  
  // Zones apenas para Security e Supervisor
  const canViewZones = user?.role === 'Security' || user?.role === 'Supervisor';

  // Overlay text personalizado
  const getOverlayText = () => {
    if (!user) return `Operacional • ${staff.length} Staff (LIVE)`;
    
    switch(user.role) {
      case 'Security':
        return `Segurança • ${visibleStaff.length} Agentes (LIVE)`;
      case 'Cleaning':
        return `Limpeza • ${visibleStaff.length} Operacionais (LIVE)`;
      case 'Supervisor':
        return `Supervisão • ${staff.length} Staff Total (LIVE)`;
      default:
        return `Operacional • ${staff.length} Staff`;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      updatePositions();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeRoute && activeRoute.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(activeRoute, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [activeRoute]);

  const INITIAL_REGION = {
    latitude: 41.161758,
    longitude: -8.583933,
    latitudeDelta: 0.005, 
    longitudeDelta: 0.005,
  };

  const setMapLimits = () => {
    const northEast = { latitude: 41.1647, longitude: -8.5809 };
    const southWest = { latitude: 41.1587, longitude: -8.5869 };
    mapRef.current?.setMapBoundaries(northEast, southWest);
  };

  // Função para renderizar bins/lixeiras
  const renderBins = () => {
    if (!canViewBins || !showBins) return null;
    
    return BIN_LOCATIONS.map((bin) => {
      let color, icon;
      switch(bin.status) {
        case 'full':
          color = theme.colors.error;
          icon = 'trash-can';
          break;
        case 'medium':
          color = '#F59E0B';
          icon = 'trash-can-outline';
          break;
        default:
          color = '#10B981';
          icon = 'delete-empty';
      }
      
      return (
        <Marker
          key={`bin-${bin.id}`}
          coordinate={{ latitude: bin.latitude, longitude: bin.longitude }}
          title={`Lixeira ${bin.id}`}
          description={`Status: ${bin.status === 'full' ? 'Cheia' : bin.status === 'medium' ? 'Média' : 'Vazia'}`}
        >
          <View style={[styles.binMarker, { backgroundColor: color }]}>
            <MaterialCommunityIcons name={icon as any} size={16} color="white" />
          </View>
        </Marker>
      );
    });
  };

  // Função para renderizar zonas críticas
  const renderZones = () => {
    if (!canViewZones || !showZones) return null;
    
    return CRITICAL_ZONES.map((zone) => {
      let color, icon;
      switch(zone.type) {
        case 'crowd':
          color = '#F59E0B';
          icon = 'account-group';
          break;
        case 'security':
          color = theme.colors.primary;
          icon = 'shield';
          break;
        case 'emergency':
          color = theme.colors.error;
          icon = 'alert';
          break;
        default:
          color = '#6B7280';
          icon = 'map-marker';
      }
      
      return (
        <Marker
          key={`zone-${zone.id}`}
          coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
          title={`Zona ${zone.id}`}
          description={zone.type === 'crowd' ? 'Área de Multidão' : 
                     zone.type === 'security' ? 'Ponto de Segurança' : 
                     'Zona de Emergência'}
        >
          <View style={[styles.zoneMarker, { backgroundColor: color }]}>
            <MaterialCommunityIcons name={icon as any} size={18} color="white" />
          </View>
        </Marker>
      );
    });
  };

  // Botões de controle baseados no role
  const renderControlButtons = () => {
    const buttons = [];
    
    // Botão Heatmap (apenas Security e Supervisor)
    if (canViewHeatmap) {
      buttons.push(
        <TouchableOpacity 
          key="heatmap"
          style={[
            styles.layerButton, 
            showHeatmap && styles.layerButtonActive,
            showHeatmap && { backgroundColor: '#EF4444' } // Vermelho quando ativo
          ]}
          onPress={() => setShowHeatmap(!showHeatmap)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name={showHeatmap ? "fire" : "fire-off"} 
            size={24} 
            color={showHeatmap ? "white" : theme.colors.text} 
          />
          <Text style={[
            styles.buttonLabel,
            showHeatmap && { color: 'white', fontWeight: 'bold' }
          ]}>
            {showHeatmap ? "HEAT ON" : "Heatmap"}
          </Text>
        </TouchableOpacity>
      );
    }
    
    // Botão Bins (apenas Cleaning e Supervisor)
    if (canViewBins) {
      buttons.push(
        <TouchableOpacity 
          key="bins"
          style={[styles.layerButton, showBins && styles.layerButtonActive]}
          onPress={() => setShowBins(!showBins)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name={showBins ? "delete" : "delete-outline"} 
            size={24} 
            color={showBins ? "white" : theme.colors.text} 
          />
          <Text style={styles.buttonLabel}>Lixeiras</Text>
        </TouchableOpacity>
      );
    }
    
    // Botão Zones (apenas Security e Supervisor)
    if (canViewZones) {
      buttons.push(
        <TouchableOpacity 
          key="zones"
          style={[styles.layerButton, showZones && styles.layerButtonActive]}
          onPress={() => setShowZones(!showZones)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name={showZones ? "map-marker-radius" : "map-marker-outline"} 
            size={24} 
            color={showZones ? "white" : theme.colors.text} 
          />
          <Text style={styles.buttonLabel}>Zonas</Text>
        </TouchableOpacity>
      );
    }
    
    return buttons;
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        onMapReady={setMapLimits}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        provider={PROVIDER_GOOGLE} 
        showsUserLocation={true} 
        showsCompass={false}
        
        // Regras de Navegação
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        minZoomLevel={16}
        maxZoomLevel={20}
      >
        {/* Staff markers filtrados por role */}
        {visibleStaff.map((member) => (
          <StaffMarker
            key={member.id}
            id={member.id}
            name={member.name}
            role={member.role as any}
            coordinate={{ latitude: member.lat, longitude: member.lng }}
          />
        ))}

        {/* Heatmap condicional */}
        {canViewHeatmap && showHeatmap && (
          <Heatmap
            points={HEATMAP_POINTS}
            opacity={0.8}
            radius={50}
            gradient={{
              colors: ['#00000000', '#60A5FA', '#FBBF24', '#EF4444'],
              startPoints: [0.1, 0.4, 0.7, 1.0], 
              colorMapSize: 500
            }}
          />
        )}

        {/* Bins/Lixeiras condicional */}
        {renderBins()}

        {/* Zonas Críticas condicional */}
        {renderZones()}

        {/* Rota ativa */}
        {activeRoute && (
          <>
            <Polyline
              coordinates={activeRoute}
              strokeColor="#3B82F6"
              strokeWidth={4}
              lineDashPattern={[0]} 
            />
            <Marker coordinate={activeRoute[activeRoute.length - 1]}>
              <View style={styles.destMarker}>
                <MaterialCommunityIcons name="flag-checkered" size={20} color="white" />
              </View>
            </Marker>
          </>
        )}

      </MapView>

      {/* Overlay de topo personalizado */}
      <View style={styles.topOverlay}>
        <Text style={styles.overlayText}>
          {getOverlayText()}
        </Text>
        {user?.role === 'Supervisor' && (
          <Text style={styles.supervisorNote}>
            Modo Supervisor Ativo
          </Text>
        )}
      </View>

      {/* Botões de controle (lado direito) */}
      <View style={styles.controlsContainer}>
        {renderControlButtons()}
      </View>

      {/* Botão de localização rápida (apenas Cleaning) */}
      {user?.role === 'Cleaning' && (
        <TouchableOpacity 
          style={styles.cleaningActionBtn}
          onPress={() => {
            // Filtrar apenas bins cheias
            const fullBins = BIN_LOCATIONS.filter(bin => bin.status === 'full');
            
            if (fullBins.length > 0) {
              // Zoom para a primeira bin cheia
              mapRef.current?.animateToRegion({
                latitude: fullBins[0].latitude,
                longitude: fullBins[0].longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }, 1000);
              
              // Mostrar todas as bins cheias
              setShowBins(true); // Ativa a visualização das lixeiras
              
              Alert.alert(
                "📍 Zonas Prioritárias",
                `🔴 ${fullBins.length} lixeira(s) cheia(s) encontrada(s):\n\n${fullBins.map(bin => `• Lixeira ${bin.id} (${bin.status === 'full' ? 'Cheia' : 'Média'})`).join('\n')}`,
                [
                  { 
                    text: "Mostrar rota", 
                    onPress: () => {
                      // Aqui poderia calcular rota otimizada
                      const routeCoordinates = fullBins.map(bin => ({
                        latitude: bin.latitude,
                        longitude: bin.longitude
                      }));
                      
                      // Desenhar rota no mapa
                      if (routeCoordinates.length > 1) {
                        // TODO: Implementar cálculo de rota otimizada
                        Alert.alert(
                          "Rota Calculada",
                          "Rota otimizada para limpeza das lixeiras cheias",
                          [{ text: "OK" }]
                        );
                      }
                    }
                  },
                  { text: "OK" }
                ]
              );
            } else {
              Alert.alert(
                "Tudo Limpo!",
                "Nenhuma lixeira cheia encontrada no momento.",
                [{ text: "OK" }]
              );
            }
          }}
        >
          <MaterialCommunityIcons name="target" size={20} color="white" />
          <Text style={styles.cleaningActionText}>Prioridade</Text>
        </TouchableOpacity>
      )}

      {/* Botão de emergência (apenas Security) */}
      {user?.role === 'Security' && (
        <TouchableOpacity 
          style={styles.emergencyBtn}
          onPress={() => {
            Alert.alert(
              "Emergência",
              "Ativar modo de emergência?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Ativar", style: "destructive", onPress: () => {
                  navigation.navigate('Emergência'); // Navegar para tab de emergência
                }}
              ]
            );
          }}
        >
          <MaterialCommunityIcons name="alert" size={20} color="white" />
        </TouchableOpacity>
      )}

      {/* Botão de análise (apenas Supervisor) */}
      {user?.role === 'Supervisor' && (
        <TouchableOpacity 
          style={styles.analyticsBtn}
          onPress={() => {
            Alert.alert(
              "Análise de Dados",
              "Gerar relatório de atividades?",
              [{ text: "OK" }]
            );
          }}
        >
          <MaterialCommunityIcons name="chart-box" size={20} color="white" />
        </TouchableOpacity>
      )}

      {/* Botão Limpar Rota */}
      {activeRoute && (
        <TouchableOpacity style={styles.clearRouteBtn} onPress={clearRoute}>
          <MaterialCommunityIcons name="close" size={20} color="white" />
          <Text style={styles.clearRouteText}>Limpar Rota</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  
  // Overlay de Topo
  topOverlay: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    alignItems: 'center',
  },
  overlayText: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 12,
  },
  supervisorNote: {
    fontSize: 8,
    color: theme.colors.error,
    fontWeight: '600',
    marginTop: 2,
  },

  // Container para botões de controle
  controlsContainer: {
    position: 'absolute',
    top: 100,
    right: 16,
    gap: 12,
  },

  // Botões de camada (heatmap, bins, zones)
  layerButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 60,
  },
  layerButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  buttonLabel: {
    fontSize: 8,
    marginTop: 4,
    fontWeight: '600',
    color: theme.colors.text,
  },

  // Botão específico para Cleaning
  cleaningActionBtn: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    gap: 8,
  },
  cleaningActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },

  // Botão de emergência para Security
  emergencyBtn: {
    position: 'absolute',
    bottom: 160,
    right: 16,
    backgroundColor: theme.colors.error,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
  },

  // Botão de análise para Supervisor
  analyticsBtn: {
    position: 'absolute',
    bottom: 220,
    right: 16,
    backgroundColor: '#7C3AED',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },

  // Botão Limpar Rota
  clearRouteBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    gap: 8,
  },
  clearRouteText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Marcador de Destino
  destMarker: {
    backgroundColor: theme.colors.error,
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },

  // Marcadores de Lixeiras
  binMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Marcadores de Zonas
  zoneMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});