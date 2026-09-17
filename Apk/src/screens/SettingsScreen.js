import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeArea } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { useResponsive } from '../hooks/useResponsive';
import { API_CONFIG } from '../config';

const SettingsContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serverIP, setServerIP] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const isDarkMode = isDark === true || isDark === 'true';
  const fromLogin = route.params?.from === 'Login';

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Cargar IP guardada al iniciar
  useEffect(() => {
    loadServerIP();
    checkVersionError();
  }, []);

  const checkVersionError = async () => {
    try {
      const versionError = await SecureStore.getItemAsync('versionError');
      if (versionError) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'PasswordRecovery' }],
        });
      }
    } catch (error) {
      // Error checking version error
    }
  };

  const loadServerIP = async () => {
    try {
      const savedURL = await SecureStore.getItemAsync('serverIP');
      if (savedURL) {
        setServerIP(savedURL);
      } else {
        // Fallback a config.js si no hay valor guardado
        setServerIP(API_CONFIG.API_BASE_URL || '');
      }
    } catch (error) {
      // Fallback a config.js en caso de error
      setServerIP(API_CONFIG.API_BASE_URL || '');
    }
  };

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!serverIP.trim()) {
      showToast({ type: 'warning', message: 'Por favor ingrese una URL válida' });
      return;
    }

    try {
      await SecureStore.setItemAsync('serverIP', serverIP.trim());
      showToast({ type: 'success', message: 'URL del servidor guardada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'No se pudo guardar la URL del servidor' });
    }
  };

  const handleTestConnection = async () => {
    if (!serverIP.trim()) {
      showToast({ type: 'warning', message: 'Por favor ingrese una URL válida' });
      return;
    }

    setIsTestingConnection(true);

    try {
      await SecureStore.setItemAsync('serverIP', serverIP.trim());
      const response = await api.get('/api-docs', { timeout: 5000 });
      setIsTestingConnection(false);
      showToast({
        type: 'success',
        message: `El servidor en ${serverIP} está respondiendo correctamente.`,
      });
    } catch (error) {
      setIsTestingConnection(false);

      if (error.response) {
        showToast({
          type: 'success',
          message: `El servidor en ${serverIP} está activo y respondiendo.`,
          code: error.response.status,
        });
      } else if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
        showToast({
          type: 'error',
          message: `No se pudo conectar al servidor en ${serverIP}. Verifique que esté corriendo y la URL sea correcta.`,
          code: error.code ?? null,
        });
      } else if (error.code === 'ETIMEDOUT') {
        showToast({
          type: 'warning',
          message: `El servidor en ${serverIP} no respondió a tiempo. Verifique su conexión de red.`,
          code: 'ETIMEDOUT',
        });
      } else {
        showToast({
          type: 'error',
          message: `No se pudo conectar al servidor: ${error.message}`,
          code: error.code ?? null,
        });
      }
    }
  };

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <Header 
        onMenuPress={() => setSidebarOpen(true)}
        onThemePress={toggleTheme}
        onSettingsPress={undefined}
        onNotificationsPress={fromLogin ? undefined : handleNotificationsPress}
        onProfilePress={fromLogin ? undefined : handleProfilePress}
        showBackButton={fromLogin}
        onBackPress={handleBackPress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="Settings"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
        keyboardVerticalOffset={responsive.headerHeight + 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Configuraciones</Text>
        </View>

        {/* Header Section */}
        <View style={styles.headerSection}>
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
                  URL DE LA API
                </Text>
              </View>
              
              <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  value={serverIP}
                  onChangeText={setServerIP}
                  placeholder="http://192.168.1.100:4000"
                  placeholderTextColor={colors.outline}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  onPress={handleCopy}
                  style={styles.copyButton}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isCopied ? "checkmark" : "copy-outline"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.helperText, { color: colors.outline }]}>
                Ingrese la URL completa de la API del servidor (ej: http://192.168.1.100:4000).
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const SettingsScreen = () => {
  return <SettingsContent />;
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: responsive.headerHeight,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(0),
    marginTop: responsive.responsiveMargin(40),
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  headerSection: {
    marginBottom: responsive.responsiveMargin(32),
    paddingTop: 8,
  },
  title: {
    fontSize: responsive.fontSizes.h1,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.h1 * 1.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodyLarge * 1.5,
  },
  cardContainer: {
    marginBottom: responsive.responsiveMargin(24),
  },
  ipCard: {
    borderRadius: 16,
    padding: responsive.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    gap: responsive.responsiveMargin(16),
  },
  inputLabelContainer: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: responsive.fontSizes.caption,
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
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(14),
  },
  input: {
    flex: 1,
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  helperText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  buttonContainer: {
    flexDirection: responsive.isSmall ? 'column' : 'row',
    gap: responsive.gridGap,
    marginBottom: responsive.responsiveMargin(40),
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
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  equalizerContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(24),
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
    fontSize: responsive.fontSizes.caption,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
});
