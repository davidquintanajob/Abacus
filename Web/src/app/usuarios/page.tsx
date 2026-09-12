'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getUsuarios, deleteUsuario } from '../../services/usuarioService';
import { getTiendas } from '../../services/tiendaService';
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
  Users,
  AlertCircle,
  X
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export default function UsuariosPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user, permissions } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre_natural: '', nombre_usuario: '', rol: '', activo: '', id_tienda: '' });
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showRolDropdown, setShowRolDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [pagination.currentPage]);

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const fetchUsuarios = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getUsuarios(filters, pagination.currentPage, pagination.limit);

      // Filter out current user from the list
      let filteredUsuarios = (data.data || []).filter((u: any) => u.id_usuario !== user?.id_usuario);

      // Apply store visibility permissions
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      // If user cannot view all stores, filter to show only users from their own store
      if (!canViewAllStores && user?.id_tienda) {
        filteredUsuarios = filteredUsuarios.filter((u: any) => u.id_tienda === user.id_tienda);
      }

      setUsuarios(filteredUsuarios);
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
    fetchUsuarios();
  };

  const handleClearFilters = () => {
    const clearedFilters = { nombre_natural: '', nombre_usuario: '', rol: '', activo: '', id_tienda: '' };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getUsuarios(clearedFilters, 1, pagination.limit);
        
        let filteredUsuarios = (data.data || []).filter((u: any) => u.id_usuario !== user?.id_usuario);

        const userRole = user?.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        if (!canViewAllStores && user?.id_tienda) {
          filteredUsuarios = filteredUsuarios.filter((u: any) => u.id_tienda === user.id_tienda);
        }

        setUsuarios(filteredUsuarios);
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

  const handleDelete = (usuario: any) => {
    if (confirm(`¿Estás seguro de que quieres eliminar al usuario "${usuario.nombre_natural}"?`)) {
      deleteUsuario(usuario.id_usuario)
        .then(() => {
          showToast({ type: 'success', message: 'Usuario eliminado correctamente' });
          fetchUsuarios();
        })
        .catch((err: any) => {
          showToast({ type: 'error', message: err.message, code: err.code });
        });
    }
  };

  const handleUsuarioPress = (usuario: any) => {
    const mode = isAdmin ? 'edit' : 'view';
    router.push(`/usuarios/form?id=${usuario.id_usuario}&mode=${mode}`);
  };

  const handleEdit = (usuario: any, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/usuarios/form?id=${usuario.id_usuario}&mode=edit`);
  };

  const handleAdd = () => {
    router.push('/usuarios/form?mode=add');
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

  const filteredTiendas = tiendas.filter((tienda: any) =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

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
      
      <SidebarNavigation 
        currentRoute="Usuarios" 
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
          currentRoute="Usuarios"
        />

        <div style={{ 
          marginTop: '80px',
          marginRight: 'auto',
          marginBottom: '0',
          marginLeft: 'auto',
          paddingTop: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingBottom: '120px',
          paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
          maxWidth: isDesktop ? '1400px' : '100%',
        }}>
          {/* Page Title */}
          <div className="text-center mb-6 mt-4">
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Gestión de Usuarios
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
                value={filters.nombre_natural}
                onChange={(e) => setFilters(prev => ({ ...prev, nombre_natural: e.target.value }))}
              />
            </div>

            {showAdvancedFilters && (
              <>
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Usuario
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
                    placeholder="Nombre de usuario..."
                    value={filters.nombre_usuario}
                    onChange={(e) => setFilters(prev => ({ ...prev, nombre_usuario: e.target.value }))}
                  />
                </div>

                <div className="mb-4 relative">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Rol
                  </label>
                  <button
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant 
                    }}
                    onClick={() => setShowRolDropdown(!showRolDropdown)}
                  >
                    <span style={{ color: filters.rol ? colors.onSurface : colors.outline }}>
                      {filters.rol || 'Todos los roles'}
                    </span>
                    {showRolDropdown ? (
                      <ChevronUp size={20} style={{ color: colors.outline }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </button>
                  
                  {showRolDropdown && (
                    <div 
                      className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <button
                        className="w-full px-4 py-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, rol: '' }));
                          setShowRolDropdown(false);
                        }}
                      >
                        Todos los roles
                      </button>
                      {["Administrador", "Dependiente", "Almacenero", "Económico"].map((role) => (
                        <button
                          key={role}
                          className="w-full px-4 py-3 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, rol: role }));
                            setShowRolDropdown(false);
                          }}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4 relative">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Tienda
                  </label>
                  <button
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant 
                    }}
                    onClick={() => setShowTiendaDropdown(!showTiendaDropdown)}
                  >
                    <span style={{ color: filters.id_tienda ? colors.onSurface : colors.outline }}>
                      {tiendas.find((t: any) => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                    </span>
                    {showTiendaDropdown ? (
                      <ChevronUp size={20} style={{ color: colors.outline }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </button>
                  
                  {showTiendaDropdown && (
                    <div 
                      className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <div className="px-3 py-2">
                        <div className="flex items-center border rounded-lg px-3 py-2" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}>
                          <Search size={18} style={{ color: colors.outline, marginRight: 8 }} />
                          <input
                            type="text"
                            className="flex-1 bg-transparent outline-none"
                            style={{ color: colors.onSurface }}
                            placeholder="Buscar tienda..."
                            value={tiendaSearchText}
                            onChange={(e) => setTiendaSearchText(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        className="w-full px-4 py-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, id_tienda: '' }));
                          setShowTiendaDropdown(false);
                          setTiendaSearchText('');
                        }}
                      >
                        Todas las tiendas
                      </button>
                      {filteredTiendas.length > 0 ? (
                        filteredTiendas.map((tienda: any, index: number) => (
                          <button
                            key={tienda.id_tienda}
                            className="w-full px-4 py-3 text-left hover:bg-black/5"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                              setShowTiendaDropdown(false);
                              setTiendaSearchText('');
                            }}
                          >
                            {tienda.nombre}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3" style={{ color: colors.outline }}>
                          No se encontraron tiendas
                        </div>
                      )}
                    </div>
                  )}
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
                      Activo
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.activo === 'false' ? '#F44336' : '#E0E0E0',
                        color: filters.activo === 'false' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, activo: 'false' }))}
                    >
                      Inactivo
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
              <span className="font-medium">Agregar Usuario</span>
            </button>
          )}
          </div>

          {/* Usuarios List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando usuarios...</p>
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
                onClick={fetchUsuarios}
              >
                Reintentar
              </button>
            </div>
          ) : usuarios.length === 0 ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Users size={60} style={{ color: colors.outline, marginBottom: 16 }} />
              <p style={{ color: colors.outline }}>No se encontraron usuarios</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                usuarios.map((usuario) => (
                  <div
                    key={usuario.id_usuario}
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleUsuarioPress(usuario)}
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
                            {usuario.nombre_natural.length > 15 ? usuario.nombre_natural.substring(0, 15) + '...' : usuario.nombre_natural}
                          </h3>
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ 
                              backgroundColor: usuario.activo ? '#E8F5E9' : '#FFEBEE',
                              color: usuario.activo ? '#2E7D32' : '#C62828',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        {usuario.tienda && (
                          <p className="text-sm mb-1" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                            Tienda: {usuario.tienda.nombre}
                          </p>
                        )}
                        {usuario.rol && (
                          <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                            Rol: {usuario.rol}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 ml-3">
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                            onClick={(e) => handleEdit(usuario, e)}
                          >
                            <Edit size={22} style={{ color: colors.primary }} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(usuario);
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Tienda</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Rol</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Estado</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario, index) => (
                        <tr
                          key={usuario.id_usuario}
                          className="cursor-pointer hover:bg-black/5 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                          onClick={() => handleUsuarioPress(usuario)}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {usuario.nombre_natural}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {usuario.tienda?.nombre || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {usuario.rol || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: usuario.activo ? '#4CAF50' : '#F44336' }}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => handleEdit(usuario, e)}
                                >
                                  <Edit size={18} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(usuario);
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
