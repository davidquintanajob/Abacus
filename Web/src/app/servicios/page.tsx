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
  Download
} from 'lucide-react';

export default function ServiciosPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [servicios, setServicios] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [exportType, setExportType] = useState<'inventory_excel' | 'inventory_pdf' | 'qr' | 'barcode' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    nombre: true,
    codigo_qr_barra: false,
    codigo: false,
    categoria: false,
    esvendible: false,
    precio_cup: false,
    costo_cup: false,
    precio_usd: false,
    costo_usd: false,
    nota: false
  });
  const [tiendas, setTiendas] = useState<any[]>([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
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

  const handleExportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Get all services for export (ignore pagination)
      const data = await getServicios(filters, 1, 10000);
      const allServicios = data.data || [];

      if (allServicios.length === 0) {
        showToast({ type: 'warning', message: 'No hay servicios para exportar' });
        return;
      }

      // Build headers based on selected fields
      const headers = [];
      if (selectedFields.nombre) headers.push('Nombre');
      if (selectedFields.categoria) headers.push('Categoría');
      if (selectedFields.esvendible) headers.push('Estado');
      if (selectedFields.codigo) headers.push('Códigos');
      if (selectedFields.precio_cup) headers.push('Precio CUP');
      if (selectedFields.precio_usd) headers.push('Precio USD');
      if (selectedFields.costo_cup) headers.push('Costo CUP');
      if (selectedFields.costo_usd) headers.push('Costo USD');
      if (selectedFields.nota) headers.push('Nota');

      const csvContent = [
        headers.join(','),
        ...allServicios.map((servicio: any) => {
          const row = [];
          if (selectedFields.nombre) row.push(`"${servicio.nombre || ''}"`);
          if (selectedFields.categoria) row.push(`"${servicio.categoria || ''}"`);
          if (selectedFields.esvendible) row.push(servicio.esvendible ? 'Vendible' : 'No vendible');
          if (selectedFields.codigo) row.push(`"${servicio.codigos?.map((c: any) => c.codigo_barras_ean).join('; ') || ''}"`);
          if (selectedFields.precio_cup) row.push(servicio.tiendas_servicio?.[0]?.precio_cup || '0');
          if (selectedFields.precio_usd) row.push(servicio.tiendas_servicio?.[0]?.precio_usd || '0');
          if (selectedFields.costo_cup) row.push(servicio.tiendas_servicio?.[0]?.costo_cup || '0');
          if (selectedFields.costo_usd) row.push(servicio.tiendas_servicio?.[0]?.costo_usd || '0');
          if (selectedFields.nota) row.push(`"${servicio.nota || ''}"`);
          return row.join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `servicios_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({ type: 'success', message: 'Servicios exportados correctamente' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al exportar: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportTypeSelect = (type: 'inventory_excel' | 'inventory_pdf' | 'qr' | 'barcode') => {
    setExportType(type);
    setShowExportModal(false);
    setShowFieldSelectionModal(true);
  };

  const handleFieldSelectionConfirm = async () => {
    setShowFieldSelectionModal(false);
    
    if (exportType === 'inventory_excel') {
      await handleExportToCSV();
    } else if (exportType === 'inventory_pdf') {
      showToast({ type: 'warning', message: 'Exportación a PDF próximamente disponible' });
    } else if (exportType === 'qr' || exportType === 'barcode') {
      showToast({ type: 'warning', message: 'Exportación a QR/Barcode próximamente disponible' });
    }
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

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
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
                    Categoría
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

          {/* Add Button - Only for Admin */}
          {isAdmin && (
            <div className="flex gap-3 mb-6">
              <button
                className="flex-1 rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleAdd}
              >
                <Plus size={20} />
                <span className="font-medium">Agregar Servicio</span>
              </button>
              <button
                className="rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surface, color: colors.onSurface, border: `2px solid ${colors.outlineVariant}` }}
                onClick={handleExportClick}
              >
                <Download size={20} />
                <span className="font-medium">Exportar</span>
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
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleServicioPress(servicio)}
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
                            {servicio.nombre.length > 15 ? servicio.nombre.substring(0, 15) + '...' : servicio.nombre}
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
                        <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                          Categoría: {servicio.categoria}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 ml-3">
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                            onClick={(e) => handleEdit(servicio, e)}
                          >
                            <Edit size={22} style={{ color: colors.primary }} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(servicio);
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Categoría</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Estado</th>
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
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {servicio.nombre}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {servicio.categoria || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: servicio.esvendible ? '#4CAF50' : '#F44336' }}>
                            {servicio.esvendible ? 'Vendible' : 'No vendible'}
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

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Exportar Inventario
            </h2>
            <div className="space-y-3">
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={() => handleExportTypeSelect('inventory_excel')}
              >
                <Download size={20} />
                <span>Excel (CSV)</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surface, color: colors.onSurface, border: `2px solid ${colors.outlineVariant}` }}
                onClick={() => handleExportTypeSelect('inventory_pdf')}
              >
                <Download size={20} />
                <span>PDF</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surface, color: colors.onSurface, border: `2px solid ${colors.outlineVariant}` }}
                onClick={() => handleExportTypeSelect('qr')}
              >
                <Download size={20} />
                <span>Códigos QR</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surface, color: colors.onSurface, border: `2px solid ${colors.outlineVariant}` }}
                onClick={() => handleExportTypeSelect('barcode')}
              >
                <Download size={20} />
                <span>Códigos de Barras</span>
              </button>
            </div>
            <button
              className="w-full mt-4 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.error, color: '#fff' }}
              onClick={() => setShowExportModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Seleccionar Campos
            </h2>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.nombre}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, nombre: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Nombre</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.categoria}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, categoria: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Categoría</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.esvendible}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, esvendible: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Estado</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.codigo}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, codigo: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Códigos</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.precio_cup}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, precio_cup: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Precio CUP</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.precio_usd}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, precio_usd: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Precio USD</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.costo_cup}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_cup: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Costo CUP</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.costo_usd}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_usd: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Costo USD</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.nota}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, nota: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Nota</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.error, color: '#fff' }}
                onClick={() => setShowFieldSelectionModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleFieldSelectionConfirm}
                disabled={isExporting}
              >
                {isExporting ? 'Exportando...' : 'Exportar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
