'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { Sidebar } from '../../../components/layout/Sidebar';
import { Toast } from '../../../components/common/Toast';
import { createServicio, updateServicio, getServicioById } from '../../../services/servicioService';
import { getTiendas } from '../../../services/tiendaService';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function ServicioFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingServicio, setIsFetchingServicio] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    esvendible: true,
    nota: '',
    codigoList: [] as Array<{ codigo_barras_ean: string; nota: string | null }>,
    servicioTiendaList: [] as Array<{ id_tienda: number; precio_cup: number; precio_usd: number; costo_cup: number; costo_usd: number }>,
    precio_cup_general: null as number | null,
    precio_usd_general: null as number | null,
    costo_cup_general: null as number | null,
    costo_usd_general: null as number | null,
    ofertaList: [] as Array<{ id_servicio_componente: number; nombre: string; cantidad: number }>,
  });

  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);
  const [isOfertaExpanded, setIsOfertaExpanded] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    if (id && (isEditMode || isViewMode)) {
      fetchServicio();
    }
    fetchTiendas();
  }, [id]);

  const fetchServicio = async () => {
    if (!id) return;
    try {
      setIsFetchingServicio(true);
      const servicio = await getServicioById(id);
      
      setFormData({
        nombre: servicio.nombre || '',
        categoria: servicio.categoria || '',
        esvendible: servicio.esvendible !== undefined ? servicio.esvendible : true,
        nota: servicio.nota || '',
        codigoList: servicio.codigos || [],
        servicioTiendaList: servicio.tiendas_servicio || [],
        precio_cup_general: servicio.precio_cup_general || null,
        precio_usd_general: servicio.precio_usd_general || null,
        costo_cup_general: servicio.costo_cup_general || null,
        costo_usd_general: servicio.costo_usd_general || null,
        ofertaList: servicio.componentes?.map((c: any) => ({
          id_servicio_componente: c.id_servicio,
          nombre: c.nombre,
          cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
        })) || [],
      });

      if (servicio.codigos && servicio.codigos.length > 0) {
        setIsCodesExpanded(true);
      }
      if (servicio.tiendas_servicio && servicio.tiendas_servicio.length > 0) {
        setIsPricesExpanded(true);
      }
      if (servicio.componentes && servicio.componentes.length > 0) {
        setIsOfertaExpanded(true);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar datos del servicio' });
    } finally {
      setIsFetchingServicio(false);
    }
  };

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      showToast({ type: 'warning', message: 'El nombre es requerido' });
      return;
    }
    if (formData.nombre.length < 3 || formData.nombre.length > 100) {
      showToast({ type: 'error', message: 'El nombre debe tener entre 3 y 100 caracteres' });
      return;
    }
    if (!formData.categoria.trim()) {
      showToast({ type: 'warning', message: 'La categoría es requerida' });
      return;
    }
    if (formData.categoria.length < 2 || formData.categoria.length > 50) {
      showToast({ type: 'error', message: 'La categoría debe tener entre 2 y 50 caracteres' });
      return;
    }
    if (!formData.codigoList || formData.codigoList.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un código' });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSend = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        esvendible: formData.esvendible,
        nota: formData.nota || null,
        codigoList: formData.codigoList,
        servicioTiendaList: formData.servicioTiendaList,
        precio_cup_general: formData.precio_cup_general,
        precio_usd_general: formData.precio_usd_general,
        costo_cup_general: formData.costo_cup_general,
        costo_usd_general: formData.costo_usd_general,
        ofertaList: formData.ofertaList,
      };

      if (isEditMode) {
        await updateServicio(id!, dataToSend);
        showToast({ type: 'success', message: 'Servicio actualizado correctamente' });
      } else {
        await createServicio(dataToSend);
        showToast({ type: 'success', message: 'Servicio creado correctamente' });
      }
      
      router.push('/servicios');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCode = () => {
    if (!newCodigo.trim()) {
      showToast({ type: 'warning', message: 'El código es requerido' });
      return;
    }

    const codeExists = formData.codigoList.some(
      codigo => codigo.codigo_barras_ean.trim().toLowerCase() === newCodigo.trim().toLowerCase()
    );
    
    if (codeExists) {
      showToast({ type: 'error', message: 'Este código ya está agregado a la lista' });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      codigoList: [
        ...prev.codigoList,
        { codigo_barras_ean: newCodigo.trim(), nota: newNota.trim() || null }
      ]
    }));
    
    setNewCodigo('');
    setNewNota('');
    setShowAddCodeModal(false);
    setIsCodesExpanded(true);
  };

  const handleDeleteCode = (index: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este código?')) {
      setFormData(prev => ({
        ...prev,
        codigoList: prev.codigoList.filter((_, i) => i !== index)
      }));
    }
  };

  const handleAddTiendaServicio = () => {
    const existingTiendaIds = formData.servicioTiendaList.map(item => item.id_tienda);
    const availableTiendas = tiendas.filter(tienda => 
      tienda.activo === true && !existingTiendaIds.includes(tienda.id_tienda)
    );

    if (availableTiendas.length === 0) {
      showToast({ type: 'warning', message: 'Todas las tiendas ya están agregadas' });
      return;
    }

    const newTiendaEntries = availableTiendas.map(tienda => ({
      id_tienda: tienda.id_tienda,
      precio_cup: formData.precio_cup_general || 0,
      precio_usd: formData.precio_usd_general || 0,
      costo_cup: formData.costo_cup_general || 0,
      costo_usd: formData.costo_usd_general || 0,
    }));

    setFormData(prev => ({
      ...prev,
      servicioTiendaList: [...prev.servicioTiendaList, ...newTiendaEntries]
    }));
  };

  const handleRemoveTiendaServicio = (index: number) => {
    setFormData(prev => ({
      ...prev,
      servicioTiendaList: prev.servicioTiendaList.filter((_, i) => i !== index)
    }));
  };

  const handleTiendaServicioChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedList = prev.servicioTiendaList.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: parseFloat(value) || 0 };
        }
        return item;
      });
      return { ...prev, servicioTiendaList: updatedList };
    });
  };

  const handleApplyGeneralPrices = () => {
    if (!formData.precio_cup_general && !formData.precio_usd_general && !formData.costo_cup_general && !formData.costo_usd_general) {
      showToast({ type: 'warning', message: 'Debe especificar al menos un precio o costo general' });
      return;
    }

    setFormData(prev => ({
      ...prev,
      servicioTiendaList: prev.servicioTiendaList.map(item => ({
        ...item,
        precio_cup: formData.precio_cup_general !== null ? formData.precio_cup_general : item.precio_cup,
        precio_usd: formData.precio_usd_general !== null ? formData.precio_usd_general : item.precio_usd,
        costo_cup: formData.costo_cup_general !== null ? formData.costo_cup_general : item.costo_cup,
        costo_usd: formData.costo_usd_general !== null ? formData.costo_usd_general : item.costo_usd,
      }))
    }));

    showToast({ type: 'success', message: 'Precios aplicados a todas las tiendas' });
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
          showViewToggle={false}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Servicios"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="flex items-center mb-6 mt-4">
            <button
              className="mr-4 p-2 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.surface, color: colors.onSurface }}
              onClick={() => router.push('/servicios')}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              {isAddMode ? 'Agregar Servicio' : isEditMode ? 'Editar Servicio' : 'Ver Servicio'}
            </h1>
          </div>

          {isFetchingServicio ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando datos del servicio...</p>
            </div>
          ) : (
            <>
              {/* Form Card */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                {/* Nombre */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Nombre *
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
                    placeholder="Nombre del servicio"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Categoría */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Categoría *
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
                    placeholder="Categoría del servicio"
                    value={formData.categoria}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Estado (esvendible) */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Estado
                  </label>
                  <div className="flex items-center">
                    <button
                      className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${formData.esvendible ? 'bg-green-500' : 'bg-gray-400'}`}
                      onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, esvendible: !prev.esvendible }))}
                      disabled={isReadOnly}
                    >
                      <div 
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                        style={{
                          transform: formData.esvendible ? 'translateX(24px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                    <span className="ml-3 text-sm" style={{ color: colors.onSurface }}>
                      {formData.esvendible ? 'Vendible' : 'No vendible'}
                    </span>
                  </div>
                </div>

                {/* Nota */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Nota
                  </label>
                  <textarea
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 resize-none"
                    rows={3}
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Nota opcional"
                    value={formData.nota}
                    onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Códigos Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Códigos
                  </h2>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.background, color: colors.onSurface }}
                    onClick={() => setIsCodesExpanded(!isCodesExpanded)}
                  >
                    {isCodesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {isCodesExpanded && (
                  <>
                    <div className="space-y-3 mb-4">
                      {formData.codigoList.map((codigo, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ backgroundColor: colors.background }}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                              {codigo.codigo_barras_ean}
                            </p>
                            {codigo.nota && (
                              <p className="text-xs" style={{ color: colors.outline }}>
                                {codigo.nota}
                              </p>
                            )}
                          </div>
                          {!isReadOnly && (
                            <button
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={() => handleDeleteCode(index)}
                            >
                              <Trash2 size={18} style={{ color: colors.error }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {!isReadOnly && (
                      <button
                        className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={() => setShowAddCodeModal(true)}
                      >
                        <Plus size={18} />
                        <span>Agregar Código</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Precios Generales Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Precios Generales
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Precio CUP
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      value={formData.precio_cup_general || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, precio_cup_general: parseFloat(e.target.value) || null }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Precio USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      value={formData.precio_usd_general || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, precio_usd_general: parseFloat(e.target.value) || null }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Costo CUP
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      value={formData.costo_cup_general || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costo_cup_general: parseFloat(e.target.value) || null }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Costo USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      value={formData.costo_usd_general || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costo_usd_general: parseFloat(e.target.value) || null }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleApplyGeneralPrices}
                  >
                    <span>Aplicar a todas las tiendas</span>
                  </button>
                )}
              </div>

              {/* Precios por Tienda Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Precios por Tienda
                  </h2>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.background, color: colors.onSurface }}
                    onClick={() => setIsPricesExpanded(!isPricesExpanded)}
                  >
                    {isPricesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {isPricesExpanded && (
                  <>
                    <div className="space-y-4 mb-4">
                      {formData.servicioTiendaList.map((tiendaServicio, index) => {
                        const tienda = tiendas.find(t => t.id_tienda === tiendaServicio.id_tienda);
                        return (
                          <div 
                            key={index}
                            className="p-4 rounded-lg"
                            style={{ backgroundColor: colors.background }}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-semibold" style={{ color: colors.onSurface }}>
                                {tienda?.nombre || `Tienda ${tiendaServicio.id_tienda}`}
                              </h3>
                              {!isReadOnly && (
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={() => handleRemoveTiendaServicio(index)}
                                >
                                  <Trash2 size={16} style={{ color: colors.error }} />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                  Precio CUP
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                  style={{ 
                                    backgroundColor: colors.surface, 
                                    color: colors.onSurface, 
                                    borderColor: colors.outlineVariant
                                  }}
                                  value={tiendaServicio.precio_cup}
                                  onChange={(e) => handleTiendaServicioChange(index, 'precio_cup', e.target.value)}
                                  disabled={isReadOnly}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                  Precio USD
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                  style={{ 
                                    backgroundColor: colors.surface, 
                                    color: colors.onSurface, 
                                    borderColor: colors.outlineVariant
                                  }}
                                  value={tiendaServicio.precio_usd}
                                  onChange={(e) => handleTiendaServicioChange(index, 'precio_usd', e.target.value)}
                                  disabled={isReadOnly}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                  Costo CUP
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                  style={{ 
                                    backgroundColor: colors.surface, 
                                    color: colors.onSurface, 
                                    borderColor: colors.outlineVariant
                                  }}
                                  value={tiendaServicio.costo_cup}
                                  onChange={(e) => handleTiendaServicioChange(index, 'costo_cup', e.target.value)}
                                  disabled={isReadOnly}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                  Costo USD
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                  style={{ 
                                    backgroundColor: colors.surface, 
                                    color: colors.onSurface, 
                                    borderColor: colors.outlineVariant
                                  }}
                                  value={tiendaServicio.costo_usd}
                                  onChange={(e) => handleTiendaServicioChange(index, 'costo_usd', e.target.value)}
                                  disabled={isReadOnly}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!isReadOnly && (
                      <button
                        className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={handleAddTiendaServicio}
                      >
                        <Plus size={18} />
                        <span>Agregar Tienda</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Oferta Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Oferta (Componentes)
                  </h2>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.background, color: colors.onSurface }}
                    onClick={() => setIsOfertaExpanded(!isOfertaExpanded)}
                  >
                    {isOfertaExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {isOfertaExpanded && (
                  <>
                    <div className="space-y-3 mb-4">
                      {formData.ofertaList.map((componente, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ backgroundColor: colors.background }}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                              {componente.nombre}
                            </p>
                            <p className="text-xs" style={{ color: colors.outline }}>
                              Cantidad: {componente.cantidad}
                            </p>
                          </div>
                          {!isReadOnly && (
                            <button
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              onClick={() => {
                                if (confirm('¿Estás seguro de que quieres eliminar este componente?')) {
                                  setFormData(prev => ({
                                    ...prev,
                                    ofertaList: prev.ofertaList.filter((_, i) => i !== index)
                                  }));
                                }
                              }}
                            >
                              <Trash2 size={18} style={{ color: colors.error }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {formData.ofertaList.length === 0 && (
                      <p className="text-sm text-center mb-4" style={{ color: colors.outline }}>
                        Este servicio no tiene componentes de oferta
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Save size={18} />
                        <span>Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Code Modal */}
        {showAddCodeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: colors.surface }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Agregar Código
              </h2>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Código *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Código de barras"
                  value={newCodigo}
                  onChange={(e) => setNewCodigo(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Nota"
                  value={newNota}
                  onChange={(e) => setNewNota(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                  onClick={() => {
                    setShowAddCodeModal(false);
                    setNewCodigo('');
                    setNewNota('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAddCode}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
