import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void; // <-- NOVO: callback para voltar
}

export default function AppHeader({ 
  title = "Security Dashboard", 
  subtitle = "Sistema Operacional • Live",
  showBack = false,
  onBackPress 
}: AppHeaderProps) {
  

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {/* Botão de Voltar Condicional */}
        {showBack && (
          <TouchableOpacity 
            onPress={onBackPress} // <-- Usa a prop
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.statusRow}>
            {!showBack && <View style={styles.statusDot} />}
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>
      
      {!showBack && (
        <TouchableOpacity style={styles.profileBtn}>
          <MaterialCommunityIcons name="account-circle" size={32} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ... estilos permanecem iguais
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statusRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#10B981', 
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary, 
    fontWeight: '600',
  },
  profileBtn: {
    padding: 4,
  },
});