import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, TouchableWithoutFeedback } from 'react-native';
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
import { Svg, Path, Line, Circle, G, Text as SvgText, Rect } from 'react-native-svg';
import { getVentas } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { getServicios } from '../services/servicioService';

const InformeVentasContent = () => {
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

  // Format a Date object to YYYY-MM-DD using local timezone
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter states
  const [filters, setFilters] = useState({
    fecha_desde: formatLocalDate(new Date()),
    fecha_hasta: formatLocalDate(new Date()),
    id_usuario: '',
    id_tienda: '',
    id_servicio: '',
    nombre_servicio: '',
    forma_cobro: '',
  });

  // Dropdown states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showFormaCobroDropdown, setShowFormaCobroDropdown] = useState(false);

  // Data states
  const [tiendas, setTiendas] = useState([]);
  const [users, setUsers] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [userSearchText, setUserSearchText] = useState('');
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [servicioDebounceTimer, setServicioDebounceTimer] = useState(null);

  const [reportData, setReportData] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const formasCobro = ['Efectivo CUP', 'Efectivo USD', 'Transferencia CUP', 'Transferencia USD'];

  // Fetch data for dropdowns
  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const data = await getTiendas({ activo: true }, 1, 1000);
      setTiendas(data.data || []);
    } catch (error) {
      console.error('Error fetching tiendas:', error);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchAllServicios = async (nombreFilter = '') => {
    try {
      setIsLoadingServicios(true);
      const filters = nombreFilter ? { nombre: nombreFilter } : {};
      const data = await getServicios(filters, 1, 1000);
      setServicios(data.data || []);
    } catch (error) {
      console.error('Error fetching servicios:', error);
      setServicios([]);
    } finally {
      setIsLoadingServicios(false);
    }
  };

  // Filter dropdown items
  const filteredTiendas = Array.isArray(tiendas) ? tiendas.filter(tienda =>
    tienda.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())
  ) : [];

  const filteredUsers = Array.isArray(users) ? users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  ) : [];

  const filteredServicios = Array.isArray(servicios) ? servicios.filter(item =>
    item.nombre?.toLowerCase().includes(servicioSearchText.toLowerCase())
  ) : [];

  // Debounce search for servicios
  useEffect(() => {
    if (servicioDebounceTimer) {
      clearTimeout(servicioDebounceTimer);
    }

    const newTimer = setTimeout(() => {
      if (showServicioDropdown && servicioSearchText.length > 0) {
        fetchAllServicios(servicioSearchText);
      }
    }, 500);

    setServicioDebounceTimer(newTimer);

    return () => {
      if (newTimer) {
        clearTimeout(newTimer);
      }
    };
  }, [servicioSearchText, showServicioDropdown]);

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
      setFilters(prev => ({ ...prev, fecha_desde: formatLocalDate(selectedDate) }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setFilters(prev => ({ ...prev, fecha_hasta: formatLocalDate(selectedDate) }));
    }
  };

  const handleGenerateReport = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Consultando datos...');

    try {
      setLoadingProgress(20);
      setLoadingMessage('Consultando ventas...');

      // Build filters object
      const apiFilters = { ...filters };
      
      // Remove empty filters
      Object.keys(apiFilters).forEach(key => {
        if (apiFilters[key] === '' || apiFilters[key] === null || apiFilters[key] === undefined) {
          delete apiFilters[key];
        }
      });

      // Adjust fecha_hasta to include the end of the day (23:59:59)
      if (apiFilters.fecha_hasta) {
        apiFilters.fecha_hasta = `${apiFilters.fecha_hasta}T23:59:59`;
      }


      // Fetch all ventas with high limit to get all data
      let allVentas = [];
      let page = 1;
      const limit = 10000;
      let hasMore = true;

      while (hasMore) {
        const ventasData = await getVentas(apiFilters, page, limit);
        const ventas = ventasData.data || [];
        allVentas = [...allVentas, ...ventas];

        hasMore = ventas.length === limit && (ventasData.pagination?.currentPage < ventasData.pagination?.totalPages);
        page++;

        setLoadingProgress(20 + (page * 10));
        setLoadingMessage(`Consultando ventas... (${allVentas.length} registros)`);
      }

      // Apply frontend filtering since backend might not be filtering correctly
      
      if (filters.id_usuario) {
        allVentas = allVentas.filter(v => 
          v.operaciones && v.operaciones.some(op => op.usuario && op.usuario.id_usuario === parseInt(filters.id_usuario))
        );
      }
      
      if (filters.forma_cobro) {
        allVentas = allVentas.filter(v => 
          v.operaciones && v.operaciones.some(op => op.cuenta && op.cuenta.tipo_cuenta === filters.forma_cobro)
        );
      }
      
      if (filters.nombre_servicio) {
        allVentas = allVentas.filter(v => 
          v.ventas && v.ventas.some(venta => 
            venta.servicioTienda && 
            venta.servicioTienda.servicio && 
            venta.servicioTienda.servicio.nombre === filters.nombre_servicio
          )
        );
      }
      
      if (filters.id_tienda) {
        allVentas = allVentas.filter(v => 
          v.ventas && v.ventas.some(venta => 
            venta.servicioTienda && 
            venta.servicioTienda.id_tienda === parseInt(filters.id_tienda)
          )
        );
      }
      

      setLoadingProgress(80);
      setLoadingMessage('Procesando datos...');

      // Group sales by date
      const salesByDate = new Map();

      for (const listaVenta of allVentas) {
        const dateKey = listaVenta.fecha_hora.split('T')[0];
        
        if (!salesByDate.has(dateKey)) {
          salesByDate.set(dateKey, {
            ventasCupEfectivo: 0,
            ventasCupTransferencia: 0,
            ventasUsdEfectivo: 0,
            ventasUsdTransferencia: 0,
            costos: 0,
          });
        }

        const dayData = salesByDate.get(dateKey);
        
        // Only add values based on forma_cobro filter
        if (!filters.forma_cobro) {
          // No filter, add all
          dayData.ventasCupEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
          dayData.ventasCupTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
          dayData.ventasUsdEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
          dayData.ventasUsdTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);
        } else if (filters.forma_cobro === 'Efectivo CUP') {
          dayData.ventasCupEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
        } else if (filters.forma_cobro === 'Efectivo USD') {
          dayData.ventasUsdEfectivo += parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
        } else if (filters.forma_cobro === 'Transferencia CUP') {
          dayData.ventasCupTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        } else if (filters.forma_cobro === 'Transferencia USD') {
          dayData.ventasUsdTransferencia += parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);
        }

        // Calculate costs from ventas (always include costs regardless of forma_cobro filter)
        for (const venta of listaVenta.ventas || []) {
          const cantidad = parseFloat(venta.cantidad || 0);
          const costoCUP = parseFloat(venta.costo_original_cup || 0);
          const costoUSD = parseFloat(venta.costo_original_usd || 0);
          dayData.costos += costoCUP * cantidad;
        }
      }

      // Sort dates
      const sortedDates = Array.from(salesByDate.keys()).sort();
      
      // Create array for chart
      const chartData = sortedDates.map(date => ({
        date,
        ...salesByDate.get(date),
      }));

      // Calculate totals
      const totals = {
        ventasCupEfectivo: chartData.reduce((sum, d) => sum + d.ventasCupEfectivo, 0),
        ventasCupTransferencia: chartData.reduce((sum, d) => sum + d.ventasCupTransferencia, 0),
        ventasUsdEfectivo: chartData.reduce((sum, d) => sum + d.ventasUsdEfectivo, 0),
        ventasUsdTransferencia: chartData.reduce((sum, d) => sum + d.ventasUsdTransferencia, 0),
        costos: chartData.reduce((sum, d) => sum + d.costos, 0),
      };

      // Calculate product sales and profits
      const productosVentas = new Map();

      for (const listaVenta of allVentas) {
        for (const venta of listaVenta.ventas || []) {
          const productoNombre = venta.servicioTienda?.servicio?.nombre || 'Producto desconocido';
          const cantidad = parseFloat(venta.cantidad || 0);
          const precioCobradoCUP = parseFloat(venta.precio_cobrado_cup || 0);
          const precioCobradoUSD = parseFloat(venta.precio_cobrado_usd || 0);
          const costoOriginalCUP = parseFloat(venta.costo_original_cup || 0);
          const costoOriginalUSD = parseFloat(venta.costo_original_usd || 0);
          
          const ventaCUP = precioCobradoCUP * cantidad;
          const ventaUSD = precioCobradoUSD * cantidad;
          const costoCUP = costoOriginalCUP * cantidad;
          const costoUSD = costoOriginalUSD * cantidad;
          const gananciaCUP = ventaCUP - costoCUP;
          const gananciaUSD = ventaUSD - costoUSD;

          if (!productosVentas.has(productoNombre)) {
            productosVentas.set(productoNombre, { ventaCUP: 0, ventaUSD: 0, gananciaCUP: 0, gananciaUSD: 0 });
          }
          
          const productoData = productosVentas.get(productoNombre);
          productoData.ventaCUP += ventaCUP;
          productoData.ventaUSD += ventaUSD;
          productoData.gananciaCUP += gananciaCUP;
          productoData.gananciaUSD += gananciaUSD;
        }
      }

      const totalVentasCUP = totals.ventasCupEfectivo + totals.ventasCupTransferencia;
      const totalVentasUSD = totals.ventasUsdEfectivo + totals.ventasUsdTransferencia;

      // Top 5 productos más vendidos (por ventas en CUP)
      const topProductosMasVendidos = Array.from(productosVentas.entries())
        .map(([nombre, data]) => ({
          nombre,
          ventaCUP: data.ventaCUP,
          porcentaje: totalVentasCUP > 0 ? (data.ventaCUP / totalVentasCUP) * 100 : 0,
        }))
        .sort((a, b) => b.ventaCUP - a.ventaCUP)
        .slice(0, 5);

      // Add "Otros" category for top 5
      const top5Percentage = topProductosMasVendidos.reduce((sum, p) => sum + p.porcentaje, 0);
      if (top5Percentage < 100 && top5Percentage > 0) {
        topProductosMasVendidos.push({
          nombre: 'Otros',
          ventaCUP: totalVentasCUP - topProductosMasVendidos.reduce((sum, p) => sum + p.ventaCUP, 0),
          porcentaje: 100 - top5Percentage,
        });
      }

      // Top 10 productos menos vendidos (por ganancias)
      const topProductosMenosVendidos = Array.from(productosVentas.entries())
        .map(([nombre, data]) => ({
          nombre,
          ventaCUP: data.ventaCUP,
          ventaUSD: data.ventaUSD,
          gananciaCUP: data.gananciaCUP,
          gananciaUSD: data.gananciaUSD,
          porcentajeCUP: totalVentasCUP > 0 ? (data.ventaCUP / totalVentasCUP) * 100 : 0,
          porcentajeUSD: totalVentasUSD > 0 ? (data.ventaUSD / totalVentasUSD) * 100 : 0,
        }))
        .sort((a, b) => a.gananciaCUP - b.gananciaCUP)
        .slice(0, 10);

      // Add "Otros" category for top 10
      const top10PercentageCUP = topProductosMenosVendidos.reduce((sum, p) => sum + p.porcentajeCUP, 0);
      const top10PercentageUSD = topProductosMenosVendidos.reduce((sum, p) => sum + p.porcentajeUSD, 0);
      if (top10PercentageCUP < 100 && top10PercentageCUP > 0) {
        topProductosMenosVendidos.push({
          nombre: 'Otros',
          ventaCUP: totalVentasCUP - topProductosMenosVendidos.reduce((sum, p) => sum + p.ventaCUP, 0),
          ventaUSD: totalVentasUSD - topProductosMenosVendidos.reduce((sum, p) => sum + p.ventaUSD, 0),
          gananciaCUP: 0,
          gananciaUSD: 0,
          porcentajeCUP: 100 - top10PercentageCUP,
          porcentajeUSD: 100 - top10PercentageUSD,
        });
      }

      setLoadingProgress(100);
      setLoadingMessage('Generando informe...');

      setReportData({ chartData, totals, topProductosMasVendidos, topProductosMenosVendidos });

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

  const calculateGananciaNeta = () => {
    if (!reportData || !reportData.totals) return { cup: 0, usd: 0 };
    const ventasCupEfectivo = reportData.totals.ventasCupEfectivo || 0;
    const ventasCupTransferencia = reportData.totals.ventasCupTransferencia || 0;
    const ventasUsdEfectivo = reportData.totals.ventasUsdEfectivo || 0;
    const ventasUsdTransferencia = reportData.totals.ventasUsdTransferencia || 0;
    const costos = reportData.totals.costos || 0;
    
    const gananciaCUP = (ventasCupEfectivo + ventasCupTransferencia) - costos;
    const gananciaUSD = ventasUsdEfectivo + ventasUsdTransferencia;
    return { cup: gananciaCUP, usd: gananciaUSD };
  };

  const calculateUtilidadPorcentaje = () => {
    if (!reportData || !reportData.totals) return '0.00';
    const gananciaNeta = calculateGananciaNeta();
    const costosTotalesCUP = reportData.totals.costos || 0;
    if (costosTotalesCUP === 0) return '0.00';
    const utilidad = (gananciaNeta.cup / costosTotalesCUP) * 100;
    return isNaN(utilidad) ? '0.00' : utilidad.toFixed(2);
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

  const MountainChart = ({ data, width = 350, height = 250, formaCobroFilter = null }) => {
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    if (!data || data.length === 0) {
      return (
        <View style={[styles.emptyChart, { backgroundColor: colors.surface }]}>
          <Text style={[styles.emptyChartText, { color: colors.outline }]}>
            No hay datos para mostrar
          </Text>
        </View>
      );
    }

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Determine which metrics to show based on forma_cobro filter
    let metricsToShow = [];
    if (!formaCobroFilter) {
      // No filter, show all
      metricsToShow = [
        { key: 'ventasCupEfectivo', color: '#4CAF50', label: 'Efectivo CUP' },
        { key: 'ventasCupTransferencia', color: '#2196F3', label: 'Transferencia CUP' },
        { key: 'ventasUsdEfectivo', color: '#FF9800', label: 'Efectivo USD' },
        { key: 'ventasUsdTransferencia', color: '#9C27B0', label: 'Transferencia USD' },
        { key: 'costos', color: '#F44336', label: 'Costos' },
      ];
    } else if (formaCobroFilter === 'Efectivo CUP') {
      metricsToShow = [
        { key: 'ventasCupEfectivo', color: '#4CAF50', label: 'Efectivo CUP' },
        { key: 'costos', color: '#F44336', label: 'Costos' },
      ];
    } else if (formaCobroFilter === 'Efectivo USD') {
      metricsToShow = [
        { key: 'ventasUsdEfectivo', color: '#FF9800', label: 'Efectivo USD' },
        { key: 'costos', color: '#F44336', label: 'Costos' },
      ];
    } else if (formaCobroFilter === 'Transferencia CUP') {
      metricsToShow = [
        { key: 'ventasCupTransferencia', color: '#2196F3', label: 'Transferencia CUP' },
        { key: 'costos', color: '#F44336', label: 'Costos' },
      ];
    } else if (formaCobroFilter === 'Transferencia USD') {
      metricsToShow = [
        { key: 'ventasUsdTransferencia', color: '#9C27B0', label: 'Transferencia USD' },
        { key: 'costos', color: '#F44336', label: 'Costos' },
      ];
    }

    // Find max value for Y axis based on visible metrics
    const maxValue = Math.max(
      ...data.map(d => Math.max(
        ...metricsToShow.map(m => d[m.key] || 0)
      ))
    );

    const yMax = maxValue > 0 ? maxValue * 1.1 : 100;

    // Handle single data point case
    const xStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;

    const getY = (value) => {
      return padding + chartHeight - (value / yMax) * chartHeight;
    };

    const getX = (index) => {
      if (data.length === 1) {
        // Center the single point
        return padding + chartWidth / 2;
      }
      return padding + index * xStep;
    };

    const handleChartTouch = (event) => {
      const x = event.nativeEvent.locationX;
      const y = event.nativeEvent.locationY;

      // Find closest data point based on x position
      let closestIndex = 0;
      let minDistance = Math.abs(x - getX(0));

      for (let i = 1; i < data.length; i++) {
        const distance = Math.abs(x - getX(i));
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      setSelectedPoint(data[closestIndex]);
      
      // Calculate tooltip position using percentage for better positioning
      const pointX = getX(closestIndex);
      const pointY = getY(data[closestIndex].ventasCupEfectivo || 0);
      
      // Position tooltip above the point
      const tooltipXPercent = (pointX / width) * 100;
      const tooltipYPercent = (pointY / height) * 100;
      
      setTooltipPosition({ xPercent: tooltipXPercent, yPercent: tooltipYPercent });
    };

    const handleBackgroundTouch = () => {
      setSelectedPoint(null);
    };

    return (
      <View style={{ position: 'relative', width, height }}>
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            handleChartTouch({ nativeEvent: { locationX, locationY } });
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Svg width={width} height={height}>
          {/* Y axis lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padding + chartHeight * (1 - ratio);
            const value = (yMax * ratio).toFixed(0);
            return (
              <G key={ratio}>
                <Line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke={colors.outlineVariant}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <SvgText
                  x={padding - 5}
                  y={y + 4}
                  fontSize={10}
                  fill={colors.outline}
                  textAnchor="end"
                >
                  {value}
                </SvgText>
              </G>
            );
          })}

          {/* X axis labels (show every nth date to avoid overlap) */}
          {data.map((d, i) => {
            if (data.length > 10 && i % Math.ceil(data.length / 10) !== 0) return null;
            const x = getX(i);
            const dateLabel = d.date.slice(5); // Show MM-DD
            return (
              <SvgText
                key={i}
                x={x}
                y={height - padding + 15}
                fontSize={10}
                fill={colors.outline}
                textAnchor="middle"
              >
                {dateLabel}
              </SvgText>
            );
          })}

          {/* Mountain charts for each metric */}
          {metricsToShow.map(({ key, color }) => {
            if (data.length === 1) {
              // Single data point - draw a horizontal line
              const x = getX(0);
              const y = getY(data[0][key]);
              const lineStart = padding;
              const lineEnd = width - padding;
              
              return (
                <G key={key}>
                  {/* Fill area */}
                  <Path
                    d={`M ${lineStart} ${y} L ${lineEnd} ${y} L ${lineEnd} ${padding + chartHeight} L ${lineStart} ${padding + chartHeight} Z`}
                    fill={color}
                    fillOpacity={0.2}
                  />
                  {/* Line */}
                  <Path
                    d={`M ${lineStart} ${y} L ${lineEnd} ${y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                  />
                  {/* Point */}
                  <Circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill={color}
                  />
                </G>
              );
            }

            // Generate smooth bezier curve path
            const pathData = data.map((d, i) => {
              const x = getX(i);
              const y = getY(d[key]);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            // Generate smooth bezier curve for the line
            const smoothPathData = (() => {
              if (data.length < 3) return pathData;
              
              let path = `M ${getX(0)} ${getY(data[0][key])}`;
              
              for (let i = 0; i < data.length - 1; i++) {
                const x0 = getX(i);
                const y0 = getY(data[i][key]);
                const x1 = getX(i + 1);
                const y1 = getY(data[i + 1][key]);
                
                // Control points for bezier curve
                const cp1x = x0 + (x1 - x0) * 0.5;
                const cp1y = y0;
                const cp2x = x1 - (x1 - x0) * 0.5;
                const cp2y = y1;
                
                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`;
              }
              
              return path;
            })();

            // Close the path for fill (use straight lines for fill area)
            const fillPath = `${pathData} L ${getX(data.length - 1)} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`;

            return (
              <G key={key}>
                {/* Fill area */}
                <Path
                  d={fillPath}
                  fill={color}
                  fillOpacity={0.2}
                />
                {/* Line */}
                <Path
                  d={smoothPathData}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
                {/* Points for each data point */}
                {data.map((d, i) => {
                  const x = getX(i);
                  const y = getY(d[key]);
                  return (
                    <Circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={selectedPoint === d ? 6 : 4}
                      fill={color}
                    />
                  );
                })}
              </G>
            );
          })}

          {/* Touchable area */}
          <Rect
            x={padding}
            y={padding}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
          />
        </Svg>
        </TouchableOpacity>

        {/* Tooltip card */}
        {selectedPoint && (
          <TouchableOpacity 
            activeOpacity={1}
            onPress={handleBackgroundTouch}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <View style={[
              styles.tooltipCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 5,
                left: `${tooltipPosition.xPercent}%`,
                top: `${tooltipPosition.yPercent}%`,
                transform: [{ translateX: 10 }, { translateY: -120 }],
              }
            ]}>
              <Text style={[styles.tooltipDate, { color: colors.onSurface }]}>
                {selectedPoint.date}
              </Text>
              {metricsToShow.map(({ key, color, label }) => (
                <View key={key} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: color }]} />
                  <Text style={[styles.tooltipLabel, { color: colors.outline }]}>{label}:</Text>
                  <Text style={[styles.tooltipValue, { color: colors.onSurface }]}>
                    ${formatNumber(selectedPoint[key] || 0)}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}
      </View>
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
        currentRoute="InformeVentas"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Informe de Ventas</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Análisis detallado de ventas por día
          </Text>
        </View>

        {/* Date Range and Filter Card */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Ionicons 
                name={showAdvancedFilters ? "chevron-up" : "chevron-down"} 
                size={24} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {/* Fecha Desde y Hasta */}
          <View style={styles.filterRow}>
            <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
              <Text style={[styles.label, { color: colors.outline }]}>Desde</Text>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[styles.dateButtonText, { color: colors.onSurface }]}>
                  {filters.fecha_desde || 'Seleccionar fecha'}
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
                  {filters.fecha_hasta || 'Seleccionar fecha'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Usuario */}
          {showAdvancedFilters && (
            <View style={styles.filterGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowUserDropdown(!showUserDropdown);
                  if (!isLoadingUsers) {
                    fetchAllUsers();
                  }
                }}
              >
                <Text style={[styles.dropdownText, { color: filters.id_usuario ? colors.onSurface : colors.outline }]}>
                  {Array.isArray(users) && users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}
                </Text>
                <Ionicons 
                  name={showUserDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showUserDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  {isLoadingUsers && (
                    <View style={styles.dropdownLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando usuarios...</Text>
                    </View>
                  )}
                  {!isLoadingUsers && (
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
                          placeholder="Buscar usuario..."
                          value={userSearchText}
                          onChangeText={setUserSearchText}
                        />
                      </View>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_usuario: '' }));
                            setShowUserDropdown(false);
                            setUserSearchText('');
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los usuarios</Text>
                        </TouchableOpacity>
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((userItem, index) => (
                            <TouchableOpacity
                              key={userItem.id_usuario}
                              style={[styles.dropdownItem, index === filteredUsers.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                setShowUserDropdown(false);
                                setUserSearchText('');
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{userItem.nombre_natural}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.dropdownItem}>
                            <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron usuarios</Text>
                          </View>
                        )}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Tienda */}
          {showAdvancedFilters && (
            <View style={styles.filterGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowTiendaDropdown(!showTiendaDropdown);
                  if (!isLoadingTiendas) {
                    fetchAllTiendas();
                  }
                }}
              >
                <Text style={[styles.dropdownText, { color: filters.id_tienda ? colors.onSurface : colors.outline }]}>
                  {Array.isArray(tiendas) && tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                </Text>
                <Ionicons 
                  name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showTiendaDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  {isLoadingTiendas && (
                    <View style={styles.dropdownLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando tiendas...</Text>
                    </View>
                  )}
                  {!isLoadingTiendas && (
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
                          placeholder="Buscar tienda..."
                          value={tiendaSearchText}
                          onChangeText={setTiendaSearchText}
                        />
                      </View>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                        </TouchableOpacity>
                        {filteredTiendas.length > 0 ? (
                          filteredTiendas.map((tienda, index) => (
                            <TouchableOpacity
                              key={tienda.id_tienda}
                              style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
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
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Servicio */}
          {showAdvancedFilters && (
            <View style={styles.filterGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Servicio</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  if (!showServicioDropdown) {
                    fetchAllServicios();
                  }
                  setShowServicioDropdown(!showServicioDropdown);
                }}
              >
                <Text style={[styles.dropdownText, { color: filters.nombre_servicio ? colors.onSurface : colors.outline }]}>
                  {filters.nombre_servicio || 'Todos los servicios'}
                </Text>
                <Ionicons 
                  name={showServicioDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showServicioDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  {isLoadingServicios && (
                    <View style={styles.dropdownLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando servicios...</Text>
                    </View>
                  )}
                  {!isLoadingServicios && (
                    <>
                      <View style={styles.dropdownSearchInput}>
                        <Ionicons name="search" size={16} color={colors.outline} style={styles.searchIcon} />
                        <TextInput
                          style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                          placeholder="Buscar servicio..."
                          placeholderTextColor={colors.outline}
                          value={servicioSearchText}
                          onChangeText={setServicioSearchText}
                        />
                      </View>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, nombre_servicio: '', id_servicio: '' }));
                            setShowServicioDropdown(false);
                            setServicioSearchText('');
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los servicios</Text>
                        </TouchableOpacity>
                        {filteredServicios.length > 0 ? (
                          filteredServicios.map((item, index) => (
                            <TouchableOpacity
                              key={item.id_servicio}
                              style={[styles.dropdownItem, index === filteredServicios.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                setFilters(prev => ({ 
                                  ...prev, 
                                  nombre_servicio: item.nombre, 
                                  id_servicio: item.id_servicio?.toString() 
                                }));
                                setShowServicioDropdown(false);
                                setServicioSearchText('');
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{item.nombre}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.dropdownItem}>
                            <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron servicios</Text>
                          </View>
                        )}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Forma de Cobro */}
          {showAdvancedFilters && (
            <View style={styles.filterGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Forma de Cobro</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowFormaCobroDropdown(!showFormaCobroDropdown)}
              >
                <Text style={[styles.dropdownText, { color: filters.forma_cobro ? colors.onSurface : colors.outline }]}>
                  {filters.forma_cobro || 'Todas las formas'}
                </Text>
                <Ionicons 
                  name={showFormaCobroDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showFormaCobroDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, forma_cobro: '' }));
                        setShowFormaCobroDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las formas</Text>
                    </TouchableOpacity>
                    {formasCobro.map((forma, index) => (
                      <TouchableOpacity
                        key={forma}
                        style={[styles.dropdownItem, index === formasCobro.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, forma_cobro: forma }));
                          setShowFormaCobroDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{forma}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

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
            {/* Mountain Chart */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Ventas por Día</Text>
              <ScrollView 
                horizontal={true} 
                showsHorizontalScrollIndicator={true}
                style={styles.chartScrollContainer}
              >
                <View style={styles.chartWrapper}>
                  <MountainChart
                    data={reportData.chartData}
                    width={Math.max(350, reportData.chartData.length * 60)}
                    height={250}
                    formaCobroFilter={filters.forma_cobro}
                  />
                </View>
              </ScrollView>
              
              {/* Legend */}
              <View style={styles.legend}>
                {!filters.forma_cobro && (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas CUP Efectivo</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas CUP Transferencia</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas USD Efectivo</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#9C27B0' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas USD Transferencia</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Costos por Salida o/y Ventas</Text>
                    </View>
                  </>
                )}
                {filters.forma_cobro === 'Efectivo CUP' && (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas CUP Efectivo</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Costos por Salida o/y Ventas</Text>
                    </View>
                  </>
                )}
                {filters.forma_cobro === 'Efectivo USD' && (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas USD Efectivo</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Costos por Salida o/y Ventas</Text>
                    </View>
                  </>
                )}
                {filters.forma_cobro === 'Transferencia CUP' && (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas CUP Transferencia</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Costos por Salida o/y Ventas</Text>
                    </View>
                  </>
                )}
                {filters.forma_cobro === 'Transferencia USD' && (
                  <>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#9C27B0' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Ventas USD Transferencia</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
                      <Text style={[styles.legendText, { color: colors.onSurface }]}>Costos por Salida o/y Ventas</Text>
                    </View>
                  </>
                )}
              </View>
            </Card>

            {/* Totals */}
            <Card style={[styles.totalsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Totales del Período</Text>
              
              {!filters.forma_cobro && (
                <>
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas CUP Efectivo:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasCupEfectivo)} CUP
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas CUP Transferencia:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasCupTransferencia)} CUP
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas USD Efectivo:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasUsdEfectivo)} USD
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#9C27B0' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas USD Transferencia:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasUsdTransferencia)} USD
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#F44336' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Costos por Salida o/y Ventas:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.costos)} CUP
                    </Text>
                  </View>
                </>
              )}
              
              {filters.forma_cobro === 'Efectivo CUP' && (
                <>
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas CUP Efectivo:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasCupEfectivo)} CUP
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#F44336' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Costos por Salida o/y Ventas:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.costos)} CUP
                    </Text>
                  </View>
                </>
              )}
              
              {filters.forma_cobro === 'Efectivo USD' && (
                <>
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas USD Efectivo:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasUsdEfectivo)} USD
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#F44336' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Costos por Salida o/y Ventas:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.costos)} CUP
                    </Text>
                  </View>
                </>
              )}
              
              {filters.forma_cobro === 'Transferencia CUP' && (
                <>
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas CUP Transferencia:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasCupTransferencia)} CUP
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#F44336' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Costos por Salida o/y Ventas:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.costos)} CUP
                    </Text>
                  </View>
                </>
              )}
              
              {filters.forma_cobro === 'Transferencia USD' && (
                <>
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#9C27B0' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Ventas USD Transferencia:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.ventasUsdTransferencia)} USD
                    </Text>
                  </View>
                  
                  <View style={styles.totalRow}>
                    <View style={[styles.totalDot, { backgroundColor: '#F44336' }]} />
                    <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Costos por Salida o/y Ventas:</Text>
                    <Text style={[styles.totalValue, { color: colors.primary }]}>
                      {formatNumber(reportData.totals.costos)} CUP
                    </Text>
                  </View>
                </>
              )}
            </Card>

            {/* Product Distribution Pie Chart */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Gráfico del top 5 productos más vendidos</Text>
              <View style={styles.chartContainer}>
                {(() => {
                  const pieData = reportData.topProductosMasVendidos.map((producto, index) => ({
                    value: producto.ventaCUP,
                    color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548'][index % 6],
                    label: producto.nombre,
                    displayValue: producto.ventaCUP,
                    currency: 'CUP',
                  }));

                  return (
                    <>
                      <PieChart
                        size={200}
                        data={pieData}
                      />
                      <View style={styles.legend}>
                        {pieData.map((item, index) => {
                          const totalVentasCUP = (reportData.totals.ventasCupEfectivo || 0) + (reportData.totals.ventasCupTransferencia || 0);
                          const percentage = totalVentasCUP > 0 
                            ? ((item.value / totalVentasCUP) * 100).toFixed(1) 
                            : '0.0';
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

            {/* Top 5 Productos más vendidos */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Top 5 Productos más vendidos</Text>
              {reportData.topProductosMasVendidos.map((producto, index) => (
                <View key={index} style={styles.productRow}>
                  <Text style={[styles.productName, { color: colors.onSurface }]} numberOfLines={1}>
                    {producto.nombre}
                  </Text>
                  <View style={styles.productStatsContainer}>
                    <Text style={[styles.productVenta, { color: colors.primary }]}>
                      {formatNumber(producto.ventaCUP)} CUP
                    </Text>
                    <Text style={[styles.productPorcentaje, { color: colors.outline }]}>
                      {(producto.porcentaje || 0).toFixed(1)}% del total
                    </Text>
                  </View>
                </View>
              ))}
            </Card>

            {/* Product Distribution Pie Chart for Top 10 menos vendidos */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Gráfico del top 10 productos menos vendidos (por ganancias)</Text>
              <View style={styles.chartContainer}>
                {(() => {
                  const pieData = reportData.topProductosMenosVendidos.map((producto, index) => ({
                    value: producto.ventaCUP,
                    color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#795548', '#607D8B', '#8BC34A', '#FF5722', '#E91E63'][index % 10],
                    label: producto.nombre,
                    displayValue: producto.ventaCUP,
                    currency: 'CUP',
                  }));

                  return (
                    <>
                      <PieChart
                        size={200}
                        data={pieData}
                      />
                      <View style={styles.legend}>
                        {pieData.map((item, index) => {
                          const totalVentasCUP = (reportData.totals.ventasCupEfectivo || 0) + (reportData.totals.ventasCupTransferencia || 0);
                          const percentage = totalVentasCUP > 0 
                            ? ((item.value / totalVentasCUP) * 100).toFixed(1) 
                            : '0.0';
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

            {/* Top 10 Productos menos vendidos (por ganancias) */}
            <Card style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Top 10 Productos menos vendidos (por ganancias)</Text>
              {reportData.topProductosMenosVendidos.map((producto, index) => (
                <View key={index} style={styles.productRow}>
                  <Text style={[styles.productName, { color: colors.onSurface }]} numberOfLines={1}>
                    {producto.nombre}
                  </Text>
                  <View style={styles.productStatsContainer}>
                    <Text style={[styles.productVenta, { color: colors.primary }]}>
                      {formatNumber(producto.ventaCUP)} CUP
                    </Text>
                    <Text style={[styles.productPorcentaje, { color: colors.outline }]}>
                      {(producto.porcentajeCUP || 0).toFixed(1)}% del total
                    </Text>
                  </View>
                </View>
              ))}
            </Card>

            {/* Ganancia Neta */}
            <Card style={[styles.profitCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Ganancia Neta</Text>
              <View style={styles.profitRow}>
                <View style={styles.profitItem}>
                  <Text style={[styles.profitLabel, { color: colors.outline }]}>CUP</Text>
                  <Text style={[styles.profitValue, { color: colors.primary }]}>
                    {formatNumber(calculateGananciaNeta().cup)}
                  </Text>
                </View>
                <View style={styles.profitItem}>
                  <Text style={[styles.profitLabel, { color: colors.outline }]}>USD</Text>
                  <Text style={[styles.profitValue, { color: colors.primary }]}>
                    {formatNumber(calculateGananciaNeta().usd)}
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
    textAlign: 'center',
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
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
    maxHeight: responsive.responsiveHeight(150),
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(4),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
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
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  dropdownLoadingText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
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
    fontSize: responsive.responsiveFontSize(11.5),
    fontFamily: 'Inter',
  },
  generateButton: {
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(8),
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
  chartScrollContainer: {
    marginVertical: responsive.responsiveMargin(16),
  },
  chartWrapper: {
    alignItems: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: responsive.responsiveMargin(16),
  },
  emptyChart: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emptyChartText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(6),
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  legendTextContainer: {
    flexDirection: 'column',
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
  tooltipCard: {
    position: 'absolute',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 180,
    zIndex: 10,
  },
  tooltipDate: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(8),
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: responsive.responsiveMargin(6),
  },
  tooltipLabel: {
    fontSize: responsive.responsiveFontSize(10),
    fontFamily: 'Inter',
    flex: 1,
  },
  tooltipValue: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  totalsCard: {
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
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  totalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: responsive.responsiveMargin(12),
  },
  totalLabel: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  totalValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
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
  productVenta: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productPorcentaje: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
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
    justifyContent: 'space-between',
    marginTop: responsive.responsiveMargin(12),
  },
  profitItem: {
    flex: 1,
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
    fontFamily: 'Inter',
  },
  utilidadContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(16),
    paddingTop: responsive.responsivePadding(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  utilidadLabel: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    marginRight: responsive.responsiveMargin(8),
  },
  utilidadValue: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
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

export default InformeVentasContent;
