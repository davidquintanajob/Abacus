import React, { useState, useEffect } from 'react';
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
import { Svg, Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { getVentas } from '../services/ventaService';
import { getSalidas } from '../services/salidaService';
import configService from '../services/configService';

const InformeGeneralContent = () => {
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

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
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
      // Format dates as YYYY-MM-DD strings (backend expects this format)
      const fechaDesde = startDate.toISOString().split('T')[0];
      const fechaHasta = endDate.toISOString().split('T')[0];

      setLoadingProgress(20);
      setLoadingMessage('Consultando ventas...');

      // Fetch ventas with date filter
      const ventasData = await getVentas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, 1, 1000);
      const ventas = ventasData.data || [];

      setLoadingProgress(50);
      setLoadingMessage('Consultando salidas...');

      // Fetch salidas with date filter
      const salidasData = await getSalidas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, 1, 1000);
      const salidas = salidasData.data || [];

      setLoadingProgress(70);
      setLoadingMessage('Obteniendo configuración...');

      // Get config for exchange rate
      const config = await configService.getConfig();
      const cambioMoneda = config.cupToUsdRate || 1;

      setLoadingProgress(85);
      setLoadingMessage('Calculando datos...');

      // Calculate sales income from ListaVenta (cash + transfers)
      let ingresosVentasCUP = 0;
      let ingresosVentasUSD = 0;
      let costosVentasCUP = 0;
      let costosVentasUSD = 0;

      const productosGanancia = new Map();

      for (const listaVenta of ventas) {
        console.log('[Informe] Procesando listaVenta ID:', listaVenta.id_lista_venta);

        // Income from ListaVenta (amount collected)
        const efectivoCUP = parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
        const efectivoUSD = parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
        const transferenciaCUP = parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        const transferenciaUSD = parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);

        const totalIngresoCUP = efectivoCUP + transferenciaCUP;
        const totalIngresoUSD = efectivoUSD + transferenciaUSD;

        console.log('[Informe] Ingresos - CUP:', totalIngresoCUP, 'USD:', totalIngresoUSD);

        ingresosVentasCUP += totalIngresoCUP;
        ingresosVentasUSD += totalIngresoUSD;

        // Calculate total expected income from ventas (based on precio_cobrado)
        let totalPrecioCobradoCUP = 0;
        let totalPrecioCobradoUSD = 0;

        for (const venta of listaVenta.ventas || []) {
          const cantidad = parseFloat(venta.cantidad || 0);
          const precioCobradoCUP = parseFloat(venta.precio_cobrado_cup || 0);
          const precioCobradoUSD = parseFloat(venta.precio_cobrado_usd || 0);

          totalPrecioCobradoCUP += precioCobradoCUP * cantidad;
          totalPrecioCobradoUSD += precioCobradoUSD * cantidad;
        }

        console.log('[Informe] Total precio cobrado - CUP:', totalPrecioCobradoCUP, 'USD:', totalPrecioCobradoUSD);

        // Determine the currency of this sale based on actual income
        const isCUPSale = totalIngresoCUP > 0;
        const isUSDSale = totalIngresoUSD > 0;

        console.log('[Informe] Tipo de venta - isCUPSale:', isCUPSale, 'isUSDSale:', isUSDSale);

        // Distribute actual income proportionally among products
        for (const venta of listaVenta.ventas || []) {
          const cantidad = parseFloat(venta.cantidad || 0);
          const costoOriginalCUP = parseFloat(venta.costo_original_cup || 0);
          const costoOriginalUSD = parseFloat(venta.costo_original_usd || 0);
          const precioCobradoCUP = parseFloat(venta.precio_cobrado_cup || 0);
          const precioCobradoUSD = parseFloat(venta.precio_cobrado_usd || 0);

          console.log('[Informe] Producto:', venta.servicioTienda?.servicio?.nombre, 'Cantidad:', cantidad);
          console.log('[Informe] Costos - CUP:', costoOriginalCUP, 'USD:', costoOriginalUSD);
          console.log('[Informe] Precios cobrados - CUP:', precioCobradoCUP, 'USD:', precioCobradoUSD);

          // Distribute costs proportionally based on income currency
          // If sale is CUP only, add CUP costs
          // If sale is USD only, add USD costs
          // If sale is mixed, assign each cost to its corresponding currency income
          if (isCUPSale && !isUSDSale) {
            // CUP only sale - add CUP costs
            const costoTotalCUP = costoOriginalCUP * cantidad;
            costosVentasCUP += costoTotalCUP;
            console.log('[Informe] Venta CUP only - Agregando costo CUP:', costoTotalCUP);
          } else if (isUSDSale && !isCUPSale) {
            // USD only sale - add USD costs
            const costoTotalUSD = costoOriginalUSD * cantidad;
            costosVentasUSD += costoTotalUSD;
            console.log('[Informe] Venta USD only - Agregando costo USD:', costoTotalUSD);
          } else if (isCUPSale && isUSDSale) {
            // Mixed sale - assign each cost to its corresponding currency
            // Calculate percentage of expected price received in each currency
            const porcentajeCobroCUP = totalPrecioCobradoCUP > 0 ? totalIngresoCUP / totalPrecioCobradoCUP : 0;
            const porcentajeCobroUSD = totalPrecioCobradoUSD > 0 ? totalIngresoUSD / totalPrecioCobradoUSD : 0;

            const costoTotalCUP = costoOriginalCUP * cantidad;
            const costoTotalUSD = costoOriginalUSD * cantidad;

            // Assign CUP cost based on CUP payment percentage
            const costoCUPAsignado = costoTotalCUP * porcentajeCobroCUP;
            // Assign USD cost based on USD payment percentage
            const costoUSDAsignado = costoTotalUSD * porcentajeCobroUSD;

            costosVentasCUP += costoCUPAsignado;
            costosVentasUSD += costoUSDAsignado;

            console.log('[Informe] Venta mixta - % cobro CUP:', porcentajeCobroCUP, '% cobro USD:', porcentajeCobroUSD);
            console.log('[Informe] Costo CUP asignado:', costoCUPAsignado, 'Costo USD asignado:', costoUSDAsignado);
          }

          // Calculate profit per product using actual distributed income
          const productoNombre = venta.servicioTienda?.servicio?.nombre || 'Producto desconocido';

          const ventaPrecioCobradoCUP = precioCobradoCUP * cantidad;
          const ventaPrecioCobradoUSD = precioCobradoUSD * cantidad;

          // Proportion of total expected income
          const proporcionCUP = totalPrecioCobradoCUP > 0 ? ventaPrecioCobradoCUP / totalPrecioCobradoCUP : 0;
          const proporcionUSD = totalPrecioCobradoUSD > 0 ? ventaPrecioCobradoUSD / totalPrecioCobradoUSD : 0;

          console.log('[Informe] Proporciones - CUP:', proporcionCUP, 'USD:', proporcionUSD);

          // Actual income for this product
          const ingresoVentaCUP = totalIngresoCUP * proporcionCUP;
          const ingresoVentaUSD = totalIngresoUSD * proporcionUSD;

          console.log('[Informe] Ingreso por producto - CUP:', ingresoVentaCUP, 'USD:', ingresoVentaUSD);

          // Calculate profit using the assigned costs
          let gananciaVenta = 0;
          if (isCUPSale && !isUSDSale) {
            // CUP only sale
            const costoVentaCUP = costoOriginalCUP * cantidad;
            gananciaVenta = ingresoVentaCUP - costoVentaCUP;
            console.log('[Informe] Ganancia venta CUP only:', gananciaVenta);
          } else if (isUSDSale && !isCUPSale) {
            // USD only sale
            const costoVentaUSD = costoOriginalUSD * cantidad;
            const gananciaVentaUSD = ingresoVentaUSD - costoVentaUSD;
            // Convert USD profit to CUP for total calculation
            gananciaVenta = gananciaVentaUSD * cambioMoneda;
            console.log('[Informe] Ganancia venta USD only:', gananciaVentaUSD, 'Convertida a CUP:', gananciaVenta);
          } else if (isCUPSale && isUSDSale) {
            // Mixed sale - calculate profit for each currency and sum them
            const porcentajeCobroCUP = totalPrecioCobradoCUP > 0 ? totalIngresoCUP / totalPrecioCobradoCUP : 0;
            const porcentajeCobroUSD = totalPrecioCobradoUSD > 0 ? totalIngresoUSD / totalPrecioCobradoUSD : 0;

            const costoTotalCUP = costoOriginalCUP * cantidad;
            const costoTotalUSD = costoOriginalUSD * cantidad;

            const costoCUPAsignado = costoTotalCUP * porcentajeCobroCUP;
            const costoUSDAsignado = costoTotalUSD * porcentajeCobroUSD;

            const gananciaVentaCUP = ingresoVentaCUP - costoCUPAsignado;
            const gananciaVentaUSD = ingresoVentaUSD - costoUSDAsignado;

            // Sum both profits (convert USD to CUP)
            gananciaVenta = gananciaVentaCUP + (gananciaVentaUSD * cambioMoneda);

            console.log('[Informe] Ganancia venta mixta - CUP:', gananciaVentaCUP, 'USD:', gananciaVentaUSD, 'Total CUP:', gananciaVenta);
          }

          const currentGanancia = productosGanancia.get(productoNombre) || 0;
          productosGanancia.set(productoNombre, currentGanancia + gananciaVenta);
          console.log('[Informe] Ganancia acumulada para', productoNombre, ':', currentGanancia + gananciaVenta);
        }
      }

      console.log('[Informe] Totales finales - Ingresos CUP:', ingresosVentasCUP, 'Ingresos USD:', ingresosVentasUSD);
      console.log('[Informe] Totales finales - Costos CUP:', costosVentasCUP, 'Costos USD:', costosVentasUSD);

      // Calculate losses from salidas (costo_cup/usd is already total cost, not unit cost)
      // Only consider CUP losses since USD is equivalent to CUP
      let perdidasSalidasCUP = 0;
      let perdidasSalidasUSD = 0;

      console.log('[Informe] Procesando salidas, total:', salidas.length);

      for (const salida of salidas) {
        const cantidad = parseFloat(salida.cantidad_total || 1); // Use cantidad_total from API
        const costoCUP = parseFloat(salida.costo_cup || 0);
        const costoUSD = parseFloat(salida.costo_usd || 0);

        console.log('[Informe] Salida - Cantidad:', cantidad, 'Costo CUP:', costoCUP, 'Costo USD:', costoUSD);

        // Only add CUP cost to losses (USD cost is equivalent, not separate)
        // Multiply by cantidad to get total loss for all units
        perdidasSalidasCUP += costoCUP * cantidad;
        // Keep USD losses at 0 since they're equivalent to CUP
        perdidasSalidasUSD = 0;
      }

      console.log('[Informe] Totales finales - Pérdidas CUP:', perdidasSalidasCUP, 'Pérdidas USD:', perdidasSalidasUSD);

      // Convert only USD income to CUP for total calculation (costs stay in their currency)
      const ingresosTotalesCUP = ingresosVentasCUP + (ingresosVentasUSD * cambioMoneda);
      const gananciaNetaCUP = ingresosVentasCUP - costosVentasCUP - perdidasSalidasCUP;

      // Ganancia USD should be only from USD sales (not conversion of CUP profit)
      // USD losses are 0 since they're equivalent to CUP losses
      const gananciaNetaUSD = ingresosVentasUSD - costosVentasUSD;

      console.log('[Informe] Ganancia Neta CUP:', gananciaNetaCUP, 'Ganancia Neta USD:', gananciaNetaUSD);

      // Ganancia neta total en CUP (base para calcular % por producto)
      // Debe incluir costos USD convertidos a CUP para que el cálculo sea correcto
      const ingresosTotalesCUPCalc = ingresosVentasCUP + (ingresosVentasUSD * cambioMoneda);
      const costosTotalesCUPCalc = costosVentasCUP + (costosVentasUSD * cambioMoneda);
      const gananciaNetaTotalCUP = ingresosTotalesCUPCalc - costosTotalesCUPCalc - perdidasSalidasCUP;

      console.log('[Informe] Ingresos totales CUP (convertidos):', ingresosTotalesCUPCalc);
      console.log('[Informe] Costos totales CUP (convertidos):', costosTotalesCUPCalc);
      console.log('[Informe] Ganancia Neta Total CUP (para productos):', gananciaNetaTotalCUP);

      // Get top 5 products by profit, including their % of net profit
      const allProductos = Array.from(productosGanancia.entries())
        .map(([nombre, ganancia]) => ({
          nombre,
          ganancia,
          porcentajeGanancia: gananciaNetaTotalCUP > 0 ? ((ganancia / gananciaNetaTotalCUP) * 100) : 0,
        }))
        .sort((a, b) => b.ganancia - a.ganancia);

      const topProductos = allProductos.slice(0, 5);
      
      // Calculate percentage of top 5 products
      const topProductosPercentage = topProductos.reduce((sum, p) => sum + p.porcentajeGanancia, 0);
      
      // Add "Otros" category with remaining percentage if less than 100%
      if (topProductosPercentage < 100 && topProductosPercentage > 0) {
        topProductos.push({
          nombre: 'Otros',
          ganancia: gananciaNetaTotalCUP - topProductos.reduce((sum, p) => sum + p.ganancia, 0),
          porcentajeGanancia: 100 - topProductosPercentage,
        });
      }

      setLoadingProgress(100);
      setLoadingMessage('Generando informe...');

      setReportData({
        ingresosVentasCUP,
        ingresosVentasUSD,
        perdidasSalidasCUP,
        perdidasSalidasUSD,
        costosVentasCUP,
        costosVentasUSD,
        cambioMoneda,
        topProductos,
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

  const calculateGananciaNeta = () => {
    if (!reportData) return { cup: 0, usd: 0, cupSinPerdidas: 0, usdSinPerdidas: 0 };
    // Ganancia Neta CUP (con pérdidas) = Ingresos Ventas CUP - Costos Ventas CUP - Pérdidas Salidas CUP
    const gananciaCUP = reportData.ingresosVentasCUP - reportData.costosVentasCUP - reportData.perdidasSalidasCUP;
    // Ganancia Neta CUP (sin pérdidas) = Ingresos Ventas CUP - Costos Ventas CUP
    const gananciaCUPSinPerdidas = reportData.ingresosVentasCUP - reportData.costosVentasCUP;
    // Ganancia Neta USD (con pérdidas) = Ingresos Ventas USD - Costos Ventas USD - Pérdidas Salidas convertidas a USD
    const perdidasSalidasUSD = reportData.perdidasSalidasCUP / reportData.cambioMoneda;
    const gananciaUSD = reportData.ingresosVentasUSD - reportData.costosVentasUSD - perdidasSalidasUSD;
    // Ganancia Neta USD (sin pérdidas) = Ingresos Ventas USD - Costos Ventas USD
    const gananciaUSDSinPerdidas = reportData.ingresosVentasUSD - reportData.costosVentasUSD;
    return { cup: gananciaCUP, usd: gananciaUSD, cupSinPerdidas: gananciaCUPSinPerdidas, usdSinPerdidas: gananciaUSDSinPerdidas };
  };

  const calculateUtilidadPorcentaje = () => {
    if (!reportData) return 0;
    const gananciaNeta = calculateGananciaNeta().cup;
    const costosTotalesCUP = reportData.costosVentasCUP + (reportData.costosVentasUSD * reportData.cambioMoneda);
    if (costosTotalesCUP === 0) return 0;
    return ((gananciaNeta / costosTotalesCUP) * 100).toFixed(2);
  };

  const formatNumber = (value) => {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const PieChart = ({ data, size = 200 }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    // If total is 0, show empty chart with disabled color
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
        currentRoute="InformeGeneral"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Informe General</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Análisis de ganancias, ventas, pérdidas y costos
          </Text>
        </View>

        {/* Date Range Selector */}
        <Card style={[styles.dateRangeCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Rango de Fechas</Text>
          
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.dateButtonText, { color: colors.onSurface }]}>
                Desde: {startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.dateButtonText, { color: colors.onSurface }]}>
                Hasta: {endDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.primary }]}
            onPress={handleGenerateReport}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.generateButtonText, { color: '#fff' }]}>Generar Informe</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Report Results */}
        {reportData && (
          <>
            {/* Income and Costs Pie Chart */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Distribución de Ingresos y Costos</Text>

              <View style={styles.chartContainer}>
                {(() => {
                  const ventasCUP = reportData.ingresosVentasCUP;
                  const ventasUSD = reportData.ingresosVentasUSD * reportData.cambioMoneda;
                  const perdidas = reportData.perdidasSalidasCUP; // Only CUP losses, USD losses are equivalent
                  const costosCUP = reportData.costosVentasCUP;
                  const costosUSD = reportData.costosVentasUSD * reportData.cambioMoneda;
                  const total = ventasCUP + ventasUSD + perdidas + costosCUP + costosUSD;

                  const pieData = [
                    { value: ventasCUP, color: '#4CAF50', label: 'Ventas CUP', displayValue: reportData.ingresosVentasCUP, currency: 'CUP' },
                    { value: ventasUSD, color: '#2196F3', label: 'Ventas USD', displayValue: reportData.ingresosVentasUSD, currency: 'USD' },
                    { value: perdidas, color: '#F44336', label: 'Pérdidas', displayValue: perdidas, currency: 'CUP' },
                    { value: costosCUP, color: '#FF9800', label: 'Costos CUP', displayValue: costosCUP, currency: 'CUP' },
                    { value: costosUSD, color: '#9C27B0', label: 'Costos USD', displayValue: reportData.costosVentasUSD, currency: 'USD' },
                  ];

                  return (
                    <>
                      <PieChart
                        size={200}
                        data={pieData}
                      />
                      <View style={styles.legend}>
                        {pieData.map((item, index) => {
                          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                          return (
                            <View key={index} style={styles.legendItem}>
                              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                              <View style={styles.legendTextContainer}>
                                <Text style={[styles.legendText, { color: colors.onSurface }]}>{item.label}</Text>
                                <Text style={[styles.legendValue, { color: colors.outline }]}>
                                  {formatNumber(item.displayValue)} {item.currency}
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

            {/* Net Profit */}
            <Card style={[styles.profitCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Ganancia Neta</Text>
              <View style={styles.profitRow}>
                <View style={styles.profitItem}>
                  <Text style={[styles.profitLabel, { color: colors.outline }]}>CUP</Text>
                  <Text style={[styles.profitValue, { color: colors.primary }]}>
                    {formatNumber(calculateGananciaNeta().cupSinPerdidas)}
                  </Text>
                  <Text style={[styles.profitValueSmall, { color: colors.outline }]}>
                    (con pérdidas: {formatNumber(calculateGananciaNeta().cup)})
                  </Text>
                </View>
                <View style={styles.profitItem}>
                  <Text style={[styles.profitLabel, { color: colors.outline }]}>USD</Text>
                  <Text style={[styles.profitValue, { color: colors.primary }]}>
                    {formatNumber(calculateGananciaNeta().usdSinPerdidas)}
                  </Text>
                  <Text style={[styles.profitValueSmall, { color: colors.outline }]}>
                    (con pérdidas: {formatNumber(calculateGananciaNeta().usd)})
                  </Text>
                </View>
              </View>
              <View style={styles.utilidadContainer}>
                <Text style={[styles.utilidadLabel, { color: colors.outline }]}>Utilidad: </Text>
                <Text style={[styles.utilidadValue, { color: calculateUtilidadPorcentaje() >= 0 ? '#4CAF50' : '#F44336' }]}>
                  {calculateUtilidadPorcentaje()}%
                </Text>
              </View>
            </Card>

            {/* Top Products */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Top 5 Productos por Ganancia</Text>
              {reportData.topProductos.map((producto, index) => (
                <View key={index} style={styles.productRow}>
                  <Text style={[styles.productName, { color: colors.onSurface }]} numberOfLines={1}>
                    {producto.nombre}
                  </Text>
                  <View style={styles.productStatsContainer}>
                    <Text style={[styles.productGanancia, { color: colors.primary }]}>
                      {formatNumber(producto.ganancia)} CUP
                    </Text>
                    <Text style={[styles.productPorcentaje, { color: colors.outline }]}>
                      {producto.porcentajeGanancia.toFixed(1)}% de ganancia neta
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
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) setStartDate(selectedDate);
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
            if (selectedDate) setEndDate(selectedDate);
          }}
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
    textAlign: 'center',
  },
  dateRangeCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
  },
  dateRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(10),
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: responsive.responsiveFontSize(11.5),
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
  chartContainer: {
    alignItems: 'center',
  },
  legend: {
    marginTop: responsive.responsiveMargin(16),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(16),
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
  profitCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: responsive.responsiveMargin(16),
  },
  profitItem: {
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  profitValue: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  profitValueSmall: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  utilidadContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: responsive.responsivePadding(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  utilidadLabel: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  utilidadValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  productName: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    flex: 1,
    marginRight: responsive.responsiveMargin(8),
  },
  productStatsContainer: {
    alignItems: 'flex-end',
  },
  productGanancia: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productPorcentaje: {
    fontSize: responsive.responsiveFontSize(11),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
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

export default InformeGeneralContent;
