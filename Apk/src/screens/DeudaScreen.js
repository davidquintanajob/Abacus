import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { useViewMode } from '../context/ViewModeContext';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDeudas, saldarDeuda, deleteDeuda } from '../services/deudaService';
import { getCuentas } from '../services/cuentaService';
import { exchangeRateService } from '../services/exchangeRateService';
import configService from '../services/configService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Función para formatear números con separación de miles
const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).replace(/\./g, ' ').replace(/,/g, '.');
};

const DeudaScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { user, deudaAccessLevels, deudaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [deudas, setDeudas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);
  
  // Estado para colapsables de deudas
  const [expandedDeudas, setExpandedDeudas] = useState({});
  
  // Estado para modal de agregar pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState(null);
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [isLoadingPagoModal, setIsLoadingPagoModal] = useState(false);
  const [loadingDeudaId, setLoadingDeudaId] = useState(null);
  const formasPago = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];
  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    cambio_moneda: '',
    nota: '',
    fecha: new Date(),
    hora: new Date(),
  });

  // Filtros
  const [filters, setFilters] = useState({
    nombre_cliente: '',
    telefono_cliente: '',
    fecha_desde: '',
    fecha_hasta: '',
    monto_cup_min: '',
    monto_cup_max: '',
    monto_usd_min: '',
    monto_usd_max: '',
    tiene_deuda: '',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showEstadoDeudaDropdown, setShowEstadoDeudaDropdown] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const toggleDeudaExpand = (deudaId) => {
    setExpandedDeudas(prev => ({
      ...prev,
      [deudaId]: !prev[deudaId]
    }));
  };

  const handleAddPago = async (deuda) => {
    setSelectedDeuda(deuda);
    setLoadingDeudaId(deuda.id_deuda);
    setIsLoadingPagoModal(true);
    // Cargar cuentas disponibles
    try {
      const cuentasData = await getCuentas({}, 1, 1000);
      let allCuentas = cuentasData.data || [];
      
      // Filtrar cuentas por tienda del usuario si tiene permisos de gestión
      if (user?.id_tienda) {
        try {
          const config = await configService.getConfig();
          const tiendaCuentasConfig = config.tiendaCuentasConfig || {};
          const tiendaConfig = tiendaCuentasConfig[user.id_tienda];
          
          if (tiendaConfig) {
            // Obtener todas las cuentas permitidas para esta tienda
            const cuentasPermitidas = [
              ...(tiendaConfig.efectivo_cup || []),
              ...(tiendaConfig.efectivo_usd || []),
              ...(tiendaConfig.transferencia_cup || []),
              ...(tiendaConfig.transferencia_usd || []),
            ];
            
            // Filtrar cuentas para mostrar solo las permitidas
            const cuentaIdsPermitidos = new Set(cuentasPermitidas.map(c => c.id_cuenta));
            allCuentas = allCuentas.filter(cuenta => cuentaIdsPermitidos.has(cuenta.id_cuenta));
          }
        } catch (error) {
          console.error('Error al cargar configuración de cuentas por tienda:', error);
          // Si falla, mostrar todas las cuentas
        }
      }
      
      setCuentas(allCuentas);
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
      setCuentas([]);
    }
    // Cargar tasas de cambio (opcional, usar valor por defecto si falla)
    let defaultCambio = '1.0';
    try {
      // Primero intentar obtener de configService (el configurado manualmente)
      const config = await configService.getConfig();
      if (config.cupToUsdRate) {
        defaultCambio = config.cupToUsdRate.toString();
      } else {
        // Si no está configurado, usar el de exchangeRateService
        const rates = await exchangeRateService.getExchangeRates();
        setExchangeRates(rates);
        defaultCambio = rates?.tasas?.USD || '1.0';
      }
    } catch (error) {
      // Silenciar error de tasas de cambio y usar valor por defecto
      console.warn('No se pudieron cargar las tasas de cambio, usando valor por defecto');
      setExchangeRates(null);
    }
    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      cambio_moneda: defaultCambio,
      nota: '',
      fecha: new Date(),
      hora: new Date(),
    });
    setLoadingDeudaId(null);
    setIsLoadingPagoModal(false);
    setShowPagoModal(true);
  };

  const handleSavePago = async () => {
    if (!pagoFormData.cantidad_pagada || pagoFormData.cantidad_pagada.trim() === '') {
      showToast({ type: 'warning', message: 'La cantidad es obligatoria' });
      return;
    }
    if (isNaN(pagoFormData.cantidad_pagada) || parseFloat(pagoFormData.cantidad_pagada) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que cero' });
      return;
    }
    if (!pagoFormData.forma_pago || pagoFormData.forma_pago.trim() === '') {
      showToast({ type: 'warning', message: 'La forma de pago es obligatoria' });
      return;
    }
    if (!['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'].includes(pagoFormData.forma_pago)) {
      showToast({ type: 'warning', message: 'Forma de pago inválida' });
      return;
    }
    if (!pagoFormData.id_cuenta_operacion || pagoFormData.id_cuenta_operacion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta de operación' });
      return;
    }

    try {
      // Usar fecha y hora actual del dispositivo
      const fechaHora = new Date();

      const pago = {
        cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
        forma_pago: pagoFormData.forma_pago,
        cambio_moneda: 1,
        id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
        fecha_hora: fechaHora,
        nota: pagoFormData.nota || null
      };

      await saldarDeuda(selectedDeuda.id_deuda, [pago]);
      showToast({ type: 'success', message: 'Pago registrado correctamente' });
      setShowPagoModal(false);
      fetchDeudas();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    }
  };

  const fetchDeudas = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setDeudas([]);
        setIsLoading(false);
        return;
      }

      const filtersToUse = overrideFilters || filters;
      const apiFilters = { ...filtersToUse };

      // Remove empty filters to avoid API errors
      if (!apiFilters.nombre_cliente) delete apiFilters.nombre_cliente;
      if (!apiFilters.telefono_cliente) delete apiFilters.telefono_cliente;
      if (!apiFilters.fecha_desde) delete apiFilters.fecha_desde;
      if (!apiFilters.fecha_hasta) delete apiFilters.fecha_hasta;
      if (apiFilters.monto_cup_min === '' || apiFilters.monto_cup_min === undefined) delete apiFilters.monto_cup_min;
      else apiFilters.monto_cup_min = parseFloat(apiFilters.monto_cup_min);
      if (apiFilters.monto_cup_max === '' || apiFilters.monto_cup_max === undefined) delete apiFilters.monto_cup_max;
      else apiFilters.monto_cup_max = parseFloat(apiFilters.monto_cup_max);
      if (apiFilters.monto_usd_min === '' || apiFilters.monto_usd_min === undefined) delete apiFilters.monto_usd_min;
      else apiFilters.monto_usd_min = parseFloat(apiFilters.monto_usd_min);
      if (apiFilters.monto_usd_max === '' || apiFilters.monto_usd_max === undefined) delete apiFilters.monto_usd_max;
      else apiFilters.monto_usd_max = parseFloat(apiFilters.monto_usd_max);
      if (apiFilters.tiene_deuda === '' || apiFilters.tiene_deuda === undefined) delete apiFilters.tiene_deuda;
      else apiFilters.tiene_deuda = apiFilters.tiene_deuda === 'true';

      const data = await getDeudas(apiFilters, pagination.currentPage, pagination.limit);
      let deudas = data.data || [];

      // Calcular saldada y monto_restante total
      deudas = deudas.map(deuda => {
        const saldada = deuda.monto_restante_cup === 0 && deuda.monto_restante_usd === 0;
        return { ...deuda, saldada };
      });

      setDeudas(deudas);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchDeudas();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchDeudas();
    }, [])
  );

  useEffect(() => {
    if (pagination.currentPage > 1) {
      fetchDeudas();
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchDeudas();
  }, [filters.tiene_deuda]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchDeudas();
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      nombre_cliente: '',
      telefono_cliente: '',
      fecha_desde: '',
      fecha_hasta: '',
      monto_cup_min: '',
      monto_cup_max: '',
      monto_usd_min: '',
      monto_usd_max: '',
      tiene_deuda: '',
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchDeudas(clearedFilters);
  };

  const handleDelete = (deuda) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Deuda',
      `¿Estás seguro de que quieres eliminar esta deuda?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeuda(deuda.id_deuda);
              showToast({ type: 'success', message: 'Deuda eliminada correctamente' });
              fetchDeudas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewDeudas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaAccessLevels?.dependiente === 'ambos') ||
    (userRole === 'almacenero' && deudaAccessLevels?.almacenero === 'ambos') ||
    (userRole === 'económico' && deudaAccessLevels?.economico === 'ambos');

  const canManageDeudas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaManagePermissions?.dependiente && deudaAccessLevels?.dependiente === 'ambos') ||
    (userRole === 'almacenero' && deudaManagePermissions?.almacenero && deudaAccessLevels?.almacenero === 'ambos') ||
    (userRole === 'económico' && deudaManagePermissions?.economico && deudaAccessLevels?.economico === 'ambos');

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title="Abacus"
          onMenuPress={() => setSidebarOpen(true)}
          onThemePress={toggleTheme}
          onSettingsPress={undefined}
          onNotificationsPress={() => navigation.navigate('Notifications')}
          onProfilePress={() => navigation.navigate('UserProfile')}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode}
          isChangingView={isChangingView}
          isDark={isDarkMode}
          showLogo={true}
        />
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigation}
          currentRoute="Deudas"
        />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Deudas</Text>
        </View>

        {/* Filter Section */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Ionicons 
                name={showAdvancedFilters ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre del Cliente</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre_cliente}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_cliente: text }))}
            />
          </View>

          {showAdvancedFilters ? (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por teléfono..."
                  value={filters.telefono_cliente}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, telefono_cliente: text }))}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto CUP Mín</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Mínimo..."
                    value={filters.monto_cup_min}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, monto_cup_min: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto CUP Máx</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Máximo..."
                    value={filters.monto_cup_max}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, monto_cup_max: text }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto USD Mín</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Mínimo..."
                    value={filters.monto_usd_min}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, monto_usd_min: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto USD Máx</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Máximo..."
                    value={filters.monto_usd_max}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, monto_usd_max: text }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado de Deuda</Text>
                <View style={styles.statusFilterSwitches}>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, tiene_deuda: '' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.tiene_deuda === '' ? '#9E9E9E' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.tiene_deuda === '' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.tiene_deuda === '' ? '#9E9E9E' : '#9E9E9E' }
                        ]}>
                          Todas
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, tiene_deuda: 'true' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.tiene_deuda === 'true' ? '#4CAF50' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.tiene_deuda === 'true' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.tiene_deuda === 'true' ? '#4CAF50' : '#9E9E9E' }
                        ]}>
                          Pendiente
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, tiene_deuda: 'false' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.tiene_deuda === 'false' ? '#2196F3' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.tiene_deuda === 'false' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.tiene_deuda === 'false' ? '#2196F3' : '#9E9E9E' }
                        ]}>
                          Saldada
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, styles.clearButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              onPress={handleClearFilters}
            >
              <Ionicons name="refresh-outline" size={responsive.responsiveWidth(18)} color={colors.onSurface} />
              <Text style={[styles.filterButtonText, { color: colors.onSurface }]}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search-outline" size={responsive.responsiveWidth(18)} color="#fff" />
                  <Text style={[styles.filterButtonText, { color: '#fff' }]}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Leyenda de colores de deuda */}
        <View style={[styles.legendContainer, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <Text style={[styles.legendTitle, { color: colors.onSurface }]}>Leyenda de colores:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: isDarkMode ? 'rgba(156, 39, 176, 0.3)' : '#F3E5F5' }]} />
              <Text style={[styles.legendText, { color: colors.onSurface }]}>Deuda con venta asociada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.3)' : '#E8F5E9' }]} />
              <Text style={[styles.legendText, { color: colors.onSurface }]}>Deuda saldada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.3)' : '#F0F4FF' }]} />
              <Text style={[styles.legendText, { color: colors.onSurface }]}>Deuda pendiente</Text>
            </View>
          </View>
          <Text style={[styles.legendTitle, { color: colors.onSurface, marginTop: 12 }]}>Alertas:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendFlag, { backgroundColor: colors.error }]}>
                <Ionicons name="alert-circle" size={responsive.responsiveWidth(14)} color="#fff" />
              </View>
              <Text style={[styles.legendText, { color: colors.onSurface }]}>Deuda pendiente de pago</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendFlag, { backgroundColor: '#2196F3' }]}>
                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
              </View>
              <Text style={[styles.legendText, { color: colors.onSurface }]}>Deuda con nota</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('DeudaForm', { mode: 'add' })}
          >
            <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Nueva Deuda</Text>
          </TouchableOpacity>
        </View>

        {/* Deudas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando deudas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Clientes')}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Ir a Clientes</Text>
            </TouchableOpacity>
          </Card>
        ) : deudas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay deudas registradas
            </Text>
          </View>
        ) : (
          <>
            {deudas.map((deuda) => (
              <Card 
                key={deuda.id_deuda} 
                style={[
                  styles.deudaCard, 
                  { 
                    backgroundColor: deuda.id_lista_venta
                      ? isDarkMode ? 'rgba(156, 39, 176, 0.1)' : '#F3E5F5'
                      : deuda.saldada 
                        ? isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9' 
                        : isDarkMode ? 'rgba(33, 150, 243, 0.1)' : '#F0F4FF',
                    borderColor: deuda.id_lista_venta
                      ? '#9C27B0'
                      : deuda.saldada ? '#4CAF50' : '#2196F3'
                  }
                ]}
              >
                <TouchableOpacity 
                  onPress={() => toggleDeudaExpand(deuda.id_deuda)}
                  activeOpacity={0.7}
                >
                  {/* Flags container */}
                  <View style={styles.deudaFlags}>
                    {!deuda.saldada ? (
                      <View style={[styles.deudaPendingFlag, { backgroundColor: colors.error }]}>
                        <Ionicons name="alert-circle" size={responsive.responsiveWidth(14)} color="#fff" />
                      </View>
                    ) : null}
                    {deuda.nota ? (
                      <View style={[styles.deudaNoteFlag, { backgroundColor: '#2196F3' }]}>
                        <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                      </View>
                    ) : null}
                  </View>

                  {/* Deuda Header */}
                  <View style={styles.deudaHeader}>
                    <View style={styles.deudaHeaderLeft}>
                      <View style={[
                        styles.deudaStatusBadge,
                        { backgroundColor: deuda.saldada ? '#4CAF50' : '#2196F3' }
                      ]}>
                        <Ionicons 
                          name={deuda.saldada ? "checkmark-circle" : "time-outline"} 
                          size={responsive.responsiveWidth(16)} 
                          color="#fff" 
                        />
                      </View>
                      <View style={styles.deudaInfo}>
                        <Text style={[styles.deudaClienteName, { color: colors.onSurface }]}>
                          {deuda.cliente?.nombre || 'Cliente'}
                        </Text>
                        <Text style={[styles.deudaFecha, { color: colors.outline }]}>
                          {new Date(deuda.fecha_hora).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.deudaHeaderActions}>
                      {canManageDeudas ? (
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            navigation.navigate('DeudaForm', { deuda, mode: 'edit' });
                          }}
                        >
                          <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                      {canManageDeudas ? (
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(deuda);
                          }}
                        >
                          <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                        </TouchableOpacity>
                      ) : null}
                      {(!deuda.saldada && canManageDeudas) ? (
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, { backgroundColor: colors.primary }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAddPago(deuda);
                          }}
                          disabled={loadingDeudaId !== null}
                        >
                          {loadingDeudaId === deuda.id_deuda ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                          )}
                        </TouchableOpacity>
                      ) : null}
                      <Ionicons 
                        name={expandedDeudas[deuda.id_deuda] ? "chevron-up" : "chevron-down"} 
                        size={responsive.responsiveWidth(24)} 
                        color={colors.outline} 
                      />
                    </View>
                  </View>

                  {/* Deuda Details */}
                  <View style={styles.deudaDetails}>
                    <Text style={[styles.deudaAmountLabel, { color: colors.outline }]}>Monto deuda:</Text>
                    {(deuda.monto_cup && parseFloat(deuda.monto_cup) > 0) ? (
                      <Text style={[styles.deudaAmountValue, { color: colors.onSurface }]}>
                        CUP = ${formatNumber(deuda.monto_cup)}
                      </Text>
                    ) : null}
                    {(deuda.monto_usd && parseFloat(deuda.monto_usd) > 0) ? (
                      <Text style={[styles.deudaAmountValue, { color: colors.onSurface }]}>
                        USD = ${formatNumber(deuda.monto_usd)}
                      </Text>
                    ) : null}
                    
                    {!deuda.saldada && (
                      <>
                        <Text style={[styles.deudaAmountLabel, { color: colors.outline, marginTop: 8 }]}>Restante:</Text>
                        {(deuda.monto_restante_cup && parseFloat(deuda.monto_restante_cup) > 0) ? (
                          <Text style={[
                            styles.deudaAmountValue,
                            {
                              color: (deuda.monto_restante_cup || 0) > 0 ? colors.error : '#4CAF50',
                              fontWeight: '700'
                            }
                          ]}>
                            CUP = ${formatNumber(deuda.monto_restante_cup)}
                          </Text>
                        ) : null}
                        {(deuda.monto_restante_usd && parseFloat(deuda.monto_restante_usd) > 0) ? (
                          <Text style={[
                            styles.deudaAmountValue,
                            {
                              color: (deuda.monto_restante_usd || 0) > 0 ? colors.error : '#4CAF50',
                              fontWeight: '700'
                            }
                          ]}>
                            USD = ${formatNumber(deuda.monto_restante_usd)}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>

                  {/* Pagos List (Expanded) */}
                  {(expandedDeudas[deuda.id_deuda] && deuda.pagos && deuda.pagos.length > 0) ? (
                    <View style={styles.pagosContainer}>
                      <Text style={[styles.pagosTitle, { color: colors.onSurface }]}>
                        {`Pagos Realizados (${deuda.pagos.length})`}
                      </Text>
                      {console.log('[DeudaScreen] Pagos:', deuda.pagos)}
                      {deuda.pagos.map((pago) => (
                        <View key={pago.id_pago_deuda} style={[styles.pagoItem, { backgroundColor: colors.surface }]}>
                          <View style={styles.pagoHeader}>
                            <Text style={[styles.pagoFecha, { color: colors.outline }]}>
                              {new Date(pago.fecha_hora).toLocaleString()}
                            </Text>
                            <Text style={[styles.pagoCantidad, { color: colors.primary }]}>
                              ${formatNumber(pago.cantidad_pagada)}
                            </Text>
                          </View>
                          <View style={styles.pagoDetails}>
                            <Text style={[styles.pagoForma, { color: colors.onSurface }]}>
                              {`Forma: ${pago.forma_pago || 'No especificada'}`}
                            </Text>
                            {(pago.nota || pago.operacion?.motivo) && (
                              <Text style={[styles.pagoNota, { color: colors.outline }]}>
                                {pago.nota || pago.operacion?.motivo}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Card>
            ))}
          </>
        )}
        </ScrollView>

      {/* Modal para agregar pago */}
      <Modal
        visible={showPagoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPagoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Agregar Pago
              </Text>
              <TouchableOpacity onPress={() => setShowPagoModal(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cantidad a Pagar *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Cantidad"
                  value={pagoFormData.cantidad_pagada}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, cantidad_pagada: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Forma de Pago *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: pagoFormData.forma_pago ? colors.onSurface : colors.outline }]}>
                    {pagoFormData.forma_pago || 'Seleccionar forma de pago'}
                  </Text>
                  <Ionicons 
                    name={showFormaPagoDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showFormaPagoDropdown ? (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {formasPago.map((forma, index) => (
                      <TouchableOpacity
                        key={forma}
                        style={[styles.dropdownItem, index === formasPago.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setPagoFormData(prev => ({ ...prev, forma_pago: forma }));
                          setShowFormaPagoDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{forma}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta de Operación *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowCuentaDropdown(!showCuentaDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: pagoFormData.id_cuenta_operacion ? colors.onSurface : colors.outline }]}>
                    {pagoFormData.id_cuenta_operacion
                      ? String(cuentas.find(c => c.id_cuenta === parseInt(pagoFormData.id_cuenta_operacion))?.nombre || 'Cuenta seleccionada')
                      : 'Seleccionar cuenta'}
                  </Text>
                  <Ionicons 
                    name={showCuentaDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showCuentaDropdown ? (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {cuentas
                      .filter(cuenta => !pagoFormData.forma_pago || cuenta.tipo_cuenta === pagoFormData.forma_pago)
                      .map((cuenta, index, filtered) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === filtered.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setPagoFormData(prev => ({ 
                              ...prev, 
                              id_cuenta_operacion: cuenta.id_cuenta.toString(),
                              forma_pago: cuenta.tipo_cuenta || prev.forma_pago
                            }));
                            setShowCuentaDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{`${cuenta.nombre || ''} (${cuenta.tipo_cuenta || 'Sin tipo'})`}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Notas sobre el pago"
                  value={pagoFormData.nota}
                  onChangeText={(text) => {
                    console.log('[DeudaScreen] Nota input changed:', text);
                    setPagoFormData(prev => ({ ...prev, nota: text }));
                  }}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowPagoModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePago}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            {/* Toast dentro del modal para mostrar sobre el modal */}
            {showPagoModal && (
              <Toast
                visible={toast.visible}
                type={toast.type}
                message={toast.message}
                code={toast.code}
                duration={toast.duration}
                onHide={hideToast}
                toastKey={toast.key}
              />
            )}
          </Card>
        </View>
      </Modal>

      {!showPagoModal && (
        <Toast
          visible={toast.visible}
          type={toast.type}
          message={toast.message}
          code={toast.code}
          duration={toast.duration}
          onHide={hideToast}
          toastKey={toast.key}
        />
      )}
    </SafeAreaView>
  </>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(65),
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  filterCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  legendContainer: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    borderWidth: 1,
  },
  legendTitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
    borderRadius: 4,
    marginRight: responsive.responsiveMargin(8),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  legendText: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  legendFlag: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
    borderRadius: 10,
    marginRight: responsive.responsiveMargin(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 8,
    borderWidth: 1.5,
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  filterRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    padding: responsive.responsivePadding(4),
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(12),
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  filterActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(16),
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  clearButton: {
    borderWidth: 1,
  },
  searchButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionButtonsContainer: {
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
  },
  actionButtonText: {
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
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
  },
  errorText: {
    marginTop: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  deudaCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'visible',
  },
  deudaFlags: {
    position: 'absolute',
    top: -10,
    left: -10,
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    zIndex: 1,
  },
  deudaPendingFlag: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deudaNoteFlag: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: responsive.responsiveMargin(-12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deudaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deudaHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  deudaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    flex: 1,
  },
  deudaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(12),
    justifyContent: 'flex-end',
  },
  actionButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonSmall: {
    marginRight: responsive.responsiveMargin(4),
  },
  deleteButtonSmall: {
    marginRight: responsive.responsiveMargin(4),
  },
  deudaStatusBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
  },
  deudaInfo: {
    flex: 1,
  },
  deudaCliente: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  deudaFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  deudaDetails: {
    marginTop: responsive.responsiveMargin(12),
    paddingVertical: responsive.responsivePadding(8),
  },
  deudaAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  deudaAmountLabel: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  deudaAmountValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  addPagoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(10),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(12),
  },
  addPagoButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagosContainer: {
    marginTop: responsive.responsiveMargin(16),
    paddingTop: responsive.responsivePadding(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  pagosTitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  pagoItem: {
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
  },
  ventaRelatedFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: responsive.responsiveWidth(12),
    marginTop: responsive.responsiveMargin(4),
  },
  ventaRelatedFlagText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    marginLeft: responsive.responsiveMargin(4),
  },
  pagoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  pagoFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  pagoCantidad: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagoDetails: {
    gap: responsive.responsiveMargin(4),
  },
  pagoForma: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  pagoNota: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  textArea: {
    height: responsive.responsiveHeight(80),
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(24),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
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
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    padding: responsive.responsivePadding(4),
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(12),
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  tableScrollView: {
    marginBottom: responsive.responsiveMargin(16),
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableHeaderText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  tableCellText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  tableCellWithFlags: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableFlagsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    marginRight: responsive.responsiveMargin(6),
  },
  tableDeudaPendingFlag: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableDeudaNoteFlag: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCellWithBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableStatusBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tableStatusText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tableActionsCell: {
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableActionsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
  },
  tableActionButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableAddButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusFilterSwitches: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  statusFilterItem: {
    flex: 1,
  },
  statusFilterSwitch: {
    height: responsive.responsiveHeight(36),
    borderRadius: 18,
    padding: 3,
    width: '100%',
  },
  statusFilterKnob: {
    width: responsive.responsiveWidth(55),
    height: responsive.responsiveHeight(30),
    borderRadius: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFilterText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default DeudaScreen;
