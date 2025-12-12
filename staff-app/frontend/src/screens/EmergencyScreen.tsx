import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Surface } from 'react-native-paper';
import AppButton from '../components/AppButton';

export default function EmergencyScreen() {
  const [mode, setMode] = useState<'idle' | 'counting' | 'active'>('idle');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === 'counting') {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setMode('active'); // Ativa o modo de emergência!
            Vibration.vibrate([500, 500, 500], true); // Vibra o telemóvel
            return 3; // Reset para a próxima
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  const handleCancel = () => {
    setMode('idle');
    setCountdown(3);
    Vibration.cancel();
  };

  if (mode === 'active') {
    return (
      <SafeAreaView style={styles.containerActive}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.headerActive}>
            <MaterialCommunityIcons name="alert-octagon" size={64} color="white" style={styles.pulseIcon} />
            <Text style={styles.titleActive}>MODO DE EMERGÊNCIA</Text>
            <Text style={styles.subtitleActive}>SIGA O PROTOCOLO DE EVACUAÇÃO</Text>
          </View>

          <Surface style={styles.instructionCard} elevation={4}>
            <Text style={styles.cardTitle}>INSTRUÇÕES (SEGURANÇA)</Text>
            
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="door-open" size={24} color={theme.colors.error} />
              <Text style={styles.checkText}>Abrir Portões de Emergência N1 e N2</Text>
            </View>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="bullhorn" size={24} color={theme.colors.error} />
              <Text style={styles.checkText}>Usar megafone para guiar multidão</Text>
            </View>
            <View style={styles.checkItem}>
              <MaterialCommunityIcons name="radio-handheld" size={24} color={theme.colors.error} />
              <Text style={styles.checkText}>Manter canal 1 livre para Coordenação</Text>
            </View>
          </Surface>

          <View style={styles.footerActive}>
            <Text style={styles.footerText}>A sua localização está a ser partilhada.</Text>
            <AppButton 
              title="ESTOU EM SEGURANÇA" 
              onPress={() => {
                alert("Status enviado: SEGURO");
                handleCancel();
              }}
              style={{ backgroundColor: '#10B981', marginTop: 10 }}
              icon="check-circle"
            />
             <AppButton 
              title="REPORTAR PERIGO" 
              onPress={() => alert("Perigo reportado!")}
              mode="outlined"
              style={{ borderColor: 'white', marginTop: 10 }}
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.containerIdle}>
      <View style={styles.centerContent}>
        
        <Text style={styles.titleIdle}>CENTRAL DE EMERGÊNCIA</Text>
        <Text style={styles.subtitleIdle}>
          Apenas para uso em situações críticas.
        </Text>

        <TouchableOpacity 
          style={[styles.sosButton, mode === 'counting' && styles.sosButtonActive]}
          onPress={() => setMode('counting')}
          disabled={mode === 'counting'}
          activeOpacity={0.8}
        >
          {mode === 'counting' ? (
            <Text style={styles.countdownText}>{countdown}</Text>
          ) : (
            <>
              <MaterialCommunityIcons name="alert" size={48} color="white" />
              <Text style={styles.sosText}>SOS</Text>
            </>
          )}
        </TouchableOpacity>

        {mode === 'counting' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>A ATIVAR MODO DE EMERGÊNCIA...</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerIdle: { flex: 1, backgroundColor: '#F3F4F6' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  titleIdle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  subtitleIdle: { fontSize: 16, color: theme.colors.textSecondary, marginBottom: 40, textAlign: 'center' },
  
  sosButton: {
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: theme.colors.error,
    justifyContent: 'center', alignItems: 'center',
    elevation: 10,
    shadowColor: theme.colors.error,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    borderWidth: 8,
    borderColor: '#FEF2F2',
  },
  sosButtonActive: {
    backgroundColor: '#DC2626', // Vermelho mais escuro
    transform: [{ scale: 1.1 }],
  },
  sosText: { color: 'white', fontSize: 32, fontWeight: '900', marginTop: 8 },
  countdownText: { color: 'white', fontSize: 80, fontWeight: 'bold' },

  warningBox: { marginTop: 40, alignItems: 'center' },
  warningText: { color: theme.colors.error, fontWeight: 'bold', marginBottom: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 30, backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  cancelText: { fontWeight: 'bold', color: theme.colors.text },

  containerActive: { flex: 1, backgroundColor: '#DC2626' }, // Fundo Vermelho
  scrollContent: { padding: 20 },
  headerActive: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  titleActive: { fontSize: 28, fontWeight: '900', color: 'white', marginTop: 10, textAlign: 'center' },
  subtitleActive: { fontSize: 16, color: '#FECACA', fontWeight: '600', marginTop: 5, letterSpacing: 1 },
  pulseIcon: { opacity: 0.9 }, // Poderia animar isto

  instructionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#DC2626', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#FEE2E2', paddingBottom: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  checkText: { fontSize: 16, color: '#1F2937', flex: 1, fontWeight: '500' },

  footerActive: { marginTop: 20 },
  footerText: { color: '#FECACA', textAlign: 'center', marginBottom: 16, fontSize: 14 },
});