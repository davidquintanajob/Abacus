'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getTiendas, deleteTienda } from '../../services/tiendaService';
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Grid,
  List,
  Store,
  AlertCircle
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export default function TiendasPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
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

  const [isLoading, setIsLoading] = useState(true);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', tipo: '', activo: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
  }, [pagination.currentPage]);

  const fetchTiendas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getTiendas(filters, pagination.currentPage, pagination.limit);

      setTiendas(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchTiendas();
  };

  const handleClearFilters = () => {
    const clearedFilters = { nombre: '', tipo: '', activo: '' };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTiendas(clearedFilters, 1, pagination.limit);
        setTiendas(data.data || []);
        setPagination(data.pagination || pagination);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    };
    fetchWithClearedFilters();
  };

  const handleDelete = (tienda: any) => {
    showConfirmDialog({
      title: 'Eliminar Tienda',
      message: `¿Estás seguro de que quieres eliminar la tienda "${tienda.nombre}"?`,
      onConfirm: () => {
        hideConfirmDialog();
        deleteTienda(tienda.id_tienda)
          .then(() => {
            showToast({ type: 'success', message: 'Tienda eliminada correctamente' });
            fetchTiendas();
          })
          .catch((err: any) => {
            showToast({ type: 'error', message: err.message, code: err.code });
          });
      },
      type: 'danger'
    });
  };

  const handleTiendaPress = (tienda: any) => {
    const mode = isAdmin ? 'edit' : 'view';
    router.push(`/tiendas/form?id=${tienda.id_tienda}&mode=${mode}`);
  };

  const handleEdit = (tienda: any, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/tiendas/form?id=${tienda.id_tienda}&mode=edit`);
  };

  const handleAdd = () => {
    router.push('/tiendas/form?mode=add');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

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
      
      {/* ConfirmDialog is now global via GlobalConfirmDialog in layout */}
      <SidebarNavigation 
        currentRoute="Tiendas" 
        ref={sidebarNavRef}
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onNotificationsPress={handleNotificationsPress}
          onProfilePress={handleProfilePress}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode === 'card' ? 'table' : 'grid'}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Tiendas"
        />

        <div style={{ 
          marginTop: '80px',
          marginRight: 'auto',
          marginBottom: '0',
          marginLeft: 'auto',
          paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
          paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingBottom: '120px',
          paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
          maxWidth: isDesktop ? '1400px' : '100%',
        }}>
          {/* Desktop Layout */}
          {isDesktop ? (
            <>
              {/* Page Title - Top Left */}
              <div className="mb-4">
                <h1 
                  className="text-2xl font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Gestión de Tiendas
                </h1>
              </div>

              {/* Filter Section - Horizontal */}
              <div 
                className="rounded-2xl p-4 mb-4 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex items-center gap-3">
                  {/* Nombre */}
                  <div className="flex-1">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Buscar por nombre..."
                      value={filters.nombre}
                      onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                    />
                  </div>

                  {/* Tipo */}
                  <div className="flex-1">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tipo
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Tipo de tienda..."
                      value={filters.tipo}
                      onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                    />
                  </div>

                  {/* Estado */}
                  <div className="flex-1">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Estado
                    </label>
                    <div className="flex gap-1">
                      <button
                        className="flex-1 rounded-lg px-2 py-2 transition-colors font-medium text-sm"
                        style={{ 
                          backgroundColor: filters.activo === '' ? '#9E9E9E' : '#E0E0E0',
                          color: filters.activo === '' ? '#fff' : '#9E9E9E'
                        }}
                        onClick={() => setFilters(prev => ({ ...prev, activo: '' }))}
                      >
                        Todos
                      </button>
                      <button
                        className="flex-1 rounded-lg px-2 py-2 transition-colors font-medium text-sm"
                        style={{ 
                          backgroundColor: filters.activo === 'true' ? '#4CAF50' : '#E0E0E0',
                          color: filters.activo === 'true' ? '#fff' : '#9E9E9E'
                        }}
                        onClick={() => setFilters(prev => ({ ...prev, activo: 'true' }))}
                      >
                        Activa
                      </button>
                      <button
                        className="flex-1 rounded-lg px-2 py-2 transition-colors font-medium text-sm"
                        style={{ 
                          backgroundColor: filters.activo === 'false' ? '#F44336' : '#E0E0E0',
                          color: filters.activo === 'false' ? '#fff' : '#9E9E9E'
                        }}
                        onClick={() => setFilters(prev => ({ ...prev, activo: 'false' }))}
                      >
                        Inactiva
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Outside filter card, smaller, side by side */}
              <div className="flex gap-3 mb-4">
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                  style={{ 
                    backgroundColor: colors.surface, 
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface
                  }}
                  onClick={handleClearFilters}
                >
                  <RefreshCw size={16} />
                  <span>Limpiar</span>
                </button>
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
                {isAdmin && (
                  <button
                    className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleAdd}
                  >
                    <Plus size={16} />
                    <span>Agregar Tienda</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Mobile/Tablet Layout - Original */}
              {/* Page Title */}
              <div className="text-center mb-6 mt-4">
                <h1 
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Gestión de Tiendas
                </h1>
              </div>

              {/* Filter Section - Wrapped to maintain compact width */}
              <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Filtros
                  </h2>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? (
                      <ChevronUp size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                    ) : (
                      <ChevronDown size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                    )}
                  </button>
                </div>

                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Buscar por nombre..."
                    value={filters.nombre}
                    onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>

                {showAdvancedFilters && (
                  <>
                    <div className="mb-4">
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Tipo
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Tipo de tienda..."
                        value={filters.tipo}
                        onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                      />
                    </div>

                    <div className="mb-4">
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Estado
                      </label>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                          style={{ 
                            backgroundColor: filters.activo === '' ? '#9E9E9E' : '#E0E0E0',
                            color: filters.activo === '' ? '#fff' : '#9E9E9E'
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, activo: '' }))}
                        >
                          Todos
                        </button>
                        <button
                          className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                          style={{ 
                            backgroundColor: filters.activo === 'true' ? '#4CAF50' : '#E0E0E0',
                            color: filters.activo === 'true' ? '#fff' : '#9E9E9E'
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, activo: 'true' }))}
                        >
                          Activa
                        </button>
                        <button
                          className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                          style={{ 
                            backgroundColor: filters.activo === 'false' ? '#F44336' : '#E0E0E0',
                            color: filters.activo === 'false' ? '#fff' : '#9E9E9E'
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, activo: 'false' }))}
                        >
                          Inactiva
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface
                    }}
                    onClick={handleClearFilters}
                  >
                    <RefreshCw size={18} />
                    <span>Limpiar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Search size={18} />
                        <span>Buscar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Add Button - Only for Admin */}
              {isAdmin && (
                <button
                  className="w-full rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 mb-6 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAdd}
                >
                  <Plus size={20} />
                  <span className="font-medium">Agregar Tienda</span>
                </button>
              )}
              </div>
            </>
          )}

          {/* Tiendas List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando tiendas...</p>
            </div>
          ) : error ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <AlertCircle size={40} style={{ color: colors.error, marginBottom: 16 }} />
              <p style={{ color: colors.onSurface, marginBottom: 16 }}>{error}</p>
              <button
                className="rounded-lg px-6 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={fetchTiendas}
              >
                Reintentar
              </button>
            </div>
          ) : tiendas.length === 0 ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Store size={60} style={{ color: colors.outline, marginBottom: 16 }} />
              <p style={{ color: colors.outline }}>No se encontraron tiendas</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                tiendas.map((tienda) => (
                  <div
                    key={tienda.id_tienda}
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleTiendaPress(tienda)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <h3 
                            className="font-semibold text-base truncate mr-2"
                            style={{ 
                              color: colors.onSurface,
                              fontFamily: 'Hanken Grotesk, sans-serif',
                              maxWidth: 'calc(100% - 80px)'
                            }}
                          >
                            {tienda.nombre.length > 15 ? tienda.nombre.substring(0, 15) + '...' : tienda.nombre}
                          </h3>
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ 
                              backgroundColor: tienda.activo ? '#E8F5E9' : '#FFEBEE',
                              color: tienda.activo ? '#2E7D32' : '#C62828',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {tienda.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                          Tipo: {tienda.tipo}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 ml-3">
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                            onClick={(e) => handleEdit(tienda, e)}
                          >
                            <Edit size={22} style={{ color: colors.primary }} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tienda);
                            }}
                          >
                            <Trash2 size={22} style={{ color: colors.error }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-lg">
                  <table className="w-full" style={{ backgroundColor: colors.surface }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.primary }}>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '250px' }}>Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Tipo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Estado</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tiendas.map((tienda, index) => (
                        <tr
                          key={tienda.id_tienda}
                          className="cursor-pointer hover:bg-black/5 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                          onClick={() => handleTiendaPress(tienda)}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {tienda.nombre}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {tienda.tipo || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: tienda.activo ? '#4CAF50' : '#F44336' }}>
                            {tienda.activo ? 'Activo' : 'Inactivo'}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => handleEdit(tienda, e)}
                                >
                                  <Edit size={18} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(tienda);
                                  }}
                                >
                                  <Trash2 size={18} style={{ color: colors.error }} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    onClick={handlePrevPage}
                    disabled={pagination.currentPage === 1}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span style={{ color: colors.onSurface }}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    onClick={handleNextPage}
                    disabled={pagination.currentPage === pagination.totalPages}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
