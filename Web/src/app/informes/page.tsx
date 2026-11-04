'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useResponsive } from '../../hooks/useResponsive';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { BarChart3, ShoppingCart, TrendingDown, Package, TrendingUp, ChevronRight } from 'lucide-react';

const InformesPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop, isMobile, isTablet } = useResponsive();
  const { setLoading: setNavigating } = useNavigationLoading();
  const sidebarNavRef = useRef<any>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

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

  const reportOptions = [
    {
      id: 'general',
      title: 'Informe General',
      subtitle: 'Ganancias, ventas, pérdidas y costos',
      icon: BarChart3,
      color: '#4CAF50',
      route: '/informes/general',
      available: true,
    },
    {
      id: 'ventas',
      title: 'Informe de Ventas',
      subtitle: 'Análisis detallado de ventas',
      icon: ShoppingCart,
      color: '#2196F3',
      route: '/informes/ventas',
      available: true,
    },
    {
      id: 'perdidas',
      title: 'Pérdidas por Salidas',
      subtitle: 'Reporte de pérdidas de productos',
      icon: TrendingDown,
      color: '#F44336',
      route: '/informes/perdidas',
      available: true,
    },
    {
      id: 'inventario',
      title: 'Inventario de Productos',
      subtitle: 'Stock y valor de inventario',
      icon: Package,
      color: '#9C27B0',
      route: '/informes/inventario',
      available: true,
    },
    {
      id: 'cuentas',
      title: 'Seguimiento de Productos',
      subtitle: 'Movimientos de stock por producto en el tiempo',
      icon: TrendingUp,
      color: '#FF9800',
      route: '/informes/cuentas',
      available: true,
    },
  ];

  const handleReportPress = (report: any) => {
    if (!report.available) {
      showToast({ type: 'warning', message: 'Este informe está en desarrollo' });
      return;
    }

    if (report.route) {
      router.push(report.route);
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
            Informes
          </h1>
          <p style={{ 
            color: colors.outline, 
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif'
          }}>
            Selecciona el informe que deseas generar
          </p>
        </div>

        {/* Report Options */}
        <div style={{ maxWidth: isDesktop ? '800px' : '100%', margin: '0 auto' }}>
          {reportOptions.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => handleReportPress(report)}
                disabled={!report.available}
                style={{
                  width: '100%',
                  backgroundColor: colors.surface,
                  borderRadius: '16px',
                  padding: isMobile ? '16px' : '20px',
                  marginBottom: '16px',
                  border: 'none',
                  cursor: report.available ? 'pointer' : 'not-allowed',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  opacity: report.available ? 1 : 0.7,
                }}
                onMouseEnter={(e) => {
                  if (report.available) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    backgroundColor: `${report.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={32} color={report.color} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <h3 style={{ 
                      color: colors.onSurface, 
                      fontSize: '18px',
                      fontWeight: '600',
                      fontFamily: 'Hanken Grotesk, sans-serif',
                      marginBottom: '4px',
                      margin: 0
                    }}>
                      {report.title}
                    </h3>
                    <p style={{ 
                      color: colors.outline, 
                      fontSize: '14px',
                      fontFamily: 'Inter, sans-serif',
                      margin: 0
                    }}>
                      {report.subtitle}
                    </p>
                  </div>
                  <ChevronRight size={24} color={colors.outline} style={{ flexShrink: 0 }} />
                </div>
                {!report.available && (
                  <div style={{
                    alignSelf: 'flex-start',
                    marginTop: '12px',
                    padding: '4px 12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '4px',
                  }}>
                    <span style={{ 
                      color: colors.outline, 
                      fontSize: '12px',
                      fontFamily: 'Inter, sans-serif',
                      fontStyle: 'italic'
                    }}>
                      En desarrollo
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InformesPage;
