import React, { useState, useEffect, useRef } from 'react';
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
import { Svg, Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { Camera } from 'expo-camera';
import { getProductos } from '../services/productoService';

const InventarioProductosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    nombre: '',
    categoria: '',
    codigo: '',
    esvendible: '',
    cantidad_min: 0.01
  });

  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [showNombreDropdown, setShowNombreDropdown] = useState(false);
  const [nombreSearchText, setNombreSearchText] = useState('');
  const [nombreSuggestions, setNombreSuggestions] = useState([]);
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [categoriaSearchText, setCategoriaSearchText] = useState('');
  const [predefinedCategories] = useState(['Alimentos', 'Bebidas', 'Limpieza', 'Higiene Personal', 'Electrónicos', 'Ropa', 'Hogar', 'Otros']);
  const [customCategories, setCustomCategories] = useState([]);
  const categoriaDropdownTimeoutRef = useRef(null);

  const [reportData, setReportData] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const formatLocalDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatQuantity = (value) => {
    if (typeof value !== 'number') return '0';
    if (value % 1 === 0) return value.toString();
    return value.toFixed(2);
  };

  // Search product names by endpoint
  const searchProductNames = async (searchText) => {
    if (searchText.length < 3) {
      setNombreSuggestions([]);
      return;
    }

    try {
      const result = await getProductos({ nombre: searchText, skipEsvendible: true });
      const nombres = [...new Set(result.data?.map(p => p.nombre) || [])];
      setNombreSuggestions(nombres);
    } catch (error) {
      console.error('Error searching product names:', error);
      setNombreSuggestions([]);
    }
  };

  // Load categories from system
  const loadSystemCategories = async () => {
    try {
      const result = await getProductos({ skipEsvendible: true });
      const categorias = [...new Set(result.data?.map(p => p.categoria?.trim()).filter(c => c) || [])];
      setCustomCategories(categorias);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    // Don't auto-load categories on mount to avoid unnecessary API calls
    // loadSystemCategories();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (nombreSearchText.length >= 3) {
        searchProductNames(nombreSearchText);
      } else {
        setNombreSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [nombreSearchText]);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(status);
    })();
  }, []);

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleOpenScanner = async () => {
    navigation.navigate('BarcodeScanner', {
      onCodeScanned: (code) => {
        setFilters(prev => ({ ...prev, codigo: code }));
        showToast({ type: 'success', message: 'Código escaneado correctamente' });
      }
    });
  };

  const handleGenerateReport = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    setShowLoadingModal(true);
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Consultando productos...');

    try {
      setLoadingProgress(30);

      // Fetch all products with filters (skip esvendible parameter)
      const filtersWithSkip = { ...filters, skipEsvendible: true };

      const productosData = await getProductos(filtersWithSkip);

      let productos = productosData.data || [];

      setLoadingProgress(60);
      setLoadingMessage('Calculando datos...');

      // Calculate total cost and total value for each product across all tiendas
      const productStats = {};

      productos.forEach(producto => {
        const tiendasServicio = producto.tiendas_servicio || [];

        tiendasServicio.forEach(ts => {
          const cantidad = parseFloat(ts.cantidad) || 0;
          const costoCup = parseFloat(ts.costo_cup) || 0;
          const precioCup = parseFloat(ts.precio_cup) || 0;

          if (cantidad >= filters.cantidad_min) {
            if (!productStats[producto.id_servicio]) {
              productStats[producto.id_servicio] = {
                id_producto: producto.id_servicio,
                nombre: producto.nombre,
                categoria: producto.categoria || '',
                codigo: producto.codigos?.[0]?.codigo_barras_ean || '',
                totalCantidad: 0,
                totalCostoCUP: 0,
                totalValorCUP: 0
              };
            }

            productStats[producto.id_servicio].totalCantidad += cantidad;
            productStats[producto.id_servicio].totalCostoCUP += cantidad * costoCup;
            productStats[producto.id_servicio].totalValorCUP += cantidad * precioCup;
          }
        });
      });

      console.log('InventarioProductosScreen - ProductStats:', productStats);
      const statsArray = Object.values(productStats);
      console.log('InventarioProductosScreen - StatsArray length:', statsArray.length);

      // Sort by total cost for cost chart
      const top5ByCost = [...statsArray]
        .sort((a, b) => b.totalCostoCUP - a.totalCostoCUP)
        .slice(0, 5);

      const otherCost = statsArray
        .filter(p => !top5ByCost.find(t => t.id_producto === p.id_producto))
        .reduce((sum, p) => sum + p.totalCostoCUP, 0);

      const costChartData = top5ByCost.map(p => ({
        label: p.nombre,
        value: p.totalCostoCUP,
        color: getChartColor(top5ByCost.indexOf(p))
      }));

      if (otherCost > 0) {
        costChartData.push({
          label: 'Otros',
          value: otherCost,
          color: '#9E9E9E'
        });
      }

      // Sort by total value for value chart
      const top5ByValue = [...statsArray]
        .sort((a, b) => b.totalValorCUP - a.totalValorCUP)
        .slice(0, 5);

      const otherValue = statsArray
        .filter(p => !top5ByValue.find(t => t.id_producto === p.id_producto))
        .reduce((sum, p) => sum + p.totalValorCUP, 0);

      const valueChartData = top5ByValue.map(p => ({
        label: p.nombre,
        value: p.totalValorCUP,
        color: getChartColor(top5ByValue.indexOf(p))
      }));

      if (otherValue > 0) {
        valueChartData.push({
          label: 'Otros',
          value: otherValue,
          color: '#9E9E9E'
        });
      }

      setLoadingProgress(100);
      setLoadingMessage('Completado');

      // Calculate total cost and total value across all products
      const totalCostAll = statsArray.reduce((sum, p) => sum + p.totalCostoCUP, 0);
      const totalValueAll = statsArray.reduce((sum, p) => sum + p.totalValorCUP, 0);

      setReportData({
        top5ByCost,
        otherCost,
        costChartData,
        top5ByValue,
        otherValue,
        valueChartData,
        totalProductos: statsArray.length,
        totalCostAll,
        totalValueAll
      });

    } catch (error) {
      showToast({ type: 'error', message: 'Error al generar informe: ' + error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setShowLoadingModal(false), 500);
    }
  };

  const getChartColor = (index) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
    return colors[index % colors.length];
  };

  const formatCurrency = (value) => {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const PieChart = ({ data, size = 200 }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
      return (
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill="none"
            stroke={isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth={2}
          />
        </Svg>
      );
    }

    let startAngle = 0;
    const center = size / 2;

    return (
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const angle = (item.value / total) * 360;
          const endAngle = startAngle + angle;

          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = center + (size / 2 - 10) * Math.cos(startRad);
          const y1 = center + (size / 2 - 10) * Math.sin(startRad);
          const x2 = center + (size / 2 - 10) * Math.cos(endRad);
          const y2 = center + (size / 2 - 10) * Math.sin(endRad);

          const largeArc = angle > 180 ? 1 : 0;

          const pathData = angle === 360
            ? `M ${center} ${center - (size / 2 - 10)} A ${size / 2 - 10} ${size / 2 - 10} 0 1 1 ${center} ${center + (size / 2 - 10)} A ${size / 2 - 10} ${size / 2 - 10} 0 1 1 ${center} ${center - (size / 2 - 10)}`
            : `M ${center} ${center} L ${x1} ${y1} A ${size / 2 - 10} ${size / 2 - 10} 0 ${largeArc} 1 ${x2} ${y2} Z`;

          startAngle = endAngle;

          return (
            <G key={index}>
              <Path d={pathData} fill={item.color} />
            </G>
          );
        })}
      </Svg>
    );
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
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="InventarioProductos"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Inventario de Productos</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Análisis de stock y valor de inventario
          </Text>
        </View>

        {/* Date Range Card */}
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

          {/* Nombre field outside collapsible */}
          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.inputWithDropdown, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Buscar por nombre..."
                value={filters.nombre}
                onChangeText={(text) => {
                  setFilters(prev => ({ ...prev, nombre: text }));
                  setNombreSearchText(text);
                }}
                onFocus={() => setShowNombreDropdown(true)}
              />
              <TouchableOpacity
                style={styles.dropdownIcon}
                onPress={() => setShowNombreDropdown(!showNombreDropdown)}
              >
                <Ionicons name={showNombreDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
              </TouchableOpacity>
            </View>
            {showNombreDropdown && nombreSuggestions.length > 0 && (
              <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {nombreSuggestions
                    .filter(nombre => nombre.toLowerCase().includes(nombreSearchText.toLowerCase()))
                    .map((nombre, index, filteredArray) => (
                      <TouchableOpacity
                        key={nombre}
                        style={[styles.dropdownItem, index === filteredArray.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, nombre }));
                          setShowNombreDropdown(false);
                          setNombreSearchText('');
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{nombre}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <View style={styles.advancedFiltersContainer}>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Categoría</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.inputWithDropdown, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Seleccionar o escribir categoría..."
                    value={filters.categoria}
                    onChangeText={(text) => {
                      setFilters(prev => ({ ...prev, categoria: text }));
                      setCategoriaSearchText(text);
                    }}
                    onFocus={() => {
                      if (categoriaDropdownTimeoutRef.current) {
                        clearTimeout(categoriaDropdownTimeoutRef.current);
                      }
                      setShowCategoriaDropdown(true);
                    }}
                    onBlur={() => {
                      categoriaDropdownTimeoutRef.current = setTimeout(() => {
                        setShowCategoriaDropdown(false);
                        // Only keep the category if it exists in the system
                        const allCategories = [...predefinedCategories, ...customCategories];
                        if (filters.categoria && !allCategories.includes(filters.categoria.trim())) {
                          setFilters(prev => ({ ...prev, categoria: '' }));
                        }
                      }, 200);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.dropdownIcon}
                    onPress={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
                  >
                    <Ionicons name={showCategoriaDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
                  </TouchableOpacity>
                </View>
                {showCategoriaDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {[...new Set([...predefinedCategories, ...customCategories])]
                        .filter(cat => cat && cat.trim() && cat.toLowerCase().includes(categoriaSearchText.toLowerCase()))
                        .map((category, index, filteredArray) => (
                          <TouchableOpacity
                            key={`${category}-${index}`}
                            style={[styles.dropdownItem, index === filteredArray.length - 1 && styles.dropdownItemLast]}
                            onPress={() => {
                              setFilters(prev => ({ ...prev, categoria: category }));
                              setShowCategoriaDropdown(false);
                              setCategoriaSearchText('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{category}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Código</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.inputWithIconText, { color: colors.onSurface }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar por código de barras..."
                    value={filters.codigo}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, codigo: text }))}
                  />
                  <TouchableOpacity
                    onPress={handleOpenScanner}
                    style={styles.cameraButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="camera-outline" 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.primary} 
                    />
                  </TouchableOpacity>
                </View>
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

        {/* Report Results */}
        {reportData && (
          <>
            {/* Cost Chart Card */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.chartTitle, { color: colors.onSurface }]}>
                Top 5 Productos por Costo Total
              </Text>
              <View style={styles.chartContainer}>
                <PieChart size={200} data={reportData.costChartData} />
              </View>
              <View style={styles.chartLegend}>
                {reportData.top5ByCost.map((item, index) => {
                  const percentage = reportData.totalCostAll > 0 ? ((item.totalCostoCUP / reportData.totalCostAll) * 100).toFixed(1) : '0.0';
                  return (
                    <View key={index} style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: getChartColor(index) }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>
                        {item.nombre}
                      </Text>
                      <View style={styles.legendValueContainer}>
                        <Text style={[styles.legendValue, { color: colors.onSurface }]}>
                          {formatCurrency(item.totalCostoCUP)} CUP
                        </Text>
                        <Text style={[styles.legendQuantity, { color: colors.outline }]}>
                          {formatQuantity(item.totalCantidad)} unidades
                        </Text>
                        <Text style={[styles.legendPercentage, { color: colors.outline }]}>
                          {percentage}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {reportData.otherCost > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#9E9E9E' }]} />
                    <Text style={[styles.legendText, { color: colors.onSurface }]}>
                      Otros
                    </Text>
                    <View style={styles.legendValueContainer}>
                      <Text style={[styles.legendValue, { color: colors.onSurface }]}>
                        {formatCurrency(reportData.otherCost)} CUP
                      </Text>
                      <Text style={[styles.legendPercentage, { color: colors.outline }]}>
                        {reportData.totalCostAll > 0 ? ((reportData.otherCost / reportData.totalCostAll) * 100).toFixed(1) : '0.0'}%
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[styles.legendItem, styles.legendTotalItem]}>
                  <Text style={[styles.legendTotalLabel, { color: colors.onSurface }]}>
                    Total de Costo
                  </Text>
                  <Text style={[styles.legendTotalValue, { color: colors.primary }]}>
                    {formatCurrency(reportData.totalCostAll)} CUP
                  </Text>
                </View>
              </View>
            </Card>

            {/* Value Chart Card */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.chartTitle, { color: colors.onSurface }]}>
                Top 5 Productos por Valor de Venta
              </Text>
              <View style={styles.chartContainer}>
                <PieChart size={200} data={reportData.valueChartData} />
              </View>
              <View style={styles.chartLegend}>
                {reportData.top5ByValue.map((item, index) => {
                  const percentage = reportData.totalValueAll > 0 ? ((item.totalValorCUP / reportData.totalValueAll) * 100).toFixed(1) : '0.0';
                  return (
                    <View key={index} style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: getChartColor(index) }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>
                        {item.nombre}
                      </Text>
                      <View style={styles.legendValueContainer}>
                        <Text style={[styles.legendValue, { color: colors.onSurface }]}>
                          {formatCurrency(item.totalValorCUP)} CUP
                        </Text>
                        <Text style={[styles.legendQuantity, { color: colors.outline }]}>
                          {formatQuantity(item.totalCantidad)} unidades
                        </Text>
                        <Text style={[styles.legendPercentage, { color: colors.outline }]}>
                          {percentage}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {reportData.otherValue > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: '#9E9E9E' }]} />
                    <Text style={[styles.legendText, { color: colors.onSurface }]}>
                      Otros
                    </Text>
                    <View style={styles.legendValueContainer}>
                      <Text style={[styles.legendValue, { color: colors.onSurface }]}>
                        {formatCurrency(reportData.otherValue)} CUP
                      </Text>
                      <Text style={[styles.legendPercentage, { color: colors.outline }]}>
                        {reportData.totalValueAll > 0 ? ((reportData.otherValue / reportData.totalValueAll) * 100).toFixed(1) : '0.0'}%
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[styles.legendItem, styles.legendTotalItem]}>
                  <Text style={[styles.legendTotalLabel, { color: colors.onSurface }]}>
                    Total de Venta
                  </Text>
                  <Text style={[styles.legendTotalValue, { color: colors.primary }]}>
                    {formatCurrency(reportData.totalValueAll)} CUP
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Loading Modal */}
      <Modal
        visible={showLoadingModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalOverlay}>
          <View style={[styles.loadingModalContent, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.onSurface }]}>
              {loadingMessage}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${loadingProgress}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal
        visible={showScannerModal}
        animationType="slide"
      >
        <SafeAreaView style={[styles.scannerModal, { backgroundColor: colors.background }]}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScannerModal(false)}>
              <Ionicons name="close" size={32} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.scannerTitle, { color: colors.onSurface }]}>
              Escanear Código
            </Text>
            <View style={{ width: 32 }} />
          </View>
          {/* Scanner implementation would go here */}
          <Text style={[styles.scannerPlaceholder, { color: colors.outline }]}>
            Escáner de código de barras
          </Text>
        </SafeAreaView>
      </Modal>
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
    marginBottom: responsive.responsiveMargin(16),
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
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveWidth(40),
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(16),
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(12),
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
  },
  advancedFiltersContainer: {
    marginTop: responsive.responsiveMargin(16),
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
    padding: responsive.responsivePadding(12),
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
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  inputWithIconText: {
    flex: 1,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  cameraButton: {
    padding: responsive.responsivePadding(12),
  },
  statusFilterSwitches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusFilterItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: responsive.responsiveMargin(4),
  },
  statusFilterSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  statusFilterKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusFilterText: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  generateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
  },
  generateButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    color: '#fff',
  },
  chartCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
  },
  chartTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  chartLegend: {
    marginTop: responsive.responsiveMargin(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: responsive.responsiveMargin(12),
  },
  legendText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  legendValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  legendValueContainer: {
    alignItems: 'flex-end',
  },
  legendQuantity: {
    fontSize: responsive.responsiveFontSize(11),
    fontFamily: 'Inter',
    marginTop: 2,
  },
  legendPercentage: {
    fontSize: responsive.responsiveFontSize(11),
    fontFamily: 'Inter',
    marginTop: 2,
  },
  legendTotalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderTopWidth: 2,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: responsive.responsiveMargin(8),
  },
  legendTotalLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  legendTotalValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    fontWeight: '700',
  },
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingModalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '80%',
    maxWidth: 300,
  },
  loadingText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    marginTop: responsive.responsiveMargin(16),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  scannerModal: {
    flex: 1,
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsive.responsivePadding(16),
  },
  scannerTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  scannerPlaceholder: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: responsive.responsiveMargin(40),
  },
});

export default InventarioProductosContent;
