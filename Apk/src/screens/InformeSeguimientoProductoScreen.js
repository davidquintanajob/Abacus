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
import { getSeguimientoInventario, getProductos } from '../services/productoService';
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
  const [seguimientoData, setSeguimientoData] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
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

    if (!filters.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
      return;
    }

    setIsLoading(true);
    try {
      const selectedProducto = productos.find(p => p.nombre === filters.producto);
      const selectedTienda = tiendas.find(t => t.nombre === filters.tienda);

      if (!selectedProducto) {
        showToast({ type: 'error', message: 'Producto no encontrado' });
        return;
      }

      if (!selectedTienda) {
        showToast({ type: 'error', message: 'Tienda no encontrada' });
        return;
      }

      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      const data = await getSeguimientoInventario(
        selectedProducto.id_servicio,
        selectedTienda.id_tienda,
        fechaDesde,
        fechaHasta
      );

      setSeguimientoData(data);
      setExpandedGroups({});
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

  const getGroupColor = (tipo) => {
    switch (tipo) {
      case 'entrada':
        return { color: '#4CAF50', bgColor: '#E8F5E9' };
      case 'salida':
        return { color: '#F44336', bgColor: '#FFEBEE' };
      case 'venta':
        return { color: '#FF9800', bgColor: '#FFF3E0' };
      case 'movimiento':
        return { color: '#2196F3', bgColor: '#E3F2FD' };
      default:
        return { color: '#757575', bgColor: '#F5F5F5' };
    }
  };

  const getGroupIcon = (tipo) => {
    switch (tipo) {
      case 'entrada':
        return 'arrow-down-circle-outline';
      case 'salida':
        return 'arrow-up-circle-outline';
      case 'venta':
        return 'cart-outline';
      case 'movimiento':
        return 'swap-horizontal-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const formatGroupType = (tipo, subtipo) => {
    if (tipo === 'movimiento' && subtipo) {
      return `Movimiento (${subtipo})`;
    }
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return dateString || 'N/A';
    }
  };

  const renderDetalle = (detalle, groupType, colors, responsive) => {
    switch (groupType) {
      case 'entrada':
        return (
          <View style={styles.detalleContent}>
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Fecha:</Text>
              <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{formatDateTime(detalle.fecha)}</Text>
            </View>
            {detalle.codigo_lote && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Código Lote:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.codigo_lote}</Text>
              </View>
            )}
            {detalle.proveedor && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Proveedor:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.proveedor}</Text>
              </View>
            )}
            {detalle.fecha_vencimiento && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Vencimiento:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{formatDate(detalle.fecha_vencimiento)}</Text>
              </View>
            )}
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Cantidad:</Text>
              <Text style={[styles.detalleValue, { color: colors.primary, fontWeight: '600' }]}>{formatQuantity(detalle.cantidad)}</Text>
            </View>
          </View>
        );
      case 'salida':
        return (
          <View style={styles.detalleContent}>
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Fecha:</Text>
              <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{formatDateTime(detalle.fecha)}</Text>
            </View>
            {detalle.codigo_lote && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Código Lote:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.codigo_lote}</Text>
              </View>
            )}
            {detalle.motivo && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Motivo:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.motivo}</Text>
              </View>
            )}
            {detalle.tipo_salida && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Tipo Salida:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.tipo_salida}</Text>
              </View>
            )}
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Cantidad:</Text>
              <Text style={[styles.detalleValue, { color: colors.primary, fontWeight: '600' }]}>{formatQuantity(detalle.cantidad)}</Text>
            </View>
          </View>
        );
      case 'venta':
        return (
          <View style={styles.detalleContent}>
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Fecha:</Text>
              <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{formatDateTime(detalle.fecha)}</Text>
            </View>
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Cantidad:</Text>
              <Text style={[styles.detalleValue, { color: colors.primary, fontWeight: '600' }]}>{formatQuantity(detalle.cantidad)}</Text>
            </View>
          </View>
        );
      case 'movimiento':
        return (
          <View style={styles.detalleContent}>
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Fecha:</Text>
              <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{formatDateTime(detalle.fecha)}</Text>
            </View>
            {detalle.tienda_origen && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Origen:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.tienda_origen}</Text>
              </View>
            )}
            {detalle.tienda_destino && (
              <View style={styles.detalleRow}>
                <Text style={[styles.detalleLabel, { color: colors.outline }]}>Destino:</Text>
                <Text style={[styles.detalleValue, { color: colors.onSurface }]}>{detalle.tienda_destino}</Text>
              </View>
            )}
            <View style={styles.detalleRow}>
              <Text style={[styles.detalleLabel, { color: colors.outline }]}>Cantidad:</Text>
              <Text style={[styles.detalleValue, { color: colors.primary, fontWeight: '600' }]}>{formatQuantity(detalle.cantidad)}</Text>
            </View>
          </View>
        );
      default:
        return null;
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

          {/* Tienda field (mandatory, outside collapsible) */}
          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.inputWithDropdown, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Seleccionar tienda (obligatorio)..."
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
                        <Text style={[styles.dropdownItemText, { color: colors.outline }]}>Seleccionar tienda...</Text>
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
        {seguimientoData && (
          <View style={styles.resultsContainer}>
            {/* Header Info */}
            <Card style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.outline }]}>Producto:</Text>
                <Text style={[styles.infoValue, { color: colors.onSurface }]}>{seguimientoData.producto?.nombre}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.outline }]}>Tienda:</Text>
                <Text style={[styles.infoValue, { color: colors.onSurface }]}>{seguimientoData.tienda?.nombre}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.outline }]}>Stock Actual:</Text>
                <Text style={[styles.infoValue, { color: colors.primary, fontWeight: '600' }]}>{formatQuantity(seguimientoData.stock_actual)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.outline }]}>Total Grupos:</Text>
                <Text style={[styles.infoValue, { color: colors.onSurface }]}>{seguimientoData.total_grupos}</Text>
              </View>
            </Card>

            <Text style={[styles.resultsTitle, { color: colors.onSurface }]}>
              Seguimiento ({seguimientoData.seguimiento?.length || 0} grupos)
            </Text>

            {seguimientoData.seguimiento?.map((grupo, index) => {
              const isExpanded = expandedGroups[index];
              const groupType = grupo.tipo;
              const groupColor = getGroupColor(groupType);

              return (
                <Card key={index} style={[styles.groupCard, { backgroundColor: colors.surface }]}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => setExpandedGroups(prev => ({ ...prev, [index]: !prev[index] }))}
                  >
                    <View style={[styles.groupIconContainer, { backgroundColor: groupColor.bgColor }]}>
                      <Ionicons name={getGroupIcon(groupType)} size={24} color={groupColor.color} />
                    </View>

                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupType, { color: colors.onSurface }]}>
                        {formatGroupType(groupType, grupo.subtipo)}
                      </Text>
                      <Text style={[styles.groupDate, { color: colors.outline }]}>
                        {formatDate(grupo.fecha_inicio)} - {formatDate(grupo.fecha_fin)}
                      </Text>
                      <Text style={[styles.groupQuantity, { color: colors.outline }]}>
                        {grupo.cantidad_registros} registros
                      </Text>
                    </View>

                    <View style={styles.groupAmountContainer}>
                      <Text style={[styles.groupAmount, { color: groupColor.color }]}>
                        {grupo.efecto_numerico > 0 ? '+' : ''}{formatQuantity(grupo.efecto_numerico)}
                      </Text>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.outline}
                      style={styles.chevronIcon}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.groupDetails}>
                      {grupo.detalles?.map((detalle, detIndex) => (
                        <View key={detIndex} style={styles.detailItem}>
                          {renderDetalle(detalle, groupType, colors, responsive)}
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {!seguimientoData && !isLoading && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={60} color={colors.outline} />
            <Text style={[styles.emptyStateText, { color: colors.outline }]}>
              Seleccione un producto y tienda para generar el informe
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
    marginTop: responsive.responsiveMargin(8),
  },
  detailLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginRight: responsive.responsiveMargin(8),
  },
  detailValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    flex: 1,
  },
  infoCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(8),
  },
  infoLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    width: responsive.responsiveWidth(120),
    color: '#757575',
  },
  infoValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    flex: 1,
  },
  groupCard: {
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
  },
  groupIconContainer: {
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  groupInfo: {
    flex: 1,
  },
  groupType: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  groupDate: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  groupQuantity: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  groupAmountContainer: {
    alignItems: 'flex-end',
    marginRight: responsive.responsiveMargin(12),
  },
  groupAmount: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  chevronIcon: {
    marginLeft: responsive.responsiveMargin(8),
  },
  groupDetails: {
    paddingHorizontal: responsive.responsivePadding(16),
    paddingBottom: responsive.responsivePadding(16),
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailItem: {
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  detalleContent: {
    paddingVertical: responsive.responsivePadding(8),
  },
  detalleRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(4),
  },
  detalleLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginRight: responsive.responsiveMargin(8),
    width: responsive.responsiveWidth(100),
  },
  detalleValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    flex: 1,
  },
});

export default InformeSeguimientoProductoContent;
