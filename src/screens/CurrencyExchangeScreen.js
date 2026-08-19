import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch, Modal, Image } from 'react-native';
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
import { exchangeRateService } from '../services/exchangeRateService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import NetInfo from '@react-native-community/netinfo';

const AccessLevelSwitch = ({ value, onChange, colors, responsive }) => {
  const levels = [
    { key: 'none', label: 'Sin acceso', icon: 'lock-closed' },
    { key: 'own_store', label: 'Mi tienda', icon: 'storefront' },
    { key: 'all_stores', label: 'Todas', icon: 'globe' },
  ];

  return (
    <View style={accessLevelSwitchStyles.container}>
      {levels.map((level, index) => (
        <TouchableOpacity
          key={level.key}
          style={[
            accessLevelSwitchStyles.iconButton,
            { 
              backgroundColor: value === level.key ? colors.primary : 'transparent',
              borderColor: value === level.key ? colors.primary : colors.outlineVariant,
            },
          ]}
          onPress={() => onChange(level.key)}
        >
          <Ionicons 
            name={level.icon} 
            size={18} 
            color={value === level.key ? '#fff' : colors.onSurface} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const accessLevelSwitchStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  const [entradaAccessLevels, setEntradaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [entradaManagePermissions, setEntradaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [salidaAccessLevels, setSalidaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [salidaManagePermissions, setSalidaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [applyWeightedAverageCost, setApplyWeightedAverageCost] = useState(false);
  const [autoApplySuggestedCost, setAutoApplySuggestedCost] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showEntradaModalAfterProductCreation, setShowEntradaModalAfterProductCreation] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showEntradaPermissions, setShowEntradaPermissions] = useState(false);
  const [showEntradaConfig, setShowEntradaConfig] = useState(false);
  const [showEntradaManage, setShowEntradaManage] = useState(false);
  const [showSalidaPermissions, setShowSalidaPermissions] = useState(false);
  const [showSalidaManage, setShowSalidaManage] = useState(false);
  const [customSalidaTypes, setCustomSalidaTypes] = useState([]);
  const [infoModal, setInfoModal] = useState({
    visible: false,
    title: '',
    description: '',
  });
  const [exchangeRates, setExchangeRates] = useState(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyModalConfig, setCurrencyModalConfig] = useState({
    datosModificar: 'ambos',
    modificarSoloServicios: false,
    tipoDatoModificar: 'usd',
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchConfig();
    // Cargar tasas automáticamente al inicio si hay conexión
    if (isConnected) {
      fetchExchangeRates();
    }
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      // Cargar tasas cuando se reconecta a internet
      if (state.isConnected && !isConnected) {
        fetchExchangeRates();
      }
    });

    return () => unsubscribe();
  }, []); // Solo se ejecuta al montar el componente

  const fetchExchangeRates = async (manualRetry = false) => {
    // Evitar reintentos si ya estamos cargando
    if (isLoadingRates) {
      return;
    }

    try {
      setIsLoadingRates(true);
      const data = await exchangeRateService.getExchangeRates();
      setExchangeRates(data);
    } catch (error) {
      console.warn('[ExchangeRates]', error.message);
      setExchangeRates(null);
      if (manualRetry) {
        showToast({ type: 'error', message: 'No se pudieron cargar las tasas de cambio' });
      }
    } finally {
      setIsLoadingRates(false);
    }
  };

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
      if (data.entradaAccessLevels) {
        setEntradaAccessLevels(data.entradaAccessLevels);
      }
      if (data.entradaManagePermissions) {
        setEntradaManagePermissions(data.entradaManagePermissions);
      }
      if (data.salidaAccessLevels) {
        setSalidaAccessLevels(data.salidaAccessLevels);
      }
      if (data.salidaManagePermissions) {
        setSalidaManagePermissions(data.salidaManagePermissions);
      }
      if (data.applyWeightedAverageCost !== undefined) {
        setApplyWeightedAverageCost(data.applyWeightedAverageCost);
      }
      if (data.autoApplySuggestedCost) {
        setAutoApplySuggestedCost(data.autoApplySuggestedCost);
      }
      if (data.showEntradaModalAfterProductCreation !== undefined) {
        setShowEntradaModalAfterProductCreation(data.showEntradaModalAfterProductCreation);
      }
      if (data.customSalidaTypes) {
        setCustomSalidaTypes(data.customSalidaTypes);
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

    // Show currency conversion modal
    setShowCurrencyModal(true);
  };

  const handleCurrencyModalConfirm = async () => {
    const rate = parseFloat(exchangeRate);
    
    try {
      setIsSaving(true);
      setShowCurrencyModal(false);

      // Invertir tipoDatoModificar porque el backend tiene la lógica invertida
      // Si el usuario quiere basar en USD (mantener USD, actualizar CUP), 
      // el backend espera 'cup' para actualizar CUP basándose en USD
      const invertedTipoDato = currencyModalConfig.tipoDatoModificar === 'usd' ? 'cup' : 'usd';

      const updatedConfig = {
        ...config,
        cupToUsdRate: rate,
        permissions: permissions,
        entradaAccessLevels: entradaAccessLevels,
        entradaManagePermissions: entradaManagePermissions,
        salidaAccessLevels: salidaAccessLevels,
        salidaManagePermissions: salidaManagePermissions,
        autoApplySuggestedCost: autoApplySuggestedCost,
        customSalidaTypes: customSalidaTypes,
        monedaConfig: {
          modificarSoloServicios: currencyModalConfig.modificarSoloServicios,
          datosModificar: currencyModalConfig.datosModificar,
          tipoDatoModificar: invertedTipoDato,
          monedaValor: rate,
        },
      };
      
      const response = await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      
      const message = response?.updatedServiciosTienda 
        ? `Configuración guardada. ${response.updatedServiciosTienda} servicios actualizados.`
        : 'Configuración guardada correctamente';
      
      showToast({ type: 'success', message });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCurrencyModalCancel = () => {
    setShowCurrencyModal(false);
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

  const updateEntradaAccessLevel = async (role, newLevel) => {
    const newEntradaAccessLevels = { ...entradaAccessLevels, [role]: newLevel };
    setEntradaAccessLevels(newEntradaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        entradaAccessLevels: newEntradaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a entradas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a entradas' });
      setEntradaAccessLevels(entradaAccessLevels);
    }
  };

  const toggleEntradaManagePermission = async (role) => {
    const newEntradaManagePermissions = { ...entradaManagePermissions, [role]: !entradaManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        entradaManagePermissions: newEntradaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de entradas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de entradas' });
    }
  };

  const toggleWeightedAverageCost = async () => {
    const newValue = !applyWeightedAverageCost;
    setApplyWeightedAverageCost(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        applyWeightedAverageCost: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de costo promedio actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración de costo promedio' });
      setApplyWeightedAverageCost(applyWeightedAverageCost);
    }
  };

  const toggleAutoApplySuggestedCost = async (role) => {
    const newAutoApplySuggestedCost = { ...autoApplySuggestedCost, [role]: !autoApplySuggestedCost[role] };
    setAutoApplySuggestedCost(newAutoApplySuggestedCost);
    
    try {
      const updatedConfig = {
        ...config,
        autoApplySuggestedCost: newAutoApplySuggestedCost,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de auto-aplicar costo sugerido actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de auto-aplicar costo sugerido' });
      setAutoApplySuggestedCost(autoApplySuggestedCost);
    }
  };

  const hasFullEntradaPermissions = (role) => {
    return entradaManagePermissions[role] === true && entradaAccessLevels[role] !== 'none';
  };

  const getRolesWithFullEntradaPermissions = () => {
    const roles = [];
    if (hasFullEntradaPermissions('dependiente')) roles.push('dependiente');
    if (hasFullEntradaPermissions('almacenero')) roles.push('almacenero');
    if (hasFullEntradaPermissions('economico')) roles.push('economico');
    return roles;
  };

  const toggleEntradaModalAfterProductCreation = async () => {
    const newValue = !showEntradaModalAfterProductCreation;
    setShowEntradaModalAfterProductCreation(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        showEntradaModalAfterProductCreation: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de pregunta de entrada actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración de pregunta de entrada' });
      setShowEntradaModalAfterProductCreation(showEntradaModalAfterProductCreation);
    }
  };

  const updateSalidaAccessLevel = async (role, newLevel) => {
    const newSalidaAccessLevels = { ...salidaAccessLevels, [role]: newLevel };
    setSalidaAccessLevels(newSalidaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        salidaAccessLevels: newSalidaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a salidas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a salidas' });
      setSalidaAccessLevels(salidaAccessLevels);
    }
  };

  const toggleSalidaManagePermission = async (role) => {
    const newSalidaManagePermissions = { ...salidaManagePermissions, [role]: !salidaManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        salidaManagePermissions: newSalidaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de salidas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de salidas' });
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
              {isConnected && (
                <View style={styles.exchangeRatesSection}>
                  <View style={styles.exchangeRatesHeader}>
                    <Ionicons name="cash" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.exchangeRatesTitle, { color: colors.onSurface }]}>
                      Tasas de Cambio en Vivo
                    </Text>
                    <TouchableOpacity onPress={() => fetchExchangeRates(true)} style={styles.refreshButton}>
                      <Ionicons 
                        name="refresh" 
                        size={responsive.responsiveWidth(18)} 
                        color={colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {isLoadingRates ? (
                    <View style={styles.ratesLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.ratesLoadingText, { color: colors.outline }]}>
                        Cargando tasas...
                      </Text>
                    </View>
                  ) : exchangeRates ? (
                    <View style={styles.ratesContainer}>
                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🇺🇸</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>USD</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Dólar Americano</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.USD, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🇪🇺</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>ECU</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Euro</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.ECU, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🏦</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>MLC</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Divisa Cubana</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.MLC, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>💵</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>USDT</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Tether TRC20</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.USDT_TRC20, 'CUP')}
                        </Text>
                      </View>

                      <Text style={[styles.ratesSource, { color: colors.outline }]}>
                        Fuente: elTOQUE • Actualizado: {exchangeRates.date} {exchangeRates.hour}:{exchangeRates.minutes.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.ratesErrorContainer}>
                      <Ionicons name="alert-circle" size={responsive.responsiveWidth(20)} color={colors.error} />
                      <Text style={[styles.ratesErrorText, { color: colors.error }]}>
                        No se pudieron cargar las tasas de cambio
                      </Text>
                    </View>
                  )}
                </View>
              )}

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

              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(24)} color={colors.primary} />
                  <Text style={[styles.infoTitle, { color: colors.onSurface }]}>
                    Información
                  </Text>
                </View>
                <Text style={[styles.infoText, { color: colors.outline }]}>
                  Esta configuración se utiliza para convertir precios de CUP a USD en toda la aplicación.
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
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/product.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Productos y Servicios
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowPermissions(!showPermissions)}
            >
              <Ionicons 
                name={showPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showPermissions && (
            <>
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

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/package-add.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Configuración de Entradas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowEntradaConfig(!showEntradaConfig)}
            >
              <Ionicons 
                name={showEntradaConfig ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showEntradaConfig && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el cálculo automático de costo promedio ponderado y el modal de entrada para nuevos productos
              </Text>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Aplicar Fórmula de Costo Promedio Ponderado
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Fórmula de Costo Promedio Ponderado',
                      'Cuando está activo, el costo de los productos se recalcula automáticamente al crear una entrada usando la fórmula: (costo_actual × cantidad_actual + costo_entrada × cantidad_entrada) / (cantidad_actual + cantidad_entrada)'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={applyWeightedAverageCost}
                  onValueChange={toggleWeightedAverageCost}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={applyWeightedAverageCost ? '#fff' : colors.outline}
                />
              </View>

              {applyWeightedAverageCost && getRolesWithFullEntradaPermissions().length > 0 && (
                <>
                  <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden aplicar automáticamente el costo sugerido por la fórmula sin confirmación
                  </Text>

                  {getRolesWithFullEntradaPermissions().includes('dependiente') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Dependiente',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.dependiente}
                        onValueChange={() => toggleAutoApplySuggestedCost('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}

                  {getRolesWithFullEntradaPermissions().includes('almacenero') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Almacenero',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.almacenero}
                        onValueChange={() => toggleAutoApplySuggestedCost('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}

                  {getRolesWithFullEntradaPermissions().includes('economico') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Económico',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.economico}
                        onValueChange={() => toggleAutoApplySuggestedCost('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Preguntar si Agregar Entrada al Crear Producto
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Pregunta de Entrada al Crear Producto',
                      'Cuando está activo, después de crear un nuevo producto se preguntará si deseas agregar una entrada de stock para ese producto (solo para usuarios con permisos de gestión de entradas).'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={showEntradaModalAfterProductCreation}
                  onValueChange={toggleEntradaModalAfterProductCreation}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={showEntradaModalAfterProductCreation ? '#fff' : colors.outline}
                />
              </View>
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/package-add.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Entradas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowEntradaPermissions(!showEntradaPermissions)}
            >
              <Ionicons 
                name={showEntradaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showEntradaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las entradas para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Entradas ni ninguna entrada del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Entradas pero solo las entradas de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Entradas y las entradas de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Entradas - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.dependiente}
              onChange={(newLevel) => updateEntradaAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
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
                  'Acceso a Entradas - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.almacenero}
              onChange={(newLevel) => updateEntradaAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
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
                  'Acceso a Entradas - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.economico}
              onChange={(newLevel) => updateEntradaAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(entradaAccessLevels.dependiente !== 'none' || entradaAccessLevels.almacenero !== 'none' || entradaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Entradas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowEntradaManage(!showEntradaManage)}
                >
                  <Ionicons 
                    name={showEntradaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showEntradaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar entradas (solo visible para roles con acceso)
                  </Text>
                  {entradaAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.dependiente}
                        onValueChange={() => toggleEntradaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {entradaAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.almacenero}
                        onValueChange={() => toggleEntradaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {entradaAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.economico}
                        onValueChange={() => toggleEntradaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/box.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Salidas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowSalidaPermissions(!showSalidaPermissions)}
            >
              <Ionicons 
                name={showSalidaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showSalidaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las salidas para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Salidas ni ninguna salida del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Salidas pero solo las salidas de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Salidas y las salidas de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Salidas - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.dependiente}
              onChange={(newLevel) => updateSalidaAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
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
                  'Acceso a Salidas - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.almacenero}
              onChange={(newLevel) => updateSalidaAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
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
                  'Acceso a Salidas - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.economico}
              onChange={(newLevel) => updateSalidaAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(salidaAccessLevels.dependiente !== 'none' || salidaAccessLevels.almacenero !== 'none' || salidaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Salidas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowSalidaManage(!showSalidaManage)}
                >
                  <Ionicons 
                    name={showSalidaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showSalidaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar salidas (solo visible para roles con acceso)
                  </Text>
                  {salidaAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.dependiente}
                        onValueChange={() => toggleSalidaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {salidaAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.almacenero}
                        onValueChange={() => toggleSalidaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {salidaAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.economico}
                        onValueChange={() => toggleSalidaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
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

      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCurrencyModalCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="swap-horizontal" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Actualizar Precios y Costos
              </Text>
            </View>
            
            <ScrollView 
              style={styles.currencyModalScrollView}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                La tasa de cambio ha cambiado. ¿Deseas actualizar los precios y/o costos de tus productos y servicios?
              </Text>

              <View style={styles.currencyModalSection}>
                <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                  ¿Qué deseas modificar?
                </Text>
                <View style={styles.currencyModalOptions}>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'precios' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'precios' })}
                  >
                    <Ionicons 
                      name="pricetag" 
                      size={20} 
                      color={currencyModalConfig.datosModificar === 'precios' ? '#fff' : colors.outline} 
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'precios' ? '#fff' : colors.onSurface }]}>
                      Solo Precios
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'costos' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'costos' })}
                  >
                    <Ionicons 
                      name="wallet" 
                      size={20} 
                      color={currencyModalConfig.datosModificar === 'costos' ? '#fff' : colors.outline} 
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'costos' ? '#fff' : colors.onSurface }]}>
                      Solo Costos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'ambos' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'ambos' })}
                  >
                    <Ionicons 
                      name="layers" 
                      size={20} 
                      color={currencyModalConfig.datosModificar === 'ambos' ? '#fff' : colors.outline} 
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'ambos' ? '#fff' : colors.onSurface }]}>
                      Ambos
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.currencyModalSection}>
                <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                  ¿Qué servicios actualizar?
                </Text>
                <View style={styles.currencyModalOptions}>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      !currencyModalConfig.modificarSoloServicios && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, modificarSoloServicios: false })}
                  >
                    <Ionicons 
                      name="apps" 
                      size={20} 
                      color={!currencyModalConfig.modificarSoloServicios ? '#fff' : colors.outline} 
                    />
                    <Text style={[styles.currencyModalOptionText, { color: !currencyModalConfig.modificarSoloServicios ? '#fff' : colors.onSurface }]}>
                      Todos (Productos + Servicios)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.modificarSoloServicios && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, modificarSoloServicios: true })}
                  >
                    <Ionicons 
                      name="list" 
                      size={20} 
                      color={currencyModalConfig.modificarSoloServicios ? '#fff' : colors.outline} 
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.modificarSoloServicios ? '#fff' : colors.onSurface }]}>
                      Solo Servicios (sin producto)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.currencyModalSection}>
                <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                  ¿Basar conversión en?
                </Text>
                <View style={styles.currencyModalOptions}>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.tipoDatoModificar === 'usd' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, tipoDatoModificar: 'usd' })}
                  >
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.tipoDatoModificar === 'usd' ? '#fff' : colors.onSurface }]}>
                      USD (Actualizar CUP)
                    </Text>
                    <Text style={[styles.currencyModalOptionSubtext, { color: currencyModalConfig.tipoDatoModificar === 'usd' ? '#fff' : colors.outline }]}>
                      CUP = USD × {exchangeRate}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.tipoDatoModificar === 'cup' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, tipoDatoModificar: 'cup' })}
                  >
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.tipoDatoModificar === 'cup' ? '#fff' : colors.onSurface }]}>
                      CUP (Actualizar USD)
                    </Text>
                    <Text style={[styles.currencyModalOptionSubtext, { color: currencyModalConfig.tipoDatoModificar === 'cup' ? '#fff' : colors.outline }]}>
                      USD = CUP / {exchangeRate}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.currencyModalButtons}>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={handleCurrencyModalCancel}
              >
                <Text style={[styles.currencyModalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={handleCurrencyModalConfirm}
              >
                <Text style={[styles.currencyModalButtonText, { color: '#fff' }]}>Aplicar Cambios</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  infoSection: {
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  permissionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  permissionsIcon: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
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
  accessLevelExplanation: {
    marginBottom: responsive.responsiveMargin(20),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  accessLevelExplanationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  accessLevelExplanationText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
    flex: 1,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  permissionSection: {
    marginTop: responsive.responsiveMargin(16),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  permissionSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  permissionSectionTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  permissionSectionSubtitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(16),
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    flex: 1,
    marginRight: responsive.responsiveMargin(16),
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
  exchangeRatesSection: {
    marginBottom: responsive.responsiveMargin(24),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  exchangeRatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(16),
  },
  exchangeRatesTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginLeft: responsive.responsiveMargin(8),
    flex: 1,
  },
  refreshButton: {
    padding: responsive.responsivePadding(8),
  },
  ratesLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  ratesLoadingText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  ratesContainer: {
    gap: responsive.responsiveMargin(12),
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
  },
  currencyFlag: {
    fontSize: responsive.responsiveFontSize(24),
  },
  currencyName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  currencyLabel: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
  },
  rateValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  ratesSource: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: responsive.responsiveMargin(8),
    fontStyle: 'italic',
  },
  ratesErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  ratesErrorText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  currencyModalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '100%',
    maxWidth: responsive.responsiveWidth(500),
    maxHeight: '90%',
  },
  currencyModalScrollView: {
    maxHeight: responsive.responsiveHeight(400),
    marginBottom: responsive.responsiveMargin(16),
  },
  currencyModalSubtitle: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  currencyModalSection: {
    marginBottom: responsive.responsiveMargin(20),
  },
  currencyModalSectionTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  currencyModalOptions: {
    gap: responsive.responsiveMargin(8),
  },
  currencyModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: responsive.responsiveMargin(12),
    backgroundColor: 'transparent',
  },
  currencyModalOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  currencyModalOptionSubtext: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  currencyModalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  currencyModalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyModalCancelButton: {
    borderWidth: 1,
  },
  currencyModalConfirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyModalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
