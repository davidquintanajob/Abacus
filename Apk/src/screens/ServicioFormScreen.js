import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { createServicio, updateServicio, getServicios, getServicioById } from '../services/servicioService';
import { getTiendas } from '../services/tiendaService';
import configService from '../services/configService';
import { storageService } from '../services/storageService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView, Camera } from 'expo-camera';

const ServicioFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, productoManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { servicio, mode, isOferta } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || (isViewMode && !canEditService);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingServicio, setIsFetchingServicio] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  // Tracks raw text while the user is typing in a price field (avoids .toFixed forcing cursor to end)
  // Shape: { [index]: { precio_cup, precio_usd, costo_cup, costo_usd } }
  const [priceInputTexts, setPriceInputTexts] = useState({});
  // Same for general prices
  const [generalPriceInputTexts, setGeneralPriceInputTexts] = useState({});
  // Same for oferta cantidad field
  const [cantidadInputTexts, setCantidadInputTexts] = useState({});
  
  // Estados para la sección de Oferta
  const [allItems, setAllItems] = useState([]);
  const [showComponenteSelectorModal, setShowComponenteSelectorModal] = useState(false);
  const [componenteSearchText, setComponenteSearchText] = useState('');
  const [isOfertaExpanded, setIsOfertaExpanded] = useState(false);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [serviciosPagination, setServiciosPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [debounceTimer, setDebounceTimer] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: servicio?.nombre || '',
    categoria: servicio?.categoria || '',
    esvendible: servicio?.esvendible !== undefined ? servicio.esvendible : true,
    nota: servicio?.nota || '',
    servicioTiendaList: servicio?.tiendas_servicio || [],
    codigoList: servicio?.codigos || [],
    // Precios y costos generales (no cargar de tiendas específicas para mantener independencia)
    precio_cup_general: servicio?.precio_cup_general ?? null,
    precio_usd_general: servicio?.precio_usd_general ?? null,
    costo_cup_general: servicio?.costo_cup_general ?? null,
    costo_usd_general: servicio?.costo_usd_general ?? null,
    // Lista de componentes para la oferta
    ofertaList: servicio?.componentes?.map(c => {
      const tiendasServicio = c.tiendas_servicio || c.servicioTiendaList || [];
      const firstTienda = tiendasServicio[0];
      return {
        id_servicio_componente: c.id_servicio,
        cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
        nombre: c.nombre,
        categoria: c.categoria,
        costo_cup: firstTienda?.costo_cup || 0,
        costo_usd: firstTienda?.costo_usd || 0,
      };
    }) || [],
  });

  // Estado para controlar si las secciones están expandidas o colapsadas
  // Por defecto, todas contraídas al entrar (tanto en modo add como edit)
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);

  // Auto-expand sections when they have elements
  useEffect(() => {
    if (formData.codigoList.length > 0) {
      setIsCodesExpanded(true);
    }
    if (formData.servicioTiendaList.length > 0) {
      setIsPricesExpanded(true);
    }
    if (formData.ofertaList.length > 0) {
      setIsOfertaExpanded(true);
    }
  }, [formData.codigoList.length, formData.servicioTiendaList.length, formData.ofertaList.length]);


  const handleGeneralPriceBlur = () => {
    const hasAllGeneralPrices = 
      formData.precio_cup_general !== null && 
      formData.precio_cup_general !== '' &&
      formData.precio_usd_general !== null && 
      formData.precio_usd_general !== '';

    if (hasAllGeneralPrices && formData.servicioTiendaList.length === 0) {
      // Auto-populate all active tiendas with general prices
      const newServicioTiendaList = tiendas.filter(tienda => tienda.activo === true).map(tienda => {
        const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(formData.precio_cup_general);
        const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(formData.precio_usd_general);
        const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(formData.costo_cup_general)) : 0;
        const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(formData.costo_usd_general)) : 0;
        
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
      const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(formData.precio_cup_general);
      const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(formData.precio_usd_general);
      const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(formData.costo_cup_general)) : 0;
      const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(formData.costo_usd_general)) : 0;
      
      setFormData(prev => ({
        ...prev,
        servicioTiendaList: prev.servicioTiendaList.map(item => ({
          ...item,
          precio_cup: precioCup,
          precio_usd: precioUsd,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        }))
      }));
    }
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const isEconomico = user?.rol === 'Económico';
  const isDependiente = user?.rol === 'Dependiente';
  const isAlmacenero = user?.rol === 'Almacenero';
  const userRole = user?.rol?.toLowerCase();

  const canEditService =
    isAdmin ||
    (userRole === 'dependiente' && productoManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && productoManagePermissions?.almacenero) ||
    (userRole === 'económico' && productoManagePermissions?.economico);

  const canEditCodes = isAdmin; // Only admin can edit codes
  const canViewCosts = !isDependiente && !isAlmacenero;

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchCompleteServicio = async () => {
      if (!servicio?.id_servicio || isAddMode) {
        return;
      }

      setIsFetchingServicio(true);
      try {
        let completeServicio;
        
        if (isOfflineMode) {
          // En modo offline, usar datos locales del servicio pasado como parámetro
          completeServicio = servicio;
          showToast({ 
            type: 'info', 
            message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
            duration: 4000 
          });
        } else {
          // Fetch complete servicio data to ensure tiendas_servicio is populated
          completeServicio = await getServicioById(servicio.id_servicio);
        }
        
        // Apply store visibility permissions for non-admin users
        const userRole = user?.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        let servicioTiendaList = completeServicio.servicioTiendaList || completeServicio.tiendas_servicio || [];
        
        // If user cannot view all stores, filter to show only their own store
        if (!canViewAllStores && user?.id_tienda) {
          servicioTiendaList = servicioTiendaList.filter(ts => ts.id_tienda === user.id_tienda);
        }
        
        // Extract cost from first tienda (all tiendas should have the same cost now)
        const firstTienda = servicioTiendaList[0];
        const costoCupGeneral = firstTienda?.costo_cup || null;
        const costoUsdGeneral = firstTienda?.costo_usd || null;
        
        // Calcular precios generales a partir de los precios por tienda
        // Si todas las tiendas tienen el mismo precio, usarlo como precio general
        // Si algunas tiendas tienen precios diferentes, inferir cuál es el precio general
        let precio_cup_general = null;
        let precio_usd_general = null;
        
        if (servicioTiendaList.length > 0) {
          // Contar cuántas tiendas tienen cada precio CUP
          const preciosCUP = servicioTiendaList.map(item => item.precio_cup);
          const preciosUSD = servicioTiendaList.map(item => item.precio_usd);
          
          // Función para encontrar el precio más común (modo)
          const encontrarPrecioMasComun = (precios) => {
            const conteo = {};
            let precioMasComun = null;
            let maxConteo = 0;
            
            precios.forEach(precio => {
              const clave = precio === null ? 'null' : String(precio);
              conteo[clave] = (conteo[clave] || 0) + 1;
              if (conteo[clave] > maxConteo) {
                maxConteo = conteo[clave];
                precioMasComun = precio;
              }
            });
            
            return { precio: precioMasComun, conteo: maxConteo };
          };
          
          const masComunCUP = encontrarPrecioMasComun(preciosCUP);
          const masComunUSD = encontrarPrecioMasComun(preciosUSD);
          
          // Si hay un precio que se repite en la mayoría de las tiendas, usarlo como precio general
          if (masComunCUP.precio !== null && masComunUSD.precio !== null && 
              masComunCUP.conteo > servicioTiendaList.length / 2) {
            precio_cup_general = masComunCUP.precio;
            precio_usd_general = masComunUSD.precio;
          } else {
            // Caso especial: si hay exactamente 2 tiendas con precios diferentes,
            // mostrar uno de ellos como precio general (el primero)
            if (servicioTiendaList.length === 2) {
              const precioCUP1 = preciosCUP[0];
              const precioUSD1 = preciosUSD[0];
              if (precioCUP1 !== null && precioUSD1 !== null) {
                precio_cup_general = precioCUP1;
                precio_usd_general = precioUSD1;
              }
            }
          }
        }
        
        setFormData({
          nombre: completeServicio.nombre || '',
          categoria: completeServicio.categoria || '',
          esvendible: completeServicio.esvendible !== undefined ? completeServicio.esvendible : true,
          nota: completeServicio.nota || '',
          servicioTiendaList: servicioTiendaList,
          codigoList: completeServicio.codigoList || completeServicio.codigos || [],
          // Precios y costos generales
          precio_cup_general: precio_cup_general,
          precio_usd_general: precio_usd_general,
          costo_cup_general: costoCupGeneral,
          costo_usd_general: costoUsdGeneral,
          // Lista de componentes para la oferta
          ofertaList: completeServicio.componentes?.map(c => {
            const tiendasServicio = c.tiendas_servicio || c.servicioTiendaList || [];
            const firstTienda = tiendasServicio[0];
            return {
              id_servicio_componente: c.id_servicio,
              cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
              nombre: c.nombre,
              categoria: c.categoria,
              costo_cup: firstTienda?.costo_cup || 0,
              costo_usd: firstTienda?.costo_usd || 0,
            };
          }) || [],
        });
      } catch (err) {
        showToast({ type: 'error', message: 'Error al cargar datos del servicio' });
      } finally {
        setIsFetchingServicio(false);
      }
    };

    fetchCompleteServicio();
  }, [servicio?.id_servicio, canViewCosts, user?.id_tienda, permissions, isOfflineMode]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        // En modo offline, no cargar tiendas de la API
        setTiendas([]);
        return;
      }
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const fetchConfig = async () => {
    try {
      if (isOfflineMode) {
        // En modo offline, no cargar config de la API
        return;
      }
      const data = await configService.getConfig();
      setConfig(data);
      if (data.cupToUsdRate) {
        setExchangeRate(data.cupToUsdRate);
      }
    } catch (err) {
      // Error fetching config
    }
  };

  const fetchAllServicios = async (searchTerm = '', page = 1) => {
    try {
      setIsLoadingServicios(true);
      
      if (isOfflineMode) {
        // En modo offline, cargar servicios de AsyncStorage
        const allServicios = await storageService.getServicios();
        
        let filtered = allServicios;
        
        if (searchTerm) {
          filtered = allServicios.filter(s => 
            s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) && 
            s.id_servicio !== servicio?.id_servicio
          );
        } else {
          filtered = allServicios.filter(s => s.id_servicio !== servicio?.id_servicio);
        }
        
        // Add type indicator based on whether servicio has producto
        const itemsWithTipo = filtered.map(s => ({
          ...s,
          tipo: s.producto ? 'producto' : 'servicio'
        }));
        
        // Sort by name
        itemsWithTipo.sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        const totalItems = itemsWithTipo.length;
        const totalPages = Math.ceil(totalItems / serviciosPagination.limit);
        const startIndex = (page - 1) * serviciosPagination.limit;
        const endIndex = startIndex + serviciosPagination.limit;
        const paginatedItems = itemsWithTipo.slice(startIndex, endIndex);
        
        setAllItems(paginatedItems);
        setServiciosPagination(prev => ({ ...prev, currentPage: page, totalPages, totalItems }));
        return;
      }
      
      // Obtener todos los servicios (incluyendo productos) con paginación del servidor
      const filters = {};
      
      if (searchTerm) {
        filters.nombre = searchTerm;
      }
      
      // Usar fetchProducto=true para obtener servicios y productos
      const limit = serviciosPagination.limit;
      const data = await getServicios({ ...filters, fetchProducto: true }, page, limit);
      
      let allItemsCombined = data.data || [];
      
      // Filtrar el servicio actual si estamos editando
      if (servicio?.id_servicio) {
        allItemsCombined = allItemsCombined.filter(s => s.id_servicio !== servicio.id_servicio);
      }
      
      // Add type indicator based on whether servicio has producto
      const itemsWithTipo = allItemsCombined.map(s => ({
        ...s,
        tipo: s.producto ? 'producto' : 'servicio'
      }));
      
      // Ordenar por nombre
      itemsWithTipo.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
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

  const handleAddServicioComponente = (itemSeleccionado) => {
    const id = itemSeleccionado.id_servicio;
    const existe = formData.ofertaList.find(
      item => item.id_servicio_componente === id
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

  const handleRemoveServicioComponente = (index) => {
    setFormData(prev => ({
      ...prev,
      ofertaList: prev.ofertaList.filter((_, i) => i !== index)
    }));
  };

  const handleCantidadChange = (index, value) => {
    // Track raw text input to allow decimal input
    setCantidadInputTexts(prev => ({ ...prev, [index]: value }));
    
    // Parse the value for the actual data
    const cantidad = parseFloat(value) || 0;
    if (cantidad < 0) {
      showToast({ type: 'warning', message: 'La cantidad no puede ser negativa' });
      return;
    }
    setFormData(prev => {
      const updatedList = prev.ofertaList.map((item, i) => {
        if (i === index) {
          return { ...item, cantidad };
        }
        return item;
      });
      return { ...prev, ofertaList: updatedList };
    });
  };

  const calculateOfertaCosts = () => {
    if (!isOferta || formData.ofertaList.length === 0) {
      return { costo_cup: 0, costo_usd: 0 };
    }

    let totalCostoCup = 0;
    let totalCostoUsd = 0;

    formData.ofertaList.forEach(componente => {
      // Use stored cost data from the component itself, or search in allItems if not available
      let costoCup = componente.costo_cup;
      let costoUsd = componente.costo_usd;

      if (costoCup === undefined || costoUsd === undefined) {
        const itemComponente = allItems.find(item => item.id_servicio === componente.id_servicio_componente);
        if (itemComponente) {
          const tiendasItem = itemComponente.tiendas_servicio || itemComponente.servicioTiendaList || [];
          const firstTienda = tiendasItem[0];
          costoCup = firstTienda?.costo_cup || 0;
          costoUsd = firstTienda?.costo_usd || 0;
        }
      }

      const cantidad = componente.cantidad || 1;
      totalCostoCup += (costoCup || 0) * cantidad;
      totalCostoUsd += (costoUsd || 0) * cantidad;
    });

    return { costo_cup: totalCostoCup, costo_usd: totalCostoUsd };
  };

  const calculateProfitMargin = () => {
    const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(formData.precio_cup_general) || 0;
    const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(formData.precio_usd_general) || 0;
    const costoCup = typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(formData.costo_cup_general) || 0;
    const costoUsd = typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(formData.costo_usd_general) || 0;

    const gananciaCup = precioCup - costoCup;
    const gananciaUsd = precioUsd - costoUsd;

    const porcentajeGananciaCup = precioCup > 0 ? (gananciaCup / precioCup) * 100 : 0;
    const porcentajeGananciaUsd = precioUsd > 0 ? (gananciaUsd / precioUsd) * 100 : 0;

    return {
      porcentajeGananciaCup: !isNaN(porcentajeGananciaCup) ? porcentajeGananciaCup : 0,
      porcentajeGananciaUsd: !isNaN(porcentajeGananciaUsd) ? porcentajeGananciaUsd : 0
    };
  };

  // Update cost fields when oferta components change
  useEffect(() => {
    if (isOferta) {
      const { costo_cup, costo_usd } = calculateOfertaCosts();
      setFormData(prev => ({
        ...prev,
        costo_cup_general: costo_cup,
        costo_usd_general: costo_usd,
      }));
    }
  }, [formData.ofertaList, allItems, isOferta]);

  const handleSave = async () => {
    // Validation
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
    // Validate that oferta has at least one component when in oferta mode
    if (isOferta && (!formData.ofertaList || formData.ofertaList.length === 0)) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un servicio o producto componente para la oferta' });
      return;
    }
    // Validate that there are no duplicate stores in servicioTiendaList
    const tiendaIds = formData.servicioTiendaList.map(item => item.id_tienda).filter(id => id !== null);
    const uniqueTiendaIds = new Set(tiendaIds);
    if (tiendaIds.length !== uniqueTiendaIds.size) {
      showToast({ type: 'error', message: 'No se puede guardar: hay tiendas duplicadas en la lista de precios y costos' });
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
        // Lógica de precios: siempre enviar todos los precios por tienda
        // Si hay precios específicos por tienda, usarlos; si no, usar el precio general
        servicioTiendaList: (() => {
          // Helper function to safely convert to number with 5 decimal places
          const toFixed5 = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
          };

          // Solo incluir tiendas que están explícitamente en servicioTiendaList
          // Usar precios específicos si están disponibles, si no usar precios generales
          const baseList = formData.servicioTiendaList.map(specific => {
            // Solo procesar si la tienda tiene un ID válido
            if (specific.id_tienda === null) return null;
            
            return {
              id_tienda: specific.id_tienda,
              precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
              precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
            };
          }).filter(item => item !== null);
          
          // Apply global cost fields to all stores
          const costoCup = toFixed5(formData.costo_cup_general);
          const costoUsd = toFixed5(formData.costo_usd_general);
          
          return baseList.map(item => ({
            ...item,
            costo_cup: costoCup,
            costo_usd: costoUsd,
          }));
        })(),
        // Incluir ofertaList si hay componentes
        ofertaList: formData.ofertaList.length > 0 ? formData.ofertaList.map(item => ({
          id_servicio_componente: item.id_servicio_componente,
          cantidad: item.cantidad || 1.0,
        })) : [],
      };

      if (isEditMode) {
        await updateServicio(servicio.id_servicio, dataToSend);
        showToast({ type: 'success', message: 'Servicio actualizado correctamente' });
      } else {
        await createServicio(dataToSend);
        showToast({ type: 'success', message: 'Servicio creado correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
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

    // Validate that the code doesn't already exist in the list
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

  const handleOpenScanner = async () => {
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    setNewCodigo(data);
    setShowScannerModal(false);
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
  };

  const handleDeleteCode = (index) => {
    Alert.alert(
      'Eliminar Código',
      '¿Estás seguro de que quieres eliminar este código?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({
              ...prev,
              codigoList: prev.codigoList.filter((_, i) => i !== index)
            }));
          },
        },
      ]
    );
  };

  const handleAddTiendaServicio = () => {
    // Get all active tienda IDs that are not already in the list
    const existingTiendaIds = formData.servicioTiendaList.map(item => item.id_tienda).filter(id => id !== null);
    const availableTiendas = tiendas.filter(tienda => 
      tienda.activo === true && !existingTiendaIds.includes(tienda.id_tienda)
    );

    if (availableTiendas.length === 0) {
      showToast({ type: 'warning', message: 'Todas las tiendas ya están agregadas' });
      return;
    }

    // Add all available tiendas at once
    const newTiendaEntries = availableTiendas.map(tienda => ({
      id_tienda: tienda.id_tienda,
      precio_cup: formData.precio_cup_general,
      precio_usd: formData.precio_usd_general,
    }));

    setFormData(prev => ({
      ...prev,
      servicioTiendaList: [...prev.servicioTiendaList, ...newTiendaEntries]
    }));
  };

  const handleRemoveTiendaServicio = (index) => {
    setFormData(prev => ({
      ...prev,
      servicioTiendaList: prev.servicioTiendaList.filter((_, i) => i !== index)
    }));
    // Rebuild priceInputTexts shifting indices down
    setPriceInputTexts(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const k = parseInt(key);
        if (k < index) updated[k] = prev[k];
        else if (k > index) updated[k - 1] = prev[k];
        // k === index is dropped
      });
      return updated;
    });
  };

  const handleTiendaServicioChange = (index, field, value) => {
    // Prevent duplicate store selections
    if (field === 'id_tienda' && value !== null) {
      const isDuplicate = formData.servicioTiendaList.some((item, i) => 
        i !== index && item.id_tienda === value
      );
      if (isDuplicate) {
        showToast({ type: 'warning', message: 'Esta tienda ya está seleccionada en la lista' });
        return;
      }
    }

    setFormData(prev => {
      const updatedList = prev.servicioTiendaList.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Auto-calculate USD from CUP if exchange rate is configured and value is not null
          // exchangeRate represents: 1 USD = X CUP
          if (exchangeRate && field === 'precio_cup' && value !== null) {
            const cupValue = parseFloat(value) || 0;
            updatedItem.precio_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
          }
          
          // Auto-calculate CUP from USD if exchange rate is configured and value is not null
          // exchangeRate represents: 1 USD = X CUP
          if (exchangeRate && field === 'precio_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.precio_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
          }
          
          return updatedItem;
        }
        return item;
      });
      
      return { ...prev, servicioTiendaList: updatedList };
    });
  };

  const handleGeneralPriceChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate USD from CUP if exchange rate is configured and value is not null
      // exchangeRate represents: 1 USD = X CUP
      if (exchangeRate && field === 'precio_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.precio_usd_general = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.costo_usd_general = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      // Auto-calculate CUP from USD if exchange rate is configured and value is not null
      // exchangeRate represents: 1 USD = X CUP
      if (exchangeRate && field === 'precio_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.precio_cup_general = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.costo_cup_general = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.activo === true && tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <Header 
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        isDark={isDarkMode}
        title={isViewMode ? 'Información del Servicio' : isEditMode ? 'Editar Servicio' : 'Agregar Servicio'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isReadOnly && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Nombre del servicio"
              value={formData.nombre}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
              editable={!isReadOnly}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Categoría *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isReadOnly && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Categoría"
              value={formData.categoria}
              onChangeText={(text) => setFormData(prev => ({ ...prev, categoria: text }))}
              editable={!isReadOnly}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isReadOnly && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Nota (opcional)"
              value={formData.nota}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
              editable={!isReadOnly}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
            <TouchableOpacity
              style={styles.statusSwitchContainer}
              onPress={() => !isReadOnly && setFormData(prev => ({ ...prev, esvendible: !prev.esvendible }))}
              disabled={isReadOnly}
            >
              <View style={[
                styles.statusSwitch,
                { backgroundColor: formData.esvendible ? '#4CAF50' : '#F44336' },
                isReadOnly && styles.inputDisabled
              ]}>
                <View style={[
                  styles.statusSwitchKnob,
                  { transform: [{ translateX: formData.esvendible ? 0 : responsive.responsiveWidth(28) }] }
                ]}>
                  <Text style={[
                    styles.statusSwitchText,
                    { color: formData.esvendible ? '#4CAF50' : '#F44336' }
                  ]}>
                    {formData.esvendible ? 'Vendible' : 'No vendible'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {canViewCosts && !isOferta && (
            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Costo CUP</Text>
                <TextInput
                  style={[
                    styles.input, 
                    { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                    isReadOnly && styles.inputDisabled
                  ]}
                  placeholderTextColor={colors.outline}
                  placeholder="Costo CUP"
                  value={
                    generalPriceInputTexts.costo_cup !== undefined
                      ? generalPriceInputTexts.costo_cup
                      : (formData.costo_cup_general !== null && formData.costo_cup_general !== '' ? parseFloat(formData.costo_cup_general).toFixed(2) : '')
                  }
                  onFocus={() => setGeneralPriceInputTexts(prev => ({
                    ...prev,
                    costo_cup: formData.costo_cup_general !== null && formData.costo_cup_general !== '' ? String(parseFloat(formData.costo_cup_general)) : ''
                  }))}
                  onChangeText={(text) => {
                    setGeneralPriceInputTexts(prev => ({ ...prev, costo_cup: text }));
                    handleGeneralPriceChange('costo_cup_general', text === '' ? null : parseFloat(text));
                  }}
                  onBlur={() => {
                    setGeneralPriceInputTexts(prev => {
                      const updated = { ...prev };
                      delete updated.costo_cup;
                      return updated;
                    });
                  }}
                  keyboardType="decimal-pad"
                  editable={!isViewMode && canEditService}
                />
              </View>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Costo USD</Text>
                <TextInput
                  style={[
                    styles.input, 
                    { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                    isReadOnly && styles.inputDisabled
                  ]}
                  placeholderTextColor={colors.outline}
                  placeholder="Costo USD"
                  value={
                    generalPriceInputTexts.costo_usd !== undefined
                      ? generalPriceInputTexts.costo_usd
                      : (formData.costo_usd_general !== null && formData.costo_usd_general !== '' ? parseFloat(formData.costo_usd_general).toFixed(2) : '')
                  }
                  onFocus={() => setGeneralPriceInputTexts(prev => ({
                    ...prev,
                    costo_usd: formData.costo_usd_general !== null && formData.costo_usd_general !== '' ? String(parseFloat(formData.costo_usd_general)) : ''
                  }))}
                  onChangeText={(text) => {
                    setGeneralPriceInputTexts(prev => ({ ...prev, costo_usd: text }));
                    handleGeneralPriceChange('costo_usd_general', text === '' ? null : parseFloat(text));
                  }}
                  onBlur={() => {
                    setGeneralPriceInputTexts(prev => {
                      const updated = { ...prev };
                      delete updated.costo_usd;
                      return updated;
                    });
                  }}
                  keyboardType="decimal-pad"
                  editable={!isViewMode && canEditService}
                />
              </View>
            </View>
          )}

          {/* Códigos Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Códigos</Text>
              <View style={styles.sectionActions}>
                {canEditCodes && (
                  <TouchableOpacity
                    style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                    onPress={() => setShowAddCodeModal(true)}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsCodesExpanded(!isCodesExpanded)}
                >
                  <Ionicons 
                    name={isCodesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isCodesExpanded && (
              <>
                {formData.codigoList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay códigos agregados
                  </Text>
                ) : (
                  formData.codigoList.map((codigo, index) => (
                    <View key={index} style={[styles.codeItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.codeText, { color: colors.onSurface }]}>
                        {codigo.nota ? `${codigo.nota}-${codigo.codigo_barras_ean}` : codigo.codigo_barras_ean}
                      </Text>
                      {canEditCodes && (
                        <TouchableOpacity
                          style={[styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleDeleteCode(index)}
                        >
                          <Ionicons name="close" size={responsive.responsiveWidth(16)} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          {/* Servicios y Productos (Oferta) Section */}
          {isOferta && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Servicios y Productos (Oferta)</Text>
                <View style={styles.sectionActions}>
                  {canEditService && (
                    <TouchableOpacity
                      style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                      onPress={() => setShowComponenteSelectorModal(true)}
                    >
                      <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                    onPress={() => setIsOfertaExpanded(!isOfertaExpanded)}
                  >
                    <Ionicons 
                      name={isOfertaExpanded ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(18)} 
                      color={isDarkMode ? colors.primary : '#1976D2'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {isOfertaExpanded && (
              <>
                {formData.ofertaList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay servicios ni productos componentes agregados
                  </Text>
                ) : (
                  formData.ofertaList.map((componente, index) => (
                    <View key={index} style={[styles.componenteItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.componenteInfo}>
                        <Text style={[styles.componenteNombre, { color: colors.onSurface }]}>
                          {componente.nombre}
                        </Text>
                        <Text style={[styles.componenteCategoria, { color: colors.outline }]}>
                          {componente.categoria}
                        </Text>
                      </View>
                      <View style={styles.componenteCantidadRow}>
                        <Text style={[styles.componenteLabel, { color: colors.outline }]}>Cantidad:</Text>
                        {canEditService ? (
                          <TextInput
                            style={[styles.componenteCantidadInput, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            value={cantidadInputTexts[index] ?? componente.cantidad?.toString() ?? '1'}
                            onChangeText={(text) => handleCantidadChange(index, text)}
                            onBlur={() => {
                              // Sync the raw text with the actual parsed value on blur
                              const cantidad = componente.cantidad || 1.0;
                              setCantidadInputTexts(prev => ({ ...prev, [index]: cantidad.toString() }));
                            }}
                            keyboardType="decimal-pad"
                          />
                        ) : (
                          <View style={[styles.componenteCantidadInput, styles.inputDisabled, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}>
                            <Text style={{ color: colors.onSurface }}>{componente.cantidad?.toString() || '1'}</Text>
                          </View>
                        )}
                      </View>
                      {canEditService && (
                        <TouchableOpacity
                          style={[styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleRemoveServicioComponente(index)}
                        >
                          <Ionicons name="close" size={responsive.responsiveWidth(18)} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
                {canViewCosts && formData.ofertaList.length > 0 && (
                  <View style={[styles.costSummary, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <Text style={[styles.costSummaryTitle, { color: colors.onSurface }]}>Costo Total de la Oferta</Text>
                    <View style={styles.costSummaryRow}>
                      <Text style={[styles.costSummaryLabel, { color: colors.outline }]}>Costo CUP:</Text>
                      <Text style={[styles.costSummaryValue, { color: colors.onSurface }]}>
                        {formData.costo_cup_general !== null && formData.costo_cup_general !== '' ? parseFloat(formData.costo_cup_general).toFixed(2) : '0.00'}
                      </Text>
                    </View>
                    <View style={styles.costSummaryRow}>
                      <Text style={[styles.costSummaryLabel, { color: colors.outline }]}>Costo USD:</Text>
                      <Text style={[styles.costSummaryValue, { color: colors.onSurface }]}>
                        {formData.costo_usd_general !== null && formData.costo_usd_general !== '' ? parseFloat(formData.costo_usd_general).toFixed(2) : '0.00'}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
          )}

          {/* Precios Generales */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface, marginBottom: responsive.responsiveHeight(12) }]}>Precios Generales</Text>
            <View style={styles.pricesGrid}>
                <View style={styles.priceField}>
                  <Text style={[styles.label, { color: colors.outline }]}>Precio CUP</Text>
                  <TextInput
                    style={[
                      styles.input, 
                      { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                      isReadOnly && styles.inputDisabled
                    ]}
                    placeholderTextColor={colors.outline}
                    placeholder="Precio CUP"
                    value={
                      generalPriceInputTexts.precio_cup !== undefined
                        ? generalPriceInputTexts.precio_cup
                        : (formData.precio_cup_general !== null && formData.precio_cup_general !== '' ? parseFloat(formData.precio_cup_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_cup: formData.precio_cup_general !== null && formData.precio_cup_general !== '' ? String(parseFloat(formData.precio_cup_general)) : ''
                    }))}
                    onChangeText={(text) => {
                      setGeneralPriceInputTexts(prev => ({ ...prev, precio_cup: text }));
                      handleGeneralPriceChange('precio_cup_general', text === '' ? null : parseFloat(text));
                    }}
                    onBlur={() => {
                      setGeneralPriceInputTexts(prev => {
                        const updated = { ...prev };
                        delete updated.precio_cup;
                        return updated;
                      });
                      handleGeneralPriceBlur();
                    }}
                    keyboardType="decimal-pad"
                    editable={!isReadOnly}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={[styles.label, { color: colors.outline }]}>Precio USD</Text>
                  <TextInput
                    style={[
                      styles.input, 
                      { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                      isReadOnly && styles.inputDisabled
                    ]}
                    placeholderTextColor={colors.outline}
                    placeholder="Precio USD"
                    value={
                      generalPriceInputTexts.precio_usd !== undefined
                        ? generalPriceInputTexts.precio_usd
                        : (formData.precio_usd_general !== null && formData.precio_usd_general !== '' ? parseFloat(formData.precio_usd_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_usd: formData.precio_usd_general !== null && formData.precio_usd_general !== '' ? String(parseFloat(formData.precio_usd_general)) : ''
                    }))}
                    onChangeText={(text) => {
                      setGeneralPriceInputTexts(prev => ({ ...prev, precio_usd: text }));
                      handleGeneralPriceChange('precio_usd_general', text === '' ? null : parseFloat(text));
                    }}
                    onBlur={() => {
                      setGeneralPriceInputTexts(prev => {
                        const updated = { ...prev };
                        delete updated.precio_usd;
                        return updated;
                      });
                      handleGeneralPriceBlur();
                    }}
                    keyboardType="decimal-pad"
                    editable={!isReadOnly}
                  />
                </View>
            </View>
          </View>

          {/* Tienda Servicios Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Precios por Tienda</Text>
              <View style={styles.sectionActions}>
                {canEditService && (
                  <TouchableOpacity
                    style={[
                      styles.addButtonSmall, 
                      { 
                        backgroundColor: formData.servicioTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
                          ? colors.outlineVariant 
                          : colors.primary 
                      }
                    ]}
                    onPress={handleAddTiendaServicio}
                    disabled={formData.servicioTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length}
                  >
                    <Ionicons 
                      name="add" 
                      size={responsive.responsiveWidth(18)} 
                      color={formData.servicioTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
                        ? colors.outline 
                        : "#fff"} 
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsPricesExpanded(!isPricesExpanded)}
                >
                  <Ionicons 
                    name={isPricesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isPricesExpanded && (
              <>
                {formData.servicioTiendaList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay precios configurados
                  </Text>
                ) : (
                  formData.servicioTiendaList.map((tiendaServicio, index) => (
                    <View key={index} style={[styles.tiendaServicioItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.tiendaField}>
                        <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
                        <TouchableOpacity
                          style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                          onPress={() => setShowTiendaDropdown(index)}
                          disabled={isViewMode && !canEditService}
                        >
                          <Text style={[styles.dropdownText, { color: tiendaServicio.id_tienda ? colors.onSurface : colors.outline }]}>
                            {tiendas.find(t => t.id_tienda === tiendaServicio.id_tienda)?.nombre || 'Seleccionar tienda'}
                          </Text>
                          <Ionicons 
                            name="chevron-down" 
                            size={responsive.responsiveWidth(18)} 
                            color={colors.outline} 
                          />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.pricesGrid}>
                        <View style={styles.priceField}>
                          <Text style={[styles.label, { color: colors.outline }]}>Precio CUP</Text>
                          <TextInput
                            style={[
                              styles.input, 
                              { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                              isReadOnly && styles.inputDisabled
                            ]}
                            value={
                              priceInputTexts[index]?.precio_cup !== undefined
                                ? priceInputTexts[index].precio_cup
                                : (tiendaServicio.precio_cup !== null && tiendaServicio.precio_cup !== '' ? parseFloat(tiendaServicio.precio_cup).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_cup: tiendaServicio.precio_cup !== null && tiendaServicio.precio_cup !== '' ? String(parseFloat(tiendaServicio.precio_cup)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_cup: text } }));
                              handleTiendaServicioChange(index, 'precio_cup', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_cup;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditService}
                          />
                        </View>
                        <View style={styles.priceField}>
                          <Text style={[styles.label, { color: colors.outline }]}>Precio USD</Text>
                          <TextInput
                            style={[
                              styles.input, 
                              { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                              isReadOnly && styles.inputDisabled
                            ]}
                            value={
                              priceInputTexts[index]?.precio_usd !== undefined
                                ? priceInputTexts[index].precio_usd
                                : (tiendaServicio.precio_usd !== null && tiendaServicio.precio_usd !== '' ? parseFloat(tiendaServicio.precio_usd).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_usd: tiendaServicio.precio_usd !== null && tiendaServicio.precio_usd !== '' ? String(parseFloat(tiendaServicio.precio_usd)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_usd: text } }));
                              handleTiendaServicioChange(index, 'precio_usd', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_usd;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditService}
                          />
                        </View>
                      </View>
                      
                      {(!isViewMode || canEditService) && (
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleRemoveTiendaServicio(index)}
                        >
                          <Text style={[styles.removeButtonText, { color: colors.error }]}>Eliminar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          {(!isViewMode || canEditService) && !isOfflineMode && (
            <View style={styles.profitMarginContainer}>
              <Text style={[styles.profitMarginLabel, { color: colors.outline }]}>% Ganancia</Text>
              <View style={[styles.profitBadge, { backgroundColor: calculateProfitMargin().porcentajeGananciaCup >= 0 ? (isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDark ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: calculateProfitMargin().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                <Text style={[styles.profitMarginValue, { color: calculateProfitMargin().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                  {calculateProfitMargin().porcentajeGananciaCup.toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {(!isViewMode || canEditService) && !isOfflineMode && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {isViewMode && canEditService && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.setParams({ mode: 'edit' })}
          >
            <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color="#fff" />
            <Text style={[styles.editButtonText, { color: '#fff' }]}>Editar Servicio</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add Code Modal */}
      <Modal
        visible={showAddCodeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Agregar Código</Text>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Código *</Text>
              <View style={[styles.inputWithIcon, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.inputWithIconText, { color: colors.onSurface }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Código de barras"
                  value={newCodigo}
                  onChangeText={setNewCodigo}
                  keyboardType="default"
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  onPress={() => {
                    handleOpenScanner();
                  }}
                  style={styles.cameraButton}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="camera-outline" 
                    size={responsive.responsiveWidth(24)} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Nota (opcional)"
                value={newNota}
                onChangeText={setNewNota}
              />
            </View>
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setNewCodigo('');
                  setNewNota('');
                  setShowAddCodeModal(false);
                }}
              >
                <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddCode}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <Modal
          visible={showScannerModal}
          animationType="slide"
          onRequestClose={() => setShowScannerModal(false)}
        >
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              onBarcodeScanned={handleBarcodeScanned}
              facing="back"
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerCorner} />
              <View style={[styles.scannerCorner, styles.scannerCornerTopRight]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBottomLeft]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBottomRight]} />
              <Text style={[styles.scannerText, { color: '#fff' }]}>
                Escanea el código de barras
              </Text>
              <TouchableOpacity
                style={[styles.scannerCancelButton, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
                onPress={() => setShowScannerModal(false)}
              >
                <Text style={[styles.scannerCancelButtonText, { color: '#fff' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Tienda Dropdown Modal */}
      {showTiendaDropdown !== false && (
        <Modal
          visible={showTiendaDropdown !== false}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTiendaDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTiendaDropdown(false)}
          >
            <Card style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                <Ionicons 
                  name="search-outline" 
                  size={responsive.responsiveWidth(18)} 
                  color={colors.outline} 
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar tienda..."
                  value={tiendaSearchText}
                  onChangeText={setTiendaSearchText}
                />
              </View>
              <ScrollView style={styles.dropdownScroll}>
                {filteredTiendas.length > 0 ? (
                  filteredTiendas.map((tienda, index) => (
                    <TouchableOpacity
                      key={tienda.id_tienda}
                      style={styles.dropdownItem}
                      onPress={() => {
                        handleTiendaServicioChange(showTiendaDropdown, 'id_tienda', tienda.id_tienda);
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                )}
              </ScrollView>
            </Card>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Componente Selector Modal */}
      {showComponenteSelectorModal && (
        <Modal
          visible={showComponenteSelectorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowComponenteSelectorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Card style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Servicio o Producto</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowComponenteSelectorModal(false)}
                >
                  <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
              <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                <Ionicons 
                  name="search" 
                  size={responsive.responsiveWidth(18)} 
                  color={colors.outline} 
                  style={styles.searchIcon}
                />
                <TextInput
                  style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar servicio o producto..."
                  value={componenteSearchText}
                  onChangeText={setComponenteSearchText}
                />
              </View>
              <ScrollView style={styles.dropdownScroll}>
                {isLoadingServicios ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.outline }]}>Cargando servicios y productos...</Text>
                  </View>
                ) : allItems.length === 0 ? (
                  <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron servicios ni productos</Text>
                ) : (
                  allItems.map((item, index) => {
                    const key = item.id_servicio || `${item.tipo}-${item.nombre}-${index}`;
                    return (
                      <View key={key}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => handleAddServicioComponente(item)}
                      >
                        <View style={styles.dropdownItemContent}>
                          <View style={styles.dropdownItemMain}>
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{item.nombre}</Text>
                            <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{item.categoria}</Text>
                          </View>
                          <View style={[
                            styles.typeBadge, 
                            { backgroundColor: item.tipo === 'servicio' ? colors.primary : colors.tertiary }
                          ]}>
                            <Text style={[
                              styles.typeBadgeText,
                              { color: '#fff' }
                            ]}>
                              {item.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {index < allItems.length - 1 && (
                        <View style={[styles.separatorLine, { backgroundColor: colors.outlineVariant }]} />
                      )}
                    </View>
                    );
                  })
                )}
              </ScrollView>
              {serviciosPagination.totalPages > 1 && (
                <View style={styles.paginationControls}>
                  <TouchableOpacity
                    style={[styles.paginationButton, serviciosPagination.currentPage === 1 && styles.paginationButtonDisabled]}
                    onPress={handleServicioPrevPage}
                    disabled={serviciosPagination.currentPage === 1}
                  >
                    <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={serviciosPagination.currentPage === 1 ? colors.outline : colors.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                    {serviciosPagination.currentPage} / {serviciosPagination.totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.paginationButton, serviciosPagination.currentPage === serviciosPagination.totalPages && styles.paginationButtonDisabled]}
                    onPress={handleServicioNextPage}
                    disabled={serviciosPagination.currentPage === serviciosPagination.totalPages}
                  >
                    <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={serviciosPagination.currentPage === serviciosPagination.totalPages ? colors.outline : colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </View>
        </Modal>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const ServicioFormScreen = () => <ServicioFormContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(50),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(20),
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  formColumn: {
    flex: 1,
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  inputWithIcon: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(12),
  },
  inputWithIconText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    paddingVertical: responsive.responsivePadding(12),
  },
  cameraButton: {
    padding: responsive.responsivePadding(12),
    marginLeft: responsive.responsiveMargin(8),
    minWidth: responsive.responsiveWidth(44),
    minHeight: responsive.responsiveHeight(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    opacity: 0.7,
  },
  statusSwitchContainer: {
    alignSelf: 'flex-start',
  },
  statusSwitch: {
    width: responsive.responsiveWidth(100),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  statusSwitchKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: responsive.responsiveWidth(70),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSwitchText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'Inter',
    textAlign: 'center',
    paddingHorizontal: responsive.responsivePadding(4),
  },
  section: {
    marginTop: responsive.responsiveMargin(24),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  pricesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(12),
  },
  priceField: {
    flex: 1,
    minWidth: '45%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  addButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  codeText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  deleteButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: responsive.responsiveMargin(8),
  },
  tiendaServicioItem: {
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(12),
  },
  tiendaServicioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  tiendaServicioLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  dropdownSmall: {
    borderWidth: 1,
    borderRadius: 6,
    padding: responsive.responsivePadding(8),
    flex: 1.5,
  },
  dropdownTextSmall: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  inputSmall: {
    borderWidth: 1,
    borderRadius: 6,
    padding: responsive.responsivePadding(8),
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    flex: 1.5,
    textAlign: 'right',
  },
  removeButton: {
    marginTop: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(8),
    borderRadius: 6,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(24),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  closeButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: responsive.responsiveWidth(20),
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownModal: {
    width: '100%',
    maxHeight: responsive.responsiveHeight(600),
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownItemSubtext: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  dropdownItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemMain: {
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    marginLeft: responsive.responsiveMargin(8),
  },
  typeBadgeText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  separatorLine: {
    height: 1,
    marginVertical: responsive.responsiveMargin(8),
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(500),
  },
  loadingContainer: {
    padding: responsive.responsivePadding(20),
    alignItems: 'center',
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(8),
    fontSize: responsive.fontSizes.bodySmall,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  paginationButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
  },
  componenteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  componenteInfo: {
    flex: 1,
  },
  componenteNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  componenteNombre: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  componenteTypeBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    marginLeft: responsive.responsiveMargin(8),
  },
  componenteTypeBadgeText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  componenteCategoria: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  componenteCantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  componenteLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  componenteCantidadInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: responsive.responsivePadding(8),
    width: responsive.responsiveWidth(80),
    textAlign: 'center',
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  costSummary: {
    marginTop: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    borderWidth: 1,
  },
  costSummaryTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  costSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  costSummaryLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  costSummaryValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  deleteButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: responsive.responsiveMargin(8),
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerCorner: {
    position: 'absolute',
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderColor: '#fff',
    borderWidth: 3,
    top: '30%',
    left: '15%',
  },
  scannerCornerTopRight: {
    left: undefined,
    right: '15%',
  },
  scannerCornerBottomLeft: {
    top: undefined,
    bottom: '30%',
  },
  scannerCornerBottomRight: {
    top: undefined,
    bottom: '30%',
    left: undefined,
    right: '15%',
  },
  scannerText: {
    marginTop: responsive.responsiveMargin(250),
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  scannerCancelButton: {
    marginTop: responsive.responsiveMargin(20),
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  scannerCancelButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  profitMarginContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(8),
    paddingHorizontal: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(12),
  },
  profitMarginLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  profitBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    borderWidth: 1,
  },
  profitMarginValue: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
