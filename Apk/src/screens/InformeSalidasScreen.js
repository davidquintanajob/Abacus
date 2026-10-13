import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
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
import { Svg, Circle, G, Path } from 'react-native-svg';
import { getSalidas } from '../services/salidaService';

const InformeSalidasContent = () => {
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

  const [reportData, setReportData] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const handleGenerateReport = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    setShowLoadingModal(true);
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Consultando datos...');

    try {
      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      setLoadingProgress(20);
      setLoadingMessage('Consultando salidas...');

      let allSalidas = [];
      let page = 1;
      const limit = 10000;
      let hasMore = true;

      while (hasMore) {
        const salidasData = await getSalidas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, page, limit);
        const salidas = salidasData.data || [];
        allSalidas = [...allSalidas, ...salidas];

        hasMore = salidas.length === limit && (salidasData.pagination?.currentPage < salidasData.pagination?.totalPages);
        page++;

        setLoadingProgress(20 + (page * 15));
        setLoadingMessage(`Consultando salidas... (${allSalidas.length} registros)`);
      }

      setLoadingProgress(80);
      setLoadingMessage('Calculando datos...');

      // Calculate total losses and losses per product
      let totalPerdidasCUP = 0;
      const productosPerdidas = new Map();
      const productosSalidasCount = new Map();

      for (const salida of allSalidas) {
        const cantidad = parseFloat(salida.cantidad_total || 1);
        const costoCUP = parseFloat(salida.costo_cup || 0);
        const productoNombre = salida.servicioTienda?.servicio?.nombre || 'Producto desconocido';

        const perdidaTotal = costoCUP * cantidad;
        totalPerdidasCUP += perdidaTotal;

        if (!productosPerdidas.has(productoNombre)) {
          productosPerdidas.set(productoNombre, { perdida: 0 });
        }

        const productoData = productosPerdidas.get(productoNombre);
        productoData.perdida += perdidaTotal;

        // Count salidas per product
        if (!productosSalidasCount.has(productoNombre)) {
          productosSalidasCount.set(productoNombre, 0);
        }
        productosSalidasCount.set(productoNombre, productosSalidasCount.get(productoNombre) + 1);
      }

      // Get top 5 products with most losses
      const topProductosPerdidas = Array.from(productosPerdidas.entries())
        .map(([nombre, data]) => ({
          nombre,
          perdida: data.perdida,
          porcentaje: totalPerdidasCUP > 0 ? (data.perdida / totalPerdidasCUP) * 100 : 0,
        }))
        .sort((a, b) => b.perdida - a.perdida)
        .slice(0, 5);

      // Add "Otros" category if less than 100%
      const topProductosPercentage = topProductosPerdidas.reduce((sum, p) => sum + p.porcentaje, 0);
      if (topProductosPercentage < 100 && topProductosPercentage > 0) {
        topProductosPerdidas.push({
          nombre: 'Otros',
          perdida: totalPerdidasCUP - topProductosPerdidas.reduce((sum, p) => sum + p.perdida, 0),
          porcentaje: 100 - topProductosPercentage,
        });
      }

      setLoadingProgress(100);
      setLoadingMessage('Generando informe...');

      setReportData({
        totalSalidas: allSalidas.length,
        totalPerdidasCUP,
        topProductosPerdidas,
        allSalidas,
        productosSalidasCount: Array.from(productosSalidasCount.entries())
          .map(([nombre, count]) => ({ nombre, count }))
          .sort((a, b) => b.count - a.count),
      });

      setTimeout(() => {
        setShowLoadingModal(false);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: error.message || 'Error al generar el informe' });
      setShowLoadingModal(false);
      setIsLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00';
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
            fill={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            stroke={isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth={2}
          />
        </Svg>
      );
    }

    let startAngle = 0;
    const radius = size / 2;
    const center = size / 2;

    return (
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const angle = (item.value / total) * 360;
          const endAngle = startAngle + angle;

          const x1 = center + radius * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = center + radius * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = center + radius * Math.cos((endAngle - 90) * Math.PI / 180);
          const y2 = center + radius * Math.sin((endAngle - 90) * Math.PI / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;

          const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

          startAngle = endAngle;

          return (
            <G key={index}>
              <Path
                d={pathData}
                fill={item.color}
                stroke={colors.surface}
                strokeWidth={2}
              />
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
        currentRoute="InformeSalidas"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Pérdidas por Salidas</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Análisis de pérdidas de productos
          </Text>
        </View>

        {/* Date Range Card */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Rango de Fechas</Text>
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
            {/* Total Salidas Card */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Resumen de Salidas</Text>
              
              {/* Products with salida count */}
              {reportData.productosSalidasCount && reportData.productosSalidasCount.length > 0 && (
                <View style={styles.productosSalidasList}>
                  <Text style={[styles.subsectionTitle, { color: colors.outline }]}>Productos involucrados en salidas:</Text>
                  {reportData.productosSalidasCount.map((producto, index) => (
                    <View key={index} style={styles.productoSalidaRow}>
                      <Text style={[styles.productoSalidaNombre, { color: colors.onSurface }]} numberOfLines={1}>
                        {producto.nombre}
                      </Text>
                      <Text style={[styles.productoSalidaCount, { color: colors.primary }]}>
                        {producto.count} salida{producto.count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.outline }]}>Total de Salidas:</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>
                  {reportData.totalSalidas}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.outline }]}>Pérdidas Totales CUP:</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>
                  {formatNumber(reportData.totalPerdidasCUP)} CUP
                </Text>
              </View>
            </Card>

            {/* Pie Chart Card */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Top 5 Productos con más Pérdidas</Text>
              <View style={styles.chartContainer}>
                {(() => {
                  const pieData = reportData.topProductosPerdidas.map((producto, index) => ({
                    value: producto.perdida,
                    color: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#FF5722'][index % 5],
                    label: producto.nombre,
                    displayValue: producto.perdida,
                  }));

                  return (
                    <>
                      <PieChart
                        size={200}
                        data={pieData}
                      />
                      <View style={styles.legend}>
                        {pieData.map((item, index) => {
                          const percentage = reportData.totalPerdidasCUP > 0 
                            ? ((item.value / reportData.totalPerdidasCUP) * 100).toFixed(1) 
                            : '0.0';
                          return (
                            <View key={index} style={styles.legendItem}>
                              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                              <View style={styles.legendTextContainer}>
                                <Text style={[styles.legendText, { color: colors.onSurface }]}>{item.label}</Text>
                                <Text style={[styles.legendValue, { color: colors.outline }]}>
                                  {formatNumber(item.displayValue)} CUP
                                </Text>
                                <Text style={[styles.legendPercentage, { color: colors.primary }]}>
                                  {percentage}%
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  );
                })()}
              </View>
            </Card>

            {/* Top 5 Products List */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Top 5 Productos con más Pérdidas</Text>
              {reportData.topProductosPerdidas.map((producto, index) => (
                <View key={index} style={styles.productRow}>
                  <Text style={[styles.productName, { color: colors.onSurface }]} numberOfLines={1}>
                    {producto.nombre}
                  </Text>
                  <View style={styles.productStatsContainer}>
                    <Text style={[styles.productPerdida, { color: colors.primary }]}>
                      {formatNumber(producto.perdida)} CUP
                    </Text>
                    <Text style={[styles.productPorcentaje, { color: colors.outline }]}>
                      {(producto.porcentaje || 0).toFixed(1)}% del total
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleFechaDesdeChange}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={handleFechaHastaChange}
        />
      )}

      {/* Loading Modal */}
      <Modal
        visible={showLoadingModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalOverlay}>
          <View style={[styles.loadingModalContent, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingMessage, { color: colors.onSurface }]}>
              {loadingMessage}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.outlineVariant }]}>
              <View 
                style={[styles.progressFill, { backgroundColor: colors.primary, width: `${loadingProgress}%` }]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.outline }]}>
              {loadingProgress}%
            </Text>
          </View>
        </View>
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
    marginBottom: responsive.responsiveMargin(16),
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(16),
  },
  filterGroup: {
    flex: 1,
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(10),
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  generateButton: {
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  chartCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  totalLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  totalValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productosSalidasList: {
    marginBottom: responsive.responsiveMargin(16),
  },
  subsectionTitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  productoSalidaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  productoSalidaNombre: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginRight: responsive.responsiveMargin(8),
  },
  productoSalidaCount: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: responsive.responsiveMargin(16),
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendTextContainer: {
    flexDirection: 'column',
  },
  legendText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  legendValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  legendPercentage: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  productName: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginRight: responsive.responsiveMargin(8),
  },
  productStatsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  productPerdida: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productPorcentaje: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContent: {
    width: '80%',
    padding: responsive.responsivePadding(24),
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingMessage: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: responsive.responsiveHeight(8),
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(8),
  },
});

export default InformeSalidasContent;
