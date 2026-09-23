'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useConfirmDialog } from '../../../context/ConfirmDialogContext';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { createServicio, updateServicio, getServicioById, getServicios } from '../../../services/servicioService';
import { getTiendas } from '../../../services/tiendaService';
import { configService } from '../../../services/configService';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  X,
  Search
} from 'lucide-react';

export default function ServicioFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog } = useConfirmDialog();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';
  const isOferta = searchParams.get('isOferta') === 'true';

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingServicio, setIsFetchingServicio] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

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
    ofertaList: [] as Array<{ id_servicio_componente: number; nombre: string; categoria: string; cantidad: number; tipo?: string; costo_cup?: number; costo_usd?: number }>,
  });

  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);
  const [isOfertaExpanded, setIsOfertaExpanded] = useState(false);
  
  // Estados para la sección de Oferta
  const [allItems, setAllItems] = useState<any[]>([]);
  const [showComponenteSelectorModal, setShowComponenteSelectorModal] = useState(false);
  const [componenteSearchText, setComponenteSearchText] = useState('');
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [serviciosPagination, setServiciosPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const isEconomico = user?.rol === 'Económico';
  const isDependiente = user?.rol === 'Dependiente';
  const isAlmacenero = user?.rol === 'Almacenero';
  
  const canEditService = isAdmin;
  const canEditCodes = isAdmin;
  const canViewCosts = !isDependiente && !isAlmacenero;

  useEffect(() => {
    if (id && (isEditMode || isViewMode)) {
      fetchServicio();
    }
    fetchTiendas();
    fetchExchangeRate();
  }, [id]);

  const fetchExchangeRate = async () => {
    try {
      const config = await configService.getConfig();
      if (config.cupToUsdRate) {
        setExchangeRate(config.cupToUsdRate);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const handlePrecioCupChange = (value: string) => {
    const cupValue = parseFloat(value) || null;
    setFormData(prev => ({ ...prev, precio_cup_general: cupValue }));
    
    if (cupValue !== null && exchangeRate !== null && exchangeRate > 0) {
      const usdValue = cupValue / exchangeRate;
      setFormData(prev => ({ ...prev, precio_usd_general: usdValue }));
    }
  };

  const handlePrecioUsdChange = (value: string) => {
    const usdValue = parseFloat(value) || null;
    setFormData(prev => ({ ...prev, precio_usd_general: usdValue }));
    
    if (usdValue !== null && exchangeRate !== null && exchangeRate > 0) {
      const cupValue = usdValue * exchangeRate;
      setFormData(prev => ({ ...prev, precio_cup_general: cupValue }));
    }
  };

  const handleCostoCupChange = (value: string) => {
    const cupValue = parseFloat(value) || null;
    setFormData(prev => ({ ...prev, costo_cup_general: cupValue }));
    
    if (cupValue !== null && exchangeRate !== null && exchangeRate > 0) {
      const usdValue = cupValue / exchangeRate;
      setFormData(prev => ({ ...prev, costo_usd_general: usdValue }));
    }
  };

  const handleCostoUsdChange = (value: string) => {
    const usdValue = parseFloat(value) || null;
    setFormData(prev => ({ ...prev, costo_usd_general: usdValue }));
    
    if (usdValue !== null && exchangeRate !== null && exchangeRate > 0) {
      const cupValue = usdValue * exchangeRate;
      setFormData(prev => ({ ...prev, costo_cup_general: cupValue }));
    }
  };

  const handleGeneralPriceBlur = () => {
    const hasAllGeneralPrices = 
      formData.precio_cup_general !== null && 
      formData.precio_cup_general !== 0 &&
      formData.precio_usd_general !== null && 
      formData.precio_usd_general !== 0;

    if (hasAllGeneralPrices && formData.servicioTiendaList.length === 0) {
      // Auto-populate all active tiendas with general prices
      const newServicioTiendaList = tiendas.filter(tienda => tienda.activo === true).map(tienda => {
        const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(String(formData.precio_cup_general));
        const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(String(formData.precio_usd_general));
        const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(String(formData.costo_cup_general))) : 0;
        const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(String(formData.costo_usd_general))) : 0;
        
        return {
          id_tienda: tienda.id_tienda,
          precio_cup: precioCup,
          precio_usd: precioUsd,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        };
      });
      
      setFormData(prev => ({
        ...prev,
        servicioTiendaList: newServicioTiendaList
      }));
      setIsPricesExpanded(true);
    } else if (hasAllGeneralPrices && formData.servicioTiendaList.length > 0) {
      // Sync general prices to existing tienda prices
      const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(String(formData.precio_cup_general));
      const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(String(formData.precio_usd_general));
      const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(String(formData.costo_cup_general))) : 0;
      const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(String(formData.costo_usd_general))) : 0;
      
      setFormData(prev => ({
        ...prev,
        servicioTiendaList: prev.servicioTiendaList.map((item: any) => ({
          ...item,
          precio_cup: precioCup,
          precio_usd: precioUsd,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        }))
      }));
    }
  };

  const fetchServicio = async () => {
    if (!id) return;
    try {
      setIsFetchingServicio(true);
      const servicio = await getServicioById(id);
      
      // Extract cost from first tienda if general cost is not available
      const firstTienda = servicio.tiendas_servicio && servicio.tiendas_servicio.length > 0 
        ? servicio.tiendas_servicio[0] 
        : null;
      
      setFormData({
        nombre: servicio.nombre || '',
        categoria: servicio.categoria || '',
        esvendible: servicio.esvendible !== undefined ? servicio.esvendible : true,
        nota: servicio.nota || '',
        codigoList: servicio.codigos || [],
        servicioTiendaList: servicio.tiendas_servicio || [],
        precio_cup_general: servicio.precio_cup_general || null,
        precio_usd_general: servicio.precio_usd_general || null,
        costo_cup_general: servicio.costo_cup_general ?? firstTienda?.costo_cup ?? null,
        costo_usd_general: servicio.costo_usd_general ?? firstTienda?.costo_usd ?? null,
        ofertaList: servicio.componentes?.map((c: any) => ({
          id_servicio_componente: c.id_servicio,
          nombre: c.nombre,
          categoria: c.categoria || '',
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

  const fetchAllServicios = async (searchTerm = '', page = 1) => {
    try {
      setIsLoadingServicios(true);
      
      const filters: any = {};
      if (searchTerm) {
        filters.nombre = searchTerm;
      }
      
      // Usar fetchProducto=true para obtener servicios y productos
      const limit = serviciosPagination.limit;
      const data = await getServicios({ ...filters, fetchProducto: true }, page, limit);
      
      let allItemsCombined = data.data || [];
      
      // Filtrar el servicio actual si estamos editando
      if (id) {
        allItemsCombined = allItemsCombined.filter((s: any) => s.id_servicio !== parseInt(id));
      }
      
      // Add type indicator based on whether servicio has producto
      const itemsWithTipo = allItemsCombined.map((s: any) => ({
        ...s,
        tipo: s.producto ? 'producto' : 'servicio'
      }));
      
      // Ordenar por nombre
      itemsWithTipo.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
      
      // Usar la paginación del servidor
      setAllItems(itemsWithTipo);
      setServiciosPagination(data.pagination || { 
        currentPage: page, 
        limit: limit, 
        totalPages: 1, 
        totalItems: itemsWithTipo.length 
      });
    } catch (err) {
      console.error('Error fetching servicios y productos:', err);
      setAllItems([]);
    } finally {
      setIsLoadingServicios(false);
    }
  };

  // Cargar servicios cuando se abre el modal de componentes
  useEffect(() => {
    if (showComponenteSelectorModal) {
      setServiciosPagination(prev => ({ ...prev, currentPage: 1 }));
      setComponenteSearchText('');
      fetchAllServicios('', 1);
    }
  }, [showComponenteSelectorModal]);

  // Búsqueda con debounce
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const newTimer = setTimeout(() => {
      if (showComponenteSelectorModal) {
        setServiciosPagination(prev => ({ ...prev, currentPage: 1 }));
        fetchAllServicios(componenteSearchText, 1);
      }
    }, 500);
    
    setDebounceTimer(newTimer);
    
    return () => {
      if (newTimer) {
        clearTimeout(newTimer);
      }
    };
  }, [componenteSearchText]);

  const handleServicioNextPage = () => {
    if (serviciosPagination.currentPage < serviciosPagination.totalPages) {
      fetchAllServicios(componenteSearchText, serviciosPagination.currentPage + 1);
    }
  };

  const handleServicioPrevPage = () => {
    if (serviciosPagination.currentPage > 1) {
      fetchAllServicios(componenteSearchText, serviciosPagination.currentPage - 1);
    }
  };

  const handleAddServicioComponente = (itemSeleccionado: any) => {
    const id = itemSeleccionado.id_servicio;
    const existe = formData.ofertaList.find(
      (item: any) => item.id_servicio_componente === id
    );
    if (existe) {
      showToast({ type: 'warning', message: 'Este elemento ya está agregado como componente' });
      return;
    }
    
    // Get cost data from the selected item (servicio or producto)
    const tiendasItem = itemSeleccionado.tiendas_servicio || itemSeleccionado.servicioTiendaList || [];
    const firstTienda = tiendasItem[0];
    
    setFormData(prev => ({
      ...prev,
      ofertaList: [
        ...prev.ofertaList,
        {
          id_servicio_componente: id,
          tipo: itemSeleccionado.tipo,
          cantidad: 1.0,
          nombre: itemSeleccionado.nombre,
          categoria: itemSeleccionado.categoria,
          costo_cup: firstTienda?.costo_cup || 0,
          costo_usd: firstTienda?.costo_usd || 0,
        }
      ]
    }));
    setShowComponenteSelectorModal(false);
    setComponenteSearchText('');
    // Expandir automáticamente después de agregar un servicio
    setIsOfertaExpanded(true);
  };

  const handleRemoveServicioComponente = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ofertaList: prev.ofertaList.filter((_, i) => i !== index)
    }));
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

      // Helper function to safely convert to number with 5 decimal places
      const toFixed5 = (value: any) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
      };

      // Lógica de precios: siempre enviar todos los precios por tienda
      // Si hay precios específicos por tienda, usarlos; si no, usar el precio general
      const servicioTiendaList = (() => {
        // Solo incluir tiendas que están explícitamente en servicioTiendaList
        // Usar precios específicos si están disponibles, si no usar precios generales
        const baseList = formData.servicioTiendaList.map((specific: any) => {
          // Solo procesar si la tienda tiene un ID válido
          if (specific.id_tienda === null) return null;
          
          return {
            id_tienda: specific.id_tienda,
            precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
            precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
          };
        }).filter((item: any) => item !== null);
        
        // Apply global cost fields to all stores
        const costoCup = toFixed5(formData.costo_cup_general);
        const costoUsd = toFixed5(formData.costo_usd_general);
        
        return baseList.map((item: any) => ({
          ...item,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        }));
      })();

      const dataToSend = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        esvendible: formData.esvendible,
        nota: formData.nota || null,
        codigoList: formData.codigoList,
        servicioTiendaList,
        // Incluir ofertaList si hay componentes
        ofertaList: formData.ofertaList.length > 0 ? formData.ofertaList.map((item: any) => ({
          id_servicio_componente: item.id_servicio_componente,
          cantidad: item.cantidad || 1.0,
        })) : [],
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
    showConfirmDialog({
      title: 'Eliminar Código',
      message: '¿Estás seguro de que quieres eliminar este código?',
      onConfirm: () => {
        setFormData(prev => ({
          ...prev,
          codigoList: prev.codigoList.filter((_, i) => i !== index)
        }));
      },
      type: 'danger'
    });
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
      
      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/servicios')}
          isDark={isDarkMode}
          title={isViewMode ? 'Información del Servicio' : isEditMode ? 'Editar Servicio' : 'Agregar Servicio'}
          currentRoute="Servicios"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
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

                {/* Costos - Solo para usuarios con permisos y no oferta */}
                {canViewCosts && !isOferta && (
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Costo CUP
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Costo CUP"
                        value={formData.costo_cup_general || ''}
                        onChange={(e) => handleCostoCupChange(e.target.value)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Costo USD
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Costo USD"
                        value={formData.costo_usd_general || ''}
                        onChange={(e) => handleCostoUsdChange(e.target.value)}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                )}
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
                  <div className="flex gap-2">
                    {canEditCodes && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={() => setShowAddCodeModal(true)}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                      style={{ 
                        backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                        borderColor: colors.primary 
                      }}
                      onClick={() => setIsCodesExpanded(!isCodesExpanded)}
                    >
                      {isCodesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isCodesExpanded && (
                  <>
                    {formData.codigoList.length === 0 ? (
                      <p className="text-sm" style={{ color: colors.outline }}>
                        No hay códigos agregados
                      </p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {formData.codigoList.map((codigo, index) => (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                                {codigo.nota ? `${codigo.nota}-${codigo.codigo_barras_ean}` : codigo.codigo_barras_ean}
                              </p>
                            </div>
                            {canEditCodes && (
                              <button
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                onClick={() => handleDeleteCode(index)}
                              >
                                <Trash2 size={16} style={{ color: colors.error }} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Oferta Section - Solo cuando isOferta es true, después de Códigos */}
              {isOferta && (
                <div 
                  className="rounded-2xl p-5 mb-6 shadow-lg"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Servicios y Productos (Oferta)
                    </h2>
                    <div className="flex gap-2">
                      {canEditService && (
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ backgroundColor: colors.primary, color: '#fff' }}
                          onClick={() => setShowComponenteSelectorModal(true)}
                        >
                          <Plus size={18} />
                        </button>
                      )}
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                          borderColor: colors.primary 
                        }}
                        onClick={() => setIsOfertaExpanded(!isOfertaExpanded)}
                      >
                        {isOfertaExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                      </button>
                    </div>
                  </div>

                  {isOfertaExpanded && (
                    <>
                      {formData.ofertaList.length === 0 ? (
                        <p className="text-sm" style={{ color: colors.outline }}>
                          No hay servicios ni productos componentes agregados
                        </p>
                      ) : (
                        <div className="space-y-3 mb-4">
                          {formData.ofertaList.map((componente, index) => (
                            <div 
                              key={index}
                              className="flex items-center gap-3 p-3 rounded-lg"
                              style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                                  {componente.nombre}
                                </p>
                                <p className="text-xs" style={{ color: colors.outline }}>
                                  Categoría: {componente.categoria}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs" style={{ color: colors.outline }}>Cantidad:</label>
                                  {canEditService ? (
                                    <input
                                      type="number"
                                      step="0.1"
                                      className="w-20 rounded px-2 py-1 text-sm border focus:outline-none focus:ring-2"
                                      style={{ 
                                        backgroundColor: colors.surface, 
                                        color: colors.onSurface, 
                                        borderColor: colors.outlineVariant
                                      }}
                                      value={componente.cantidad}
                                      onChange={(e) => {
                                        setFormData(prev => ({
                                          ...prev,
                                          ofertaList: prev.ofertaList.map((c, i) => 
                                            i === index ? { ...c, cantidad: parseFloat(e.target.value) || 1.0 } : c
                                          )
                                        }));
                                      }}
                                    />
                                  ) : (
                                    <span className="text-sm" style={{ color: colors.onSurface }}>
                                      {componente.cantidad}
                                    </span>
                                  )}
                                </div>
                                {canEditService && (
                                  <button
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                    onClick={() => {
                                      showConfirmDialog({
                                        title: 'Eliminar Componente',
                                        message: '¿Estás seguro de que quieres eliminar este componente?',
                                        onConfirm: () => {
                                          handleRemoveServicioComponente(index);
                                        },
                                        type: 'danger'
                                      });
                                    }}
                                  >
                                    <Trash2 size={16} style={{ color: colors.error }} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {canViewCosts && formData.ofertaList.length > 0 && (
                        <div 
                          className="p-4 rounded-lg mt-4"
                          style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                        >
                          <h3 className="font-semibold text-sm mb-2" style={{ color: colors.onSurface }}>
                            Costo Total de la Oferta
                          </h3>
                          <div className="flex justify-between text-sm mb-1">
                            <span style={{ color: colors.outline }}>Costo CUP:</span>
                            <span style={{ color: colors.onSurface }}>
                              {formData.costo_cup_general !== null ? String(formData.costo_cup_general) : '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span style={{ color: colors.outline }}>Costo USD:</span>
                            <span style={{ color: colors.onSurface }}>
                              {formData.costo_usd_general !== null ? String(formData.costo_usd_general) : '0.00'}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Precios Generales Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <h2 
                  className="text-lg font-bold mb-4"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Precios Generales
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Precio CUP
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Precio CUP"
                      value={formData.precio_cup_general || ''}
                      onChange={(e) => handlePrecioCupChange(e.target.value)}
                      onBlur={handleGeneralPriceBlur}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Precio USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Precio USD"
                      value={formData.precio_usd_general || ''}
                      onChange={(e) => handlePrecioUsdChange(e.target.value)}
                      onBlur={handleGeneralPriceBlur}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
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
                  <div className="flex gap-2">
                    {canEditService && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: formData.servicioTiendaList.length >= tiendas.filter(t => t.activo === true).length 
                            ? colors.outlineVariant 
                            : colors.primary,
                          color: formData.servicioTiendaList.length >= tiendas.filter(t => t.activo === true).length 
                            ? colors.outline 
                            : '#fff'
                        }}
                        onClick={handleAddTiendaServicio}
                        disabled={formData.servicioTiendaList.length >= tiendas.filter(t => t.activo === true).length}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                      style={{ 
                        backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                        borderColor: colors.primary 
                      }}
                      onClick={() => setIsPricesExpanded(!isPricesExpanded)}
                    >
                      {isPricesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isPricesExpanded && (
                  <>
                    {formData.servicioTiendaList.length === 0 ? (
                      <p className="text-sm" style={{ color: colors.outline }}>
                        No hay precios configurados
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {formData.servicioTiendaList.map((tiendaServicio, index) => {
                          const tienda = tiendas.find(t => t.id_tienda === tiendaServicio.id_tienda);
                          return (
                            <div 
                              key={index}
                              className="p-4 rounded-lg"
                              style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                            >
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>
                                  {tienda?.nombre || `Tienda ${tiendaServicio.id_tienda}`}
                                </h3>
                                {(!isViewMode || canEditService) && (
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
                                    disabled={isViewMode && !canEditService}
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
                                    disabled={isViewMode && !canEditService}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                    onClick={() => router.push('/servicios')}
                  >
                    <span>Cancelar</span>
                  </button>
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

              {/* Edit Button in View Mode for Admin */}
              {isViewMode && canEditService && (
                <button
                  className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={() => router.push(`/servicios/form?id=${id}&mode=edit`)}
                >
                  <Edit size={18} />
                  <span>Editar Servicio</span>
                </button>
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
                  placeholder="Nota (opcional)"
                  value={newNota}
                  onChange={(e) => setNewNota(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                  onClick={() => {
                    setNewCodigo('');
                    setNewNota('');
                    setShowAddCodeModal(false);
                  }}
                >
                  <span>Cancelar</span>
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAddCode}
                >
                  <span>Agregar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Componente Selector Modal */}
      {showComponenteSelectorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
          >
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: colors.outlineVariant }}>
              <h3 className="text-lg font-bold" style={{ color: colors.onSurface }}>
                Seleccionar Servicio o Producto
              </h3>
              <button
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.background }}
                onClick={() => setShowComponenteSelectorModal(false)}
              >
                <X size={20} style={{ color: colors.onSurface }} />
              </button>
            </div>
            
            <div className="p-4">
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, borderWidth: '1px' }}>
                <Search size={18} style={{ color: colors.outline }} />
                <input
                  type="text"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: colors.onSurface }}
                  placeholder="Buscar servicio o producto..."
                  value={componenteSearchText}
                  onChange={(e) => setComponenteSearchText(e.target.value)}
                />
              </div>
              
              <div className="overflow-y-auto max-h-96">
                {isLoadingServicios ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-t-2 rounded-full animate-spin mr-3" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                    <p style={{ color: colors.outline }}>Cargando servicios y productos...</p>
                  </div>
                ) : allItems.length === 0 ? (
                  <p className="text-center py-8" style={{ color: colors.outline }}>
                    No se encontraron servicios ni productos
                  </p>
                ) : (
                  <div className="space-y-2">
                    {allItems.map((item, index) => {
                      const key = item.id_servicio || `${item.tipo}-${item.nombre}-${index}`;
                      return (
                        <div key={key}>
                          <button
                            className="w-full p-3 rounded-lg transition-colors hover:opacity-80"
                            style={{ backgroundColor: colors.background }}
                            onClick={() => handleAddServicioComponente(item)}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium" style={{ color: colors.onSurface }}>{item.nombre}</p>
                                <p className="text-sm" style={{ color: colors.outline }}>{item.categoria}</p>
                              </div>
                              <span 
                                className="px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: item.tipo === 'servicio' ? colors.primary : colors.tertiary }}
                              >
                                {item.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                              </span>
                            </div>
                          </button>
                          {index < allItems.length - 1 && (
                            <div className="h-px my-2" style={{ backgroundColor: colors.outlineVariant }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {serviciosPagination.totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: `1px solid ${colors.outlineVariant}` }}>
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.background }}
                    onClick={handleServicioPrevPage}
                    disabled={serviciosPagination.currentPage === 1}
                  >
                    <span className="text-xl font-bold" style={{ color: serviciosPagination.currentPage === 1 ? colors.outline : colors.onSurface }}>&lt;</span>
                  </button>
                  <span className="text-sm" style={{ color: colors.onSurface }}>
                    {serviciosPagination.currentPage} / {serviciosPagination.totalPages}
                  </span>
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.background }}
                    onClick={handleServicioNextPage}
                    disabled={serviciosPagination.currentPage === serviciosPagination.totalPages}
                  >
                    <span className="text-xl font-bold" style={{ color: serviciosPagination.currentPage === serviciosPagination.totalPages ? colors.outline : colors.onSurface }}>&gt;</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
