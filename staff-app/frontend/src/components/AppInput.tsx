import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { theme } from '../theme';

interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string; 
  leftIcon?: string; 
}

export default function AppInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  error,
  leftIcon,
}: AppInputProps) {
  return (
    <View style={styles.container}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        mode="outlined"
        
        outlineColor={error ? theme.colors.error : '#E5E7EB'}
        activeOutlineColor={error ? theme.colors.error : theme.colors.primary}
        style={styles.input}
        textColor={theme.colors.text}
        
        left={leftIcon ? <TextInput.Icon icon={leftIcon} color={theme.colors.textSecondary} /> : null}
      />
      
      {/* Mensagem de Erro */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});