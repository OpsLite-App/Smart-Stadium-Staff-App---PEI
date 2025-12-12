import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { theme } from '../theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  mode?: 'contained' | 'outlined' | 'text';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: any;
}

export default function AppButton({ 
  title, 
  onPress, 
  mode = 'contained', 
  loading = false, 
  disabled = false,
  icon,
  style 
}: AppButtonProps) {
  
  // Decidir cor baseado no modo
  const buttonColor = mode === 'contained' ? theme.colors.primary : undefined;
  const textColor = mode === 'contained' ? '#FFFFFF' : theme.colors.primary;

  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      buttonColor={buttonColor}
      textColor={textColor}
      contentStyle={styles.content}
      style={[styles.button, style]}
      labelStyle={styles.label}
    >
      {title}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8, 
    marginVertical: 8,
  },
  content: {
    height: 48, 
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});