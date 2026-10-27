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
import { getMovimientos, deleteMovimiento, updateMovimiento } from '../../services/movimientoService';
import { getTiendas } from '../../services/tiendaService';
import { getUsuarios } from '../../services/usuarioService';
import { configService } from '../../services/configService';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  ArrowRightLeft, 
  CheckCircle, 
  Edit, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Bell, 
  FileText, 
  Download, 
  X 
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export default function MovimientosPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user, movimientoAccessLevels, movimientoManagePermissions } = useAuth();
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
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isInitializedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  // Filter states
  const getCubaDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getCubaDateDaysAgo = (daysAgo: number) => {
    const now = new Date();
    now.setDate(now.getDate() - daysAgo);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const today = getCubaDate();
  const sevenDaysAgo = getCubaDateDaysAgo(6);
  
  const [filters, setFilters] = useState({ 
    tipo_movimiento: '', 
    estado: '', 
    fecha_desde: sevenDaysAgo, 
    fecha_hasta: today, 
    id_tienda_origen: '', 
    id_tienda_destino: '',
    id_usuario: ''
  });

  const [tiendas, setTiendas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaOrigenDropdown, setShowTiendaOrigenDropdown] = useState(false);
  const [showTiendaDestinoDropdown, setShowTiendaDestinoDropdown] = useState(false);
  const [tiendaOrigenSearchText, setTiendaOrigenSearchText] = useState('');
  const [tiendaDestinoSearchText, setTiendaDestinoSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [showEstadoDropdown, setShowEstadoDropdown] = useState(false);
  const [showTipoMovimientoDropdown, setShowTipoMovimientoDropdown] = useState(false);
  const [tipoMovimientoSearchText, setTipoMovimientoSearchText] = useState('');
  const [isCompletingMovimiento, setIsCompletingMovimiento] = useState(false);

  const predefinedMovimientoTypes = ['Transferencia', 'Ajuste', 'Devolucion'];
  const [customMovimientoTypes, setCustomMovimientoTypes] = useState<string[]>([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();
  const userTiendaId = user?.id_tienda;
  
  // Verificar nivel de acceso a movimientos
  const movimientoAccessLevel = 
    userRole === 'dependiente' ? movimientoAccessLevels?.dependiente :
    userRole === 'almacenero' ? movimientoAccessLevels?.almacenero :
    userRole === 'económico' ? movimientoAccessLevels?.economico : 'all_stores';
  
  const canManageAllTiendas = isAdmin || movimientoAccessLevel === 'all_stores';
  const canManageOwnTienda = movimientoAccessLevel === 'own_store';
  const shouldHideTiendaFilters = canManageOwnTienda && !canManageAllTiendas;

  // Load custom movimiento types
  useEffect(() => {
    const loadCustomMovimientoTypes = async () => {
      try {
        const config = await configService.getConfig();
        if (config.customMovimientoTypes) {
          setCustomMovimientoTypes(config.customMovimientoTypes);
        }
      } catch (error) {
        console.error('Error loading custom movimiento types:', error);
      }
    };
    loadCustomMovimientoTypes();
  }, []);

  // Initialize
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Single API call when all data is ready
  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current) {
      fetchMovimientos();
      fetchAllTiendas();
      fetchAllUsers();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchMovimientos();
    }
  }, [pagination.currentPage]);

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
      setHasLoadedAllTiendas(true);
    } catch (err) {
      setTiendas([]);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
      setHasLoadedAllUsers(true);
    } catch (err) {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchMovimientos = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      const filtersToUse = overrideFilters || filters;
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      // Build filters to send to API
      const apiFilters = { ...filtersToUse };

      // Apply movement access level filters
      if (!isAdmin && movimientoAccessLevels) {
        const accessLevel = 
          userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
          userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
          userRole === 'económico' ? movimientoAccessLevels.economico : 'none';
      }

      // Remove estado filter if empty
      if (apiFilters.estado === '' || apiFilters.estado === null || apiFilters.estado === undefined) {
        delete apiFilters.estado;
      }

      const data = await getMovimientos(apiFilters, fetchPage, fetchLimit);
      let movimientosList = data.data || [];

      // Additional client-side filtering if needed
      if (!isAdmin && movimientoAccessLevels && userTiendaId) {
        const accessLevel = 
          userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
          userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
          userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

        if (accessLevel === 'own_store') {
          movimientosList = movimientosList.filter((movimiento: any) => {
            const origenTiendaId = movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda;
            const destinoTiendaId = movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda;
            return origenTiendaId === userTiendaId || destinoTiendaId === userTiendaId;
          });
        }
      }

      setMovimientos(movimientosList);
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
    fetchMovimientos();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      tipo_movimiento: '', 
      estado: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      id_tienda_origen: '', 
      id_tienda_destino: '',
      id_usuario: ''
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchMovimientos(null, clearedFilters);
  };

  const handleDelete = (movimiento: any) => {
    showConfirmDialog({
      title: 'Eliminar Movimiento',
      message: '¿Estás seguro de que quieres eliminar este movimiento?',
      onConfirm: async () => {
        try {
          hideConfirmDialog();
          await deleteMovimiento(movimiento.id_movimiento_lista);
          showToast({ type: 'success', message: 'Movimiento eliminado correctamente' });
          fetchMovimientos();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message });
        }
      },
      type: 'danger'
    });
  };

  const handleCompleteMovimiento = async (movimiento: any) => {
    showConfirmDialog({
      title: 'Completar Movimiento',
      message: '¿Estás seguro de que quieres completar este movimiento? Esto moverá el stock de la tienda origen a la tienda destino.',
      onConfirm: async () => {
        try {
          hideConfirmDialog();
          setIsCompletingMovimiento(true);
          const idUsuario = parseInt(user?.id_usuario);
          
          const updateData = {
            estado: true,
            id_usuario: idUsuario,
            tipo_movimiento: movimiento.tipo_movimiento,
            nota: movimiento.nota || '',
            id_tienda_origen: movimiento.id_tienda_origen || movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda,
            id_tienda_destino: movimiento.id_tienda_destino || movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda,
            movimientos: (movimiento.movimientos || []).map((mov: any) => ({
              id_servicio: mov.servicio?.id_servicio || mov.id_servicio,
              cantidad: mov.cantidad,
              nota: mov.nota || '',
            })),
          };
          
          await updateMovimiento(movimiento.id_movimiento_lista, updateData);
          showToast({ type: 'success', message: 'Movimiento completado correctamente' });
          fetchMovimientos();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message });
        } finally {
          setIsCompletingMovimiento(false);
        }
      },
      type: 'warning'
    });
  };

  // Helper functions for permission-based button visibility
  const canManageMovimientos = () => {
    const userRole = user?.rol?.toLowerCase();
    const isAdmin = userRole === 'administrador';

    if (isAdmin) {
      return true;
    }

    if (!movimientoManagePermissions) {
      return false;
    }

    const canManage = 
      userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
      userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
      userRole === 'económico' ? movimientoManagePermissions.economico : false;

    return canManage;
  };

  const canShowEditDeleteButtons = (movimiento: any) => {
    const userRole = user?.rol?.toLowerCase();
    const isAdmin = userRole === 'administrador';
    const userTiendaId = user?.id_tienda;

    if (isAdmin) {
      return true;
    }

    if (!movimientoManagePermissions) {
      return false;
    }

    const canManage = 
      userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
      userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
      userRole === 'económico' ? movimientoManagePermissions.economico : false;

    if (!canManage) {
      return false;
    }

    const accessLevel = 
      userRole === 'dependiente' ? movimientoAccessLevels?.dependiente :
      userRole === 'almacenero' ? movimientoAccessLevels?.almacenero :
      userRole === 'económico' ? movimientoAccessLevels?.economico : 'none';

    if (accessLevel === 'own_store' && userTiendaId) {
      const origenTiendaId = movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda;
      const destinoTiendaId = movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda;
      return origenTiendaId === userTiendaId || destinoTiendaId === userTiendaId;
    }

    return true;
  };

  const canShowCompleteButton = (movimiento: any) => {
    if (movimiento.estado) return false; // Already completed
    return canShowEditDeleteButtons(movimiento);
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: colors.background }}
    >
      <Header 
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onProfilePress={() => router.push('/profile')}
        onNotificationsPress={() => {}}
        onViewModeToggle={toggleViewMode}
        showViewToggle={true}
        viewMode={viewMode === 'card' ? 'table' : 'grid'}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <SidebarNavigation 
        ref={sidebarNavRef}
        currentRoute="Movimientos"
      />

      <div style={{ 
        marginTop: '80px',
        marginRight: 'auto',
        marginBottom: '0',
        marginLeft: isDesktop ? '120px' : 'auto',
        paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
        paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingBottom: '40px',
        paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
        maxWidth: isDesktop ? '1400px' : '100%',
      }}>
        {/* Page Title */}
        <h1
          className={isDesktop ? '' : 'text-center'}
          style={{
            color: colors.onSurface,
            fontSize: isDesktop ? '32px' : isTablet ? '28px' : '24px',
            fontWeight: 'bold',
            fontFamily: 'Hanken Grotesk, sans-serif'
          }}
        >
          Gestión de Movimientos
        </h1>

        {/* Filter Section */}
        {isDesktop ? (
          <>
            {/* Desktop: Horizontal filters without title and collapsible */}
            <div 
              className="rounded-2xl p-4 mb-4 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tipo de Movimiento */}
                <div className="flex-1 min-w-[200px]">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Tipo de Movimiento
                  </label>
                  <div className="relative">
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.tipo_movimiento ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowTipoMovimientoDropdown(!showTipoMovimientoDropdown)}
                    >
                      <span>{filters.tipo_movimiento || 'Todos'}</span>
                      {showTipoMovimientoDropdown ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
                    </button>
                    {showTipoMovimientoDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, tipo_movimiento: '' });
                            setShowTipoMovimientoDropdown(false);
                            setTipoMovimientoSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, tipo_movimiento: '' });
                          }}
                        >
                          Todos
                        </button>
                        {[...predefinedMovimientoTypes, ...customMovimientoTypes]
                          .filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase()))
                          .map((type) => (
                            <button
                              key={type}
                              className="w-full px-3 py-2 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setFilters({ ...filters, tipo_movimiento: type });
                                setShowTipoMovimientoDropdown(false);
                                setTipoMovimientoSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos({ ...filters, tipo_movimiento: type });
                              }}
                            >
                              {type}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estado */}
                <div className="flex-1 min-w-[150px]">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Estado
                  </label>
                  <div className="relative">
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.estado !== '' ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowEstadoDropdown(!showEstadoDropdown)}
                    >
                      <span>{filters.estado === '' ? 'Todos' : filters.estado === 'true' ? 'Completado' : 'Pendiente'}</span>
                      {showEstadoDropdown ? <ChevronUp size={16} color={colors.outline} /> : <ChevronDown size={16} color={colors.outline} />}
                    </button>
                    {showEstadoDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-10"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, estado: '' });
                            setShowEstadoDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, estado: '' });
                          }}
                        >
                          Todos
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, estado: true });
                            setShowEstadoDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, estado: true });
                          }}
                        >
                          Completado
                        </button>
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, estado: false });
                            setShowEstadoDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, estado: false });
                          }}
                        >
                          Pendiente
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Usuario */}
                <div className="flex-1 min-w-[200px] relative">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Usuario
                  </label>
                  <button
                    className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant,
                      color: filters.id_usuario ? colors.onSurface : colors.outline
                    }}
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                  >
                    <span>{users.find(u => u.id_usuario.toString() === filters.id_usuario)?.nombre_natural || 'Todos'}</span>
                    {showUserDropdown ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
                  </button>
                  {showUserDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <button
                        className="w-full px-3 py-2 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, id_usuario: '' });
                          setShowUserDropdown(false);
                          setUserSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, id_usuario: '' });
                        }}
                      >
                        Todos
                      </button>
                      {users
                        .filter(u => u.nombre_natural.toLowerCase().includes(userSearchText.toLowerCase()))
                        .map((userItem) => (
                          <button
                            key={userItem.id_usuario}
                            className="w-full px-3 py-2 text-left hover:bg-black/5"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setFilters({ ...filters, id_usuario: userItem.id_usuario.toString() });
                              setShowUserDropdown(false);
                              setUserSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchMovimientos({ ...filters, id_usuario: userItem.id_usuario.toString() });
                            }}
                          >
                            {userItem.nombre_natural}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Tienda Origen */}
                {!shouldHideTiendaFilters && (
                  <div className="flex-1 min-w-[200px] relative">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tienda Origen
                    </label>
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.id_tienda_origen ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowTiendaOrigenDropdown(!showTiendaOrigenDropdown)}
                    >
                      <span>{tiendas.find(t => t.id_tienda.toString() === filters.id_tienda_origen)?.nombre || 'Todas'}</span>
                      {showTiendaOrigenDropdown ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
                    </button>
                    {showTiendaOrigenDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, id_tienda_origen: '' });
                            setShowTiendaOrigenDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, id_tienda_origen: '' });
                          }}
                        >
                          Todas
                        </button>
                        {tiendas
                          .filter(t => t.nombre.toLowerCase().includes(tiendaOrigenSearchText.toLowerCase()))
                          .map((tienda) => (
                            <button
                              key={tienda.id_tienda}
                              className="w-full px-3 py-2 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda_origen: tienda.id_tienda.toString() });
                                setShowTiendaOrigenDropdown(false);
                                setTiendaOrigenSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos({ ...filters, id_tienda_origen: tienda.id_tienda.toString() });
                              }}
                            >
                              {tienda.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tienda Destino */}
                {!shouldHideTiendaFilters && (
                  <div className="flex-1 min-w-[200px] relative">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tienda Destino
                    </label>
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.id_tienda_destino ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowTiendaDestinoDropdown(!showTiendaDestinoDropdown)}
                    >
                      <span>{tiendas.find(t => t.id_tienda.toString() === filters.id_tienda_destino)?.nombre || 'Todas'}</span>
                      {showTiendaDestinoDropdown ? <ChevronUp size={16} color={colors.primary} /> : <ChevronDown size={16} color={colors.primary} />}
                    </button>
                    {showTiendaDestinoDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg border z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full px-3 py-2 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, id_tienda_destino: '' });
                            setShowTiendaDestinoDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, id_tienda_destino: '' });
                          }}
                        >
                          Todas
                        </button>
                        {tiendas
                          .filter(t => t.nombre.toLowerCase().includes(tiendaDestinoSearchText.toLowerCase()))
                          .map((tienda) => (
                            <button
                              key={tienda.id_tienda}
                              className="w-full px-3 py-2 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda_destino: tienda.id_tienda.toString() });
                                setShowTiendaDestinoDropdown(false);
                                setTiendaDestinoSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos({ ...filters, id_tienda_destino: tienda.id_tienda.toString() });
                              }}
                            >
                              {tienda.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Fecha Desde y Fecha Hasta */}
                <div className="flex gap-3">
                  <div className="min-w-[150px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Fecha Desde
                    </label>
                    <input
                      type="date"
                      value={filters.fecha_desde}
                      onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 border"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface
                      }}
                    />
                  </div>

                  <div className="min-w-[150px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Fecha Hasta
                    </label>
                    <input
                      type="date"
                      value={filters.fecha_hasta}
                      onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 border"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: Buttons outside filter card */}
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
                className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                <span>Buscar</span>
              </button>
              {isDesktop && canManageMovimientos() && (
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={() => router.push('/movimientos/create')}
                >
                  <Plus size={16} />
                  <span>Agregar Movimiento</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Mobile/Tablet: Original collapsible filters */}
            <div 
              className="rounded-2xl p-5 mb-6 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 style={{ color: colors.onSurface, fontSize: '18px', fontWeight: '600' }}>Filtros</h2>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                    borderColor: colors.primary
                  }}
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  {showAdvancedFilters ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                </button>
              </div>

              {/* Tipo de Movimiento */}
              <div className="mb-4">
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tipo de Movimiento</label>
                <div className="relative">
                  <button
                    className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant,
                      color: filters.tipo_movimiento ? colors.onSurface : colors.outline
                    }}
                    onClick={() => setShowTipoMovimientoDropdown(!showTipoMovimientoDropdown)}
                  >
                    <span>{filters.tipo_movimiento || 'Todos'}</span>
                    {showTipoMovimientoDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                    </button>
                  {showTipoMovimientoDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <button
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, tipo_movimiento: '' });
                          setShowTipoMovimientoDropdown(false);
                          setTipoMovimientoSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, tipo_movimiento: '' });
                        }}
                      >
                        Todos
                      </button>
                      {[...predefinedMovimientoTypes, ...customMovimientoTypes]
                        .filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase()))
                        .map((type) => (
                          <button
                            key={type}
                            className="w-full p-3 text-left hover:bg-black/5"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setFilters({ ...filters, tipo_movimiento: type });
                              setShowTipoMovimientoDropdown(false);
                              setTipoMovimientoSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchMovimientos({ ...filters, tipo_movimiento: type });
                            }}
                          >
                            {type}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <>
              {/* Estado */}
              <div className="mb-4">
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Estado</label>
                <div className="relative">
                  <button
                    className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant,
                      color: filters.estado !== '' ? colors.onSurface : colors.outline
                    }}
                    onClick={() => setShowEstadoDropdown(!showEstadoDropdown)}
                  >
                    <span>{filters.estado === '' ? 'Todos' : filters.estado === 'true' ? 'Completado' : 'Pendiente'}</span>
                    {showEstadoDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                  </button>
                  {showEstadoDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <button
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, estado: '' });
                          setShowEstadoDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, estado: '' });
                        }}
                      >
                        Todos
                      </button>
                      <button
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, estado: true });
                          setShowEstadoDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, estado: true });
                        }}
                      >
                        Completado
                      </button>
                      <button
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, estado: false });
                          setShowEstadoDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, estado: false });
                        }}
                      >
                        Pendiente
                      </button>
                    </div>
                  )}
                </div>
              </div>


              {/* Tienda Origen */}
              {!shouldHideTiendaFilters && (
                <div className="mb-4">
                  <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tienda Origen</label>
                  <div className="relative">
                    <button
                      className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.id_tienda_origen ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowTiendaOrigenDropdown(!showTiendaOrigenDropdown)}
                    >
                      <span>{tiendas.find(t => t.id_tienda.toString() === filters.id_tienda_origen)?.nombre || 'Todas'}</span>
                      {showTiendaOrigenDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                    </button>
                    {showTiendaOrigenDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full p-3 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, id_tienda_origen: '' });
                            setShowTiendaOrigenDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, id_tienda_origen: '' });
                          }}
                        >
                          Todas
                        </button>
                        {tiendas
                          .filter(t => t.nombre.toLowerCase().includes(tiendaOrigenSearchText.toLowerCase()))
                          .map((tienda) => (
                            <button
                              key={tienda.id_tienda}
                              className="w-full p-3 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda_origen: tienda.id_tienda.toString() });
                                setShowTiendaOrigenDropdown(false);
                                setTiendaOrigenSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos({ ...filters, id_tienda_origen: tienda.id_tienda.toString() });
                              }}
                            >
                              {tienda.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tienda Destino */}
              {!shouldHideTiendaFilters && (
                <div className="mb-4">
                  <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tienda Destino</label>
                  <div className="relative">
                    <button
                      className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: filters.id_tienda_destino ? colors.onSurface : colors.outline
                      }}
                      onClick={() => setShowTiendaDestinoDropdown(!showTiendaDestinoDropdown)}
                    >
                      <span>{tiendas.find(t => t.id_tienda.toString() === filters.id_tienda_destino)?.nombre || 'Todas'}</span>
                      {showTiendaDestinoDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                    </button>
                    {showTiendaDestinoDropdown && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                      >
                        <button
                          className="w-full p-3 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFilters({ ...filters, id_tienda_destino: '' });
                            setShowTiendaDestinoDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos({ ...filters, id_tienda_destino: '' });
                          }}
                        >
                           Todas
                        </button>
                        {tiendas
                          .filter(t => t.nombre.toLowerCase().includes(tiendaDestinoSearchText.toLowerCase()))
                          .map((tienda) => (
                            <button
                              key={tienda.id_tienda}
                              className="w-full p-3 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda_destino: tienda.id_tienda.toString() });
                                setShowTiendaDestinoDropdown(false);
                                setTiendaDestinoSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos({ ...filters, id_tienda_destino: tienda.id_tienda.toString() });
                              }}
                            >
                              {tienda.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Usuario */}
              <div className="mb-4">
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Usuario</label>
                <div className="relative">
                  <button
                    className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant,
                      color: filters.id_usuario ? colors.onSurface : colors.outline
                    }}
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                  >
                    <span>{users.find(u => u.id_usuario.toString() === filters.id_usuario)?.nombre_usuario || 'Todos'}</span>
                    {showUserDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                  </button>
                  {showUserDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <button
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFilters({ ...filters, id_usuario: '' });
                          setShowUserDropdown(false);
                          setUserSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos({ ...filters, id_usuario: '' });
                        }}
                      >
                        Todos
                      </button>
                      {users
                        .filter(u => u.nombre_usuario.toLowerCase().includes(userSearchText.toLowerCase()))
                        .map((usuario) => (
                          <button
                            key={usuario.id_usuario}
                            className="w-full p-3 text-left hover:bg-black/5"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setFilters({ ...filters, id_usuario: usuario.id_usuario.toString() });
                              setShowUserDropdown(false);
                              setUserSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchMovimientos({ ...filters, id_usuario: usuario.id_usuario.toString() });
                            }}
                          >
                            {usuario.nombre_usuario}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Fecha Desde */}
              <div className="mb-4">
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Fecha Desde</label>
                <input
                  type="date"
                  value={filters.fecha_desde}
                  onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                  className="w-full p-3 rounded-lg border-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface
                  }}
                />
              </div>

              {/* Fecha Hasta */}
              <div className="mb-4">
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Fecha Hasta</label>
                <input
                  type="date"
                  value={filters.fecha_hasta}
                  onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                  className="w-full p-3 rounded-lg border-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface
                  }}
                />
              </div>
            </>
          )}

          {/* Filter Actions - Always visible */}
          <div className="flex gap-3 mb-4">
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:opacity-80"
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              <span>Buscar</span>
            </button>
          </div>
            </div>
          </>
        )}

        {!isDesktop && canManageMovimientos() && (
          <button
            className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90 mb-4"
            style={{ backgroundColor: colors.primary, color: '#fff' }}
            onClick={() => router.push('/movimientos/create')}
          >
            <Plus size={20} />
            <span>Agregar Movimiento</span>
          </button>
        )}

        {/* Movimientos List */}
        {isLoading ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <RefreshCw size={40} className="animate-spin" style={{ color: colors.primary, marginBottom: 16 }} />
            <p style={{ color: colors.outline }}>Cargando movimientos...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <AlertCircle size={60} style={{ color: colors.error, marginBottom: 16 }} />
            <p style={{ color: colors.error, marginBottom: 16 }}>{error}</p>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => fetchMovimientos()}
            >
              <RefreshCw size={18} />
              <span>Reintentar</span>
            </button>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
            <p style={{ color: colors.outline }}>No se encontraron movimientos</p>
          </div>
        ) : (
          <>
            {/* Card View */}
            {viewMode === 'card' && (
              <div className="space-y-3">
                {movimientos.map((movimiento) => (
                  <div
                    key={movimiento.id_movimiento_lista}
                    className="relative rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => router.push(`/movimientos/${movimiento.id_movimiento_lista}/edit`)}
                  >
                    {/* Flags */}
                    <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: movimiento.estado ? '#4CAF50' : '#FF9800' }}
                      >
                        {movimiento.estado ? (
                          <Check size={14} color="#fff" />
                        ) : (
                          <AlertCircle size={14} color="#fff" />
                        )}
                      </div>
                      {movimiento.nota && (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#2196F3' }}
                        >
                          <FileText size={14} color="#fff" />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex-1 pr-16">
                        {/* Tiendas con badges */}
                        <div className="flex items-center gap-2 mb-2">
                          <div 
                            className="px-3 py-1 rounded-lg border"
                            style={{ 
                              backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', 
                              borderColor: '#2196F3' 
                            }}
                          >
                            <span style={{ color: '#2196F3', fontSize: '13px', fontWeight: '500' }}>
                              {movimiento.tienda_origen?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.nombre || 
                               'N/A'}
                            </span>
                          </div>
                          <div 
                            className="px-3 py-1 rounded-lg border"
                            style={{ 
                              backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', 
                              borderColor: '#FF9800' 
                            }}
                          >
                            <span style={{ color: '#FF9800', fontSize: '13px', fontWeight: '500' }}>
                              {movimiento.tienda_destino?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.nombre || 
                               'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        <p style={{ color: colors.outline, fontSize: '14px', marginBottom: '4px' }}>
                          Fecha: {movimiento.fecha_hora ? new Date(movimiento.fecha_hora).toLocaleDateString() : 'N/A'}
                        </p>
                        <p style={{ color: colors.outline, fontSize: '14px', marginBottom: '4px' }}>
                          Usuario: {movimiento.usuario?.nombre_natural || 'N/A'}
                        </p>
                        <p style={{ color: colors.primary, fontSize: '14px', fontWeight: '500' }}>
                          {movimiento.movimientos?.length || 0} productos
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {canShowCompleteButton(movimiento) && (
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompleteMovimiento(movimiento);
                            }}
                            disabled={isCompletingMovimiento}
                          >
                            <CheckCircle size={22} style={{ color: '#4CAF50' }} />
                          </button>
                        )}
                        {canShowEditDeleteButtons(movimiento) && (
                          <>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/movimientos/${movimiento.id_movimiento_lista}/edit`);
                              }}
                            >
                              <Edit size={22} style={{ color: colors.primary }} />
                            </button>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(movimiento);
                              }}
                            >
                              <Trash2 size={22} style={{ color: colors.error }} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="w-full" style={{ backgroundColor: colors.surface }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.primary }}>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '140px' }}>Origen</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '140px' }}>Destino</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '80px' }}>Estado</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '180px' }}>Usuario</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '120px' }}>Fecha</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600', width: '80px' }}>Productos</th>
                      <th style={{ color: '#fff', padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', width: '100px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((movimiento, index) => (
                      <tr 
                        key={movimiento.id_movimiento_lista}
                        style={{ 
                          backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant,
                          cursor: 'pointer'
                        }}
                        className="hover:bg-black/5 transition-colors"
                        onClick={() => router.push(`/movimientos/${movimiento.id_movimiento_lista}/edit`)}
                      >
                        <td style={{ padding: '12px' }}>
                          <div 
                            className="px-3 py-1 rounded-lg border inline-block"
                            style={{ 
                              backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', 
                              borderColor: '#2196F3' 
                            }}
                          >
                            <span style={{ color: '#2196F3', fontSize: '13px', fontWeight: '500' }}>
                              {movimiento.tienda_origen?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaOrigen?.nombre || 
                               'N/A'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div 
                            className="px-3 py-1 rounded-lg border inline-block"
                            style={{ 
                              backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', 
                              borderColor: '#FF9800' 
                            }}
                          >
                            <span style={{ color: '#FF9800', fontSize: '13px', fontWeight: '500' }}>
                              {movimiento.tienda_destino?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaDestino?.nombre || 
                               'N/A'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: movimiento.estado ? '#4CAF50' : '#FF9800' }}
                            >
                              {movimiento.estado ? (
                                <Check size={12} color="#fff" />
                              ) : (
                                <AlertCircle size={12} color="#fff" />
                              )}
                            </div>
                            {movimiento.nota && (
                              <div 
                                className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: '#2196F3' }}
                              >
                                <FileText size={12} color="#fff" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: colors.onSurface, fontSize: '14px' }}>{movimiento.usuario?.nombre_natural || 'N/A'}</td>
                        <td style={{ padding: '12px', color: colors.onSurface, fontSize: '14px' }}>{movimiento.fecha_hora ? new Date(movimiento.fecha_hora).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '12px', color: colors.onSurface, fontSize: '14px', textAlign: 'center' }}>{movimiento.movimientos?.length || 0}</td>
                        <td style={{ padding: '12px' }}>
                          <div className="flex gap-2">
                            {canShowCompleteButton(movimiento) && (
                              <button
                                className="p-2 rounded-lg hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                                onClick={() => handleCompleteMovimiento(movimiento)}
                                disabled={isCompletingMovimiento}
                              >
                                <CheckCircle size={18} style={{ color: '#4CAF50' }} />
                              </button>
                            )}
                            {canShowEditDeleteButtons(movimiento) && (
                              <>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={() => router.push(`/movimientos/${movimiento.id_movimiento_lista}/edit`)}
                                >
                                  <Edit size={18} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={() => handleDelete(movimiento)}
                                >
                                  <Trash2 size={18} style={{ color: colors.error }} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button 
                onClick={handlePrevPage} 
                disabled={pagination.currentPage === 1}
                className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.surface, color: colors.onSurface }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ color: colors.onSurface }}>Página {pagination.currentPage} de {pagination.totalPages}</span>
              <button 
                onClick={handleNextPage} 
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.surface, color: colors.onSurface }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="text-center mt-4">
              <span style={{ color: colors.outline }}>Total: {pagination.totalItems} movimientos</span>
            </div>
          </>
        )}
      </div>

      <Toast />
    </div>
  );
}
