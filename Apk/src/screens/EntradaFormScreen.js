import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { createEntrada, updateEntrada, getEntradaById, getEntradas, createEntradasBulk, createEntradaConFabricacion, updateEntradaConFabricacion } from '../services/entradaService';
import { getProductos, getProductoById, updateProducto } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import { getCuentas, createOperacion } from '../services/cuentaService';
import configService from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';

const EntradaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, entradaAccessLevels, entradaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const productoInputRef = useRef(null);
  const multipleProductoInputRefs = useRef({});

  const { entrada, mode, productoPreSeleccionado, canViewAllEntradas: canViewAllEntradasParam, entradaData, fromModal, tiendaPreSeleccionada } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingEntrada, setIsFetchingEntrada] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [productos, setProductos] = useState([]);
  const [productoSearchResults, setProductoSearchResults] = useState([]);
  const [isSearchingProductos, setIsSearchingProductos] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [justSelectedProducto, setJustSelectedProducto] = useState(false);
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  // Tracks raw text while the user is typing in costo fields (avoids .toFixed forcing cursor to end)
  const [costoInputTexts, setCostoInputTexts] = useState({});
  // Tracks raw text while the user is typing in precio fields
  const [precioInputTexts, setPrecioInputTexts] = useState({});
  
  // Estado para modo múltiple
  const [isMultipleMode, setIsMultipleMode] = useState(false);
  const [multipleEntradas, setMultipleEntradas] = useState([]);
  const [multipleProductoSearchResults, setMultipleProductoSearchResults] = useState({});
  const [multipleShowProductoDropdown, setMultipleShowProductoDropdown] = useState({});
  const [multipleIsSearchingProductos, setMultipleIsSearchingProductos] = useState({});
  const [multipleJustSelectedProducto, setMultipleJustSelectedProducto] = useState({});
  const [multipleCostoInputTexts, setMultipleCostoInputTexts] = useState({});
  const [multipleShowDatePicker, setMultipleShowDatePicker] = useState({});
  // Tracks if user has manually modified costos (to prevent auto-fill from overwriting)
  const [hasManuallyModifiedCostos, setHasManuallyModifiedCostos] = useState(false);
  
  // Estado para modo fabricación
  const [isFabricacionMode, setIsFabricacionMode] = useState(false);
  const [fabricaciones, setFabricaciones] = useState([]);
  const [fabricacionProductoSearchResults, setFabricacionProductoSearchResults] = useState({});
  const [fabricacionShowProductoDropdown, setFabricacionShowProductoDropdown] = useState({});
  const [fabricacionIsSearchingProductos, setFabricacionIsSearchingProductos] = useState({});
  const [fabricacionJustSelectedProducto, setFabricacionJustSelectedProducto] = useState({});
  const [fabricacionCostoInputTexts, setFabricacionCostoInputTexts] = useState({});
  
  // Estado para el modal de costos sugeridos
  const [showCostSuggestionModal, setShowCostSuggestionModal] = useState(false);
  const [suggestedCosts, setSuggestedCosts] = useState(null);
  const [currentCosts, setCurrentCosts] = useState(null);
  const [isMultipleCostSuggestion, setIsMultipleCostSuggestion] = useState(false);
  const [multipleSuggestedCosts, setMultipleSuggestedCosts] = useState([]);
  const [multipleCurrentCosts, setMultipleCurrentCosts] = useState([]);

  // Estado para el modal de costos de fabricación
  const [showFabricacionCostModal, setShowFabricacionCostModal] = useState(false);
  const [fabricacionCostOption, setFabricacionCostOption] = useState(null);
  const [fabricacionManualCostCup, setFabricacionManualCostCup] = useState('');
  const [fabricacionManualCostUsd, setFabricacionManualCostUsd] = useState('');
  const [modifyProductPrice, setModifyProductPrice] = useState(false);

  const [formData, setFormData] = useState({
    id_servicio_tienda: null,
    cantidad_entrada: '',
    costo_usd: '',
    costo_cup: '',
    precio_usd: '',
    precio_cup: '',
    fecha_vencimiento: '',
    nombre_proveedor: '',
    fecha: new Date().toISOString().split('T')[0] + 'T12:00:00',
    producto: null,
    tienda: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFechaEntradaPicker, setShowFechaEntradaPicker] = useState(false);
  const [showExpirationAlert, setShowExpirationAlert] = useState(false);
  const [expirationAlertData, setExpirationAlertData] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawModalData, setWithdrawModalData] = useState(null);

  // Función para calcular el umbral dinámico
  const calculateThreshold = (vidaUtil, percentage, minDays, maxDays) => {
    const threshold = vidaUtil * percentage;
    return Math.max(minDays, Math.min(maxDays, threshold));
  };

  // Función para determinar el nivel de alerta de una entrada
  const getExpirationAlert = (fechaCreacion, fechaVencimiento) => {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const creacion = new Date(fechaCreacion);
    
    // Calcular días
    const vidaUtil = Math.ceil((vencimiento - creacion) / (1000 * 60 * 60 * 24));
    const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    // Si ya venció
    if (diasRestantes <= 0) {
      return { level: 'expired', days: diasRestantes, label: 'Vencido' };
    }
    
    // Calcular umbrales
    const umbralAmarillo = calculateThreshold(vidaUtil, 0.20, 3, 30);
    const umbralRojo = calculateThreshold(vidaUtil, 0.10, 1, 7);
    
    // Determinar nivel
    if (diasRestantes <= umbralRojo) {
      return { level: 'critical', days: diasRestantes, label: 'Crítico' };
    } else if (diasRestantes <= umbralAmarillo) {
      return { level: 'warning', days: diasRestantes, label: 'Próximo a vencer' };
    } else {
      return { level: 'ok', days: diasRestantes, label: 'Vigente' };
    }
  };

  // Helper function to format date correctly without timezone issues
  const formatDateToLocal = (dateString, isDateOnly = false) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    // Append time only for DATE fields, not DATEONLY fields
    if (isDateOnly) {
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}-${day}T12:00:00`;
  };

  // Helper function to format date for display (without time component)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const userRole = user?.rol?.toLowerCase();
  const canManageEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
    (userRole === 'económico' && entradaManagePermissions?.economico);

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const checkExpirationAlert = async () => {
      try {
        const fromAlert = await AsyncStorage.getItem('from_expiration_alert');
        const entradaId = await AsyncStorage.getItem('expiration_alert_entrada_id');
        
        // Verificar si se abrió desde alerta
        if (fromAlert === 'true' && entradaId && entrada?.id_entrada?.toString() === entradaId) {
          // Limpiar el AsyncStorage
          await AsyncStorage.removeItem('from_expiration_alert');
          await AsyncStorage.removeItem('expiration_alert_producto_id');
          await AsyncStorage.removeItem('expiration_alert_entrada_id');
          
          // Mostrar alerta de que la entrada está próxima a vencer
          setShowExpirationAlert(true);
          setExpirationAlertData({
            entradaId: entrada.id_entrada,
            message: 'Esta entrada está próxima a vencer'
          });
        } else if (entrada?.fecha && entrada?.fecha_vencimiento && entrada?.cantidad_restante > 0) {
          // Verificar automáticamente si la entrada tiene vencimiento próximo
          const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
          
          if (alerta.level === 'critical' || alerta.level === 'warning' || alerta.level === 'expired') {
            setShowExpirationAlert(true);
            setExpirationAlertData({
              entradaId: entrada.id_entrada,
              message: alerta.label === 'Vencido' ? 'Esta entrada está vencida' : 'Esta entrada está próxima a vencer'
            });
          }
        }
      } catch (error) {
        // Error al verificar alerta de vencimiento
      }
    };
    
    checkExpirationAlert();
  }, [entrada?.id_entrada, entrada?.fecha, entrada?.fecha_vencimiento, entrada?.cantidad_restante]);

  useEffect(() => {
    const fetchCompleteEntrada = async () => {
      if (entrada?.id_entrada) {
        try {
          setIsFetchingEntrada(true);
          
          let completeEntrada;
          if (isOfflineMode) {
            completeEntrada = entrada;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeEntrada = await getEntradaById(entrada.id_entrada);
          }
          
          const producto = completeEntrada.servicioTienda?.servicio;
          const tienda = completeEntrada.servicioTienda?.tienda;
          
          // Auto-fill prices from product-tienda relationship if it exists
          let precioCup = '';
          let precioUsd = '';
          let productoCompleto = producto;
          
          if (producto && tienda) {
            // Get complete product with tiendas_servicio relationships
            try {
              productoCompleto = await getProductoById(producto.id_servicio);
              const productoTienda = productoCompleto.tiendas_servicio?.find(
                ts => ts.id_tienda === tienda.id_tienda
              );
              if (productoTienda) {
                precioCup = productoTienda.precio_cup?.toString() || '';
                precioUsd = productoTienda.precio_usd?.toString() || '';
              }
            } catch (err) {
              // Error al obtener producto completo, usar producto inicial
            }
          }
          
          // Check if entrada has fabricaciones
          const hasFabricaciones = completeEntrada.fabricaciones && completeEntrada.fabricaciones.length > 0;
          
          // If it has fabricaciones, activate fabricación mode and load them
          if (hasFabricaciones) {
            setIsFabricacionMode(true);
            setIsMultipleMode(false);
            
            // Load fabricaciones
            const fabricacionesData = await Promise.all(
              completeEntrada.fabricaciones.map(async (fabricacion) => {
                try {
                  const insumoProducto = await getProductoById(fabricacion.servicioTienda.servicio.id_servicio);
                  
                  // Calcular stock actual del insumo en la tienda
                  let stockActual = 0;
                  if (tienda) {
                    const tiendaServicio = insumoProducto.tiendas_servicio?.find(
                      ts => ts.id_tienda === tienda.id_tienda
                    );
                    stockActual = parseFloat(tiendaServicio?.cantidad || 0);
                  } else {
                    const firstTiendaServicio = insumoProducto.tiendas_servicio?.[0];
                    stockActual = parseFloat(firstTiendaServicio?.cantidad || 0);
                  }

                  return {
                    id: fabricacion.id_fabricacion,
                    producto: insumoProducto,
                    cantidad_insumo: fabricacion.cantidad_insumo.toString(),
                    costo_insumo_cup: fabricacion.costo_insumo_cup.toString(),
                    costo_insumo_usd: fabricacion.costo_insumo_usd.toString(),
                    productoSearchText: insumoProducto.nombre,
                    showProductoDropdown: false,
                    stock_actual: stockActual,
                  };
                } catch (err) {
                  console.error('[fetchCompleteEntrada] Error loading fabricacion:', err);
                  return null;
                }
              })
            );
            
            setFabricaciones(fabricacionesData.filter(f => f !== null));
          }
          
          setFormData({
            id_servicio_tienda: completeEntrada.id_servicio_tienda,
            cantidad_entrada: completeEntrada.cantidad_entrada.toString(),
            costo_usd: completeEntrada.costo_usd.toString(),
            costo_cup: completeEntrada.costo_cup.toString(),
            precio_usd: precioUsd,
            precio_cup: precioCup,
            fecha_vencimiento: completeEntrada.fecha_vencimiento ? formatDateToLocal(completeEntrada.fecha_vencimiento) : '',
            nombre_proveedor: completeEntrada.nombre_proveedor || '',
            fecha: completeEntrada.fecha ? formatDateToLocal(completeEntrada.fecha) : formatDateToLocal(new Date().toISOString()),
            producto: productoCompleto,
            tienda: tienda,
          });
          
          setProductoSearchText((completeEntrada.servicioTienda?.servicio?.nombre || '').trimEnd());
        } catch (err) {
          console.error('[fetchCompleteEntrada] Error:', err);
          console.error('[fetchCompleteEntrada] Error message:', err.message);
          // showToast({ type: 'error', message: 'Error al cargar datos de la entrada' });
        } finally {
          setIsFetchingEntrada(false);
        }
      }
    };

    fetchCompleteEntrada();
  }, [entrada?.id_entrada, isOfflineMode]);

  useEffect(() => {
    if (productoPreSeleccionado && isAddMode) {
      let costoCup = '';
      let costoUsd = '';

      // Auto-fill costs from the product (cost is unique across all stores)
      if (formData.tienda) {
        const tiendaServicio = productoPreSeleccionado.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );
        costoCup = tiendaServicio?.costo_cup?.toString() || '';
        costoUsd = tiendaServicio?.costo_usd?.toString() || '';
      }

      // If no tienda selected or no specific tienda cost, use first tienda's cost
      if (!costoCup && !costoUsd) {
        const firstTiendaServicio = productoPreSeleccionado.tiendas_servicio?.[0];
        costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
        costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
      }

      setFormData(prev => ({
        ...prev,
        producto: productoPreSeleccionado,
        costo_cup: costoCup,
        costo_usd: costoUsd,
      }));

      setProductoSearchText((productoPreSeleccionado.nombre || '').trimEnd());
    }
  }, [productoPreSeleccionado, isAddMode, formData.tienda]);

  // Preload tienda when coming from SalesScreen
  useEffect(() => {
    if (tiendaPreSeleccionada && isAddMode && !formData.tienda) {
      setFormData(prev => ({
        ...prev,
        tienda: tiendaPreSeleccionada,
      }));
    }
  }, [tiendaPreSeleccionada, isAddMode]);

  // Efecto para restaurar datos cuando regresa de ProductoFormScreen
  useEffect(() => {
    if (entradaData && isAddMode) {
      const restoreProducto = async () => {
        try {
          const productoActualizado = await getProductoById(entradaData.producto.id_servicio);
          
          // Buscar la tienda que se agregó en ProductoFormScreen
          const tiendaRelacion = productoActualizado.tiendas_servicio?.find(
            ts => ts.id_tienda === entradaData.tienda?.id_tienda
          );

          if (tiendaRelacion) {
            setFormData(prev => ({
              ...prev,
              producto: productoActualizado,
              tienda: entradaData.tienda,
              id_servicio_tienda: tiendaRelacion.id_servicio_tienda,
              costo_cup: tiendaRelacion.costo_cup?.toString() || '',
              costo_usd: tiendaRelacion.costo_usd?.toString() || '',
            }));
            
            setProductoSearchText((productoActualizado.nombre || '').trimEnd());
            
            showToast({ 
              type: 'success', 
              message: 'Relación producto-tienda creada correctamente. Ahora puedes crear la entrada.' 
            });
          }
        } catch (err) {
          console.error('[restoreProducto] Error:', err);
          console.error('[restoreProducto] Error message:', err.message);
          // showToast({ type: 'error', message: 'Error al cargar producto actualizado' });
        }
      };

      restoreProducto();
    }
  }, [entradaData, isAddMode]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        setTiendas([]);
        return;
      }
      
      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        canViewAllEntradasParam !== undefined ? canViewAllEntradasParam :
        (userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores'));
      
      const data = await getTiendas({}, 1, 1000);
      let allTiendas = data.data?.filter(t => t.activo === true) || [];
      
      if (user?.id_tienda && !canViewAllEntradas) {
        const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
        setTiendas(userTienda ? [userTienda] : []);
      } else {
        setTiendas(allTiendas);
      }
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const searchProductos = async (searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
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

  const fetchConfig = async () => {
    try {
      if (isOfflineMode) {
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

  const hasAutoApplySuggestedCost = () => {
    const userRole = user?.rol?.toLowerCase();
    if (isAdmin) return false; // Admins always see the modal
    return config.autoApplySuggestedCost?.[userRole] === true;
  };

  const calcularCostoPromedioPonderado = async (producto, tienda, nuevaCantidad, nuevoCostoCup, nuevoCostoUsd) => {
    try {
      // Obtener todas las entradas anteriores del producto en esta tienda
      const servicioTienda = producto.tiendas_servicio?.find(ts => ts.id_tienda === tienda.id_tienda);
      
      if (!servicioTienda) {
        return { costo_cup: nuevoCostoCup, costo_usd: nuevoCostoUsd };
      }

      const entradas = await getEntradas({ 
        id_servicio_tienda: servicioTienda.id_servicio_tienda 
      }, 1, 1000);
      
      const cantidadActual = parseFloat(servicioTienda.cantidad) || 0;
      const costoActualCup = parseFloat(servicioTienda.costo_cup) || 0;
      const costoActualUsd = parseFloat(servicioTienda.costo_usd) || 0;
      const nuevaCantidadNum = parseFloat(nuevaCantidad);

      // Calcular costo promedio ponderado
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

  const handleSave = async () => {
    setIsSaving(true);
    
    // Validaciones para modo múltiple
    if (isMultipleMode) {
      // Filter out empty entries (without product selected)
      const validEntradas = multipleEntradas.filter(e => e.producto !== null);
      
      if (validEntradas.length === 0) {
        showToast({ type: 'warning', message: 'Debe agregar al menos un producto' });
        setIsSaving(false);
        return;
      }
      
      // Validar cada entrada válida
      for (let i = 0; i < validEntradas.length; i++) {
        const entrada = validEntradas[i];
        if (!entrada.cantidad_entrada || parseFloat(entrada.cantidad_entrada) <= 0) {
          showToast({ type: 'warning', message: `La cantidad del producto ${i + 1} debe ser mayor que 0` });
          setIsSaving(false);
          return;
        }
        if (entrada.costo_usd !== '' && parseFloat(entrada.costo_usd) < 0) {
          showToast({ type: 'warning', message: `El costo USD del producto ${i + 1} debe ser mayor o igual a 0` });
          setIsSaving(false);
          return;
        }
        if (entrada.costo_cup !== '' && parseFloat(entrada.costo_cup) < 0) {
          showToast({ type: 'warning', message: `El costo CUP del producto ${i + 1} debe ser mayor o igual a 0` });
          setIsSaving(false);
          return;
        }
        
        // Validar relación producto-tienda
        const productoTienda = entrada.producto?.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda?.id_tienda
        );
        
        if (!productoTienda) {
          if (!entrada.precio_cup || entrada.precio_cup === '') {
            showToast({ type: 'warning', message: `Debe ingresar el precio CUP del producto ${i + 1} para esta tienda` });
            setIsSaving(false);
            return;
          }
          if (!entrada.precio_usd || entrada.precio_usd === '') {
            showToast({ type: 'warning', message: `Debe ingresar el precio USD del producto ${i + 1} para esta tienda` });
            setIsSaving(false);
            return;
          }
        }
        
        // Validar fecha de vencimiento
        if (entrada.producto.producto?.isVencible && !entrada.fecha_vencimiento) {
          showToast({ type: 'warning', message: `El producto ${i + 1} requiere fecha de vencimiento` });
          setIsSaving(false);
          return;
        }
      }
      
      checkAndShowCostSuggestionMultiple();
      setIsSaving(false);
      return;
    }
    
    // Validaciones para modo fabricación
    if (isFabricacionMode) {
      // Validar producto final
      if (!formData.producto) {
        showToast({ type: 'warning', message: 'Debe seleccionar el producto final' });
        setIsSaving(false);
        return;
      }
      if (!formData.tienda) {
        showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
        setIsSaving(false);
        return;
      }
      if (!formData.cantidad_entrada || parseFloat(formData.cantidad_entrada) <= 0) {
        showToast({ type: 'warning', message: 'La cantidad producida debe ser mayor que 0' });
        setIsSaving(false);
        return;
      }
      if (formData.costo_usd !== '' && parseFloat(formData.costo_usd) < 0) {
        showToast({ type: 'warning', message: 'El costo USD debe ser mayor o igual a 0' });
        setIsSaving(false);
        return;
      }
      if (formData.costo_cup !== '' && parseFloat(formData.costo_cup) < 0) {
        showToast({ type: 'warning', message: 'El costo CUP debe ser mayor o igual a 0' });
        setIsSaving(false);
        return;
      }
      
      // Validar fecha de vencimiento si el producto es vencible
      if (formData.producto.producto?.isVencible && !formData.fecha_vencimiento) {
        showToast({ type: 'warning', message: 'El producto final requiere fecha de vencimiento' });
        setIsSaving(false);
        return;
      }
      
      // Validar insumos
      const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
      
      if (validFabricaciones.length === 0) {
        showToast({ type: 'warning', message: 'Debe agregar al menos un insumo' });
        setIsSaving(false);
        return;
      }
      
      // Validar cada insumo
      for (let i = 0; i < validFabricaciones.length; i++) {
        const fabricacion = validFabricaciones[i];
        if (!fabricacion.cantidad_insumo || parseFloat(fabricacion.cantidad_insumo) <= 0) {
          showToast({ type: 'warning', message: `La cantidad del insumo ${i + 1} debe ser mayor que 0` });
          setIsSaving(false);
          return;
        }
        if (fabricacion.costo_insumo_usd !== '' && parseFloat(fabricacion.costo_insumo_usd) < 0) {
          showToast({ type: 'warning', message: `El costo USD del insumo ${i + 1} debe ser mayor o igual a 0` });
          setIsSaving(false);
          return;
        }
        if (fabricacion.costo_insumo_cup !== '' && parseFloat(fabricacion.costo_insumo_cup) < 0) {
          showToast({ type: 'warning', message: `El costo CUP del insumo ${i + 1} debe ser mayor o igual a 0` });
          setIsSaving(false);
          return;
        }
      }

      // Mostrar modal de costos de fabricación antes de guardar
      setShowFabricacionCostModal(true);
      setIsSaving(false);
      return;
    }
    
    // Validaciones para modo individual
    if (!formData.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto' });
      setIsSaving(false);
      return;
    }
    if (!formData.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
      setIsSaving(false);
      return;
    }
    if (!formData.cantidad_entrada || parseFloat(formData.cantidad_entrada) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que 0' });
      setIsSaving(false);
      return;
    }
    if (formData.costo_usd !== '' && parseFloat(formData.costo_usd) < 0) {
      showToast({ type: 'warning', message: 'El costo USD debe ser mayor o igual a 0' });
      setIsSaving(false);
      return;
    }
    if (formData.costo_cup !== '' && parseFloat(formData.costo_cup) < 0) {
      showToast({ type: 'warning', message: 'El costo CUP debe ser mayor o igual a 0' });
      setIsSaving(false);
      return;
    }

    // Validar si el producto tiene relación con la tienda
    const productoTienda = formData.producto?.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda?.id_tienda
    );

    // Si no existe relación, validar que se ingresen los precios
    if (!productoTienda && formData.producto && formData.tienda) {
      if (!formData.precio_cup || formData.precio_cup === '') {
        showToast({ type: 'warning', message: 'Debe ingresar el precio CUP del producto para esta tienda' });
        setIsSaving(false);
        return;
      }
      if (!formData.precio_usd || formData.precio_usd === '') {
        showToast({ type: 'warning', message: 'Debe ingresar el precio USD del producto para esta tienda' });
        setIsSaving(false);
        return;
      }
    }

    // Validar fecha de vencimiento si el producto es vencible
    if (formData.producto.producto?.isVencible && !formData.fecha_vencimiento) {
      showToast({ type: 'warning', message: 'El producto requiere fecha de vencimiento' });
      setIsSaving(false);
      return;
    }

    // Validar si la fecha de vencimiento es anterior o igual a la fecha de entrada
    if (formData.producto.producto?.isVencible && formData.fecha_vencimiento) {
      const fechaVencimiento = new Date(formData.fecha_vencimiento);
      const fechaEntrada = new Date(formData.fecha);
      
      if (fechaVencimiento <= fechaEntrada) {
        Alert.alert(
          'Advertencia: Fecha de vencimiento',
          'La fecha de vencimiento es anterior o igual a la fecha de entrada. Esto puede ocasionar que el producto esté vencido al momento de ingresarlo al inventario. ¿Está seguro que desea continuar con la entrada?',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Continuar',
              style: 'destructive',
              onPress: () => checkAndShowCostSuggestion()
            }
          ]
        );
        return;
      }
    }

    checkAndShowCostSuggestion();
  };

  const checkAndShowCostSuggestion = async () => {
    // Si la fórmula de costo promedio ponderado está activa y estamos en modo add
    if (config.applyWeightedAverageCost && isAddMode && !isEditMode) {
      // Solo calcular la fórmula si es admin o tiene permiso de auto-aplicar
      if (isAdmin || hasAutoApplySuggestedCost()) {
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
          
          // Verificar si hay diferencia significativa entre costos actuales y sugeridos
          const diffCup = Math.abs(nuevosCostos.costo_cup - costoCup);
          const diffUsd = Math.abs(nuevosCostos.costo_usd - costoUsd);
          const threshold = 0.01; // Umbral de diferencia mínima
          
          // Si no hay diferencia significativa, guardar directamente sin mostrar modal
          if (diffCup < threshold && diffUsd < threshold) {
            executeSave();
            return;
          }
          
          // Si el usuario tiene permiso de auto-aplicar costo sugerido (y no es admin)
          if (hasAutoApplySuggestedCost()) {
            // Aplicar automáticamente el costo sugerido sin mostrar modal
            // Actualizar el formData con los costos sugeridos
            setFormData(prev => ({
              ...prev,
              costo_cup: nuevosCostos.costo_cup,
              costo_usd: nuevosCostos.costo_usd,
            }));
            
            // Actualizar el costo del producto en todas las tiendas
            try {
              const productoActualizado = await getProductoById(formData.producto.id_servicio);
              
              const productoTiendaList = (productoActualizado.tiendas_servicio || []).map(ts => ({
                id_tienda: ts.id_tienda,
                precio_cup: ts.precio_cup,
                precio_usd: ts.precio_usd,
                costo_cup: nuevosCostos.costo_cup,
                costo_usd: nuevosCostos.costo_usd,
                cantidad_alerta: ts.cantidad_alerta,
              }));
              
              await updateProducto(formData.producto.id_servicio, {
                productoTiendaList: productoTiendaList,
              });
            } catch (err) {
              console.error('[checkAndShowCostSuggestion] Error al actualizar costo del producto:', err);
              // Continuar con el guardado de la entrada incluso si falla la actualización del producto
            }
            
            executeSave();
            return;
          }
          
          // Para administradores: mostrar el modal para que elija
          // Guardar costos actuales del formulario
          setCurrentCosts({
            costo_cup: costoCup,
            costo_usd: costoUsd,
          });
          
          // Guardar costos sugeridos por la fórmula
          setSuggestedCosts({
            costo_cup: nuevosCostos.costo_cup,
            costo_usd: nuevosCostos.costo_usd,
          });
          
          // Mostrar el modal solo para administradores
          setShowCostSuggestionModal(true);
        } catch (error) {
          // Si hay error al calcular, continuar con el guardado normal
          executeSave();
        }
      } else {
        // Si no es admin y no tiene permiso de auto-aplicar, guardar directamente con el costo ingresado
        // sin aplicar la fórmula
        executeSave();
      }
    } else {
      // Si la fórmula no está activa o estamos en modo edición, guardar directamente
      executeSave();
    }
  };

  const handleKeepCurrentCosts = () => {
    // Cerrar el modal y guardar con los costos actuales del formulario
    setShowCostSuggestionModal(false);
    executeSave();
  };

  const handleUseSuggestedCosts = async () => {
    // Actualizar el formData con los costos sugeridos y cerrar el modal
    setFormData(prev => ({
      ...prev,
      costo_cup: suggestedCosts.costo_cup,
      costo_usd: suggestedCosts.costo_usd,
    }));
    setShowCostSuggestionModal(false);

    // Si es Administrador y la fórmula de costo promedio ponderado está activa,
    // actualizar el costo del producto en todas las tiendas
    if (isAdmin && config.applyWeightedAverageCost) {
      try {
        const productoActualizado = await getProductoById(formData.producto.id_servicio);
        
        // Actualizar el costo en todas las tiendas_servicio del producto
        const productoTiendaList = (productoActualizado.tiendas_servicio || []).map(ts => ({
          id_tienda: ts.id_tienda,
          precio_cup: ts.precio_cup,
          precio_usd: ts.precio_usd,
          costo_cup: suggestedCosts.costo_cup,
          costo_usd: suggestedCosts.costo_usd,
          cantidad_alerta: ts.cantidad_alerta,
        }));
        
        await updateProducto(formData.producto.id_servicio, {
          productoTiendaList: productoTiendaList,
        });
      } catch (err) {
        console.error('[handleUseSuggestedCosts] Error al actualizar costo del producto:', err);
        // Continuar con el guardado de la entrada incluso si falla la actualización del producto
      }
    }

    executeSave();
  };

  const checkAndShowCostSuggestionMultiple = async () => {
    // Si la fórmula de costo promedio ponderado está activa y estamos en modo add
    if (config.applyWeightedAverageCost && isAddMode && !isEditMode) {
      // Solo calcular la fórmula si es admin o tiene permiso de auto-aplicar
      if (isAdmin || hasAutoApplySuggestedCost()) {
        try {
          const validEntradas = multipleEntradas.filter(e => e.producto !== null);
          
          const currentCostsArray = [];
          const suggestedCostsArray = [];
          const threshold = 0.01; // Umbral de diferencia mínima
          let hasSignificantDifference = false;
          
          for (const entrada of validEntradas) {
            const costoCup = parseFloat(entrada.costo_cup) || 0;
            const costoUsd = parseFloat(entrada.costo_usd) || 0;
            
            const nuevosCostos = await calcularCostoPromedioPonderado(
              entrada.producto,
              formData.tienda,
              entrada.cantidad_entrada,
              costoCup,
              costoUsd
            );
            
            // Verificar si hay diferencia significativa
            const diffCup = Math.abs(nuevosCostos.costo_cup - costoCup);
            const diffUsd = Math.abs(nuevosCostos.costo_usd - costoUsd);
            
            if (diffCup >= threshold || diffUsd >= threshold) {
              hasSignificantDifference = true;
            }
            
            currentCostsArray.push({ 
              id: entrada.id, 
              productoNombre: entrada.producto.nombre, 
              costo_cup: costoCup, 
              costo_usd: costoUsd 
            });
            suggestedCostsArray.push({ 
              id: entrada.id, 
              productoNombre: entrada.producto.nombre, 
              costo_cup: nuevosCostos.costo_cup, 
              costo_usd: nuevosCostos.costo_usd 
            });
          }
          
          // Si no hay diferencia significativa en ningún producto, guardar directamente
          if (!hasSignificantDifference) {
            executeSaveMultiple();
            return;
          }
          
          // Si el usuario tiene permiso de auto-aplicar costo sugerido (y no es admin)
          if (hasAutoApplySuggestedCost()) {
            // Aplicar automáticamente los costos sugeridos sin mostrar modal
            setMultipleEntradas(prev => prev.map(entrada => {
              const suggestedCost = suggestedCostsArray.find(sc => sc.id === entrada.id);
              if (suggestedCost) {
                return {
                  ...entrada,
                  costo_cup: suggestedCost.costo_cup,
                  costo_usd: suggestedCost.costo_usd,
                };
              }
              return entrada;
            }));
            
            // Actualizar el costo de cada producto en todas las tiendas
            try {
              const productosUnicos = new Map();
              validEntradas.forEach(entrada => {
                if (!productosUnicos.has(entrada.producto.id_servicio)) {
                  const suggestedCost = suggestedCostsArray.find(sc => sc.id === entrada.id);
                  if (suggestedCost) {
                    productosUnicos.set(entrada.producto.id_servicio, suggestedCost);
                  }
                }
              });

              for (const [productoId, suggestedCost] of productosUnicos) {
                try {
                  const productoActualizado = await getProductoById(productoId);
                  
                  const productoTiendaList = (productoActualizado.tiendas_servicio || []).map(ts => ({
                    id_tienda: ts.id_tienda,
                    precio_cup: ts.precio_cup,
                    precio_usd: ts.precio_usd,
                    costo_cup: suggestedCost.costo_cup,
                    costo_usd: suggestedCost.costo_usd,
                    cantidad_alerta: ts.cantidad_alerta,
                  }));
                  
                  await updateProducto(productoId, {
                    productoTiendaList: productoTiendaList,
                  });
                } catch (err) {
                  console.error(`[checkAndShowCostSuggestionMultiple] Error al actualizar costo del producto ${productoId}:`, err);
                }
              }
            } catch (err) {
              console.error('[checkAndShowCostSuggestionMultiple] Error al actualizar costos de productos:', err);
            }
            
            executeSaveMultiple();
            return;
          }
          
          // Para administradores: mostrar el modal para que elija
          setMultipleCurrentCosts(currentCostsArray);
          setMultipleSuggestedCosts(suggestedCostsArray);
          setIsMultipleCostSuggestion(true);
          
          // Mostrar el modal solo para administradores
          setShowCostSuggestionModal(true);
        } catch (error) {
          executeSaveMultiple();
        }
      } else {
        // Si no es admin y no tiene permiso de auto-aplicar, guardar directamente con los costos ingresados
        // sin aplicar la fórmula
        executeSaveMultiple();
      }
    } else {
      executeSaveMultiple();
    }
  };

  const handleKeepCurrentCostsMultiple = () => {
    setShowCostSuggestionModal(false);
    setIsMultipleCostSuggestion(false);
    executeSaveMultiple();
  };

  const handleUseSuggestedCostsMultiple = async () => {
    // Actualizar multipleEntradas con los costos sugeridos
    setMultipleEntradas(prev => prev.map(entrada => {
      const suggestedCost = multipleSuggestedCosts.find(sc => sc.id === entrada.id);
      if (suggestedCost) {
        return {
          ...entrada,
          costo_cup: suggestedCost.costo_cup,
          costo_usd: suggestedCost.costo_usd,
        };
      }
      return entrada;
    }));
    
    setShowCostSuggestionModal(false);
    setIsMultipleCostSuggestion(false);

    // Si es Administrador y la fórmula de costo promedio ponderado está activa,
    // actualizar el costo de cada producto en todas las tiendas
    if (isAdmin && config.applyWeightedAverageCost) {
      try {
        const validEntradas = multipleEntradas.filter(e => e.producto !== null);
        
        // Procesar cada producto único (evitar duplicados)
        const productosUnicos = new Map();
        validEntradas.forEach(entrada => {
          if (!productosUnicos.has(entrada.producto.id_servicio)) {
            const suggestedCost = multipleSuggestedCosts.find(sc => sc.id === entrada.id);
            if (suggestedCost) {
              productosUnicos.set(entrada.producto.id_servicio, suggestedCost);
            }
          }
        });

        // Actualizar cada producto
        for (const [productoId, suggestedCost] of productosUnicos) {
          try {
            const productoActualizado = await getProductoById(productoId);
            
            // Actualizar el costo en todas las tiendas_servicio del producto
            const productoTiendaList = (productoActualizado.tiendas_servicio || []).map(ts => ({
              id_tienda: ts.id_tienda,
              precio_cup: ts.precio_cup,
              precio_usd: ts.precio_usd,
              costo_cup: suggestedCost.costo_cup,
              costo_usd: suggestedCost.costo_usd,
              cantidad_alerta: ts.cantidad_alerta,
            }));
            
            await updateProducto(productoId, {
              productoTiendaList: productoTiendaList,
            });
          } catch (err) {
            console.error(`[handleUseSuggestedCostsMultiple] Error al actualizar costo del producto ${productoId}:`, err);
            // Continuar con otros productos incluso si falla uno
          }
        }
      } catch (err) {
        console.error('[handleUseSuggestedCostsMultiple] Error al actualizar costos de productos:', err);
        // Continuar con el guardado de las entradas incluso si falla la actualización de productos
      }
    }

    executeSaveMultiple();
  };

  const executeSave = async () => {
    // Helper function to safely convert to number with 5 decimal places
    const toFixed5 = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
    };

    try {
      setIsSaving(true);

      // Verificar si el producto existe en la tienda seleccionada
      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );

      let id_servicio_tienda = productoTienda?.id_servicio_tienda;

      // Si el producto no existe en la tienda, primero actualizar el producto
      if (!productoTienda) {
        const productoActualizado = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTienda = {
          id_tienda: formData.tienda.id_tienda,
          precio_cup: toFixed5(formData.precio_cup || 0),
          precio_usd: toFixed5(formData.precio_usd || 0),
          costo_cup: toFixed5(formData.costo_cup),
          costo_usd: toFixed5(formData.costo_usd),
        };

        const productoTiendaList = [
          ...(productoActualizado.tiendas_servicio || []).map(ts => ({
            id_tienda: ts.id_tienda,
            precio_cup: ts.precio_cup,
            precio_usd: ts.precio_usd,
            costo_cup: ts.costo_cup,
            costo_usd: ts.costo_usd,
            cantidad_alerta: ts.cantidad_alerta,
          })),
          nuevoProductoTienda
        ];
        
        await updateProducto(formData.producto.id_servicio, {
          productoTiendaList: productoTiendaList,
        });

        // Obtener el producto actualizado para obtener el nuevo id_servicio_tienda
        const productoActualizado2 = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTiendaCreado = productoActualizado2.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );
        id_servicio_tienda = nuevoProductoTiendaCreado?.id_servicio_tienda;

        if (!id_servicio_tienda) {
          throw new Error('Error al crear relación producto-tienda');
        }
      }

      // Calcular costo promedio ponderado si está activado y el usuario tiene permisos
      let costo_cup = toFixed5(formData.costo_cup);
      let costo_usd = toFixed5(formData.costo_usd);

      // Solo calcular si es admin o tiene permiso de auto-aplicar
      if (config.applyWeightedAverageCost && !isEditMode && (isAdmin || hasAutoApplySuggestedCost())) {
        const nuevosCostos = await calcularCostoPromedioPonderado(
          formData.producto,
          formData.tienda,
          formData.cantidad_entrada,
          costo_cup,
          costo_usd
        );
        costo_cup = nuevosCostos.costo_cup;
        costo_usd = nuevosCostos.costo_usd;
      }

      const entradaData = {
        id_servicio_tienda,
        cantidad_entrada: parseFloat(formData.cantidad_entrada),
        costo_usd: toFixed5(costo_usd),
        costo_cup: toFixed5(costo_cup),
        fecha_vencimiento: formData.fecha_vencimiento || null,
        nombre_proveedor: formData.nombre_proveedor || null,
        fecha: formData.fecha,
        id_usuario: user.id_usuario,
      };

      if (isEditMode) {
        await updateEntrada(entrada.id_entrada, entradaData);
        showToast({ type: 'success', message: 'Entrada actualizada correctamente' });
      } else {
        await createEntrada(entradaData);
        showToast({ type: 'success', message: 'Entrada creada correctamente' });
        
        // Check if auto-withdraw is enabled and ask user
        if (config.autoWithdrawOnEntry && isAddMode && !isEditMode) {
          const tiendaId = formData.tienda.id_tienda;
          const productoNombre = formData.producto.nombre;
          const cantidad = formData.cantidad_entrada;
          const costoCup = parseFloat(formData.costo_cup) || 0;
          const costoUsd = parseFloat(formData.costo_usd) || 0;
          
          // Calculate total cost
          const totalCostCup = cantidad * costoCup;
          const totalCostUsd = cantidad * costoUsd;
          
          try {
            // Fetch accounts related to the tienda
            const cuentasResponse = await getCuentas({ id_tienda: tiendaId });
            const cuentas = cuentasResponse.data || [];
            
            if (cuentas.length > 0) {
              // Show modal instead of alert
              setWithdrawModalData({
                tiendaId,
                cuentas,
                defaultMotivo: `compra de ${cantidad} unidades de ${productoNombre}`,
                defaultTipo: 'Retiro',
                defaultCantidadCup: totalCostCup,
                defaultCantidadUsd: totalCostUsd
              });
              setShowWithdrawModal(true);
              return; // Don't navigate yet, wait for user response
            }
          } catch (error) {
            console.error('[executeSave] Error fetching cuentas:', error);
            // Continue with normal navigation if error fetching cuentas
          }
        }
      }
      
      // If coming from modal, navigate to ProductosScreen instead of going back
      if (fromModal) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Productos' }],
        });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('[executeSave] Error:', err);
      // showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const executeSaveMultiple = async () => {
    const toFixed5 = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
    };

    try {
      setIsSaving(true);

      const entradasToCreate = [];

      // Filter out empty entries (without product selected) and process only valid entries
      const validEntradas = multipleEntradas.filter(e => e.producto !== null);

      // Procesar cada entrada válida
      for (const entrada of validEntradas) {
        // Verificar si el producto existe en la tienda
        const productoTienda = entrada.producto?.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda?.id_tienda
        );

        let id_servicio_tienda = productoTienda?.id_servicio_tienda;

        // Si no existe relación, crearla
        if (!productoTienda) {
          const productoActualizado = await getProductoById(entrada.producto.id_servicio);
          const nuevoProductoTienda = {
            id_tienda: formData.tienda.id_tienda,
            precio_cup: toFixed5(entrada.precio_cup || 0),
            precio_usd: toFixed5(entrada.precio_usd || 0),
            costo_cup: toFixed5(entrada.costo_cup),
            costo_usd: toFixed5(entrada.costo_usd),
          };

          const productoTiendaList = [
            ...(productoActualizado.tiendas_servicio || []).map(ts => ({
              id_tienda: ts.id_tienda,
              precio_cup: ts.precio_cup,
              precio_usd: ts.precio_usd,
              costo_cup: ts.costo_cup,
              costo_usd: ts.costo_usd,
              cantidad_alerta: ts.cantidad_alerta,
            })),
            nuevoProductoTienda
          ];
          
          await updateProducto(entrada.producto.id_servicio, {
            productoTiendaList: productoTiendaList,
          });

          const productoActualizado2 = await getProductoById(entrada.producto.id_servicio);
          const nuevoProductoTiendaCreado = productoActualizado2.tiendas_servicio?.find(
            ts => ts.id_tienda === formData.tienda.id_tienda
          );
          id_servicio_tienda = nuevoProductoTiendaCreado?.id_servicio_tienda;

          if (!id_servicio_tienda) {
            throw new Error('Error al crear relación producto-tienda');
          }
        }

        // Calcular costo promedio ponderado si está activado y el usuario tiene permisos
        let costo_cup = toFixed5(entrada.costo_cup);
        let costo_usd = toFixed5(entrada.costo_usd);

        // Solo calcular si es admin o tiene permiso de auto-aplicar
        if (config.applyWeightedAverageCost && (isAdmin || hasAutoApplySuggestedCost())) {
          const nuevosCostos = await calcularCostoPromedioPonderado(
            entrada.producto,
            formData.tienda,
            entrada.cantidad_entrada,
            costo_cup,
            costo_usd
          );
          costo_cup = nuevosCostos.costo_cup;
          costo_usd = nuevosCostos.costo_usd;
        }

        entradasToCreate.push({
          id_servicio_tienda,
          cantidad_entrada: parseFloat(entrada.cantidad_entrada),
          costo_usd: toFixed5(costo_usd),
          costo_cup: toFixed5(costo_cup),
          fecha_vencimiento: entrada.fecha_vencimiento || null,
          nombre_proveedor: formData.nombre_proveedor || null,
          fecha: formData.fecha,
          id_usuario: user.id_usuario,
        });
      }

      // Crear todas las entradas en bulk
      await createEntradasBulk(entradasToCreate);
      showToast({ type: 'success', message: `${entradasToCreate.length} entradas creadas correctamente` });
      
      // If coming from modal, navigate to ProductosScreen instead of going back
      if (fromModal) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Productos' }],
        });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('[executeSaveMultiple] Error:', err);
      showToast({ type: 'error', message: err.message || 'Error al crear entradas múltiples' });
    } finally {
      setIsSaving(false);
    }
  };

  const executeSaveFabricacion = async () => {
    // Helper function to safely convert to number with 5 decimal places
    const toFixed5 = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
    };

    try {
      setIsSaving(true);

      // Verificar si el producto final existe en la tienda seleccionada
      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );

      let id_servicio_tienda = productoTienda?.id_servicio_tienda;

      // Si el producto no existe en la tienda, primero actualizar el producto
      if (!productoTienda) {
        const productoActualizado = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTienda = {
          id_tienda: formData.tienda.id_tienda,
          precio_cup: toFixed5(formData.precio_cup || 0),
          precio_usd: toFixed5(formData.precio_usd || 0),
          costo_cup: toFixed5(formData.costo_cup),
          costo_usd: toFixed5(formData.costo_usd),
        };

        const productoTiendaList = [
          ...(productoActualizado.tiendas_servicio || []).map(ts => ({
            id_tienda: ts.id_tienda,
            precio_cup: ts.precio_cup,
            precio_usd: ts.precio_usd,
            costo_cup: ts.costo_cup,
            costo_usd: ts.costo_usd,
            cantidad_alerta: ts.cantidad_alerta,
          })),
          nuevoProductoTienda
        ];
        
        await updateProducto(formData.producto.id_servicio, {
          productoTiendaList: productoTiendaList,
        });

        // Obtener el producto actualizado para obtener el nuevo id_servicio_tienda
        const productoActualizado2 = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTiendaCreado = productoActualizado2.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );
        id_servicio_tienda = nuevoProductoTiendaCreado?.id_servicio_tienda;

        if (!id_servicio_tienda) {
          throw new Error('Error al crear relación producto-tienda');
        }
      }

      // Preparar datos de la entrada
      const entradaData = {
        id_servicio_tienda,
        cantidad_entrada: parseFloat(formData.cantidad_entrada),
        costo_usd: toFixed5(formData.costo_usd),
        costo_cup: toFixed5(formData.costo_cup),
        fecha_vencimiento: formData.fecha_vencimiento || null,
        nombre_proveedor: formData.nombre_proveedor || null,
        fecha: formData.fecha,
        id_usuario: user.id_usuario,
      };

      // Preparar datos de las fabricaciones (insumos)
      const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
      const fabricacionesData = [];

      // Calcular costo total de los insumos
      let costoTotalInsumosCup = 0;
      let costoTotalInsumosUsd = 0;

      for (const fabricacion of validFabricaciones) {
        // Verificar si el insumo existe en la tienda
        const insumoTienda = fabricacion.producto?.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );

        let id_servicio_tienda_insumo = insumoTienda?.id_servicio_tienda;

        // Si no existe relación, crearla
        if (!insumoTienda) {
          const productoActualizado = await getProductoById(fabricacion.producto.id_servicio);
          const nuevoProductoTienda = {
            id_tienda: formData.tienda.id_tienda,
            precio_cup: toFixed5(0),
            precio_usd: toFixed5(0),
            costo_cup: toFixed5(fabricacion.costo_insumo_cup),
            costo_usd: toFixed5(fabricacion.costo_insumo_usd),
          };

          const productoTiendaList = [
            ...(productoActualizado.tiendas_servicio || []).map(ts => ({
              id_tienda: ts.id_tienda,
              precio_cup: ts.precio_cup,
              precio_usd: ts.precio_usd,
              costo_cup: ts.costo_cup,
              costo_usd: ts.costo_usd,
              cantidad_alerta: ts.cantidad_alerta,
            })),
            nuevoProductoTienda
          ];
          
          await updateProducto(fabricacion.producto.id_servicio, {
            productoTiendaList: productoTiendaList,
          });

          const productoActualizado2 = await getProductoById(fabricacion.producto.id_servicio);
          const nuevoProductoTiendaCreado = productoActualizado2.tiendas_servicio?.find(
            ts => ts.id_tienda === formData.tienda.id_tienda
          );
          id_servicio_tienda_insumo = nuevoProductoTiendaCreado?.id_servicio_tienda;

          if (!id_servicio_tienda_insumo) {
            throw new Error('Error al crear relación producto-tienda para insumo');
          }
        }

        fabricacionesData.push({
          id_servicio_tienda: id_servicio_tienda_insumo,
          cantidad_insumo: parseFloat(fabricacion.cantidad_insumo),
          costo_insumo_cup: toFixed5(fabricacion.costo_insumo_cup),
          costo_insumo_usd: toFixed5(fabricacion.costo_insumo_usd),
        });

        // Acumular costo total de insumos
        costoTotalInsumosCup += parseFloat(fabricacion.cantidad_insumo) * parseFloat(fabricacion.costo_insumo_cup);
        costoTotalInsumosUsd += parseFloat(fabricacion.cantidad_insumo) * parseFloat(fabricacion.costo_insumo_usd);
      }

      // Calcular costo por unidad del producto final basado en los insumos
      const cantidadProducida = parseFloat(formData.cantidad_entrada) || 1;
      const costoPorUnidadCupSumatoria = cantidadProducida > 0 ? costoTotalInsumosCup / cantidadProducida : 0;
      const costoPorUnidadUsdSumatoria = cantidadProducida > 0 ? costoTotalInsumosUsd / cantidadProducida : 0;

      let costoPorUnidadCup = costoPorUnidadCupSumatoria;
      let costoPorUnidadUsd = costoPorUnidadUsdSumatoria;

      // Determinar el costo según la opción seleccionada
      if (fabricacionCostOption === 'actual') {
        // Usar el costo actual del producto en la tienda
        const productoTiendaCosto = formData.producto.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );
        costoPorUnidadCup = productoTiendaCosto?.costo_cup || 0;
        costoPorUnidadUsd = productoTiendaCosto?.costo_usd || 0;
      } else if (fabricacionCostOption === 'manual') {
        // Usar los costos manuales ingresados
        costoPorUnidadCup = parseFloat(fabricacionManualCostCup) || 0;
        costoPorUnidadUsd = parseFloat(fabricacionManualCostUsd) || 0;
      } else if (fabricacionCostOption === 'formula' && config.applyWeightedAverageCost) {
        // Aplicar fórmula de costo promedio ponderado
        // Obtener todas las entradas del producto en esta tienda
        const entradasResponse = await getEntradas({
          id_servicio_tienda: id_servicio_tienda,
          skipCantidadMin: true
        }, 1, 10000);
        const entradas = entradasResponse.data || [];
        
        let totalCantidad = 0;
        let totalCostoCup = 0;
        let totalCostoUsd = 0;

        for (const entrada of entradas) {
          const cantidad = parseFloat(entrada.cantidad_entrada) || 0;
          const costoCup = parseFloat(entrada.costo_cup) || 0;
          const costoUsd = parseFloat(entrada.costo_usd) || 0;
          
          totalCantidad += cantidad;
          totalCostoCup += cantidad * costoCup;
          totalCostoUsd += cantidad * costoUsd;
        }

        // Incluir la nueva entrada en el cálculo
        totalCantidad += cantidadProducida;
        totalCostoCup += cantidadProducida * costoPorUnidadCupSumatoria;
        totalCostoUsd += cantidadProducida * costoPorUnidadUsdSumatoria;

        costoPorUnidadCup = totalCantidad > 0 ? totalCostoCup / totalCantidad : 0;
        costoPorUnidadUsd = totalCantidad > 0 ? totalCostoUsd / totalCantidad : 0;
      }
      // Si es 'sumatoria', ya tenemos los valores calculados

      // Actualizar entradaData con el costo seleccionado
      entradaData.costo_cup = toFixed5(costoPorUnidadCup);
      entradaData.costo_usd = toFixed5(costoPorUnidadUsd);

      // Crear entrada con fabricaciones
      await createEntradaConFabricacion(entradaData, fabricacionesData);
      showToast({ type: 'success', message: 'Entrada de fabricación creada correctamente' });

      // Si el usuario desea modificar el precio del producto en todo el sistema
      if (modifyProductPrice) {
        try {
          const productoActualizado = await getProductoById(formData.producto.id_servicio);
          const productoTiendaList = (productoActualizado.tiendas_servicio || []).map(ts => ({
            id_tienda: ts.id_tienda,
            precio_cup: ts.precio_cup,
            precio_usd: ts.precio_usd,
            costo_cup: toFixed5(costoPorUnidadCup),
            costo_usd: toFixed5(costoPorUnidadUsd),
            cantidad_alerta: ts.cantidad_alerta,
          }));

          await updateProducto(formData.producto.id_servicio, {
            productoTiendaList: productoTiendaList,
          });
          showToast({ type: 'success', message: 'Precio de costo del producto actualizado en todo el sistema' });
        } catch (error) {
          console.error('[executeSaveFabricacion] Error updating product cost:', error);
          showToast({ type: 'warning', message: 'Entrada creada pero no se pudo actualizar el precio del producto' });
        }
      }

      // Wait a moment to ensure backend completes the transaction
      await new Promise(resolve => setTimeout(resolve, 500));

      // If coming from modal, navigate to ProductosScreen instead of going back
      if (fromModal) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Productos', params: { refresh: true } }],
        });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('[executeSaveFabricacion] Error:', err);
      // Extract error message from nested error objects
      let errorMessage = 'Error al crear entrada de fabricación';
      if (err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err.toString) {
        errorMessage = err.toString();
      }

      // Clean up error message if it has [Error: ...] format
      if (errorMessage.startsWith('[Error: ') && errorMessage.endsWith(']')) {
        errorMessage = errorMessage.substring(8, errorMessage.length - 1);
      }

      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const getFabricacionFinancialInfo = () => {
    if (fabricaciones.length === 0) {
      return null;
    }

    let costoTotalCup = 0;
    let costoTotalUsd = 0;

    fabricaciones.forEach(fabricacion => {
      const cantidad = parseFloat(fabricacion.cantidad_insumo) || 0;
      const costoCup = parseFloat(fabricacion.costo_insumo_cup) || 0;
      const costoUsd = parseFloat(fabricacion.costo_insumo_usd) || 0;

      costoTotalCup += costoCup * cantidad;
      costoTotalUsd += costoUsd * cantidad;
    });

    // Get selling price of the final product
    let precioVentaCup = 0;
    let precioVentaUsd = 0;

    if (formData.producto && formData.tienda) {
      const servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      precioVentaCup = parseFloat(servicioTienda?.precio_cup) || 0;
      precioVentaUsd = parseFloat(servicioTienda?.precio_usd) || 0;
    }

    // Calculate total selling price of all units produced
    const cantidadProducida = parseFloat(formData.cantidad_entrada) || 0;
    const precioVentaTotalCup = precioVentaCup * cantidadProducida;
    const precioVentaTotalUsd = precioVentaUsd * cantidadProducida;

    // Calculate expected total profit (total selling price - total insumos cost)
    const gananciaCup = precioVentaTotalCup - costoTotalCup;
    const gananciaUsd = precioVentaTotalUsd - costoTotalUsd;

    // Calculate profit percentage based on total selling price
    const porcentajeGananciaCup = precioVentaTotalCup > 0 ? (gananciaCup / precioVentaTotalCup) * 100 : 0;
    const porcentajeGananciaUsd = precioVentaTotalUsd > 0 ? (gananciaUsd / precioVentaTotalUsd) * 100 : 0;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      precioCup: !isNaN(precioVentaCup) ? precioVentaCup : 0,
      precioUsd: !isNaN(precioVentaUsd) ? precioVentaUsd : 0,
      gananciaCup: !isNaN(gananciaCup) ? gananciaCup : 0,
      gananciaUsd: !isNaN(gananciaUsd) ? gananciaUsd : 0,
      porcentajeGananciaCup: !isNaN(porcentajeGananciaCup) ? porcentajeGananciaCup : 0,
      porcentajeGananciaUsd: !isNaN(porcentajeGananciaUsd) ? porcentajeGananciaUsd : 0
    };
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Use UTC methods to avoid timezone issues
      const year = selectedDate.getUTCFullYear();
      const month = String(selectedDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getUTCDate()).padStart(2, '0');
      // Append time to prevent UTC conversion issues in backend
      const formattedDate = `${year}-${month}-${day}T12:00:00`;
      setFormData(prev => ({ ...prev, fecha_vencimiento: formattedDate }));
    }
  };

  const handleFechaEntradaChange = (event, selectedDate) => {
    setShowFechaEntradaPicker(false);
    if (selectedDate) {
      // Use UTC methods to avoid timezone issues
      const year = selectedDate.getUTCFullYear();
      const month = String(selectedDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getUTCDate()).padStart(2, '0');
      // Append time to prevent UTC conversion issues
      const formattedDate = `${year}-${month}-${day}T12:00:00`;
      setFormData(prev => ({ ...prev, fecha: formattedDate }));
    }
  };

  const handleTiendaSelect = (tienda) => {
    // Reset manual modification flag when selecting a new tienda
    setHasManuallyModifiedCostos(false);
    
    // Verificar si el producto ya tiene una relación con esta tienda
    if (formData.producto) {
      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === tienda.id_tienda
      );

      if (productoTienda) {
        // Si existe relación, autorellenar los costos
        const costoCup = productoTienda.costo_cup?.toString() || '';
        const costoUsd = productoTienda.costo_usd?.toString() || '';
        
        setFormData(prev => ({
          ...prev,
          tienda,
          id_servicio_tienda: productoTienda.id_servicio_tienda,
          costo_cup: costoCup,
          costo_usd: costoUsd,
          precio_cup: '',
          precio_usd: '',
        }));
      } else {
        // Si no existe relación, autorellenar costos desde cualquier tienda (costo es único)
        const firstTiendaServicio = formData.producto.tiendas_servicio?.[0];
        const costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
        const costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
        
        setFormData(prev => ({
          ...prev,
          tienda,
          id_servicio_tienda: null,
          costo_cup: costoCup,
          costo_usd: costoUsd,
          precio_cup: '',
          precio_usd: '',
        }));
      }
    } else {
      // Si no hay producto seleccionado, solo actualizar la tienda
      setFormData(prev => ({ ...prev, tienda }));
    }

    setShowTiendaDropdown(false);
    setTiendaSearchText('');
  };


  const handleCostoChange = (field, value) => {
    setHasManuallyModifiedCostos(true);
    setFormData(prev => {
      const updated = { ...prev, [field]: value === '' ? '' : parseFloat(value) };
      
      if (exchangeRate && field === 'costo_cup' && value !== '') {
        const cupValue = parseFloat(value) || 0;
        updated.costo_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_usd' && value !== '') {
        const usdValue = parseFloat(value) || 0;
        updated.costo_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  const handlePrecioChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value === '' ? '' : parseFloat(value) };
      
      if (exchangeRate && field === 'precio_cup' && value !== '') {
        const cupValue = parseFloat(value) || 0;
        updated.precio_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'precio_usd' && value !== '') {
        const usdValue = parseFloat(value) || 0;
        updated.precio_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Prevent search immediately after selecting a product
      if (justSelectedProducto) {
        return;
      }
      
      // Don't show dropdown if the text matches the selected product (editing mode)
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

  // Efecto para autorellenar costos cuando se selecciona producto/tienda
  useEffect(() => {
    if (!formData.producto || !formData.tienda) {
      return;
    }

    // Si el usuario ya modificó manualmente los costos, no sobrescribir
    if (hasManuallyModifiedCostos) {
      return;
    }

    // Si estamos en modo edición y ya se cargaron costos de la entrada, no sobrescribir
    if (isEditMode && (formData.costo_cup !== '' || formData.costo_usd !== '')) {
      return;
    }

    const servicioTienda = formData.producto.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda.id_tienda
    );

    if (servicioTienda) {
      // Autorellenar con el costo actual del producto en la tienda
      setFormData(prev => ({
        ...prev,
        costo_cup: servicioTienda.costo_cup?.toString() || '',
        costo_usd: servicioTienda.costo_usd?.toString() || '',
      }));
    }
  }, [formData.producto, formData.tienda, hasManuallyModifiedCostos, isEditMode]);

  // Efecto para autorellenar costos en modo múltiple cuando cambia la tienda
  useEffect(() => {
    if (!formData.tienda || !isMultipleMode) {
      return;
    }

    // Autorellenar costos para todas las entradas que tienen producto seleccionado
    setMultipleEntradas(prev => prev.map(entrada => {
      if (!entrada.producto || entrada.hasManuallyModifiedCostos) {
        return entrada;
      }

      const tiendaServicio = entrada.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );

      if (tiendaServicio) {
        return {
          ...entrada,
          costo_cup: tiendaServicio.costo_cup?.toString() || '',
          costo_usd: tiendaServicio.costo_usd?.toString() || '',
        };
      }

      return entrada;
    }));
  }, [formData.tienda, isMultipleMode]);

  // Efecto para manejar el dropdown de búsqueda de productos en modo múltiple
  useEffect(() => {
    const timeouts = {};
    
    multipleEntradas.forEach(entrada => {
      if (timeouts[entrada.id]) {
        clearTimeout(timeouts[entrada.id]);
      }
      
      timeouts[entrada.id] = setTimeout(() => {
        // Prevent search immediately after selecting a product
        if (multipleJustSelectedProducto[entrada.id]) {
          // Don't reset justSelectedProducto here - it will be reset when user types again
          return;
        }
        
        const isMatchingSelectedProduct = entrada.producto && 
          entrada.productoSearchText === entrada.producto.nombre;
        
        if (entrada.productoSearchText && entrada.productoSearchText.length >= 2 && !isMatchingSelectedProduct) {
          searchProductosMultiple(entrada.id, entrada.productoSearchText);
          setMultipleShowProductoDropdown(prev => ({ ...prev, [entrada.id]: true }));
        } else {
          setMultipleProductoSearchResults(prev => ({ ...prev, [entrada.id]: [] }));
          setMultipleShowProductoDropdown(prev => ({ ...prev, [entrada.id]: false }));
        }
      }, 500);
    });
    
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [multipleEntradas.map(e => e.productoSearchText).join(','), multipleEntradas.map(e => e.producto?.nombre).join(','), multipleJustSelectedProducto]);

  const handleProductoSelect = (producto) => {
    // Reset manual modification flag when selecting a new product
    setHasManuallyModifiedCostos(false);
    
    let costoCup = '';
    let costoUsd = '';
    
    // Always auto-fill costs from the product (cost is unique across all stores)
    if (formData.tienda) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      costoCup = tiendaServicio?.costo_cup?.toString() || '';
      costoUsd = tiendaServicio?.costo_usd?.toString() || '';
    }
    
    // If no tienda selected or no specific tienda cost, use first tienda's cost
    if (!costoCup && !costoUsd) {
      const firstTiendaServicio = producto.tiendas_servicio?.[0];
      costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
      costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
    }
    
    setFormData(prev => ({
      ...prev,
      producto,
      costo_cup: costoCup,
      costo_usd: costoUsd,
    }));
    
    setProductoSearchText(producto.nombre.trimEnd());
    setShowProductoDropdown(false);
    setProductoSearchResults([]);
    setJustSelectedProducto(true);
    
    // Dismiss keyboard and blur the input to prevent unnecessary API requests
    Keyboard.dismiss();
    if (productoInputRef.current) {
      productoInputRef.current.blur();
    }
  };

  // Funciones para modo múltiple
  const addNewEntrada = () => {
    const newEntrada = {
      id: Date.now(), // ID temporal
      producto: null,
      cantidad_entrada: '',
      costo_usd: '',
      costo_cup: '',
      precio_usd: '',
      precio_cup: '',
      fecha_vencimiento: '',
      productoSearchText: '',
      hasManuallyModifiedCostos: false, // Track manual cost modifications per entry
    };
    setMultipleEntradas(prev => [...prev, newEntrada]);
  };

  const isEntradaComplete = (entrada) => {
    // Check if all required fields are filled
    if (!entrada.producto) return false;
    if (!entrada.cantidad_entrada || parseFloat(entrada.cantidad_entrada) <= 0) return false;
    if (!entrada.costo_cup || parseFloat(entrada.costo_cup) < 0) return false;
    if (!entrada.costo_usd || parseFloat(entrada.costo_usd) < 0) return false;
    
    // Check if product-tienda relationship exists, if not validate prices
    const productoTienda = entrada.producto?.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda?.id_tienda
    );
    
    if (!productoTienda) {
      if (!entrada.precio_cup || entrada.precio_cup === '') return false;
      if (!entrada.precio_usd || entrada.precio_usd === '') return false;
    }
    
    // Check expiration date if product is vencible
    if (entrada.producto.producto?.isVencible && !entrada.fecha_vencimiento) {
      return false;
    }
    
    return true;
  };

  const removeEntrada = (id) => {
    setMultipleEntradas(prev => prev.filter(e => e.id !== id));
  };

  const updateMultipleEntrada = (id, field, value) => {
    setMultipleEntradas(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, [field]: value };
      }
      return e;
    }));
  };

  const handleProductoSelectMultiple = (id, producto) => {
    // Reset manual modification flag when selecting a new product
    updateMultipleEntrada(id, 'hasManuallyModifiedCostos', false);
    
    let costoCup = '';
    let costoUsd = '';
    
    if (formData.tienda) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
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
    updateMultipleEntrada(id, 'productoSearchText', producto.nombre.trimEnd());
    
    // Cerrar dropdown para esta entrada específica
    setMultipleShowProductoDropdown(prev => ({ ...prev, [id]: false }));
    setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    setMultipleJustSelectedProducto(prev => ({ ...prev, [id]: true }));
    
    // Dismiss keyboard and blur the input to prevent unnecessary API requests
    Keyboard.dismiss();
    if (multipleProductoInputRefs.current[id]) {
      multipleProductoInputRefs.current[id].blur();
    }

    // Auto-generate new empty form if this is the last entry
    const lastIndex = multipleEntradas.length - 1;
    const currentEntryIndex = multipleEntradas.findIndex(e => e.id === id);
    if (currentEntryIndex === lastIndex) {
      addNewEntrada();
    }
  };

  const searchProductosMultiple = async (id, searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
        setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
        return;
      }
      setMultipleIsSearchingProductos(prev => ({ ...prev, [id]: true }));
      const data = await getProductos({ nombre: searchTerm, skipCantidadMin: true, skipEsvendible: true }, 1, 20);
      setMultipleProductoSearchResults(prev => ({ ...prev, [id]: data.data || [] }));
    } catch (err) {
      setMultipleProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    } finally {
      setMultipleIsSearchingProductos(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCostoChangeMultiple = (id, field, value) => {
    const entrada = multipleEntradas.find(e => e.id === id);
    if (!entrada) return;
    
    // Mark as manually modified when user changes costos
    updateMultipleEntrada(id, 'hasManuallyModifiedCostos', true);
    
    updateMultipleEntrada(id, field, value === '' ? '' : parseFloat(value));
  };

  // Funciones para modo fabricación
  const addNewFabricacion = () => {
    const newFabricacion = {
      id: Date.now(), // ID temporal
      producto: null,
      cantidad_insumo: '',
      costo_insumo_cup: '',
      costo_insumo_usd: '',
      productoSearchText: '',
    };
    setFabricaciones(prev => [...prev, newFabricacion]);
  };

  const removeFabricacion = (id) => {
    setFabricaciones(prev => prev.filter(f => f.id !== id));
  };

  const updateFabricacion = (id, field, value) => {
    setFabricaciones(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  const handleProductoSelectFabricacion = (id, producto) => {
    // Prevenir seleccionar el mismo producto dos veces
    const isDuplicate = fabricaciones.some(f => f.id !== id && f.producto?.id_servicio === producto.id_servicio);
    if (isDuplicate) {
      showToast({ type: 'warning', message: 'Este producto ya está seleccionado como insumo' });
      return;
    }

    let costoCup = '';
    let costoUsd = '';
    let stockActual = 0;

    if (formData.tienda) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      costoCup = tiendaServicio?.costo_cup?.toString() || '';
      costoUsd = tiendaServicio?.costo_usd?.toString() || '';
      stockActual = parseFloat(tiendaServicio?.cantidad || 0);
    } else {
      const firstTiendaServicio = producto.tiendas_servicio?.[0];
      costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
      costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
      stockActual = parseFloat(firstTiendaServicio?.cantidad || 0);
    }

    updateFabricacion(id, 'producto', producto);
    updateFabricacion(id, 'costo_insumo_cup', costoCup);
    updateFabricacion(id, 'costo_insumo_usd', costoUsd);
    updateFabricacion(id, 'productoSearchText', producto.nombre.trimEnd());
    updateFabricacion(id, 'stock_actual', stockActual);

    setFabricacionShowProductoDropdown(prev => ({ ...prev, [id]: false }));
    setFabricacionProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    setFabricacionJustSelectedProducto(prev => ({ ...prev, [id]: true }));

    Keyboard.dismiss();
  };

  const searchProductosFabricacion = async (id, searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
        setFabricacionProductoSearchResults(prev => ({ ...prev, [id]: [] }));
        return;
      }
      setFabricacionIsSearchingProductos(prev => ({ ...prev, [id]: true }));
      const data = await getProductos({ nombre: searchTerm, skipCantidadMin: true, skipEsvendible: true }, 1, 20);
      setFabricacionProductoSearchResults(prev => ({ ...prev, [id]: data.data || [] }));
    } catch (err) {
      setFabricacionProductoSearchResults(prev => ({ ...prev, [id]: [] }));
    } finally {
      setFabricacionIsSearchingProductos(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCostoChangeFabricacion = (id, field, value) => {
    updateFabricacion(id, field, value === '' ? '' : parseFloat(value));
  };

  // Efecto para manejar el dropdown de búsqueda de productos en modo fabricación
  useEffect(() => {
    const timeouts = {};
    
    fabricaciones.forEach(fabricacion => {
      if (timeouts[fabricacion.id]) {
        clearTimeout(timeouts[fabricacion.id]);
      }
      
      timeouts[fabricacion.id] = setTimeout(() => {
        if (fabricacionJustSelectedProducto[fabricacion.id]) {
          return;
        }
        
        const isMatchingSelectedProduct = fabricacion.producto && 
          fabricacion.productoSearchText === fabricacion.producto.nombre;
        
        if (fabricacion.productoSearchText && fabricacion.productoSearchText.length >= 2 && !isMatchingSelectedProduct) {
          searchProductosFabricacion(fabricacion.id, fabricacion.productoSearchText);
          setFabricacionShowProductoDropdown(prev => ({ ...prev, [fabricacion.id]: true }));
        } else {
          setFabricacionProductoSearchResults(prev => ({ ...prev, [fabricacion.id]: [] }));
          setFabricacionShowProductoDropdown(prev => ({ ...prev, [fabricacion.id]: false }));
        }
      }, 500);
    });
    
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [fabricaciones.map(f => f.productoSearchText).join(','), fabricaciones.map(f => f.producto?.nombre).join(','), fabricacionJustSelectedProducto]);

  const handleDateChangeMultiple = (id, event, selectedDate) => {
    setMultipleShowDatePicker(prev => ({ ...prev, [id]: false }));
    if (selectedDate) {
      // Use UTC methods to avoid timezone issues
      const year = selectedDate.getUTCFullYear();
      const month = String(selectedDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getUTCDate()).padStart(2, '0');
      // Append time to prevent UTC conversion issues in backend
      const formattedDate = `${year}-${month}-${day}T12:00:00`;
      updateMultipleEntrada(id, 'fecha_vencimiento', formattedDate);
    }
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const getCantidadStatus = () => {
    if (!formData.producto || !formData.tienda) {
      return null;
    }
    
    // In view/edit mode, use the cantidad_restante from the entrada data
    // In add mode, use the producto's tiendas_servicio
    let cantidadActual = 0;
    
    if ((isViewMode || isEditMode) && entrada?.cantidad_restante !== undefined) {
      cantidadActual = parseFloat(entrada.cantidad_restante) || 0;
    } else {
      const servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      if (servicioTienda) {
        cantidadActual = parseFloat(servicioTienda.cantidad) || 0;
      }
    }
    
    const cantidadTotal = parseFloat(formData.cantidad_entrada) || 0;
    
    if (cantidadActual === cantidadTotal) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Completo' };
    } else if (cantidadActual === 0) {
      return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336', label: 'Agotado' };
    } else {
      return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800', label: 'Parcial' };
    }
  };

  const getFinancialInfo = () => {
    if (!formData.cantidad_entrada) {
      return null;
    }

    const cantidad = parseFloat(formData.cantidad_entrada) || 0;
    const costoCup = parseFloat(formData.costo_cup) || 0;
    const costoUsd = parseFloat(formData.costo_usd) || 0;

    let precioCup = 0;
    let precioUsd = 0;

    // In view/edit mode, use the servicioTienda from the entrada data
    if ((isViewMode || isEditMode) && entrada?.servicioTienda) {
      const parsedPrecioCup = parseFloat(entrada.servicioTienda.precio_cup);
      const parsedPrecioUsd = parseFloat(entrada.servicioTienda.precio_usd);
      precioCup = !isNaN(parsedPrecioCup) ? parsedPrecioCup : 0;
      precioUsd = !isNaN(parsedPrecioUsd) ? parsedPrecioUsd : 0;
    } 
    // In add mode, use the product's tiendas_servicio or form prices if no relationship exists
    else if (formData.producto && formData.tienda) {
      const servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      
      if (servicioTienda) {
        // Use existing relationship prices
        const parsedPrecioCup = parseFloat(servicioTienda.precio_cup);
        const parsedPrecioUsd = parseFloat(servicioTienda.precio_usd);
        precioCup = !isNaN(parsedPrecioCup) ? parsedPrecioCup : 0;
        precioUsd = !isNaN(parsedPrecioUsd) ? parsedPrecioUsd : 0;
      } else {
        // No relationship exists, use prices from form (user is entering them manually)
        precioCup = parseFloat(formData.precio_cup) || 0;
        precioUsd = parseFloat(formData.precio_usd) || 0;
      }
    }

    // Calculate total cost
    const costoTotalCup = costoCup * cantidad;
    const costoTotalUsd = costoUsd * cantidad;

    // Calculate expected profit
    const gananciaCup = precioCup - costoCup;
    const gananciaUsd = precioUsd - costoUsd;

    // Calculate profit percentage
    const porcentajeGananciaCup = precioCup > 0 ? (gananciaCup / precioCup) * 100 : 0;
    const porcentajeGananciaUsd = precioUsd > 0 ? (gananciaUsd / precioUsd) * 100 : 0;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      precioCup: !isNaN(precioCup) ? precioCup : 0,
      precioUsd: !isNaN(precioUsd) ? precioUsd : 0,
      gananciaCup: !isNaN(gananciaCup) ? gananciaCup : 0,
      gananciaUsd: !isNaN(gananciaUsd) ? gananciaUsd : 0,
      porcentajeGananciaCup: !isNaN(porcentajeGananciaCup) ? porcentajeGananciaCup : 0,
      porcentajeGananciaUsd: !isNaN(porcentajeGananciaUsd) ? porcentajeGananciaUsd : 0
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

    multipleEntradas.forEach(entrada => {
      const cantidad = parseFloat(entrada.cantidad_entrada) || 0;
      const costoCup = parseFloat(entrada.costo_cup) || 0;
      const costoUsd = parseFloat(entrada.costo_usd) || 0;

      // Get prices from producto-tienda relationship
      let precioCup = 0;
      let precioUsd = 0;

      if (entrada.producto && formData.tienda) {
        const servicioTienda = entrada.producto.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
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
        onBackPress={() => {
          if (fromModal) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Productos' }],
            });
          } else {
            navigation.goBack();
          }
        }}
        isDark={isDarkMode}
        title={isViewMode ? 'Información de Entrada' : isEditMode ? 'Editar Entrada' : 'Agregar Entrada'}
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
        {/* Alerta de Vencimiento */}
        {showExpirationAlert && (
          <Card style={[styles.expirationAlertCard, { backgroundColor: isDarkMode ? '#FFF3E0' : '#FFF3E0', borderColor: '#FF9800', borderWidth: 1 }]}>
            <View style={styles.expirationAlertContent}>
              <Ionicons name="warning" size={responsive.responsiveWidth(20)} color="#FF9800" />
              <Text style={[styles.expirationAlertText, { color: '#E65100' }]}>
                {expirationAlertData?.message || 'Esta entrada está próxima a vencer'}
              </Text>
            </View>
          </Card>
        )}

        <Card style={[styles.formCard, { backgroundColor: colors.surface, marginTop: showExpirationAlert ? 0 : responsive.responsiveMargin(55) }]}>
          {isFetchingEntrada ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando datos...
              </Text>
            </View>
          ) : (
            <>
              {/* Interruptor de modo de entrada (solo visible en add mode) */}
              {isAddMode && !isReadOnly && (
                <View style={styles.modeSwitchContainer}>
                  <Text style={[styles.modeSwitchTitle, { color: colors.onSurface }]}>Entradas</Text>
                  <View style={[styles.modeSwitch, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                    <TouchableOpacity
                      style={[styles.modeSwitchButton, !isMultipleMode && !isFabricacionMode && styles.modeSwitchButtonActive, !isMultipleMode && !isFabricacionMode && { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (isMultipleMode || isFabricacionMode) {
                          setIsMultipleMode(false);
                          setIsFabricacionMode(false);
                          setMultipleEntradas([]);
                          setFabricaciones([]);
                        }
                      }}
                    >
                      <Text style={[styles.modeSwitchButtonText, !isMultipleMode && !isFabricacionMode && { color: '#fff' }, { color: !isMultipleMode && !isFabricacionMode ? '#fff' : colors.outline }]}>
                        Simples
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeSwitchButton, isMultipleMode && styles.modeSwitchButtonActive, isMultipleMode && { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (!isMultipleMode) {
                          setIsMultipleMode(true);
                          setIsFabricacionMode(false);
                          setFabricaciones([]);
                          addNewEntrada();
                        }
                      }}
                    >
                      <Text style={[styles.modeSwitchButtonText, isMultipleMode && { color: '#fff' }, { color: isMultipleMode ? '#fff' : colors.outline }]}>
                        Múltiples
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeSwitchButton, isFabricacionMode && styles.modeSwitchButtonActive, isFabricacionMode && { backgroundColor: colors.primary }]}
                      onPress={() => {
                        if (!isFabricacionMode) {
                          setIsFabricacionMode(true);
                          setIsMultipleMode(false);
                          setMultipleEntradas([]);
                          addNewFabricacion();
                        }
                      }}
                    >
                      <Text style={[styles.modeSwitchButtonText, isFabricacionMode && { color: '#fff' }, { color: isFabricacionMode ? '#fff' : colors.outline }]}>
                        Fabricación
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Formulario individual (solo visible cuando NO está en modo múltiple ni fabricación) */}
              {!isMultipleMode && !isFabricacionMode && (
                <>
                  {/* Producto Selection */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.outline }]}>Producto *</Text>
                    <View style={styles.relativeContainer}>
                      <TextInput
                        ref={productoInputRef}
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Buscar producto..."
                        value={productoSearchText}
                        onChangeText={(text) => {
                          setProductoSearchText(text);
                          setJustSelectedProducto(false);
                        }}
                        editable={!isReadOnly}
                        onBlur={() => {
                          setShowProductoDropdown(false);
                        }}
                      />
                      {showProductoDropdown && !isReadOnly && (
                        <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                          {isSearchingProductos ? (
                            <View style={styles.dropdownItem}>
                              <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                          ) : productoSearchResults.length > 0 ? (
                            productoSearchResults.map((producto, index) => (
                              <TouchableOpacity
                                key={producto.id_servicio}
                                style={[styles.dropdownItem, index === productoSearchResults.length - 1 && styles.dropdownItemLast]}
                                onPress={() => handleProductoSelect(producto)}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Tienda Selection and Cantidad Entrante */}
                  <View style={styles.formRow}>
                    <View style={[styles.formColumn60, styles.formGroup]}>
                      <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
                      <TouchableOpacity
                        style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                        onPress={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                        disabled={isReadOnly}
                      >
                        <Text style={[styles.dropdownText, { color: formData.tienda ? colors.onSurface : colors.outline }]}>
                          {formData.tienda?.nombre || 'Seleccionar...'}
                        </Text>
                        {!isReadOnly && (
                          <Ionicons
                            name={showTiendaDropdown ? "chevron-up" : "chevron-down"}
                            size={responsive.responsiveWidth(20)}
                            color={colors.outline}
                          />
                        )}
                      </TouchableOpacity>

                      {showTiendaDropdown && !isReadOnly && (
                        <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
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
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                            {filteredTiendas.length > 0 ? (
                              filteredTiendas.map((tienda, index) => (
                                <TouchableOpacity
                                  key={tienda.id_tienda}
                                  style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                                  onPress={() => handleTiendaSelect(tienda)}
                                >
                                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                                </TouchableOpacity>
                              ))
                            ) : (
                              <View style={styles.dropdownItem}>
                                <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                              </View>
                            )}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    <View style={[styles.formColumn40, styles.formGroup]}>
                      <Text style={[styles.label, { color: colors.outline }]}>Cant.Entrante *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Cantidad"
                        value={formData.cantidad_entrada}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_entrada: text.replace(/-/g, '') }))}
                        keyboardType="decimal-pad"
                        editable={!isReadOnly}
                      />
                      {(isViewMode || isEditMode) && getCantidadStatus() && (
                        <View style={styles.cantidadInfoRow}>
                          <Text style={[styles.cantidadInfoLabel, { color: colors.outline }]}>
                            Cant. Actual:
                          </Text>
                          <View style={[styles.cantidadOval, { backgroundColor: getCantidadStatus().bgColor, borderColor: getCantidadStatus().borderColor }]}>
                            <Text style={[styles.cantidadOvalText, { color: getCantidadStatus().color }]}>
                              {entrada?.cantidad_restante || 0}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Costos */}
                  {canManageEntradas && (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo CUP"
                          value={
                            costoInputTexts.costo_cup !== undefined
                              ? costoInputTexts.costo_cup
                              : (formData.costo_cup !== null && formData.costo_cup !== '' ? parseFloat(formData.costo_cup).toFixed(2) : '')
                          }
                          onFocus={() => setCostoInputTexts(prev => ({
                            ...prev,
                            costo_cup: formData.costo_cup !== null && formData.costo_cup !== '' ? String(parseFloat(formData.costo_cup)) : ''
                          }))}
                          onChangeText={(text) => {
                            setCostoInputTexts(prev => ({ ...prev, costo_cup: text }));
                            handleCostoChange('costo_cup', text);
                          }}
                          onBlur={() => {
                            // Update formData with the value the user typed before clearing costoInputTexts
                            if (costoInputTexts.costo_cup !== undefined) {
                              handleCostoChange('costo_cup', costoInputTexts.costo_cup);
                            }
                            setCostoInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.costo_cup;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo USD *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo USD"
                          value={
                            costoInputTexts.costo_usd !== undefined
                              ? costoInputTexts.costo_usd
                              : (formData.costo_usd !== null && formData.costo_usd !== '' ? parseFloat(formData.costo_usd).toFixed(2) : '')
                          }
                          onFocus={() => setCostoInputTexts(prev => ({
                            ...prev,
                            costo_usd: formData.costo_usd !== null && formData.costo_usd !== '' ? String(parseFloat(formData.costo_usd)) : ''
                          }))}
                          onChangeText={(text) => {
                            setCostoInputTexts(prev => ({ ...prev, costo_usd: text }));
                            handleCostoChange('costo_usd', text);
                          }}
                          onBlur={() => {
                            // Update formData with the value the user typed before clearing costoInputTexts
                            if (costoInputTexts.costo_usd !== undefined) {
                              handleCostoChange('costo_usd', costoInputTexts.costo_usd);
                            }
                            setCostoInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.costo_usd;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  )}

                  {/* Precios (solo cuando no existe relación producto-tienda en add mode) */}
                  {isAddMode && formData.producto && formData.tienda && !formData.producto.tiendas_servicio?.find(
                    ts => ts.id_tienda === formData.tienda.id_tienda
                  ) && (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Precio CUP *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Precio CUP"
                          value={
                            precioInputTexts.precio_cup !== undefined
                              ? precioInputTexts.precio_cup
                              : (formData.precio_cup !== null && formData.precio_cup !== '' ? parseFloat(formData.precio_cup).toFixed(2) : '')
                          }
                          onFocus={() => setPrecioInputTexts(prev => ({
                            ...prev,
                            precio_cup: formData.precio_cup !== null && formData.precio_cup !== '' ? String(parseFloat(formData.precio_cup)) : ''
                          }))}
                          onChangeText={(text) => {
                            setPrecioInputTexts(prev => ({ ...prev, precio_cup: text }));
                            handlePrecioChange('precio_cup', text);
                          }}
                          onBlur={() => {
                            setPrecioInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.precio_cup;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Precio USD *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Precio USD"
                          value={
                            precioInputTexts.precio_usd !== undefined
                              ? precioInputTexts.precio_usd
                              : (formData.precio_usd !== null && formData.precio_usd !== '' ? parseFloat(formData.precio_usd).toFixed(2) : '')
                          }
                          onFocus={() => setPrecioInputTexts(prev => ({
                            ...prev,
                            precio_usd: formData.precio_usd !== null && formData.precio_usd !== '' ? String(parseFloat(formData.precio_usd)) : ''
                          }))}
                          onChangeText={(text) => {
                            setPrecioInputTexts(prev => ({ ...prev, precio_usd: text }));
                            handlePrecioChange('precio_usd', text);
                          }}
                          onBlur={() => {
                            setPrecioInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.precio_usd;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  )}

                  {/* Fecha de Vencimiento and Fecha de Entrada */}
                  {formData.producto?.producto?.isVencible ? (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Fecha Vencimiento *</Text>
                        <TouchableOpacity
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          onPress={() => !isReadOnly && setShowDatePicker(true)}
                          disabled={isReadOnly}
                        >
                          <Text style={[styles.inputText, { color: formData.fecha_vencimiento ? colors.onSurface : colors.outline }]}>
                            {formData.fecha_vencimiento ? formatDateForDisplay(formData.fecha_vencimiento) : 'Seleccionar...'}
                          </Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                          <DateTimePicker
                            value={formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento) : new Date()}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                          />
                        )}
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Fecha de Entrada</Text>
                        <TouchableOpacity
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          onPress={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                          disabled={isReadOnly}
                        >
                          <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                            {formData.fecha ? formatDateForDisplay(formData.fecha) : 'Seleccionar...'}
                          </Text>
                        </TouchableOpacity>
                        {showFechaEntradaPicker && (
                          <DateTimePicker
                            value={formData.fecha ? new Date(formData.fecha) : new Date()}
                            mode="date"
                            display="default"
                            onChange={handleFechaEntradaChange}
                          />
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, { color: colors.outline }]}>Fecha de Entrada</Text>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        onPress={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                        disabled={isReadOnly}
                      >
                        <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                          {formData.fecha ? formatDateForDisplay(formData.fecha) : 'Seleccionar...'}
                        </Text>
                      </TouchableOpacity>
                      {showFechaEntradaPicker && (
                        <DateTimePicker
                          value={formData.fecha ? new Date(formData.fecha) : new Date()}
                          mode="date"
                          display="default"
                          onChange={handleFechaEntradaChange}
                        />
                      )}
                    </View>
                  )}
                  {(isEditMode || isViewMode) && (
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                      <View style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.dropdownText, { color: colors.onSurface }]}>
                          {entrada?.usuario?.nombre_natural || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Campos comunes (tienda, fecha, proveedor) - siempre visibles */}
              {(isMultipleMode || isFabricacionMode) && (
                <>
                  {/* Tienda Selection (común para todas las entradas) */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
                    <TouchableOpacity
                      style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                      onPress={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                      disabled={isReadOnly}
                    >
                      <Text style={[styles.dropdownText, { color: formData.tienda ? colors.onSurface : colors.outline }]}>
                        {formData.tienda?.nombre || 'Seleccionar...'}
                      </Text>
                      {!isReadOnly && (
                        <Ionicons
                          name={showTiendaDropdown ? "chevron-up" : "chevron-down"}
                          size={responsive.responsiveWidth(20)}
                          color={colors.outline}
                        />
                      )}
                    </TouchableOpacity>

                    {showTiendaDropdown && !isReadOnly && (
                      <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
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
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                          {filteredTiendas.length > 0 ? (
                            filteredTiendas.map((tienda, index) => (
                              <TouchableOpacity
                                key={tienda.id_tienda}
                                style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                                onPress={() => handleTiendaSelect(tienda)}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Fecha de Entrada (común para todas las entradas) */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.outline }]}>Fecha de Entrada</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      onPress={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                      disabled={isReadOnly}
                    >
                      <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                        {formData.fecha ? formatDateForDisplay(formData.fecha) : 'Seleccionar...'}
                      </Text>
                    </TouchableOpacity>
                    {showFechaEntradaPicker && (
                      <DateTimePicker
                        value={formData.fecha ? new Date(formData.fecha) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleFechaEntradaChange}
                      />
                    )}
                  </View>
                </>
              )}

              {/* Proveedor - No mostrar en modo fabricación */}
              {!isFabricacionMode && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Nombre del Proveedor</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Proveedor (opcional)"
                    value={formData.nombre_proveedor}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, nombre_proveedor: text }))}
                    editable={!isReadOnly}
                  />
                </View>
              )}

              {/* Formulario de fabricación */}
              {isFabricacionMode && (
                <>
                  {/* Producto Final y Cantidad Producida en la misma fila */}
                  <View style={[styles.formRow, { alignItems: 'flex-start' }]}>
                    <View style={[styles.formColumn, { flex: 0.7, marginRight: responsive.responsiveMargin(8) }]}>
                      <Text style={[styles.label, { color: colors.outline }]}>Producto Final *</Text>
                      <View style={styles.relativeContainer}>
                        <TextInput
                          ref={productoInputRef}
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Buscar producto final..."
                          value={productoSearchText}
                          onChangeText={(text) => {
                            setProductoSearchText(text);
                            setJustSelectedProducto(false);
                          }}
                          editable={!isReadOnly}
                          onBlur={() => {
                            setShowProductoDropdown(false);
                          }}
                        />
                        {showProductoDropdown && !isReadOnly && (
                          <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                            {isSearchingProductos ? (
                              <View style={styles.dropdownItem}>
                                <ActivityIndicator size="small" color={colors.primary} />
                              </View>
                            ) : productoSearchResults.length > 0 ? (
                              productoSearchResults.map((producto, index) => (
                                <TouchableOpacity
                                  key={producto.id_servicio}
                                  style={[styles.dropdownItem, index === productoSearchResults.length - 1 && styles.dropdownItemLast]}
                                  onPress={() => handleProductoSelect(producto)}
                                >
                                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                                </TouchableOpacity>
                              ))
                            ) : (
                              <View style={styles.dropdownItem}>
                                <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={[styles.formColumn, { flex: 0.3 }]}>
                      <Text style={[styles.label, { color: colors.outline }]}>Cant.Prod *</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Cantidad"
                        value={formData.cantidad_entrada}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_entrada: text.replace(/-/g, '') }))}
                        keyboardType="decimal-pad"
                        editable={!isReadOnly}
                      />
                    </View>
                  </View>

                  {/* Costos de Producción - No mostrar en modo fabricación */}
                  {canManageEntradas && !isFabricacionMode && (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo CUP"
                          value={costoInputTexts.costo_cup !== undefined ? costoInputTexts.costo_cup : (formData.costo_cup !== null && formData.costo_cup !== '' ? parseFloat(formData.costo_cup).toFixed(2) : '')}
                          onFocus={() => setCostoInputTexts(prev => ({ ...prev, costo_cup: formData.costo_cup !== null && formData.costo_cup !== '' ? String(parseFloat(formData.costo_cup)) : '' }))}
                          onChangeText={(text) => {
                            setCostoInputTexts(prev => ({ ...prev, costo_cup: text }));
                            handleCostoChange('costo_cup', text);
                          }}
                          onBlur={() => {
                            if (costoInputTexts.costo_cup !== undefined) {
                              handleCostoChange('costo_cup', costoInputTexts.costo_cup);
                            }
                            setCostoInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.costo_cup;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo USD *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo USD"
                          value={costoInputTexts.costo_usd !== undefined ? costoInputTexts.costo_usd : (formData.costo_usd !== null && formData.costo_usd !== '' ? parseFloat(formData.costo_usd).toFixed(2) : '')}
                          onFocus={() => setCostoInputTexts(prev => ({ ...prev, costo_usd: formData.costo_usd !== null && formData.costo_usd !== '' ? String(parseFloat(formData.costo_usd)) : '' }))}
                          onChangeText={(text) => {
                            setCostoInputTexts(prev => ({ ...prev, costo_usd: text }));
                            handleCostoChange('costo_usd', text);
                          }}
                          onBlur={() => {
                            if (costoInputTexts.costo_usd !== undefined) {
                              handleCostoChange('costo_usd', costoInputTexts.costo_usd);
                            }
                            setCostoInputTexts(prev => {
                              const updated = { ...prev };
                              delete updated.costo_usd;
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  )}

                  {/* Fecha de Vencimiento (si el producto es vencible) */}
                  {formData.producto?.producto?.isVencible && (
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, { color: colors.outline }]}>Fecha de Vencimiento *</Text>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        onPress={() => !isReadOnly && setShowDatePicker(true)}
                        disabled={isReadOnly}
                      >
                        <Text style={[styles.inputText, { color: formData.fecha_vencimiento ? colors.onSurface : colors.outline }]}>
                          {formData.fecha_vencimiento ? formatDateForDisplay(formData.fecha_vencimiento) : 'Seleccionar...'}
                        </Text>
                      </TouchableOpacity>
                      {showDatePicker && (
                        <DateTimePicker
                          value={formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento) : new Date()}
                          mode="date"
                          display="default"
                          onChange={handleDateChange}
                        />
                      )}
                    </View>
                  )}

                  {/* Lista de Insumos */}
                  <View style={styles.formGroup}>
                  </View>

                  {fabricaciones.map((fabricacion, index) => (
                    <View key={fabricacion.id} style={[styles.multipleEntradaCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.multipleEntradaHeader}>
                        <Text style={[styles.multipleEntradaTitle, { color: colors.onSurface }]}>
                          Insumo {index + 1}
                        </Text>
                        {fabricaciones.length > 1 && (
                          <TouchableOpacity
                            onPress={() => removeFabricacion(fabricacion.id)}
                            style={styles.removeButton}
                          >
                            <Ionicons name="close-circle" size={responsive.responsiveWidth(24)} color="#F44336" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Producto Insumo y Cantidad en la misma fila */}
                      <View style={[styles.formRow, { alignItems: 'flex-start' }]}>
                        <View style={[styles.formColumn, { flex: 0.7, marginRight: responsive.responsiveMargin(8) }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Producto Insumo *</Text>
                          <View style={styles.relativeContainer}>
                            <TextInput
                              style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                              placeholderTextColor={colors.outline}
                              placeholder="Buscar insumo..."
                              value={fabricacion.productoSearchText}
                              onChangeText={(text) => {
                                updateFabricacion(fabricacion.id, 'productoSearchText', text);
                                setFabricacionJustSelectedProducto(prev => ({ ...prev, [fabricacion.id]: false }));
                              }}
                              editable={!isReadOnly}
                              onBlur={() => {
                                setFabricacionShowProductoDropdown(prev => ({ ...prev, [fabricacion.id]: false }));
                              }}
                            />
                            {fabricacionShowProductoDropdown[fabricacion.id] && !isReadOnly && (
                              <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                                {fabricacionIsSearchingProductos[fabricacion.id] ? (
                                  <View style={styles.dropdownItem}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                  </View>
                                ) : (fabricacionProductoSearchResults[fabricacion.id] || []).length > 0 ? (
                                  (fabricacionProductoSearchResults[fabricacion.id] || []).map((producto, index) => (
                                    <TouchableOpacity
                                      key={producto.id_servicio}
                                      style={[styles.dropdownItem, index === (fabricacionProductoSearchResults[fabricacion.id] || []).length - 1 && styles.dropdownItemLast]}
                                      onPress={() => handleProductoSelectFabricacion(fabricacion.id, producto)}
                                    >
                                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                                    </TouchableOpacity>
                                  ))
                                ) : (
                                  <View style={styles.dropdownItem}>
                                    <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={[styles.formColumn, { flex: 0.3 }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Cantidad"
                            value={fabricacion.cantidad_insumo}
                            onChangeText={(text) => {
                              const cantidad = parseFloat(text) || 0;
                              const stockActual = fabricacion.stock_actual || 0;
                              if (cantidad > stockActual) {
                                showToast({ type: 'warning', message: `La cantidad no puede exceder el stock disponible (${stockActual})` });
                                return;
                              }
                              updateFabricacion(fabricacion.id, 'cantidad_insumo', text.replace(/-/g, ''));
                              // Auto-crear nueva card si hay producto y cantidad
                              if (fabricacion.producto && cantidad > 0) {
                                const lastFabricacion = fabricaciones[fabricaciones.length - 1];
                                if (lastFabricacion.id === fabricacion.id) {
                                  addNewFabricacion();
                                }
                              }
                            }}
                            keyboardType="decimal-pad"
                            editable={!isReadOnly}
                          />
                        </View>
                      </View>

                      {/* Stock info */}
                      {fabricacion.producto && (
                        <View style={[styles.stockInfoContainer, { backgroundColor: colors.primaryContainer }]}>
                          <Text style={[styles.stockInfoText, { color: !isDark ? '#FFFFFF' : colors.primary }]}>
                            Stock actual: {fabricacion.stock_actual || 0}
                          </Text>
                          <Text style={[styles.stockInfoText, { color: !isDark ? '#FFFFFF' : colors.primary }]}>
                            Stock restante: {(fabricacion.stock_actual || 0) - (parseFloat(fabricacion.cantidad_insumo) || 0)}
                          </Text>
                        </View>
                      )}

                      {/* Costos de Insumo - Solo lectura - Eliminados por solicitud */}
                    </View>
                  ))}

                  {/* Botón para agregar otro insumo */}
                  {!isReadOnly && (
                    <TouchableOpacity
                      style={[
                        styles.addProductButton,
                        { backgroundColor: colors.primaryContainer, borderColor: colors.primary }
                      ]}
                      onPress={addNewFabricacion}
                    >
                      <Ionicons name="add-circle" size={responsive.responsiveWidth(20)} color={!isDark ? '#FFFFFF' : colors.primary} />
                      <Text style={[styles.addProductButtonText, { color: !isDark ? '#FFFFFF' : colors.primary }]}>
                        Agregar Insumo
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Info de cantidad de insumos */}
                  {fabricaciones.length > 0 && (
                    <View style={[styles.productCountInfo, { backgroundColor: colors.primaryContainer }]}>
                      <Ionicons name="information-circle" size={responsive.responsiveWidth(18)} color={!isDark ? '#FFFFFF' : colors.primary} />
                      <Text style={[styles.productCountInfoText, { color: !isDark ? '#FFFFFF' : colors.primary }]}>
                        {fabricaciones.filter(f => f.producto !== null).length} insumo{fabricaciones.filter(f => f.producto !== null).length !== 1 ? 's' : ''} agregado{fabricaciones.filter(f => f.producto !== null).length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Lista de entradas múltiples */}
              {isMultipleMode && multipleEntradas.map((entrada, index) => (
                <View key={entrada.id} style={[styles.multipleEntradaCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <View style={styles.multipleEntradaHeader}>
                    <Text style={[styles.multipleEntradaTitle, { color: colors.onSurface }]}>
                      Producto {index + 1}
                    </Text>
                    {multipleEntradas.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeEntrada(entrada.id)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={responsive.responsiveWidth(24)} color="#F44336" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Producto Selection */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.outline }]}>Producto *</Text>
                    <View style={styles.relativeContainer}>
                      <TextInput
                        ref={(ref) => {
                          if (ref) {
                            multipleProductoInputRefs.current[entrada.id] = ref;
                          }
                        }}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Buscar producto..."
                        value={entrada.productoSearchText}
                        onChangeText={(text) => {
                          updateMultipleEntrada(entrada.id, 'productoSearchText', text);
                          setMultipleJustSelectedProducto(prev => ({ ...prev, [entrada.id]: false }));
                        }}
                        editable={!isReadOnly}
                        onBlur={() => {
                          setMultipleShowProductoDropdown(prev => ({ ...prev, [entrada.id]: false }));
                        }}
                      />
                      {multipleShowProductoDropdown[entrada.id] && !isReadOnly && (
                        <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                          {multipleIsSearchingProductos[entrada.id] ? (
                            <View style={styles.dropdownItem}>
                              <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                          ) : (multipleProductoSearchResults[entrada.id] || []).length > 0 ? (
                            (multipleProductoSearchResults[entrada.id] || []).map((producto, index) => (
                              <TouchableOpacity
                                key={producto.id_servicio}
                                style={[styles.dropdownItem, index === (multipleProductoSearchResults[entrada.id] || []).length - 1 && styles.dropdownItemLast]}
                                onPress={() => handleProductoSelectMultiple(entrada.id, producto)}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Cantidad */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="Cantidad"
                      value={entrada.cantidad_entrada}
                      onChangeText={(text) => updateMultipleEntrada(entrada.id, 'cantidad_entrada', text.replace(/-/g, ''))}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                    />
                  </View>

                  {/* Costos */}
                  {canManageEntradas && (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo CUP"
                          value={
                            multipleCostoInputTexts[entrada.id]?.costo_cup !== undefined
                              ? multipleCostoInputTexts[entrada.id].costo_cup
                              : (entrada.costo_cup !== null && entrada.costo_cup !== '' ? parseFloat(entrada.costo_cup).toFixed(2) : '')
                          }
                          onFocus={() => setMultipleCostoInputTexts(prev => ({
                            ...prev,
                            [entrada.id]: {
                              ...prev[entrada.id],
                              costo_cup: entrada.costo_cup !== null && entrada.costo_cup !== '' ? String(parseFloat(entrada.costo_cup)) : ''
                            }
                          }))}
                          onChangeText={(text) => {
                            setMultipleCostoInputTexts(prev => ({
                              ...prev,
                              [entrada.id]: {
                                ...prev[entrada.id],
                                costo_cup: text
                              }
                            }));
                            handleCostoChangeMultiple(entrada.id, 'costo_cup', text);
                          }}
                          onBlur={() => {
                            // Update formData with the value the user typed before clearing multipleCostoInputTexts
                            if (multipleCostoInputTexts[entrada.id]?.costo_cup !== undefined) {
                              handleCostoChangeMultiple(entrada.id, 'costo_cup', multipleCostoInputTexts[entrada.id].costo_cup);
                            }
                            setMultipleCostoInputTexts(prev => {
                              const updated = { ...prev };
                              if (updated[entrada.id]) {
                                delete updated[entrada.id].costo_cup;
                              }
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Costo USD *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Costo USD"
                          value={
                            multipleCostoInputTexts[entrada.id]?.costo_usd !== undefined
                              ? multipleCostoInputTexts[entrada.id].costo_usd
                              : (entrada.costo_usd !== null && entrada.costo_usd !== '' ? parseFloat(entrada.costo_usd).toFixed(2) : '')
                          }
                          onFocus={() => setMultipleCostoInputTexts(prev => ({
                            ...prev,
                            [entrada.id]: {
                              ...prev[entrada.id],
                              costo_usd: entrada.costo_usd !== null && entrada.costo_usd !== '' ? String(parseFloat(entrada.costo_usd)) : ''
                            }
                          }))}
                          onChangeText={(text) => {
                            setMultipleCostoInputTexts(prev => ({
                              ...prev,
                              [entrada.id]: {
                                ...prev[entrada.id],
                                costo_usd: text
                              }
                            }));
                            handleCostoChangeMultiple(entrada.id, 'costo_usd', text);
                          }}
                          onBlur={() => {
                            // Update formData with the value the user typed before clearing multipleCostoInputTexts
                            if (multipleCostoInputTexts[entrada.id]?.costo_usd !== undefined) {
                              handleCostoChangeMultiple(entrada.id, 'costo_usd', multipleCostoInputTexts[entrada.id].costo_usd);
                            }
                            setMultipleCostoInputTexts(prev => {
                              const updated = { ...prev };
                              if (updated[entrada.id]) {
                                delete updated[entrada.id].costo_usd;
                              }
                              return updated;
                            });
                          }}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  )}

                  {/* Precios (solo cuando no existe relación producto-tienda) */}
                  {entrada.producto && formData.tienda && !entrada.producto.tiendas_servicio?.find(
                    ts => ts.id_tienda === formData.tienda.id_tienda
                  ) && (
                    <View style={styles.formRow}>
                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Precio CUP *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Precio CUP"
                          value={entrada.precio_cup}
                          onChangeText={(text) => updateMultipleEntrada(entrada.id, 'precio_cup', text)}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>

                      <View style={[styles.formColumn, styles.formGroup]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Precio USD *</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Precio USD"
                          value={entrada.precio_usd}
                          onChangeText={(text) => updateMultipleEntrada(entrada.id, 'precio_usd', text)}
                          keyboardType="decimal-pad"
                          editable={!isReadOnly}
                        />
                      </View>
                    </View>
                  )}

                  {/* Fecha de Vencimiento */}
                  {entrada.producto?.producto?.isVencible && (
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, { color: colors.outline }]}>Fecha Vencimiento *</Text>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        onPress={() => !isReadOnly && setMultipleShowDatePicker(prev => ({ ...prev, [entrada.id]: true }))}
                        disabled={isReadOnly}
                      >
                        <Text style={[styles.inputText, { color: entrada.fecha_vencimiento ? colors.onSurface : colors.outline }]}>
                          {entrada.fecha_vencimiento ? formatDateForDisplay(entrada.fecha_vencimiento) : 'Seleccionar...'}
                        </Text>
                      </TouchableOpacity>
                      {multipleShowDatePicker[entrada.id] && (
                        <DateTimePicker
                          value={entrada.fecha_vencimiento ? new Date(entrada.fecha_vencimiento) : new Date()}
                          mode="date"
                          display="default"
                          onChange={(event, date) => handleDateChangeMultiple(entrada.id, event, date)}
                        />
                      )}
                    </View>
                  )}
                </View>
              ))}

              {/* Botón para agregar otro producto */}
              {isMultipleMode && !isReadOnly && (
                <TouchableOpacity
                  style={[
                    styles.addProductButton,
                    { 
                      backgroundColor: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? colors.primary : colors.outlineVariant,
                      opacity: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? 1 : 0.5
                    }
                  ]}
                  onPress={() => addNewEntrada()}
                  disabled={multipleEntradas[multipleEntradas.length - 1]?.producto === null}
                >
                  <Ionicons name="add-circle" size={responsive.responsiveWidth(20)} color={multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? '#fff' : colors.outline} />
                  <Text style={[
                    styles.addProductButtonText,
                    { color: multipleEntradas[multipleEntradas.length - 1]?.producto !== null ? '#fff' : colors.outline }
                  ]}>
                    Agregar otro producto
                  </Text>
                </TouchableOpacity>
              )}


              {/* Info de cantidad de productos (solo en modo múltiple) */}
              {isMultipleMode && (
                <View style={[styles.productCountInfo, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(18)} color={!isDark ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.productCountInfoText, { color: !isDark ? '#FFFFFF' : colors.primary }]}>
                    Total: {multipleEntradas.filter(e => e.producto !== null).length} {multipleEntradas.filter(e => e.producto !== null).length === 1 ? 'producto' : 'productos'}
                  </Text>
                </View>
              )}

              {/* Financial Information Section (Fabricación Mode) */}
              {isFabricacionMode && getFabricacionFinancialInfo() && canManageEntradas && (
                <View style={[styles.financialInfoSection, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' }]}>
                  <View style={styles.financialInfoHeader}>
                    <Ionicons name="trending-up-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.financialInfoTitle, { color: colors.onSurface }]}>
                      Información Financiera
                    </Text>
                  </View>
                  
                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                  
                  {canManageEntradas && (
                    <>
                      <View style={styles.financialInfoRow}>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total Insumos CUP</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getFabricacionFinancialInfo().costoTotalCup.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total Insumos USD</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getFabricacionFinancialInfo().costoTotalUsd.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                    </>
                  )}

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada CUP</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFabricacionFinancialInfo().gananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFabricacionFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFabricacionFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFabricacionFinancialInfo().gananciaCup.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada USD</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFabricacionFinancialInfo().gananciaUsd >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFabricacionFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFabricacionFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFabricacionFinancialInfo().gananciaUsd.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Margen Ganancia</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFabricacionFinancialInfo().porcentajeGananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFabricacionFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFabricacionFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          {getFabricacionFinancialInfo().porcentajeGananciaCup.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Financial Information Section (Multiple Mode) */}
              {isMultipleMode && getMultipleFinancialInfo() && canManageEntradas && (
                <View style={[styles.financialInfoSection, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' }]}>
                  <View style={styles.financialInfoHeader}>
                    <Ionicons name="trending-up-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.financialInfoTitle, { color: colors.onSurface }]}>
                      Información Financiera
                    </Text>
                  </View>
                  
                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                  
                  {canManageEntradas && (
                    <>
                      <View style={styles.financialInfoRow}>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total CUP</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getMultipleFinancialInfo().costoTotalCup.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total USD</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getMultipleFinancialInfo().costoTotalUsd.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                    </>
                  )}

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada CUP</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getMultipleFinancialInfo().gananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getMultipleFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getMultipleFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getMultipleFinancialInfo().gananciaCup.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada USD</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getMultipleFinancialInfo().gananciaUsd >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getMultipleFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getMultipleFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getMultipleFinancialInfo().gananciaUsd.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Margen Ganancia</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getMultipleFinancialInfo().porcentajeGananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getMultipleFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getMultipleFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          {getMultipleFinancialInfo().porcentajeGananciaCup.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Info about weighted average */}
              {config.applyWeightedAverageCost && isAddMode && (
                <View style={[styles.infoSection, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(20)} color="#fff" />
                  <Text style={[styles.infoText, { color: '#fff' }]}>
                    La fórmula de costo promedio ponderado está activada. El costo se calculará automáticamente.
                  </Text>
                </View>
              )}

              {/* Financial Information Section (View Mode, Edit Mode, and Add Mode) - NOT for fabricación mode */}
              {(isViewMode || isEditMode || isAddMode) && !isFabricacionMode && getFinancialInfo() && canManageEntradas && (
                <View style={[styles.financialInfoSection, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' }]}>
                  <View style={styles.financialInfoHeader}>
                    <Ionicons name="trending-up-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.financialInfoTitle, { color: colors.onSurface }]}>
                      Información Financiera
                    </Text>
                  </View>
                  
                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                  
                  {canManageEntradas && (
                    <>
                      <View style={styles.financialInfoRow}>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total CUP</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getFinancialInfo().costoTotalCup.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.financialInfoColumn}>
                          <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total USD</Text>
                          <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                            ${getFinancialInfo().costoTotalUsd.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                    </>
                  )}

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Precio CUP en Tienda</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo().precioCup.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Precio USD en Tienda</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo().precioUsd.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada CUP</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().gananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFinancialInfo().gananciaCup.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada USD</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().gananciaUsd >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFinancialInfo().gananciaUsd.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoColumn}>
                    <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>% Ganancia CUP y USD</Text>
                    <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().porcentajeGananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                      <Text style={[styles.financialInfoValue, { color: getFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        {getFinancialInfo().porcentajeGananciaCup.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {isViewMode && canManageEntradas && (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, styles.editButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      if (isOfflineMode) {
                        showToast({ type: 'warning', message: 'No disponible en modo offline' });
                        return;
                      }
                      navigation.setParams({ mode: 'edit' });
                    }}
                  >
                    <Ionicons name="create-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Editar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isReadOnly && !isViewMode && (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                    onPress={() => {
                      if (fromModal) {
                        navigation.reset({
                          index: 0,
                          routes: [{ name: 'Productos' }],
                        });
                      } else {
                        navigation.goBack();
                      }
                    }}
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
                      <Text style={[styles.buttonText, { color: '#fff' }]}>
                        Guardar
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Costos Sugeridos */}
      <Modal
        visible={showCostSuggestionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCostSuggestionModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Costos Sugeridos
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCostSuggestionModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalList} 
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.infoText, { color: colors.outline, marginBottom: responsive.responsiveMargin(16) }]}>
                {isMultipleCostSuggestion 
                  ? 'La fórmula de costo promedio ponderado ha calculado los siguientes costos sugeridos para cada producto:'
                  : 'La fórmula de costo promedio ponderado ha calculado los siguientes costos sugeridos para esta entrada:'}
              </Text>

              {isMultipleCostSuggestion ? (
                  // Modo múltiple: mostrar lista de productos con costos lado a lado
                  multipleCurrentCosts.map((currentCost, index) => {
                    const suggestedCost = multipleSuggestedCosts[index];
                    return (
                      <View key={currentCost.id} style={[styles.productCostCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.productCostTitle, { color: colors.onSurface }]}>
                          {currentCost.productoNombre}
                        </Text>
                        
                        {/* Fila CUP: Actual vs Sugerido */}
                        <View style={styles.costComparisonRow}>
                          <View style={[styles.costComparisonHalf, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                            <Text style={[styles.costComparisonHalfTitle, { color: colors.onSurface }]}>
                              CUP Actual
                            </Text>
                            <Text style={[styles.costComparisonHalfValue, { color: colors.onSurface }]}>
                              ${currentCost.costo_cup?.toFixed(2) || '0.00'}
                            </Text>
                          </View>
                          <View style={[styles.costComparisonHalf, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                            <Text style={[styles.costComparisonHalfTitle, { color: '#fff' }]}>
                              CUP Sugerido
                            </Text>
                            <Text style={[styles.costComparisonHalfValue, { color: '#fff' }]}>
                              ${suggestedCost.costo_cup?.toFixed(2) || '0.00'}
                            </Text>
                          </View>
                        </View>

                        {/* Fila USD: Actual vs Sugerido */}
                        <View style={styles.costComparisonRow}>
                          <View style={[styles.costComparisonHalf, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                            <Text style={[styles.costComparisonHalfTitle, { color: colors.onSurface }]}>
                              USD Actual
                            </Text>
                            <Text style={[styles.costComparisonHalfValue, { color: colors.onSurface }]}>
                              ${currentCost.costo_usd?.toFixed(2) || '0.00'}
                            </Text>
                          </View>
                          <View style={[styles.costComparisonHalf, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                            <Text style={[styles.costComparisonHalfTitle, { color: '#fff' }]}>
                              USD Sugerido
                            </Text>
                            <Text style={[styles.costComparisonHalfValue, { color: '#fff' }]}>
                              ${suggestedCost.costo_usd?.toFixed(2) || '0.00'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : null}

                {!isMultipleCostSuggestion && (
                  <View>
                    {/* Fila CUP: Actual vs Sugerido */}
                    <View style={styles.costComparisonRow}>
                      <View style={[styles.costComparisonHalf, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.costComparisonHalfTitle, { color: colors.onSurface }]}>
                          CUP Actual
                        </Text>
                        <Text style={[styles.costComparisonHalfValue, { color: colors.onSurface }]}>
                          ${currentCosts?.costo_cup?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                      <View style={[styles.costComparisonHalf, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Text style={[styles.costComparisonHalfTitle, { color: '#fff' }]}>
                          CUP Sugerido
                        </Text>
                        <Text style={[styles.costComparisonHalfValue, { color: '#fff' }]}>
                          ${suggestedCosts?.costo_cup?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                    </View>

                    {/* Fila USD: Actual vs Sugerido */}
                    <View style={styles.costComparisonRow}>
                      <View style={[styles.costComparisonHalf, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.costComparisonHalfTitle, { color: colors.onSurface }]}>
                          USD Actual
                        </Text>
                        <Text style={[styles.costComparisonHalfValue, { color: colors.onSurface }]}>
                          ${currentCosts?.costo_usd?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                      <View style={[styles.costComparisonHalf, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Text style={[styles.costComparisonHalfTitle, { color: '#fff' }]}>
                          USD Sugerido
                        </Text>
                        <Text style={[styles.costComparisonHalfValue, { color: '#fff' }]}>
                          ${suggestedCosts?.costo_usd?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => isMultipleCostSuggestion ? handleKeepCurrentCostsMultiple() : handleKeepCurrentCosts()}
              >
                <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>
                  Mantener Costos Actuales
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={() => isMultipleCostSuggestion ? handleUseSuggestedCostsMultiple() : handleUseSuggestedCosts()}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Usar Costos Sugeridos
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Retiro Automático */}
      <Modal
        visible={showWithdrawModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.smallModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Retiro Automático
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalMessage, { color: colors.onSurface }]}>
                ¿Desea hacer una operación de retiro de una cuenta relacionada a la tienda por esta entrada?
              </Text>
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowWithdrawModal(false);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Entradas' }],
                  });
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>
                  No
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowWithdrawModal(false);
                  navigation.navigate('OperacionForm', {
                    mode: 'add',
                    tiendaId: withdrawModalData.tiendaId,
                    cuentas: withdrawModalData.cuentas,
                    defaultMotivo: withdrawModalData.defaultMotivo,
                    defaultTipo: withdrawModalData.defaultTipo,
                    defaultCantidadCup: withdrawModalData.defaultCantidadCup,
                    defaultCantidadUsd: withdrawModalData.defaultCantidadUsd,
                    fromEntrada: true
                  });
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Sí
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Costos de Fabricación */}
      <Modal
        visible={showFabricacionCostModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFabricacionCostModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Costo de Fabricación
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFabricacionCostModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              <Text style={[styles.infoText, { color: colors.outline, marginBottom: responsive.responsiveMargin(16) }]}>
                ¿Desea modificar el precio de costo del producto en todo el sistema?
              </Text>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary, { backgroundColor: modifyProductPrice ? colors.surface : colors.primary, borderColor: modifyProductPrice ? colors.outlineVariant : colors.primary, flex: 1 }]}
                  onPress={() => setModifyProductPrice(false)}
                >
                  <Text style={[styles.modalButtonText, { color: modifyProductPrice ? colors.onSurface : '#fff' }]}>
                    No
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: modifyProductPrice ? colors.primary : colors.surface, borderColor: modifyProductPrice ? colors.primary : colors.outlineVariant, flex: 1 }]}
                  onPress={() => setModifyProductPrice(true)}
                >
                  <Text style={[styles.modalButtonText, { color: modifyProductPrice ? '#fff' : colors.onSurface }]}>
                    Sí
                  </Text>
                </TouchableOpacity>
              </View>

              {modifyProductPrice !== null && (
                <>
                  <Text style={[styles.infoText, { color: colors.outline, marginTop: responsive.responsiveMargin(20), marginBottom: responsive.responsiveMargin(16) }]}>
                    ¿Qué costo desea usar para esta entrada?
                  </Text>

                  <TouchableOpacity
                    style={[styles.costOptionButton, { backgroundColor: colors.background, borderColor: fabricacionCostOption === 'sumatoria' ? colors.primary : colors.outlineVariant }]}
                    onPress={() => setFabricacionCostOption('sumatoria')}
                  >
                    <View style={styles.costOptionRadio}>
                      <View style={[styles.costOptionRadioDot, fabricacionCostOption === 'sumatoria' && styles.costOptionRadioDotActive]} />
                    </View>
                    <Text style={[styles.costOptionText, { color: colors.onSurface }]}>
                      Nuevo precio basado en sumatoria de insumos
                    </Text>
                  </TouchableOpacity>

                  {fabricacionCostOption === 'sumatoria' && (
                    <View style={[styles.costPreviewCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.costPreviewTitle, { color: colors.onSurface }]}>
                        Costo calculado (sumatoria de insumos)
                      </Text>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo CUP:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
                            let costoTotalCup = 0;
                            validFabricaciones.forEach(f => {
                              costoTotalCup += (parseFloat(f.cantidad_insumo) || 0) * (parseFloat(f.costo_insumo_cup) || 0);
                            });
                            const cantidadProducida = parseFloat(formData.cantidad_entrada) || 1;
                            const costoPorUnidad = cantidadProducida > 0 ? costoTotalCup / cantidadProducida : 0;
                            return costoPorUnidad.toFixed(2);
                          })()}
                        </Text>
                      </View>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo USD:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
                            let costoTotalUsd = 0;
                            validFabricaciones.forEach(f => {
                              costoTotalUsd += (parseFloat(f.cantidad_insumo) || 0) * (parseFloat(f.costo_insumo_usd) || 0);
                            });
                            const cantidadProducida = parseFloat(formData.cantidad_entrada) || 1;
                            const costoPorUnidad = cantidadProducida > 0 ? costoTotalUsd / cantidadProducida : 0;
                            return costoPorUnidad.toFixed(2);
                          })()}
                        </Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.costOptionButton, { backgroundColor: colors.background, borderColor: fabricacionCostOption === 'actual' ? colors.primary : colors.outlineVariant }]}
                    onPress={() => setFabricacionCostOption('actual')}
                  >
                    <View style={styles.costOptionRadio}>
                      <View style={[styles.costOptionRadioDot, fabricacionCostOption === 'actual' && styles.costOptionRadioDotActive]} />
                    </View>
                    <Text style={[styles.costOptionText, { color: colors.onSurface }]}>
                      Mantener precio actual del producto
                    </Text>
                  </TouchableOpacity>

                  {fabricacionCostOption === 'actual' && (
                    <View style={[styles.costPreviewCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.costPreviewTitle, { color: colors.onSurface }]}>
                        Costo actual del producto
                      </Text>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo CUP:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            const productoTiendaCosto = formData.producto?.tiendas_servicio?.find(
                              ts => ts.id_tienda === formData.tienda?.id_tienda
                            );
                            const costo = parseFloat(productoTiendaCosto?.costo_cup) || 0;
                            return costo.toFixed(2);
                          })()}
                        </Text>
                      </View>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo USD:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            const productoTiendaCosto = formData.producto?.tiendas_servicio?.find(
                              ts => ts.id_tienda === formData.tienda?.id_tienda
                            );
                            const costo = parseFloat(productoTiendaCosto?.costo_usd) || 0;
                            return costo.toFixed(2);
                          })()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {config.applyWeightedAverageCost && (
                    <TouchableOpacity
                      style={[styles.costOptionButton, { backgroundColor: colors.background, borderColor: fabricacionCostOption === 'formula' ? colors.primary : colors.outlineVariant }]}
                      onPress={() => setFabricacionCostOption('formula')}
                    >
                      <View style={styles.costOptionRadio}>
                        <View style={[styles.costOptionRadioDot, fabricacionCostOption === 'formula' && styles.costOptionRadioDotActive]} />
                      </View>
                      <Text style={[styles.costOptionText, { color: colors.onSurface }]}>
                        Aplicar fórmula de costo promedio ponderado
                      </Text>
                    </TouchableOpacity>
                  )}

                  {fabricacionCostOption === 'formula' && (
                    <View style={[styles.costPreviewCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.costPreviewTitle, { color: colors.onSurface }]}>
                        Costo calculado (fórmula de costo promedio ponderado)
                      </Text>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo CUP:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            // Calcular costo de insumos (sumatoria)
                            const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
                            let costoTotalInsumosCup = 0;
                            validFabricaciones.forEach(f => {
                              costoTotalInsumosCup += (parseFloat(f.cantidad_insumo) || 0) * (parseFloat(f.costo_insumo_cup) || 0);
                            });
                            const cantidadProducida = parseFloat(formData.cantidad_entrada) || 1;
                            const costoPorUnidadCupSumatoria = cantidadProducida > 0 ? costoTotalInsumosCup / cantidadProducida : 0;

                            // Calcular costo promedio ponderado (simulado)
                            // Nota: En modo preview no podemos obtener las entradas reales del backend
                            // Así que mostramos el costo de sumatoria como referencia
                            return costoPorUnidadCupSumatoria.toFixed(2);
                          })()}
                        </Text>
                      </View>
                      <View style={styles.costPreviewRow}>
                        <Text style={[styles.costPreviewLabel, { color: colors.outline }]}>Costo USD:</Text>
                        <Text style={[styles.costPreviewValue, { color: colors.onSurface }]}>
                          ${(() => {
                            // Calcular costo de insumos (sumatoria)
                            const validFabricaciones = fabricaciones.filter(f => f.producto !== null);
                            let costoTotalInsumosUsd = 0;
                            validFabricaciones.forEach(f => {
                              costoTotalInsumosUsd += (parseFloat(f.cantidad_insumo) || 0) * (parseFloat(f.costo_insumo_usd) || 0);
                            });
                            const cantidadProducida = parseFloat(formData.cantidad_entrada) || 1;
                            const costoPorUnidadUsdSumatoria = cantidadProducida > 0 ? costoTotalInsumosUsd / cantidadProducida : 0;

                            // Calcular costo promedio ponderado (simulado)
                            // Nota: En modo preview no podemos obtener las entradas reales del backend
                            // Así que mostramos el costo de sumatoria como referencia
                            return costoPorUnidadUsdSumatoria.toFixed(2);
                          })()}
                        </Text>
                      </View>
                      <Text style={[styles.costPreviewNote, { color: colors.outline, marginTop: responsive.responsiveMargin(8), fontSize: responsive.responsiveFontSize(12) }]}>
                        * El costo final se calculará al guardar usando todas las entradas del producto
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.costOptionButton, { backgroundColor: colors.background, borderColor: fabricacionCostOption === 'manual' ? colors.primary : colors.outlineVariant }]}
                    onPress={() => setFabricacionCostOption('manual')}
                  >
                    <View style={styles.costOptionRadio}>
                      <View style={[styles.costOptionRadioDot, fabricacionCostOption === 'manual' && styles.costOptionRadioDotActive]} />
                    </View>
                    <Text style={[styles.costOptionText, { color: colors.onSurface }]}>
                      Colocar manualmente el precio
                    </Text>
                  </TouchableOpacity>

                  {fabricacionCostOption === 'manual' && (
                    <View style={styles.manualCostContainer}>
                      <View style={styles.formRow}>
                        <View style={[styles.formColumn, styles.formGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Costo CUP"
                            value={fabricacionManualCostCup}
                            onChangeText={setFabricacionManualCostCup}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <View style={[styles.formColumn, styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Costo USD *</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Costo USD"
                            value={fabricacionManualCostUsd}
                            onChangeText={setFabricacionManualCostUsd}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowFabricacionCostModal(false);
                  setModifyProductPrice(false);
                  setFabricacionCostOption(null);
                  setFabricacionManualCostCup('');
                  setFabricacionManualCostUsd('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (!fabricacionCostOption) {
                    showToast({ type: 'warning', message: 'Debe seleccionar una opción de costo' });
                    return;
                  }
                  if (fabricacionCostOption === 'manual' && (!fabricacionManualCostCup || !fabricacionManualCostUsd)) {
                    showToast({ type: 'warning', message: 'Debe ingresar ambos costos manuales' });
                    return;
                  }
                  setShowFabricacionCostModal(false);
                  executeSaveFabricacion();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Procesamiento */}
      <Modal
        visible={isSaving}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={[styles.processingModalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.processingModalContent, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingModalText, { color: colors.onSurface }]}>
              {isMultipleMode ? 'Procesando entradas múltiples...' : isFabricacionMode ? 'Procesando entrada de fabricación...' : 'Procesando entrada...'}
            </Text>
            <Text style={[styles.processingModalSubtext, { color: colors.outline }]}>
              Por favor espere, esto puede tomar unos segundos
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export const EntradaFormScreen = () => <EntradaFormContent />;

const createStyles = (responsive) => StyleSheet.create({
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
    padding: responsive.responsivePadding(24),
    marginBottom: responsive.responsiveMargin(16),
  },
  expirationAlertCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(55),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  expirationAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
  },
  expirationAlertText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    minHeight: responsive.responsiveHeight(50),
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    height: responsive.responsiveHeight(50),
    justifyContent: 'center',
  },
  inputInner: {
    paddingHorizontal: responsive.responsivePadding(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    height: responsive.responsiveHeight(50),
  },
  inputText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  formColumn: {
    flex: 1,
  },
  formColumn60: {
    flex: 0.6,
  },
  formColumn40: {
    flex: 0.4,
  },
  relativeContainer: {
    position: 'relative',
    width: '100%',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    minHeight: responsive.responsiveHeight(50),
  },
  dropdownText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(8),
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(150),
  },
  searchDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    padding: responsive.responsivePadding(8),
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(8),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.responsiveFontSize(16),
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
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: responsive.responsiveHeight(50),
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
  },
  infoText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  cantidadInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(8),
  },
  cantidadInfoLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  cantidadOval: {
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
  },
  cantidadOvalText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  financialInfoSection: {
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    borderWidth: 1,
    marginTop: responsive.responsiveMargin(16),
  },
  financialInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  financialInfoDivider: {
    height: 1,
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoColumn: {
    flex: 1,
  },
  financialInfoLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  financialInfoValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  profitBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
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
    maxWidth: responsive.responsiveWidth(500),
    borderRadius: 16,
    minHeight: responsive.responsiveHeight(400),
    maxHeight: responsive.responsiveHeight(600),
    overflow: 'hidden',
    flexDirection: 'column',
  },
  smallModalContent: {
    width: '100%',
    maxWidth: responsive.responsiveWidth(400),
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalBody: {
    padding: responsive.responsivePadding(20),
  },
  modalMessage: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    lineHeight: responsive.responsiveFontSize(24),
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: responsive.responsivePadding(8),
  },
  modalSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    margin: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  modalSearchInputText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  modalList: {
    flex: 1,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(16),
  },
  modalListContent: {
    paddingBottom: responsive.responsivePadding(24),
  },
  modalListItem: {
    paddingVertical: responsive.responsivePadding(14),
    borderBottomWidth: 1,
  },
  modalListItemText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  modalEmptyState: {
    paddingVertical: responsive.responsivePadding(40),
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  modeSwitchContainer: {
    marginBottom: responsive.responsiveMargin(24),
  },
  modeSwitchTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
    textAlign: 'center',
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: responsive.responsivePadding(4),
  },
  modeSwitchButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 6,
    alignItems: 'center',
  },
  modeSwitchButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeSwitchButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  multipleEntradaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
  },
  multipleEntradaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  multipleEntradaTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  removeButton: {
    padding: responsive.responsivePadding(4),
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    borderWidth: 1,
    marginTop: responsive.responsiveMargin(16),
  },
  addProductButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productCountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(12),
  },
  productCountInfoText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  stockInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(8),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(8),
  },
  stockInfoText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  costOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  costOptionRadio: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveWidth(20),
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  costOptionRadioDot: {
    width: responsive.responsiveWidth(10),
    height: responsive.responsiveWidth(10),
    borderRadius: 5,
  },
  costOptionRadioDotActive: {
    backgroundColor: '#002440',
  },
  costOptionText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    flex: 1,
  },
  manualCostContainer: {
    marginTop: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  costPreviewCard: {
    marginTop: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    borderWidth: 1,
  },
  costPreviewTitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  costPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  costPreviewLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  costPreviewValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  costPreviewNote: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  costComparisonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
  },
  costComparisonRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  costComparisonHalf: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: responsive.responsivePadding(12),
    alignItems: 'center',
  },
  costComparisonHalfTitle: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  costComparisonHalfValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  productCostCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
  },
  productCostTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  costComparisonTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  costLabel: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  costValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderTopWidth: 1,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    borderWidth: 1,
  },
  modalButtonPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  processingModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModalContent: {
    padding: responsive.responsivePadding(32),
    borderRadius: 16,
    alignItems: 'center',
    minWidth: responsive.responsiveWidth(280),
  },
  processingModalText: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  processingModalSubtext: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(8),
    textAlign: 'center',
  },
});
