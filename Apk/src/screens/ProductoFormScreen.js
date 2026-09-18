import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform, FlatList, ToastAndroid } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { createProducto, updateProducto, getProductoById } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import { getApiBaseUrl } from '../services/api';
import configService from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { comprimirImagen, uriToBase64 } from '../utils/imageUtils';
import BarcodeEngine from '../barcode/BarcodeEngine';
import { ALLOWED_BARCODE_TYPES } from '../barcode/config/BarcodeTypes';

const ProductoFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, entradaManagePermissions, salidaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  
  // Initialize Barcode Engine
  const barcodeEngineRef = useRef(null);
  // Track if this is the first time the screen is focused (to avoid double API calls on initial load)
  const isFirstFocus = useRef(true);

  const { producto, mode, tiendaPreSeleccionada, returnToEntrada, entradaData } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || (isViewMode && !canEditProduct);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingProducto, setIsFetchingProducto] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [editingTiendaIndex, setEditingTiendaIndex] = useState(null);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const [permission, setPermission] = useState(null);
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  const [priceInputTexts, setPriceInputTexts] = useState({});
  const [generalPriceInputTexts, setGeneralPriceInputTexts] = useState({});
  
  const [formData, setFormData] = useState({
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || '',
    esvendible: producto?.esvendible !== undefined ? producto.esvendible : true,
    nota: producto?.nota || '',
    imagen: producto?.producto?.imagen || '',
    sufijo: producto?.producto?.sufijo || '',
    isVencible: producto?.producto?.isVencible !== undefined ? producto.producto.isVencible : false,
    unidad_medida: producto?.producto?.unidad_medida || '',
    productoTiendaList: producto?.tiendas_servicio || [],
    codigoList: producto?.codigos || [],
    precio_cup_general: null,
    precio_usd_general: null,
    costo_cup_general: null,
    costo_usd_general: null,
  });

  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);
  const [isStockExpanded, setIsStockExpanded] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAddEntradaModal, setShowAddEntradaModal] = useState(false);
  const [createdProducto, setCreatedProducto] = useState(null);
  const [showExpirationAlert, setShowExpirationAlert] = useState(false);
  const [expirationAlertData, setExpirationAlertData] = useState(null);

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

  useEffect(() => {
    if (formData.codigoList.length > 0) {
      setIsCodesExpanded(true);
    }
    if (formData.productoTiendaList.length > 0) {
      setIsPricesExpanded(true);
    }
  }, [formData.codigoList.length, formData.productoTiendaList.length]);

  // Initialize Barcode Engine
  useEffect(() => {
    barcodeEngineRef.current = new BarcodeEngine('PRODUCT_CREATION');
    
    // Set business rules callback to check for duplicate codes
    barcodeEngineRef.current.setBusinessRulesCallback(async ({ code, type }) => {
      const codeExists = formData.codigoList.some(
        codigo => codigo.codigo_barras_ean.trim().toLowerCase() === code.trim().toLowerCase()
      );
      
      if (codeExists) {
        return { valid: false, details: 'Este código ya está registrado para este producto' };
      }
      
      return { valid: true, details: 'Código único para producto' };
    });
    
    // Start session when component mounts
    barcodeEngineRef.current.startSession();
    
    return () => {
      if (barcodeEngineRef.current) {
        barcodeEngineRef.current.resetSession();
      }
    };
  }, [formData.codigoList]);

  useEffect(() => {
    // Check if any visible store has stock > 0
    const hasStockInVisibleStores = formData.productoTiendaList.some((tiendaProducto) => {
      const tienda = tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda);
      if (!tienda || !tienda.activo) return false;
      
      const userRole = user?.rol?.toLowerCase();
      const canViewThisStore = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico) ||
        (user?.id_tienda === tienda.id_tienda);
      
      if (!canViewThisStore) return false;
      
      return tiendaProducto.cantidad !== null && 
             tiendaProducto.cantidad !== undefined && 
             parseFloat(tiendaProducto.cantidad) > 0;
    });

    setIsStockExpanded(hasStockInVisibleStores);
  }, [formData.productoTiendaList, tiendas, user, permissions]);

  const handleGeneralPriceBlur = () => {
    const hasAnyGeneralPrice = 
      (formData.precio_cup_general !== null && formData.precio_cup_general !== '') ||
      (formData.precio_usd_general !== null && formData.precio_usd_general !== '');

    if (hasAnyGeneralPrice && formData.productoTiendaList.length === 0) {
      const newProductoTiendaList = tiendas.filter(tienda => tienda.activo === true).map(tienda => {
        const precioCup = formData.precio_cup_general !== null && formData.precio_cup_general !== '' 
          ? (typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : (isNaN(parseFloat(formData.precio_cup_general)) ? 0 : parseFloat(formData.precio_cup_general)))
          : 0;
        const precioUsd = formData.precio_usd_general !== null && formData.precio_usd_general !== '' 
          ? (typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : (isNaN(parseFloat(formData.precio_usd_general)) ? 0 : parseFloat(formData.precio_usd_general)))
          : 0;
        const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : (isNaN(parseFloat(formData.costo_cup_general)) ? 0 : parseFloat(formData.costo_cup_general))) : 0;
        const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : (isNaN(parseFloat(formData.costo_usd_general)) ? 0 : parseFloat(formData.costo_usd_general))) : 0;
        
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
        productoTiendaList: newProductoTiendaList
      }));
      setIsPricesExpanded(true);
    } else if (hasAnyGeneralPrice && formData.productoTiendaList.length > 0) {
      const precioCup = formData.precio_cup_general !== null && formData.precio_cup_general !== ''
        ? (typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : (isNaN(parseFloat(formData.precio_cup_general)) ? 0 : parseFloat(formData.precio_cup_general)))
        : null;
      const precioUsd = formData.precio_usd_general !== null && formData.precio_usd_general !== ''
        ? (typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : (isNaN(parseFloat(formData.precio_usd_general)) ? 0 : parseFloat(formData.precio_usd_general)))
        : null;
      const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : (isNaN(parseFloat(formData.costo_cup_general)) ? 0 : parseFloat(formData.costo_cup_general))) : 0;
      const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : (isNaN(parseFloat(formData.costo_usd_general)) ? 0 : parseFloat(formData.costo_usd_general))) : 0;
      
      const activeTiendaIds = [];
      if (tiendas && tiendas.length > 0) {
        activeTiendaIds = tiendas.filter(tienda => tienda.activo === true).map(tienda => tienda.id_tienda);
      } else {
        activeTiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
      }
      
      const existingTiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
      
      const missingTiendaIds = activeTiendaIds.filter(id => !existingTiendaIds.includes(id));
      
      const newTiendaEntries = missingTiendaIds.map(id_tienda => ({
        id_tienda,
        precio_cup: precioCup !== null ? precioCup : 0,
        precio_usd: precioUsd !== null ? precioUsd : 0,
        costo_cup: costoCup,
        costo_usd: costoUsd,
      }));
      
      setFormData(prev => ({
        ...prev,
        productoTiendaList: [
          ...prev.productoTiendaList.map(item => ({
            ...item,
            ...(precioCup !== null && { precio_cup: precioCup }),
            ...(precioUsd !== null && { precio_usd: precioUsd }),
            costo_cup: costoCup,
            costo_usd: costoUsd,
          })),
          ...newTiendaEntries
        ]
      }));
      
      setIsPricesExpanded(true);
    }
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const userRole = user?.rol?.toLowerCase();
  const isAdmin = userRole === 'administrador';
  const isEconomico = userRole === 'económico';
  const isDependiente = userRole === 'dependiente';
  const isAlmacenero = userRole === 'almacenero';
  
  const canEditProduct = isAdmin;
  const canEditCodes = isAdmin;
  const canViewCosts = !isDependiente && !isAlmacenero;

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
    loadApiBaseUrl();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
    })();
  }, []);

  // Verificar si se abrió desde alerta de vencimiento o si el producto tiene entradas próximas a vencer
  useEffect(() => {
    const checkExpirationAlert = async () => {
      try {
        const fromAlert = await AsyncStorage.getItem('from_expiration_alert');
        const productoId = await AsyncStorage.getItem('expiration_alert_producto_id');
        
        // Verificar si se abrió desde alerta
        if (fromAlert === 'true' && productoId && producto?.id_servicio?.toString() === productoId) {
          // Limpiar el AsyncStorage
          await AsyncStorage.removeItem('from_expiration_alert');
          await AsyncStorage.removeItem('expiration_alert_producto_id');
          await AsyncStorage.removeItem('expiration_alert_entrada_id');
          
          // Verificar si realmente hay entradas próximas a vencer antes de mostrar la alerta
          if (producto?.id_servicio && !isOfflineMode) {
            const hoy = new Date();
            const fechaMaxima = new Date(hoy);
            fechaMaxima.setDate(fechaMaxima.getDate() + 30);
            const fechaMaximaStr = fechaMaxima.toISOString().split('T')[0];
            
            const { getEntradas } = require('../services/entradaService');
            const response = await getEntradas({ 
              id_servicio: producto.id_servicio,
              fecha_vencimiento_hasta: fechaMaximaStr 
            }, 1, 100);
            
            if (response.data && response.data.length > 0) {
              // Filtrar entradas para solo considerar las del producto actual
              const filteredEntries = response.data.filter(entrada => {
                const productoId = entrada.servicioTienda?.servicio?.id_servicio;
                return productoId === producto.id_servicio;
              });
              
              const hasExpiringEntries = filteredEntries.some(entrada => {
                if (!entrada.fecha || !entrada.fecha_vencimiento || entrada.cantidad_restante <= 0) {
                  return false;
                }
                const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
                return alerta.level === 'critical' || alerta.level === 'warning' || alerta.level === 'expired';
              });
              
              if (hasExpiringEntries) {
                setShowExpirationAlert(true);
                setExpirationAlertData({
                  productoId: producto.id_servicio,
                  message: 'Este producto tiene entradas próximas a vencer'
                });
              } else {
                setShowExpirationAlert(false);
                setExpirationAlertData(null);
              }
            } else {
              setShowExpirationAlert(false);
              setExpirationAlertData(null);
            }
          }
        } else if (producto?.id_servicio && !isOfflineMode) {
          const hoy = new Date();
          const fechaMaxima = new Date(hoy);
          fechaMaxima.setDate(fechaMaxima.getDate() + 30);
          const fechaMaximaStr = fechaMaxima.toISOString().split('T')[0];
          
          const { getEntradas } = require('../services/entradaService');
          const response = await getEntradas({ 
            id_servicio: producto.id_servicio,
            fecha_vencimiento_hasta: fechaMaximaStr 
          }, 1, 100);
          
          if (response.data && response.data.length > 0) {
            // Filtrar entradas para solo considerar las del producto actual
            const filteredEntries = response.data.filter(entrada => {
              const productoId = entrada.servicioTienda?.servicio?.id_servicio;
              return productoId === producto.id_servicio;
            });
            
            const hasExpiringEntries = filteredEntries.some(entrada => {
              if (!entrada.fecha || !entrada.fecha_vencimiento || entrada.cantidad_restante <= 0) {
                return false;
              }
              const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
              return alerta.level === 'critical' || alerta.level === 'warning' || alerta.level === 'expired';
            });
            
            if (hasExpiringEntries) {
              setShowExpirationAlert(true);
              setExpirationAlertData({
                productoId: producto.id_servicio,
                message: 'Este producto tiene entradas próximas a vencer'
              });
            } else {
              setShowExpirationAlert(false);
              setExpirationAlertData(null);
            }
          } else {
            setShowExpirationAlert(false);
            setExpirationAlertData(null);
          }
        } else {
          setShowExpirationAlert(false);
          setExpirationAlertData(null);
        }
      } catch (error) {
        setShowExpirationAlert(false);
        setExpirationAlertData(null);
      }
    };
    
    checkExpirationAlert();
  }, [producto?.id_servicio]);

  const loadApiBaseUrl = async () => {
    const baseUrl = await getApiBaseUrl();
    setApiBaseUrl(baseUrl);
  };

  useEffect(() => {
    const fetchCompleteProducto = async () => {
      if (producto?.id_servicio) {
        try {
          setIsFetchingProducto(true);
          
          let completeProducto;
          
          if (isOfflineMode) {
            // Cargar desde AsyncStorage en modo offline
            const cachedProducto = await AsyncStorage.getItem(`producto_${producto.id_servicio}`);
            if (cachedProducto) {
              completeProducto = JSON.parse(cachedProducto);
              showToast({ 
                type: 'info', 
                message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
                duration: 4000 
              });
            } else {
              completeProducto = producto;
              showToast({ 
                type: 'warning', 
                message: 'Producto no encontrado en caché. Conéctese al servidor.',
                duration: 4000 
              });
            }
          } else {
            completeProducto = await getProductoById(producto.id_servicio);
            // Guardar en AsyncStorage para modo offline
            await AsyncStorage.setItem(`producto_${producto.id_servicio}`, JSON.stringify(completeProducto));
          }
          
          const userRole = user?.rol?.toLowerCase();
          const canViewAllStores = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && permissions?.dependiente) ||
            (userRole === 'almacenero' && permissions?.almacenero) ||
            (userRole === 'económico' && permissions?.economico);

          let productoTiendaList = completeProducto.tiendas_servicio || [];
          
          if (!canViewAllStores && user?.id_tienda) {
            productoTiendaList = productoTiendaList.filter(ts => ts.id_tienda === user.id_tienda);
          }
          
          // Extract cost from first tienda (all tiendas should have the same cost now)
          const firstTienda = productoTiendaList[0];
          const costoCupGeneral = firstTienda?.costo_cup || null;
          const costoUsdGeneral = firstTienda?.costo_usd || null;
          
          setFormData({
            nombre: completeProducto.nombre || '',
            categoria: completeProducto.categoria || '',
            esvendible: completeProducto.esvendible !== undefined ? completeProducto.esvendible : true,
            nota: completeProducto.nota || '',
            imagen: completeProducto.producto?.imagen || '',
            sufijo: completeProducto.producto?.sufijo || '',
            isVencible: completeProducto.producto?.isVencible !== undefined ? completeProducto.producto.isVencible : true,
            unidad_medida: completeProducto.producto?.unidad_medida || '',
            productoTiendaList: productoTiendaList,
            codigoList: completeProducto.codigos || [],
            precio_cup_general: null,
            precio_usd_general: null,
            costo_cup_general: costoCupGeneral,
            costo_usd_general: costoUsdGeneral,
          });
        } catch (err) {
          showToast({ type: 'error', message: 'Error al cargar datos del producto' });
        } finally {
          setIsFetchingProducto(false);
        }
      }
    };

    fetchCompleteProducto();
  }, [producto?.id_servicio, canViewCosts, user?.id_tienda, permissions, isOfflineMode]);

  // Refresh product data when screen regains focus (e.g., after returning from EntradaForm)
  // Only refresh in view mode to avoid overwriting unsaved changes in edit/add mode
  useFocusEffect(
    React.useCallback(() => {
      const refreshProductoData = async () => {
        // Skip the first focus to avoid duplicate API call on initial load
        if (isFirstFocus.current) {
          isFirstFocus.current = false;
          return;
        }

        // Don't refresh in edit or add mode to preserve unsaved changes
        if (isEditMode || isAddMode) {
          return;
        }

        if (producto?.id_servicio && !isOfflineMode) {
          try {
            setIsFetchingProducto(true);
            const completeProducto = await getProductoById(producto.id_servicio);
            
            const userRole = user?.rol?.toLowerCase();
            const canViewAllStores = 
              userRole === 'administrador' ||
              (userRole === 'dependiente' && permissions?.dependiente) ||
              (userRole === 'almacenero' && permissions?.almacenero) ||
              (userRole === 'económico' && permissions?.economico);

            let productoTiendaList = completeProducto.tiendas_servicio || [];
            
            if (!canViewAllStores && user?.id_tienda) {
              productoTiendaList = productoTiendaList.filter(ts => ts.id_tienda === user.id_tienda);
            }
            
            // Extract cost from first tienda (all tiendas should have the same cost now)
            const firstTienda = productoTiendaList[0];
            const costoCupGeneral = firstTienda?.costo_cup || null;
            const costoUsdGeneral = firstTienda?.costo_usd || null;
            
            setFormData({
              nombre: completeProducto.nombre || '',
              categoria: completeProducto.categoria || '',
              esvendible: completeProducto.esvendible !== undefined ? completeProducto.esvendible : true,
              nota: completeProducto.nota || '',
              imagen: completeProducto.producto?.imagen || '',
              sufijo: completeProducto.producto?.sufijo || '',
              isVencible: completeProducto.producto?.isVencible !== undefined ? completeProducto.producto.isVencible : true,
              unidad_medida: completeProducto.producto?.unidad_medida || '',
              productoTiendaList: productoTiendaList,
              codigoList: completeProducto.codigos || [],
              precio_cup_general: null,
              precio_usd_general: null,
              costo_cup_general: costoCupGeneral,
              costo_usd_general: costoUsdGeneral,
            });
          } catch (err) {
            console.error('Error refreshing producto data:', err);
          } finally {
            setIsFetchingProducto(false);
          }
        }
      };

      refreshProductoData();
    }, [producto?.id_servicio, canViewCosts, user?.id_tienda, permissions, isOfflineMode, isEditMode, isAddMode])
  );

  // Efecto para agregar tienda pre-seleccionada cuando viene de EntradaForm
  useEffect(() => {
    if (tiendaPreSeleccionada && isEditMode) {
      setFormData(prev => {
        const tiendaExists = prev.productoTiendaList?.some(
          ts => ts.id_tienda === tiendaPreSeleccionada.id_tienda
        );

        if (!tiendaExists) {
          return {
            ...prev,
            productoTiendaList: [
              ...(prev.productoTiendaList || []),
              {
                id_tienda: tiendaPreSeleccionada.id_tienda,
                precio_cup: 0,
                precio_usd: 0,
                cantidad_alerta: null,
              }
            ]
          };
        }
        return prev;
      });
      setIsPricesExpanded(true);
    }
  }, [tiendaPreSeleccionada, isEditMode]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        // Cargar tiendas desde AsyncStorage en modo offline
        const cachedTiendas = await AsyncStorage.getItem('tiendas_list');
        if (cachedTiendas) {
          setTiendas(JSON.parse(cachedTiendas));
        } else {
          setTiendas([]);
        }
        return;
      }
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
      // Guardar tiendas en AsyncStorage para modo offline
      await AsyncStorage.setItem('tiendas_list', JSON.stringify(data.data || []));
    } catch (err) {
      // Error fetching tiendas
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
    if (!formData.sufijo.trim()) {
      showToast({ type: 'warning', message: 'El sufijo es requerido' });
      return;
    }
    if (formData.sufijo.length < 1 || formData.sufijo.length > 50) {
      showToast({ type: 'error', message: 'El sufijo debe tener entre 1 y 50 caracteres' });
      return;
    }
    if (!formData.codigoList || formData.codigoList.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un código' });
      return;
    }
    // Validate that there are no duplicate stores in productoTiendaList
    const tiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
    const uniqueTiendaIds = new Set(tiendaIds);
    if (tiendaIds.length !== uniqueTiendaIds.size) {
      showToast({ type: 'error', message: 'No se puede guardar: hay tiendas duplicadas en la lista de precios y costos' });
      return;
    }

    // Check if general prices are defined and update tiendas accordingly
    const hasAnyGeneralPrice = 
      (formData.precio_cup_general !== null && formData.precio_cup_general !== '') ||
      (formData.precio_usd_general !== null && formData.precio_usd_general !== '');

    if (hasAnyGeneralPrice && formData.productoTiendaList.length > 0) {
      const precioCup = formData.precio_cup_general !== null && formData.precio_cup_general !== ''
        ? (typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : (isNaN(parseFloat(formData.precio_cup_general)) ? 0 : parseFloat(formData.precio_cup_general)))
        : null;
      const precioUsd = formData.precio_usd_general !== null && formData.precio_usd_general !== ''
        ? (typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : (isNaN(parseFloat(formData.precio_usd_general)) ? 0 : parseFloat(formData.precio_usd_general)))
        : null;
      
      // Get all active tienda IDs - use tiendas if available, otherwise use existing tienda IDs
      let activeTiendaIds = [];
      if (tiendas && tiendas.length > 0) {
        activeTiendaIds = tiendas.filter(tienda => tienda.activo === true).map(tienda => tienda.id_tienda);
      } else {
        activeTiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
      }
      
      // Get existing tienda IDs from productoTiendaList
      const existingTiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
      
      // Find missing tienda IDs
      const missingTiendaIds = activeTiendaIds.filter(id => !existingTiendaIds.includes(id));
      
      // Create new entries for missing tiendas
      const newTiendaEntries = missingTiendaIds.map(id_tienda => ({
        id_tienda,
        precio_cup: precioCup !== null ? precioCup : 0,
        precio_usd: precioUsd !== null ? precioUsd : 0,
        costo_cup: formData.costo_cup_general || 0,
        costo_usd: formData.costo_usd_general || 0,
      }));
      
      // Update existing entries - only update prices that are defined
      formData.productoTiendaList = [
        ...formData.productoTiendaList.map(item => ({
          ...item,
          ...(precioCup !== null && { precio_cup: precioCup }),
          ...(precioUsd !== null && { precio_usd: precioUsd }),
          costo_cup: formData.costo_cup_general || 0,
          costo_usd: formData.costo_usd_general || 0,
        })),
        ...newTiendaEntries
      ];
    }

    try {
      setIsSaving(true);

      const dataToSend = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        esvendible: formData.esvendible,
        nota: formData.nota || null,
        sufijo: formData.sufijo,
        isVencible: formData.isVencible,
        unidad_medida: formData.unidad_medida || null,
        codigoList: formData.codigoList,
        productoTiendaList: (() => {
          const toFixed5 = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
          };

          let baseList = [];
          
          // If user has configured specific stores in productoTiendaList, only include those stores
          // This respects the user's decision to remove stores from the form
          if (formData.productoTiendaList.length > 0) {
            formData.productoTiendaList.forEach(specific => {
              if (specific.id_tienda === null) return;
              
              // Only include stores that have at least one price defined (not null and not 0)
              const precioCup = specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general);
              const precioUsd = specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general);
              
              // Skip if both prices are 0 or undefined
              if ((precioCup === 0 || precioCup === null || precioCup === undefined) && 
                  (precioUsd === 0 || precioUsd === null || precioUsd === undefined)) {
                return;
              }
              
              baseList.push({
                id_tienda: specific.id_tienda,
                precio_cup: precioCup,
                precio_usd: precioUsd,
              });
            });
          } 
          // If no specific stores configured but general prices exist, apply to all active stores
          else if (formData.precio_cup_general !== null || formData.precio_usd_general !== null) {
            const precioCupGeneral = toFixed5(formData.precio_cup_general);
            const precioUsdGeneral = toFixed5(formData.precio_usd_general);
            
            // Only apply general prices if at least one is defined and not 0
            if ((precioCupGeneral !== 0 && precioCupGeneral !== null && precioCupGeneral !== undefined) ||
                (precioUsdGeneral !== 0 && precioUsdGeneral !== null && precioUsdGeneral !== undefined)) {
              baseList = tiendas.filter(tienda => tienda.activo === true).map(tienda => ({
                id_tienda: tienda.id_tienda,
                precio_cup: precioCupGeneral,
                precio_usd: precioUsdGeneral,
              }));
            }
          }
          
          // Apply global cost fields to all stores
          const costoCup = toFixed5(formData.costo_cup_general);
          const costoUsd = toFixed5(formData.costo_usd_general);
          
          return baseList.map(item => ({
            ...item,
            costo_cup: costoCup,
            costo_usd: costoUsd,
          }));
        })(),
      };

      // Solo incluir imagen si tiene un valor
      if (formData.imagen && formData.imagen.trim() !== '') {
        dataToSend.imagen = formData.imagen;
      }

      if (isEditMode) {
        const updatedProduct = await updateProducto(producto.id_servicio, dataToSend);
        showToast({ type: 'success', message: 'Producto actualizado correctamente' });
        
        // Actualizar el caché en AsyncStorage con los datos actualizados
        if (!isOfflineMode) {
          await AsyncStorage.setItem(`producto_${producto.id_servicio}`, JSON.stringify(updatedProduct));
        }
        
        if (returnToEntrada) {
          navigation.navigate('EntradaForm', {
            mode: 'add',
            entradaData: entradaData
          });
        } else {
          navigation.goBack();
        }
      } else {
        const createdProduct = await createProducto(dataToSend);
        showToast({ type: 'success', message: 'Producto creado correctamente' });
        
        // Extract the actual product from the response
        const actualProduct = createdProduct?.data || createdProduct;
        
        // Check if user has entradaManagePermissions
        const userRole = user?.rol?.toLowerCase();
        const canManageEntradas = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
          (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
          (userRole === 'económico' && entradaManagePermissions?.economico);
        
        if (returnToEntrada) {
          navigation.navigate('EntradaForm', {
            mode: 'add',
            entradaData: entradaData
          });
        } else if (canManageEntradas && !isOfflineMode && config.showEntradaModalAfterProductCreation) {
          // Show modal asking if user wants to add an entrada
          setCreatedProducto(actualProduct);
          setShowAddEntradaModal(true);
        } else {
          navigation.goBack();
        }
      }
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
    if (!permission?.granted) {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para escanear códigos' });
        return;
      }
    }
    
    setShowScannerModal(true);
  };

  const handleOpenBarcodeScanner = () => {
    navigation.navigate('BarcodeScanner', {
      existingCodes: formData.codigoList,
      onCodeScanned: (scannedCodes) => {
        setFormData(prev => ({
          ...prev,
          codigoList: scannedCodes
        }));
        setIsCodesExpanded(true);
        showToast({ type: 'success', message: `${scannedCodes.length} códigos actualizados` });
      }
    });
  };

  const handleBarcodeScanned = async (scanningResult) => {
    if (!barcodeEngineRef.current) return;

    try {
      const result = await barcodeEngineRef.current.processScanningResult(scanningResult);
      
      if (!result) {
        // Still accumulating reads, wait for more
        return;
      }

      if (result.success) {
        setNewCodigo(result.code);
        setShowScannerModal(false);
        showToast({ 
          type: 'success', 
          message: `Código escaneado (${result.type}) - Confianza: ${result.confidenceScore && !isNaN(result.confidenceScore) ? (result.confidenceScore * 100).toFixed(0) : 'N/A'}%` 
        });
        
        // Reset session for next use
        barcodeEngineRef.current.startSession();
      } else {
        showToast({ 
          type: 'warning', 
          message: result.rejectionReason || 'Código no válido. Por favor vuelva a enfocar.' 
        });
        
        // Reset session to try again
        barcodeEngineRef.current.startSession();
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al procesar código' });
      barcodeEngineRef.current.resetSession();
      barcodeEngineRef.current.startSession();
    }
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

  const handleQuickSale = () => {
    // Check if user has a tienda assigned
    if (!user?.id_tienda) {
      showToast({ 
        type: 'error', 
        message: 'No tienes una tienda asignada. Contacta al administrador.' 
      });
      return;
    }

    // Find the user's tienda
    const userTienda = tiendas.find(t => t.id_tienda === user.id_tienda);
    if (!userTienda) {
      showToast({ 
        type: 'error', 
        message: 'No se encontró tu tienda asignada.' 
      });
      return;
    }

    // Check if product has stock in the user's tienda
    const tiendaProducto = formData.productoTiendaList.find(
      tp => tp.id_tienda === user.id_tienda
    );

    if (!tiendaProducto) {
      showToast({ 
        type: 'error', 
        message: `El producto "${producto?.nombre || 'producto'}" no está disponible en la tienda "${userTienda.nombre}".` 
      });
      return;
    }

    const stock = tiendaProducto.cantidad || 0;
    if (stock <= 0) {
      showToast({ 
        type: 'error', 
        message: `El producto "${producto?.nombre || 'producto'}" no tiene unidades en la tienda "${userTienda.nombre}". Primero debes realizar una entrada.` 
      });
      return;
    }

    // Navigate to SalesScreen with the product
    navigation.navigate('Sales', {
      preselectedProduct: producto
    });
  };

  const handleAddTiendaProducto = () => {
    // Get all active tienda IDs that are not already in the list
    const existingTiendaIds = formData.productoTiendaList.map(item => item.id_tienda).filter(id => id !== null);
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
      precio_cup: formData.precio_cup_general !== null && formData.precio_cup_general !== '' 
        ? (typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : (isNaN(parseFloat(formData.precio_cup_general)) ? 0 : parseFloat(formData.precio_cup_general)))
        : 0,
      precio_usd: formData.precio_usd_general !== null && formData.precio_usd_general !== '' 
        ? (typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : (isNaN(parseFloat(formData.precio_usd_general)) ? 0 : parseFloat(formData.precio_usd_general)))
        : 0,
    }));

    setFormData(prev => ({
      ...prev,
      productoTiendaList: [...prev.productoTiendaList, ...newTiendaEntries]
    }));
  };

  const handleRemoveTiendaProducto = (index) => {
    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.filter((_, i) => i !== index)
    }));
    setPriceInputTexts(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const k = parseInt(key);
        if (k < index) updated[k] = prev[k];
        else if (k > index) updated[k - 1] = prev[k];
      });
      return updated;
    });
  };

  const handleTiendaProductoChange = (index, field, value) => {
    // Prevent duplicate store selections
    if (field === 'id_tienda' && value !== null) {
      const isDuplicate = formData.productoTiendaList.some((item, i) => 
        i !== index && item.id_tienda === value
      );
      if (isDuplicate) {
        showToast({ type: 'warning', message: 'Esta tienda ya está seleccionada en la lista' });
        return;
      }
    }

    setFormData(prev => {
      const updatedList = prev.productoTiendaList.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Validate exchangeRate is a valid number greater than 0 before using it
          const validExchangeRate = exchangeRate && typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : null;
          
          if (validExchangeRate && field === 'precio_cup' && value !== null) {
            const cupValue = parseFloat(value) || 0;
            updatedItem.precio_usd = parseFloat((cupValue / validExchangeRate).toFixed(5));
          }
          
          if (validExchangeRate && field === 'precio_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.precio_cup = parseFloat((usdValue * validExchangeRate).toFixed(5));
          }
          
          return updatedItem;
        }
        return item;
      });
      
      return { ...prev, productoTiendaList: updatedList };
    });
  };

  const handleGeneralPriceChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Validate exchangeRate is a valid number greater than 0 before using it
      const validExchangeRate = exchangeRate && typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : null;
      
      if (validExchangeRate && field === 'precio_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.precio_usd_general = parseFloat((cupValue / validExchangeRate).toFixed(5));
      }
      
      if (validExchangeRate && field === 'costo_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.costo_usd_general = parseFloat((cupValue / validExchangeRate).toFixed(5));
      }
      
      if (validExchangeRate && field === 'precio_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.precio_cup_general = parseFloat((usdValue * validExchangeRate).toFixed(5));
      }
      
      if (validExchangeRate && field === 'costo_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.costo_cup_general = parseFloat((usdValue * validExchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  const handlePickImage = () => {
    setShowImagePickerModal(true);
  };

  const handlePickFromGallery = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso para acceder a la galería' });
        return;
      }

      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'photo',
        first: 50,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setMediaAssets(assets.assets);
      setGalleryModalVisible(true);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar la galería' });
    }
  };

  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    if (!permission?.granted) {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para tomar fotos' });
        return;
      }
    }
    setCameraModalVisible(true);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady) {
      showToast({ type: 'error', message: 'La cámara no está lista' });
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo && photo.base64) {
        setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${photo.base64}` }));
        setCameraModalVisible(false);
        showToast({ type: 'success', message: 'Foto tomada correctamente' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al tomar la foto' });
    }
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Eliminar Imagen',
      '¿Estás seguro de que quieres eliminar la imagen del producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({ ...prev, imagen: '' }));
            showToast({ type: 'success', message: 'Imagen eliminada' });
          },
        },
      ]
    );
  };

  // Gallery modal similar a historia_clinicaModal
  const GalleryModal = () => {
    if (!galleryModalVisible) return null;

    const handleSelect = async (asset) => {
      try {
        const compressedResult = await comprimirImagen(asset.uri);
        if (compressedResult && compressedResult.base64) {
          setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${compressedResult.base64}` }));
          ToastAndroid.show('Foto agregada', ToastAndroid.SHORT);
        } else {
          // Fallback a uriToBase64 si ImageManipulator no está disponible (Expo Go)
          const b = await uriToBase64(asset.uri);
          if (b) {
            setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${b}` }));
            ToastAndroid.show('Foto agregada (sin compresión - Expo Go)', ToastAndroid.SHORT);
          } else {
            Alert.alert('Error', 'No se pudo procesar la imagen');
            return;
          }
        }
      } catch (err) {
        console.error('Error seleccionando imagen:', err);
        
        // Verificar si es el error específico de ImageManipulator en Expo Go
        if (err.message && err.message.includes('Expo Go')) {
          ToastAndroid.show('Compresión no disponible en Expo Go. Usará conversión directa.', ToastAndroid.LONG);
          // Intentar fallback a uriToBase64
          const b = await uriToBase64(asset.uri);
          if (b) {
            setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${b}` }));
            ToastAndroid.show('Foto agregada', ToastAndroid.SHORT);
          } else {
            Alert.alert('Error', 'No se pudo procesar la imagen');
          }
        } else {
          Alert.alert('Error', 'No se pudo procesar la imagen: ' + err.message);
        }
      } finally {
        setGalleryModalVisible(false);
      }
    };

    return (
      <Modal visible={galleryModalVisible} transparent animationType="slide">
        <View style={styles.galleryOverlay}>
          <View style={styles.galleryHeader}>
            <TouchableOpacity onPress={() => setGalleryModalVisible(false)}>
              <Text style={styles.notaButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={mediaAssets}
            numColumns={4}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelect(item)} style={{ margin: 4 }}>
                <Image source={{ uri: item.uri }} style={styles.galleryThumb} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    );
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
        title={isViewMode ? 'Información del Producto' : isEditMode ? 'Editar Producto' : 'Agregar Producto'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
        keyboardVerticalOffset={responsive.headerHeight}
        enabled={true}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Action Buttons Section - For Admin and users with entradaManagePermissions or salidaManagePermissions */}
        {(() => {
          const userRole = user?.rol?.toLowerCase();
          const canManageEntradas = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
            (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
            (userRole === 'económico' && entradaManagePermissions?.economico);
          
          const canManageSalidas = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && salidaManagePermissions?.dependiente) ||
            (userRole === 'almacenero' && salidaManagePermissions?.almacenero) ||
            (userRole === 'económico' && salidaManagePermissions?.economico);
          
          if ((!canManageEntradas && !canManageSalidas) || !(isViewMode || isEditMode)) return null;
          
          return (
          <View style={[styles.actionButtonsSection, { backgroundColor: colors.surface }]}>
            <View style={styles.actionButtonsContainer}>
              {(() => {
                const userRole = user?.rol?.toLowerCase();
                const canManageEntradas = 
                  userRole === 'administrador' ||
                  (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
                  (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
                  (userRole === 'económico' && entradaManagePermissions?.economico);
                
                if (!canManageEntradas) return null;
                
                return (
                  <TouchableOpacity
                    style={[styles.iconActionButton, { backgroundColor: isDarkMode ? '#1B5E20' : '#E8F5E9' }]}
                    onPress={() => {
                      if (isOfflineMode) {
                        showToast({ type: 'warning', message: 'No disponible en modo offline' });
                        return;
                      }
                      navigation.navigate('EntradaForm', { mode: 'add', productoPreSeleccionado: producto });
                    }}
                  >
                    <Image 
                      source={require('../../assets/package-add.png')} 
                      style={{ width: responsive.responsiveWidth(24), height: responsive.responsiveWidth(24) }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={[styles.iconActionButton, { backgroundColor: isDarkMode ? '#0D47A1' : '#E3F2FD', opacity: 0.5 }]}
                onPress={() => {}}
                disabled={true}
              >
                <Image 
                  source={require('../../assets/moving.png')} 
                  style={{ width: responsive.responsiveWidth(24), height: responsive.responsiveWidth(24) }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              {(() => {
                const userRole = user?.rol?.toLowerCase();
                const canManageSalidas = 
                  userRole === 'administrador' ||
                  (userRole === 'dependiente' && salidaManagePermissions?.dependiente) ||
                  (userRole === 'almacenero' && salidaManagePermissions?.almacenero) ||
                  (userRole === 'económico' && salidaManagePermissions?.economico);
                
                if (!canManageSalidas) return null;
                
                return (
                  <TouchableOpacity
                    style={[styles.iconActionButton, { backgroundColor: isDarkMode ? '#B71C1C' : '#FFEBEE' }]}
                    onPress={() => {
                      if (isOfflineMode) {
                        showToast({ type: 'warning', message: 'No disponible en modo offline' });
                        return;
                      }
                      navigation.navigate('SalidaForm', { mode: 'add', productoPreSeleccionado: producto });
                    }}
                  >
                    <Image 
                      source={require('../../assets/box.png')} 
                      style={{ width: responsive.responsiveWidth(24), height: responsive.responsiveWidth(24) }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={[styles.iconActionButton, { backgroundColor: isDarkMode ? '#F57C00' : '#FFF3E0' }]}
                onPress={handleQuickSale}
              >
                <Image 
                  source={require('../../assets/sales.png')} 
                  style={{ width: responsive.responsiveWidth(24), height: responsive.responsiveWidth(24) }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconActionButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                onPress={() => setShowInfoModal(true)}
              >
                <Image 
                  source={require('../../assets/information.png')} 
                  style={{ width: responsive.responsiveWidth(24), height: responsive.responsiveWidth(24) }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
          );
        })()}

        {/* Alerta de Vencimiento */}
        {showExpirationAlert && (
          <Card style={[styles.expirationAlertCard, { backgroundColor: isDarkMode ? '#FFF3E0' : '#FFF3E0', borderColor: '#FF9800', borderWidth: 1 }]}>
            <View style={styles.expirationAlertContent}>
              <Ionicons name="warning" size={responsive.responsiveWidth(20)} color="#FF9800" />
              <Text style={[styles.expirationAlertText, { color: '#E65100' }]}>
                {expirationAlertData?.message || 'Este producto tiene entradas próximas a vencer'}
              </Text>
            </View>
          </Card>
        )}

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
              placeholder="Nombre del producto"
              value={formData.nombre}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
              editable={!isReadOnly}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
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

            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Código interno (Sufijo) *</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Sufijo del producto"
                value={formData.sufijo}
                onChangeText={(text) => setFormData(prev => ({ ...prev, sufijo: text }))}
                editable={!isReadOnly}
                textAlignVertical="center"
              />
            </View>
          </View>

          <View style={[styles.formRow, styles.imageFormRow]}>
            <View style={[styles.formGroup, styles.imageFormGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Imagen del Producto</Text>
              <View style={styles.imageContainer}>
                {formData.imagen ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ 
                        uri: formData.imagen.startsWith('data:') 
                          ? formData.imagen 
                          : (apiBaseUrl && formData.imagen.startsWith('/') 
                              ? `${apiBaseUrl}${formData.imagen}` 
                              : formData.imagen)
                      }} 
                      style={styles.imagePreview} 
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={handleRemoveImage}
                      disabled={isReadOnly}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.imagePlaceholder, { borderColor: colors.outlineVariant }]}
                    onPress={handlePickImage}
                    disabled={isReadOnly}
                  >
                    <Ionicons name="image-outline" size={40} color={colors.outline} />
                    <Text style={[styles.imagePlaceholderText, { color: colors.outline }]}>
                      {isReadOnly ? 'Sin imagen' : 'Agregar imagen'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {canViewCosts && (
            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
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
                      : (formData.costo_cup_general !== null && formData.costo_cup_general !== '' && !isNaN(parseFloat(formData.costo_cup_general)) ? parseFloat(formData.costo_cup_general).toFixed(2) : '')
                  }
                  onFocus={() => setGeneralPriceInputTexts(prev => ({
                    ...prev,
                    costo_cup: formData.costo_cup_general !== null && formData.costo_cup_general !== '' && !isNaN(parseFloat(formData.costo_cup_general)) ? String(parseFloat(formData.costo_cup_general)) : ''
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
                  editable={!isReadOnly}
                />
              </View>

              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Costo USD *</Text>
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
                      : (formData.costo_usd_general !== null && formData.costo_usd_general !== '' && !isNaN(parseFloat(formData.costo_usd_general)) ? parseFloat(formData.costo_usd_general).toFixed(2) : '')
                  }
                  onFocus={() => setGeneralPriceInputTexts(prev => ({
                    ...prev,
                    costo_usd: formData.costo_usd_general !== null && formData.costo_usd_general !== '' && !isNaN(parseFloat(formData.costo_usd_general)) ? String(parseFloat(formData.costo_usd_general)) : ''
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
                  editable={!isReadOnly}
                />
              </View>
            </View>
          )}

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Unidad de Medida</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Unidad de medida (opcional)"
                value={formData.unidad_medida}
                onChangeText={(text) => setFormData(prev => ({ ...prev, unidad_medida: text }))}
                editable={!isReadOnly}
              />
            </View>

            <View style={[styles.formColumn, styles.formGroup]}>
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
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Es Perecedero</Text>
              <TouchableOpacity
                style={styles.statusSwitchContainer}
                onPress={() => !isReadOnly && setFormData(prev => ({ ...prev, isVencible: !prev.isVencible }))}
                disabled={isReadOnly}
              >
                <View style={[
                  styles.statusSwitch,
                  { backgroundColor: formData.isVencible ? '#4CAF50' : '#F44336' },
                  isReadOnly && styles.inputDisabled
                ]}>
                  <View style={[
                    styles.statusSwitchKnob,
                    { transform: [{ translateX: formData.isVencible ? 0 : responsive.responsiveWidth(28) }] }
                  ]}>
                    <Text style={[
                      styles.statusSwitchText,
                      { color: formData.isVencible ? '#4CAF50' : '#F44336' }
                    ]}>
                      {formData.isVencible ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
              <TouchableOpacity
                style={[styles.statusSwitchContainer, { marginLeft: responsive.responsiveMargin(0) }]}
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
          </View>

          {/* Códigos Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Códigos de los productos</Text>
              <View style={styles.sectionActions}>
                {canEditCodes && !isOfflineMode && (
                  <TouchableOpacity
                    style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                    onPress={handleOpenBarcodeScanner}
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
                      {canEditCodes && !isOfflineMode && (
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
                        : (formData.precio_cup_general !== null && formData.precio_cup_general !== '' && !isNaN(parseFloat(formData.precio_cup_general)) ? parseFloat(formData.precio_cup_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_cup: formData.precio_cup_general !== null && formData.precio_cup_general !== '' && !isNaN(parseFloat(formData.precio_cup_general)) ? String(parseFloat(formData.precio_cup_general)) : ''
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
                        : (formData.precio_usd_general !== null && formData.precio_usd_general !== '' && !isNaN(parseFloat(formData.precio_usd_general)) ? parseFloat(formData.precio_usd_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_usd: formData.precio_usd_general !== null && formData.precio_usd_general !== '' && !isNaN(parseFloat(formData.precio_usd_general)) ? String(parseFloat(formData.precio_usd_general)) : ''
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

          {/* Tienda Productos Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Precios por Tienda</Text>
              <View style={styles.sectionActions}>
                {canEditProduct && (
                  <TouchableOpacity
                    style={[
                      styles.addButtonSmall, 
                      { 
                        backgroundColor: formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
                          ? colors.outlineVariant 
                          : colors.primary 
                      }
                    ]}
                    onPress={handleAddTiendaProducto}
                    disabled={formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length}
                  >
                    <Ionicons 
                      name="add" 
                      size={responsive.responsiveWidth(18)} 
                      color={formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
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
                {formData.productoTiendaList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay precios configurados
                  </Text>
                ) : (
                  formData.productoTiendaList.map((tiendaProducto, index) => (
                    <View key={index} style={[styles.tiendaProductoItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.tiendaField}>
                        <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
                        <TouchableOpacity
                          style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                          onPress={() => {
                            setEditingTiendaIndex(index);
                            setShowTiendaDropdown(true);
                          }}
                          disabled={isViewMode && !canEditProduct}
                        >
                          <Text style={[styles.dropdownText, { color: tiendaProducto.id_tienda ? colors.onSurface : colors.outline }]}>
                            {tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda)?.nombre || 'Seleccionar tienda'}
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
                              { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                              isReadOnly && styles.inputDisabled
                            ]}
                            value={
                              priceInputTexts[index]?.precio_cup !== undefined
                                ? priceInputTexts[index].precio_cup
                                : (tiendaProducto.precio_cup !== null && tiendaProducto.precio_cup !== '' && !isNaN(parseFloat(tiendaProducto.precio_cup)) ? parseFloat(tiendaProducto.precio_cup).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_cup: tiendaProducto.precio_cup !== null && tiendaProducto.precio_cup !== '' && !isNaN(parseFloat(tiendaProducto.precio_cup)) ? String(parseFloat(tiendaProducto.precio_cup)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_cup: text } }));
                              handleTiendaProductoChange(index, 'precio_cup', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_cup;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditProduct}
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
                            value={
                              priceInputTexts[index]?.precio_usd !== undefined
                                ? priceInputTexts[index].precio_usd
                                : (tiendaProducto.precio_usd !== null && tiendaProducto.precio_usd !== '' && !isNaN(parseFloat(tiendaProducto.precio_usd)) ? parseFloat(tiendaProducto.precio_usd).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_usd: tiendaProducto.precio_usd !== null && tiendaProducto.precio_usd !== '' && !isNaN(parseFloat(tiendaProducto.precio_usd)) ? String(parseFloat(tiendaProducto.precio_usd)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_usd: text } }));
                              handleTiendaProductoChange(index, 'precio_usd', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_usd;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditProduct}
                          />
                        </View>
                      </View>
                      
                      {(!isViewMode || canEditProduct) && (
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleRemoveTiendaProducto(index)}
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

          {/* Stock por Tienda Section */}
          {(isViewMode || isEditMode) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Stock por Tienda</Text>
                <View style={styles.sectionActions}>
                  <TouchableOpacity
                    style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                    onPress={() => setIsStockExpanded(!isStockExpanded)}
                  >
                    <Ionicons 
                      name={isStockExpanded ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(18)} 
                      color={isDarkMode ? colors.primary : '#1976D2'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              {isStockExpanded && (
                <>
                  {formData.productoTiendaList.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.outline }]}>
                      No hay stock disponible
                    </Text>
                  ) : (
                    formData.productoTiendaList.map((tiendaProducto, index) => {
                      const tienda = tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda);
                      if (!tienda || !tienda.activo) return null;
                      
                      const userRole = user?.rol?.toLowerCase();
                      const canViewThisStore = 
                        userRole === 'administrador' ||
                        (userRole === 'dependiente' && permissions?.dependiente) ||
                        (userRole === 'almacenero' && permissions?.almacenero) ||
                        (userRole === 'económico' && permissions?.economico) ||
                        (user?.id_tienda === tienda.id_tienda);
                      
                      if (!canViewThisStore) return null;
                      
                      return (
                        <View key={index} style={[styles.stockItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                          <View style={styles.stockInfoRow}>
                            <Text style={[styles.stockTiendaName, { color: colors.onSurface }]}>
                              {tienda.nombre}
                            </Text>
                            <View style={[styles.stockBadge, { backgroundColor: tiendaProducto.cantidad > 0 ? colors.primaryContainer : colors.errorContainer }]}>
                              <Text style={[styles.stockBadgeText, { color: tiendaProducto.cantidad > 0 && !isDarkMode ? '#FFFFFF' : (tiendaProducto.cantidad > 0 ? colors.primary : colors.error) }]}>
                                {tiendaProducto.cantidad !== null && tiendaProducto.cantidad !== undefined && !isNaN(parseFloat(tiendaProducto.cantidad))
                                  ? parseFloat(tiendaProducto.cantidad).toFixed(2) 
                                  : '0.00'}
                              </Text>
                            </View>
                          </View>
                          {tiendaProducto.cantidad_alerta !== null && tiendaProducto.cantidad_alerta !== undefined && (
                            <Text style={[styles.stockAlertText, { color: colors.outline }]}>
                              Alerta: {tiendaProducto.cantidad_alerta !== null && tiendaProducto.cantidad_alerta !== undefined && !isNaN(parseFloat(tiendaProducto.cantidad_alerta)) ? parseFloat(tiendaProducto.cantidad_alerta).toFixed(2) : '0.00'}
                            </Text>
                          )}
                        </View>
                      );
                    })
                  )}
                  {formData.productoTiendaList.filter((tp, idx) => {
                    const tienda = tiendas.find(t => t.id_tienda === tp.id_tienda);
                    if (!tienda || !tienda.activo) return false;
                    
                    const userRole = user?.rol?.toLowerCase();
                    return userRole === 'administrador' ||
                      (userRole === 'dependiente' && permissions?.dependiente) ||
                      (userRole === 'almacenero' && permissions?.almacenero) ||
                      (userRole === 'económico' && permissions?.economico) ||
                      (user?.id_tienda === tienda.id_tienda);
                  }).length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.outline }]}>
                      No hay tiendas visibles con stock
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          {(!isViewMode || canEditProduct) && !isOfflineMode && (
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
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Code Modal */}
      {showAddCodeModal && (
        <Modal
          visible={showAddCodeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddCodeModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddCodeModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
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
                  />
                  <TouchableOpacity
                    onPress={handleOpenScanner}
                    style={styles.cameraButton}
                  >
                    <Ionicons name="camera-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
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
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setNewCodigo('');
                    setNewNota('');
                    setShowAddCodeModal(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddCode}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

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
              barcodeScannerSettings={{
                barcodeTypes: ALLOWED_BARCODE_TYPES,
              }}
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
                style={styles.scannerCloseButton}
                onPress={() => setShowScannerModal(false)}
              >
                <Ionicons name="close" size={responsive.responsiveWidth(30)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Image Picker Modal */}
      {showImagePickerModal && (
        <Modal
          visible={showImagePickerModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowImagePickerModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Imagen</Text>
              <Text style={[styles.modalDescription, { color: colors.outline }]}>
                ¿Cómo deseas obtener la imagen del producto?
              </Text>
              
              <TouchableOpacity
                style={[styles.imagePickerOption, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.imagePickerOptionText, { color: colors.onSurface }]}>Tomar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imagePickerOption, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={handlePickFromGallery}
              >
                <Ionicons name="images" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.imagePickerOptionText, { color: colors.onSurface }]}>Galería</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Camera Modal */}
      <Modal visible={cameraModalVisible} transparent animationType="slide">
        <View style={styles.cameraFullScreen}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity style={styles.cameraCloseBtn} onPress={() => setCameraModalVisible(false)}>
              <Text style={styles.cameraCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraContent}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onCameraReady={() => { setCameraReady(true); }}
            />
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gallery Modal */}
      <GalleryModal />

      {/* Tienda Dropdown Modal */}
      {showTiendaDropdown && (
        <Modal
          visible={showTiendaDropdown}
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
                        handleTiendaProductoChange(editingTiendaIndex, 'id_tienda', tienda.id_tienda);
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

      {/* Info Modal */}
      {showInfoModal && (
        <Modal
          visible={showInfoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowInfoModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Información de Acciones</Text>
              
              {(() => {
                const userRole = user?.rol?.toLowerCase();
                const canManageEntradas = 
                  userRole === 'administrador' ||
                  (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
                  (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
                  (userRole === 'económico' && entradaManagePermissions?.economico);
                
                const canManageSalidas = 
                  userRole === 'administrador' ||
                  (userRole === 'dependiente' && salidaManagePermissions?.dependiente) ||
                  (userRole === 'almacenero' && salidaManagePermissions?.almacenero) ||
                  (userRole === 'económico' && salidaManagePermissions?.economico);
                
                return (
                  <>
                    {canManageEntradas && (
                      <View style={styles.infoItem}>
                        <View style={[styles.infoItemIcon, { backgroundColor: isDarkMode ? '#1B5E20' : '#E8F5E9' }]}>
                          <Image 
                            source={require('../../assets/package-add.png')} 
                            style={{ width: responsive.responsiveWidth(20), height: responsive.responsiveWidth(20) }}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={styles.infoItemText}>
                          <Text style={[styles.infoItemTitle, { color: colors.onSurface }]}>Agregar Entrada</Text>
                          <Text style={[styles.infoItemDescription, { color: colors.outline }]}>Registra la entrada de stock al inventario del producto.</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.infoItem}>
                      <View style={[styles.infoItemIcon, { backgroundColor: isDarkMode ? '#0D47A1' : '#E3F2FD' }]}>
                        <Image 
                          source={require('../../assets/moving.png')} 
                          style={{ width: responsive.responsiveWidth(20), height: responsive.responsiveWidth(20) }}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.infoItemText}>
                        <Text style={[styles.infoItemTitle, { color: colors.onSurface }]}>Movimiento</Text>
                        <Text style={[styles.infoItemDescription, { color: colors.outline }]}>Realiza transferencias de stock entre tiendas o almacenes.</Text>
                      </View>
                    </View>

                    {canManageSalidas && (
                      <View style={styles.infoItem}>
                        <View style={[styles.infoItemIcon, { backgroundColor: isDarkMode ? '#B71C1C' : '#FFEBEE' }]}>
                          <Image 
                            source={require('../../assets/box.png')} 
                            style={{ width: responsive.responsiveWidth(20), height: responsive.responsiveWidth(20) }}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={styles.infoItemText}>
                          <Text style={[styles.infoItemTitle, { color: colors.onSurface }]}>Hacer Salida</Text>
                          <Text style={[styles.infoItemDescription, { color: colors.outline }]}>Registra la salida de stock del inventario del producto.</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.infoItem}>
                      <View style={[styles.infoItemIcon, { backgroundColor: isDarkMode ? '#F57C00' : '#FFF3E0' }]}>
                        <Image 
                          source={require('../../assets/sales.png')} 
                          style={{ width: responsive.responsiveWidth(20), height: responsive.responsiveWidth(20) }}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={styles.infoItemText}>
                        <Text style={[styles.infoItemTitle, { color: colors.onSurface }]}>Vender</Text>
                        <Text style={[styles.infoItemDescription, { color: colors.outline }]}>Registra una venta del producto reduciendo el stock disponible.</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowInfoModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Add Entrada Modal */}
      {showAddEntradaModal && (
        <Modal
          visible={showAddEntradaModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddEntradaModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddEntradaModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
              <View style={styles.modalHeader}>
                <Ionicons name="arrow-down-circle-outline" size={responsive.responsiveWidth(28)} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Agregar Entrada</Text>
              </View>
              <Text style={[styles.modalDescription, { color: colors.outline }]}>
                ¿Deseas agregar una entrada de stock para este nuevo producto?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowAddEntradaModal(false);
                    setCreatedProducto(null);
                    navigation.goBack();
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowAddEntradaModal(false);
                    navigation.navigate('EntradaForm', { 
                      mode: 'add', 
                      productoPreSeleccionado: createdProducto,
                      fromModal: true
                    });
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Sí</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const ProductoFormScreen = () => <ProductoFormContent />;

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
    paddingTop: responsive.responsivePadding(80),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  expirationAlertCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
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
  imageSection: {
    marginTop: responsive.responsiveMargin(24),
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  imageFormRow: {
    justifyContent: 'center',
  },
  imageFormGroup: {
    flex: 0,
    alignSelf: 'center',
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
  inputDisabled: {
    opacity: 0.7,
  },
  imageContainer: {
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePreview: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
    borderRadius: 12,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: responsive.responsiveHeight(-8),
    right: responsive.responsiveWidth(-8),
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imagePlaceholder: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePlaceholderText: {
    marginTop: responsive.responsiveMargin(8),
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  imageChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(6),
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
  },
  imageChangeButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Hanken Grotesk',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
    alignItems: 'center',
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
    borderWidth: 1.5,
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
    marginBottom: responsive.responsiveMargin(8),
    borderWidth: 1,
  },
  codeText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  deleteButtonSmall: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
  tiendaProductoItem: {
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(12),
    borderWidth: 1,
  },
  tiendaField: {
    marginBottom: responsive.responsiveMargin(12),
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
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
  dropdownModal: {
    width: '100%',
    maxHeight: responsive.responsiveHeight(300),
    borderRadius: 12,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  removeButton: {
    paddingVertical: responsive.responsivePadding(8),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 6,
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(8),
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '85%',
    maxWidth: responsive.responsiveWidth(400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
  },
  modalDescription: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
    textAlign: 'center',
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePickerOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(16),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  stockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
    borderWidth: 1,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  stockTiendaName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  stockBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 12,
    marginLeft: responsive.responsiveMargin(8),
  },
  stockBadgeText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  stockAlertText: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  inputWithIconText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    paddingVertical: 0,
  },
  cameraButton: {
    marginLeft: responsive.responsiveMargin(8),
  },
  scannerContainer: {
    flex: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scannerCorner: {
    position: 'absolute',
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderColor: '#fff',
    borderWidth: 2,
  },
  scannerCornerTopRight: {
    top: responsive.responsiveHeight(150),
    right: responsive.responsiveWidth(50),
  },
  scannerCornerBottomLeft: {
    bottom: responsive.responsiveHeight(150),
    left: responsive.responsiveWidth(50),
  },
  scannerCornerBottomRight: {
    bottom: responsive.responsiveHeight(150),
    right: responsive.responsiveWidth(50),
  },
  scannerText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(20),
  },
  scannerCloseButton: {
    position: 'absolute',
    top: responsive.responsiveHeight(50),
    right: responsive.responsiveWidth(20),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  productActionsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
    flexWrap: 'wrap',
  },
  productActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(6),
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(14),
    borderRadius: 8,
    flex: 1,
    minWidth: '45%',
    justifyContent: 'center',
  },
  productActionButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionButtonsSection: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconActionButton: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveWidth(50),
    borderRadius: responsive.responsiveWidth(25),
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: responsive.responsiveMargin(16),
  },
  infoItemIcon: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveWidth(40),
    borderRadius: responsive.responsiveWidth(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoItemText: {
    flex: 1,
    marginLeft: responsive.responsiveMargin(12),
  },
  infoItemTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  infoItemDescription: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  cameraFullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: responsive.responsivePadding(50),
    paddingHorizontal: responsive.responsivePadding(20),
  },
  cameraCloseBtn: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: responsive.responsiveWidth(20),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCloseText: {
    color: '#fff',
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: 'bold',
  },
  cameraContent: {
    flex: 1,
  },
  cameraFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: responsive.responsivePadding(30),
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  captureBtn: {
    width: responsive.responsiveWidth(70),
    height: responsive.responsiveHeight(70),
    borderRadius: responsive.responsiveWidth(35),
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderRadius: responsive.responsiveWidth(30),
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#fff',
  },
  galleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: responsive.responsivePadding(16),
    paddingTop: responsive.responsivePadding(50),
  },
  notaButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  galleryThumb: {
    width: responsive.responsiveWidth(80),
    height: responsive.responsiveHeight(80),
    borderRadius: 8,
  },
});
