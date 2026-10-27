'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getClientes, deleteCliente } from '../../services/clienteService';
import { Search, ChevronLeft, ChevronRight, Phone, Trash2, Edit, AlertCircle, Grid, List, RefreshCw, X, ChevronDown, ChevronUp, Plus, DollarSign, FileText, Receipt, Smartphone } from 'lucide-react';

const ClientesPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, deudaAccessLevels, clienteManagePermissions } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isInitialized, setIsInitialized] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isInitializedRef = useRef(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    tipo_cliente: '',
    tiene_deuda: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canViewClientes = 
    isAdmin ||
    (userRole === 'dependiente' && (deudaAccessLevels?.dependiente === 'clientes' || deudaAccessLevels?.dependiente === 'ambos')) ||
    (userRole === 'almacenero' && (deudaAccessLevels?.almacenero === 'clientes' || deudaAccessLevels?.almacenero === 'ambos')) ||
    (userRole === 'económico' && (deudaAccessLevels?.economico === 'clientes' || deudaAccessLevels?.economico === 'ambos'));

  const canManageClientes = 
    isAdmin ||
    (userRole === 'dependiente' && clienteManagePermissions?.dependiente && (deudaAccessLevels?.dependiente === 'clientes' || deudaAccessLevels?.dependiente === 'ambos')) ||
    (userRole === 'almacenero' && clienteManagePermissions?.almacenero && (deudaAccessLevels?.almacenero === 'clientes' || deudaAccessLevels?.almacenero === 'ambos')) ||
    (userRole === 'económico' && clienteManagePermissions?.economico && (deudaAccessLevels?.economico === 'clientes' || deudaAccessLevels?.economico === 'ambos'));

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const fetchClientes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiFilters: any = { ...filters };
      console.log('Filtros originales:', filters);
      console.log('tiene_deuda original:', filters.tiene_deuda);
      if (!apiFilters.nombre) delete apiFilters.nombre;
      if (!apiFilters.telefono) delete apiFilters.telefono;
      if (!apiFilters.direccion) delete apiFilters.direccion;
      if (!apiFilters.tipo_cliente) delete apiFilters.tipo_cliente;
      if (apiFilters.tiene_deuda === '' || apiFilters.tiene_deuda === undefined) delete apiFilters.tiene_deuda;
      else apiFilters.tiene_deuda = apiFilters.tiene_deuda === 'true';
      console.log('tiene_deuda final:', apiFilters.tiene_deuda);
      console.log('API Filters finales:', apiFilters);

      const data = await getClientes(apiFilters, pagination.currentPage, pagination.limit);
      let clientesList = data.data || [];

      clientesList = clientesList.map(cliente => {
        const tieneDeuda = cliente.deudas && cliente.deudas.some(
          deuda => deuda.monto_restante_cup > 0 || deuda.monto_restante_usd > 0
        );
        return { ...cliente, tiene_deuda: tieneDeuda };
      });

      setClientes(clientesList);
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
    fetchClientes();
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      nombre: '',
      telefono: '',
      direccion: '',
      tipo_cliente: '',
      tiene_deuda: ''
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchClientes();
  };

  const handleDelete = (cliente: any) => {
    showConfirmDialog({
      title: 'Eliminar Cliente',
      message: `¿Estás seguro de que deseas eliminar a ${cliente.nombre}?`,
      onConfirm: () => {
        hideConfirmDialog();
        deleteCliente(cliente.id_cliente)
          .then(() => {
            showToast({ type: 'success', message: 'Cliente eliminado correctamente' });
            fetchClientes();
          })
          .catch((error: any) => {
            showToast({ type: 'error', message: error.message || 'Error al eliminar cliente' });
          });
      },
      type: 'danger'
    });
  };

  const handleClientePress = (cliente: any) => {
    const openMode = canManageClientes ? 'edit' : 'view';
    router.push(`/clientes/${cliente.id_cliente}/${openMode}`);
  };

  const handleAdd = () => {
    router.push('/clientes/create');
  };

  const handleCall = (telefono: string) => {
    if (!telefono) {
      showToast({ type: 'error', message: 'El cliente no tiene teléfono' });
      return;
    }

    if (isMobile) {
      // En móvil, abrir el enlace tel:
      window.location.href = `tel:${telefono}`;
    } else {
      // En desktop, mostrar modal
      setShowCallModal(true);
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
      fetchClientes();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchClientes();
    }
  };

  if (!canViewClientes) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
        <div className="text-center">
          <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
          <p style={{ color: colors.outline }}>No tienes permiso para ver clientes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={() => {}}
        onProfilePress={() => router.push('/profile')}
        onViewModeToggle={toggleViewMode}
        showViewToggle={true}
        viewMode={viewMode}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        currentRoute="clientes"
      />
      <SidebarNavigation ref={sidebarNavRef} currentRoute="Clientes" />

      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <div
          style={{
            marginTop: '80px',
            marginRight: 'auto',
            marginBottom: '0',
            marginLeft: 'auto',
            paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
            paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
            paddingBottom: '120px',
            paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
            maxWidth: isDesktop ? '1400px' : '100%',
          }}
        >
        {/* Desktop Layout */}
        {isDesktop ? (
          <>
            {/* Page Title - Top Left */}
            <div className="mb-4">
              <h1
                className="text-2xl font-bold"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Gestión de Clientes
              </h1>
            </div>

            {/* Filter Section - Horizontal */}
            <div
              className="rounded-2xl p-4 mb-4 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                {/* Nombre */}
                <div className="flex-1 min-w-[200px]">
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

                {/* Tipo de Cliente */}
                <div className="flex-1 min-w-[200px]">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Tipo de Cliente
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
                    placeholder="Buscar por tipo..."
                    value={filters.tipo_cliente}
                    onChange={(e) => setFilters(prev => ({ ...prev, tipo_cliente: e.target.value }))}
                  />
                </div>

                {/* Teléfono */}
                <div className="flex-1 min-w-[200px]">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Teléfono
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
                    placeholder="Buscar por teléfono..."
                    value={filters.telefono}
                    onChange={(e) => setFilters(prev => ({ ...prev, telefono: e.target.value }))}
                  />
                </div>

                {/* Dirección */}
                <div className="flex-1 min-w-[200px]">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Dirección
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
                    placeholder="Buscar por dirección..."
                    value={filters.direccion}
                    onChange={(e) => setFilters(prev => ({ ...prev, direccion: e.target.value }))}
                  />
                </div>

                {/* Estado de Deuda */}
                <div className="min-w-[200px]">
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Estado de Deuda
                  </label>
                  <select
                    className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    value={filters.tiene_deuda}
                    onChange={(e) => setFilters(prev => ({ ...prev, tiene_deuda: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="true">Con Deuda</option>
                    <option value="false">Sin Deuda</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons - Outside filter card */}
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
              <button
                className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                style={{
                  backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                  borderColor: colors.primary,
                  color: isDarkMode ? colors.primary : '#1976D2'
                }}
                onClick={() => router.push('/deudas')}
              >
                <Receipt size={16} />
                <span>Ver Deudas</span>
              </button>
              {canManageClientes && (
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAdd}
                >
                  <Plus size={16} />
                  <span>Nuevo Cliente</span>
                </button>
              )}
            </div>

            {/* Clientes List */}
            {isLoading ? (
              <div className="rounded-2xl p-8 flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <RefreshCw size={40} className="animate-spin" style={{ color: colors.primary }} />
              </div>
            ) : error ? (
              <div className="rounded-2xl p-8 flex flex-col items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <AlertCircle size={60} style={{ color: colors.error, marginBottom: 16 }} />
                <p style={{ color: colors.error }}>{error}</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="rounded-2xl p-8 flex flex-col items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
                <p style={{ color: colors.outline }}>No se encontraron clientes</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="space-y-3">
                {clientes.map((cliente: any) => (
                  <div
                    key={cliente.id_cliente}
                    className="relative rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleClientePress(cliente)}
                  >
                    {/* Flags */}
                    <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                      {cliente.tiene_deuda && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#F44336' }}
                        >
                          <DollarSign size={14} color="#fff" />
                        </div>
                      )}
                      {cliente.nota && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#2196F3' }}
                        >
                          <FileText size={14} color="#fff" />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div className="flex-1 pl-10">
                        <h3 className="font-semibold text-lg mb-2" style={{ color: colors.onSurface }}>
                          {cliente.nombre}
                        </h3>
                        <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                          Teléfono: {cliente.telefono || 'N/A'}
                        </p>
                        <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                          Dirección: {cliente.direccion || 'N/A'}
                        </p>
                        {cliente.tipo_cliente && (
                          <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                            Tipo: {cliente.tipo_cliente}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCall(cliente.telefono);
                          }}
                        >
                          <Phone size={22} style={{ color: '#4CAF50' }} />
                        </button>
                        {canManageClientes && (
                          <>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/clientes/${cliente.id_cliente}/edit`);
                              }}
                            >
                              <Edit size={22} style={{ color: colors.primary }} />
                            </button>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cliente);
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
            ) : (
              <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="w-full" style={{ backgroundColor: colors.surface }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.primary }}>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Nombre</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Teléfono</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Dirección</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Tipo</th>
                      <th className="px-4 py-3 text-sm font-semibold text-center text-white">Deuda</th>
                      {canManageClientes && (
                        <th className="px-4 py-3 text-sm font-semibold text-center text-white">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente: any, index: number) => (
                      <tr
                        key={cliente.id_cliente}
                        className="cursor-pointer hover:bg-black/5 transition-colors"
                        style={{
                          backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant,
                        }}
                        onClick={() => handleClientePress(cliente)}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.nombre}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.telefono || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.direccion || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.tipo_cliente || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: colors.onSurface }}>
                          {cliente.tiene_deuda ? (
                            <span style={{ color: colors.error }}>Sí</span>
                          ) : (
                            <span style={{ color: colors.outline }}>No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              className="p-2 rounded-lg hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCall(cliente.telefono);
                              }}
                            >
                              <Phone size={20} style={{ color: '#4CAF50' }} />
                            </button>
                            {canManageClientes && (
                              <>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/clientes/${cliente.id_cliente}/edit`);
                                  }}
                                >
                                  <Edit size={20} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(cliente);
                                  }}
                                >
                                  <Trash2 size={20} style={{ color: colors.error }} />
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
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ color: colors.onSurface }}>
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="text-center mt-4">
              <span style={{ color: colors.outline }}>
                Total: {pagination.totalItems} clientes
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Mobile/Tablet Layout */}
            <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: colors.onSurface }}>
              Gestión de Clientes
            </h1>

            {/* Filter Card */}
            <div className="rounded-2xl p-5 mb-6 shadow-lg" style={{ backgroundColor: colors.surface }}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg" style={{ color: colors.onSurface }}>Filtros</h2>
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: colors.outline }}>Nombre</label>
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={filters.nombre}
                    onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    }}
                  />
                </div>

                {showAdvancedFilters && (
                  <>
                    <div>
                      <label className="block text-sm mb-2" style={{ color: colors.outline }}>Teléfono</label>
                      <input
                        type="text"
                        placeholder="Buscar por teléfono..."
                        value={filters.telefono}
                        onChange={(e) => setFilters(prev => ({ ...prev, telefono: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant,
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2" style={{ color: colors.outline }}>Dirección</label>
                      <input
                        type="text"
                        placeholder="Buscar por dirección..."
                        value={filters.direccion}
                        onChange={(e) => setFilters(prev => ({ ...prev, direccion: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant,
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2" style={{ color: colors.outline }}>Tipo de Cliente</label>
                      <input
                        type="text"
                        placeholder="Buscar por tipo..."
                        value={filters.tipo_cliente}
                        onChange={(e) => setFilters(prev => ({ ...prev, tipo_cliente: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-colors"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant,
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2" style={{ color: colors.outline }}>Estado de Deuda</label>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 px-4 py-2 rounded-lg border-2 transition-colors"
                          style={{
                            backgroundColor: filters.tiene_deuda === '' ? '#9E9E9E' : colors.background,
                            borderColor: filters.tiene_deuda === '' ? '#9E9E9E' : colors.outlineVariant,
                            color: filters.tiene_deuda === '' ? '#fff' : colors.onSurface,
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, tiene_deuda: '' }))}
                        >
                          Todos
                        </button>
                        <button
                          className="flex-1 px-4 py-2 rounded-lg border-2 transition-colors"
                          style={{
                            backgroundColor: filters.tiene_deuda === 'true' ? '#4CAF50' : colors.background,
                            borderColor: filters.tiene_deuda === 'true' ? '#4CAF50' : colors.outlineVariant,
                            color: filters.tiene_deuda === 'true' ? '#fff' : colors.onSurface,
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, tiene_deuda: 'true' }))}
                        >
                          Con Deuda
                        </button>
                        <button
                          className="flex-1 px-4 py-2 rounded-lg border-2 transition-colors"
                          style={{
                            backgroundColor: filters.tiene_deuda === 'false' ? '#2196F3' : colors.background,
                            borderColor: filters.tiene_deuda === 'false' ? '#2196F3' : colors.outlineVariant,
                            color: filters.tiene_deuda === 'false' ? '#fff' : colors.onSurface,
                          }}
                          onClick={() => setFilters(prev => ({ ...prev, tiene_deuda: 'false' }))}
                        >
                          Sin Deuda
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleClearFilters}
                    className="rounded-lg px-4 py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface
                    }}
                  >
                    <RefreshCw size={20} />
                    <span>Limpiar</span>
                  </button>
                  <button
                    onClick={handleSearch}
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                  >
                    <Search size={20} />
                    <span>Buscar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                style={{
                  backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                  borderColor: colors.primary,
                  color: isDarkMode ? colors.primary : '#1976D2'
                }}
                onClick={() => router.push('/deudas')}
              >
                <Receipt size={20} />
                <span>Ver Deudas</span>
              </button>
              {canManageClientes && (
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAdd}
                >
                  <Plus size={20} />
                  <span>Nuevo Cliente</span>
                </button>
              )}
            </div>

            {/* Clientes List */}
            {isLoading ? (
              <div className="rounded-2xl p-8 flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <RefreshCw size={40} className="animate-spin" style={{ color: colors.primary }} />
              </div>
            ) : error ? (
              <div className="rounded-2xl p-8 flex flex-col items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <AlertCircle size={60} style={{ color: colors.error, marginBottom: 16 }} />
                <p style={{ color: colors.error }}>{error}</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="rounded-2xl p-8 flex flex-col items-center justify-center" style={{ backgroundColor: colors.surface }}>
                <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
                <p style={{ color: colors.outline }}>No se encontraron clientes</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="space-y-3">
                {clientes.map((cliente: any) => (
                  <div
                    key={cliente.id_cliente}
                    className="relative rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleClientePress(cliente)}
                  >
                    {/* Flags */}
                    <div className="absolute -top-2 -left-2 flex gap-1 z-10">
                      {cliente.tiene_deuda && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#F44336' }}
                        >
                          <DollarSign size={14} color="#fff" />
                        </div>
                      )}
                      {cliente.nota && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: '#2196F3' }}
                        >
                          <FileText size={14} color="#fff" />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div className="flex-1 pl-10">
                        <h3 className="font-semibold text-lg mb-2" style={{ color: colors.onSurface }}>
                          {cliente.nombre}
                        </h3>
                        <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                          Teléfono: {cliente.telefono || 'N/A'}
                        </p>
                        <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                          Dirección: {cliente.direccion || 'N/A'}
                        </p>
                        {cliente.tipo_cliente && (
                          <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                            Tipo: {cliente.tipo_cliente}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                          style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCall(cliente.telefono);
                          }}
                        >
                          <Phone size={22} style={{ color: '#4CAF50' }} />
                        </button>
                        {canManageClientes && (
                          <>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/clientes/${cliente.id_cliente}/edit`);
                              }}
                            >
                              <Edit size={22} style={{ color: colors.primary }} />
                            </button>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cliente);
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
            ) : (
              <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="w-full" style={{ backgroundColor: colors.surface }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.primary }}>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Nombre</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Teléfono</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Dirección</th>
                      <th className="px-4 py-3 text-sm font-semibold text-left text-white">Tipo</th>
                      <th className="px-4 py-3 text-sm font-semibold text-center text-white">Deuda</th>
                      {canManageClientes && (
                        <th className="px-4 py-3 text-sm font-semibold text-center text-white">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente: any, index: number) => (
                      <tr
                        key={cliente.id_cliente}
                        className="cursor-pointer hover:bg-black/5 transition-colors"
                        style={{
                          backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant,
                        }}
                        onClick={() => handleClientePress(cliente)}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.nombre}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.telefono || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.direccion || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                          {cliente.tipo_cliente || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: colors.onSurface }}>
                          {cliente.tiene_deuda ? (
                            <span style={{ color: colors.error }}>Sí</span>
                          ) : (
                            <span style={{ color: colors.outline }}>No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              className="p-2 rounded-lg hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCall(cliente.telefono);
                              }}
                            >
                              <Phone size={20} style={{ color: '#4CAF50' }} />
                            </button>
                            {canManageClientes && (
                              <>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/clientes/${cliente.id_cliente}/edit`);
                                  }}
                                >
                                  <Edit size={20} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(cliente);
                                  }}
                                >
                                  <Trash2 size={20} style={{ color: colors.error }} />
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
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ color: colors.onSurface }}>
                Página {pagination.currentPage} de {pagination.totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={pagination.currentPage === pagination.totalPages}
                className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="text-center mt-4">
              <span style={{ color: colors.outline }}>
                Total: {pagination.totalItems} clientes
              </span>
            </div>
          </>
        )}
      </div>
      </div>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />

      {/* Call Modal for Desktop */}
      {showCallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center justify-center mb-4">
              <Smartphone size={48} style={{ color: colors.primary }} />
            </div>
            <h2 className="text-xl font-bold text-center mb-2" style={{ color: colors.onSurface }}>
              Funcionalidad Móvil
            </h2>
            <p className="text-center mb-6" style={{ color: colors.outline }}>
              La función de llamada solo está disponible en dispositivos móviles.
            </p>
            <button
              className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => setShowCallModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientesPage;
