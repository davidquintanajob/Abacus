'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { Header } from '../../components/layout/Header';
import { Sidebar } from '../../components/layout/Sidebar';
import { Toast } from '../../components/common/Toast';
import { getServicios, deleteServicio } from '../../services/servicioService';
import { getTiendas } from '../../services/tiendaService';
import { useResponsive } from '../../hooks/useResponsive';
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
  AlertCircle,
  Tag,
  FileText
} from 'lucide-react';

export default function ServiciosPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [servicios, setServicios] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [tiendas, setTiendas] = useState<any[]>([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
    // Auto-load user's tienda if available
    if (user?.id_tienda) {
      setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
    }
    fetchServicios();
  }, [pagination.currentPage]);

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
    }
  };

  const fetchServicios = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getServicios(filters, pagination.currentPage, pagination.limit);

      setServicios(data.data || []);
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
    fetchServicios();
  };

  const handleClearFilters = () => {
    const clearedFilters = { nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getServicios(clearedFilters, 1, pagination.limit);
        setServicios(data.data || []);
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

  const handleDelete = (servicio: any) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el servicio "${servicio.nombre}"?`)) {
      deleteServicio(servicio.id_servicio)
        .then(() => {
          showToast({ type: 'success', message: 'Servicio eliminado correctamente' });
          fetchServicios();
        })
        .catch((err: any) => {
          showToast({ type: 'error', message: err.message, code: err.code });
        });
    }
  };

  const handleServicioPress = (servicio: any) => {
    const mode = isAdmin ? 'edit' : 'view';
    router.push(`/servicios/form?id=${servicio.id_servicio}&mode=${mode}`);
  };

  const handleEdit = (servicio: any, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/servicios/form?id=${servicio.id_servicio}&mode=edit`);
  };

  const handleAdd = () => {
    router.push('/servicios/form?mode=add');
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

  const handleAddOferta = () => {
    router.push('/servicios/form?mode=add&isOferta=true');
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
      
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute="Servicios"
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          onMenuPress={() => setSidebarOpen(true)}
          onThemePress={toggleTheme}
          onNotificationsPress={handleNotificationsPress}
          onProfilePress={handleProfilePress}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode === 'card' ? 'table' : 'grid'}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Servicios"
        />

        <div 
          style={{ 
            marginTop: '80px',
            marginRight: 'auto',
            marginBottom: '0',
            marginLeft: 'auto',
            paddingTop: isMobile ? '20px' : '80px',
            paddingRight: isMobile ? '20px' : '16px',
            paddingBottom: '120px',
            paddingLeft: isMobile ? '20px' : '16px',
            maxWidth: isMobile ? '100%' : '56rem',
          }}
        >
          {/* Page Title */}
          <div className="text-center mb-6 mt-4">
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Gestión de Servicios
            </h1>
          </div>

          {/* Filter Section */}
          <div 
            className="rounded-2xl p-5 mb-6 shadow-lg"
            style={{ 
              backgroundColor: colors.surface,
              padding: isMobile ? '16px' : '20px'
            }}
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
                  fontFamily: 'Inter, sans-serif',
                  fontSize: isMobile ? '14px' : '16px',
                  padding: isMobile ? '12px' : '16px'
                }}
                placeholder="Buscar por nombre..."
                value={filters.nombre}
                onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: colors.outline }}
              >
                Tienda
              </label>
              <div className="relative">
                <button
                  className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 flex justify-between items-center"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: isMobile ? '14px' : '16px',
                    padding: isMobile ? '12px' : '16px'
                  }}
                  onClick={() => setShowTiendaDropdown(!showTiendaDropdown)}
                >
                  <span>
                    {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                  </span>
                  {showTiendaDropdown ? (
                    <ChevronUp size={20} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showTiendaDropdown && (
                  <div 
                    className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                  >
                    <button
                      className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity"
                      style={{ color: colors.onSurface, fontSize: isMobile ? '14px' : '16px' }}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, id_tienda: '' }));
                        setShowTiendaDropdown(false);
                      }}
                    >
                      Todas las tiendas
                    </button>
                    {tiendas.map((tienda) => (
                      <button
                        key={tienda.id_tienda}
                        className="w-full px-4 py-3 text-left hover:opacity-80 transition-opacity"
                        style={{ color: colors.onSurface, fontSize: isMobile ? '14px' : '16px' }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                          setShowTiendaDropdown(false);
                        }}
                      >
                        {tienda.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {showAdvancedFilters && (
              <>
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Código
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: isMobile ? '14px' : '16px',
                      padding: isMobile ? '12px' : '16px'
                    }}
                    placeholder="Buscar por código..."
                    value={filters.codigo}
                    onChange={(e) => setFilters(prev => ({ ...prev, codigo: e.target.value }))}
                  />
                </div>

                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Categoría
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: isMobile ? '14px' : '16px',
                      padding: isMobile ? '12px' : '16px'
                    }}
                    placeholder="Buscar por categoría..."
                    value={filters.categoria}
                    onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
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
                        backgroundColor: filters.esvendible === '' ? '#9E9E9E' : '#E0E0E0',
                        color: filters.esvendible === '' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: '' }))}
                    >
                      Todos
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.esvendible === 'true' ? '#4CAF50' : '#E0E0E0',
                        color: filters.esvendible === 'true' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: 'true' }))}
                    >
                      Vendible
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.esvendible === 'false' ? '#F44336' : '#E0E0E0',
                        color: filters.esvendible === 'false' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: 'false' }))}
                    >
                      No vendible
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

          {/* Add Buttons - Only for Admin */}
          {isAdmin && (
            <div className="flex gap-3 mb-6">
              <button
                className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 shadow-lg"
                style={{ 
                  backgroundColor: colors.primary, 
                  color: '#fff',
                  padding: isMobile ? '12px 16px' : '16px 20px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                onClick={handleAdd}
              >
                <Plus size={isMobile ? 20 : 24} color="#fff" />
                <span className="font-medium" style={{ 
                  fontSize: isMobile ? '14px' : '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Agregar Servicio
                </span>
              </button>
              <button
                className="flex-1 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 shadow-lg"
                style={{ 
                  backgroundColor: colors.primary, 
                  color: '#fff',
                  padding: isMobile ? '12px 16px' : '16px 20px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                onClick={handleAddOferta}
              >
                <Plus size={isMobile ? 20 : 24} color="#fff" />
                <span className="font-medium" style={{ 
                  fontSize: isMobile ? '14px' : '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Agregar Servicio (Oferta)
                </span>
              </button>
            </div>
          )}

          {/* Servicios List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando servicios...</p>
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
                onClick={fetchServicios}
              >
                Reintentar
              </button>
            </div>
          ) : servicios.length === 0 ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
              <p style={{ color: colors.outline }}>No se encontraron servicios</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                servicios.map((servicio) => (
                  <div
                    key={servicio.id_servicio}
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3 relative"
                    style={{ 
                      backgroundColor: colors.surface,
                      padding: isMobile ? '12px' : '16px'
                    }}
                    onClick={() => handleServicioPress(servicio)}
                  >
                    {/* Offer Flag */}
                    {servicio.componentes && servicio.componentes.length > 0 && (
                      <div 
                        className="absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center z-10"
                        style={{ backgroundColor: '#4CAF50' }}
                      >
                        <Tag size={14} color="#fff" />
                      </div>
                    )}
                    
                    {/* Note Flag */}
                    {servicio.nota && (
                      <div 
                        className="absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center z-10"
                        style={{ backgroundColor: '#2196F3' }}
                      >
                        <FileText size={14} color="#fff" />
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-16">
                        <div className="flex items-center mb-3">
                          <h3 
                            className="font-semibold text-base truncate mr-2 md:truncate-none"
                            style={{ 
                              color: colors.onSurface,
                              fontFamily: 'Hanken Grotesk, sans-serif',
                              maxWidth: 'calc(100% - 80px)'
                            }}
                          >
                            {servicio.nombre}
                          </h3>
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ 
                              backgroundColor: servicio.esvendible ? '#E8F5E9' : '#FFEBEE',
                              color: servicio.esvendible ? '#2E7D32' : '#C62828',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {servicio.esvendible ? 'Vendible' : 'No vendible'}
                          </span>
                        </div>
                        <p className="text-sm mb-2 w-full" style={{ 
                          color: colors.outline, 
                          fontFamily: 'Inter, sans-serif',
                          textAlign: 'left'
                        }}>
                          Categoría: {servicio.categoria}
                        </p>
                        {filters.id_tienda && (
                          <>
                            <p className="text-sm font-medium" style={{ 
                              color: colors.primary, 
                              fontFamily: 'Inter, sans-serif',
                              textAlign: 'left'
                            }}>
                              Precio CUP: ${servicio.tiendas_servicio?.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda))?.precio_cup || servicio.tiendas_servicio?.[0]?.precio_cup || '0'}
                            </p>
                            <p className="text-sm font-medium" style={{ 
                              color: colors.primary, 
                              fontFamily: 'Inter, sans-serif',
                              textAlign: 'left'
                            }}>
                              Precio USD: ${servicio.tiendas_servicio?.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda))?.precio_usd || servicio.tiendas_servicio?.[0]?.precio_usd || '0'}
                            </p>
                          </>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                            onClick={(e) => handleEdit(servicio, e)}
                          >
                            <img src="/editar.png" alt="Editar" className="w-5 h-5" />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(servicio);
                            }}
                          >
                            <img src="/basura.png" alt="Eliminar" className="w-5 h-5" />
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Categoría</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Estado</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Precio CUP</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Precio USD</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {servicios.map((servicio, index) => (
                        <tr
                          key={servicio.id_servicio}
                          className="cursor-pointer hover:bg-black/5 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                          onClick={() => handleServicioPress(servicio)}
                        >
                          <td className="px-4 py-3 text-sm relative" style={{ color: colors.onSurface }}>
                            <div className="flex items-center gap-2">
                              {servicio.componentes && servicio.componentes.length > 0 && (
                                <div 
                                  className="w-5 h-5 rounded flex items-center justify-center"
                                  style={{ backgroundColor: '#4CAF50' }}
                                >
                                  <Tag size={12} color="#fff" />
                                </div>
                              )}
                              {servicio.nota && (
                                <div 
                                  className="w-5 h-5 rounded flex items-center justify-center"
                                  style={{ backgroundColor: '#2196F3' }}
                                >
                                  <FileText size={12} color="#fff" />
                                </div>
                              )}
                              {servicio.nombre}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {servicio.categoria || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: servicio.esvendible ? '#4CAF50' : '#F44336' }}>
                            {servicio.esvendible ? 'Vendible' : 'No vendible'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: colors.primary }}>
                            ${servicio.tiendas_servicio?.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda))?.precio_cup || servicio.tiendas_servicio?.[0]?.precio_cup || '0'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: colors.primary }}>
                            ${servicio.tiendas_servicio?.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda))?.precio_usd || servicio.tiendas_servicio?.[0]?.precio_usd || '0'}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => handleEdit(servicio, e)}
                                >
                                  <Edit size={18} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(servicio);
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
                    <span className="text-xl font-bold">&lt;</span>
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
                    <span className="text-xl font-bold">&gt;</span>
                  </button>
                </div>
              )}

              {/* Total Count */}
              <div className="text-center mt-4">
                <span style={{ color: colors.outline, fontSize: '14px' }}>
                  Total: {pagination.totalItems} servicios
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
