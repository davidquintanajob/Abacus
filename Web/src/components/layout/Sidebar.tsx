'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { X, LogOut, Loader2 } from 'lucide-react';
import { Toast } from '../common/Toast';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentRoute?: string;
  hoverTriggered?: boolean;
  onSidebarEnter?: () => void;
  onSidebarLeave?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose, currentRoute = 'Home', hoverTriggered = false, onSidebarEnter, onSidebarLeave }: SidebarProps) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, permissions, entradaAccessLevels, salidaAccessLevels, operacionAccessLevels, logout } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog } = useConfirmDialog();
  const { isLoading: isNavigating, setLoading: setNavigating } = useNavigationLoading();
  const [isSyncing, setIsSyncing] = useState(false);

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

  const menuItems = [
    { icon: '/icon-panel.png', label: 'Panel', route: 'Home' },
    { icon: '/icon-servicios.png', label: 'Servicios y Ofertas', route: 'Servicios' },
    { icon: '/icon-productos.png', label: 'Productos', route: 'Productos' },
    ...(canAccessEntradas ? [{ icon: '/icon-entradas.png', label: 'Entradas', route: 'Entradas' }] : []),
    ...(canAccessSalidas ? [{ icon: '/icon-salidas.png', label: 'Salidas', route: 'Salidas' }] : []),
    ...(canAccessOperaciones ? [{ icon: '/icon-operaciones.png', label: 'Operaciones', route: 'Operaciones' }] : []),
    ...(isAdmin ? [{ icon: '/icon-tiendas.png', label: 'Tiendas', route: 'Tiendas' }] : []),
    ...(isAdmin ? [{ icon: '/icon-usuarios.png', label: 'Usuarios', route: 'Usuarios' }] : []),
    ...(isAdmin ? [{ icon: '/icon-admin.png', label: 'Configuraciones del Admin', route: 'CurrencyExchange' }] : []),
  ];

  const handleLogout = async () => {
    showConfirmDialog({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      onConfirm: async () => {
        try {
          setIsSyncing(true);
          await logout();
          onClose?.();
          router.push('/login');
        } catch (error: any) {
          setIsSyncing(false);
          showToast({ type: 'error', message: 'No se pudo cerrar sesión', code: error.code ?? null });
        }
      },
      type: 'warning'
    });
  };

  const handleNavigation = (route: string) => {
    if (isNavigating) return;
    
    setNavigating(true);
    onClose?.();
    // Mapeo de rutas a URLs de Next.js
    const routeMap: Record<string, string> = {
      'Home': '/',
      'Servicios': '/servicios',
      'Productos': '/productos',
      'Entradas': '/entradas',
      'Salidas': '/salidas',
      'Operaciones': '/operaciones',
      'Tiendas': '/tiendas',
      'Usuarios': '/usuarios',
      'CurrencyExchange': '/configuracion',
      'Profile': '/profile',
    };
    
    if (routeMap[route]) {
      router.push(routeMap[route]);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      {/* Overlay - only show when not hover-triggered */}
      {!hoverTriggered && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out"
          style={{
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 w-80 rounded-r-2xl shadow-2xl flex flex-col pt-6 px-4 pb-4 transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: colors.surfaceContainer,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isOpen ? 1 : 0,
        }}
        onMouseEnter={onSidebarEnter}
        onMouseLeave={onSidebarLeave}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-2xl font-bold"
            style={{ color: colors.primary }}
          >
            Abacus
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/5 transition-colors"
          >
            <X size={20} style={{ color: colors.outline }} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {isNavigating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" size={24} style={{ color: colors.primary }} />
              <span className="ml-2 text-sm" style={{ color: colors.onSurfaceVariant }}>Cargando...</span>
            </div>
          )}
          {menuItems.map((item, index) => {
            const isActive = item.route === currentRoute;
            return (
              <button
                key={index}
                onClick={() => handleNavigation(item.route)}
                disabled={isNavigating}
                className={`
                  w-full flex items-center gap-4 px-4 py-3 rounded-full mb-1 transition-colors
                  ${isActive ? '' : 'hover:bg-black/5'}
                `}
                style={{
                  backgroundColor: isActive ? colors.primary : 'transparent',
                  opacity: isNavigating ? 0.5 : 1,
                  cursor: isNavigating ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
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
                <div className="w-8 h-8 flex items-center justify-center">
                  <Image
                    src={item.icon as string}
                    alt={item.label}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                    style={{
                      filter: isActive && !isDarkMode ? 'brightness(0) invert(1)' : isDarkMode ? 'brightness(0) invert(1)' : 'none',
                    }}
                  />
                </div>
                <span
                  className="text-sm font-medium"
                  style={{
                    color: isActive ? colors.onPrimary : colors.onSurfaceVariant,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="pt-4 border-t"
          style={{ borderColor: colors.outlineVariant }}
        >
          <button
            onClick={handleLogout}
            disabled={isSyncing}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-full mb-2 transition-colors hover:bg-black/5 disabled:opacity-50"
          >
            {isSyncing ? (
              <div className="w-6 h-6 animate-spin rounded-full border-2 border-t-2" style={{ borderColor: colors.error, borderTopColor: 'transparent' }} />
            ) : (
              <LogOut size={24} style={{ color: colors.error }} />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: colors.error }}
            >
              {isSyncing ? 'Sincronizando...' : 'Cerrar Sesión'}
            </span>
          </button>
          <p
            className="text-xs text-center"
            style={{ color: colors.outline }}
          >
            v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
};