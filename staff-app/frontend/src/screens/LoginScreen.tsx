import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  Pressable
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useTheme } from 'react-native-paper'; 

import { useAuthStore } from '../stores/useAuthStore';
import { theme } from '../theme';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';

export default function LoginScreen() {
  // Estado Local
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Security' | 'Cleaning' | 'Supervisor'>('Security');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Estado Global
  const { login, isLoading } = useAuthStore();

  // Ação de Login
  const handleLogin = async () => {
    // Limpar erros anteriores
    setErrorMsg('');
    Keyboard.dismiss(); 

    // Validação Simples
    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    // Chamar a Store
    try {
      await login(email, role);
    } catch (err) {
      setErrorMsg('Falha ao iniciar sessão. Tente novamente.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="shield-check" size={40} color="white" />
            </View>
            <Text style={styles.title}>OpsLite</Text>
            <Text style={styles.subtitle}>Smart Stadium Staff App</Text>
          </View>

          <View style={styles.formCard}>
            
            <Text style={styles.label}>SELECIONE A SUA FUNÇÃO</Text>
            <View style={styles.roleContainer}>
              {['Security', 'Cleaning', 'Supervisor'].map((r) => {
                const isActive = role === r;
                return (
                  <Pressable 
                    key={r} 
                    onPress={() => setRole(r as any)}
                    style={[styles.roleChip, isActive && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleText, isActive && styles.roleTextActive]}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <AppInput
              label="Email Institucional"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              leftIcon="email-outline"
              error={errorMsg && !email ? 'Campo obrigatório' : ''}
            />

            <AppInput
              label="Palavra-passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible} // Lógica de esconder senha
              leftIcon="lock-outline"
              error={errorMsg && !password ? 'Campo obrigatório' : ''}
            />
            
            <Pressable 
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.showPassword}
            >
              <Text style={{color: theme.colors.textSecondary, fontSize: 12}}>
                {isPasswordVisible ? 'Ocultar Senha' : 'Mostrar Senha'}
              </Text>
            </Pressable>

            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : null}

            <AppButton 
              title="ENTRAR NO SISTEMA" 
              onPress={handleLogin}
              loading={isLoading}
              style={{ marginTop: 20 }}
            />
          </View>

          <Text style={styles.footer}>© 2025 FC Porto - Stadium Security System</Text>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  formCard: {
    
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 1,
  },
  
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  roleTextActive: {
    color: 'white',
  },

  showPassword: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    marginTop: -10,
  },
  errorText: {
    color: theme.colors.accent, 
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
  },
  footer: {
    textAlign: 'center',
    marginTop: 40,
    color: theme.colors.textSecondary,
    fontSize: 12,
    opacity: 0.5,
  },
});