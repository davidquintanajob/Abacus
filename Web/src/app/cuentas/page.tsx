'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getCuentas, deleteCuenta } from '../../services/cuentaService';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Wallet,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react';

function CuentasPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { isDesktop } = useResponsive();

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const [isLoading, setIsLoading] = useState(true);
  const [cuentas, setCuentas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    nombre: '',
    tipo_cuenta: '',
    num_cuenta: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);

  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchCuentas();
  }, []);

  const fetchCuentas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const apiFilters = { ...filters };
      const data = await getCuentas(apiFilters, pagination.currentPage, pagination.limit);
      setCuentas(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchCuentas();
  };

  const handleClearFilters = async () => {
    const clearedFilters = {
      nombre: '',
      tipo_cuenta: '',
      num_cuenta: ''
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 0));
    fetchCuentas();
  };

  const handleDelete = (cuenta) => {
    showConfirmDialog({
      title: 'Eliminar Cuenta',
      message: `¿Estás seguro de que quieres eliminar la cuenta "${cuenta.nombre}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          await deleteCuenta(cuenta.id_cuenta);
          showToast({ type: 'success', message: 'Cuenta eliminada correctamente' });
          hideConfirmDialog();
          fetchCuentas();
        } catch (err) {
          showToast({ type: 'error', message: err.message });
        }
      }
    });
  };

  const handleCuentaPress = (cuenta) => {
    router.push(`/cuentas/form/${cuenta.id_cuenta}?mode=edit`);
  };

  const handleAdd = () => {
    router.push('/cuentas/form?mode=add');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
      fetchCuentas();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchCuentas();
    }
  };

  const getTipoCuentaColor = (tipo) => {
    if (tipo.includes('CUP')) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', icon: 'cash' };
    } else if (tipo.includes('USD')) {
      return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3', icon: 'dollar-sign' };
    }
    return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575', icon: 'credit-card' };
  };

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        duration={toast.duration}
        onHide={() => {}}
      />

      <SidebarNavigation currentRoute="Cuentas" />

      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header
          title="Abacus"
          showLogo={true}
          currentRoute="Cuentas"
          isDark={isDarkMode}
          onMenuPress={() => {}}
          onThemePress={toggleTheme}
          onNotificationsPress={() => {}}
          onProfilePress={() => router.push('/profile')}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode}
        />

        <div style={{
          marginTop: '80px',
          marginRight: 'auto',
          marginBottom: '0',
          marginLeft: 'auto',
          paddingTop: '20px',
          paddingRight: '40px',
          paddingBottom: '120px',
          paddingLeft: '40px',
          maxWidth: '1400px',
        }}>
          {/* Page Title */}
          <h1
            className="text-2xl font-bold mb-6"
            style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            Gestión de Cuentas
          </h1>

          {/* Filter Card */}
          <div
            className="rounded-2xl p-5 mb-6 shadow-lg"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex justify-between items-center mb-4">
              {!isDesktop && (
                <h2
                  className="text-lg font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Filtros
                </h2>
              )}
              {!isDesktop && (
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
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Nombre
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Buscar por nombre..."
                  value={filters.nombre}
                  onChange={(e) => setFilters({ ...filters, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Tipo de Cuenta
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant
                    }}
                    onClick={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                  >
                    <span>{filters.tipo_cuenta || 'Todos'}</span>
                    <ChevronDown size={18} style={{ color: colors.primary }} />
                  </button>
                  {showTipoCuentaDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                    >
                      <div
                        className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                        style={{ borderColor: colors.outlineVariant }}
                        onClick={() => {
                          setFilters({ ...filters, tipo_cuenta: '' });
                          setShowTipoCuentaDropdown(false);
                        }}
                      >
                        <span style={{ color: colors.onSurface }}>Todos</span>
                      </div>
                      {tiposCuenta.map((tipo) => (
                        <div
                          key={tipo}
                          className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: colors.outlineVariant }}
                          onClick={() => {
                            setFilters({ ...filters, tipo_cuenta: tipo });
                            setShowTipoCuentaDropdown(false);
                          }}
                        >
                          <span style={{ color: colors.onSurface }}>{tipo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(isDesktop || showAdvancedFilters) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Número de Cuenta
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Buscar por número..."
                    value={filters.num_cuenta}
                    onChange={(e) => setFilters({ ...filters, num_cuenta: e.target.value })}
                  />
                </div>
              )}
            </div>

            {!isDesktop && (
              <div className="flex gap-3">
                <button
                  className="rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                  onClick={handleClearFilters}
                >
                  <RefreshCw size={18} />
                  <span>Limpiar</span>
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleSearch}
                >
                  <Search size={18} />
                  <span>Buscar</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            {isDesktop && (
              <>
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
                >
                  <Search size={16} />
                  <span>Buscar</span>
                </button>
              </>
            )}
            {isAdmin && (
              <button
                className={`${isDesktop ? '' : 'flex-1'} rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90`}
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleAdd}
              >
                <Plus size={16} />
                <span>Agregar Cuenta</span>
              </button>
            )}
          </div>

          {/* Accounts List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" style={{ borderColor: colors.primary }}></div>
              <p className="mt-4" style={{ color: colors.outline }}>Cargando cuentas...</p>
            </div>
          ) : error ? (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <p className="text-lg mb-4" style={{ color: colors.onSurface }}>{error}</p>
              <button
                className="rounded-lg px-6 py-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={fetchCuentas}
              >
                Reintentar
              </button>
            </div>
          ) : cuentas.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Wallet size={60} style={{ color: colors.outline }} />
              <p className="mt-4 text-lg" style={{ color: colors.outline }}>
                No hay cuentas registradas
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                <div className="grid grid-cols-1 gap-4">
                  {cuentas.map((cuenta) => (
                    <div
                      key={cuenta.id_cuenta}
                      className="rounded-2xl p-5 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: colors.surface }}
                      onClick={() => handleCuentaPress(cuenta)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3
                          className="font-semibold text-lg"
                          style={{ color: colors.onSurface }}
                        >
                          {cuenta.nombre}
                        </h3>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCuentaPress(cuenta);
                              }}
                            >
                              <Edit size={22} style={{ color: colors.primary }} />
                            </button>
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cuenta);
                              }}
                            >
                              <Trash2 size={22} style={{ color: colors.error }} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mb-2">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: getTipoCuentaColor(cuenta.tipo_cuenta).bgColor,
                            color: getTipoCuentaColor(cuenta.tipo_cuenta).color,
                            borderColor: getTipoCuentaColor(cuenta.tipo_cuenta).borderColor,
                            borderWidth: '1px'
                          }}
                        >
                          {cuenta.tipo_cuenta}
                        </span>
                      </div>

                      {cuenta.num_cuenta && (
                        <p className="text-sm mb-2" style={{ color: colors.outline }}>
                          Número: {cuenta.num_cuenta}
                        </p>
                      )}

                      <p className="font-semibold" style={{ color: colors.primary }}>
                        Fondo: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                      </p>

                      {cuenta.nota && (
                        <p className="text-sm mt-2" style={{ color: colors.outline }}>
                          Nota: {cuenta.nota}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-lg">
                  <table className="w-full" style={{ backgroundColor: colors.surface }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.primary }}>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#fff', width: '200px' }}>Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#fff', width: '150px' }}>Tipo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#fff', width: '120px' }}>Número</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: '#fff', width: '100px' }}>Fondo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: '#fff', width: '200px' }}>Nota</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: '#fff', width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {cuentas.map((cuenta, index) => (
                        <tr
                          key={cuenta.id_cuenta}
                          className="cursor-pointer transition-colors hover:opacity-80"
                          style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                          onClick={() => handleCuentaPress(cuenta)}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>{cuenta.nombre}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>{cuenta.tipo_cuenta}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>{cuenta.num_cuenta || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-center" style={{ color: colors.primary }}>
                            {parseFloat(cuenta.fondo || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>{cuenta.nota || '-'}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCuentaPress(cuenta);
                                  }}
                                >
                                  <Edit size={16} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(cuenta);
                                  }}
                                >
                                  <Trash2 size={16} style={{ color: colors.error }} />
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
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface, opacity: pagination.currentPage === 1 ? 0.5 : 1 }}
                    onClick={handlePrevPage}
                    disabled={pagination.currentPage === 1}
                  >
                    Anterior
                  </button>
                  <span style={{ color: colors.onSurface }}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <button
                    className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface, opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1 }}
                    onClick={handleNextPage}
                    disabled={pagination.currentPage === pagination.totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CuentasPage;
