'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { useNavigationLoading } from '../../../../context/NavigationLoadingContext';
import { Header } from '../../../../components/layout/Header';
import { Toast } from '../../../../components/common/Toast';
import { createSalida, updateSalida, getSalidaById } from '../../../../services/salidaService';
import { getProductos } from '../../../../services/productoService';
import { getTiendas } from '../../../../services/tiendaService';
import { ChevronLeft, Save, X } from 'lucide-react';
import { useResponsive } from '../../../../hooks/useResponsive';

export default function SalidaFormPage() {
  const router = useRouter();
  const params = useParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingSalida, setIsFetchingSalida] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [displayProductoName, setDisplayProductoName] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [productoSearchResults, setProductoSearchResults] = useState<any[]>([]);
  const [isSearchingProductos, setIsSearchingProductos] = useState(false);
  const [isEditingProducto, setIsEditingProducto] = useState(false);
  const [justSelectedProducto, setJustSelectedProducto] = useState(false);

  const predefinedSalidaTypes = ['Perdida', 'Consumo personal', 'Baja', 'Ajuste de Inventario'];
  const [customSalidaTypes, setCustomSalidaTypes] = useState<string[]>([]);
  const [showTipoSalidaDropdown, setShowTipoSalidaDropdown] = useState(false);
  const [tipoSalidaSearchText, setTipoSalidaSearchText] = useState('');

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const id = params.id as string;
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const mode = searchParams.get('mode') || 'view';

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [formData, setFormData] = useState({
    id_servicio_tienda: null as number | null,
    cantidad_total: '',
    descripcion: '',
    tipo_salida: '',
    fecha: new Date().toISOString().split('T')[0],
    producto: null as any,
    tienda: null as any,
  });

  const [originalCantidad, setOriginalCantidad] = useState(0);

  // Reset navigation loading state when page loads
  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  useEffect(() => {
    fetchTiendas();
    loadCustomSalidaTypes();
  }, []);

  const loadCustomSalidaTypes = async () => {
    try {
      // Load from localStorage as backup
      const asyncStorageTypes = localStorage.getItem('customSalidaTypes');
      if (asyncStorageTypes) {
        const parsedTypes = JSON.parse(asyncStorageTypes);
        setCustomSalidaTypes(parsedTypes);
      }
    } catch (error) {
      console.error('Error loading custom salida types:', error);
    }
  };

  const saveCustomSalidaType = async (newType: string) => {
    if (!newType || newType.trim() === '') return;
    
    const allTypes = [...predefinedSalidaTypes, ...customSalidaTypes];
    if (allTypes.includes(newType.trim())) return;
    
    const updatedTypes = [...customSalidaTypes, newType.trim()];
    setCustomSalidaTypes(updatedTypes);
    
    try {
      localStorage.setItem('customSalidaTypes', JSON.stringify(updatedTypes));
    } catch (error) {
      console.error('Error saving custom salida type:', error);
    }
  };

  useEffect(() => {
    const fetchCompleteSalida = async () => {
      if (id && id !== 'add') {
        try {
          setIsFetchingSalida(true);
          const completeSalida = await getSalidaById(id);
          
          const productoCompleto = completeSalida.servicioTienda?.servicio;
          
          if (productoCompleto && completeSalida.servicioTienda) {
            productoCompleto.tiendas_servicio = [completeSalida.servicioTienda];
          }
          
          setFormData({
            id_servicio_tienda: completeSalida.id_servicio_tienda,
            cantidad_total: completeSalida.cantidad_total.toString(),
            descripcion: completeSalida.descripcion || '',
            tipo_salida: completeSalida.tipo_salida || 'Venta',
            fecha: completeSalida.fecha ? completeSalida.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
            producto: productoCompleto,
            tienda: completeSalida.servicioTienda?.tienda,
          });
          
          setDisplayProductoName((productoCompleto?.nombre || '').trimEnd());
          setOriginalCantidad(completeSalida.cantidad_total);
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Error al cargar salida', code: err.code });
        } finally {
          setIsFetchingSalida(false);
        }
      }
    };

    fetchCompleteSalida();
  }, [id]);

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      let allTiendas = data.data?.filter((t: any) => t.activo === true) || [];
      setTiendas(allTiendas);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
    }
  };

  const searchProductos = async (searchTerm: string) => {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        setProductoSearchResults([]);
        return;
      }
      setIsSearchingProductos(true);
      const data = await getProductos({ nombre: searchTerm, skipCantidadMin: true, skipEsvendible: true }, 1, 20);
      setProductoSearchResults(data.data || []);
    } catch (err) {
      setProductoSearchResults([]);
    } finally {
      setIsSearchingProductos(false);
    }
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto' });
      return;
    }
    if (!formData.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
      return;
    }
    if (!formData.cantidad_total || parseFloat(formData.cantidad_total) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que 0' });
      return;
    }
    if (!formData.descripcion || formData.descripcion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar una descripción' });
      return;
    }
    if (!formData.tipo_salida || formData.tipo_salida.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar el tipo de salida' });
      return;
    }

    // Validar si el producto tiene relación con la tienda
    const productoTienda = formData.producto?.tiendas_servicio?.find(
      (ts: any) => ts.id_tienda === formData.tienda?.id_tienda
    );

    if (!productoTienda) {
      showToast({ type: 'warning', message: 'El producto no tiene relación con esta tienda. Primero debe agregar el producto a la tienda mediante una entrada.' });
      return;
    }

    // Validar stock disponible
    const cantidadDisponible = parseFloat(productoTienda.cantidad) || 0;
    const cantidadSolicitada = parseFloat(formData.cantidad_total);
    
    const stockDisponibleEfectivo = isEditMode ? cantidadDisponible + originalCantidad : cantidadDisponible;
    
    if (cantidadSolicitada > stockDisponibleEfectivo) {
      if (isEditMode) {
        showToast({ 
          type: 'warning', 
          message: `Solo hay ${cantidadDisponible} unidades disponibles + ${originalCantidad} unidades de la salida original (${stockDisponibleEfectivo} total). No puede solicitar ${cantidadSolicitada} unidades.` 
        });
      } else {
        showToast({ 
          type: 'warning', 
          message: `Solo hay ${cantidadDisponible} unidades disponibles en la tienda "${formData.tienda.nombre}".` 
        });
      }
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    try {
      setIsSaving(true);

      const productoTienda = formData.producto.tiendas_servicio?.find(
        (ts: any) => ts.id_tienda === formData.tienda.id_tienda
      );

      const id_servicio_tienda = productoTienda?.id_servicio_tienda;

      if (!id_servicio_tienda) {
        throw new Error('Error al obtener relación producto-tienda');
      }

      const salidaData = {
        id_servicio_tienda,
        cantidad_total: parseFloat(formData.cantidad_total),
        descripcion: formData.descripcion,
        tipo_salida: formData.tipo_salida,
        fecha: formData.fecha ? `${formData.fecha}T12:00:00` : null,
        id_usuario: user.id_usuario,
      };

      if (isEditMode) {
        await updateSalida(id, salidaData);
        showToast({ type: 'success', message: 'Salida actualizada correctamente' });
      } else {
        await createSalida(salidaData);
        showToast({ type: 'success', message: 'Salida creada correctamente' });
      }
      
      router.push('/salidas');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Error al guardar salida', code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTiendaSelect = (tienda: any) => {
    setFormData(prev => ({
      ...prev,
      tienda,
    }));

    setShowTiendaDropdown(false);
    setTiendaSearchText('');
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!isEditingProducto) {
        return;
      }
      
      if (justSelectedProducto) {
        return;
      }
      
      const isMatchingSelectedProduct = formData.producto && 
        productoSearchText === formData.producto.nombre;
      
      if (productoSearchText.length >= 2 && !isMatchingSelectedProduct) {
        searchProductos(productoSearchText);
        setShowProductoDropdown(true);
      } else {
        setProductoSearchResults([]);
        setShowProductoDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [productoSearchText, formData.producto, isEditingProducto, justSelectedProducto]);

  const handleProductoSelect = (producto: any) => {
    setFormData(prev => ({
      ...prev,
      producto,
    }));
    
    setDisplayProductoName(producto.nombre.trimEnd());
    setProductoSearchText('');
    setIsEditingProducto(false);
    setShowProductoDropdown(false);
    setProductoSearchResults([]);
    setJustSelectedProducto(true);
  };

  const filteredTiendas = tiendas.filter((tienda: any) =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const allSalidaTypes = [...predefinedSalidaTypes, ...customSalidaTypes];
  const filteredSalidaTypes = allSalidaTypes.filter((type: string) =>
    type.toLowerCase().includes(tipoSalidaSearchText.toLowerCase())
  );

  const getStockInfo = () => {
    if (!formData.producto || !formData.tienda) {
      return null;
    }
    
    let servicioTienda = formData.producto.tiendas_servicio?.find(
      (ts: any) => ts.id_tienda === formData.tienda.id_tienda
    );
    
    if (!servicioTienda && formData.id_servicio_tienda) {
      servicioTienda = formData.producto.tiendas_servicio?.find(
        (ts: any) => ts.id_tienda === formData.tienda.id_tienda
      );
    }
    
    let costoCup = 0;
    let costoUsd = 0;
    
    if (servicioTienda) {
      costoCup = parseFloat(servicioTienda.costo_cup) || 0;
      costoUsd = parseFloat(servicioTienda.costo_usd) || 0;
    } else {
      const firstTiendaServicio = formData.producto.tiendas_servicio?.[0];
      costoCup = parseFloat(firstTiendaServicio?.costo_cup) || 0;
      costoUsd = parseFloat(firstTiendaServicio?.costo_usd) || 0;
    }
    
    const currentStock = servicioTienda ? (parseFloat(servicioTienda.cantidad) || 0) : 0;
    const newCantidad = parseFloat(formData.cantidad_total) || 0;
    const cantidadDiff = originalCantidad - newCantidad;
    
    return {
      cantidad: currentStock,
      cantidadDiff: cantidadDiff,
      costo_cup: costoCup,
      costo_usd: costoUsd,
    };
  };

  const getFinancialInfo = () => {
    if (!formData.cantidad_total) {
      return null;
    }

    const stockInfo = getStockInfo();
    if (!stockInfo) return null;

    const cantidad = parseFloat(formData.cantidad_total) || 0;
    const costoCup = stockInfo.costo_cup;
    const costoUsd = stockInfo.costo_usd;

    const costoTotalCup = costoCup * cantidad;
    const costoTotalUsd = costoUsd * cantidad;
    
    const originalCostoTotalCup = costoCup * originalCantidad;
    const originalCostoTotalUsd = costoUsd * originalCantidad;
    
    const costoTotalCupDiff = originalCostoTotalCup - costoTotalCup;
    const costoTotalUsdDiff = originalCostoTotalUsd - costoTotalUsd;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      costoCup: !isNaN(costoCup) ? costoCup : 0,
      costoUsd: !isNaN(costoUsd) ? costoUsd : 0,
      costoTotalCupDiff: !isNaN(costoTotalCupDiff) ? costoTotalCupDiff : 0,
      costoTotalUsdDiff: !isNaN(costoTotalUsdDiff) ? costoTotalUsdDiff : 0,
    };
  };

  const canManageSalidas = isAdmin || user?.permissions?.salida;

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
          onBackPress={() => router.push('/salidas')}
          isDark={isDarkMode}
          title={isViewMode ? 'Información de Salida' : isEditMode ? 'Editar Salida' : 'Agregar Salida'}
          currentRoute="salidas"
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
          maxWidth: isDesktop ? '800px' : '100%',
        }}>
          {isFetchingSalida ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div 
              className="rounded-2xl p-6 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              {/* Producto Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                  Producto *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Buscar producto..."
                    value={isEditingProducto ? productoSearchText : displayProductoName}
                    onChange={(e) => {
                      setProductoSearchText(e.target.value);
                      setJustSelectedProducto(false);
                      if (!isEditingProducto) {
                        setIsEditingProducto(true);
                      }
                    }}
                    onFocus={() => {
                      if (!isReadOnly && !justSelectedProducto) {
                        setIsEditingProducto(true);
                        setProductoSearchText(displayProductoName);
                      }
                    }}
                    onBlur={() => {
                      setIsEditingProducto(false);
                      if (!formData.producto) {
                        setDisplayProductoName(productoSearchText);
                      } else if (!justSelectedProducto) {
                        setProductoSearchText('');
                        setDisplayProductoName(formData.producto.nombre);
                      }
                    }}
                    disabled={isReadOnly}
                  />
                  {showProductoDropdown && productoSearchResults.length > 0 && (
                    <div 
                      className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto"
                      style={{ 
                        backgroundColor: colors.surface, 
                        borderColor: colors.outlineVariant
                      }}
                    >
                      {isSearchingProductos && (
                        <div className="flex items-center justify-center py-4 gap-2">
                          <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                          <span style={{ color: colors.outline, fontSize: '14px' }}>Buscando...</span>
                        </div>
                      )}
                      {!isSearchingProductos && productoSearchResults.map((producto) => (
                        <button
                          key={producto.id_servicio}
                          className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                          style={{ color: colors.onSurface }}
                          onClick={() => handleProductoSelect(producto)}
                        >
                          {producto.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tienda Selection and Cantidad Total */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                    Tienda *
                  </label>
                  <div className="relative">
                    <button
                      className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: formData.tienda ? colors.onSurface : colors.outline,
                        borderColor: colors.outlineVariant
                      }}
                      onClick={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                      disabled={isReadOnly}
                    >
                      <span className="truncate">
                        {formData.tienda?.nombre || 'Seleccionar tienda'}
                      </span>
                      {!isReadOnly && (
                        showTiendaDropdown ? (
                          <X size={20} style={{ color: colors.outline }} />
                        ) : (
                          <ChevronLeft size={20} style={{ color: colors.outline }} />
                        )
                      )}
                    </button>
                    
                    {showTiendaDropdown && (
                      <div 
                        className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant
                        }}
                      >
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-b"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="Buscar tienda..."
                          value={tiendaSearchText}
                          onChange={(e) => setTiendaSearchText(e.target.value)}
                        />
                        {filteredTiendas.length > 0 ? (
                          filteredTiendas.map((tienda) => (
                            <button
                              key={tienda.id_tienda}
                              className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                              style={{ color: colors.onSurface }}
                              onClick={() => handleTiendaSelect(tienda)}
                            >
                              {tienda.nombre}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2" style={{ color: colors.outline }}>
                            No se encontraron tiendas
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-1/3">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                    Cantidad Total *
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Cantidad"
                    value={formData.cantidad_total}
                    onChange={(e) => {
                      const sanitizedText = e.target.value.replace(/-/g, '');
                      
                      const stockInfo = getStockInfo();
                      if (stockInfo) {
                        const maxValue = isEditMode ? stockInfo.cantidad + originalCantidad : stockInfo.cantidad;
                        const newValue = parseFloat(sanitizedText);
                        
                        if (sanitizedText === '') {
                          setFormData(prev => ({ ...prev, cantidad_total: sanitizedText }));
                          return;
                        }
                        
                        if (!isNaN(newValue) && newValue > maxValue) {
                          showToast({ 
                            type: 'warning', 
                            message: `La cantidad no puede exceder ${maxValue}` 
                          });
                          return;
                        }
                      }
                      setFormData(prev => ({ ...prev, cantidad_total: sanitizedText }));
                    }}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Stock Info */}
              {canManageSalidas && formData.producto && formData.tienda && (
                <div 
                  className="rounded-lg p-4 mb-4"
                  style={{ 
                    backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', 
                    borderColor: colors.primary,
                    border: '1px solid'
                  }}
                >
                  <h3 className="font-semibold mb-3" style={{ color: colors.primary }}>
                    Información de Stock
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span style={{ color: colors.onSurface }}>Cantidad disponible:</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: colors.primary }}>
                          {getStockInfo()?.cantidad || 0}
                        </span>
                        {isEditMode && getStockInfo()?.cantidadDiff !== 0 && (
                          <span style={{ color: getStockInfo()?.cantidadDiff > 0 ? '#4CAF50' : '#F44336' }}>
                            {getStockInfo()?.cantidadDiff > 0 ? '+' : ''}{getStockInfo()?.cantidadDiff}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: colors.onSurface }}>Costo unitario CUP:</span>
                      <span style={{ color: colors.onSurface }}>
                        ${(parseFloat(String(getStockInfo()?.costo_cup || '0'))).toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: colors.onSurface }}>Costo unitario USD:</span>
                      <span style={{ color: colors.onSurface }}>
                        ${(parseFloat(String(getStockInfo()?.costo_usd || '0'))).toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tipo de Salida and Fecha */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1" style={{ width: '60%' }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                    Tipo de Salida *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Tipo de salida..."
                      value={formData.tipo_salida}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, tipo_salida: e.target.value }));
                        setTipoSalidaSearchText(e.target.value);
                        setShowTipoSalidaDropdown(true);
                      }}
                      onFocus={() => !isReadOnly && setShowTipoSalidaDropdown(true)}
                      disabled={isReadOnly}
                    />
                    
                    {showTipoSalidaDropdown && (
                      <div 
                        className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant
                        }}
                      >
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-b"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="Buscar tipo..."
                          value={tipoSalidaSearchText}
                          onChange={(e) => setTipoSalidaSearchText(e.target.value)}
                        />
                        {filteredSalidaTypes.map((type) => (
                          <button
                            key={type}
                            className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, tipo_salida: type }));
                              setShowTipoSalidaDropdown(false);
                              setTipoSalidaSearchText('');
                            }}
                          >
                            {type}
                          </button>
                        ))}
                        {tipoSalidaSearchText && !filteredSalidaTypes.includes(tipoSalidaSearchText) && (
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors border-t"
                            style={{ 
                              color: colors.primary,
                              borderColor: colors.outlineVariant
                            }}
                            onClick={() => {
                              saveCustomSalidaType(tipoSalidaSearchText);
                              setFormData(prev => ({ ...prev, tipo_salida: tipoSalidaSearchText }));
                              setShowTipoSalidaDropdown(false);
                              setTipoSalidaSearchText('');
                            }}
                          >
                            Agregar "{tipoSalidaSearchText}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1" style={{ width: '40%' }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      colorScheme: isDarkMode ? 'dark' : 'light'
                    }}
                    value={formData.fecha}
                    onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.onSurface }}>
                  Descripción *
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    minHeight: '100px'
                  }}
                  placeholder="Descripción de la salida..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  disabled={isReadOnly}
                />
              </div>

              {/* Financial Info */}
              {canManageSalidas && formData.cantidad_total && formData.producto && formData.tienda && (
                <div 
                  className="rounded-lg p-4 mb-4"
                  style={{ 
                    backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', 
                    borderColor: colors.primary,
                    border: '1px solid'
                  }}
                >
                  <h3 className="font-semibold mb-3" style={{ color: colors.primary }}>
                    Información Financiera
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span style={{ color: colors.onSurface }}>Costo total CUP:</span>
                      <span style={{ color: colors.onSurface }}>
                        ${(parseFloat(String(getFinancialInfo()?.costoTotalCup || '0'))).toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: colors.onSurface }}>Costo total USD:</span>
                      <span style={{ color: colors.onSurface }}>
                        ${(parseFloat(String(getFinancialInfo()?.costoTotalUsd || '0'))).toFixed(2) || '0.00'}
                      </span>
                    </div>
                    {isEditMode && (
                      <>
                        <div className="flex justify-between">
                          <span style={{ color: colors.onSurface }}>Diferencia CUP:</span>
                          <span style={{ color: getFinancialInfo()?.costoTotalCupDiff > 0 ? '#4CAF50' : '#F44336' }}>
                            {getFinancialInfo()?.costoTotalCupDiff > 0 ? '+' : ''}{(parseFloat(String(getFinancialInfo()?.costoTotalCupDiff || '0'))).toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.onSurface }}>Diferencia USD:</span>
                          <span style={{ color: getFinancialInfo()?.costoTotalUsdDiff > 0 ? '#4CAF50' : '#F44336' }}>
                            {getFinancialInfo()?.costoTotalUsdDiff > 0 ? '+' : ''}{(parseFloat(String(getFinancialInfo()?.costoTotalUsdDiff || '0'))).toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      border: '1px solid'
                    }}
                    onClick={() => router.push('/salidas')}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Save size={16} />
                        <span>{isEditMode ? 'Actualizar' : 'Guardar'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
