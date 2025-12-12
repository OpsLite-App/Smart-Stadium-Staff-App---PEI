import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

interface StaffMarkerProps {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  role: 'Security' | 'Cleaning' | 'Supervisor';
  name: string;
}

export default function StaffMarker({ id, coordinate, role, name }: StaffMarkerProps) {
  
  const getStyle = () => {
    switch (role) {
      case 'Security':
        return { color: theme.colors.primary, icon: 'shield-account' }; // Azul/Roxo
      case 'Cleaning':
        return { color: '#10B981', icon: 'broom' }; // Verde Esmeralda
      case 'Supervisor':
        return { color: '#F59E0B', icon: 'eye' }; // Laranja
      default:
        return { color: 'gray', icon: 'account' };
    }
  };

  const style = getStyle();

  return (
    <Marker coordinate={coordinate} title={name} description={role}>
      <View style={styles.container}>
        <View style={[styles.bubble, { backgroundColor: style.color }]}>
          <MaterialCommunityIcons name={style.icon as any} size={20} color="white" />
        </View>
        <View style={[styles.arrow, { borderTopColor: style.color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});