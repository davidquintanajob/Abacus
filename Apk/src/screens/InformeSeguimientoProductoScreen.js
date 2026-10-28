import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
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
import { getEntradas } from '../services/entradaService';
import { getSalidas } from '../services/salidaService';
import { getProductos } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';

const InformeSeguimientoProductoContent = () => {
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
  const [stockMovements, setStockMovements] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    producto: '',
    tienda: ''
  });
  const [productos, setProductos] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [isLoadingProductos, setIsLoadingProductos] = useState(false);
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const productoDropdownTimeoutRef = React.useRef(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  // Load productos and tiendas
  useEffect(() => {
    const loadData = async () => {
      if (isOfflineMode) return;
      try {
        setIsLoadingProductos(true);
        setIsLoadingTiendas(true);
        
        const [productosData, tiendasData] = await Promise.all([
          getProductos({ skipEsvendible: true }, 1, 1000),
          getTiendas({}, 1, 1000)
        ]);
        
        if (productosData.data) {
          setProductos(productosData.data);
        }
        if (tiendasData.data) {
          setTiendas(tiendasData.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoadingProductos(false);
        setIsLoadingTiendas(false);
      }
    };
    loadData();
  }, [isOfflineMode]);

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatQuantity = (value) => {
    if (typeof value !== 'number') return '0';
    if (value % 1 === 0) return value.toString();
    return value.toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString || 'N/A';
    }
  };

  const handleGenerateReport = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    if (!filters.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto' });
      return;
    }

    setIsLoading(true);
    try {
      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      // Build filters for API calls
      const entradaFilters = {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      };
      const salidaFilters = {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      };

      // Add optional filters
      if (filters.producto) {
        const selectedProducto = productos.find(p => p.nombre === filters.producto);
        if (selectedProducto) {
          // Find the servicio_tienda for this product and tienda
          if (filters.tienda) {
            const selectedTienda = tiendas.find(t => t.nombre === filters.tienda);
            if (selectedTienda) {
              const servicioTienda = selectedProducto.tiendas_servicio?.find(
                ts => ts.id_tienda === selectedTienda.id_tienda
              );
              if (servicioTienda) {
                entradaFilters.id_servicio_tienda = servicioTienda.id_servicio_tienda;
                salidaFilters.id_servicio_tienda = servicioTienda.id_servicio_tienda;
              }
            }
          } else {
            // If only product selected, get all servicio_tiendas for this product
            const servicioTiendas = selectedProducto.tiendas_servicio?.map(ts => ts.id_servicio_tienda) || [];
            if (servicioTiendas.length > 0) {
              // We'll filter by multiple ids if API supports it, otherwise fetch all and filter client-side
            }
          }
        }
      } else if (filters.tienda) {
        // If only tienda selected, we need to get all servicio_tiendas for this tienda
        const selectedTienda = tiendas.find(t => t.nombre === filters.tienda);
        if (selectedTienda) {
          // This would require a different API approach, for now fetch all and filter
        }
      }

      // Fetch entradas and salidas
      const [entradasResult, salidasResult] = await Promise.all([
        getEntradas(entradaFilters, 1, 10000),
        getSalidas(salidaFilters, 1, 10000)
      ]);

      // Combine and process movements
      const allMovements = [];

      // Add entradas (stock increases)
      if (entradasResult.data) {
        entradasResult.data.forEach((entrada) => {
          // Filter by product if specified
          if (filters.producto) {
            const selectedProducto = productos.find(p => p.nombre === filters.producto);
            if (!selectedProducto) return;
            
            const servicioTienda = selectedProducto.tiendas_servicio?.find(
              ts => ts.id_servicio_tienda === entrada.id_servicio_tienda
            );
            if (!servicioTienda) return;
          }

          // Filter by tienda if specified
          if (filters.tienda) {
            const selectedTienda = tiendas.find(t => t.nombre === filters.tienda);
            if (!selectedTienda) return;
            
            const entradaTienda = entrada.servicioTienda?.tienda;
            if (!entradaTienda || entradaTienda.id_tienda !== selectedTienda.id_tienda) return;
          }

          allMovements.push({
            id: `entrada-${entrada.id_entrada}`,
            type: 'entrada',
            fecha: entrada.fecha,
            cantidad: entrada.cantidad_entrada,
            producto: entrada.servicioTienda?.servicio?.nombre || 'N/A',
            tienda: entrada.servicioTienda?.tienda?.nombre || 'N/A',
            usuario: entrada.usuario?.nombre_natural || entrada.usuario?.nombre || 'N/A'
          });
        });
      }

      // Add salidas (stock decreases)
      if (salidasResult.data) {
        salidasResult.data.forEach((salida) => {
          // Filter by product if specified
          if (filters.producto) {
            const selectedProducto = productos.find(p => p.nombre === filters.producto);
            if (!selectedProducto) return;
            
            const servicioTienda = selectedProducto.tiendas_servicio?.find(
              ts => ts.id_servicio_tienda === salida.id_servicio_tienda
            );
            if (!servicioTienda) return;
          }

          // Filter by tienda if specified
          if (filters.tienda) {
            const selectedTienda = tiendas.find(t => t.nombre === filters.tienda);
            if (!selectedTienda) return;
            
            const salidaTienda = salida.servicioTienda?.tienda;
            if (!salidaTienda || salidaTienda.id_tienda !== selectedTienda.id_tienda) return;
          }

          allMovements.push({
            id: `salida-${salida.id_salida}`,
            type: 'salida',
            fecha: salida.fecha,
            cantidad: -salida.cantidad_total, // Negative for salidas
            producto: salida.servicioTienda?.servicio?.nombre || 'N/A',
            tienda: salida.servicioTienda?.tienda?.nombre || 'N/A',
            usuario: salida.usuario?.nombre_natural || salida.usuario?.nombre || 'N/A'
          });
        });
      }

      // Sort by date ascending (oldest first for timeline)
      allMovements.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      // Calculate running balance
      let runningBalance = 0;
      const movementsWithBalance = allMovements.map(movement => {
        runningBalance += movement.cantidad;
        return {
          ...movement,
          balance: runningBalance
        };
      });

      setStockMovements(movementsWithBalance);
    } catch (error) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: error.message || 'Error al generar el informe' });
    } finally {
      setIsLoading(false);
    }
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
        currentRoute="InformeSeguimientoProducto"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Seguimiento de Stock</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Movimientos de productos por rango de fechas
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

          {/* Producto field (mandatory, outside collapsible) */}
          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Producto *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.inputWithDropdown, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Seleccionar producto (obligatorio)..."
                value={filters.producto}
                onChangeText={(text) => {
                  setFilters(prev => ({ ...prev, producto: text }));
                  setProductoSearchText(text);
                }}
                onFocus={() => setShowProductoDropdown(true)}
              />
              <TouchableOpacity
                style={styles.dropdownIcon}
                onPress={() => setShowProductoDropdown(!showProductoDropdown)}
              >
                <Ionicons name={showProductoDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
              </TouchableOpacity>
            </View>
            {showProductoDropdown && (
              <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {isLoadingProductos ? (
                    <View style={styles.dropdownLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando productos...</Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, producto: '' }));
                          setShowProductoDropdown(false);
                          setProductoSearchText('');
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.outline }]}>Seleccionar producto...</Text>
                      </TouchableOpacity>
                      {productos.filter(p => p.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).length > 0 ? (
                        productos.filter(p => p.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).map((producto, index, arr) => (
                          <TouchableOpacity
                            key={producto.id_servicio}
                            style={[styles.dropdownItem, index === arr.length - 1 && styles.dropdownItemLast]}
                            onPress={() => {
                              setFilters(prev => ({ ...prev, producto: producto.nombre }));
                              setShowProductoDropdown(false);
                              setProductoSearchText('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.dropdownItem}>
                          <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                        </View>
                      )}
                    </>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <View style={styles.advancedFiltersContainer}>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.inputWithDropdown, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Seleccionar tienda..."
                    value={filters.tienda}
                    onChangeText={(text) => {
                      setFilters(prev => ({ ...prev, tienda: text }));
                      setTiendaSearchText(text);
                    }}
                    onFocus={() => setShowTiendaDropdown(true)}
                  />
                  <TouchableOpacity
                    style={styles.dropdownIcon}
                    onPress={() => setShowTiendaDropdown(!showTiendaDropdown)}
                  >
                    <Ionicons name={showTiendaDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
                  </TouchableOpacity>
                </View>
                {showTiendaDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {isLoadingTiendas ? (
                        <View style={styles.dropdownLoadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando tiendas...</Text>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFilters(prev => ({ ...prev, tienda: '' }));
                              setShowTiendaDropdown(false);
                              setTiendaSearchText('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas</Text>
                          </TouchableOpacity>
                          {tiendas.filter(t => t.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())).length > 0 ? (
                            tiendas.filter(t => t.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())).map((tienda, index, arr) => (
                              <TouchableOpacity
                                key={tienda.id_tienda}
                                style={[styles.dropdownItem, index === arr.length - 1 && styles.dropdownItemLast]}
                                onPress={() => {
                                  setFilters(prev => ({ ...prev, tienda: tienda.nombre }));
                                  setShowTiendaDropdown(false);
                                  setTiendaSearchText('');
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                            </View>
                          )}
                        </>
                      )}
                    </ScrollView>
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
        {stockMovements.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={[styles.resultsTitle, { color: colors.onSurface }]}>
              Movimientos ({stockMovements.length})
            </Text>
            
            {stockMovements.map((movement) => (
              <Card key={movement.id} style={[styles.movementCard, { backgroundColor: colors.surface }]}>
                <View style={styles.movementHeader}>
                  <View style={[styles.movementIconContainer, { backgroundColor: movement.type === 'entrada' ? '#E8F5E9' : '#FFEBEE' }]}>
                    <Ionicons 
                      name={movement.type === 'entrada' ? 'arrow-down-outline' : 'arrow-up-outline'} 
                      size={24} 
                      color={movement.type === 'entrada' ? '#4CAF50' : '#F44336'} 
                    />
                  </View>
                  
                  <View style={styles.movementInfo}>
                    <Text style={[styles.movementType, { color: colors.onSurface }]}>
                      {movement.type === 'entrada' ? 'Entrada' : 'Salida'}
                    </Text>
                    <Text style={[styles.movementDate, { color: colors.outline }]}>
                      {formatDate(movement.fecha)}
                    </Text>
                    <Text style={[styles.movementProduct, { color: colors.outline }]}>
                      {movement.producto}
                    </Text>
                    <Text style={[styles.movementTienda, { color: colors.outline }]}>
                      {movement.tienda}
                    </Text>
                  </View>

                  <View style={styles.movementAmountContainer}>
                    <Text style={[styles.movementAmount, { color: movement.type === 'entrada' ? '#4CAF50' : '#F44336' }]}>
                      {movement.type === 'entrada' ? '+' : ''}{formatQuantity(movement.cantidad)}
                    </Text>
                    <Text style={[styles.movementBalance, { color: colors.primary }]}>
                      Stock: {formatQuantity(movement.balance)}
                    </Text>
                  </View>
                </View>

                <View style={styles.movementDetails}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.outline }]}>Usuario:</Text>
                    <Text style={[styles.detailValue, { color: colors.onSurface }]}>{movement.usuario}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {stockMovements.length === 0 && !isLoading && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={60} color={colors.outline} />
            <Text style={[styles.emptyStateText, { color: colors.outline }]}>
              No hay movimientos para el rango de fechas seleccionado
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  inputWithDropdown: {
    paddingRight: responsive.responsivePadding(40),
  },
  inputContainer: {
    position: 'relative',
  },
  dropdownIcon: {
    position: 'absolute',
    right: responsive.responsiveMargin(12),
    top: responsive.responsiveMargin(12),
  },
  dropdown: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: 200,
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
  movementCard: {
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  movementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
  },
  movementIconContainer: {
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  movementInfo: {
    flex: 1,
  },
  movementType: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  movementDate: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  movementProduct: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  movementTienda: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  movementAmountContainer: {
    alignItems: 'flex-end',
  },
  movementAmount: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  movementBalance: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  movementDetails: {
    paddingHorizontal: responsive.responsivePadding(16),
    paddingBottom: responsive.responsivePadding(16),
    paddingTop: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  detailLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  detailValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    fontWeight: '500',
  },
});

export default InformeSeguimientoProductoContent;
