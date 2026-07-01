import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeArea } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const SettingsContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [serverIP, setServerIP] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const isDarkMode = isDark === true || isDark === 'true';

  // Cargar IP guardada al iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  const loadServerIP = async () => {
    try {
      const savedIP = await SecureStore.getItemAsync('serverIP');
      if (savedIP) {
        setServerIP(savedIP);
      }
    } catch (error) {
      console.error('Error loading server IP:', error);
    }
  };

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!serverIP.trim()) {
      Alert.alert('Error', 'Por favor ingrese una IP válida');
      return;
    }

    try {
      await SecureStore.setItemAsync('serverIP', serverIP.trim());
      Alert.alert('Éxito', 'IP del servidor guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la IP del servidor');
      console.error('Error saving server IP:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!serverIP.trim()) {
      Alert.alert('Error', 'Por favor ingrese una IP válida');
      return;
    }

    setIsTestingConnection(true);

    try {
      // Primero guardar temporalmente la IP para la prueba
      await SecureStore.setItemAsync('serverIP', serverIP.trim());
      
      // Hacer una petición de prueba al endpoint de documentación (siempre disponible)
      const response = await api.get('/api-docs', { timeout: 5000 });
      
      setIsTestingConnection(false);
      
      // Si responde (aunque sea 404 o cualquier código), el servidor está activo
      Alert.alert(
        'Conexión Exitosa',
        `El servidor en ${serverIP} está respondiendo correctamente.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setIsTestingConnection(false);
      
      // Si el error es por CORS o el endpoint no existe pero el servidor responde, es éxito
      if (error.response) {
        // El servidor respondió pero con un error (ej: 404, 500)
        Alert.alert(
          'Conexión Exitosa',
          `El servidor en ${serverIP} está activo y respondiendo.`,
          [{ text: 'OK' }]
        );
      } else if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
        Alert.alert(
          'Error de Conexión',
          `No se pudo conectar al servidor en ${serverIP}.\n\nVerifique que:\n- El servidor esté corriendo\n- La IP sea correcta\n- El puerto 4000 esté abierto`,
          [{ text: 'OK' }]
        );
      } else if (error.code === 'ETIMEDOUT') {
        Alert.alert(
          'Tiempo de Espera Agotado',
          `El servidor en ${serverIP} no respondió a tiempo.\n\nVerifique su conexión de red.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error de Conexión',
          `No se pudo conectar al servidor: ${error.message}`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <Header 
        onMenuPress={() => {}}
        isDark={isDarkMode}
        title="abacus"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            Configuración
          </Text>
          <Text style={[styles.subtitle, { color: colors.outline }]}>
            Gestione sus preferencias de conexión e infraestructura
          </Text>
        </View>

        {/* IP Server Card */}
        <View style={styles.cardContainer}>
          <Card style={[styles.ipCard, { backgroundColor: colors.surface }]}>
            <View style={styles.inputContainer}>
              <View style={styles.inputLabelContainer}>
                <Text style={[styles.inputLabel, { color: colors.outline }]}>
                  IP DEL SERVIDOR
                </Text>
              </View>
              
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  value={serverIP}
                  onChangeText={setServerIP}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.outline}
                  keyboardType="numeric"
                />
                <TouchableOpacity 
                  onPress={handleCopy}
                  style={styles.copyButton}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isCopied ? "checkmark" : "copy-outline"} 
                    size={20} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.helperText, { color: colors.outline }]}>
                Ingrese la IP estática o el nombre de host de su servidor de datos principal.
              </Text>
            </View>
          </Card>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              Guardar Cambios
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleTestConnection}
            style={[styles.button, styles.testButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            activeOpacity={0.8}
            disabled={isTestingConnection}
          >
            {isTestingConnection ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primary }]}>
                Probar Conexión
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Equalizer Graphic */}
        <View style={styles.equalizerContainer}>
          <View style={styles.equalizer}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <View
                key={item}
                style={[
                  styles.equalizerBar,
                  { 
                    backgroundColor: colors.primary,
                    height: 20 + (item * 8),
                    opacity: 0.3 + (item * 0.08)
                  }
                ]}
              />
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.outline }]}>
            PROTOCOLO ÁBACUS V1.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const SettingsScreen = () => {
  return <SettingsContent />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: 56,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 32,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  cardContainer: {
    marginBottom: 24,
  },
  ipCard: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    gap: 16,
  },
  inputLabelContainer: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  helperText: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  testButton: {
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 20,
  },
  equalizerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100,
  },
  equalizerBar: {
    width: 8,
    borderRadius: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
});
