'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useNavigationLoading } from '../../../context/NavigationLoadingContext';
import { useToast } from '../../../hooks/useToast';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { getSeguimientoInventario, getProductos } from '../../../services/productoService';
import { getTiendas } from '../../../services/tiendaService';
import { ChevronDown, ChevronUp, RefreshCw, ArrowDownCircle, ArrowUpCircle, ShoppingCart, ArrowLeftRight, HelpCircle, Package } from 'lucide-react';

const InformeCuentasPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { setLoading: setNavigating } = useNavigationLoading();
  const sidebarNavRef = useRef<any>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [seguimientoData, setSeguimientoData] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<{ [key: number]: boolean }>({});
  const [filters, setFilters] = useState({
    producto: '',
    tienda: ''
  });
  const [productos, setProductos] = useState<any[]>([]);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [isLoadingProductos, setIsLoadingProductos] = useState(false);
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [tiendaSearchText, setTiendaSearchText] = useState('');

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatQuantity = (value: number) => {
    if (typeof value !== 'number') return '0';
    if (value % 1 === 0) return value.toString();
    return value.toFixed(2);
  };

  const formatDate = (dateString: string) => {
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

  const formatDateTime = (dateString: string) => {
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

  const getGroupColor = (tipo: string) => {
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

  const getGroupIcon = (tipo: string) => {
    switch (tipo) {
      case 'entrada':
        return ArrowDownCircle;
      case 'salida':
        return ArrowUpCircle;
      case 'venta':
        return ShoppingCart;
      case 'movimiento':
        return ArrowLeftRight;
      default:
        return HelpCircle;
    }
  };

  const formatGroupType = (tipo: string, subtipo?: string) => {
    if (tipo === 'movimiento' && subtipo) {
      return `Movimiento (${subtipo})`;
    }
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const renderDetalle = (detalle: any, groupType: string) => {
    switch (groupType) {
      case 'entrada':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Fecha:</span>
              <span style={{ color: colors.onSurface, fontSize: '14px' }}>{formatDateTime(detalle.fecha)}</span>
            </div>
            {detalle.codigo_lote && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Código Lote:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.codigo_lote}</span>
              </div>
            )}
            {detalle.proveedor && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Proveedor:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.proveedor}</span>
              </div>
            )}
            {detalle.fecha_vencimiento && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Vencimiento:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{formatDate(detalle.fecha_vencimiento)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Cantidad:</span>
              <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{formatQuantity(detalle.cantidad)}</span>
            </div>
          </div>
        );
      case 'salida':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Fecha:</span>
              <span style={{ color: colors.onSurface, fontSize: '14px' }}>{formatDateTime(detalle.fecha)}</span>
            </div>
            {detalle.codigo_lote && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Código Lote:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.codigo_lote}</span>
              </div>
            )}
            {detalle.motivo && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Motivo:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.motivo}</span>
              </div>
            )}
            {detalle.tipo_salida && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Tipo Salida:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.tipo_salida}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Cantidad:</span>
              <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{formatQuantity(detalle.cantidad)}</span>
            </div>
          </div>
        );
      case 'venta':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Fecha:</span>
              <span style={{ color: colors.onSurface, fontSize: '14px' }}>{formatDateTime(detalle.fecha)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Cantidad:</span>
              <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{formatQuantity(detalle.cantidad)}</span>
            </div>
          </div>
        );
      case 'movimiento':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Fecha:</span>
              <span style={{ color: colors.onSurface, fontSize: '14px' }}>{formatDateTime(detalle.fecha)}</span>
            </div>
            {detalle.tienda_origen && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Origen:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.tienda_origen}</span>
              </div>
            )}
            {detalle.tienda_destino && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Destino:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{detalle.tienda_destino}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.outline, fontSize: '14px' }}>Cantidad:</span>
              <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{formatQuantity(detalle.cantidad)}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    const loadData = async () => {
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
  }, []);

  const handleGenerateReport = async () => {
    if (!filters.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto', duration: 4000 });
      return;
    }

    if (!filters.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda', duration: 4000 });
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
            Seguimiento de Stock
          </h1>
          <p style={{ 
            color: colors.outline,
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
            margin: 0
          }}>
            Movimientos de productos por rango de fechas
          </p>
        </div>

        {/* Filters Card */}
        <div style={{ 
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          maxWidth: isDesktop ? '800px' : '100%',
          margin: '0 auto 24px auto'
        }}>
          <h3 style={{ 
            color: colors.onSurface,
            fontSize: '18px',
            fontWeight: '600',
            fontFamily: 'Hanken Grotesk, sans-serif',
            marginBottom: '16px',
            margin: '0 0 16px 0'
          }}>
            Filtros
          </h3>

          {/* Date Range */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.outlineVariant}`, backgroundColor: colors.background }}>
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

          {/* Producto field (mandatory) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              color: colors.outline,
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              display: 'block',
              marginBottom: '8px'
            }}>
              Producto *
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
                placeholder="Seleccionar producto (obligatorio)..."
                value={filters.producto}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, producto: e.target.value }));
                  setProductoSearchText(e.target.value);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateReport()}
                onFocus={() => setShowProductoDropdown(true)}
              />
              <button
                onClick={() => setShowProductoDropdown(!showProductoDropdown)}
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
                {showProductoDropdown ? (
                  <ChevronUp size={20} style={{ color: colors.outline }} />
                ) : (
                  <ChevronDown size={20} style={{ color: colors.outline }} />
                )}
              </button>
            </div>
            {showProductoDropdown && (
              <div style={{ 
                backgroundColor: colors.surface,
                border: `1px solid ${colors.outlineVariant}`,
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {isLoadingProductos ? (
                  <div style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{ color: colors.outline, fontSize: '14px' }}>Cargando productos...</span>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => {
                        setFilters(prev => ({ ...prev, producto: '' }));
                        setShowProductoDropdown(false);
                        setProductoSearchText('');
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        color: colors.outline,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      Seleccionar producto...
                    </div>
                    {productos.filter(p => p.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).length > 0 ? (
                      productos.filter(p => p.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).map((producto, index, arr) => (
                        <div
                          key={producto.id_servicio}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, producto: producto.nombre }));
                            setShowProductoDropdown(false);
                            setProductoSearchText('');
                          }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            color: colors.onSurface,
                            fontSize: '14px',
                            fontFamily: 'Inter, sans-serif',
                            borderBottom: index === arr.length - 1 ? 'none' : '1px solid rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          {producto.nombre}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', color: colors.outline, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                        No se encontraron productos
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tienda field (mandatory) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              color: colors.outline,
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              display: 'block',
              marginBottom: '8px'
            }}>
              Tienda *
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
                placeholder="Seleccionar tienda (obligatorio)..."
                value={filters.tienda}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, tienda: e.target.value }));
                  setTiendaSearchText(e.target.value);
                }}
                onFocus={() => setShowTiendaDropdown(true)}
              />
              <button
                onClick={() => setShowTiendaDropdown(!showTiendaDropdown)}
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
                {showTiendaDropdown ? (
                  <ChevronUp size={20} style={{ color: colors.outline }} />
                ) : (
                  <ChevronDown size={20} style={{ color: colors.outline }} />
                )}
              </button>
            </div>
            {showTiendaDropdown && (
              <div style={{ 
                backgroundColor: colors.surface,
                border: `1px solid ${colors.outlineVariant}`,
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {isLoadingTiendas ? (
                  <div style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{ color: colors.outline, fontSize: '14px' }}>Cargando tiendas...</span>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => {
                        setFilters(prev => ({ ...prev, tienda: '' }));
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        color: colors.outline,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      Seleccionar tienda...
                    </div>
                    {tiendas.filter(t => t.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())).length > 0 ? (
                      tiendas.filter(t => t.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())).map((tienda, index, arr) => (
                        <div
                          key={tienda.id_tienda}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, tienda: tienda.nombre }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                          }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            color: colors.onSurface,
                            fontSize: '14px',
                            fontFamily: 'Inter, sans-serif',
                            borderBottom: index === arr.length - 1 ? 'none' : '1px solid rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          {tienda.nombre}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', color: colors.outline, fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                        No se encontraron tiendas
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

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

        {/* Results */}
        {seguimientoData && (
          <div style={{ maxWidth: isDesktop ? '800px' : '100%', margin: '0 auto' }}>
            {/* Header Info */}
            <div style={{ 
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Producto:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{seguimientoData.producto?.nombre}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Tienda:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{seguimientoData.tienda?.nombre}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Stock Actual:</span>
                <span style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>{formatQuantity(seguimientoData.stock_actual)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.outline, fontSize: '14px' }}>Total Grupos:</span>
                <span style={{ color: colors.onSurface, fontSize: '14px' }}>{seguimientoData.total_grupos}</span>
              </div>
            </div>

            <h3 style={{ 
              color: colors.onSurface,
              fontSize: '18px',
              fontWeight: '600',
              fontFamily: 'Hanken Grotesk, sans-serif',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              Seguimiento ({seguimientoData.seguimiento?.length || 0} grupos)
            </h3>

            {seguimientoData.seguimiento?.map((grupo: any, index: number) => {
              const isExpanded = expandedGroups[index];
              const groupType = grupo.tipo;
              const groupColor = getGroupColor(groupType);
              const GroupIcon = getGroupIcon(groupType);

              return (
                <div key={index} style={{ 
                  backgroundColor: colors.surface,
                  borderRadius: '16px',
                  padding: isMobile ? '16px' : '20px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}>
                  <div
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [index]: !prev[index] }))}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ 
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: groupColor.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <GroupIcon size={24} style={{ color: groupColor.color }} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        color: colors.onSurface,
                        fontSize: '16px',
                        fontWeight: '600',
                        fontFamily: 'Hanken Grotesk, sans-serif',
                        marginBottom: '4px'
                      }}>
                        {formatGroupType(groupType, grupo.subtipo)}
                      </div>
                      <div style={{ 
                        color: colors.outline,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif',
                        marginBottom: '2px'
                      }}>
                        {formatDate(grupo.fecha_inicio)} - {formatDate(grupo.fecha_fin)}
                      </div>
                      <div style={{ 
                        color: colors.outline,
                        fontSize: '14px',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {grupo.cantidad_registros} registros
                      </div>
                    </div>

                    <div style={{ marginRight: '12px' }}>
                      <span style={{ 
                        color: groupColor.color,
                        fontSize: '16px',
                        fontWeight: '600',
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {grupo.efecto_numerico > 0 ? '+' : ''}{formatQuantity(grupo.efecto_numerico)}
                      </span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp size={20} style={{ color: colors.outline }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
                      {grupo.detalles?.map((detalle: any, detIndex: number) => (
                        <div key={detIndex} style={{ 
                          padding: '12px',
                          marginBottom: detIndex < grupo.detalles.length - 1 ? '12px' : 0,
                          backgroundColor: colors.background,
                          borderRadius: '8px'
                        }}>
                          {renderDetalle(detalle, groupType)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!seguimientoData && !isLoading && (
          <div style={{ 
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            maxWidth: isDesktop ? '800px' : '100%',
            margin: '0 auto'
          }}>
            <Package size={60} style={{ color: colors.outline, marginBottom: '16px' }} />
            <p style={{ color: colors.outline, fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
              Seleccione un producto y tienda para generar el informe
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InformeCuentasPage;
