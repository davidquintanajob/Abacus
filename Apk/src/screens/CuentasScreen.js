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
import { getCuentas, deleteCuenta } from '../services/cuentaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CuentasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [cuentas, setCuentas] = useState([]);
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
    tipo_cuenta: '', 
    num_cuenta: '' 
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);

  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

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
            const savedFilters = await AsyncStorage.getItem('cuentas_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchCuentas(null, parsedFilters);
            } else {
              fetchCuentas();
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchCuentas();
          }
        };
        restoreFilters();
      }
    }, [])
  );

  const fetchCuentas = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setCuentas([]);
        setIsLoading(false);
        return;
      }

      // Use override filters if provided, otherwise use current state
      const filtersToUse = overrideFilters || filters;
      
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;
      
      // Build filters to send to API
      const apiFilters = { ...filtersToUse };
      
      const data = await getCuentas(apiFilters, fetchPage, fetchLimit);
      let cuentas = data.data || [];

      setCuentas(cuentas);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current) {
      fetchCuentas();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchCuentas();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      nombre: '', 
      tipo_cuenta: '', 
      num_cuenta: '' 
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    // Pass entire cleared filters object to ensure all filters are properly sent to API
    fetchCuentas(clearedFilters);
  };

  const handleDelete = (cuenta) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Cuenta',
      `¿Estás seguro de que quieres eliminar la cuenta "${cuenta.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCuenta(cuenta.id_cuenta);
              showToast({ type: 'success', message: 'Cuenta eliminada correctamente' });
              fetchCuentas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleCuentaPress = (cuenta) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    AsyncStorage.setItem('cuentas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('CuentaForm', { cuenta, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    AsyncStorage.setItem('cuentas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('CuentaForm', { mode: 'add' });
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
      fetchCuentas();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchCuentas();
    }
  };

  const getTipoCuentaColor = (tipo) => {
    if (tipo.includes('CUP')) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', icon: 'cash' };
    } else if (tipo.includes('USD')) {
      return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3', icon: 'logo-usd' };
    }
    return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575', icon: 'card' };
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
        onThemePress={toggleTheme}
        onSettingsPress={undefined}
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
        currentRoute="Cuentas"
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
            <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Cuentas</Text>
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
                  <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cuenta</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                  >
                    <Text style={[styles.inputText, { color: filters.tipo_cuenta ? colors.onSurface : colors.outline }]}>
                      {filters.tipo_cuenta || 'Todos'}
                    </Text>
                    <Ionicons 
                      name={showTipoCuentaDropdown ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.outline} 
                    />
                  </TouchableOpacity>
                  
                  {showTipoCuentaDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, tipo_cuenta: '' }));
                            setShowTipoCuentaDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos</Text>
                        </TouchableOpacity>
                        {tiposCuenta.map((tipo, index) => {
                          return (
                            <TouchableOpacity
                              key={tipo}
                              style={[styles.dropdownItem, index === tiposCuenta.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                setFilters(prev => ({ ...prev, tipo_cuenta: tipo }));
                                setShowTipoCuentaDropdown(false);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tipo}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.filterGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Número de Cuenta</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar por número..."
                    value={filters.num_cuenta}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, num_cuenta: text }))}
                  />
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
          {isAdmin && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleAdd}
              >
                <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Agregar Cuenta</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Accounts List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando cuentas...
              </Text>
            </View>
          ) : error ? (
            <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={fetchCuentas}
              >
                <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
              </TouchableOpacity>
            </Card>
          ) : cuentas.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="wallet-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.outline }]}>
                No hay cuentas registradas
              </Text>
            </Card>
          ) : (
            <>
              {viewMode === 'card' ? (
                cuentas.map((cuenta) => (
                  <TouchableOpacity
                    key={cuenta.id_cuenta}
                    onPress={() => handleCuentaPress(cuenta)}
                    activeOpacity={0.7}
                  >
                    <Card style={[styles.cuentaCard, { backgroundColor: colors.surface }]}>
                      <View style={styles.cuentaInfo}>
                        <View style={styles.cuentaHeader}>
                          <Text style={[styles.cuentaNombre, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                            {cuenta.nombre}
                          </Text>
                        </View>
                        <View style={styles.cuentaTypeRow}>
                          <View style={[styles.typeBadge, { backgroundColor: getTipoCuentaColor(cuenta.tipo_cuenta).bgColor, borderColor: getTipoCuentaColor(cuenta.tipo_cuenta).borderColor }]}>
                            <Ionicons name={getTipoCuentaColor(cuenta.tipo_cuenta).icon} size={12} color={getTipoCuentaColor(cuenta.tipo_cuenta).color} />
                            <Text style={[styles.typeBadgeText, { color: getTipoCuentaColor(cuenta.tipo_cuenta).color }]}>
                              {cuenta.tipo_cuenta}
                            </Text>
                          </View>
                        </View>
                        {cuenta.num_cuenta && (
                          <Text style={[styles.cuentaNumero, { color: colors.outline }]}>
                            Número: {cuenta.num_cuenta}
                          </Text>
                        )}
                        <View style={styles.fondoRow}>
                          <Text style={[styles.cuentaFondo, { color: colors.primary }]}>
                            Fondo: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                          </Text>
                        </View>
                        {cuenta.nota && (
                          <Text style={[styles.cuentaNota, { color: colors.outline }]}>
                            Nota: {cuenta.nota}
                          </Text>
                        )}
                      </View>
                      {isAdmin && (
                        <View style={styles.cuentaActions}>
                          <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleCuentaPress(cuenta);
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
                              handleDelete(cuenta);
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
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Nombre</Text>
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tipo</Text>
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Número</Text>
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Fondo</Text>
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Nota</Text>
                      {isAdmin && (
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                      )}
                    </View>
                    {cuentas.map((cuenta, index) => {
                      const tipoStyle = getTipoCuentaColor(cuenta.tipo_cuenta);
                      return (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          onPress={() => handleCuentaPress(cuenta)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                              {cuenta.nombre}
                            </Text>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                              {cuenta.tipo_cuenta}
                            </Text>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                              {cuenta.num_cuenta || 'N/A'}
                            </Text>
                            <Text style={[styles.tableCellText, { color: colors.primary, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                              {parseFloat(cuenta.fondo || 0).toFixed(2)}
                            </Text>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                              {cuenta.nota || '-'}
                            </Text>
                            {isAdmin && (
                              <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                                <View style={styles.tableActionsRow}>
                                  <TouchableOpacity
                                    style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleCuentaPress(cuenta);
                                    }}
                                  >
                                    <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleDelete(cuenta);
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
                    style={[
                      styles.paginationButton,
                      { backgroundColor: colors.surface, opacity: pagination.currentPage === 1 ? 0.5 : 1 }
                    ]}
                    onPress={handlePrevPage}
                    disabled={pagination.currentPage === 1}
                  >
                    <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                  </TouchableOpacity>
                  <View style={styles.paginationInfo}>
                    <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                      Página {pagination.currentPage} de {pagination.totalPages}
                    </Text>
                    <Text style={[styles.paginationText, styles.paginationSubtext, { color: colors.outline }]}>
                      Total de cuentas: {pagination.totalItems}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      { backgroundColor: colors.surface, opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1 }
                    ]}
                    onPress={handleNextPage}
                    disabled={pagination.currentPage === pagination.totalPages}
                  >
                    <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
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
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  emptyCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
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
  cuentaCard: {
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
  cuentaInfo: {
    flex: 1,
  },
  cuentaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  cuentaNombre: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  cuentaTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  cuentaNumero: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  cuentaFondo: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  fondoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(2),
  },
  cuentaNota: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  cuentaActions: {
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
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(24),
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
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationSubtext: {
    fontSize: responsive.responsiveFontSize(12),
    marginTop: responsive.responsiveMargin(4),
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
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
});

export default CuentasContent;
