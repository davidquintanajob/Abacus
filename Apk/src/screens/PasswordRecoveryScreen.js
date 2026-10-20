import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import * as SecureStore from 'expo-secure-store';
import packageJson from '../../package.json';

const PasswordRecoveryContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const [versionError, setVersionError] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    checkVersionError();
  }, []);

  const checkVersionError = async () => {
    try {
      const errorJson = await SecureStore.getItemAsync('versionError');
      if (errorJson) {
        const error = JSON.parse(errorJson);
        setVersionError(error);
      }
    } catch (error) {
      // Error reading version error
    }
  };

  const handleCallSupport = async () => {
    const phoneNumber = '+5356242671';
    
    if (!phoneNumber) {
      showToast({
        type: 'error',
        message: 'Teléfono no disponible',
      });
      return;
    }

    if (Platform.OS === 'web') {
      showToast({
        type: 'warning',
        message: 'Llamadas no están soportadas en la versión web.',
      });
      return;
    }

    const normalized = String(phoneNumber).replace(/[^0-9+]/g, '');
    const url = `tel:${normalized}`;

    try {
      // Intentar abrir directamente: en algunos entornos de desarrollo
      // canOpenURL puede devolver false aunque openURL funcione en un dispositivo real.
      await Linking.openURL(url);
      return;
    } catch (err) {
      // Intentar canOpenURL como fallback informativo
      try {
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch (e2) {
        // canOpenURL failed
      }
      showToast({
        type: 'error',
        message: 'No se puede abrir la app de llamadas en este dispositivo. Para llamar al soporte técnico (+53 56242671), abra manualmente la app de teléfono.',
      });
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
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {versionError ? (
          <>
            {/* Version Error Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: '#EF4444' }]}>
                Actualización Requerida
              </Text>
            </View>

            {/* Error Icon */}
            <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons 
                name="warning-outline" 
                size={responsive.responsiveWidth(80)} 
                color="#EF4444" 
              />
            </View>

            {/* Error Title */}
            <Text style={[styles.title, { color: colors.onSurface }]}>
              Versión Incompatible
            </Text>

            {/* Error Description */}
            <View style={styles.descriptionContainer}>
              <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
                {versionError.message}
              </Text>
              
              <View style={[styles.versionInfo, { backgroundColor: colors.surface }]}>
                <View style={styles.versionItem}>
                  <Text style={[styles.versionLabel, { color: colors.outline }]}>
                    Versión actual:
                  </Text>
                  <Text style={[styles.versionValue, { color: colors.onSurface }]}>
                    {versionError.currentVersion}
                  </Text>
                </View>
              </View>

              <Text style={[styles.note, { color: colors.outline }]}>
                Por favor, actualiza la aplicación a la última versión para continuar usando el sistema. Contacta al soporte técnico si necesitas ayuda.
              </Text>
            </View>

            {/* Call Support Button */}
            <TouchableOpacity
              onPress={handleCallSupport}
              style={[styles.callButton, { backgroundColor: '#EF4444' }]}
              activeOpacity={0.8}
            >
              <Ionicons
                name="call-outline"
                size={responsive.responsiveWidth(24)}
                color="#fff"
                style={styles.callIcon}
              />
              <Text style={[styles.callButtonText, { color: '#fff' }]}>
                Llamar al Soporte
              </Text>
              <Text style={[styles.callButtonSubtext, { color: '#fff' }]}>
                +53 56242671
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons 
                  name="arrow-back" 
                  size={responsive.responsiveWidth(24)} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                Recuperar Contraseña
              </Text>
            </View>

            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={responsive.responsiveWidth(80)} 
                color={colors.primary} 
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.onSurface }]}>
              ¿Olvidaste tu contraseña?
            </Text>

            {/* Description */}
            <View style={styles.descriptionContainer}>
              <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
                Para restablecer tu contraseña, por favor comunícate con:
              </Text>
              
              <View style={styles.listItem}>
                <Ionicons 
                  name="person-outline" 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.primary} 
                  style={styles.listIcon}
                />
                <Text style={[styles.listText, { color: colors.onSurface }]}>
                  Tu administrador o jefe del negocio
                </Text>
              </View>
              
              <View style={styles.listItem}>
                <Ionicons 
                  name="headset-outline" 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.primary} 
                  style={styles.listIcon}
                />
                <Text style={[styles.listText, { color: colors.onSurface }]}>
                  El soporte técnico
                </Text>
              </View>

              <Text style={[styles.note, { color: colors.outline }]}>
                Por razones de seguridad, no puedes restablecer tu contraseña por ti mismo. El administrador te asignará una nueva contraseña temporal que podrás cambiar después de iniciar sesión.
              </Text>
            </View>

            {/* Call Support Button */}
            <TouchableOpacity
              onPress={handleCallSupport}
              style={[styles.callButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="call-outline" 
                size={responsive.responsiveWidth(24)} 
                color={colors.onPrimary} 
                style={styles.callIcon}
              />
              <Text style={[styles.callButtonText, { color: colors.onPrimary }]}>
                Llamar al Soporte
              </Text>
              <Text style={[styles.callButtonSubtext, { color: colors.onPrimary }]}>
                +53 56242671
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const PasswordRecoveryScreen = () => {
  return <PasswordRecoveryContent />;
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: responsive.horizontalPadding,
    paddingVertical: responsive.responsivePadding(40),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(32),
  },
  backButton: {
    padding: 8,
    marginRight: responsive.responsiveMargin(12),
  },
  headerTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  iconContainer: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: responsive.responsiveMargin(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: responsive.responsiveFontSize(28),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    textAlign: 'center',
    marginBottom: responsive.responsiveMargin(24),
    lineHeight: responsive.responsiveFontSize(28) * 1.25,
  },
  descriptionContainer: {
    marginBottom: responsive.responsiveMargin(32),
  },
  description: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.5,
    marginBottom: responsive.responsiveMargin(20),
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: responsive.responsiveMargin(16),
  },
  listIcon: {
    marginRight: responsive.responsiveMargin(12),
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.5,
  },
  note: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.5,
    marginTop: responsive.responsiveMargin(24),
    fontStyle: 'italic',
  },
  versionInfo: {
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(20),
  },
  versionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  versionValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(20),
    paddingHorizontal: responsive.responsivePadding(24),
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callIcon: {
    marginRight: responsive.responsiveMargin(12),
  },
  callButtonText: {
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  callButtonSubtext: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '400',
    fontFamily: 'Inter',
  },
});
