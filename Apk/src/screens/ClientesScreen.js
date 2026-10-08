import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Linking } from 'react-native';
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
import { getClientes, deleteCliente } from '../services/clienteService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ClientesScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, deudaAccessLevels, deudaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
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
    nombre: '', 
    telefono: '', 
    direccion: '',
    tipo_cliente: '',
    tiene_deuda: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showEstadoDeudaDropdown, setShowEstadoDeudaDropdown] = useState(false);

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
            const savedFilters = await AsyncStorage.getItem('clientes_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchClientes(null, parsedFilters);
            } else {
              fetchClientes();
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchClientes();
          }
        };
        restoreFilters();
      }
    }, [])
  );

  const fetchClientes = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setClientes([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewClientes =
        userRole === 'administrador' ||
        (userRole === 'dependiente' && (deudaAccessLevels?.dependiente === 'clientes' || deudaAccessLevels?.dependiente === 'ambos')) ||
        (userRole === 'almacenero' && (deudaAccessLevels?.almacenero === 'clientes' || deudaAccessLevels?.almacenero === 'ambos')) ||
        (userRole === 'económico' && (deudaAccessLevels?.economico === 'clientes' || deudaAccessLevels?.economico === 'ambos'));

      const filtersToUse = overrideFilters || filters;

      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      // Build filters to send to API
      const apiFilters = { ...filtersToUse };

      // Remove empty filters to avoid API errors
      if (!apiFilters.nombre) delete apiFilters.nombre;
      if (!apiFilters.telefono) delete apiFilters.telefono;
      if (!apiFilters.direccion) delete apiFilters.direccion;
      if (!apiFilters.tipo_cliente) delete apiFilters.tipo_cliente;
      if (apiFilters.tiene_deuda === '' || apiFilters.tiene_deuda === undefined) delete apiFilters.tiene_deuda;
      else apiFilters.tiene_deuda = apiFilters.tiene_deuda === 'true';

      const data = await getClientes(apiFilters, fetchPage, fetchLimit);
      let clientes = data.data || [];

      // Calcular tiene_deuda para cada cliente basado en sus deudas
      clientes = clientes.map(cliente => {
        const tieneDeuda = cliente.deudas && cliente.deudas.some(
          deuda => deuda.monto_restante_cup > 0 || deuda.monto_restante_usd > 0
        );
        return { ...cliente, tiene_deuda: tieneDeuda };
      });

      setClientes(clientes);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  // Single API call when initialized
  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current) {
      fetchClientes();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchClientes();
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      setPagination(prev => ({ ...prev, currentPage: 1 }));
      setIsSearching(true);
      fetchClientes();
    }
  }, [filters.tiene_deuda]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchClientes();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      nombre: '', 
      telefono: '', 
      direccion: '',
      tipo_cliente: '',
      tiene_deuda: ''
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchClientes(clearedFilters);
  };

  const handleDelete = (cliente) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Cliente',
      `¿Estás seguro de que quieres eliminar este cliente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCliente(cliente.id_cliente);
              showToast({ type: 'success', message: 'Cliente eliminado correctamente' });
              fetchClientes();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleClientePress = (cliente) => {
    if (isOfflineMode) {
      navigation.navigate('ClienteForm', { cliente, mode: 'view' });
      return;
    }
    
    AsyncStorage.setItem('clientes_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    const openMode = canManageClientes ? 'edit' : 'view';
    navigation.navigate('ClienteForm', { cliente, mode: openMode });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    AsyncStorage.setItem('clientes_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });

    navigation.navigate('ClienteForm', {
      mode: 'add'
    });
  };

  const handleCall = (telefono) => {
    if (!telefono) return;
    Linking.openURL(`tel:${telefono}`).catch(err => {
      showToast({ type: 'error', message: 'No se pudo realizar la llamada' });
    });
  };

  const handleVerDeudas = () => {
    AsyncStorage.setItem('clientes_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    navigation.navigate('Deudas');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
      fetchClientes();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchClientes();
    }
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewClientes = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && (deudaAccessLevels?.dependiente === 'clientes' || deudaAccessLevels?.dependiente === 'ambos')) ||
    (userRole === 'almacenero' && (deudaAccessLevels?.almacenero === 'clientes' || deudaAccessLevels?.almacenero === 'ambos')) ||
    (userRole === 'económico' && (deudaAccessLevels?.economico === 'clientes' || deudaAccessLevels?.economico === 'ambos'));

  const canManageClientes = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaManagePermissions?.dependiente && (deudaAccessLevels?.dependiente === 'clientes' || deudaAccessLevels?.dependiente === 'ambos')) ||
    (userRole === 'almacenero' && deudaManagePermissions?.almacenero && (deudaAccessLevels?.almacenero === 'clientes' || deudaAccessLevels?.almacenero === 'ambos')) ||
    (userRole === 'económico' && deudaManagePermissions?.economico && (deudaAccessLevels?.economico === 'clientes' || deudaAccessLevels?.economico === 'ambos'));

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
          currentRoute="Clientes"
        />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Clientes</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Nombre</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre: text }))}
            />
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por teléfono..."
                  value={filters.telefono}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, telefono: text }))}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Dirección</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por dirección..."
                  value={filters.direccion}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, direccion: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cliente</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por tipo..."
                  value={filters.tipo_cliente}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, tipo_cliente: text }))}
                />
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
                          Todos
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
                          Con deuda
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
                          Sin deuda
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
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

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
              onPress={handleVerDeudas}
            >
              <Ionicons name="receipt-outline" size={responsive.responsiveWidth(20)} color={isDarkMode ? colors.primary : '#1976D2'} />
              <Text style={[styles.actionButtonText, { color: isDarkMode ? colors.primary : '#1976D2' }]}>Ver Deudas</Text>
            </TouchableOpacity>
            {!isOfflineMode && canManageClientes && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleAdd}
              >
                <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Agregar Cliente</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Clientes List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando clientes...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchClientes}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : clientes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay clientes registrados
            </Text>
          </View>
        ) : (
          <>
            {viewMode === 'card' ? (
              clientes.map((cliente) => (
                <TouchableOpacity
                  key={cliente.id_cliente}
                  onPress={() => handleClientePress(cliente)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.clienteCard, { backgroundColor: colors.surface }]}>
                    {/* Flags container */}
                    <View style={styles.clienteFlags}>
                      {cliente.tiene_deuda && (
                        <View style={[styles.deudaFlag, { backgroundColor: colors.error }]}>
                          <Ionicons name="alert-circle" size={responsive.responsiveWidth(14)} color="#fff" />
                        </View>
                      )}
                      {cliente.nota && (
                        <View style={[styles.noteFlag, { backgroundColor: '#2196F3' }]}>
                          <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={styles.clienteCardHeader}>
                      <View style={styles.clienteInfo}>
                        <View style={styles.clienteHeader}>
                          <Text style={[styles.clienteNombre, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                            {cliente.nombre}
                          </Text>
                        </View>
                        {cliente.telefono && (
                          <Text style={[styles.clienteTelefono, { color: colors.primary }]}>
                            Tel: {cliente.telefono}
                          </Text>
                        )}
                        {cliente.tipo_cliente && (
                          <Text style={[styles.clienteTipo, { color: colors.outline }]}>
                            Tipo: {cliente.tipo_cliente}
                          </Text>
                        )}
                        {cliente.direccion && (
                          <Text style={[styles.clienteDireccion, { color: colors.outline }]} numberOfLines={1}>
                            Dirección: {cliente.direccion}
                          </Text>
                        )}
                        {cliente.nota && (
                          <View style={[styles.noteBadge, { backgroundColor: isDarkMode ? colors.primaryContainer : '#FFF3E0', borderColor: isDarkMode ? colors.primary : '#FF9800' }]}>
                            <Text style={[styles.noteText, { color: isDarkMode ? colors.primary : '#FF9800' }]}>
                              Nota: {cliente.nota}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.clienteCardRight}>
                        {/* Action buttons */}
                        <View style={styles.clienteActions}>
                          {cliente.telefono && (
                            <TouchableOpacity
                              style={[styles.actionButtonSmall, styles.callButtonSmall, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleCall(cliente.telefono);
                              }}
                            >
                              <Image
                                source={require('../../assets/llamada-telefonica.png')}
                                style={styles.actionIconSmall}
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                          )}
                          {canManageClientes && (
                            <>
                              <TouchableOpacity
                                style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleClientePress(cliente);
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
                                  handleDelete(cliente);
                                }}
                              >
                                <Image
                                  source={require('../../assets/basura.png')}
                                  style={styles.actionIconSmall}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Nombre</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Teléfono</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tipo</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Dirección</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Deuda</Text>
                    {canManageClientes && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Acciones</Text>
                    )}
                  </View>
                  {clientes.map((cliente, index) => (
                    <TouchableOpacity
                      key={cliente.id_cliente}
                      onPress={() => handleClientePress(cliente)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                          {cliente.nombre}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {cliente.telefono || '-'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {cliente.tipo_cliente || '-'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={1}>
                          {cliente.direccion || '-'}
                        </Text>
                        <View style={[styles.tableCellText, { width: responsive.responsiveWidth(100) }]}>
                          {cliente.tiene_deuda ? (
                            <View style={[styles.tableDeudaBadge, { backgroundColor: colors.error }]}>
                              <Text style={[styles.tableDeudaText, { color: '#fff' }]}>Sí</Text>
                            </View>
                          ) : (
                            <Text style={[styles.tableCellText, { color: colors.outline }]}>No</Text>
                          )}
                        </View>
                        {canManageClientes && (
                          <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(150) }]}>
                            <View style={styles.tableActionsRow}>
                              {cliente.telefono && (
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableCallButton, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleCall(cliente.telefono);
                                  }}
                                >
                                  <Image
                                    source={require('../../assets/llamada-telefonica.png')}
                                    style={styles.tableActionIcon}
                                    resizeMode="contain"
                                  />
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleClientePress(cliente);
                                }}
                              >
                                <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleDelete(cliente);
                                }}
                              >
                                <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
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

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
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
  actionButtonsContainer: {
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
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
  clienteCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'visible',
  },
  clienteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clienteCardRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: responsive.responsiveMargin(8),
  },
  clienteFlags: {
    position: 'absolute',
    top: -10,
    left: -10,
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    zIndex: 1,
  },
  deudaFlag: {
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
  noteFlag: {
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
  clienteActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  clienteInfo: {
    flex: 1,
  },
  clienteHeader: {
    marginBottom: responsive.responsiveMargin(8),
  },
  clienteNombre: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  clienteTelefono: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  clienteTipo: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  clienteDireccion: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  noteBadge: {
    marginTop: responsive.responsiveMargin(8),
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  noteText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  deudaBadge: {
    marginTop: responsive.responsiveMargin(8),
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  deudaText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  clienteActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(12),
  },
  actionButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSmall: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
  },
  callButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  editButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
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
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tableHeaderText: {
    fontSize: responsive.responsiveFontSize(14),
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
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  tableDeudaBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tableDeudaText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tableActionsCell: {
    flexDirection: 'row',
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
  tableActionIcon: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
  },
  tableCallButton: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  tableEditButton: {
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  tableDeleteButton: {
    borderWidth: 1,
    borderColor: '#F44336',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(16),
    paddingVertical: responsive.responsivePadding(16),
  },
  paginationButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  paginationText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
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

export default ClientesScreen;
