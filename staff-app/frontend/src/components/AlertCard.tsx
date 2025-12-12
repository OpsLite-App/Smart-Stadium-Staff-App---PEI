import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

export type AlertType = 'sos' | 'crowd' | 'bin' | 'maintenance';

interface AlertCardProps {
  type: AlertType;
  title: string;
  location: string;
  time: string;
  description?: string;
  onPress: () => void;
  onAccept?: () => void;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function AlertCard({ 
  type, 
  title, 
  location, 
  time, 
  description, 
  onPress,
  onAccept,
  priority
}: AlertCardProps) {

  // Lógica de Cores para Modo Claro
  const getConfig = () => {
    switch (type) {
      case 'sos':
        return { 
          color: theme.colors.error, 
          bg: '#FEF2F2', 
          icon: 'alert-octagon', 
          label: priority || 'CRÍTICO' 
        };
      case 'crowd':
        return { 
          color: '#F59E0B', 
          bg: '#FFFBEB', 
          icon: 'account-group', 
          label: priority || 'DENSIDADE' 
        };
      case 'bin':
      case 'maintenance':
        return { 
          color: theme.colors.primary, 
          bg: '#EEF2FF', 
          icon: 'trash-can', 
          label: priority || 'MANUTENÇÃO' 
        };
      default:
        return { 
          color: theme.colors.textSecondary, 
          bg: '#F3F4F6', 
          icon: 'information', 
          label: 'INFO' 
        };
    }
  };

  const config = getConfig();

  return (
    <Surface style={[styles.card, { borderLeftColor: config.color }]} elevation={2}>
      <TouchableOpacity onPress={onPress} style={styles.touchArea} activeOpacity={0.7}>
        
        {/* Cabeçalho: Badge e Tempo */}
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <MaterialCommunityIcons name={config.icon as any} size={16} color={config.color} />
            <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.time}>{time}</Text>
        </View>

        {/* Conteúdo Principal */}
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.location}>📍 {location}</Text>
          {description && (
            <Text style={styles.desc} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>

        {/* Botão de Ação */}
        {onAccept && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: config.color }]} 
              onPress={onAccept}
            >
              <Text style={styles.btnText}>ACEITAR TAREFA</Text>
            </TouchableOpacity>
          </View>
        )}
        
      </TouchableOpacity>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white', 
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 6, 
    overflow: 'hidden',
  },
  touchArea: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  content: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
    fontWeight: '500',
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});