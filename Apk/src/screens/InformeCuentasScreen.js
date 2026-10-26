import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getOperaciones } from '../services/operacionService';
import { getDeudas } from '../services/deudaService';
import { getCuentas } from '../services/cuentaService';

const InformeCuentasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [operations, setOperations] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    tipoOperacion: '',
    cuenta: ''
  });
  const [cuentas, setCuentas] = useState([]);
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);
  const [showTipoOperacionDropdown, setShowTipoOperacionDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentaSearchText, setCuentaSearchText] = useState('');

  const tiposOperacion = ['Ingreso por Venta', 'Pago de deuda', 'Retiro', 'Ingreso'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  // Load cuentas
  useEffect(() => {
    const loadCuentas = async () => {
      if (isOfflineMode) return;
      try {
        setIsLoadingCuentas(true);
        const cuentasData = await getCuentas({}, 1, 1000);
        if (cuentasData.data) {
          setCuentas(cuentasData.data);
        }
      } catch (error) {
        console.error('Error loading cuentas:', error);
      } finally {
        setIsLoadingCuentas(false);
      }
    };
    loadCuentas();
  }, [isOfflineMode]);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Try to parse the date
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('Invalid date:', dateString);
        return dateString;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.log('Error formatting date:', dateString, e);
      return dateString || 'N/A';
    }
  };

  const handleGenerateReport = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    setIsLoading(true);
    try {
      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      // Fetch operations (ingreso, retiro)
      const operacionesResult = await getOperaciones({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      }, 1, 10000);

      // Fetch deudas (pagos)
      const deudasResult = await getDeudas({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      }, 1, 10000);

      // Combine all operations
      const allOperations = [];

      console.log('InformeCuentas - Operaciones result:', operacionesResult);
      console.log('InformeCuentas - Deudas result:', deudasResult);

      // Add operaciones (includes ingresos por venta)
      if (operacionesResult.data) {
        operacionesResult.data.forEach((op, index) => {
          console.log('InformeCuentas - Operacion:', op);
          const cuentaTipo = op.cuenta?.tipo_cuenta || '';
          const isUSD = cuentaTipo.includes('USD');
          allOperations.push({
            id: `op-${op.id_operacion || index}`,
            type: 'operacion',
            tipo: op.tipo_operacion,
            fecha: op.fecha_hora,
            cuenta: op.cuenta?.nombre || 'N/A',
            monto: op.cantidad_operacion || 0,
            moneda: isUSD ? 'USD' : 'CUP',
            usuario: op.usuario?.nombre_natural || op.usuario?.nombre || 'N/A',
            detalles: op
          });
        });
      }

      // Add pagos de deuda
      if (deudasResult.data) {
        deudasResult.data.forEach((deuda, deudaIndex) => {
          console.log('InformeCuentas - Deuda:', deuda);
          if (deuda.pagos && deuda.pagos.length > 0) {
            deuda.pagos.forEach((pago, pagoIndex) => {
              console.log('InformeCuentas - Pago:', pago);
              const operacion = pago.operacion || {};
              // Only include pagos that have an associated operation (the correct ones)
              if (operacion && operacion.tipo_operacion) {
                const cuentaTipo = operacion.cuenta?.tipo_cuenta || '';
                const isUSD = cuentaTipo.includes('USD');
                allOperations.push({
                  id: `pago-${deuda.id_deuda || deudaIndex}-${pagoIndex}`,
                  type: 'pago_deuda',
                  tipo: 'Pago de deuda',
                  fecha: operacion.fecha_hora || pago.fecha_hora || pago.fecha_pago,
                  cuenta: operacion.cuenta?.nombre || pago.forma_pago || 'N/A',
                  monto: pago.cantidad_pagada || 0,
                  moneda: isUSD ? 'USD' : 'CUP',
                  usuario: operacion.usuario?.nombre_natural || operacion.usuario?.nombre || 'N/A',
                  cliente: deuda.cliente?.nombre || 'N/A',
                  detalles: { ...deuda, pago }
                });
              }
            });
          }
        });
      }

      // Sort by date
      allOperations.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // Apply filters
      let filteredOperations = allOperations;
      if (filters.tipoOperacion) {
        filteredOperations = filteredOperations.filter(op => op.tipo === filters.tipoOperacion);
      }
      if (filters.cuenta) {
        filteredOperations = filteredOperations.filter(op => op.cuenta === filters.cuenta);
      }

      setOperations(filteredOperations);
      setExpandedItems({});
    } catch (error) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: error.message || 'Error al generar el informe' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getOperationIcon = (type) => {
    switch (type) {
      case 'operacion':
        return 'swap-horizontal-outline';
      case 'venta':
        return 'cart-outline';
      case 'pago_deuda':
        return 'card-outline';
      default:
        return 'document-outline';
    }
  };

  const getOperationColor = (tipo) => {
    if (tipo === 'Ingreso') return '#4CAF50';
    if (tipo === 'Ingreso por Venta') return '#2196F3';
    if (tipo === 'Retiro') return '#F44336';
    if (tipo === 'Pago de deuda') return '#9C27B0';
    return '#2196F3';
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
        onViewModeToggle={undefined}
        showViewToggle={false}
        viewMode={null}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        showBackButton={false}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="InformeCuentas"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Informe de Cuentas</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Movimientos de cuentas por rango de fechas
          </Text>
        </View>

        {/* Filters Card */}
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

          <View style={styles.filterRow}>
            <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
              <Text style={[styles.label, { color: colors.outline }]}>Desde</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[styles.dateButtonText, { color: colors.onSurface }]}>
                  {formatLocalDate(startDate)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
              <Text style={[styles.label, { color: colors.outline }]}>Hasta</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[styles.dateButtonText, { color: colors.onSurface }]}>
                  {formatLocalDate(endDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <View style={styles.advancedFiltersContainer}>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Operación</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowTipoOperacionDropdown(!showTipoOperacionDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.tipoOperacion ? colors.onSurface : colors.outline }]}>
                    {filters.tipoOperacion || 'Todos'}
                  </Text>
                  <Ionicons 
                    name={showTipoOperacionDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showTipoOperacionDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFilters({ ...filters, tipoOperacion: '' });
                          setShowTipoOperacionDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos</Text>
                      </TouchableOpacity>
                      {tiposOperacion.map((tipo) => (
                        <TouchableOpacity
                          key={tipo}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters({ ...filters, tipoOperacion: tipo });
                            setShowTipoOperacionDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tipo}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowCuentaDropdown(!showCuentaDropdown);
                    if (!isLoadingCuentas && cuentas.length === 0) {
                      // Cuentas already loaded by useEffect
                    }
                  }}
                  disabled={isLoadingCuentas}
                >
                  <Text style={[styles.dropdownText, { color: filters.cuenta ? colors.onSurface : colors.outline }]}>
                    {filters.cuenta || 'Todas'}
                  </Text>
                  {isLoadingCuentas ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons 
                      name={showCuentaDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={colors.outline} 
                    />
                  )}
                </TouchableOpacity>
                
                {showCuentaDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {isLoadingCuentas && (
                      <View style={styles.dropdownLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando cuentas...</Text>
                      </View>
                    )}
                    {!isLoadingCuentas && (
                      <>
                        <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                          <Ionicons 
                            name="search-outline" 
                            size={18} 
                            color={colors.outline} 
                            style={styles.searchIcon}
                          />
                          <TextInput
                            style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Buscar cuenta..."
                            value={cuentaSearchText}
                            onChangeText={setCuentaSearchText}
                          />
                        </View>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFilters({ ...filters, cuenta: '' });
                              setShowCuentaDropdown(false);
                              setCuentaSearchText('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas</Text>
                          </TouchableOpacity>
                          {cuentas.filter(c => c.nombre?.toLowerCase().includes(cuentaSearchText.toLowerCase())).length > 0 ? (
                            cuentas.filter(c => c.nombre?.toLowerCase().includes(cuentaSearchText.toLowerCase())).map((cuenta, index, arr) => (
                              <TouchableOpacity
                                key={cuenta.id_cuenta}
                                style={[styles.dropdownItem, index === arr.length - 1 && styles.dropdownItemLast]}
                                onPress={() => {
                                  setFilters({ ...filters, cuenta: cuenta.nombre });
                                  setShowCuentaDropdown(false);
                                  setCuentaSearchText('');
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron cuentas</Text>
                            </View>
                          )}
                        </ScrollView>
                      </>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.primary }]}
            onPress={handleGenerateReport}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>Generar Informe</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) {
                setStartDate(selectedDate);
              }
            }}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(false);
              if (selectedDate) {
                setEndDate(selectedDate);
              }
            }}
          />
        )}

        {/* Results */}
        {operations.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={[styles.resultsTitle, { color: colors.onSurface }]}>
              Resultados ({operations.length})
            </Text>
            
            {operations.map((op) => (
              <Card key={op.id} style={[styles.operationCard, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.operationHeader}
                  onPress={() => toggleExpand(op.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.operationIconContainer, { backgroundColor: `${getOperationColor(op.tipo)}20` }]}>
                    <Ionicons name={getOperationIcon(op.type)} size={24} color={getOperationColor(op.tipo)} />
                  </View>
                  
                  <View style={styles.operationInfo}>
                    <Text style={[styles.operationType, { color: colors.onSurface }]}>
                      {op.tipo}
                    </Text>
                    <Text style={[styles.operationDate, { color: colors.outline }]}>
                      {formatDate(op.fecha)}
                    </Text>
                  </View>

                  <View style={styles.operationAmountContainer}>
                    <Text style={[styles.operationAmount, { color: getOperationColor(op.tipo) }]}>
                      {formatCurrency(op.monto)} {op.moneda || 'CUP'}
                    </Text>
                  </View>

                  <Ionicons 
                    name={expandedItems[op.id] ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color={colors.outline} 
                    style={styles.expandIcon}
                  />
                </TouchableOpacity>

                {expandedItems[op.id] && (
                  <View style={styles.operationDetails}>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.outline }]}>Cuenta:</Text>
                      <Text style={[styles.detailValue, { color: colors.onSurface }]}>{op.cuenta}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.outline }]}>Usuario:</Text>
                      <Text style={[styles.detailValue, { color: colors.onSurface }]}>{op.usuario}</Text>
                    </View>
                    {op.cliente && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.outline }]}>Cliente:</Text>
                        <Text style={[styles.detailValue, { color: colors.onSurface }]}>{op.cliente}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: colors.outline }]}>Monto:</Text>
                      <Text style={[styles.detailValue, { color: colors.onSurface }]}>{formatCurrency(op.monto)} {op.moneda || 'CUP'}</Text>
                    </View>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        {operations.length === 0 && !isLoading && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="document-text-outline" size={60} color={colors.outline} />
            <Text style={[styles.emptyStateText, { color: colors.outline }]}>
              No hay operaciones para el rango de fechas seleccionado
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    marginBottom: responsive.responsiveMargin(24),
    marginTop: responsive.responsiveMargin(60),
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(8),
  },
  pageSubtitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  filterCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(24),
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
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(16),
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  dateButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
  },
  advancedFiltersContainer: {
    marginTop: responsive.responsiveMargin(8),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  selectButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(16),
  },
  dropdownLoadingText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    margin: responsive.responsiveMargin(8),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(8),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  modalList: {
    padding: responsive.responsivePadding(8),
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(4),
  },
  modalItemText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: responsive.responsivePadding(14),
    marginTop: responsive.responsiveMargin(8),
  },
  generateButtonText: {
    color: '#fff',
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  resultsContainer: {
    marginTop: responsive.responsiveMargin(16),
  },
  resultsTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
  },
  emptyState: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: responsive.responsiveMargin(24),
  },
  emptyStateText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: responsive.responsiveMargin(16),
  },
  operationCard: {
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  operationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
  },
  operationIconContainer: {
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  operationInfo: {
    flex: 1,
  },
  operationType: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  operationDate: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  operationAmountContainer: {
    marginRight: responsive.responsiveMargin(12),
  },
  operationAmount: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  expandIcon: {
    marginLeft: responsive.responsiveMargin(8),
  },
  operationDetails: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    padding: responsive.responsivePadding(16),
    paddingTop: responsive.responsivePadding(12),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  detailLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  detailValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
  },
});

export default InformeCuentasContent;
