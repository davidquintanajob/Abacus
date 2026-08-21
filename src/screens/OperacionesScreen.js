import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
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
import { getOperaciones, deleteOperacion } from '../services/operacionService';
import { getCuentas } from '../services/cuentaService';
import { getUsuarios } from '../services/usuarioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const OperacionesContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, operacionAccessLevels, operacionManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [operaciones, setOperaciones] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);
  const filtersRef = useRef(filters);

  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Filter states
  const [filters, setFilters] = useState({ 
    nombre_cuenta: '', 
    nombre_usuario: '', 
    fecha_desde: '', 
    fecha_hasta: '', 
    cantidad_min: '', 
    cantidad_max: '' 
  });
  const [cuentas, setCuentas] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentaSearchText, setCuentaSearchText] = useState('');
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);
  const [hasLoadedAllCuentas, setHasLoadedAllCuentas] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (isInitializedRef.current) {
        const restoreFilters = async () => {
          try {
            const savedFilters = await AsyncStorage.getItem('operaciones_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchOperaciones(null, parsedFilters);
            } else {
              fetchOperaciones();
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchOperaciones();
          }
        };
        restoreFilters();
      }
    }, [])
  );

  const fetchAllCuentas = async () => {
    try {
      setIsLoadingCuentas(true);
      const data = await getCuentas({}, 1, 1000);
      setCuentas(data.data || []);
      setHasLoadedAllCuentas(true);
    } catch (err) {
      setCuentas([]);
    } finally {
      setIsLoadingCuentas(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
      setHasLoadedAllUsers(true);
    } catch (err) {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchOperaciones = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setOperaciones([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllOperaciones = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

      const filtersToUse = overrideFilters || filters;
      
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;
      
      // Build filters to send to API
      const apiFilters = { ...filtersToUse };
      
      const data = await getOperaciones(apiFilters, fetchPage, fetchLimit);
      let operaciones = data.data || [];

      setOperaciones(operaciones);
      setPagination(data.pagination || pagination);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current) {
      fetchOperaciones();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchOperaciones();
    }
  }, [pagination.currentPage]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchOperaciones();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      nombre_cuenta: '', 
      nombre_usuario: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      cantidad_min: '', 
      cantidad_max: '' 
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchOperaciones(null, clearedFilters);
  };

  const handleDelete = (operacion) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Operación',
      `¿Estás seguro de que quieres eliminar esta operación?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOperacion(operacion.id_operacion);
              showToast({ type: 'success', message: 'Operación eliminada correctamente' });
              fetchOperaciones();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleOperacionPress = (operacion) => {
    if (isOfflineMode) {
      navigation.navigate('OperacionForm', { operacion, mode: 'view' });
      return;
    }
    
    AsyncStorage.setItem('operaciones_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    const openMode = canManageOperaciones ? 'edit' : 'view';
    navigation.navigate('OperacionForm', { operacion, mode: openMode });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    AsyncStorage.setItem('operaciones_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('OperacionForm', { 
      mode: 'add',
      canViewAllOperaciones: canViewAllOperaciones
    });
  };

  const handleCuentasPress = () => {
    navigation.navigate('Cuentas');
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
      fetchOperaciones();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchOperaciones();
    }
  };

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_desde: formattedDate }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_hasta: formattedDate }));
    }
  };

  const filteredCuentas = cuentas.filter(cuenta =>
    cuenta.nombre.toLowerCase().includes(cuentaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const getOperacionTypeColor = (tipo) => {
    switch (tipo) {
      case 'Ingreso':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Ingreso' };
      case 'Retiro':
        return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336', label: 'Retiro' };
      case 'Ingreso por Venta':
        return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3', label: 'Venta' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575', label: tipo };
    }
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewAllOperaciones = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

  const canManageOperaciones = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && operacionManagePermissions?.almacenero) ||
    (userRole === 'económico' && operacionManagePermissions?.economico);

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
        onThemePress={toggleTheme}
        onSettingsPress={handleSettingsPress}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        onViewModeToggle={toggleViewMode}
        showViewToggle={true}
        viewMode={viewMode}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="Operaciones"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Operaciones</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre_cuenta}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_cuenta: text }))}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre_usuario}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_usuario: text }))}
            />
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad Mínima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad mínima..."
                    value={filters.cantidad_min}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_min: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad Máxima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad máxima..."
                    value={filters.cantidad_max}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_max: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha Desde</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowFechaDesdePicker(true)}
                  >
                    <Text style={[styles.inputText, { color: filters.fecha_desde ? colors.onSurface : colors.outline }]}>
                      {filters.fecha_desde || 'Seleccionar...'}
                    </Text>
                  </TouchableOpacity>
                  {showFechaDesdePicker && (
                    <DateTimePicker
                      value={filters.fecha_desde ? new Date(filters.fecha_desde) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaDesdeChange}
                    />
                  )}
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha Hasta</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowFechaHastaPicker(true)}
                  >
                    <Text style={[styles.inputText, { color: filters.fecha_hasta ? colors.onSurface : colors.outline }]}>
                      {filters.fecha_hasta || 'Seleccionar...'}
                    </Text>
                  </TouchableOpacity>
                  {showFechaHastaPicker && (
                    <DateTimePicker
                      value={filters.fecha_hasta ? new Date(filters.fecha_hasta) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaHastaChange}
                    />
                  )}
                </View>
              </View>
            </>
          )}

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

        {/* Summary Card */}
        {summary && (
          <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryCompactContainer}>
              <View style={styles.summaryCompactItem}>
                <Text style={[styles.summaryCompactLabel, { color: colors.outline }]}>CUP</Text>
                <Text style={[styles.summaryCompactValue, { color: colors.primary }]}>
                  {summary.totalCup ? parseFloat(summary.totalCup).toFixed(2) : '0.00'}
                </Text>
              </View>
              <View style={styles.summaryCompactItem}>
                <Text style={[styles.summaryCompactLabel, { color: colors.outline }]}>USD</Text>
                <Text style={[styles.summaryCompactValue, { color: colors.primary }]}>
                  {summary.totalUsd ? parseFloat(summary.totalUsd).toFixed(2) : '0.00'}
                </Text>
              </View>
              <View style={styles.summaryCompactItem}>
                <Text style={[styles.summaryCompactLabel, { color: '#4CAF50' }]}>Ingresos</Text>
                <Text style={[styles.summaryCompactValue, { color: '#4CAF50' }]}>
                  {summary.totalIngresos ? parseFloat(summary.totalIngresos).toFixed(2) : '0.00'}
                </Text>
              </View>
              <View style={styles.summaryCompactItem}>
                <Text style={[styles.summaryCompactLabel, { color: '#F44336' }]}>Retiros</Text>
                <Text style={[styles.summaryCompactValue, { color: '#F44336' }]}>
                  {summary.totalRetiros ? parseFloat(summary.totalRetiros).toFixed(2) : '0.00'}
                </Text>
              </View>
              <View style={styles.summaryCompactItem}>
                <Text style={[styles.summaryCompactLabel, { color: '#2196F3' }]}>Ventas</Text>
                <Text style={[styles.summaryCompactValue, { color: '#2196F3' }]}>
                  {summary.totalIngresosVenta ? parseFloat(summary.totalIngresosVenta).toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleCuentasPress}
          >
            <Ionicons name="wallet-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Gestionar Cuentas</Text>
          </TouchableOpacity>
          {!isOfflineMode && canManageOperaciones && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Agregar Operación</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Operations List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando operaciones...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchOperaciones}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : operaciones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay operaciones registradas
            </Text>
          </View>
        ) : (
          <>
            {viewMode === 'card' ? (
              operaciones.map((operacion) => (
                <TouchableOpacity
                  key={operacion.id_operacion}
                  onPress={() => handleOperacionPress(operacion)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.operacionCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.operacionInfo}>
                      <View style={styles.operacionHeader}>
                        <Text style={[styles.operacionCuenta, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {operacion.cuenta?.nombre || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.operacionTypeRow}>
                        <View style={[styles.typeBadge, { backgroundColor: getOperacionTypeColor(operacion.tipo_operacion).bgColor, borderColor: getOperacionTypeColor(operacion.tipo_operacion).borderColor }]}>
                          <Text style={[styles.typeBadgeText, { color: getOperacionTypeColor(operacion.tipo_operacion).color }]}>
                            {getOperacionTypeColor(operacion.tipo_operacion).label}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.operacionUsuario, { color: colors.outline }]}>
                        Usuario: {operacion.usuario?.nombre_natural || 'N/A'}
                      </Text>
                      <View style={styles.montoRow}>
                        <Text style={[styles.operacionMonto, { color: colors.primary }]}>
                          CUP: {parseFloat(operacion.cantidad_cup || 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.operacionMonto, { color: colors.primary }]}>
                          USD: {parseFloat(operacion.cantidad_usd || 0).toFixed(2)}
                        </Text>
                      </View>
                      {operacion.motivo && (
                        <Text style={[styles.operacionMotivo, { color: colors.outline }]}>
                          Motivo: {operacion.motivo}
                        </Text>
                      )}
                      <Text style={[styles.operacionFecha, { color: colors.outline }]}>
                        Fecha: {new Date(operacion.fecha_hora).toLocaleString()}
                      </Text>
                    </View>
                    {canManageOperaciones && (
                      <View style={styles.operacionActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOperacionPress(operacion);
                          }}
                        >
                          <Image
                            source={require('../../assets/editar.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(operacion);
                          }}
                        >
                          <Image
                            source={require('../../assets/basura.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Fecha</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Cuenta</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Tipo</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Monto CUP</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Monto USD</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Usuario</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Motivo</Text>
                    {canManageOperaciones && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {operaciones.map((operacion, index) => {
                    const typeStyle = getOperacionTypeColor(operacion.tipo_operacion);
                    return (
                      <TouchableOpacity
                        key={operacion.id_operacion}
                        onPress={() => handleOperacionPress(operacion)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {new Date(operacion.fecha_hora).toLocaleDateString()}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {operacion.cuenta?.nombre || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: typeStyle.color, width: responsive.responsiveWidth(120) }]}>{typeStyle.label}</Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                            {parseFloat(operacion.cantidad_cup || 0).toFixed(2)}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                            {parseFloat(operacion.cantidad_usd || 0).toFixed(2)}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]} numberOfLines={1}>
                            {operacion.usuario?.nombre_natural || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {operacion.motivo || '-'}
                          </Text>
                          {canManageOperaciones && (
                            <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                              <View style={styles.tableActionsRow}>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleOperacionPress(operacion);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(operacion);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={handlePrevPage}
                  disabled={pagination.currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
                </TouchableOpacity>
                <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
    marginBottom: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(5),
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
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  inputText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  filterActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
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
  summaryCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(12),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryCompactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCompactItem: {
    alignItems: 'center',
  },
  summaryCompactLabel: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  summaryCompactValue: {
    fontSize: responsive.responsiveFontSize(13),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  summaryTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(12),
  },
  summaryItem: {
    flex: 1,
    minWidth: responsive.responsiveWidth(120),
  },
  summaryLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  tableScrollView: {
    marginBottom: responsive.responsiveMargin(16),
  },
  tableContainer: {
    minWidth: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tableHeaderText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: responsive.responsiveFontSize(13),
    fontFamily: 'Inter',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableActionsCell: {
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableActionsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  tableActionButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableEditButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tableDeleteButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
  },
  typeBadgeText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  operacionCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  operacionInfo: {
    flex: 1,
  },
  operacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  operacionCuenta: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  operacionTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  operacionUsuario: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  operacionMonto: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  montoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(2),
  },
  operacionMotivo: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  operacionFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  operacionActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  actionButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSmall: {
    width: responsive.responsiveWidth(22),
    height: responsive.responsiveHeight(22),
  },
  editButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(4),
  },
  cardLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  cardValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: responsive.responsiveMargin(8),
  },
  cardActionButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  paginationButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 8,
    borderWidth: 1,
  },
  paginationText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
});

export default OperacionesContent;
