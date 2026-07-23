import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
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
import { configService } from '../services/configService';
import { storageService } from '../services/storageService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView } from 'expo-camera';
import * as Camera from 'expo-camera';

const ServicioFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
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
  const [allServicios, setAllServicios] = useState([]);
  const [showComponenteSelectorModal, setShowComponenteSelectorModal] = useState(false);
  const [componenteSearchText, setComponenteSearchText] = useState('');
  const [isOfertaExpanded, setIsOfertaExpanded] = useState(false);
  
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
    ofertaList: servicio?.componentes?.map(c => ({
      id_servicio_componente: c.id_servicio,
      cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
      nombre: c.nombre,
      categoria: c.categoria
    })) || [],
  });

  // Estado para controlar si las secciones están expandidas o colapsadas
  // Por defecto, todas contraídas al entrar (tanto en modo add como edit)
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isGeneralPricesExpanded, setIsGeneralPricesExpanded] = useState(false);
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
      formData.precio_usd_general !== '' &&
      (formData.costo_cup_general !== null && formData.costo_cup_general !== '' || !canViewCosts) &&
      (formData.costo_usd_general !== null && formData.costo_usd_general !== '' || !canViewCosts);

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
  
  const canEditService = isAdmin;
  const canEditCodes = isAdmin; // Only admin can edit codes
  const canViewCosts = !isDependiente && !isAlmacenero;

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
    fetchAllServicios();
  }, []);

  useEffect(() => {
    const fetchCompleteServicio = async () => {
      console.log('=== fetchCompleteServicio called ===');
      console.log('isEditMode:', isEditMode);
      console.log('mode:', mode);
      console.log('servicio:', servicio);
      console.log('servicio?.id_servicio:', servicio?.id_servicio);
      console.log('isOfflineMode:', isOfflineMode);
      
      if (servicio?.id_servicio) {
        try {
          setIsFetchingServicio(true);
          
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
          
          console.log('=== Complete servicio fetched ===');
          console.log('completeServicio:', completeServicio);
          console.log('tiendas_servicio:', completeServicio.tiendas_servicio);
          
          // Apply store visibility permissions for non-admin users
          const userRole = user?.rol?.toLowerCase();
          const canViewAllStores = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && permissions?.dependiente) ||
            (userRole === 'almacenero' && permissions?.almacenero) ||
            (userRole === 'económico' && permissions?.economico);

          console.log('User role:', userRole);
          console.log('Can view all stores:', canViewAllStores);
          console.log('User id_tienda:', user?.id_tienda);
          console.log('Permissions:', permissions);

          let servicioTiendaList = completeServicio.servicioTiendaList || completeServicio.tiendas_servicio || [];
          console.log('Original servicioTiendaList length:', servicioTiendaList.length);
          
          // If user cannot view all stores, filter to show only their own store
          if (!canViewAllStores && user?.id_tienda) {
            console.log('Filtering tiendas_servicio for user store:', user.id_tienda);
            servicioTiendaList = servicioTiendaList.filter(ts => ts.id_tienda === user.id_tienda);
            console.log('Filtered servicioTiendaList length:', servicioTiendaList.length);
            console.log('Filtered servicioTiendaList:', servicioTiendaList);
          }
          
          // Calcular precios generales a partir de los precios por tienda
          // Si todas las tiendas tienen el mismo precio, usarlo como precio general
          // Si algunas tiendas tienen precios diferentes, inferir cuál es el precio general
          let precio_cup_general = null;
          let precio_usd_general = null;
          let costo_cup_general = null;
          let costo_usd_general = null;
          
          if (servicioTiendaList.length > 0) {
            console.log('servicioTiendaList:', servicioTiendaList);
            
            // Contar cuántas tiendas tienen cada precio CUP
            const preciosCUP = servicioTiendaList.map(item => item.precio_cup);
            const preciosUSD = servicioTiendaList.map(item => item.precio_usd);
            console.log('preciosCUP:', preciosCUP);
            console.log('preciosUSD:', preciosUSD);
            
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
            console.log('masComunCUP:', masComunCUP);
            console.log('masComunUSD:', masComunUSD);
            
            // Si hay un precio que se repite en la mayoría de las tiendas, usarlo como precio general
            if (masComunCUP.precio !== null && masComunUSD.precio !== null && 
                masComunCUP.conteo > servicioTiendaList.length / 2) {
              precio_cup_general = masComunCUP.precio;
              precio_usd_general = masComunUSD.precio;
              console.log('Usando precio general por mayoría:', precio_cup_general, precio_usd_general);
            } else {
              // Caso especial: si hay exactamente 2 tiendas con precios diferentes,
              // mostrar uno de ellos como precio general (el primero)
              if (servicioTiendaList.length === 2) {
                const precioCUP1 = preciosCUP[0];
                const precioUSD1 = preciosUSD[0];
                console.log('Caso especial 2 tiendas, usando primera:', precioCUP1, precioUSD1);
                if (precioCUP1 !== null && precioUSD1 !== null) {
                  precio_cup_general = precioCUP1;
                  precio_usd_general = precioUSD1;
                }
              }
            }
            
            // Lo mismo para costos si es que tienen y el usuario puede verlos
            if (canViewCosts) {
              const costosCUP = servicioTiendaList.map(item => item.costo_cup);
              const costosUSD = servicioTiendaList.map(item => item.costo_usd);
              console.log('costosCUP:', costosCUP);
              console.log('costosUSD:', costosUSD);
              
              const masComunCostoCUP = encontrarPrecioMasComun(costosCUP);
              const masComunCostoUSD = encontrarPrecioMasComun(costosUSD);
              console.log('masComunCostoCUP:', masComunCostoCUP);
              console.log('masComunCostoUSD:', masComunCostoUSD);
              
              if (masComunCostoCUP.precio !== null && masComunCostoUSD.precio !== null &&
                  masComunCostoCUP.conteo > servicioTiendaList.length / 2) {
                costo_cup_general = masComunCostoCUP.precio;
                costo_usd_general = masComunCostoUSD.precio;
                console.log('Usando costo general por mayoría:', costo_cup_general, costo_usd_general);
              } else {
                // Caso especial: si hay exactamente 2 tiendas con precios diferentes,
                // mostrar uno de ellos como precio general (el primero)
                if (servicioTiendaList.length === 2) {
                  const costoCUP1 = costosCUP[0];
                  const costoUSD1 = costosUSD[0];
                  console.log('Caso especial 2 tiendas (costos), usando primera:', costoCUP1, costoUSD1);
                  if (costoCUP1 !== null && costoUSD1 !== null) {
                    costo_cup_general = costoCUP1;
                    costo_usd_general = costoUSD1;
                  }
                }
              }
            }
          }
          console.log('Precios calculados:', { precio_cup_general, precio_usd_general, costo_cup_general, costo_usd_general });
          
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
            costo_cup_general: costo_cup_general,
            costo_usd_general: costo_usd_general,
            // Lista de componentes para la oferta
            ofertaList: completeServicio.componentes?.map(c => ({
              id_servicio_componente: c.id_servicio,
              cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
              nombre: c.nombre,
              categoria: c.categoria
            })) || [],
          });
        } catch (err) {
          console.error('Error fetching complete servicio:', err);
          showToast({ type: 'error', message: 'Error al cargar datos del servicio' });
        } finally {
          setIsFetchingServicio(false);
        }
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
      console.error('Error fetching tiendas:', err);
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
      console.error('Error fetching config:', err);
    }
  };

  const fetchAllServicios = async () => {
    try {
      if (isOfflineMode) {
        // En modo offline, cargar servicios de AsyncStorage
        const allServicios = await storageService.getServicios();
        setAllServicios(allServicios);
        return;
      }
      // Obtener todos los servicios (vendibles y no vendibles)
      const dataVendibles = await getServicios({ esvendible: 'true' }, 1, 1000);
      const dataNoVendibles = await getServicios({ esvendible: 'false' }, 1, 1000);
      const allServicios = [...(dataVendibles.data || []), ...(dataNoVendibles.data || [])];
      setAllServicios(allServicios);
    } catch (err) {
      console.error('Error fetching servicios:', err);
    }
  };

  const handleAddServicioComponente = (servicioSeleccionado) => {
    const existe = formData.ofertaList.find(
      item => item.id_servicio_componente === servicioSeleccionado.id_servicio
    );
    if (existe) {
      showToast({ type: 'warning', message: 'Este servicio ya está agregado como componente' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      ofertaList: [
        ...prev.ofertaList,
        {
          id_servicio_componente: servicioSeleccionado.id_servicio,
          cantidad: 1.0,
          nombre: servicioSeleccionado.nombre,
          categoria: servicioSeleccionado.categoria
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
      showToast({ type: 'warning', message: 'Debe agregar al menos un servicio componente para la oferta' });
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

          // Si hay precios generales definidos, crear entradas para todas las tiendas activas con el precio general
          let baseList = [];
          if (formData.precio_cup_general !== null || formData.precio_usd_general !== null || 
              formData.costo_cup_general !== null || formData.costo_usd_general !== null) {
            baseList = tiendas.filter(tienda => tienda.activo === true).map(tienda => ({
              id_tienda: tienda.id_tienda,
              precio_cup: toFixed5(formData.precio_cup_general),
              precio_usd: toFixed5(formData.precio_usd_general),
              costo_cup: toFixed5(formData.costo_cup_general),
              costo_usd: toFixed5(formData.costo_usd_general),
            }));
          }
          
          // Si hay precios específicos por tienda, sobrescribir o agregar
          if (formData.servicioTiendaList.length > 0) {
            formData.servicioTiendaList.forEach(specific => {
              // Solo procesar si la tienda tiene un ID válido
              if (specific.id_tienda === null) return;
              
              const existingIndex = baseList.findIndex(item => item.id_tienda === specific.id_tienda);
              if (existingIndex >= 0) {
                // Sobrescribir con precios específicos (usar general si específico es null)
                baseList[existingIndex] = {
                  ...baseList[existingIndex],
                  precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
                  precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
                  costo_cup: specific.costo_cup !== null ? toFixed5(specific.costo_cup) : toFixed5(formData.costo_cup_general),
                  costo_usd: specific.costo_usd !== null ? toFixed5(specific.costo_usd) : toFixed5(formData.costo_usd_general),
                };
              } else {
                // Agregar nueva tienda específica
                baseList.push({
                  id_tienda: specific.id_tienda,
                  precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
                  precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
                  costo_cup: specific.costo_cup !== null ? toFixed5(specific.costo_cup) : toFixed5(formData.costo_cup_general),
                  costo_usd: specific.costo_usd !== null ? toFixed5(specific.costo_usd) : toFixed5(formData.costo_usd_general),
                });
              }
            });
          }
          
          return baseList;
        })(),
        // Incluir ofertaList si hay componentes
        ofertaList: formData.ofertaList.length > 0 ? formData.ofertaList.map(item => ({
          id_servicio_componente: item.id_servicio_componente,
          cantidad: item.cantidad || 1.0,
        })) : [],
      };
      console.log('Data to send:', dataToSend);

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
    console.log('handleOpenScanner called');
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    console.log('Barcode scanned:', data);
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
      costo_cup: formData.costo_cup_general,
      costo_usd: formData.costo_usd_general,
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
          
          if (exchangeRate && field === 'costo_cup' && value !== null) {
            const cupValue = parseFloat(value) || 0;
            updatedItem.costo_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
          }
          
          // Auto-calculate CUP from USD if exchange rate is configured and value is not null
          // exchangeRate represents: 1 USD = X CUP
          if (exchangeRate && field === 'precio_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.precio_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
          }
          
          if (exchangeRate && field === 'costo_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.costo_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={responsive.headerHeight + 20}
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

          {/* Servicios (Oferta) Section */}
          {isOferta && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Servicios (Oferta)</Text>
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
                    No hay servicios componentes agregados
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
              </>
            )}
          </View>
          )}

          {/* Precios Generales Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Precios Generales</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsGeneralPricesExpanded(!isGeneralPricesExpanded)}
                >
                  <Ionicons 
                    name={isGeneralPricesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isGeneralPricesExpanded && (
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
                {canViewCosts && (
                  <>
                    <View style={styles.priceField}>
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
                          handleGeneralPriceBlur();
                        }}
                        keyboardType="decimal-pad"
                        editable={!isViewMode || canEditService}
                      />
                    </View>
                    <View style={styles.priceField}>
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
                          handleGeneralPriceBlur();
                        }}
                        keyboardType="decimal-pad"
                        editable={!isViewMode || canEditService}
                      />
                    </View>
                  </>
                )}
              </View>
            )}
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
                        {canViewCosts && (
                          <>
                            <View style={styles.priceField}>
                              <Text style={[styles.label, { color: colors.outline }]}>Costo CUP</Text>
                              <TextInput
                                style={[
                                  styles.input, 
                                  { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                                  isReadOnly && styles.inputDisabled
                                ]}
                                value={
                                  priceInputTexts[index]?.costo_cup !== undefined
                                    ? priceInputTexts[index].costo_cup
                                    : (tiendaServicio.costo_cup !== null && tiendaServicio.costo_cup !== '' ? parseFloat(tiendaServicio.costo_cup).toFixed(2) : '')
                                }
                                onFocus={() => setPriceInputTexts(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], costo_cup: tiendaServicio.costo_cup !== null && tiendaServicio.costo_cup !== '' ? String(parseFloat(tiendaServicio.costo_cup)) : '' }
                                }))}
                                onChangeText={(text) => {
                                  setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], costo_cup: text } }));
                                  handleTiendaServicioChange(index, 'costo_cup', text === '' ? null : parseFloat(text));
                                }}
                                onBlur={() => setPriceInputTexts(prev => {
                                  const updated = { ...prev[index] };
                                  delete updated.costo_cup;
                                  return { ...prev, [index]: updated };
                                })}
                                keyboardType="decimal-pad"
                                editable={!isViewMode || canEditService}
                              />
                            </View>
                            <View style={styles.priceField}>
                              <Text style={[styles.label, { color: colors.outline }]}>Costo USD</Text>
                              <TextInput
                                style={[
                                  styles.input, 
                                  { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                                  isReadOnly && styles.inputDisabled
                                ]}
                                value={
                                  priceInputTexts[index]?.costo_usd !== undefined
                                    ? priceInputTexts[index].costo_usd
                                    : (tiendaServicio.costo_usd !== null && tiendaServicio.costo_usd !== '' ? parseFloat(tiendaServicio.costo_usd).toFixed(2) : '')
                                }
                                onFocus={() => setPriceInputTexts(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], costo_usd: tiendaServicio.costo_usd !== null && tiendaServicio.costo_usd !== '' ? String(parseFloat(tiendaServicio.costo_usd)) : '' }
                                }))}
                                onChangeText={(text) => {
                                  setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], costo_usd: text } }));
                                  handleTiendaServicioChange(index, 'costo_usd', text === '' ? null : parseFloat(text));
                                }}
                                onBlur={() => setPriceInputTexts(prev => {
                                  const updated = { ...prev[index] };
                                  delete updated.costo_usd;
                                  return { ...prev, [index]: updated };
                                })}
                                keyboardType="decimal-pad"
                                editable={!isViewMode || canEditService}
                              />
                            </View>
                          </>
                        )}
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
                    console.log('Camera button pressed');
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
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowComponenteSelectorModal(false)}
          >
            <Card style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Servicio Componente</Text>
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
                  placeholder="Buscar servicio..."
                  value={componenteSearchText}
                  onChangeText={setComponenteSearchText}
                />
              </View>
              <ScrollView style={styles.dropdownScroll}>
                {allServicios
                  .filter(s => s.nombre.toLowerCase().includes(componenteSearchText.toLowerCase()) && s.id_servicio !== servicio?.id_servicio)
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map((servicio) => (
                    <TouchableOpacity
                      key={servicio.id_servicio}
                      style={styles.dropdownItem}
                      onPress={() => handleAddServicioComponente(servicio)}
                    >
                      <View>
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                        <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{servicio.categoria}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </Card>
          </TouchableOpacity>
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
    marginBottom: responsive.responsiveMargin(20),
  },
  dropdownModal: {
    width: '100%',
    maxHeight: responsive.responsiveHeight(300),
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
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
  componenteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  componenteInfo: {
    flex: 1,
  },
  componenteNombre: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  componenteCategoria: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
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
    width: responsive.responsiveWidth(80),
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(8),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
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
});
