'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface IconStripProps {
  onHover: () => void;
  onLeave: () => void;
  currentRoute?: string;
}

export const IconStrip = ({ onHover, onLeave, currentRoute = 'Home' }: IconStripProps) => {
  const { colors, isDark } = useTheme();
  const { user, permissions, entradaAccessLevels, salidaAccessLevels, operacionAccessLevels } = useAuth();

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

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
      {menuItems.map((item, index) => {
        const isActive = item.route === currentRoute;
        return (
          <div
            key={index}
            className="w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: isActive ? colors.primary : 'transparent',
              opacity: isActive ? 1 : 0.7,
            }}
            title={item.label}
          >
            <Image
              src={item.icon as string}
              alt={item.label}
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
              style={{
                filter: isActive && !isDarkMode ? 'brightness(0) invert(1)' : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
