'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { Loader2 } from 'lucide-react';

interface IconStripProps {
  onHover: () => void;
  onLeave: () => void;
  currentRoute?: string;
}

export const IconStrip = ({ onHover, onLeave, currentRoute = 'Home' }: IconStripProps) => {
  const { colors, isDark } = useTheme();
  const { user, permissions, entradaAccessLevels, salidaAccessLevels, operacionAccessLevels, ventaAccessLevels, movimientoAccessLevels, deudaAccessLevels } = useAuth();
  const { isLoading: isNavigating, setLoading: setNavigating } = useNavigationLoading();
  const router = useRouter();

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const handleNavigation = (route: string) => {
    if (isNavigating) return;
    
    setNavigating(true);
    // Mapeo de rutas a URLs de Next.js
    const routeMap: Record<string, string> = {
      'Home': '/',
      'Servicios': '/servicios',
      'Productos': '/productos',
      'Entradas': '/entradas',
      'Salidas': '/salidas',
      'Operaciones': '/operaciones',
      'Ventas': '/ventas',
      'Movimientos': '/movimientos',
      'Deudas': '/deudas',
      'Tiendas': '/tiendas',
      'Usuarios': '/usuarios',
      'CurrencyExchange': '/configuracion',
    };
    
    if (routeMap[route]) {
      router.push(routeMap[route]);
    }
  };

  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canAccessEntradas = 
    isAdmin ||
    (userRole === 'dependiente' && entradaAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && entradaAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && entradaAccessLevels?.economico !== 'none');

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

  const canAccessVentas =
    isAdmin ||
    (userRole === 'dependiente' && ventaAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && ventaAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && ventaAccessLevels?.economico !== 'none');

  const canAccessMovimientos =
    isAdmin ||
    (userRole === 'dependiente' && movimientoAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && movimientoAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && movimientoAccessLevels?.economico !== 'none');

  const canAccessDeudas =
    isAdmin ||
    (userRole === 'dependiente' && deudaAccessLevels?.dependiente === 'ambos') ||
    (userRole === 'almacenero' && deudaAccessLevels?.almacenero === 'ambos') ||
    (userRole === 'económico' && deudaAccessLevels?.economico === 'ambos');

  let menuItems: any[] = [
    { icon: '/icon-panel.png', label: 'Panel', route: 'Home' },
    { icon: '/icon-servicios.png', label: 'Servicios y Ofertas', route: 'Servicios' },
    { icon: '/icon-productos.png', label: 'Productos', route: 'Productos' },
  ];

  if (canAccessEntradas) {
    menuItems.push({ icon: '/icon-entradas.png', label: 'Entradas', route: 'Entradas' });
  }
  if (canAccessSalidas) {
    menuItems.push({ icon: '/icon-salidas.png', label: 'Salidas', route: 'Salidas' });
  }
  if (canAccessOperaciones) {
    menuItems.push({ icon: '/icon-operaciones.png', label: 'Operaciones', route: 'Operaciones' });
  }
  if (canAccessVentas) {
    menuItems.push({ icon: '/icon-ventas.png', label: 'Ventas', route: 'Ventas' });
  }
  if (canAccessMovimientos) {
    menuItems.push({ icon: '/moving.png', label: 'Movimientos', route: 'Movimientos' });
  }
  if (canAccessDeudas) {
    menuItems.push({ icon: '/debt-recovery.png', label: 'Deudas', route: 'Deudas' });
  }
  if (isAdmin) {
    menuItems.push({ icon: '/icon-tiendas.png', label: 'Tiendas', route: 'Tiendas' });
  }
  if (isAdmin) {
    menuItems.push({ icon: '/icon-usuarios.png', label: 'Usuarios', route: 'Usuarios' });
  }
  if (isAdmin) {
    menuItems.push({ icon: '/icon-admin.png', label: 'Configuraciones del Admin', route: 'CurrencyExchange' });
  }

  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-20 hidden lg:flex flex-col items-center py-24 px-3 gap-4"
      style={{
        backgroundColor: isDarkMode ? 'rgba(10, 22, 40, 0.6)' : 'rgba(245, 248, 252, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight: `1px solid ${colors.outlineVariant}20`,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {isNavigating && (
        <div className="flex flex-col items-center justify-center py-4">
          <Loader2 className="animate-spin" size={20} style={{ color: colors.primary }} />
        </div>
      )}
      {menuItems.map((item, index) => {
        const isActive = item.route === currentRoute;
        return (
          <div
            key={index}
            className="w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: isActive ? colors.primary : 'transparent',
              opacity: isActive ? 1 : isNavigating ? 0.5 : 0.7,
              pointerEvents: isNavigating ? 'none' : 'auto',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            title={item.label}
            onClick={() => handleNavigation(item.route)}
            onMouseEnter={(e) => {
              if (!isNavigating && !isActive) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Image
              src={item.icon as string}
              alt={item.label}
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
              style={{
                filter: isActive && !isDarkMode ? 'brightness(0) invert(1)' : isDarkMode ? 'brightness(0) invert(1)' : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
