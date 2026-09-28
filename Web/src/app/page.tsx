'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useViewMode } from '../context/ViewModeContext';
import { useNavigationLoading } from '../context/NavigationLoadingContext';
import { useToast } from '../hooks/useToast';
import { Header } from '../components/layout/Header';
import { SidebarNavigation } from '../components/layout/SidebarNavigation';
import { Toast } from '../components/common/Toast';
import { AlertTriangle, Clock, XCircle, CheckCircle, Phone, MessageCircle, ArrowRight, Lock, Box, FileText, ShoppingCart, DollarSign, Users, X } from 'lucide-react';
import { getEntradas } from '../services/entradaService';
import { SvgIcon } from '../components/common/SvgIcon';
import { darkColors } from '../lib/colors';
import { getGeneralInformation } from '../services/informesService';
import { useResponsive } from '../hooks/useResponsive';


export default function HomePage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, permissions, entradaAccessLevels, salidaAccessLevels, operacionAccessLevels } = useAuth();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { toast, showToast, hideToast } = useToast();
  const sidebarNavRef = useRef<any>(null);

  // Reset navigation loading state when page loads
  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [greeting, setGreeting] = useState('Buenos días');
  const [currentDate, setCurrentDate] = useState('');
  const [expiringProducts, setExpiringProducts] = useState<any[]>([]);
  const [allExpiringProducts, setAllExpiringProducts] = useState<any[]>([]);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [loadingExpiring, setLoadingExpiring] = useState(false);
  const [stats, setStats] = useState({
    cantidad_productos: 0,
    total_ventas_cup: 0,
    total_ventas_usd: 0,
    usuarios_activos: 0,
    ganancia_cup: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const date = new Date().toLocaleDateString('es-ES', options);
    setCurrentDate(date);
  }, []);

  const getFirstName = (fullName: string) => {
    if (!fullName) return 'Administrador';
    const name = fullName.trim();
    if (name === 'Administrador') return 'Administrador';
    return name.split(' ')[0];
  };

  const getRoleImage = () => {
    const role = user?.rol?.toLowerCase();
    if (!role) return isDarkMode ? '/home-dark.png' : '/home-light.png';

    if (role === 'almacenero') {
      return isDarkMode ? '/almacenero-dark.png' : '/almacenero-light.png';
    } else if (role === 'dependiente') {
      return isDarkMode ? '/dependiente-dark.png' : '/dependiente-light.png';
    } else if (role === 'económico') {
      return isDarkMode ? '/economico-dark.png' : '/economico-light.png';
    } else {
      return isDarkMode ? '/home-dark.png' : '/home-light.png';
    }
  };

  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canAccessSalidas =
    isAdmin ||
    (userRole === 'dependiente' && salidaAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && salidaAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && salidaAccessLevels?.economico !== 'none');

  const canAccessOperaciones =
    isAdmin ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && operacionAccessLevels?.economico !== 'none');

  const mainModules = [
    {
      id: 'servicios',
      icon: '/lanza-libre.svg',
      iconType: 'svg',
      label: 'Servicios y Ofertas',
      description: 'Gestionar servicios y ofertas',
      color: colors.primary,
      darkColor: darkColors.primary, // #a0cafb — igual que la app móvil
      screen: '/servicios',
      permission: true,
      hasPermission: true
    },
    {
      id: 'productos',
      icon: '/product.svg',
      iconType: 'svg',
      label: 'Productos',
      description: 'Gestionar inventario',
      color: '#16A34A',
      darkColor: '#16A34A', // mismo color en ambos modos, igual que en la app
      screen: '/productos',
      permission: true,
      hasPermission: true
    },
    {
      id: 'ventas',
      icon: '/box.svg',
      iconType: 'svg',
      label: 'Ventas',
      description: 'Registrar ventas',
      color: '#185FA5',
      darkColor: '#185FA5', // mismo color en ambos modos, igual que en la app
      screen: '/ventas',
      permission: canAccessSalidas,
      hasPermission: canAccessSalidas
    },
    {
      id: 'operaciones',
      icon: '/report.svg',
      iconType: 'svg',
      label: 'Operaciones',
      description: 'Gestión de operaciones',
      color: colors.secondary,
      darkColor: darkColors.secondary, // #ffb59e — igual que la app móvil
      screen: '/operaciones',
      permission: canAccessOperaciones,
      hasPermission: canAccessOperaciones
    },
  ];

  const formatNumber = (value: number) => {
    if (value === null || value === undefined) return '0';
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(0);
  };

  const handleSupportCall = () => {
    window.open('tel:56242671', '_blank');
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/56242671', '_blank');
  };

  const handleLogoPress = () => {
    if (user) {
      router.push('/');
    }
  };

  const handleModulePress = (module: any) => {
    if (module.hasPermission && module.screen) {
      router.push(module.screen);
    }
  };

  // Función para calcular el umbral dinámico de alerta
  const calculateThreshold = (vidaUtil: number, porcentaje: number, minAbs: number, maxAbs: number) => {
    return Math.max(minAbs, Math.min(maxAbs, porcentaje * vidaUtil));
  };

  // Función para determinar el nivel de alerta de un producto
  const getExpirationAlert = (fechaCreacion: string, fechaVencimiento: string) => {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const creacion = new Date(fechaCreacion);
    
    const vidaUtil = Math.ceil((vencimiento.getTime() - creacion.getTime()) / (1000 * 60 * 60 * 24));
    const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes <= 0) {
      return { level: 'expired', days: diasRestantes, label: 'Vencido' };
    }
    
    const umbralAmarillo = calculateThreshold(vidaUtil, 0.20, 3, 30);
    const umbralRojo = calculateThreshold(vidaUtil, 0.10, 1, 7);
    
    if (diasRestantes <= umbralRojo) {
      return { level: 'critical', days: diasRestantes, label: 'Crítico' };
    } else if (diasRestantes <= umbralAmarillo) {
      return { level: 'warning', days: diasRestantes, label: 'Próximo a vencer' };
    } else {
      return { level: 'ok', days: diasRestantes, label: 'Vigente' };
    }
  };

  const getExpirationAlertColor = (level: string) => {
    switch (level) {
      case 'critical':
        return isDarkMode ? '#EF4444' : '#DC2626';
      case 'warning':
        return isDarkMode ? '#FBBF24' : '#F59E0B';
      case 'expired':
        return isDarkMode ? '#9CA3AF' : '#1F2937';
      default:
        return colors.outline;
    }
  };

  const getExpirationAlertIcon = (level: string) => {
    const iconColor = getExpirationAlertColor(level);
    switch (level) {
      case 'critical':
        return <AlertTriangle size={20} color={iconColor} />;
      case 'warning':
        return <Clock size={20} color={iconColor} />;
      case 'expired':
        return <XCircle size={20} color={iconColor} />;
      default:
        return <CheckCircle size={20} color="#16A34A" />;
    }
  };

  // Consultar productos próximos a vencer
  useEffect(() => {
    const fetchExpiringProducts = async () => {
      try {
        setLoadingExpiring(true);
        
        const hoy = new Date();
        const fechaMaxima = new Date(hoy);
        fechaMaxima.setDate(fechaMaxima.getDate() + 30);
        
        const fechaMaximaStr = fechaMaxima.toISOString().split('T')[0];
        
        const response = await getEntradas(
          { fecha_vencimiento_hasta: fechaMaximaStr },
          1,
          20
        );
        
        const productosConAlerta = response.data
          .filter((entrada: any) => entrada.fecha_vencimiento && entrada.cantidad_restante > 0)
          .map((entrada: any) => {
            const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
            return {
              ...entrada,
              alerta,
              nombreProducto: entrada.servicioTienda?.servicio?.nombre || 'Producto desconocido',
              codigoLote: entrada.codigo_lote || 'N/A'
            };
          })
          .filter((item: any) => item.alerta.level === 'critical' || item.alerta.level === 'warning' || item.alerta.level === 'expired')
          .sort((a: any, b: any) => a.alerta.days - b.alerta.days);
        
        setAllExpiringProducts(productosConAlerta);
        setExpiringProducts(productosConAlerta.slice(0, 3));
        
        // Mostrar toast de alerta si hay productos próximos a vencer
        if (productosConAlerta.length > 0) {
          // Agrupar por nombre de producto y contar entradas
          const productosAgrupados = productosConAlerta.reduce((acc: any, producto: any) => {
            const nombre = producto.nombreProducto;
            if (!acc[nombre]) {
              acc[nombre] = { count: 0, nombres: [] };
            }
            acc[nombre].count++;
            acc[nombre].nombres.push(producto.nombreProducto);
            return acc;
          }, {});
          
          const mensajes = Object.entries(productosAgrupados).map(([nombre, data]: [string, any]) => {
            return `hay ${data.count} entradas de ${nombre} próximas a vencer`;
          });
          
          const message = mensajes.join('. ');
          
          const messageCapitalized = message
            .split('. ')
            .map((sentence: string) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
            .join('. ');
          
          showToast({
            type: 'warning',
            message: messageCapitalized,
            duration: 8000
          });
        }
      } catch (error) {
        // Error al cargar productos próximos a vencer — servidor no disponible
      } finally {
        setLoadingExpiring(false);
      }
    };

    fetchExpiringProducts();
  }, []);

  // Consultar información general para el RESUMEN
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const data = await getGeneralInformation();
        setStats(data);
      } catch (error) {
        // Error al cargar estadísticas — servidor no disponible
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <Header 
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={() => {}}
        onLogoPress={handleLogoPress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />
      
      <SidebarNavigation 
        currentRoute="Home" 
        ref={sidebarNavRef}
      />

      <div style={{ 
        marginTop: '80px',
        marginRight: 'auto',
        marginBottom: '0',
        marginLeft: isDesktop ? '120px' : 'auto',
        paddingTop: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingBottom: '120px',
        paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
        maxWidth: isDesktop ? '1400px' : '100%',
      }}>
        {/* Header / Bienvenida */}
        <div style={{ marginBottom: '24px' }}>
          <div 
            style={{ 
              borderRadius: '16px', 
              padding: '24px', 
              backgroundColor: isDarkMode ? '#0A1628' : '#F5F8FC',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: isDesktop ? '32px' : isTablet ? '28px' : '24px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}>
                  ¡Bienvenido!
                </p>
                <p style={{ fontSize: isDesktop ? '20px' : isTablet ? '18px' : '16px', color: colors.onSurface, margin: '4px 0 0 0' }}>
                  {isMobile ? getFirstName(user?.nombre_natural || user?.nombre_usuario) : (user?.nombre_natural || user?.nombre_usuario)}
                </p>
                <p style={{ fontSize: '14px', color: colors.outline, margin: '4px 0 0 0' }}>
                  {user?.rol || 'Administrador'}
                </p>
                <p style={{ fontSize: '14px', color: colors.outline, margin: '4px 0 0 0' }}>
                  {currentDate}
                </p>
              </div>
              <Image
                src={getRoleImage()}
                alt="Store"
                width={isDesktop ? 120 : isTablet ? 100 : 80}
                height={isDesktop ? 120 : isTablet ? 100 : 80}
                style={{ borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* Alertas de Vencimiento */}
        {expiringProducts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                marginBottom: '16px', 
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: colors.outline 
              }}
            >
              ALERTAS DE VENCIMIENTO
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expiringProducts.map((producto, index) => (
                <div
                  key={producto.id || index}
                  style={{
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    borderLeftWidth: '4px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: getExpirationAlertColor(producto.alerta.level)
                  }}
                >
                  <div
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '6px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      marginRight: '12px'
                    }}
                  >
                    {getExpirationAlertIcon(producto.alerta.level)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: '600', color: colors.onSurface, margin: 0, fontSize: '14px' }}>
                      {producto.codigoLote}
                    </p>
                    <p style={{ fontSize: '12px', color: colors.outline, margin: '2px 0 0 0' }}>
                      Cant.Res: {producto.cantidad_restante || 0}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                    <p
                      style={{ 
                        fontSize: '13px', 
                        fontWeight: '600',
                        color: getExpirationAlertColor(producto.alerta.level),
                        margin: 0
                      }}
                    >
                      {producto.alerta.label}
                    </p>
                    <p style={{ fontSize: '11px', color: colors.outline, margin: '2px 0 0 0' }}>
                      {producto.alerta.days === 0 ? 'Hoy' :
                       producto.alerta.days === 1 ? 'Mañana' :
                       producto.alerta.days === -1 ? 'Ayer' :
                       producto.alerta.days < 0 ? `${Math.abs(producto.alerta.days)} días` :
                       `${producto.alerta.days} días`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                    <button
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: colors.primary,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      title="Ver producto"
                    >
                      <Box size={14} color="#fff" />
                    </button>
                    <button
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: colors.secondary,
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      title="Ver entrada"
                    >
                      <FileText size={14} color="#fff" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {allExpiringProducts.length > 3 && (
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: `${colors.primary}15`,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  marginTop: '8px',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                onClick={() => setAlertModalVisible(true)}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: colors.primary, margin: 0 }}>
                  Ver más ({allExpiringProducts.length - 3} más)
                </span>
              </button>
            )}
          </div>
        )}

        {/* Módulos Principales */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              marginBottom: '16px', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: colors.outline 
            }}
          >
            MÓDULOS PRINCIPALES
          </p>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', 
            gap: isMobile ? '16px' : '24px' 
          }}>
            {mainModules.map((module) => (
              <button
                key={module.id}
                onClick={() => handleModulePress(module)}
                disabled={!module.hasPermission}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: module.hasPermission ? 'pointer' : 'not-allowed',
                  opacity: module.hasPermission ? 1 : 0.5,
                  transition: isDesktop ? 'transform 0.2s ease, box-shadow 0.2s ease' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (isDesktop && module.hasPermission) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isDesktop) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div
                  style={{
                    borderRadius: isMobile ? '16px' : '20px',
                    paddingTop: isMobile ? '12px' : '20px',
                    paddingBottom: 0,
                    backgroundColor: isDarkMode ? '#0A1628' : '#F5F8FC',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    overflow: 'hidden',
                    minHeight: isDesktop ? '180px' : 'auto'
                  }}
                >
                  <div style={{ paddingLeft: '12px', paddingRight: '12px', alignItems: 'center', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {module.iconType === 'svg' ? (
                      <div style={{ margin: '0 auto 8px', width: isDesktop ? '40px' : '28px', height: isDesktop ? '40px' : '28px' }}>
                        <SvgIcon
                          src={module.icon}
                          size={isDesktop ? 40 : 28}
                          color={module.hasPermission
                            ? (isDarkMode ? (module.darkColor || module.color) : module.color)
                            : colors.outline
                          }
                        />
                      </div>
                    ) : null}
                    <p style={{ fontWeight: '600', color: colors.onSurface, margin: '0 0 8px 0', fontSize: isDesktop ? '16px' : '14px', textAlign: 'center' }}>
                      {module.label}
                    </p>
                  </div>
                  {module.hasPermission ? (
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: isDesktop ? '12px' : '8px',
                        paddingBottom: isDesktop ? '12px' : '8px',
                        borderTop: `1px solid ${isDarkMode ? (module.darkColor || module.color) : module.color}30`,
                        backgroundColor: `${isDarkMode ? (module.darkColor || module.color) : module.color}08`,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <p style={{ fontSize: isDesktop ? '14px' : '12px', fontWeight: '600', color: isDarkMode ? (module.darkColor || module.color) : module.color, margin: 0 }}>
                        Acceder
                      </p>
                      <ArrowRight size={isDesktop ? 20 : 16} color={isDarkMode ? (module.darkColor || module.color) : module.color} />
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        paddingBottom: '8px',
                        borderTop: `1px solid ${colors.outline}30`,
                        backgroundColor: `${colors.outline}08`,
                        width: '100%',
                        opacity: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <p style={{ fontSize: '12px', fontWeight: '600', color: colors.outline, margin: 0 }}>
                        Sin permisos
                      </p>
                      <Lock size={16} color={colors.outline} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Estadísticas */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              marginBottom: '16px', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: colors.outline 
            }}
          >
            RESUMEN
          </p>
          <div
            style={{
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              backgroundColor: colors.surface
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isMobile ? '8px' : '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: isMobile ? '32px' : '40px',
                    height: isMobile ? '32px' : '40px',
                    margin: '0 auto 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${colors.primary}15`
                  }}
                >
                  <Box size={isMobile ? 14 : 20} color={colors.primary} />
                </div>
                <p style={{ fontSize: isMobile ? '14px' : '20px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}>
                  {loadingStats ? '...' : stats.cantidad_productos}
                </p>
                <p style={{ fontSize: isMobile ? '10px' : '14px', color: colors.outline, margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  Productos en stock
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: isMobile ? '32px' : '40px',
                    height: isMobile ? '32px' : '40px',
                    margin: '0 auto 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#16A34A15'
                  }}
                >
                  <ShoppingCart size={isMobile ? 14 : 20} color="#16A34A" />
                </div>
                <p style={{ fontSize: isMobile ? '14px' : '20px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}>
                  {loadingStats ? '...' : (stats.total_ventas_cup || 0).toFixed(0)}
                </p>
                <p style={{ fontSize: isMobile ? '10px' : '14px', color: colors.outline, margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  Ventas hoy
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: isMobile ? '32px' : '40px',
                    height: isMobile ? '32px' : '40px',
                    margin: '0 auto 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${colors.secondary}15`
                  }}
                >
                  <DollarSign size={isMobile ? 14 : 20} color={colors.secondary} />
                </div>
                <p style={{ fontSize: isMobile ? '14px' : '20px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}>
                  {loadingStats ? '...' : formatNumber(stats.ganancia_cup)}
                </p>
                <p style={{ fontSize: isMobile ? '10px' : '14px', color: colors.outline, margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  Ganancia hoy (CUP)
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: isMobile ? '32px' : '40px',
                    height: isMobile ? '32px' : '40px',
                    margin: '0 auto 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#185FA515'
                  }}
                >
                  <Users size={isMobile ? 14 : 20} color="#185FA5" />
                </div>
                <p style={{ fontSize: isMobile ? '14px' : '20px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}>
                  {loadingStats ? '...' : stats.usuarios_activos}
                </p>
                <p style={{ fontSize: isMobile ? '10px' : '14px', color: colors.outline, margin: '4px 0 0 0', lineHeight: '1.3' }}>
                  Usuarios activos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Soporte */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              backgroundColor: colors.surface
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${colors.primary}15`,
                  marginRight: '12px'
                }}
              >
                <Phone size={24} color={colors.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: '600', color: colors.onSurface, margin: 0 }}>
                  ¿Necesitas ayuda?
                </p>
                <p style={{ fontSize: '14px', color: colors.outline, margin: '4px 0 0 0' }}>
                  Contáctanos para soporte técnico
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button
                onClick={handleSupportCall}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: `${colors.primary}15`
                }}
              >
                <Phone size={20} color={colors.primary} />
                <p style={{ fontSize: '16px', fontWeight: '600', color: colors.onSurface, margin: 0 }}>
                  56242671
                </p>
              </button>
              <button
                onClick={handleWhatsApp}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#25D36615'
                }}
              >
                <MessageCircle size={20} color="#25D366" />
                <p style={{ fontSize: '14px', color: colors.onSurface, margin: 0 }}>
                  También por WhatsApp
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de todas las alertas */}
      {alertModalVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setAlertModalVisible(false)}
        >
          <div
            style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: `1px solid ${colors.outlineVariant}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: colors.onSurface }}>
                Todas las Alertas de Vencimiento
              </h3>
              <button
                onClick={() => setAlertModalVisible(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'backgroundColor 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.outlineVariant}50`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={24} color={colors.outline} />
              </button>
            </div>
            <div
              style={{
                padding: '16px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allExpiringProducts.map((producto, index) => (
                  <div
                    key={producto.id || index}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      borderLeftWidth: '4px',
                      borderLeftStyle: 'solid',
                      borderLeftColor: getExpirationAlertColor(producto.alerta.level)
                    }}
                  >
                    <div
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        marginRight: '12px'
                      }}
                    >
                      {getExpirationAlertIcon(producto.alerta.level)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: '600', color: colors.onSurface, margin: 0, fontSize: '14px' }}>
                        {producto.codigoLote}
                      </p>
                      <p style={{ fontSize: '12px', color: colors.outline, margin: '2px 0 0 0' }}>
                        Cant.Res: {producto.cantidad_restante || 0}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                      <p
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '600',
                          color: getExpirationAlertColor(producto.alerta.level),
                          margin: 0
                        }}
                      >
                        {producto.alerta.label}
                      </p>
                      <p style={{ fontSize: '11px', color: colors.outline, margin: '2px 0 0 0' }}>
                        {producto.alerta.days === 0 ? 'Hoy' :
                         producto.alerta.days === 1 ? 'Mañana' :
                         producto.alerta.days === -1 ? 'Ayer' :
                         producto.alerta.days < 0 ? `${Math.abs(producto.alerta.days)} días` :
                         `${producto.alerta.days} días`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                      <button
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: colors.primary,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        title="Ver producto"
                      >
                        <Box size={14} color="#fff" />
                      </button>
                      <button
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: colors.secondary,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        title="Ver entrada"
                      >
                        <FileText size={14} color="#fff" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    </div>
  );
}
