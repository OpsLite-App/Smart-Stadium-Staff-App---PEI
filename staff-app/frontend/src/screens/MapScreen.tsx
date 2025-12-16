import React, { useRef, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Heatmap, Polyline, Marker, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';

// Stores
import { useMapStore } from '../stores/useMapStore';
import { useAuthStore } from '../stores/useAuthStore';

// Interface para pontos do heatmap
interface HeatmapPointWithColor {
  latitude: number;
  longitude: number;
  weight: number;
  occupancy_rate?: number;
  heat_level?: 'green' | 'yellow' | 'red';
  area_id?: string;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();

  // Estado Local para Controlo de Camadas
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showBins, setShowBins] = useState(false);
  const [heatmapType, setHeatmapType] = useState<'gradient' | 'circles'>('gradient');

  // Estado Global
  const { user } = useAuthStore();
  
  const { 
    nodes,              
    heatmapData,        
    bins, 
    staffMembers,       
    activeRoute, 
    fetchMapData,
    fetchStaff,        
    fetchHeatmapData,
    clearRoute,
    heatmapLoading,
    loading
  } = useMapStore();

  // Permissões de Visualização
  const canViewHeatmap = user?.role === 'Security' || user?.role === 'Supervisor';
  const canViewBins = user?.role === 'Cleaning' || user?.role === 'Supervisor';
  const canViewStaff = true;

  // ========== EFEITOS ==========

  // EFEITO 1: Inicialização do Mapa (roda apenas uma vez)
  useEffect(() => {
    console.log("📍 MAP SCREEN MOUNTED - Iniciando carregamento...");
    
    // Carregar Mapa Estático (Geometria)
    fetchMapData();
    
    // Carregar Posições dos Colegas
    fetchStaff();

    // Polling: Atualizar colegas a cada 10 segundos
    const staffInterval = setInterval(() => {
      fetchStaff();
    }, 10000);

    return () => {
      console.log("📍 MAP SCREEN UNMOUNTED - Limpando...");
      clearInterval(staffInterval);
    };
  }, []);

  // EFEITO 2: Atualização do Heatmap (quando permissões mudam)
  useEffect(() => {
    console.log("🔥 Efeito heatmap - canViewHeatmap:", canViewHeatmap, "showHeatmap:", showHeatmap);
    
    if (canViewHeatmap && showHeatmap) {
      // Buscar heatmap imediatamente
      console.log("🔥 Buscando heatmap inicial...");
      fetchHeatmapData();
      
      // Configurar intervalo para atualizar a cada 10 segundos
      const heatmapInterval = setInterval(() => {
        console.log("🔄 Atualizando heatmap (interval)...");
        fetchHeatmapData();
      }, 10000);
      
      return () => {
        console.log("🔥 Limpando intervalo do heatmap");
        clearInterval(heatmapInterval);
      };
    } else {
      console.log("🔥 Heatmap não visível - não buscando dados");
    }
  }, [canViewHeatmap, showHeatmap, fetchHeatmapData]);

  // EFEITO 3: Focar na Rota quando ela é calculada
  useEffect(() => {
    if (activeRoute && activeRoute.length > 0 && mapRef.current) {
      console.log("📍 Rota ativa detectada - focando no mapa");
      mapRef.current.fitToCoordinates(activeRoute, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [activeRoute]);

  // EFEITO 4: Debug - Log de estado quando muda
  useEffect(() => {
    console.log("🔍 MAP SCREEN STATE UPDATE:");
    console.log("👤 User role:", user?.role);
    console.log("🔥 Can view heatmap:", canViewHeatmap);
    console.log("🔥 Show heatmap:", showHeatmap);
    console.log("🔥 Heatmap data:", heatmapData.length, "points");
    
    if (heatmapData.length > 0) {
      console.log("🔥 Primeiro ponto:", heatmapData[0]);
    }
  }, [user, canViewHeatmap, showHeatmap, heatmapData]);

  // ========== FUNÇÕES AUXILIARES ==========

  const getOverlayText = () => {
    if (!user) return `Operacional • Live`;
    if (user.role === 'Supervisor') return `Supervisão • Modo Global`;
    return `${user.role === 'Security' ? 'Segurança' : 'Limpeza'} • Ativo`;
  };

  // Função para obter cor baseada no heat_level
  const getHeatLevelColor = (heatLevel?: 'green' | 'yellow' | 'red') => {
    switch (heatLevel) {
      case 'green': return 'rgba(34, 197, 94, 0.7)';  // Verde
      case 'yellow': return 'rgba(234, 179, 8, 0.7)'; // Amarelo
      case 'red': return 'rgba(239, 68, 68, 0.7)';    // Vermelho
      default: return 'rgba(59, 130, 246, 0.7)';      // Azul padrão
    }
  };

  // Função para obter tamanho do círculo baseado no occupancy_rate
  const getCircleRadius = (occupancyRate?: number) => {
    if (!occupancyRate) return 25;
    
    // Escala o raio baseado na ocupação (20-100%)
    const minRadius = 20;
    const maxRadius = 80;
    return minRadius + (occupancyRate / 100) * (maxRadius - minRadius);
  };

  // Função para renderizar heatmap como círculos coloridos
  const renderHeatmapCircles = () => {
    if (!canViewHeatmap || !showHeatmap || heatmapData.length === 0) return null;

    return heatmapData.map((point, index) => {
      // Tipo o ponto para acessar heat_level
      const typedPoint = point as HeatmapPointWithColor;
      
      return (
        <Circle
          key={`heat-circle-${index}-${typedPoint.area_id || index}`}
          center={{
            latitude: typedPoint.latitude,
            longitude: typedPoint.longitude
          }}
          radius={getCircleRadius(typedPoint.occupancy_rate)}
          fillColor={getHeatLevelColor(typedPoint.heat_level)}
          strokeColor="rgba(255, 255, 255, 0.8)"
          strokeWidth={1}
          zIndex={1}
        />
      );
    });
  };

  // DEFINIÇÕES DO MAPA
  const INITIAL_REGION = {
    latitude: 41.161758,
    longitude: -8.583933,
    latitudeDelta: 0.005, 
    longitudeDelta: 0.005,
  };

  const renderControlButtons = () => {
    const buttons = [];
    
    if (canViewHeatmap) {
      buttons.push(
        <TouchableOpacity 
          key="heatmap"
          style={[
            styles.layerButton, 
            showHeatmap && styles.layerButtonActive,
            showHeatmap && { backgroundColor: theme.colors.error }
          ]}
          onPress={() => {
            console.log("🔥 Toggling heatmap:", !showHeatmap);
            setShowHeatmap(!showHeatmap);
          }}
        >
          <MaterialCommunityIcons 
            name={showHeatmap ? "fire" : "fire-off"} 
            size={24} 
            color={showHeatmap ? "white" : theme.colors.text} 
          />
          <Text style={[styles.buttonLabel, showHeatmap && { color: 'white' }]}>
            Heatmap
          </Text>
        </TouchableOpacity>
      );

      // Botão para alternar entre gradiente e círculos
      buttons.push(
        <TouchableOpacity 
          key="heatmap-type"
          style={[
            styles.layerButton,
            { backgroundColor: heatmapType === 'circles' ? '#8B5CF6' : 'white' }
          ]}
          onPress={() => {
            const newType = heatmapType === 'gradient' ? 'circles' : 'gradient';
            console.log("🔄 Alternando tipo de heatmap:", newType);
            setHeatmapType(newType);
          }}
        >
          <MaterialCommunityIcons 
            name={heatmapType === 'circles' ? "circle-slice-8" : "blur"} 
            size={24} 
            color={heatmapType === 'circles' ? "white" : theme.colors.text} 
          />
          <Text style={[styles.buttonLabel, heatmapType === 'circles' && { color: 'white' }]}>
            {heatmapType === 'circles' ? 'Círculos' : 'Gradiente'}
          </Text>
        </TouchableOpacity>
      );
    }
    
    if (canViewBins) {
      buttons.push(
        <TouchableOpacity 
          key="bins"
          style={[styles.layerButton, showBins && styles.layerButtonActive]}
          onPress={() => {
            console.log("🗑️ Toggling bins:", !showBins);
            setShowBins(!showBins);
          }}
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

    return buttons;
  };

  // ========== RENDERIZAÇÃO ==========

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>A carregar mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        provider={PROVIDER_GOOGLE} 
        showsUserLocation={true} 
        showsCompass={false}
        minZoomLevel={16}
        maxZoomLevel={20}
        onMapReady={() => console.log("🗺️ Mapa pronto!")}
      >
        {/* 1. Camada Heatmap - Gradiente */}
        {canViewHeatmap && showHeatmap && heatmapType === 'gradient' && heatmapData.length > 0 && (
          <Heatmap
            points={heatmapData}
            opacity={0.8}  // Mais opaco
            //radius={70}    // Raio maior para melhor visualização
            gradient={{
              colors: [
                'rgba(34, 197, 94, 0.1)',   // Verde claro (0-30%)
                'rgba(34, 197, 94, 0.4)',   // Verde (30-50%)
                'rgba(234, 179, 8, 0.6)',   // Amarelo (50-70%)
                'rgba(234, 179, 8, 0.8)',   // Amarelo forte (70-80%)
                'rgba(239, 68, 68, 0.9)',   // Vermelho (80-90%)
                'rgba(239, 68, 68, 1.0)'    // Vermelho forte (90-100%)
              ],
              startPoints: [0.1, 0.3, 0.5, 0.7, 0.8, 0.9],
              colorMapSize: 256
            }}
          />
        )}

        {/* 2. Camada Heatmap - Círculos Coloridos */}
        {canViewHeatmap && showHeatmap && heatmapType === 'circles' && renderHeatmapCircles()}

        {/* 3. Camada Lixeiras */}
        {canViewBins && showBins && bins.map((bin) => (
          <Marker
            key={bin.id}
            coordinate={{ latitude: bin.x, longitude: bin.y }}
            title={bin.name || `Lixeira ${bin.id}`}
            description="Ponto de Recolha"
          >
            <View style={[styles.binMarker, { backgroundColor: '#10B981' }]}>
              <MaterialCommunityIcons name="trash-can" size={16} color="white" />
            </View>
          </Marker>
        ))}

        {/* 4. Camada STAFF */}
        {canViewStaff && staffMembers.map((member) => {
          const node = nodes[member.location];
          
          if (!node) return null;
          if (member.id === user?.id) return null;

          const isSecurity = member.role === 'Security';
          const color = isSecurity ? '#3B82F6' : '#F59E0B';
          const icon = isSecurity ? 'shield-account' : 'broom';

          return (
            <Marker
              key={`staff-${member.id}`}
              coordinate={{ latitude: node.x, longitude: node.y }}
              title={member.name}
              description={`${member.role} • ${member.location}`}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={10}
            >
              <View style={[styles.staffMarker, { backgroundColor: color, borderColor: color }]}>
                 <View style={styles.staffIconInner}>
                    <MaterialCommunityIcons name={icon} size={14} color="white" />
                 </View>
                 <View style={[styles.arrowDown, { borderTopColor: color }]} />
              </View>
            </Marker>
          );
        })}

        {/* 5. Rota Ativa */}
        {activeRoute && activeRoute.length > 0 && (
          <>
            <Polyline
              coordinates={activeRoute}
              strokeColor={theme.colors.primary}
              strokeWidth={4}
            />
            <Marker coordinate={activeRoute[activeRoute.length - 1]}>
              <View style={styles.destMarker}>
                <MaterialCommunityIcons name="flag-checkered" size={20} color="white" />
              </View>
            </Marker>
          </>
        )}

        {/* 6. Legenda do Heatmap (se estiver visível) */}
        {canViewHeatmap && showHeatmap && heatmapData.length > 0 && (
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: 'rgba(34, 197, 94, 0.7)' }]} />
              <Text style={styles.legendText}>Baixo (0-50%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: 'rgba(234, 179, 8, 0.7)' }]} />
              <Text style={styles.legendText}>Médio (50-80%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: 'rgba(239, 68, 68, 0.7)' }]} />
              <Text style={styles.legendText}>Alto (80-100%)</Text>
            </View>
          </View>
        )}
      </MapView>

      {/* Loading Indicator para Heatmap */}
      {heatmapLoading && (
        <View style={styles.heatmapLoading}>
          <ActivityIndicator size="small" color={theme.colors.error} />
          <Text style={styles.heatmapLoadingText}>Atualizando heatmap...</Text>
        </View>
      )}

      {/* Overlay de Informação no Topo */}
      <View style={styles.topOverlay}>
        <Text style={styles.overlayText}>{getOverlayText()}</Text>
        {user?.role === 'Supervisor' && (
          <Text style={styles.supervisorNote}>Modo Supervisor</Text>
        )}
      </View>

      {/* Botões de Controlo de Camadas */}
      <View style={styles.controlsContainer}>
        {renderControlButtons()}
      </View>

      {/* Botão de Debug (visível apenas em desenvolvimento) */}
      {__DEV__ && (
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => {
            console.log("🔍 === DEBUG MAPSCREEN ===");
            console.log("👤 User:", user);
            console.log("🔍 Permissões: heatmap=" + canViewHeatmap);
            console.log("🔥 Heatmap data:", heatmapData);
            console.log("🔥 Tipo heatmap:", heatmapType);
            console.log("🗺️ Nodes count:", Object.keys(nodes).length);
            console.log("🗑️ Bins:", bins.length);
            
            // Forçar atualização
            fetchHeatmapData();
            
            Alert.alert(
              "Debug Info",
              `Role: ${user?.role}\n` +
              `Heatmap: ${heatmapData.length} pontos\n` +
              `Tipo: ${heatmapType}\n` +
              `Mostrando: ${showHeatmap ? 'SIM' : 'NÃO'}\n` +
              `Última atualização: ${new Date().toLocaleTimeString()}`
            );
          }}
        >
          <MaterialCommunityIcons name="bug" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Ação: Limpeza */}
      {user?.role === 'Cleaning' && (
        <TouchableOpacity 
          style={styles.cleaningActionBtn}
          onPress={() => {
            if (bins.length > 0) {
              mapRef.current?.animateToRegion({
                latitude: bins[0].x,
                longitude: bins[0].y,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }, 1000);
              setShowBins(true);
              Alert.alert("Zonas Prioritárias", "A focar nas lixeiras registadas no sistema.");
            } else {
              Alert.alert("Info", "Nenhuma lixeira encontrada.");
            }
          }}
        >
          <MaterialCommunityIcons name="target" size={20} color="white" />
          <Text style={styles.cleaningActionText}>Prioridade</Text>
        </TouchableOpacity>
      )}

      {/* Ação: Segurança */}
      {user?.role === 'Security' && (
        <TouchableOpacity 
          style={styles.emergencyBtn}
          onPress={() => {
            Alert.alert(
              "Emergência",
              "Ativar modo de emergência?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Ativar", style: "destructive", onPress: () => navigation.navigate('Emergência') }
              ]
            );
          }}
        >
          <MaterialCommunityIcons name="alert" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Botão Limpar Rota */}
      {activeRoute && activeRoute.length > 0 && (
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
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.primary,
    fontSize: 16,
  },
  
  heatmapLoading: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heatmapLoadingText: {
    fontSize: 12,
    color: theme.colors.error,
  },
  
  // Legenda do Heatmap
  legendContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#666',
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  
  // UI Elements
  topOverlay: {
    position: 'absolute',
    top: 60,
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
  overlayText: { fontWeight: '700', color: theme.colors.primary, fontSize: 12 },
  supervisorNote: { fontSize: 9, color: theme.colors.error, fontWeight: '700', marginTop: 2 },

  controlsContainer: { position: 'absolute', top: 110, right: 16, gap: 12 },
  layerButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    minWidth: 60,
  },
  layerButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  buttonLabel: { fontSize: 9, marginTop: 4, fontWeight: '700', color: theme.colors.text },

  debugButton: {
    position: 'absolute',
    bottom: 180,
    right: 16,
    backgroundColor: '#8B5CF6',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 }
  },
  
  cleaningActionBtn: {
    position: 'absolute', bottom: 110, left: 16,
    backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, elevation: 6, gap: 8,
  },
  cleaningActionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  emergencyBtn: {
    position: 'absolute', bottom: 110, right: 16,
    backgroundColor: theme.colors.error, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
  },

  clearRouteBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, elevation: 6, gap: 8,
  },
  clearRouteText: { color: 'white', fontWeight: 'bold' },

  // Marcadores
  binMarker: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'white',
    shadowColor: '#000', shadowOpacity: 0.3, elevation: 4,
  },
  destMarker: {
    backgroundColor: theme.colors.error, padding: 8, borderRadius: 20,
    borderWidth: 2, borderColor: 'white',
  },

  staffMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  staffIconInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'inherit', 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    elevation: 3
  },
  arrowDown: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6, 
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2, 
  }
});