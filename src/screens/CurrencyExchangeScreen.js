import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { configService } from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const CurrencyExchangeContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [config, setConfig] = useState({});
  const [permissions, setPermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [infoModal, setInfoModal] = useState({
    visible: false,
    title: '',
    description: '',
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      if (data.cupToUsdRate) {
        setExchangeRate(data.cupToUsdRate.toString());
      }
      if (data.permissions) {
        setPermissions(data.permissions);
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar configuración' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!exchangeRate.trim()) {
      showToast({ type: 'warning', message: 'El tipo de cambio es requerido' });
      return;
    }

    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      showToast({ type: 'warning', message: 'El tipo de cambio debe ser un número positivo' });
      return;
    }

    try {
      setIsSaving(true);
      const updatedConfig = {
        ...config,
        cupToUsdRate: rate,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración guardada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
    } finally {
      setIsSaving(false);
    }
  };

  const showInfoModal = (title, description) => {
    setInfoModal({ visible: true, title, description });
  };

  const closeInfoModal = () => {
    setInfoModal({ visible: false, title: '', description: '' });
  };

  const togglePermission = async (key) => {
    const newPermissions = { ...permissions, [key]: !permissions[key] };
    setPermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        permissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso' });
      setPermissions(permissions);
    }
  };

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
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
        isDark={isDarkMode}
        title="Configuraciones del Admin"
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="CurrencyExchange"
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando configuración...
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cambio CUP → USD *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Ej: 630"
                  value={exchangeRate}
                  onChangeText={setExchangeRate}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.helperText, { color: colors.outline }]}>
                  Ingresa el valor de 1 CUP en USD
                </Text>
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <Ionicons name="shield-checkmark" size={responsive.responsiveWidth(24)} color={colors.primary} />
            <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
              Permisos de Usuarios
            </Text>
          </View>
          <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
            Configura qué roles pueden ver productos y servicios de otras tiendas
          </Text>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Permiso Dependiente',
                  'Cuando está activo, los usuarios con rol Dependiente pueden ver productos y servicios de todas las tiendas, no solo la suya.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <Switch
              value={permissions.dependiente}
              onValueChange={() => togglePermission('dependiente')}
              trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              thumbColor={permissions.dependiente ? '#fff' : colors.outline}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Permiso Almacenero',
                  'Cuando está activo, los usuarios con rol Almacenero pueden ver productos y servicios de todas las tiendas, no solo la suya.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <Switch
              value={permissions.almacenero}
              onValueChange={() => togglePermission('almacenero')}
              trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              thumbColor={permissions.almacenero ? '#fff' : colors.outline}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Permiso Económico',
                  'Cuando está activo, los usuarios con rol Económico pueden ver productos y servicios de todas las tiendas, no solo la suya.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <Switch
              value={permissions.economico}
              onValueChange={() => togglePermission('economico')}
              trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              thumbColor={permissions.economico ? '#fff' : colors.outline}
            />
          </View>
        </Card>

        <Card style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={responsive.responsiveWidth(24)} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.onSurface }]}>
              Información
            </Text>
          </View>
          <Text style={[styles.infoText, { color: colors.outline }]}>
            Esta configuración se utiliza para convertir precios de CUP a USD en toda la aplicación.
          </Text>
        </Card>
      </ScrollView>

      <Modal
        visible={infoModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeInfoModal}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="information-circle" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                {infoModal.title}
              </Text>
            </View>
            <Text style={[styles.modalDescription, { color: colors.outline }]}>
              {infoModal.description}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={closeInfoModal}
            >
              <Text style={[styles.modalButtonText, { color: '#fff' }]}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export const CurrencyExchangeScreen = () => <CurrencyExchangeContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    marginTop: responsive.responsiveMargin(55),
    marginBottom: responsive.responsiveMargin(16),
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(24),
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  helperText: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  infoCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  infoTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  infoText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
  },
  permissionsCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    marginBottom: responsive.responsiveMargin(16),
  },
  permissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  permissionsTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  permissionsSubtitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    flex: 1,
  },
  permissionLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  infoButton: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '100%',
    maxWidth: responsive.responsiveWidth(400),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(16),
  },
  modalTitle: {
    fontSize: responsive.fontSizes.h6,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  modalDescription: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.5,
    marginBottom: responsive.responsiveMargin(24),
  },
  modalButton: {
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
