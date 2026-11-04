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
import { getSalidas } from '../../../services/salidaService';
import { Calendar, RefreshCw } from 'lucide-react';

const InformePerdidasPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const PieChart = ({ data, size = 200 }: { data: any[], size?: number }) => {
    const total = data.reduce((sum: number, item: any) => sum + item.value, 0);

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
  const [reportData, setReportData] = useState<any>(null);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return '0.00';
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const fechaDesde = formatLocalDate(startDate);
      const fechaHasta = formatLocalDate(endDate);

      // Fetch salidas with date filter (no limit/page for getAll behavior)
      const salidasData = await getSalidas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }, undefined, undefined);
      const allSalidas = salidasData.data || [];

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
      const topProductosPercentage = topProductosPerdidas.reduce((sum: number, p: any) => sum + p.porcentaje, 0);
      if (topProductosPercentage < 100 && topProductosPercentage > 0) {
        topProductosPerdidas.push({
          nombre: 'Otros',
          perdida: totalPerdidasCUP - topProductosPerdidas.reduce((sum: number, p: any) => sum + p.perdida, 0),
          porcentaje: 100 - topProductosPercentage,
        });
      }

      setReportData({
        totalSalidas: allSalidas.length,
        totalPerdidasCUP,
        topProductosPerdidas,
        allSalidas,
        productosSalidasCount: Array.from(productosSalidasCount.entries())
          .map(([nombre, count]) => ({ nombre, count }))
          .sort((a, b) => b.count - a.count),
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      showToast({ type: 'error', message: error.message || 'Error al generar el informe' });
    } finally {
      setIsLoading(false);
    }
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
        currentRoute="Informes"
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

      <SidebarNavigation ref={sidebarNavRef} currentRoute="Informes" />

      <div 
        style={{
          padding: isMobile ? '16px' : isTablet ? '24px' : '40px',
          marginLeft: isDesktop ? '120px' : 'auto',
          paddingTop: isMobile ? '80px' : isTablet ? '100px' : '120px'
        }}
      >
        {/* Page Title */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h1 style={{ 
            color: colors.onSurface,
            fontSize: isMobile ? '24px' : isTablet ? '28px' : '32px',
            fontWeight: '700',
            fontFamily: 'Hanken Grotesk, sans-serif',
            marginBottom: '8px',
            margin: 0
          }}>
            Pérdidas por Salidas
          </h1>
          <p style={{ 
            color: colors.outline,
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            margin: 0
          }}>
            Análisis de pérdidas de productos
          </p>
        </div>

        {/* Date Range Card */}
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
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            Rango de Fechas
          </h3>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline,
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                display: 'block',
                marginBottom: '8px'
              }}>
                Desde
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
                <input
                  type="date"
                  value={formatLocalDate(startDate)}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.onSurface,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    colorScheme: isDarkMode ? 'dark' : 'light'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ 
                color: colors.outline,
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
                display: 'block',
                marginBottom: '8px'
              }}>
                Hasta
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
                <input
                  type="date"
                  value={formatLocalDate(endDate)}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.onSurface,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    colorScheme: isDarkMode ? 'dark' : 'light'
                  }}
                />
              </div>
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
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'Inter, sans-serif',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Cargando...
              </span>
            ) : (
              'Generar Informe'
            )}
          </button>
        </div>

        {/* Report Results */}
        {reportData && (
          <>
            {/* Total Salidas Card */}
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
                marginBottom: '16px',
                margin: '0 0 16px 0'
              }}>
                Resumen de Salidas
              </h3>
              
              {/* Products with salida count */}
              {reportData.productosSalidasCount && reportData.productosSalidasCount.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ 
                    color: colors.outline,
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: '12px',
                    margin: '0 0 12px 0'
                  }}>
                    Productos involucrados en salidas:
                  </h4>
                  {reportData.productosSalidasCount.map((producto: any, index: number) => (
                    <div key={index} style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                    }}>
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        flex: 1,
                        marginRight: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {producto.nombre}
                      </span>
                      <span style={{ 
                        color: colors.primary,
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {producto.count} salida{producto.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                <span style={{ 
                  color: colors.outline,
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Total de Salidas:
                </span>
                <span style={{ 
                  color: colors.primary,
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {reportData.totalSalidas}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
              }}>
                <span style={{ 
                  color: colors.outline,
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Pérdidas Totales CUP:
                </span>
                <span style={{ 
                  color: colors.primary,
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {formatNumber(reportData.totalPerdidasCUP)} CUP
                </span>
              </div>
            </div>

            {/* Top 5 Productos con más Pérdidas Card */}
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
                marginBottom: '16px',
                margin: '0 0 16px 0'
              }}>
                Top 5 Productos con más Pérdidas
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                {(() => {
                  const pieData = reportData.topProductosPerdidas.map((producto: any, index: number) => ({
                    value: producto.perdida,
                    color: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#FF5722'][index % 5],
                    label: producto.nombre,
                    displayValue: producto.perdida,
                  }));

                  return (
                    <PieChart
                      size={200}
                      data={pieData}
                    />
                  );
                })()}
              </div>
              <div style={{ marginTop: '16px' }}>
                {reportData.topProductosPerdidas.map((producto: any, index: number) => (
                  <div key={index} style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ 
                        width: '12px',
                        height: '12px',
                        borderRadius: '6px',
                        backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#FF5722'][index % 5]
                      }} />
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {producto.nombre}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ 
                        color: colors.primary,
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {formatNumber(producto.perdida)} CUP
                      </span>
                      <span style={{ 
                        color: colors.outline,
                        fontSize: '12px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {(producto.porcentaje || 0).toFixed(1)}% del total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InformePerdidasPage;
