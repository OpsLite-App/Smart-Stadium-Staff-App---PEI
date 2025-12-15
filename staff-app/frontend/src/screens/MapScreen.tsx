import React, { useRef, useState, useEffect } from 'react';
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


// Stores
import { useMapStore } from '../stores/useMapStore';
import { useAuthStore } from '../stores/useAuthStore';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();

  // Estado Local para Controlo de Camadas
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showBins, setShowBins] = useState(false);

  // Estado Global
  const { user } = useAuthStore();
  
  const { 
    heatmapData, // Pontos de calor reais
    bins,        // Lixeiras reais da BD
    activeRoute, 
    fetchMapData, 
    fetchLiveStatus,
    clearRoute 
  } = useMapStore();

  useEffect(() => {
    fetchMapData();
  }, []);

  useEffect(() => {
    fetchLiveStatus(); 
    
    const interval = setInterval(() => {
      fetchLiveStatus(); 
    }, 3000);
    
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

  
  const canViewHeatmap = user?.role === 'Security' || user?.role === 'Supervisor';
  const canViewBins = user?.role === 'Cleaning' || user?.role === 'Supervisor';

  const getOverlayText = () => {
    if (!user) return `Operacional • Live`;
    if (user.role === 'Supervisor') return `Supervisão • Modo Global`;
    return `${user.role === 'Security' ? 'Segurança' : 'Limpeza'} • Ativo`;
  };

  // DEFINIÇÕES DO MAPA
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
          onPress={() => setShowHeatmap(!showHeatmap)}
        >
          <MaterialCommunityIcons 
            name={showHeatmap ? "fire" : "fire-off"} 
            size={24} 
            color={showHeatmap ? "white" : theme.colors.text} 
          />
          <Text style={[styles.buttonLabel, showHeatmap && { color: 'white' }]}>
            {showHeatmap ? "HEAT ON" : "Heatmap"}
          </Text>
        </TouchableOpacity>
      );
    }
    
    if (canViewBins) {
      buttons.push(
        <TouchableOpacity 
          key="bins"
          style={[styles.layerButton, showBins && styles.layerButtonActive]}
          onPress={() => setShowBins(!showBins)}
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
        minZoomLevel={16}
        maxZoomLevel={20}
      >
        {canViewHeatmap && showHeatmap && heatmapData.length > 0 && (
          <Heatmap
            points={heatmapData}
            opacity={0.8}
            radius={40}
            gradient={{
              colors: ['#00000000', '#60A5FA', '#FBBF24', '#EF4444'],
              startPoints: [0.1, 0.4, 0.7, 1.0], 
              colorMapSize: 256
            }}
          />
        )}

        {canViewBins && showBins && bins.map((bin) => (
          <Marker
            key={bin.id}
            coordinate={{ latitude: bin.x, longitude: bin.y }} // Assumindo X=Lat, Y=Lng
            title={bin.name || `Lixeira ${bin.id}`}
            description="Ponto de Recolha"
          >
            <View style={[styles.binMarker, { backgroundColor: '#10B981' }]}>
              <MaterialCommunityIcons name="trash-can" size={16} color="white" />
            </View>
          </Marker>
        ))}

        {activeRoute && (
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
      </MapView>


      <View style={styles.topOverlay}>
        <Text style={styles.overlayText}>{getOverlayText()}</Text>
        {user?.role === 'Supervisor' && (
          <Text style={styles.supervisorNote}>Modo Supervisor</Text>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {renderControlButtons()}
      </View>

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
              Alert.alert("Info", "Nenhuma lixeira encontrada na base de dados.");
            }
          }}
        >
          <MaterialCommunityIcons name="target" size={20} color="white" />
          <Text style={styles.cleaningActionText}>Prioridade</Text>
        </TouchableOpacity>
      )}

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
  overlayText: {
    fontWeight: '700',
    color: theme.colors.primary,
    fontSize: 12,
  },
  supervisorNote: {
    fontSize: 9,
    color: theme.colors.error,
    fontWeight: '700',
    marginTop: 2,
  },

  // Controlos
  controlsContainer: {
    position: 'absolute',
    top: 110,
    right: 16,
    gap: 12,
  },
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
  layerButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  buttonLabel: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '700',
    color: theme.colors.text,
  },

  // Botões de Ação
  cleaningActionBtn: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 6,
    gap: 8,
  },
  cleaningActionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  emergencyBtn: {
    position: 'absolute',
    bottom: 110,
    right: 16,
    backgroundColor: theme.colors.error,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.4,
  },

  clearRouteBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 6,
    gap: 8,
  },
  clearRouteText: { color: 'white', fontWeight: 'bold' },

  // Marcadores Personalizados
  binMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    elevation: 4,
  },
  destMarker: {
    backgroundColor: theme.colors.error,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
});