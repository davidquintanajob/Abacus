'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { Header } from '../../../../components/layout/Header';
import { SidebarNavigation } from '../../../../components/layout/SidebarNavigation';
import { Toast } from '../../../../components/common/Toast';
import { useResponsive } from '../../../../hooks/useResponsive';
import { getTiendas } from '../../../../services/tiendaService';
import { getProductos, getProductoById } from '../../../../services/productoService';
import { createEntrada, updateEntrada, getEntradaById } from '../../../../services/entradaService';
import { 
  ArrowLeft,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Info,
  TrendingUp,
  Calendar,
  Edit
} from 'lucide-react';

export default function EntradaFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const { colors, isDark } = useTheme();
  const { token, user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);
  
  const mode = searchParams.get('mode') || 'edit';
  const entradaId = params.id as string;
  const productoId = searchParams.get('productoId');
  const tiendaId = searchParams.get('tiendaId');
  
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [productoSearchResults, setProductoSearchResults] = useState<any[]>([]);
  const [isSearchingProductos, setIsSearchingProductos] = useState(false);
  const [justSelectedProducto, setJustSelectedProducto] = useState(false);
  const [isMultipleMode, setIsMultipleMode] = useState(false);
  const [multipleEntradas, setMultipleEntradas] = useState<any[]>([]);
  const [multipleProductoSearchResults, setMultipleProductoSearchResults] = useState<Record<number, any[]>>({});
  const [multipleShowProductoDropdown, setMultipleShowProductoDropdown] = useState<Record<number, boolean>>({});
  const [multipleIsSearchingProductos, setMultipleIsSearchingProductos] = useState<Record<number, boolean>>({});
  const [multipleJustSelectedProducto, setMultipleJustSelectedProducto] = useState<Record<number, boolean>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFechaEntradaPicker, setShowFechaEntradaPicker] = useState(false);
  const [multipleShowDatePicker, setMultipleShowDatePicker] = useState<Record<number, boolean>>({});
  const [multipleShowFechaEntradaPicker, setMultipleShowFechaEntradaPicker] = useState<Record<number, boolean>>({});
  const [showCostSuggestionModal, setShowCostSuggestionModal] = useState(false);
  const [suggestedCosts, setSuggestedCosts] = useState(null);
  const [currentCosts, setCurrentCosts] = useState(null);
  const [isMultipleCostSuggestion, setIsMultipleCostSuggestion] = useState(false);
  const [multipleSuggestedCosts, setMultipleSuggestedCosts] = useState([]);
  const [multipleCurrentCosts, setMultipleCurrentCosts] = useState([]);
  const [hasManuallyModifiedCostos, setHasManuallyModifiedCostos] = useState(false);
  const [config, setConfig] = useState({ applyWeightedAverageCost: false });
  
  // Estados para formateo de precios/costos
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // Funciones de formateo
  const formatTo2Decimals = (value: number | null | string): string => {
    if (value === null || value === '' || value === undefined) return '';
    return parseFloat(String(value)).toFixed(2);
  };
  
  const formatTo5Decimals = (value: number | null | string): string => {
    if (value === null || value === '' || value === undefined) return '';
    return parseFloat(String(value)).toFixed(5);
  };
  
  const getFormattedValue = (value: number | null | string, fieldName: string): string => {
    if (focusedField === fieldName) {
      return formatTo5Decimals(value);
    }
    return formatTo2Decimals(value);
  };
  
  const [formData, setFormData] = useState<{
    id_servicio_tienda: number | null;
    cantidad_entrada: string;
    costo_usd: string;
    costo_cup: string;
    precio_usd: string;
    precio_cup: string;
    fecha_vencimiento: string;
    nombre_proveedor: string;
    fecha: string;
    producto: any;
    tienda: any;
  }>({
    id_servicio_tienda: null,
    cantidad_entrada: '',
    costo_usd: '',
    costo_cup: '',
    precio_usd: '',
    precio_cup: '',
    fecha_vencimiento: '',
    nombre_proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    producto: null,
    tienda: null,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const userRole = user?.rol?.toLowerCase();
  const canViewAllEntradas = isAdmin || 
    (userRole === 'dependiente') || 
    (userRole === 'almacenero') || 
    (userRole === 'económico');

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (entradaId && (isEditMode || isViewMode)) {
      fetchEntrada();
    }
  }, [entradaId, isEditMode, isViewMode]);

  useEffect(() => {
    if (productoId && isAddMode) {
      fetchProductoAndPreselect(productoId);
    }
  }, [productoId, isAddMode]);

  // Effect for handling product search in multiple mode
  useEffect(() => {
    const timeouts: Record<number, NodeJS.Timeout> = {};
    
    multipleEntradas.forEach((entrada: any) => {
      // Clear existing timeout for this entrada
      if (timeouts[entrada.id]) {
        clearTimeout(timeouts[entrada.id]);
      }
      
      // Check if we should search
      const isMatchingSelectedProduct = multipleJustSelectedProducto[entrada.id] && 
        entrada.producto?.nombre?.toLowerCase() === entrada.productoSearchText?.toLowerCase();
      
      if (entrada.productoSearchText && entrada.productoSearchText.length >= 2 && !isMatchingSelectedProduct) {
        timeouts[entrada.id] = setTimeout(() => {
          handleMultipleProductoSearch(entrada.id, entrada.productoSearchText);
          setMultipleShowProductoDropdown(prev => ({ ...prev, [entrada.id]: true }));
        }, 500);
      } else {
        setMultipleProductoSearchResults(prev => ({ ...prev, [entrada.id]: [] }));
        setMultipleShowProductoDropdown(prev => ({ ...prev, [entrada.id]: false }));
      }
    });
    
    // Cleanup function
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [multipleEntradas, multipleJustSelectedProducto]);

  const fetchConfig = async () => {
    try {
      // TODO: Implement config service call
      setConfig({ applyWeightedAverageCost: false });
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      let allTiendas = data.data?.filter((t: any) => t.activo === true) || [];
      
      if (user?.id_tienda && !canViewAllEntradas) {
        const userTienda = allTiendas.find((t: any) => t.id_tienda === user.id_tienda);
        setTiendas(userTienda ? [userTienda] : []);
      } else {
        setTiendas(allTiendas);
      }
    } catch (error) {
      console.error('Error fetching tiendas:', error);
    }
  };

  const fetchEntrada = async () => {
    try {
      setIsLoading(true);
      if (!entradaId) return;
      const entrada = await getEntradaById(entradaId);
      
      const producto = entrada.servicioTienda?.servicio;
      const tienda = entrada.servicioTienda?.tienda;
      
      let precioCup = '';
      let precioUsd = '';
      let productoCompleto = producto;
      
      if (producto && tienda) {
        try {
          productoCompleto = await getProductoById(producto.id_servicio);
          const productoTienda = productoCompleto.tiendas_servicio?.find(
            (ts: any) => ts.id_tienda === tienda.id_tienda
          );
          if (productoTienda) {
            precioCup = productoTienda.precio_cup?.toString() || '';
            precioUsd = productoTienda.precio_usd?.toString() || '';
          }
        } catch (err) {
          console.error('Error fetching complete product:', err);
        }
      }
      
      setFormData({
        id_servicio_tienda: entrada.id_servicio_tienda,
        cantidad_entrada: entrada.cantidad_entrada.toString(),
        costo_usd: entrada.costo_usd.toString(),
        costo_cup: entrada.costo_cup.toString(),
        precio_usd: precioUsd,
        precio_cup: precioCup,
        fecha_vencimiento: entrada.fecha_vencimiento ? entrada.fecha_vencimiento.split('T')[0] : '',
        nombre_proveedor: entrada.nombre_proveedor || '',
        fecha: entrada.fecha ? entrada.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
        producto: productoCompleto,
        tienda: tienda,
      });
      
      setProductoSearchText((producto?.nombre || '').trimEnd());
    } catch (error) {
      console.error('Error fetching entrada:', error);
      showToast({ type: 'error', message: 'Error al cargar datos de la entrada' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductoAndPreselect = async (productoId: string) => {
    try {
      const producto = await getProductoById(productoId);
      
      let costoCup = '';
      let costoUsd = '';
      
      if (formData.tienda && formData.tienda.id_tienda) {
        const tiendaServicio = producto.tiendas_servicio?.find(
          (ts: any) => ts.id_tienda === formData.tienda.id_tienda
        );
        costoCup = tiendaServicio?.costo_cup?.toString() || '';
        costoUsd = tiendaServicio?.costo_usd?.toString() || '';
      }
      
      if (!costoCup && !costoUsd) {
        const firstTiendaServicio = producto.tiendas_servicio?.[0];
        costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
        costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
      }
      
      setFormData(prev => ({
        ...prev,
        producto: producto,
        costo_cup: costoCup,
        costo_usd: costoUsd,
      }));
      
      setProductoSearchText((producto.nombre || '').trimEnd());
    } catch (error) {
      console.error('Error fetching producto:', error);
    }
  };

  const searchProductos = async (searchTerm: string) => {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        setProductoSearchResults([]);
        return;
      }
      setIsSearchingProductos(true);
      const data = await getProductos({ nombre: searchTerm }, 1, 50);
      setProductoSearchResults(data.data || []);
    } catch (error) {
      console.error('Error searching productos:', error);
      setProductoSearchResults([]);
    } finally {
      setIsSearchingProductos(false);
    }
  };

  const handleMultipleProductoSearch = async (id: number, searchTerm: string) => {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
        return;
      }
      setMultipleIsSearchingProductos(prev => ({ ...prev, [id]: true }));
      const data = await getProductos({ nombre: searchTerm }, 1, 50);
      setMultipleProductoSearchResults(prev => ({ ...prev, [id]: data.data || [] }));
    } catch (error) {
      console.error('Error searching productos:', error);
      setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    } finally {
      setMultipleIsSearchingProductos(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleMultipleProductoSelect = (id: number, producto: any) => {
    let costoCup = '';
    let costoUsd = '';
    
    if (formData.tienda) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        (ts: any) => ts.id_tienda === formData.tienda.id_tienda
      );
      costoCup = tiendaServicio?.costo_cup?.toString() || '';
      costoUsd = tiendaServicio?.costo_usd?.toString() || '';
    } else {
      const firstTiendaServicio = producto.tiendas_servicio?.[0];
      costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
      costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
    }
    
    updateMultipleEntrada(id, 'producto', producto);
    updateMultipleEntrada(id, 'costo_cup', costoCup);
    updateMultipleEntrada(id, 'costo_usd', costoUsd);
    updateMultipleEntrada(id, 'productoSearchText', producto.nombre);
    setMultipleShowProductoDropdown(prev => ({ ...prev, [id]: false }));
    setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    setMultipleJustSelectedProducto(prev => ({ ...prev, [id]: true }));
  };

  const handleTiendaSelect = (tienda: any) => {
    setFormData(prev => ({ ...prev, tienda }));
    setShowTiendaDropdown(false);
    setTiendaSearchText('');
    
    // If product is already selected, update costs based on new tienda
    if (formData.producto) {
      const tiendaServicio = formData.producto.tiendas_servicio?.find(
        (ts: any) => ts.id_tienda === tienda.id_tienda
      );
      if (tiendaServicio) {
        setFormData(prev => ({
          ...prev,
          tienda,
          id_servicio_tienda: tiendaServicio.id_servicio_tienda,
          costo_cup: tiendaServicio.costo_cup?.toString() || '',
          costo_usd: tiendaServicio.costo_usd?.toString() || '',
          precio_cup: tiendaServicio.precio_cup?.toString() || '',
          precio_usd: tiendaServicio.precio_usd?.toString() || '',
        }));
      }
    }
  };

  const handleProductoSelect = (producto: any) => {
    setProductoSearchText(producto.nombre);
    setJustSelectedProducto(true);
    setShowProductoDropdown(false);
    
    // Auto-fill costs and id_servicio_tienda when product is selected
    if (formData.tienda && formData.tienda.id_tienda) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        (ts: any) => ts.id_tienda === formData.tienda.id_tienda
      );
      if (tiendaServicio) {
        setFormData(prev => ({
          ...prev,
          producto,
          id_servicio_tienda: tiendaServicio.id_servicio_tienda,
          costo_cup: tiendaServicio.costo_cup?.toString() || '',
          costo_usd: tiendaServicio.costo_usd?.toString() || '',
          precio_cup: tiendaServicio.precio_cup?.toString() || '',
          precio_usd: tiendaServicio.precio_usd?.toString() || '',
        }));
      } else {
        setFormData(prev => ({ ...prev, producto }));
      }
    } else {
      // Use first tienda's cost if no tienda selected
      const firstTiendaServicio = producto.tiendas_servicio?.[0];
      if (firstTiendaServicio) {
        setFormData(prev => ({
          ...prev,
          producto,
          id_servicio_tienda: firstTiendaServicio.id_servicio_tienda,
          costo_cup: firstTiendaServicio.costo_cup?.toString() || '',
          costo_usd: firstTiendaServicio.costo_usd?.toString() || '',
          precio_cup: firstTiendaServicio.precio_cup?.toString() || '',
          precio_usd: firstTiendaServicio.precio_usd?.toString() || '',
        }));
      } else {
        setFormData(prev => ({ ...prev, producto }));
      }
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
    if (!formData.cantidad_entrada || parseFloat(formData.cantidad_entrada) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que 0' });
      return;
    }
    
    // Validar fecha de vencimiento si el producto es vencible
    if (formData.producto?.producto?.isVencible && !formData.fecha_vencimiento) {
      showToast({ type: 'warning', message: 'El producto requiere fecha de vencimiento' });
      return;
    }

    setIsSaving(true);
    try {
      const entradaData = {
        id_servicio_tienda: formData.id_servicio_tienda,
        cantidad_entrada: parseFloat(formData.cantidad_entrada),
        costo_usd: parseFloat(formData.costo_usd) || 0,
        costo_cup: parseFloat(formData.costo_cup) || 0,
        precio_usd: parseFloat(formData.precio_usd) || 0,
        precio_cup: parseFloat(formData.precio_cup) || 0,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        nombre_proveedor: formData.nombre_proveedor || null,
        fecha: formData.fecha,
        id_usuario: user?.id_usuario,
      };

      if (isEditMode && entradaId) {
        await updateEntrada(entradaId, entradaData);
        showToast({ type: 'success', message: 'Entrada actualizada correctamente' });
      } else {
        await createEntrada(entradaData);
        showToast({ type: 'success', message: 'Entrada creada correctamente' });
      }
      router.back();
    } catch (error) {
      console.error('Error saving entrada:', error);
      showToast({ type: 'error', message: 'Error al guardar la entrada' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (date) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setFormData(prev => ({ ...prev, fecha_vencimiento: `${year}-${month}-${day}` }));
    }
    setShowDatePicker(false);
  };

  const handleFechaEntradaChange = (date) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setFormData(prev => ({ ...prev, fecha: `${year}-${month}-${day}` }));
    }
    setShowFechaEntradaPicker(false);
  };

  const addNewEntrada = () => {
    const newId = Date.now();
    setMultipleEntradas(prev => [
      ...prev,
      {
        id: newId,
        producto: null,
        productoSearchText: '',
        cantidad_entrada: '',
        costo_cup: '',
        costo_usd: '',
        precio_cup: '',
        precio_usd: '',
        fecha_vencimiento: '',
      }
    ]);
  };

  const removeEntrada = (id) => {
    setMultipleEntradas(prev => prev.filter(e => e.id !== id));
  };

  const updateMultipleEntrada = (id, field, value) => {
    setMultipleEntradas(prev => prev.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
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
  }, [productoSearchText, formData.producto, justSelectedProducto]);

  const filteredTiendas = tiendas.filter(t => 
    t.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const getFinancialInfo = () => {
    if (!formData.producto || !formData.tienda) return null;
    
    const cantidad = parseFloat(formData.cantidad_entrada) || 0;
    const costoCup = parseFloat(formData.costo_cup) || 0;
    const costoUsd = parseFloat(formData.costo_usd) || 0;
    const precioCup = parseFloat(formData.precio_cup) || 0;
    const precioUsd = parseFloat(formData.precio_usd) || 0;
    
    const costoTotalCup = cantidad * costoCup;
    const costoTotalUsd = cantidad * costoUsd;
    const gananciaCup = cantidad * (precioCup - costoCup);
    const gananciaUsd = cantidad * (precioUsd - costoUsd);
    const porcentajeGananciaCup = costoCup > 0 ? ((precioCup - costoCup) / costoCup) * 100 : 0;
    
    return {
      costoTotalCup,
      costoTotalUsd,
      gananciaCup,
      gananciaUsd,
      porcentajeGananciaCup,
      precioCup,
      precioUsd,
    };
  };

  const getMultipleFinancialInfo = () => {
    if (multipleEntradas.length === 0) {
      return null;
    }

    let costoTotalCup = 0;
    let costoTotalUsd = 0;
    let precioTotalCup = 0;
    let precioTotalUsd = 0;
    let cantidadTotal = 0;

    multipleEntradas.forEach((entrada: any) => {
      const cantidad = parseFloat(entrada.cantidad_entrada) || 0;
      const costoCup = parseFloat(entrada.costo_cup) || 0;
      const costoUsd = parseFloat(entrada.costo_usd) || 0;

      // Get prices from producto-tienda relationship
      let precioCup = 0;
      let precioUsd = 0;

      if (entrada.producto && formData.tienda) {
        const servicioTienda = entrada.producto.tiendas_servicio?.find(
          (ts: any) => ts.id_tienda === formData.tienda.id_tienda
        );
        precioCup = parseFloat(servicioTienda?.precio_cup) || 0;
        precioUsd = parseFloat(servicioTienda?.precio_usd) || 0;
      }

      costoTotalCup += costoCup * cantidad;
      costoTotalUsd += costoUsd * cantidad;
      precioTotalCup += precioCup * cantidad;
      precioTotalUsd += precioUsd * cantidad;
      cantidadTotal += cantidad;
    });

    // Calculate average prices
    const precioPromedioCup = cantidadTotal > 0 ? precioTotalCup / cantidadTotal : 0;
    const precioPromedioUsd = cantidadTotal > 0 ? precioTotalUsd / cantidadTotal : 0;

    // Calculate total expected profit (using average prices)
    const gananciaTotalCup = precioTotalCup - costoTotalCup;
    const gananciaTotalUsd = precioTotalUsd - costoTotalUsd;

    // Calculate average profit percentage
    const porcentajeGananciaCup = precioTotalCup > 0 ? (gananciaTotalCup / precioTotalCup) * 100 : 0;
    const porcentajeGananciaUsd = precioTotalUsd > 0 ? (gananciaTotalUsd / precioTotalUsd) * 100 : 0;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      precioCup: !isNaN(precioPromedioCup) ? precioPromedioCup : 0,
      precioUsd: !isNaN(precioPromedioUsd) ? precioPromedioUsd : 0,
      gananciaCup: !isNaN(gananciaTotalCup) ? gananciaTotalCup : 0,
      gananciaUsd: !isNaN(gananciaTotalUsd) ? gananciaTotalUsd : 0,
      porcentajeGananciaCup: !isNaN(porcentajeGananciaCup) ? porcentajeGananciaCup : 0,
      porcentajeGananciaUsd: !isNaN(porcentajeGananciaUsd) ? porcentajeGananciaUsd : 0
    };
  };

  const calcularCostoPromedioPonderado = async (producto: any, tienda: any, nuevaCantidad: any, nuevoCostoCup: any, nuevoCostoUsd: any) => {
    try {
      const servicioTienda = producto.tiendas_servicio?.find(ts => ts.id_tienda === tienda.id_tienda);
      
      if (!servicioTienda) {
        return { costo_cup: nuevoCostoCup, costo_usd: nuevoCostoUsd };
      }

      const cantidadActual = parseFloat(servicioTienda.cantidad) || 0;
      const costoActualCup = parseFloat(servicioTienda.costo_cup) || 0;
      const costoActualUsd = parseFloat(servicioTienda.costo_usd) || 0;
      const nuevaCantidadNum = parseFloat(nuevaCantidad);

      const cantidadTotal = cantidadActual + nuevaCantidadNum;
      const costoTotalCup = (costoActualCup * cantidadActual) + (nuevoCostoCup * nuevaCantidadNum);
      const costoTotalUsd = (costoActualUsd * cantidadActual) + (nuevoCostoUsd * nuevaCantidadNum);

      const nuevoCostoPromedioCup = costoTotalCup / cantidadTotal;
      const nuevoCostoPromedioUsd = costoTotalUsd / cantidadTotal;

      return {
        costo_cup: parseFloat(nuevoCostoPromedioCup.toFixed(5)),
        costo_usd: parseFloat(nuevoCostoPromedioUsd.toFixed(5)),
      };
    } catch (error) {
      return { costo_cup: nuevoCostoCup, costo_usd: nuevoCostoUsd };
    }
  };

  const checkAndShowCostSuggestion = async () => {
    if (config.applyWeightedAverageCost && isAddMode && !isEditMode) {
      try {
        const costoCup = parseFloat(formData.costo_cup) || 0;
        const costoUsd = parseFloat(formData.costo_usd) || 0;
        
        const nuevosCostos = await calcularCostoPromedioPonderado(
          formData.producto,
          formData.tienda,
          formData.cantidad_entrada,
          costoCup,
          costoUsd
        );
        
        const diffCup = Math.abs(nuevosCostos.costo_cup - costoCup);
        const diffUsd = Math.abs(nuevosCostos.costo_usd - costoUsd);
        const threshold = 0.01;
        
        if (diffCup < threshold && diffUsd < threshold) {
          executeSave();
          return;
        }
        
        setCurrentCosts({
          costo_cup: costoCup,
          costo_usd: costoUsd,
        } as any);
        
        setSuggestedCosts({
          costo_cup: nuevosCostos.costo_cup,
          costo_usd: nuevosCostos.costo_usd,
        } as any);
        
        setShowCostSuggestionModal(true);
      } catch (error) {
        executeSave();
      }
    } else {
      executeSave();
    }
  };

  const handleKeepCurrentCosts = () => {
    setShowCostSuggestionModal(false);
    executeSave();
  };

  const handleUseSuggestedCosts = () => {
    if (!suggestedCosts) return;
    setFormData(prev => ({
      ...prev,
      costo_cup: (suggestedCosts as any).costo_cup,
      costo_usd: (suggestedCosts as any).costo_usd,
    }));
    setShowCostSuggestionModal(false);
    executeSave();
  };

  const executeSave = async () => {
    try {
      setIsSaving(true);
      // TODO: Implement API call to save entrada
      showToast({ type: 'success', message: 'Entrada guardada correctamente' });
      router.back();
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar la entrada' });
    } finally {
      setIsSaving(false);
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
      
      <SidebarNavigation 
        ref={sidebarNavRef}
        currentRoute="entradas"
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/entradas')}
          isDark={isDarkMode}
          title={isEditMode ? 'Editar Entrada' : isViewMode ? 'Ver Entrada' : 'Nueva Entrada'}
        />

        {/* Main Container */}
        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
        <div 
          className="rounded-2xl p-6"
          style={{ backgroundColor: colors.surface }}
        >
          {/* Mode Switch */}
          {isAddMode && !isReadOnly && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-center w-full" style={{ color: colors.onSurface }}>
                  Entradas
                </h3>
              </div>
              <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, border: '1px solid' }}>
                <button
                  className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                  style={{ 
                    backgroundColor: !isMultipleMode ? colors.primary : 'transparent',
                    color: !isMultipleMode ? '#fff' : colors.outline
                  }}
                  onClick={() => {
                    if (isMultipleMode) {
                      setIsMultipleMode(false);
                      setMultipleEntradas([]);
                    }
                  }}
                >
                  Simples
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                  style={{ 
                    backgroundColor: isMultipleMode ? colors.primary : 'transparent',
                    color: isMultipleMode ? '#fff' : colors.outline
                  }}
                  onClick={() => {
                    if (!isMultipleMode) {
                      setIsMultipleMode(true);
                      addNewEntrada();
                    }
                  }}
                >
                  Múltiples
                </button>
              </div>
            </div>
          )}

          {/* Individual Form */}
          {!isMultipleMode && (
            <>
              {/* Producto Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
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
                    value={productoSearchText}
                    onChange={(e) => {
                      setProductoSearchText(e.target.value);
                      setJustSelectedProducto(false);
                    }}
                    disabled={isReadOnly}
                  />
                  {showProductoDropdown && !isReadOnly && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: '1px solid ' + colors.outlineVariant }}>
                      {isSearchingProductos ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                        </div>
                      ) : productoSearchResults.length > 0 ? (
                        productoSearchResults.map((producto, index) => (
                          <button
                            key={producto.id_servicio}
                            className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                            onClick={() => handleProductoSelect(producto)}
                          >
                            {producto.nombre}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3" style={{ color: colors.outline }}>
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tienda and Cantidad */}
              <div className="mb-4">
                <div className="flex flex-row gap-4">
                  <div style={{ flex: isDesktop ? '2' : '0 0 60%' }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Tienda *
                    </label>
                    <div className="relative">
                      <button
                        className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                        style={{ 
                          backgroundColor: colors.background, 
                          borderColor: colors.outlineVariant
                        }}
                        onClick={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                        disabled={isReadOnly}
                      >
                        <span style={{ color: formData.tienda ? colors.onSurface : colors.outline }}>
                          {formData.tienda?.nombre || 'Seleccionar...'}
                        </span>
                        {!isReadOnly && (
                          showTiendaDropdown ? <ChevronUp size={20} style={{ color: colors.outline }} /> : <ChevronDown size={20} style={{ color: colors.outline }} />
                        )}
                      </button>
                      
                      {showTiendaDropdown && !isReadOnly && (
                        <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: '1px solid ' + colors.outlineVariant }}>
                          <div className="p-2" style={{ borderBottom: '1px solid ' + colors.outlineVariant }}>
                            <div className="flex items-center gap-2">
                              <Search size={16} style={{ color: colors.outline }} />
                              <input
                                type="text"
                                className="flex-1 bg-transparent border-none focus:outline-none"
                                style={{ color: colors.onSurface }}
                                placeholder="Buscar tienda..."
                                value={tiendaSearchText}
                                onChange={(e) => setTiendaSearchText(e.target.value)}
                              />
                            </div>
                          </div>
                          {filteredTiendas.length > 0 ? (
                            filteredTiendas.map((tienda, index) => (
                              <button
                                key={tienda.id_tienda}
                                className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                                style={{ color: colors.onSurface }}
                                onClick={() => handleTiendaSelect(tienda)}
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
                  </div>

                  <div style={{ flex: isDesktop ? '1' : '0 0 40%' }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Cant. Entrante *
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
                      value={formData.cantidad_entrada}
                      onChange={(e) => setFormData(prev => ({ ...prev, cantidad_entrada: e.target.value.replace(/-/g, '') }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="mb-4">
                <div className="flex flex-row gap-4">
                  <div style={{ flex: isDesktop ? '1' : '0 0 50%' }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Costo CUP *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Costo CUP"
                      value={getFormattedValue(formData.costo_cup, 'costo_cup')}
                      onChange={(e) => setFormData(prev => ({ ...prev, costo_cup: e.target.value }))}
                      onFocus={() => setFocusedField('costo_cup')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div style={{ flex: isDesktop ? '1' : '0 0 50%' }}>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Costo USD *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Costo USD"
                      value={getFormattedValue(formData.costo_usd, 'costo_usd')}
                      onChange={(e) => setFormData(prev => ({ ...prev, costo_usd: e.target.value }))}
                      onFocus={() => setFocusedField('costo_usd')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Precios (solo cuando no existe relación producto-tienda) */}
              {isAddMode && formData.producto && formData.tienda && !formData.producto.tiendas_servicio?.find(
                ts => ts.id_tienda === formData.tienda.id_tienda
              ) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Precio CUP *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Precio CUP"
                      value={getFormattedValue(formData.precio_cup, 'precio_cup')}
                      onChange={(e) => setFormData(prev => ({ ...prev, precio_cup: e.target.value }))}
                      onFocus={() => setFocusedField('precio_cup')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Precio USD *
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Precio USD"
                      value={getFormattedValue(formData.precio_usd, 'precio_usd')}
                      onChange={(e) => setFormData(prev => ({ ...prev, precio_usd: e.target.value }))}
                      onFocus={() => setFocusedField('precio_usd')}
                      onBlur={() => setFocusedField(null)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}

              {/* Fechas */}
              {formData.producto?.producto?.isVencible ? (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Fecha Vencimiento *
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
                      value={formData.fecha_vencimiento}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Fecha de Entrada
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
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Fecha de Entrada
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
              )}
            </>
          )}

          {/* Common fields for multiple mode */}
          {isMultipleMode && (
            <>
              {/* Tienda */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Tienda *
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant
                    }}
                    onClick={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                    disabled={isReadOnly}
                  >
                    <span style={{ color: formData.tienda ? colors.onSurface : colors.outline }}>
                      {formData.tienda?.nombre || 'Seleccionar...'}
                    </span>
                    {!isReadOnly && (
                      showTiendaDropdown ? <ChevronUp size={20} style={{ color: colors.outline }} /> : <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </button>
                  
                  {showTiendaDropdown && !isReadOnly && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: '1px solid ' + colors.outlineVariant }}>
                      <div className="p-2" style={{ borderBottom: '1px solid ' + colors.outlineVariant }}>
                        <div className="flex items-center gap-2">
                          <Search size={16} style={{ color: colors.outline }} />
                          <input
                            type="text"
                            className="flex-1 bg-transparent border-none focus:outline-none"
                            style={{ color: colors.onSurface }}
                            placeholder="Buscar tienda..."
                            value={tiendaSearchText}
                            onChange={(e) => setTiendaSearchText(e.target.value)}
                          />
                        </div>
                      </div>
                      {filteredTiendas.length > 0 ? (
                        filteredTiendas.map((tienda, index) => (
                          <button
                            key={tienda.id_tienda}
                            className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                            onClick={() => handleTiendaSelect(tienda)}
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
              </div>

              {/* Fecha de Entrada */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Fecha de Entrada
                </label>
                <button
                  className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant
                  }}
                  onClick={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                  disabled={isReadOnly}
                >
                  <span style={{ color: formData.fecha ? colors.onSurface : colors.outline }}>
                    {formData.fecha || 'Seleccionar...'}
                  </span>
                  <Calendar size={20} style={{ color: colors.outline }} />
                </button>
                {showFechaEntradaPicker && (
                  <input
                    type="date"
                    className="absolute z-10 mt-1"
                    value={formData.fecha}
                    onChange={(e) => handleFechaEntradaChange(new Date(e.target.value))}
                    onBlur={() => setShowFechaEntradaPicker(false)}
                  />
                )}
              </div>
            </>
          )}

          {/* Proveedor */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
              Nombre del Proveedor
            </label>
            <input
              type="text"
              className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.background, 
                color: colors.onSurface, 
                borderColor: colors.outlineVariant
              }}
              placeholder="Proveedor (opcional)"
              value={formData.nombre_proveedor}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre_proveedor: e.target.value }))}
              disabled={isReadOnly}
            />
          </div>

          {/* Multiple Entradas List */}
          {isMultipleMode && multipleEntradas.map((entrada, index) => (
            <div key={entrada.id} className="mb-4 p-4 rounded-lg" style={{ backgroundColor: colors.background, border: '1px solid ' + colors.outlineVariant }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold" style={{ color: colors.onSurface }}>
                  Producto {index + 1}
                </h4>
                {multipleEntradas.length > 1 && (
                  <button
                    onClick={() => removeEntrada(entrada.id)}
                    className="p-1"
                  >
                    <X size={20} style={{ color: '#F44336' }} />
                  </button>
                )}
              </div>

              {/* Producto */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Producto *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.surface, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Buscar producto..."
                    value={entrada.productoSearchText}
                    onChange={(e) => {
                      updateMultipleEntrada(entrada.id, 'productoSearchText', e.target.value);
                      handleMultipleProductoSearch(entrada.id, e.target.value);
                    }}
                    disabled={isReadOnly}
                  />
                  {multipleShowProductoDropdown[entrada.id] && !isReadOnly && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: '1px solid ' + colors.outlineVariant }}>
                      {multipleIsSearchingProductos[entrada.id] ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                        </div>
                      ) : multipleProductoSearchResults[entrada.id]?.length > 0 ? (
                        multipleProductoSearchResults[entrada.id].map((producto, index) => (
                          <button
                            key={producto.id_servicio}
                            className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                            onClick={() => handleMultipleProductoSelect(entrada.id, producto)}
                          >
                            {producto.nombre}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3" style={{ color: colors.outline }}>
                          No se encontraron productos
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cantidad *
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.surface, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Cantidad"
                  value={entrada.cantidad_entrada}
                  onChange={(e) => updateMultipleEntrada(entrada.id, 'cantidad_entrada', e.target.value.replace(/-/g, ''))}
                  disabled={isReadOnly}
                />
              </div>

              {/* Costos */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Costo CUP *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.surface, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Costo CUP"
                    value={entrada.costo_cup}
                    onChange={(e) => updateMultipleEntrada(entrada.id, 'costo_cup', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Costo USD *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.surface, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Costo USD"
                    value={entrada.costo_usd}
                    onChange={(e) => updateMultipleEntrada(entrada.id, 'costo_usd', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Fecha Vencimiento */}
              {entrada.producto?.producto?.isVencible && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Fecha Vencimiento *
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
                    value={entrada.fecha_vencimiento}
                    onChange={(e) => updateMultipleEntrada(entrada.id, 'fecha_vencimiento', e.target.value)}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).showPicker?.();
                    }}
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {/* Fecha de Entrada */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Fecha de Entrada
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
                  value={entrada.fecha}
                  onChange={(e) => updateMultipleEntrada(entrada.id, 'fecha', e.target.value)}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).showPicker?.();
                  }}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          ))}

          {/* Add Product Button (Multiple Mode) */}
          {isMultipleMode && !isReadOnly && (
            <button
              className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors mb-4"
              style={{ 
                backgroundColor: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? colors.primary : colors.outlineVariant,
                color: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? '#fff' : colors.outline,
                opacity: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? 1 : 0.5
              }}
              onClick={() => addNewEntrada()}
              disabled={multipleEntradas[multipleEntradas.length - 1]?.producto === null}
            >
              <Plus size={20} />
              Agregar otro producto
            </button>
          )}

          {/* Product Count Info */}
          {isMultipleMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: colors.primaryContainer }}>
              <Info size={18} style={{ color: isDarkMode ? colors.primary : '#fff' }} />
              <span className="text-sm" style={{ color: isDarkMode ? colors.primary : '#fff' }}>
                Total: {multipleEntradas.length} {multipleEntradas.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
          )}

          {/* Financial Information Section - Multiple Mode */}
          {isMultipleMode && getMultipleFinancialInfo() && (
            <div 
              className="rounded-2xl p-5 mb-4 border"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', 
                borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' 
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} style={{ color: colors.primary }} />
                <h3 className="text-lg font-semibold" style={{ color: colors.onSurface }}>
                  Información Financiera
                </h3>
              </div>
              
              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo Total CUP</p>
                  <p className="text-xl font-semibold" style={{ color: colors.primary }}>
                    ${(getMultipleFinancialInfo()?.costoTotalCup || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo Total USD</p>
                  <p className="text-xl font-semibold" style={{ color: colors.primary }}>
                    ${(getMultipleFinancialInfo()?.costoTotalUsd || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Precio CUP en Tienda</p>
                  <p className="text-xl font-semibold" style={{ color: colors.onSurface }}>
                    ${(getMultipleFinancialInfo()?.precioCup || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Precio USD en Tienda</p>
                  <p className="text-xl font-semibold" style={{ color: colors.onSurface }}>
                    ${(getMultipleFinancialInfo()?.precioUsd || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Ganancia Esperada CUP</p>
                  <div 
                    className="inline-block px-3 py-1 rounded-lg border"
                    style={{ 
                      backgroundColor: (getMultipleFinancialInfo()?.gananciaCup || 0) >= 0 
                        ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                        : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                      borderColor: (getMultipleFinancialInfo()?.gananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' 
                    }}
                  >
                    <p className="text-xl font-semibold" style={{ color: (getMultipleFinancialInfo()?.gananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                      ${(getMultipleFinancialInfo()?.gananciaCup || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Ganancia Esperada USD</p>
                  <div 
                    className="inline-block px-3 py-1 rounded-lg border"
                    style={{ 
                      backgroundColor: (getMultipleFinancialInfo()?.gananciaUsd || 0) >= 0 
                        ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                        : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                      borderColor: (getMultipleFinancialInfo()?.gananciaUsd || 0) >= 0 ? '#4CAF50' : '#F44336' 
                    }}
                  >
                    <p className="text-xl font-semibold" style={{ color: (getMultipleFinancialInfo()?.gananciaUsd || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                      ${(getMultipleFinancialInfo()?.gananciaUsd || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>% Ganancia CUP y USD</p>
                <div 
                  className="inline-block px-3 py-1 rounded-lg border"
                  style={{ 
                    backgroundColor: (getMultipleFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 
                      ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                      : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                    borderColor: (getMultipleFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' 
                  }}
                >
                  <p className="text-xl font-semibold" style={{ color: (getMultipleFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                    {(getMultipleFinancialInfo()?.porcentajeGananciaCup || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Financial Information Section - Simple Mode */}
          {!isMultipleMode && getFinancialInfo() && (
            <div 
              className="rounded-2xl p-5 mb-4 border"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', 
                borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' 
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} style={{ color: colors.primary }} />
                <h3 className="text-lg font-semibold" style={{ color: colors.onSurface }}>
                  Información Financiera
                </h3>
              </div>
              
              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo Total CUP</p>
                  <p className="text-xl font-semibold" style={{ color: colors.primary }}>
                    ${(getFinancialInfo()?.costoTotalCup || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo Total USD</p>
                  <p className="text-xl font-semibold" style={{ color: colors.primary }}>
                    ${(getFinancialInfo()?.costoTotalUsd || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Precio CUP en Tienda</p>
                  <p className="text-xl font-semibold" style={{ color: colors.onSurface }}>
                    ${(getFinancialInfo()?.precioCup || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Precio USD en Tienda</p>
                  <p className="text-xl font-semibold" style={{ color: colors.onSurface }}>
                    ${(getFinancialInfo()?.precioUsd || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Ganancia Esperada CUP</p>
                  <div 
                    className="inline-block px-3 py-1 rounded-lg border"
                    style={{ 
                      backgroundColor: (getFinancialInfo()?.gananciaCup || 0) >= 0 
                        ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                        : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                      borderColor: (getFinancialInfo()?.gananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' 
                    }}
                  >
                    <p className="text-xl font-semibold" style={{ color: (getFinancialInfo()?.gananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                      ${(getFinancialInfo()?.gananciaCup || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: colors.outline }}>Ganancia Esperada USD</p>
                  <div 
                    className="inline-block px-3 py-1 rounded-lg border"
                    style={{ 
                      backgroundColor: (getFinancialInfo()?.gananciaUsd || 0) >= 0 
                        ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                        : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                      borderColor: (getFinancialInfo()?.gananciaUsd || 0) >= 0 ? '#4CAF50' : '#F44336' 
                    }}
                  >
                    <p className="text-xl font-semibold" style={{ color: (getFinancialInfo()?.gananciaUsd || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                      ${(getFinancialInfo()?.gananciaUsd || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px mb-4" style={{ backgroundColor: colors.outlineVariant }} />

              <div>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>% Ganancia CUP y USD</p>
                <div 
                  className="inline-block px-3 py-1 rounded-lg border"
                  style={{ 
                    backgroundColor: (getFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 
                      ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') 
                      : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), 
                    borderColor: (getFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' 
                  }}
                >
                  <p className="text-xl font-semibold" style={{ color: (getFinancialInfo()?.porcentajeGananciaCup || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
                    {(getFinancialInfo()?.porcentajeGananciaCup || 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {isViewMode && (
              <button
                className="flex-1 rounded-lg px-6 py-3 transition-colors font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={() => router.push(`/entradas/form/${entradaId}?mode=edit`)}
              >
                <Edit size={20} />
                Editar
              </button>
            )}
            {!isViewMode && (
              <button
                className="flex-1 rounded-lg px-6 py-3 transition-colors font-medium"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Guardar')}
              </button>
            )}
            <button
              className="flex-1 rounded-lg px-6 py-3 transition-colors font-medium"
              style={{ backgroundColor: colors.outlineVariant, color: colors.outline }}
              onClick={() => router.back()}
            >
              {isViewMode ? 'Volver' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>

      {/* Cost Suggestion Modal */}
      {showCostSuggestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-2xl p-6 max-w-md w-full" style={{ backgroundColor: colors.surface }}>
            <div className="flex items-center gap-2 mb-4">
              <Info size={24} style={{ color: colors.primary }} />
              <h3 className="text-lg font-semibold" style={{ color: colors.onSurface }}>
                Sugerencia de Costo
              </h3>
            </div>
            
            <p className="mb-4" style={{ color: colors.onSurface }}>
              La fórmula de costo promedio ponderado sugiere los siguientes costos:
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo CUP Actual</p>
                <p className="font-semibold" style={{ color: colors.onSurface }}>
                  ${(currentCosts as any)?.costo_cup?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo CUP Sugerido</p>
                <p className="font-semibold" style={{ color: colors.primary }}>
                  ${(suggestedCosts as any)?.costo_cup?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo USD Actual</p>
                <p className="font-semibold" style={{ color: colors.onSurface }}>
                  ${(currentCosts as any)?.costo_usd?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                <p className="text-sm mb-1" style={{ color: colors.outline }}>Costo USD Sugerido</p>
                <p className="font-semibold" style={{ color: colors.primary }}>
                  ${(suggestedCosts as any)?.costo_usd?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors font-medium"
                style={{ backgroundColor: colors.outlineVariant, color: colors.outline }}
                onClick={handleKeepCurrentCosts}
              >
                Mantener Costos Actuales
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors font-medium"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleUseSuggestedCosts}
              >
                Usar Costos Sugeridos
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
