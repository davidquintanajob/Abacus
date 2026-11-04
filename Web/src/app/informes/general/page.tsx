'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { Calendar, Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { getVentas } from '../../../services/ventaService';
import { getSalidas } from '../../../services/salidaService';
import { configService } from '../../../services/configService';

const InformeGeneralPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const PieChart = ({ data, size = 200 }: { data: any[], size?: number }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
      return (
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill={isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            stroke={isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
            strokeWidth={2}
          />
        </svg>
      );
    }

    let startAngle = 0;
    const radius = size / 2;
    const center = size / 2;

    return (
      <svg width={size} height={size}>
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
            <path
              key={index}
              d={pathData}
              fill={item.color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    );
  };

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reportData, setReportData] = useState<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const formatNumber = (value: number) => {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Consultando datos...');

    try {
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      setLoadingProgress(20);
      setLoadingMessage('Consultando ventas...');

      // Fetch ventas with date filter (no limit/page for getAll behavior)
      const ventasData = await getVentas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, undefined, undefined);
      const ventas = ventasData.data || [];
      const ventasSummary = ventasData.summary || {};

      setLoadingProgress(50);
      setLoadingMessage('Consultando salidas...');

      // Fetch salidas with date filter (no limit/page for getAll behavior)
      const salidasData = await getSalidas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, undefined, undefined);
      const salidas = salidasData.data || [];

      setLoadingProgress(70);
      setLoadingMessage('Obteniendo configuración...');

      const config = await configService.getConfig();
      const cambioMoneda = config.cupToUsdRate || 1;

      setLoadingProgress(85);
      setLoadingMessage('Calculando datos...');

      // Use backend summary for sales income (matches VentasScreen)
      const ingresosVentasCUP = parseFloat(ventasSummary.total_efectivo_cup || 0) + parseFloat(ventasSummary.total_transferencia_cup || 0);
      const ingresosVentasUSD = parseFloat(ventasSummary.total_efectivo_usd || 0) + parseFloat(ventasSummary.total_transferencia_usd || 0);

      console.log('[Informe Web] Ingresos Ventas CUP:', ingresosVentasCUP);
      console.log('[Informe Web] Ingresos Ventas USD:', ingresosVentasUSD);
      console.log('[Informe Web] Total ventas:', ventas.length);

      let costosVentasCUP = 0;
      let costosVentasUSD = 0;
      const productosGanancia = new Map<string, number>();

      for (const listaVenta of ventas) {
        // Income from ListaVenta (amount collected) - for cost distribution
        const efectivoCUP = parseFloat(listaVenta.cantidad_cobrada_efectivo_cup || 0);
        const efectivoUSD = parseFloat(listaVenta.cantidad_cobrada_efectivo_usd || 0);
        const transferenciaCUP = parseFloat(listaVenta.cantidad_cobrada_transferencia_cup || 0);
        const transferenciaUSD = parseFloat(listaVenta.cantidad_cobrada_transferencia_usd || 0);

        const totalIngresoCUP = efectivoCUP + transferenciaCUP;
        const totalIngresoUSD = efectivoUSD + transferenciaUSD;

        console.log('[Informe Web] ListaVenta ID:', listaVenta.id_lista_venta);
        console.log('[Informe Web] Ingresos por venta - CUP:', totalIngresoCUP, 'USD:', totalIngresoUSD);

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

        console.log('[Informe Web] Total precio cobrado CUP:', totalPrecioCobradoCUP, 'USD:', totalPrecioCobradoUSD);

        const isCUPSale = totalIngresoCUP > 0;
        const isUSDSale = totalIngresoUSD > 0;

        console.log('[Informe Web] Tipo de venta - isCUPSale:', isCUPSale, 'isUSDSale:', isUSDSale);

        for (const venta of listaVenta.ventas || []) {
          const cantidad = parseFloat(venta.cantidad || 0);
          // Costs are stored directly in the venta model (calculated by backend)
          const costoOriginalCUP = parseFloat(venta.costo_original_cup || 0);
          const costoOriginalUSD = parseFloat(venta.costo_original_usd || 0);
          const precioCobradoCUP = parseFloat(venta.precio_cobrado_cup || 0);
          const precioCobradoUSD = parseFloat(venta.precio_cobrado_usd || 0);

          console.log('[Informe Web] Producto:', venta.servicioTienda?.servicio?.nombre, 'Cantidad:', cantidad);
          console.log('[Informe Web] Costos - CUP:', costoOriginalCUP, 'USD:', costoOriginalUSD);
          console.log('[Informe Web] Precios cobrados - CUP:', precioCobradoCUP, 'USD:', precioCobradoUSD);

          if (isCUPSale && !isUSDSale) {
            const costoTotalCUP = costoOriginalCUP * cantidad;
            costosVentasCUP += costoTotalCUP;
            console.log('[Informe Web] Venta CUP only - Agregando costo CUP:', costoTotalCUP);
          } else if (isUSDSale && !isCUPSale) {
            const costoTotalUSD = costoOriginalUSD * cantidad;
            costosVentasUSD += costoTotalUSD;
            console.log('[Informe Web] Venta USD only - Agregando costo USD:', costoTotalUSD);
          } else if (isCUPSale && isUSDSale) {
            const porcentajeCobroCUP = totalPrecioCobradoCUP > 0 ? totalIngresoCUP / totalPrecioCobradoCUP : 0;
            const porcentajeCobroUSD = totalPrecioCobradoUSD > 0 ? totalIngresoUSD / totalPrecioCobradoUSD : 0;

            const costoTotalCUP = costoOriginalCUP * cantidad;
            const costoTotalUSD = costoOriginalUSD * cantidad;

            const costoCUPAsignado = costoTotalCUP * porcentajeCobroCUP;
            const costoUSDAsignado = costoTotalUSD * porcentajeCobroUSD;

            costosVentasCUP += costoCUPAsignado;
            costosVentasUSD += costoUSDAsignado;

            console.log('[Informe Web] Venta mixta - % cobro CUP:', porcentajeCobroCUP, '% cobro USD:', porcentajeCobroUSD);
            console.log('[Informe Web] Costo CUP asignado:', costoCUPAsignado, 'Costo USD asignado:', costoUSDAsignado);
          }

          const productoNombre = venta.servicioTienda?.servicio?.nombre || 'Producto desconocido';

          const ventaPrecioCobradoCUP = precioCobradoCUP * cantidad;
          const ventaPrecioCobradoUSD = precioCobradoUSD * cantidad;

          const proporcionCUP = totalPrecioCobradoCUP > 0 ? ventaPrecioCobradoCUP / totalPrecioCobradoCUP : 0;
          const proporcionUSD = totalPrecioCobradoUSD > 0 ? ventaPrecioCobradoUSD / totalPrecioCobradoUSD : 0;

          const ingresoVentaCUP = totalIngresoCUP * proporcionCUP;
          const ingresoVentaUSD = totalIngresoUSD * proporcionUSD;

          let gananciaVenta = 0;
          if (isCUPSale && !isUSDSale) {
            const costoVentaCUP = costoOriginalCUP * cantidad;
            gananciaVenta = ingresoVentaCUP - costoVentaCUP;
          } else if (isUSDSale && !isCUPSale) {
            const costoVentaUSD = costoOriginalUSD * cantidad;
            const gananciaVentaUSD = ingresoVentaUSD - costoVentaUSD;
            gananciaVenta = gananciaVentaUSD * cambioMoneda;
          } else if (isCUPSale && isUSDSale) {
            const porcentajeCobroCUP = totalPrecioCobradoCUP > 0 ? totalIngresoCUP / totalPrecioCobradoCUP : 0;
            const porcentajeCobroUSD = totalPrecioCobradoUSD > 0 ? totalIngresoUSD / totalPrecioCobradoUSD : 0;

            const costoTotalCUP = costoOriginalCUP * cantidad;
            const costoTotalUSD = costoOriginalUSD * cantidad;

            const costoCUPAsignado = costoTotalCUP * porcentajeCobroCUP;
            const costoUSDAsignado = costoTotalUSD * porcentajeCobroUSD;

            const gananciaVentaCUP = ingresoVentaCUP - costoCUPAsignado;
            const gananciaVentaUSD = ingresoVentaUSD - costoUSDAsignado;

            gananciaVenta = gananciaVentaCUP + (gananciaVentaUSD * cambioMoneda);
          }

          const currentGanancia = productosGanancia.get(productoNombre) || 0;
          productosGanancia.set(productoNombre, currentGanancia + gananciaVenta);
        }
      }

      let perdidasSalidasCUP = 0;
      let perdidasSalidasUSD = 0;

      console.log('[Informe Web] Procesando salidas, total:', salidas.length);

      for (const salida of salidas) {
        const cantidad = parseFloat(salida.cantidad_total || 1);
        const costoCUP = parseFloat(salida.costo_cup || 0);
        const costoUSD = parseFloat(salida.costo_usd || 0);

        console.log('[Informe Web] Salida - Cantidad:', cantidad, 'Costo CUP:', costoCUP, 'Costo USD:', costoUSD);

        perdidasSalidasCUP += costoCUP * cantidad;
        perdidasSalidasUSD = 0;
      }

      console.log('[Informe Web] Totales finales - Pérdidas CUP:', perdidasSalidasCUP, 'Pérdidas USD:', perdidasSalidasUSD);
      console.log('[Informe Web] Totales finales - Costos Ventas CUP:', costosVentasCUP, 'Costos Ventas USD:', costosVentasUSD);

      const ingresosTotalesCUPCalc = ingresosVentasCUP + (ingresosVentasUSD * cambioMoneda);
      const costosTotalesCUPCalc = costosVentasCUP + (costosVentasUSD * cambioMoneda);
      const gananciaNetaTotalCUP = ingresosTotalesCUPCalc - costosTotalesCUPCalc - perdidasSalidasCUP;

      const allProductos = Array.from(productosGanancia.entries())
        .map(([nombre, ganancia]) => ({
          nombre,
          ganancia,
          porcentajeGanancia: gananciaNetaTotalCUP > 0 ? ((ganancia / gananciaNetaTotalCUP) * 100) : 0,
        }))
        .sort((a, b) => b.ganancia - a.ganancia);

      const topProductos = allProductos.slice(0, 5);
      
      const topProductosPercentage = topProductos.reduce((sum, p) => sum + p.porcentajeGanancia, 0);
      
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
        setIsLoading(false);
      }, 500);
    } catch (error: any) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: error.message || 'Error al generar el informe' });
      setIsLoading(false);
    }
  };

  const calculateGananciaNeta = () => {
    if (!reportData) return { cup: 0, usd: 0, cupSinPerdidas: 0, usdSinPerdidas: 0 };
    const gananciaCUP = reportData.ingresosVentasCUP - reportData.costosVentasCUP - reportData.perdidasSalidasCUP;
    const gananciaCUPSinPerdidas = reportData.ingresosVentasCUP - reportData.costosVentasCUP;
    const perdidasSalidasUSD = reportData.perdidasSalidasCUP / reportData.cambioMoneda;
    const gananciaUSD = reportData.ingresosVentasUSD - reportData.costosVentasUSD - perdidasSalidasUSD;
    const gananciaUSDSinPerdidas = reportData.ingresosVentasUSD - reportData.costosVentasUSD;
    return { cup: gananciaCUP, usd: gananciaUSD, cupSinPerdidas: gananciaCUPSinPerdidas, usdSinPerdidas: gananciaUSDSinPerdidas };
  };

  const calculateUtilidadPorcentaje = () => {
    if (!reportData) return '0';
    const gananciaNeta = calculateGananciaNeta().cup;
    const costosTotalesCUP = reportData.costosVentasCUP + (reportData.costosVentasUSD * reportData.cambioMoneda);
    if (costosTotalesCUP === 0) return '0';
    return ((gananciaNeta / costosTotalesCUP) * 100).toFixed(2);
  };

  if (!isAdmin) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <p style={{ color: colors.onSurface, fontSize: '18px' }}>Acceso denegado</p>
        <p style={{ color: colors.outline }}>Solo los administradores pueden acceder a esta página</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Header 
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        currentRoute="InformeGeneral"
      />
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />

      <SidebarNavigation ref={sidebarNavRef} currentRoute="InformeGeneral" />

      <div 
        style={{
          padding: isMobile ? '16px' : isTablet ? '24px' : '40px',
          marginLeft: isDesktop ? '120px' : 'auto',
          paddingTop: isMobile ? '80px' : isTablet ? '100px' : '120px',
        }}
      >
        {/* Page Title */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h1 style={{ 
            color: colors.onSurface, 
            fontSize: isMobile ? '24px' : isTablet ? '28px' : '32px',
            fontWeight: '700',
            fontFamily: 'Hanken Grotesk, sans-serif',
            marginBottom: '8px'
          }}>
            Informe General
          </h1>
          <p style={{ 
            color: colors.outline, 
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif'
          }}>
            Análisis de ganancias, ventas, pérdidas y costos
          </p>
        </div>

        {/* Date Range Selector */}
        <div style={{ 
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          maxWidth: isDesktop ? '800px' : '100%',
          margin: '0 auto 16px auto'
        }}>
          <h3 style={{ 
            color: colors.onSurface, 
            fontSize: '18px',
            fontWeight: '600',
            fontFamily: 'Hanken Grotesk, sans-serif',
            marginBottom: '16px'
          }}>
            Rango de Fechas
          </h3>
          
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            marginBottom: '16px',
            flexDirection: 'row'
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Desde
              </label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.outlineVariant}`,
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  fontFamily: 'Inter, sans-serif',
                  colorScheme: isDarkMode ? 'dark' : 'light'
                }}
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline, 
                fontSize: '12px',
                marginBottom: '4px',
                display: 'block'
              }}>
                Hasta
              </label>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.outlineVariant}`,
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  fontFamily: 'Inter, sans-serif',
                  colorScheme: isDarkMode ? 'dark' : 'light'
                }}
              />
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'Inter, sans-serif',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>{loadingMessage}</span>
              </>
            ) : (
              'Generar Informe'
            )}
          </button>
        </div>

        {/* Report Results */}
        {reportData && (
          <>
            {/* Income and Costs Pie Chart */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Distribución de Ingresos y Costos
              </h3>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '32px' }}>
                {(() => {
                  const ventasCUP = reportData.ingresosVentasCUP;
                  const ventasUSD = reportData.ingresosVentasUSD * reportData.cambioMoneda;
                  const perdidas = reportData.perdidasSalidasCUP;
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
                        size={isMobile ? 150 : 200}
                        data={pieData}
                      />
                      <div style={{ 
                        flex: 1,
                        display: isMobile ? 'grid' : 'block',
                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto',
                        gap: isMobile ? '12px' : '0'
                      }}>
                        {pieData.map((item, index) => {
                          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                          const isLastItem = index === pieData.length - 1;
                          return (
                            <div key={index} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              marginBottom: isMobile ? '0' : '12px',
                              gap: '12px',
                              gridColumn: isMobile && isLastItem ? '1 / -1' : 'auto',
                              justifyContent: isMobile && isLastItem ? 'center' : 'flex-start'
                            }}>
                              <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '2px',
                                backgroundColor: item.color,
                                flexShrink: 0
                              }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ color: colors.onSurface, fontSize: '14px', fontWeight: '500' }}>
                                  {item.label}
                                </div>
                                <div style={{ color: colors.outline, fontSize: '12px' }}>
                                  {formatNumber(item.displayValue)} {item.currency}
                                </div>
                                <div style={{ color: colors.primary, fontSize: '12px', fontWeight: '600' }}>
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Net Profit */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Ganancia Neta
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: colors.outline, fontSize: '14px', display: 'block', marginBottom: '4px' }}>CUP</span>
                  <span style={{ color: colors.primary, fontSize: '24px', fontWeight: '700', display: 'block' }}>
                    {formatNumber(calculateGananciaNeta().cupSinPerdidas)}
                  </span>
                  <span style={{ color: colors.outline, fontSize: '12px', display: 'block' }}>
                    (con pérdidas: {formatNumber(calculateGananciaNeta().cup)})
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: colors.outline, fontSize: '14px', display: 'block', marginBottom: '4px' }}>USD</span>
                  <span style={{ color: colors.primary, fontSize: '24px', fontWeight: '700', display: 'block' }}>
                    {formatNumber(calculateGananciaNeta().usdSinPerdidas)}
                  </span>
                  <span style={{ color: colors.outline, fontSize: '12px', display: 'block' }}>
                    (con pérdidas: {formatNumber(calculateGananciaNeta().usd)})
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Utilidad: </span>
                <span style={{ 
                  color: parseFloat(calculateUtilidadPorcentaje()) >= 0 ? '#4CAF50' : '#F44336',
                  fontSize: '20px',
                  fontWeight: '700'
                }}>
                  {calculateUtilidadPorcentaje()}%
                </span>
              </div>
            </div>

            {/* Top Products */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              maxWidth: isDesktop ? '800px' : '100%',
              margin: '0 auto 16px auto'
            }}>
              <h3 style={{ 
                color: colors.onSurface, 
                fontSize: '18px',
                fontWeight: '600',
                fontFamily: 'Hanken Grotesk, sans-serif',
                marginBottom: '16px'
              }}>
                Top 5 Productos por Ganancia
              </h3>
              {reportData.topProductos.map((producto: any, index: number) => (
                <div key={index} style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  borderBottom: index < reportData.topProductos.length - 1 ? `1px solid ${colors.outlineVariant}` : 'none'
                }}>
                  <span style={{ color: colors.onSurface, fontSize: '14px', flex: 1 }}>
                    {producto.nombre}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: colors.primary, fontSize: '16px', fontWeight: '600' }}>
                      {formatNumber(producto.ganancia)} CUP
                    </div>
                    <div style={{ color: colors.outline, fontSize: '12px' }}>
                      {producto.porcentajeGanancia.toFixed(1)}% de ganancia neta
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InformeGeneralPage;
