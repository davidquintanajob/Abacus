'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { createProducto, updateProducto, getProductoById } from '../../../services/productoService';
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
  Image,
  XCircle
} from 'lucide-react';

export default function ProductoFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingProducto, setIsFetchingProducto] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    esvendible: true,
    nota: '',
    sufijo: '',
    isVencible: false,
    unidad_medida: '',
    imagen: null as string | null,
    codigoList: [] as Array<{ codigo_barras_ean: string; nota: string | null }>,
    productoTiendaList: [] as Array<{ id_tienda: number; precio_cup: number | null; precio_usd: number | null; costo_cup: number | null; costo_usd: number | null }>,
    precio_cup_general: null as number | null,
    precio_usd_general: null as number | null,
    costo_cup_general: null as number | null,
    costo_usd_general: null as number | null,
  });

  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [priceInputTexts, setPriceInputTexts] = useState({});
  const [generalPriceInputTexts, setGeneralPriceInputTexts] = useState({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imagen: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    setShowImagePickerModal(false);
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const userRole = user?.rol?.toLowerCase();
  const isAdmin = userRole === 'administrador';
  const isEconomico = userRole === 'económico';
  const isDependiente = userRole === 'dependiente';
  const isAlmacenero = userRole === 'almacenero';
  const canEditProduct = isAdmin;
  const canEditCodes = isAdmin;
  const canViewCosts = !isDependiente && !isAlmacenero;

  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    if (id && (isEditMode || isViewMode)) {
      fetchProducto();
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

  const fetchProducto = async () => {
    if (!id) return;
    try {
      setIsFetchingProducto(true);
      const producto = await getProductoById(id);
      
      // Extract cost from first tienda if general cost is not available
      const tiendaList = producto.tiendas_servicio || producto.tiendas_producto || [];
      const firstTienda = tiendaList.length > 0 ? tiendaList[0] : null;
      
      const imagenValue = producto.producto?.imagen || producto.imagen || null;
      
      setFormData({
        nombre: producto.nombre || '',
        categoria: producto.categoria || '',
        esvendible: producto.esvendible !== undefined ? producto.esvendible : true,
        nota: producto.nota || '',
        sufijo: producto.producto?.sufijo || producto.sufijo || '',
        isVencible: producto.producto?.isVencible !== undefined ? producto.producto.isVencible : (producto.isVencible || false),
        unidad_medida: producto.producto?.unidad_medida || producto.unidad_medida || '',
        imagen: imagenValue,
        codigoList: producto.codigos || [],
        productoTiendaList: tiendaList,
        precio_cup_general: producto.precio_cup_general || null,
        precio_usd_general: producto.precio_usd_general || null,
        costo_cup_general: producto.costo_cup_general ?? firstTienda?.costo_cup ?? null,
        costo_usd_general: producto.costo_usd_general ?? firstTienda?.costo_usd ?? null,
      });

      if (producto.codigos && producto.codigos.length > 0) {
        setIsCodesExpanded(true);
      }
      if (tiendaList && tiendaList.length > 0) {
        setIsPricesExpanded(true);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar datos del producto' });
    } finally {
      setIsFetchingProducto(false);
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

      // Helper function to safely convert to number with 5 decimal places
      const toFixed5 = (value: any) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
      };

      // Construct productoTiendaList without cantidad field (like APK)
      const productoTiendaList = (() => {
        let baseList: any[] = [];
        
        // If user has configured specific stores in productoTiendaList, only include those stores
        if (formData.productoTiendaList.length > 0) {
          formData.productoTiendaList.forEach((specific: any) => {
            if (specific.id_tienda === null) return;
            
            baseList.push({
              id_tienda: specific.id_tienda,
              precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
              precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
            });
          });
        } 
        // If no specific stores configured but general prices exist, apply to all active stores
        else if (formData.precio_cup_general !== null || formData.precio_usd_general !== null) {
          baseList = tiendas.filter(tienda => tienda.activo === true).map(tienda => ({
            id_tienda: tienda.id_tienda,
            precio_cup: toFixed5(formData.precio_cup_general),
            precio_usd: toFixed5(formData.precio_usd_general),
          }));
        }
        
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
        sufijo: formData.sufijo || null,
        isVencible: formData.isVencible,
        unidad_medida: formData.unidad_medida || null,
        imagen: (() => {
          // Only send image if it's base64 or full URL, not relative path
          if (!formData.imagen) return undefined;
          const isBase64 = formData.imagen.startsWith('data:');
          const isFullUrl = formData.imagen.startsWith('http://') || formData.imagen.startsWith('https://');
          return (isBase64 || isFullUrl) ? formData.imagen : undefined;
        })(),
        codigoList: formData.codigoList,
        productoTiendaList,
      };

      if (isEditMode) {
        await updateProducto(id!, dataToSend);
        showToast({ type: 'success', message: 'Producto actualizado correctamente' });
      } else {
        await createProducto(dataToSend);
        showToast({ type: 'success', message: 'Producto creado correctamente' });
      }
      
      router.push('/productos');
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
    setShowScannerModal(false);
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

  const handleAddTiendaProducto = () => {
    const existingTiendaIds = formData.productoTiendaList.map(item => item.id_tienda);
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
      productoTiendaList: [...prev.productoTiendaList, ...newTiendaEntries]
    }));
  };

  const handleRemoveTiendaProducto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.filter((_, i) => i !== index)
    }));
  };

  const handleTiendaProductoChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedList = prev.productoTiendaList.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: parseFloat(value) || 0 };
          
          // Automatic currency conversion for tienda prices
          if (exchangeRate !== null && exchangeRate > 0) {
            if (field === 'precio_cup' && value !== '') {
              const usdValue = parseFloat(value) / exchangeRate;
              updatedItem.precio_usd = parseFloat(usdValue.toFixed(5));
            }
            if (field === 'precio_usd' && value !== '') {
              const cupValue = parseFloat(value) * exchangeRate;
              updatedItem.precio_cup = parseFloat(cupValue.toFixed(5));
            }
            if (field === 'costo_cup' && value !== '') {
              const usdValue = parseFloat(value) / exchangeRate;
              updatedItem.costo_usd = parseFloat(usdValue.toFixed(5));
            }
            if (field === 'costo_usd' && value !== '') {
              const cupValue = parseFloat(value) * exchangeRate;
              updatedItem.costo_cup = parseFloat(cupValue.toFixed(5));
            }
          }
          
          return updatedItem;
        }
        return item;
      });
      return { ...prev, productoTiendaList: updatedList };
    });
  };

  const handleGeneralPriceChange = (field: string, value: number | null) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Automatic currency conversion
      if (exchangeRate !== null && exchangeRate > 0) {
        if (field === 'precio_cup_general' && value !== null) {
          const usdValue = value / exchangeRate;
          updated.precio_usd_general = parseFloat(usdValue.toFixed(5));
        }
        if (field === 'precio_usd_general' && value !== null) {
          const cupValue = value * exchangeRate;
          updated.precio_cup_general = parseFloat(cupValue.toFixed(5));
        }
        if (field === 'costo_cup_general' && value !== null) {
          const usdValue = value / exchangeRate;
          updated.costo_usd_general = parseFloat(usdValue.toFixed(5));
        }
        if (field === 'costo_usd_general' && value !== null) {
          const cupValue = value * exchangeRate;
          updated.costo_cup_general = parseFloat(cupValue.toFixed(5));
        }
      }
      
      return updated;
    });
    
    // Auto-apply to tiendas if all general prices are set and no tiendas exist yet
    const hasAllGeneralPrices = formData.precio_cup_general !== null && formData.precio_usd_general !== null;
    if (hasAllGeneralPrices && formData.productoTiendaList.length === 0) {
      const newProductoTiendaList = tiendas.filter(tienda => tienda.activo === true).map(tienda => ({
        id_tienda: tienda.id_tienda,
        precio_cup: formData.precio_cup_general || 0,
        precio_usd: formData.precio_usd_general || 0,
        costo_cup: canViewCosts ? (formData.costo_cup_general || 0) : 0,
        costo_usd: canViewCosts ? (formData.costo_usd_general || 0) : 0,
      }));
      
      setFormData(prev => ({
        ...prev,
        productoTiendaList: newProductoTiendaList
      }));
      setIsPricesExpanded(true);
    } else if (hasAllGeneralPrices && formData.productoTiendaList.length > 0) {
      setFormData(prev => ({
        ...prev,
        productoTiendaList: prev.productoTiendaList.map(item => ({
          ...item,
          precio_cup: formData.precio_cup_general !== null ? formData.precio_cup_general : item.precio_cup,
          precio_usd: formData.precio_usd_general !== null ? formData.precio_usd_general : item.precio_usd,
          costo_cup: canViewCosts ? (formData.costo_cup_general !== null ? formData.costo_cup_general : item.costo_cup) : item.costo_cup,
          costo_usd: canViewCosts ? (formData.costo_usd_general !== null ? formData.costo_usd_general : item.costo_usd) : item.costo_usd,
        }))
      }));
    }
  };

  const handleApplyGeneralPrices = () => {
    if (!formData.precio_cup_general && !formData.precio_usd_general && !formData.costo_cup_general && !formData.costo_usd_general) {
      showToast({ type: 'warning', message: 'Debe especificar al menos un precio o costo general' });
      return;
    }

    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.map(item => ({
        ...item,
        precio_cup: formData.precio_cup_general !== null ? formData.precio_cup_general : item.precio_cup,
        precio_usd: formData.precio_usd_general !== null ? formData.precio_usd_general : item.precio_usd,
        costo_cup: canViewCosts ? (formData.costo_cup_general !== null ? formData.costo_cup_general : item.costo_cup) : item.costo_cup,
        costo_usd: canViewCosts ? (formData.costo_usd_general !== null ? formData.costo_usd_general : item.costo_usd) : item.costo_usd,
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
      
      <SidebarNavigation 
        currentRoute="Productos" 
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
          showViewToggle={false}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Productos"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="flex items-center mb-6 mt-4">
            <button
              className="mr-4 p-2 rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.surface, color: colors.onSurface }}
              onClick={() => router.push('/productos')}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              {isAddMode ? 'Agregar Producto' : isEditMode ? 'Editar Producto' : 'Ver Producto'}
            </h1>
          </div>

          {isFetchingProducto ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando datos del producto...</p>
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
                    placeholder="Nombre del producto"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Categoría and Sufijo in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Categoría *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Categoría"
                      value={formData.categoria}
                      onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Código interno (Sufijo) *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Sufijo"
                      value={formData.sufijo}
                      onChange={(e) => setFormData(prev => ({ ...prev, sufijo: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Image Section */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2 text-center"
                    style={{ color: colors.outline }}
                  >
                    Imagen
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    {(() => {
                      if (!formData.imagen) return null;
                      
                      const isBase64 = formData.imagen.startsWith('data:');
                      const isFullUrl = formData.imagen.startsWith('http://') || formData.imagen.startsWith('https://');
                      const fullImageUrl = isBase64 || isFullUrl ? formData.imagen : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${formData.imagen}`;
                      
                      return (
                        <div className="relative">
                          <img
                            src={fullImageUrl}
                            alt="Producto"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          {!isReadOnly && (
                            <button
                              className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white"
                              onClick={() => setFormData(prev => ({ ...prev, imagen: null }))}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })() || (
                      <button
                        className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: colors.background, 
                          borderColor: colors.outlineVariant 
                        }}
                        onClick={() => !isReadOnly && handlePickImage()}
                        disabled={isReadOnly}
                      >
                        <Image size={32} style={{ color: colors.outline }} />
                        <span className="text-xs mt-1" style={{ color: colors.outline }}>
                          {isReadOnly ? 'Sin imagen' : 'Seleccionar'}
                        </span>
                      </button>
                    )}
                    {!isReadOnly && formData.imagen && (
                      <button
                        className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={handlePickImage}
                      >
                        <Image size={16} />
                        <span>Cambiar</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImagePick}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Cost fields (only for canViewCosts) */}
                {canViewCosts && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
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
                        onChange={(e) => handleGeneralPriceChange('costo_cup_general', parseFloat(e.target.value) || null)}
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
                        onChange={(e) => handleGeneralPriceChange('costo_usd_general', parseFloat(e.target.value) || null)}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                )}

                {/* Unidad de Medida and Nota in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Unidad de Medida
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Unidad (opcional)"
                      value={formData.unidad_medida}
                      onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Nota
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Nota (opcional)"
                      value={formData.nota}
                      onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Es Perecedero and Estado in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Es Perecedero
                    </label>
                    <div className="flex items-center">
                      <button
                        className={`relative w-28 h-8 rounded-full transition-colors duration-200 ${formData.isVencible ? 'bg-green-500' : 'bg-red-500'}`}
                        onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, isVencible: !prev.isVencible }))}
                        disabled={isReadOnly}
                      >
                        <div 
                          className="absolute top-1 left-1 w-20 h-6 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center text-xs font-bold"
                          style={{
                            transform: formData.isVencible ? 'translateX(0)' : 'translateX(28px)',
                            color: formData.isVencible ? '#4CAF50' : '#F44336'
                          }}
                        >
                          {formData.isVencible ? 'Sí' : 'No'}
                        </div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Estado
                    </label>
                    <div className="flex items-center">
                      <button
                        className={`relative w-32 h-8 rounded-full transition-colors duration-200 ${formData.esvendible ? 'bg-green-500' : 'bg-red-500'}`}
                        onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, esvendible: !prev.esvendible }))}
                        disabled={isReadOnly}
                      >
                        <div 
                          className="absolute top-1 left-1 w-24 h-6 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center text-xs font-bold"
                          style={{
                            transform: formData.esvendible ? 'translateX(0)' : 'translateX(28px)',
                            color: formData.esvendible ? '#4CAF50' : '#F44336'
                          }}
                        >
                          {formData.esvendible ? 'Vendible' : 'No vendible'}
                        </div>
                      </button>
                    </div>
                  </div>
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
                    Códigos de los productos
                  </h2>
                  <div className="flex gap-2">
                    {canEditCodes && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={() => setShowScannerModal(true)}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, border: '1px solid' }}
                      onClick={() => setIsCodesExpanded(!isCodesExpanded)}
                    >
                      {isCodesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isCodesExpanded && (
                  <>
                    <div className="space-y-3 mb-4">
                      {formData.codigoList.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: colors.outline }}>
                          No hay códigos agregados
                        </p>
                      ) : (
                        formData.codigoList.map((codigo, index) => (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ backgroundColor: colors.background }}
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
                        ))
                      )}
                    </div>
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
                      onChange={(e) => handleGeneralPriceChange('precio_cup_general', parseFloat(e.target.value) || null)}
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
                      onChange={(e) => handleGeneralPriceChange('precio_usd_general', parseFloat(e.target.value) || null)}
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
                    {canEditProduct && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={handleAddTiendaProducto}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, border: '1px solid' }}
                      onClick={() => setIsPricesExpanded(!isPricesExpanded)}
                    >
                      {isPricesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isPricesExpanded && (
                  <>
                    <div className="space-y-4 mb-4">
                      {formData.productoTiendaList.map((tiendaProducto, index) => {
                        const tienda = tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda);
                        return (
                          <div 
                            key={index}
                            className="p-4 rounded-lg"
                            style={{ backgroundColor: colors.background }}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-semibold" style={{ color: colors.onSurface }}>
                                {tienda?.nombre || `Tienda ${tiendaProducto.id_tienda}`}
                              </h3>
                              {!isReadOnly && (
                                <button
                                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={() => handleRemoveTiendaProducto(index)}
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
                                  value={tiendaProducto.precio_cup ?? ''}
                                  onChange={(e) => handleTiendaProductoChange(index, 'precio_cup', e.target.value)}
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
                                  value={tiendaProducto.precio_usd ?? ''}
                                  onChange={(e) => handleTiendaProductoChange(index, 'precio_usd', e.target.value)}
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
                                  value={tiendaProducto.costo_cup ?? ''}
                                  onChange={(e) => handleTiendaProductoChange(index, 'costo_cup', e.target.value)}
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
                                  value={tiendaProducto.costo_usd ?? ''}
                                  onChange={(e) => handleTiendaProductoChange(index, 'costo_usd', e.target.value)}
                                  disabled={isReadOnly}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface, border: '1px solid', borderColor: colors.outlineVariant }}
                    onClick={() => router.back()}
                  >
                    <XCircle size={18} />
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

        {/* Scanner Modal */}
        {showScannerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: colors.surface }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Escanear Código
              </h2>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Código de barras
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Escanear o ingresar código"
                  value={newCodigo}
                  onChange={(e) => setNewCodigo(e.target.value)}
                  autoFocus
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
                    setShowScannerModal(false);
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
