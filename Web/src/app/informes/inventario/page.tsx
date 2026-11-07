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
import { getProductos } from '../../../services/productoService';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const InformeInventarioPage = () => {
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

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    nombre: '',
    categoria: '',
    codigo: '',
    cantidad_min: 0.01
  });

  const [showNombreDropdown, setShowNombreDropdown] = useState(false);
  const [nombreSearchText, setNombreSearchText] = useState('');
  const [nombreSuggestions, setNombreSuggestions] = useState<string[]>([]);

  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [categoriaSearchText, setCategoriaSearchText] = useState('');
  const predefinedCategories = ['Alimentos', 'Bebidas', 'Limpieza', 'Higiene Personal', 'Electrónicos', 'Ropa', 'Hogar', 'Otros'];
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return '0.00';
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatQuantity = (value: number) => {
    if (typeof value !== 'number') return '0';
    if (value % 1 === 0) return value.toString();
    return value.toFixed(2);
  };

  const getChartColor = (index: number) => {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
    return colors[index % colors.length];
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

  const searchProductNames = async (searchText: string) => {
    if (searchText.length < 3) {
      setNombreSuggestions([]);
      return;
    }

    try {
      const result = await getProductos({ nombre: searchText, skipEsvendible: true }, 1, 100);
      const nombres = [...new Set(result.data?.map((p: any) => p.nombre) || [])];
      setNombreSuggestions(nombres);
    } catch (error) {
      console.error('Error searching product names:', error);
      setNombreSuggestions([]);
    }
  };

  const loadSystemCategories = async () => {
    try {
      const result = await getProductos({ skipEsvendible: true }, 1, 100);
      const categorias = [...new Set(result.data?.map((p: any) => p.categoria?.trim()).filter((c: string) => c) || [])];
      setCustomCategories(categorias);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const filtersWithSkip = { ...filters, skipEsvendible: true };

      const productosData = await getProductos(filtersWithSkip, 1, 1000);
      const productos = productosData.data || [];

      const productStats: any = {};

      productos.forEach((producto: any) => {
        const tiendasServicio = producto.tiendas_servicio || [];

        tiendasServicio.forEach((ts: any) => {
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

      const statsArray = Object.values(productStats);

      const top5ByCost = [...statsArray]
        .sort((a: any, b: any) => b.totalCostoCUP - a.totalCostoCUP)
        .slice(0, 5);

      const otherCost = statsArray
        .filter((p: any) => !top5ByCost.find((t: any) => t.id_producto === p.id_producto))
        .reduce((sum: number, p: any) => sum + p.totalCostoCUP, 0);

      const costChartData = top5ByCost.map((p: any, index: number) => ({
        label: p.nombre,
        value: p.totalCostoCUP,
        color: getChartColor(index)
      }));

      if (otherCost > 0) {
        costChartData.push({
          label: 'Otros',
          value: otherCost,
          color: '#9E9E9E'
        });
      }

      const top5ByValue = [...statsArray]
        .sort((a: any, b: any) => b.totalValorCUP - a.totalValorCUP)
        .slice(0, 5);

      const otherValue = statsArray
        .filter((p: any) => !top5ByValue.find((t: any) => t.id_producto === p.id_producto))
        .reduce((sum: number, p: any) => sum + p.totalValorCUP, 0);

      const valueChartData = top5ByValue.map((p: any, index: number) => ({
        label: p.nombre,
        value: p.totalValorCUP,
        color: getChartColor(index)
      }));

      if (otherValue > 0) {
        valueChartData.push({
          label: 'Otros',
          value: otherValue,
          color: '#9E9E9E'
        });
      }

      const totalCostAll = statsArray.reduce((sum: number, p: any) => sum + p.totalCostoCUP, 0);
      const totalValueAll = statsArray.reduce((sum: number, p: any) => sum + p.totalValorCUP, 0);

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
            Inventario de Productos
          </h1>
          <p style={{ 
            color: colors.outline,
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            margin: 0
          }}>
            Análisis de stock y valor de inventario
          </p>
        </div>

        {/* Filters Card */}
        <div style={{ 
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          maxWidth: isDesktop ? '800px' : '100%',
          margin: '0 auto 16px auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ 
              color: colors.onSurface,
              fontSize: '18px',
              fontWeight: '600',
              fontFamily: 'Hanken Grotesk, sans-serif',
              margin: 0
            }}>
              Filtros
            </h3>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                border: `1px solid ${colors.primary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {showAdvancedFilters ? (
                <ChevronUp size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
              ) : (
                <ChevronDown size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
              )}
            </button>
          </div>

          {/* Nombre field */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              color: colors.outline,
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              display: 'block',
              marginBottom: '8px'
            }}>
              Nombre
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '40px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.outlineVariant}`,
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px'
                }}
                placeholder="Buscar por nombre..."
                value={filters.nombre}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, nombre: e.target.value }));
                  setNombreSearchText(e.target.value);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateReport()}
                onFocus={() => {
                  setShowNombreDropdown(true);
                  if (customCategories.length === 0) {
                    loadSystemCategories();
                  }
                }}
              />
              <button
                onClick={() => setShowNombreDropdown(!showNombreDropdown)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showNombreDropdown ? (
                  <ChevronUp size={20} style={{ color: colors.outline }} />
                ) : (
                  <ChevronDown size={20} style={{ color: colors.outline }} />
                )}
              </button>
            </div>
            {showNombreDropdown && nombreSuggestions.length > 0 && (
              <div style={{ 
                backgroundColor: colors.surface,
                border: `1px solid ${colors.outlineVariant}`,
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {nombreSuggestions
                  .filter(nombre => nombre.toLowerCase().includes(nombreSearchText.toLowerCase()))
                  .map((nombre, index, filteredArray) => (
                    <div
                      key={nombre}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, nombre }));
                        setShowNombreDropdown(false);
                        setNombreSearchText('');
                      }}
                      style={{
                        padding: '12px',
                        borderBottom: index === filteredArray.length - 1 ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                        cursor: 'pointer',
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      {nombre}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div style={{ 
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
              {/* Categoría */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  color: colors.outline,
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Categoría
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    style={{
                      width: '100%',
                      padding: '12px',
                      paddingRight: '40px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.outlineVariant}`,
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px'
                    }}
                    placeholder="Seleccionar o escribir categoría..."
                    value={filters.categoria}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, categoria: e.target.value }));
                      setCategoriaSearchText(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateReport()}
                    onFocus={() => {
                      setShowCategoriaDropdown(true);
                      if (customCategories.length === 0) {
                    loadSystemCategories();
                  }
                }}
                  />
                  <button
                    onClick={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showCategoriaDropdown ? (
                      <ChevronUp size={20} style={{ color: colors.outline }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </button>
                </div>
                {showCategoriaDropdown && (
                  <div style={{ 
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.outlineVariant}`,
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {[...new Set([...predefinedCategories, ...customCategories])]
                      .filter(cat => cat && cat.trim() && cat.toLowerCase().includes(categoriaSearchText.toLowerCase()))
                      .map((category, index, filteredArray) => (
                        <div
                          key={`${category}-${index}`}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, categoria: category }));
                            setShowCategoriaDropdown(false);
                            setCategoriaSearchText('');
                          }}
                          style={{
                            padding: '12px',
                            borderBottom: index === filteredArray.length - 1 ? 'none' : '1px solid rgba(0, 0, 0, 0.05)',
                            cursor: 'pointer',
                            color: colors.onSurface,
                            fontSize: '14px',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          {category}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Código */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  color: colors.outline,
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Código
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.outlineVariant}`,
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px'
                    }}
                    placeholder="Buscar por código de barras..."
                    value={filters.codigo}
                    onChange={(e) => setFilters(prev => ({ ...prev, codigo: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateReport()}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: 'Inter, sans-serif',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              marginTop: '16px'
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
            {/* Cost Chart Card */}
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
                margin: '0 0 16px 0',
                textAlign: 'center'
              }}>
                Top 5 Productos por Costo Total
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <PieChart size={200} data={reportData.costChartData} />
              </div>
              <div style={{ marginTop: '16px' }}>
                {reportData.top5ByCost.map((item: any, index: number) => {
                  const percentage = reportData.totalCostAll > 0 ? ((item.totalCostoCUP / reportData.totalCostAll) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={index} style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div style={{ 
                          width: '16px',
                          height: '16px',
                          borderRadius: '8px',
                          backgroundColor: getChartColor(index)
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
                          {item.nombre}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ 
                          color: colors.onSurface,
                          fontSize: '14px',
                          fontWeight: '600',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {formatNumber(item.totalCostoCUP)} CUP
                        </span>
                        <span style={{ 
                          color: colors.outline,
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {formatQuantity(item.totalCantidad)} unidades
                        </span>
                        <span style={{ 
                          color: colors.outline,
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {reportData.otherCost > 0 && (
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ 
                        width: '16px',
                        height: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#9E9E9E'
                      }} />
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        Otros
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {formatNumber(reportData.otherCost)} CUP
                      </span>
                      <span style={{ 
                        color: colors.outline,
                        fontSize: '11px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {reportData.totalCostAll > 0 ? ((reportData.otherCost / reportData.totalCostAll) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </div>
                )}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '2px solid rgba(0, 0, 0, 0.1)',
                  marginTop: '8px'
                }}>
                  <span style={{ 
                    color: colors.onSurface,
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Total de Costo
                  </span>
                  <span style={{ 
                    color: colors.primary,
                    fontSize: '16px',
                    fontWeight: '700',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {formatNumber(reportData.totalCostAll)} CUP
                  </span>
                </div>
              </div>
            </div>

            {/* Value Chart Card */}
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
                margin: '0 0 16px 0',
                textAlign: 'center'
              }}>
                Top 5 Productos por Valor de Venta
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <PieChart size={200} data={reportData.valueChartData} />
              </div>
              <div style={{ marginTop: '16px' }}>
                {reportData.top5ByValue.map((item: any, index: number) => {
                  const percentage = reportData.totalValueAll > 0 ? ((item.totalValorCUP / reportData.totalValueAll) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={index} style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div style={{ 
                          width: '16px',
                          height: '16px',
                          borderRadius: '8px',
                          backgroundColor: getChartColor(index)
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
                          {item.nombre}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ 
                          color: colors.onSurface,
                          fontSize: '14px',
                          fontWeight: '600',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {formatNumber(item.totalValorCUP)} CUP
                        </span>
                        <span style={{ 
                          color: colors.outline,
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {formatQuantity(item.totalCantidad)} unidades
                        </span>
                        <span style={{ 
                          color: colors.outline,
                          fontSize: '11px',
                          fontFamily: 'Inter, sans-serif'
                        }}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {reportData.otherValue > 0 && (
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ 
                        width: '16px',
                        height: '16px',
                        borderRadius: '8px',
                        backgroundColor: '#9E9E9E'
                      }} />
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        Otros
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ 
                        color: colors.onSurface,
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {formatNumber(reportData.otherValue)} CUP
                      </span>
                      <span style={{ 
                        color: colors.outline,
                        fontSize: '11px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {reportData.totalValueAll > 0 ? ((reportData.otherValue / reportData.totalValueAll) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </div>
                )}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '2px solid rgba(0, 0, 0, 0.1)',
                  marginTop: '8px'
                }}>
                  <span style={{ 
                    color: colors.onSurface,
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Total de Venta
                  </span>
                  <span style={{ 
                    color: colors.primary,
                    fontSize: '16px',
                    fontWeight: '700',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {formatNumber(reportData.totalValueAll)} CUP
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default InformeInventarioPage;
