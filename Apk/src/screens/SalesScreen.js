import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, Dimensions, Image, Vibration, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { getServicios, getServicioByCodigo } from '../services/servicioService';
import { createVenta } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getCuentas, getCuentaById } from '../services/cuentaService';
import { getApiBaseUrl } from '../services/api';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import configService from '../services/configService';
import BarcodeEngine from '../barcode/BarcodeEngine';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { captureRef } from 'react-native-view-shot';
import { CameraView, Camera } from 'expo-camera';
import { ALLOWED_BARCODE_TYPES } from '../barcode/config/BarcodeTypes';

const SalesContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const { user, ventaAccessLevels, cuentaChangePermissions, entradaAccessLevels, entradaManagePermissions } = useAuth();
  const [permission, setPermission] = useState(null);

  // Get pre-selected product from route params
  const { preselectedProduct } = route.params || {};

  const [isScanning, setIsScanning] = useState(true);
  const [sound, setSound] = useState();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  // Track last scanned code and timestamp for duplicate detection
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const [lastScannedTimestamp, setLastScannedTimestamp] = useState(null);

  const [saleItems, setSaleItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSaleModal, setShowConfirmSaleModal] = useState(false);
  const [confirmSaleCountdown, setConfirmSaleCountdown] = useState(3);
  const [pendingSaleData, setPendingSaleData] = useState(null);

  const [selectedTienda, setSelectedTienda] = useState(null);
  const [availableTiendas, setAvailableTiendas] = useState([]);
  const [showTiendaSelector, setShowTiendaSelector] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  const [cuentaConfig, setCuentaConfig] = useState({
    efectivo_cup: [],
    efectivo_usd: [],
    transferencia_cup: [],
    transferencia_usd: [],
  });
  const [selectedCuentas, setSelectedCuentas] = useState({
    efectivo_cup: null,
    efectivo_usd: null,
    transferencia_cup: null,
    transferencia_usd: null,
  });
  const [paymentAmounts, setPaymentAmounts] = useState({
    efectivo_cup: '',
    efectivo_usd: '',
    transferencia_cup: '',
    transferencia_usd: '',
  });
  // Toggle for decimal precision in payment section (default: 2 decimals)
  const [show5Decimals, setShow5Decimals] = useState(false);
  const [ventaNota, setVentaNota] = useState('');
  // Track which payment field is focused to prevent formatting while typing
  const [focusedPaymentField, setFocusedPaymentField] = useState(null);
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  // State for pending product without stock
  const [pendingProduct, setPendingProduct] = useState(null);
  // State to preserve sale when navigating to entrada
  const [preservedSaleState, setPreservedSaleState] = useState(null);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState(null);
  const [availableCuentas, setAvailableCuentas] = useState([]);

  const [config, setConfig] = useState({});
  const [comprobanteConfig, setComprobanteConfig] = useState({
    logo: null,
    nombreNegocio: '',
  });
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteSaleItems, setComprobanteSaleItems] = useState([]);

  // State for price adjustment modal
  const [showPriceAdjustmentModal, setShowPriceAdjustmentModal] = useState(false);
  const [priceAdjustmentItems, setPriceAdjustmentItems] = useState([]);
  const [pendingSaleDataForAdjustment, setPendingSaleDataForAdjustment] = useState(null);

  const barcodeEngineRef = useRef(null);

  useEffect(() => {
    barcodeEngineRef.current = new BarcodeEngine('SALES');
    barcodeEngineRef.current.startSession();

    loadConfig();
    loadInitialData();
    loadApiBaseUrl();

    // Restore sale state when screen comes into focus
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const preservedState = await AsyncStorage.getItem('preservedSaleState');

        if (preservedState) {
          const parsedState = JSON.parse(preservedState);

          setSaleItems(parsedState.saleItems);
          setPaymentAmounts(parsedState.paymentAmounts);
          setVentaNota(parsedState.ventaNota);
          setSelectedTienda(parsedState.selectedTienda);
          setSelectedCuentas(parsedState.selectedCuentas);

          // Clear AsyncStorage
          await AsyncStorage.removeItem('preservedSaleState');

          // If there was a pending product, add it to the list
          if (parsedState.pendingProduct) {
            // Add product directly without stock check since we just created an entry
            await addProductByCodeDirect(parsedState.pendingProduct);
          }
        }
      } catch (error) {
        console.error('Error restoring sale state:', error);
      }

      // Restart barcode engine if needed
      if (barcodeEngineRef.current) {
        barcodeEngineRef.current.startSession();
      }

      // Force camera re-initialization to fix black screen
      setShowCamera(false);
      setTimeout(() => {
        setShowCamera(true);
        setCameraKey(prev => prev + 1);
      }, 100);
    });

    return () => {
      if (barcodeEngineRef.current) {
        barcodeEngineRef.current.resetSession();
      }
      if (sound) {
        sound.unloadAsync();
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const result = await Camera.requestCameraPermissionsAsync();
      setPermission(result);
    })();
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      if (searchText.length > 0) {
        try {
          setIsSearching(true);
          const filters = { nombre: searchText, fetchProducto: true, conStock: true };
          if (selectedTienda) {
            filters.id_tienda = selectedTienda.id_tienda;
          }
          const data = await getServicios(filters, 1, 10);
          
          setSearchResults(data.data || []);
          setShowSearchDropdown(true);
        } catch (error) {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 500);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText]);

  // Handle pre-selected product from ProductoFormScreen
  useEffect(() => {
    if (preselectedProduct) {
      const handlePreselectedProduct = async () => {
        try {
          // Ensure tienda is selected
          if (!selectedTienda) {
            showToast({ type: 'warning', message: 'Selecciona una tienda primero' });
            return;
          }

          // Find the servicio_tienda for the selected store
          const servicioTienda = preselectedProduct.tiendas_servicio?.find(t => t.id_tienda === selectedTienda.id_tienda);

          if (!servicioTienda) {
            showToast({ type: 'error', message: 'Producto no disponible en esta tienda' });
            return;
          }

          // Build full image URL
          let fullImageUrl = null;
          if (preselectedProduct.producto?.imagen) {
            const isBase64 = preselectedProduct.producto.imagen.startsWith('data:');
            if (isBase64) {
              fullImageUrl = preselectedProduct.producto.imagen;
            } else {
              const imagePath = preselectedProduct.producto.imagen.startsWith('/') ? preselectedProduct.producto.imagen : `/${preselectedProduct.producto.imagen}`;
              const currentBaseUrl = await getApiBaseUrl();
              fullImageUrl = currentBaseUrl ? `${currentBaseUrl}${imagePath}` : preselectedProduct.producto.imagen;
            }
          }

          // Get barcode code
          const barcodeCode = preselectedProduct.codigos?.[0]?.codigo_barras_ean || '';

          const newItem = {
            id_servicio_tienda: servicioTienda.id_servicio_tienda,
            id_servicio: preselectedProduct.id_servicio,
            codigo_barras_ean: barcodeCode,
            nombre: preselectedProduct.nombre || 'Sin nombre',
            imagen: fullImageUrl,
            cantidad: 1,
            precio_cup: parseFloat(servicioTienda.precio_cup || 0),
            precio_usd: parseFloat(servicioTienda.precio_usd || 0),
            precio_original_cup: parseFloat(servicioTienda.precio_cup || 0),
            precio_original_usd: parseFloat(servicioTienda.precio_usd || 0),
            esOferta: preselectedProduct.componentes?.length > 0,
            componentes: [],
          };

          // If it's an offer, load components
          if (newItem.esOferta && preselectedProduct.componentes?.length > 0) {
            newItem.componentes = preselectedProduct.componentes.map(comp => ({
              nombre: comp.nombre || 'Componente',
              cantidad: comp.Oferta?.cantidad || 1
            }));
          }

          setSaleItems(prev => [...prev, newItem]);
          if (Platform.OS === 'android') {
            Vibration.vibrate(100);
          }
          playSound();
          showToast({ type: 'success', message: 'Producto agregado correctamente' });
        } catch (error) {
          console.error('Error adding preselected product:', error);
          showToast({ type: 'error', message: 'Error al agregar producto' });
        }
      };

      handlePreselectedProduct();
    }
  }, [preselectedProduct, selectedTienda]);

  // Handle countdown for confirm sale modal
  useEffect(() => {
    let interval;
    if (showConfirmSaleModal && confirmSaleCountdown > 0) {
      interval = setInterval(() => {
        setConfirmSaleCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showConfirmSaleModal, confirmSaleCountdown]);

  const handleConfirmSale = async () => {
    if (!pendingSaleData) return;

    const {
      cantidad_cobrada_efectivo_cup,
      cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup,
      cantidad_cobrada_transferencia_usd,
      totalOriginalCUP,
      totalOriginalUSD,
    } = pendingSaleData;

    setShowConfirmSaleModal(false);
    setPendingSaleData(null);

    await processSale(
      cantidad_cobrada_efectivo_cup,
      cantidad_cobrada_efectivo_usd,
      cantidad_cobrada_transferencia_cup,
      cantidad_cobrada_transferencia_usd,
      totalOriginalCUP,
      totalOriginalUSD
    );
  };

  const handleCancelSale = () => {
    setShowConfirmSaleModal(false);
    setPendingSaleData(null);
    setConfirmSaleCountdown(3);
  };

  const roundTo5Decimals = (value) => Math.round(value * 100000) / 100000;

  const handleProcessSaleWithAdjustedPrices = async () => {
    if (!pendingSaleDataForAdjustment) return;

    const {
      efectivoCup,
      efectivoUsd,
      transferenciaCup,
      transferenciaUsd,
      totalOriginalCUP,
      totalOriginalUSD,
      cambio,
    } = pendingSaleDataForAdjustment;

    setShowPriceAdjustmentModal(false);

    // Determine sale currency type
    const paidInCUP = efectivoCup + transferenciaCup > 0;
    const paidInUSD = efectivoUsd + transferenciaUsd > 0;
    const saleCurrency = paidInCUP ? 'CUP' : 'USD';

    // Create adjusted sale items using user-adjusted prices
    const ventasConAjuste = priceAdjustmentItems.map(item => ({
      id_servicio_tienda: item.id_servicio_tienda,
      cantidad: item.cantidad,
      precio_cobrado_cup: saleCurrency === 'CUP' ? item.precio_cup_ajustado : 0,
      precio_cobrado_usd: saleCurrency === 'USD' ? item.precio_usd_ajustado : 0,
    }));

    const ventaData = {
      fecha_hora: new Date().toISOString(),
      nota: ventaNota,
      cantidad_cobrada_efectivo_cup: efectivoCup,
      cantidad_cobrada_efectivo_usd: efectivoUsd,
      cantidad_cobrada_transferencia_cup: transferenciaCup,
      cantidad_cobrada_transferencia_usd: transferenciaUsd,
      id_cuenta_efectivo_cup: efectivoCup > 0 ? selectedCuentas.efectivo_cup?.id_cuenta : null,
      id_cuenta_efectivo_usd: efectivoUsd > 0 ? selectedCuentas.efectivo_usd?.id_cuenta : null,
      id_cuenta_transferencia_cup: transferenciaCup > 0 ? selectedCuentas.transferencia_cup?.id_cuenta : null,
      id_cuenta_transferencia_usd: transferenciaUsd > 0 ? selectedCuentas.transferencia_usd?.id_cuenta : null,
      id_usuario: user.id_usuario,
      cambio_moneda: config.cupToUsdRate || 1,
      ventas: ventasConAjuste,
    };

    setIsSubmitting(true);

    try {
      const result = await createVenta(ventaData);

      showToast({ type: 'success', message: 'Venta realizada correctamente' });

      // Update sale items with adjusted prices for comprobante
      const saleItemsConAjuste = saleItems.map((item, index) => {
        const ajusteItem = priceAdjustmentItems[index];
        return {
          ...item,
          precio_cup: ajusteItem.precio_cup_ajustado,
          precio_usd: ajusteItem.precio_usd_ajustado,
        };
      });

      setComprobanteSaleItems([...saleItemsConAjuste]);

      // Show comprobante option
      setShowComprobanteModal(true);

      // Reset form
      setSaleItems([]);
      setPaymentAmounts({
        efectivo_cup: '',
        efectivo_usd: '',
        transferencia_cup: '',
        transferencia_usd: '',
      });

      // Clear adjustment states
      setPriceAdjustmentItems([]);
      setPendingSaleDataForAdjustment(null);

      setIsSubmitting(false);
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Error al realizar la venta' });
      setIsSubmitting(false);
    }
  };

  const loadApiBaseUrl = async () => {
    try {
      const baseUrl = await getApiBaseUrl();
      setApiBaseUrl(baseUrl);
    } catch (error) {
      setApiBaseUrl('');
    }
  };

  useEffect(() => {
    if (barcodeEngineRef.current) {
      barcodeEngineRef.current.setBusinessRulesCallback(async ({ code, type }) => {
        const itemExists = saleItems.some(item => 
          item.codigo_barras_ean?.trim().toLowerCase() === code.trim().toLowerCase()
        );
        
        if (itemExists) {
          return { valid: false, details: 'Este producto ya está en la lista' };
        }
        
        return { valid: true, details: 'Producto único en lista' };
      });
    }
  }, [saleItems]);

  const loadConfig = async () => {
    try {
      const data = await configService.getConfig();
      setConfig(data);
      if (data.comprobanteConfig) {
        setComprobanteConfig(data.comprobanteConfig);
      }
      if (data.tiendaCuentasConfig && selectedTienda) {
        setCuentaConfig(data.tiendaCuentasConfig[selectedTienda.id_tienda] || {
          efectivo_cup: [],
          efectivo_usd: [],
          transferencia_cup: [],
          transferencia_usd: [],
        });
      }
    } catch (error) {
    }
  };

  // Auto-select first configured account for each type
  useEffect(() => {
    if (cuentaConfig) {
      const tipoCuentaEsperado = {
        efectivo_cup: 'Efectivo CUP',
        efectivo_usd: 'Efectivo USD',
        transferencia_cup: 'Transferencia CUP',
        transferencia_usd: 'Transferencia USD',
      };
      
      const newSelectedCuentas = {};
      let hasInconsistency = false;
      
      ['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd'].forEach(tipo => {
        if (cuentaConfig[tipo]?.length > 0) {
          const cuenta = cuentaConfig[tipo][0];
          
          // Validar que la cuenta tenga el tipo correcto
          if (cuenta.tipo_cuenta !== tipoCuentaEsperado[tipo]) {
            hasInconsistency = true;
            showToast({ 
              type: 'error', 
              message: `Error de configuración: La cuenta "${cuenta.nombre}" es de tipo "${cuenta.tipo_cuenta}" pero está configurada como "${tipo}". Por favor reconfigure las cuentas en Configuraciones del Admin.` 
            });
          } else {
            newSelectedCuentas[tipo] = cuenta;
          }
        }
      });
      
      setSelectedCuentas(newSelectedCuentas);
    }
  }, [cuentaConfig]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load tiendas based on permissions
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');

      if (canViewAllStores) {
        const tiendasData = await getTiendas({}, 1, 1000);
        setAvailableTiendas(tiendasData.data || []);
        
        // Set user's store as default if available
        if (user?.id_tienda) {
          const userTienda = tiendasData.data?.find(t => t.id_tienda === user.id_tienda);
          if (userTienda) {
            setSelectedTienda(userTienda);
            await loadCuentaConfig(userTienda.id_tienda);
          }
        }
      } else if (user?.id_tienda) {
        const tiendasData = await getTiendas({}, 1, 1000);
        const userTienda = tiendasData.data?.find(t => t.id_tienda === user.id_tienda);
        if (userTienda) {
          setAvailableTiendas([userTienda]);
          setSelectedTienda(userTienda);
          await loadCuentaConfig(userTienda.id_tienda);
        }
      }

      // Load cuentas
      const cuentasData = await getCuentas({}, 1, 1000);
      setAvailableCuentas(cuentasData.data || []);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar datos iniciales' });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user can change stores based on ventaAccessLevels
  const canChangeStores = () => {
    const userRole = user?.rol?.toLowerCase();
    return userRole === 'administrador' ||
           (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
           (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
           (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');
  };

  // Check if user has entrada permissions (Gestión de Entradas)
  const hasEntradaPermissions = () => {
    const userRole = user?.rol?.toLowerCase();
    return userRole === 'administrador' ||
           (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
           (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
           (userRole === 'económico' && entradaManagePermissions?.economico);
  };

  // Handle navigation to entrada form for product without stock
  const handleCreateEntrada = async (servicio, servicioTienda, code) => {
    // Preserve current sale state using AsyncStorage
    const saleStateToPreserve = {
      saleItems,
      paymentAmounts,
      ventaNota,
      selectedTienda,
      selectedCuentas,
      pendingProduct: {
        servicio,
        servicioTienda,
        code,
        selectedTienda,
      },
    };

    try {
      await AsyncStorage.setItem('preservedSaleState', JSON.stringify(saleStateToPreserve));
    } catch (error) {
      console.error('Error preserving sale state:', error);
    }

    // Navigate to EntradaFormScreen with product data
    navigation.navigate('EntradaForm', {
      productoPreSeleccionado: servicio,
      tiendaPreSeleccionada: selectedTienda,
      fromSales: true,
      barcodeCode: code,
      mode: 'add',
    });
  };

  const loadCuentaConfig = async (tiendaId) => {
    try {
      const data = await configService.getConfig();
      if (data.tiendaCuentasConfig && data.tiendaCuentasConfig[tiendaId]) {
        setCuentaConfig(data.tiendaCuentasConfig[tiendaId]);
      } else {
        setCuentaConfig({
          efectivo_cup: [],
          efectivo_usd: [],
          transferencia_cup: [],
          transferencia_usd: [],
        });
      }
    } catch (error) {
    }
  };

  useEffect(() => {
    const loadSound = async () => {
      try {
        const { Audio: ExpoAudio } = await import('expo-av');
        const { Asset } = await import('expo-asset');
        const asset = Asset.fromModule(require('../../assets/beep.mp3'));
        await asset.downloadAsync();
        const { sound } = await ExpoAudio.Sound.createAsync(
          { uri: asset.localUri || asset.uri },
          { shouldPlay: false }
        );
        setSound(sound);
      } catch (error) {
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (error) {
      }
    }
  };

  const handleBarcodeScanned = async (scanningResult) => {
    if (!isScanning || !barcodeEngineRef.current) {
      return;
    }

    try {
      const rawCode = scanningResult.data;
      
      // Validate scanning result
      if (!rawCode || typeof rawCode !== 'string') {
        console.warn('Invalid scanning result:', scanningResult);
        return;
      }
      
      const currentTime = Date.now();

      // Check if same code was scanned and MORE than 2 seconds have passed
      if (lastScannedCode === rawCode && lastScannedTimestamp && (currentTime - lastScannedTimestamp) >= 2000) {
        // Find existing item and increment quantity
        const existingItem = saleItems.find(
          item => item.codigo_barras_ean?.trim().toLowerCase() === rawCode.trim().toLowerCase()
        );

        if (existingItem) {
          const itemIndex = saleItems.indexOf(existingItem);
          updateItemQuantity(itemIndex, existingItem.cantidad + 1);
          if (Platform.OS === 'android') {
            Vibration.vibrate(100);
          }
          playSound();
          showToast({ type: 'success', message: 'Cantidad aumentada' });

          // Update last scanned timestamp
          setLastScannedTimestamp(currentTime);

          // Re-enable scanning after 1.5 seconds
          setTimeout(() => {
            setIsScanning(true);
          }, 1500);
          return;
        }
      }

      // If same code scanned within 2 seconds, ignore to prevent accidental duplicates
      if (lastScannedCode === rawCode && lastScannedTimestamp && (currentTime - lastScannedTimestamp) < 2000) {
        showToast({ type: 'warning', message: 'Espere 2 segundos antes de escanear el mismo producto' });

        // Re-enable scanning after 1.5 seconds
        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
        return;
      }

      // Disable scanning immediately to prevent duplicate detections
      setIsScanning(false);

      try {
        if (!barcodeEngineRef.current) {
          setIsScanning(true);
          return;
        }
        const result = await barcodeEngineRef.current.processScanningResult({
          data: rawCode,
          type: scanningResult.type
        });

        if (result && result.success) {
          await addProductByCode(rawCode);
        }

        // Update last scanned code and timestamp
        setLastScannedCode(rawCode);
        setLastScannedTimestamp(currentTime);

        // Re-enable scanning after 1.5 seconds
        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
      } catch (innerError) {
        console.error('Error in barcode processing logic:', innerError);
        showToast({ type: 'error', message: 'Error al procesar código' });

        // Re-enable scanning on error
        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      showToast({ type: 'error', message: 'Error al procesar código' });

      // Re-enable scanning on error
      setTimeout(() => {
        setIsScanning(true);
      }, 1500);
    }
  };

  const addProductByCodeDirect = async (pendingProduct) => {
    try {
      const { servicio, servicioTienda, code, selectedTienda } = pendingProduct;

      // Build full image URL
      let fullImageUrl = null;
      if (servicio.producto?.imagen) {
        const isBase64 = servicio.producto.imagen.startsWith('data:');
        if (isBase64) {
          fullImageUrl = servicio.producto.imagen;
        } else {
          const imagePath = servicio.producto.imagen.startsWith('/') ? servicio.producto.imagen : `/${servicio.producto.imagen}`;
          const currentBaseUrl = await getApiBaseUrl();
          fullImageUrl = currentBaseUrl ? `${currentBaseUrl}${imagePath}` : servicio.producto.imagen;
        }
      }

      const newItem = {
        id_servicio_tienda: servicioTienda.id_servicio_tienda,
        id_servicio: servicio.id_servicio,
        codigo_barras_ean: code,
        nombre: servicio.nombre || 'Sin nombre',
        imagen: fullImageUrl,
        cantidad: 1,
        precio_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_usd: parseFloat(servicioTienda.precio_usd || 0),
        precio_original_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_original_usd: parseFloat(servicioTienda.precio_usd || 0),
        esOferta: servicio.componentes?.length > 0,
        componentes: [],
      };

      // If it's an offer, load components from servicio.componentes
      if (newItem.esOferta && servicio.componentes?.length > 0) {
        newItem.componentes = servicio.componentes.map(comp => ({
          nombre: comp.nombre || 'Componente',
          cantidad: comp.Oferta?.cantidad || 1
        }));
      }

      setSaleItems(prev => [...prev, newItem]);
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
      playSound();
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
    } catch (error) {
      console.error('Error in addProductByCodeDirect:', error);
      showToast({ type: 'error', message: 'Error al agregar producto' });
    }
  };

  const addProductByCode = async (code) => {
    try {
      if (!selectedTienda) {
        showToast({ type: 'warning', message: 'Selecciona una tienda primero' });
        return;
      }

      const existingItem = saleItems.find(
        item => item.codigo_barras_ean?.trim().toLowerCase() === code.trim().toLowerCase()
      );

      if (existingItem) {
        updateItemQuantity(saleItems.indexOf(existingItem), existingItem.cantidad + 1);
        if (Platform.OS === 'android') {
          Vibration.vibrate(100);
        }
        return;
      }

      // Use getServicios with codigo filter to search both services and products
      const filters = { codigo: code, fetchProducto: true };
      
      const data = await getServicios(filters, 1, 10);
      
      const servicio = data.data?.[0];

      if (!servicio) {
        showToast({ type: 'error', message: 'Producto o servicio no encontrado' });
        return;
      }

      // Find the servicio_tienda for the selected store (using tiendas_servicio, not tiendas)
      const servicioTienda = servicio.tiendas_servicio?.find(t => t.id_tienda === selectedTienda.id_tienda);

      if (!servicioTienda) {
        showToast({ type: 'error', message: 'Producto no disponible en esta tienda' });
        return;
      }

      // Check if product has stock
      const stock = servicioTienda.cantidad || 0;
      if (stock <= 0) {
        showToast({ 
          type: 'info', 
          message: `El producto "${servicio.nombre}" no tiene cantidad en existencia en la tienda "${selectedTienda.nombre}"` 
        });

        // Store pending product for potential entrada creation
        setPendingProduct({
          servicio,
          servicioTienda,
          code,
          selectedTienda
        });

        // Check if user has entrada permissions
        if (hasEntradaPermissions()) {
          Alert.alert(
            'Producto sin stock',
            `El producto "${servicio.nombre}" no tiene existencia. ¿Deseas agregar una entrada de este producto para realizar la venta?`,
            [
              {
                text: 'Cancelar',
                style: 'cancel',
              },
              {
                text: 'Crear entrada',
                onPress: () => handleCreateEntrada(servicio, servicioTienda, code),
              },
            ]
          );
        } else {
          Alert.alert(
            'Producto sin stock',
            'Para agregar una entrada de este producto, comunícate con el administrador o con alguien que tenga permisos para gestionar entradas.',
            [
              {
                text: 'Entendido',
                style: 'cancel',
              },
            ]
          );
        }
        return;
      }

      // Build full image URL
      let fullImageUrl = null;
      if (servicio.producto?.imagen) {
        const isBase64 = servicio.producto.imagen.startsWith('data:');
        if (isBase64) {
          fullImageUrl = servicio.producto.imagen;
        } else {
          const imagePath = servicio.producto.imagen.startsWith('/') ? servicio.producto.imagen : `/${servicio.producto.imagen}`;
          const currentBaseUrl = await getApiBaseUrl();
          fullImageUrl = currentBaseUrl ? `${currentBaseUrl}${imagePath}` : servicio.producto.imagen;
        }
      }

      const newItem = {
        id_servicio_tienda: servicioTienda.id_servicio_tienda,
        id_servicio: servicio.id_servicio,
        codigo_barras_ean: code,
        nombre: servicio.nombre || 'Sin nombre',
        imagen: fullImageUrl,
        cantidad: 1,
        precio_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_usd: parseFloat(servicioTienda.precio_usd || 0),
        precio_original_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_original_usd: parseFloat(servicioTienda.precio_usd || 0),
        esOferta: servicio.componentes?.length > 0,
        componentes: [],
      };

      // If it's an offer, load components from servicio.componentes
      if (newItem.esOferta && servicio.componentes?.length > 0) {
        newItem.componentes = servicio.componentes.map(comp => ({
          nombre: comp.nombre || 'Componente',
          cantidad: comp.Oferta?.cantidad || 1
        }));
      }

      setSaleItems(prev => [...prev, newItem]);
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
      playSound();
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al agregar producto' });
    }
  };

  const addProductBySearch = async (servicio) => {
    try {
      if (!selectedTienda) {
        showToast({ type: 'warning', message: 'Selecciona una tienda primero' });
        return;
      }

      // Find the servicio_tienda for the selected store
      const servicioTienda = servicio.tiendas_servicio?.find(t => t.id_tienda === selectedTienda.id_tienda);

      if (!servicioTienda) {
        showToast({ type: 'error', message: 'Producto no disponible en esta tienda' });
        return;
      }

      // Check if product already exists in sale list
      const existingItem = saleItems.find(item => 
        item.id_servicio_tienda === servicioTienda.id_servicio_tienda
      );

      if (existingItem) {
          updateItemQuantity(saleItems.indexOf(existingItem), existingItem.cantidad + 1);
        if (Platform.OS === 'android') {
          Vibration.vibrate(100);
        }
        playSound();
        showToast({ type: 'success', message: 'Cantidad aumentada' });
        setSearchText('');
        return;
      }

      // Build full image URL
      let fullImageUrl = null;
      if (servicio.producto?.imagen) {
        const isBase64 = servicio.producto.imagen.startsWith('data:');
        if (isBase64) {
          fullImageUrl = servicio.producto.imagen;
        } else {
          const imagePath = servicio.producto.imagen.startsWith('/') ? servicio.producto.imagen : `/${servicio.producto.imagen}`;
          const currentBaseUrl = await getApiBaseUrl();
          fullImageUrl = currentBaseUrl ? `${currentBaseUrl}${imagePath}` : servicio.producto.imagen;
        }
      }

      const newItem = {
        id_servicio_tienda: servicioTienda.id_servicio_tienda,
        id_servicio: servicio.id_servicio,
        codigo_barras_ean: servicio.codigos?.[0]?.codigo_barras_ean || '',
        nombre: servicio.nombre || 'Sin nombre',
        imagen: fullImageUrl,
        cantidad: 1,
        precio_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_usd: parseFloat(servicioTienda.precio_usd || 0),
        precio_original_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_original_usd: parseFloat(servicioTienda.precio_usd || 0),
        esOferta: servicio.componentes?.length > 0,
        componentes: [],
      };

      // If it's an offer, load components from servicio.componentes
      if (newItem.esOferta && servicio.componentes?.length > 0) {
        newItem.componentes = servicio.componentes.map(comp => ({
          nombre: comp.nombre || 'Componente',
          cantidad: comp.Oferta?.cantidad || 1
        }));
      }

      setSaleItems(prev => [...prev, newItem]);
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
      playSound();
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
      setSearchText('');
    } catch (error) {
      showToast({ type: 'error', message: 'Error al agregar producto' });
    }
  };

  const updateItemQuantity = (index, newQuantity) => {
    // Allow 0 for editing purposes (empty field), but not negative
    if (newQuantity < 0) return;
    setSaleItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], cantidad: newQuantity };
      return updated;
    });
  };

  const removeItem = (index) => {
    Alert.alert(
      'Eliminar Producto',
      '¿Estás seguro de que quieres eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSaleItems(prev => prev.filter((_, i) => i !== index));
            showToast({ type: 'success', message: 'Producto eliminado' });
          },
        },
      ]
    );
  };

  const calculateTotal = () => {
    return saleItems.reduce((total, item) => {
      return total + (item.precio_cup * item.cantidad);
    }, 0);
  };

  const calculateTotalUSD = () => {
    return saleItems.reduce((total, item) => {
      return total + (item.precio_usd * item.cantidad);
    }, 0);
  };

  const calculatePaidTotal = () => {
    const parseAmount = (value) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    };
    const cup = parseAmount(paymentAmounts.efectivo_cup) + parseAmount(paymentAmounts.transferencia_cup);
    const usd = parseAmount(paymentAmounts.efectivo_usd) + parseAmount(paymentAmounts.transferencia_usd);
    const cambio = parseFloat(config.cupToUsdRate || 1);
    return cup + (usd * cambio);
  };

  const getRemainingAmount = () => {
    const roundTo5Decimals = (value) => Math.round(value * 100000) / 100000;
    const tolerance = 0.01;
    const remaining = roundTo5Decimals(calculateTotal() - calculatePaidTotal());
    
    // If the difference is within tolerance, treat it as zero
    if (Math.abs(remaining) <= tolerance) {
      return 0;
    }
    
    return remaining;
  };

  // Helper function to format number with 2 decimal places (default)
  const formatNumber2Decimals = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toFixed(2);
  };

  // Helper function to format number with 5 decimal places (when toggle is active)
  const formatNumber5Decimals = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toFixed(5);
  };

  // Get the display value for a payment field based on toggle state
  const getPaymentDisplayValue = (tipo) => {
    const value = paymentAmounts[tipo];
    // Return empty string to show placeholder when value is empty or zero
    if (!value || value === '' || value === '0' || value === '0.00' || value === '0.00000') {
      return '';
    }
    // Don't format if this field is currently focused (allows user to type freely)
    if (focusedPaymentField === tipo) {
      return value;
    }
    if (show5Decimals) {
      // When toggle is active, show 5 decimals
      return formatNumber5Decimals(value);
    } else {
      // When toggle is inactive (default), show 2 decimals
      return formatNumber2Decimals(value);
    }
  };

  const handleSelectCuenta = (cuenta, tipoCuenta) => {
    const tipoCuentaEsperado = {
      efectivo_cup: 'Efectivo CUP',
      efectivo_usd: 'Efectivo USD',
      transferencia_cup: 'Transferencia CUP',
      transferencia_usd: 'Transferencia USD',
    };

    // Validar que la cuenta tenga el tipo correcto
    if (cuenta.tipo_cuenta !== tipoCuentaEsperado[tipoCuenta]) {
      showToast({
        type: 'error',
        message: `La cuenta "${cuenta.nombre}" es de tipo "${cuenta.tipo_cuenta}" pero se requiere "${tipoCuentaEsperado[tipoCuenta]}". Por favor selecciona una cuenta del tipo correcto.`
      });
      return;
    }

    setSelectedCuentas(prev => ({
      ...prev,
      [tipoCuenta]: cuenta,
    }));
    setShowCuentaSelector(false);
  };

  const handleSubmitSale = async () => {
    if (saleItems.length === 0) {
      showToast({ type: 'warning', message: 'Agrega al menos un producto' });
      return;
    }

    if (!selectedTienda) {
      showToast({ type: 'warning', message: 'Selecciona una tienda' });
      return;
    }

    if (!config || !config.cupToUsdRate) {
      showToast({ type: 'warning', message: 'Cargando configuración, por favor espera...' });
      await loadConfig();
      return;
    }

    if (!user || !user.id_usuario) {
      showToast({ type: 'warning', message: 'Usuario no disponible, por favor recarga la página' });
      return;
    }

    try {
      const parseAmount = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      };

      const efectivoCup = parseAmount(paymentAmounts.efectivo_cup);
      const efectivoUsd = parseAmount(paymentAmounts.efectivo_usd);
      const transferenciaCup = parseAmount(paymentAmounts.transferencia_cup);
      const transferenciaUsd = parseAmount(paymentAmounts.transferencia_usd);

      // Validate that amounts don't exceed database limit (DECIMAL(12, 5) = max 999,999,999.99999)
      const MAX_DECIMAL_12_5 = 999999999.99999;
      const validateDecimalLimit = (value, fieldName) => {
        if (value > MAX_DECIMAL_12_5) {
          showToast({
            type: 'error',
            message: `El valor de ${fieldName} (${value.toFixed(5)}) excede el límite máximo permitido de ${MAX_DECIMAL_12_5.toFixed(5)}. Por favor contacta al administrador del sistema para aumentar el límite de la base de datos.`
          });
          return false;
        }
        return true;
      };

      if (!validateDecimalLimit(efectivoCup, 'efectivo CUP')) return;
      if (!validateDecimalLimit(efectivoUsd, 'efectivo USD')) return;
      if (!validateDecimalLimit(transferenciaCup, 'transferencia CUP')) return;
      if (!validateDecimalLimit(transferenciaUsd, 'transferencia USD')) return;

      // Validate that account funds won't exceed database limit after adding sale amount
      const validateAccountFundLimit = async (cuenta, amount, fieldName) => {
        if (!cuenta || amount <= 0) return true;
        
        try {
          const cuentaData = await getCuentaById(cuenta.id_cuenta);
          const currentFondo = parseFloat(cuentaData.fondo || 0);
          const newFondo = currentFondo + amount;

          if (newFondo > MAX_DECIMAL_12_5) {
            showToast({
              type: 'error',
              message: `El fondo de la cuenta "${cuenta.nombre}" excederá el límite máximo. Fondo actual: ${currentFondo.toFixed(5)}, Nuevo fondo: ${newFondo.toFixed(5)}, Límite: ${MAX_DECIMAL_12_5.toFixed(5)}. Por favor contacta al administrador del sistema para aumentar el límite de la base de datos.`
            });
            return false;
          }
          return true;
        } catch (error) {
          console.error('Error validating account fund:', error);
          return true; // Allow if we can't validate (fail open)
        }
      };

      const fundValidations = await Promise.all([
        validateAccountFundLimit(selectedCuentas.efectivo_cup, efectivoCup, 'efectivo CUP'),
        validateAccountFundLimit(selectedCuentas.efectivo_usd, efectivoUsd, 'efectivo USD'),
        validateAccountFundLimit(selectedCuentas.transferencia_cup, transferenciaCup, 'transferencia CUP'),
        validateAccountFundLimit(selectedCuentas.transferencia_usd, transferenciaUsd, 'transferencia USD'),
      ]);

      if (!fundValidations.every(v => v)) return;

      // Calculate total original prices from servicio_tienda (for backend calculations)
      const totalOriginalCUP = saleItems.reduce((sum, item) => sum + ((item.precio_original_cup || item.precio_cup) * item.cantidad), 0);
      const totalOriginalUSD = saleItems.reduce((sum, item) => sum + ((item.precio_original_usd || item.precio_usd) * item.cantidad), 0);

      // Calculate total current prices (what user is actually charging)
      const totalCurrentCUP = saleItems.reduce((sum, item) => sum + (item.precio_cup * item.cantidad), 0);
      const totalCurrentUSD = saleItems.reduce((sum, item) => sum + (item.precio_usd * item.cantidad), 0);

      // Round all values to 5 decimals to match backend precision and handle rounding discrepancies
      const roundTo5Decimals = (value) => Math.round(value * 100000) / 100000;
      
      // Calculate total paid
      const cambio = parseFloat(config.cupToUsdRate) || 1;
      const totalPaidCUP = roundTo5Decimals(efectivoCup + transferenciaCup + (efectivoUsd + transferenciaUsd) * cambio);
      const totalPaidUSD = roundTo5Decimals(efectivoUsd + transferenciaUsd + (efectivoCup + transferenciaCup) / cambio);
      const totalOriginalCUPRounded = roundTo5Decimals(totalOriginalCUP);
      const totalOriginalUSDRounded = roundTo5Decimals(totalOriginalUSD);
      const totalCurrentCUPRounded = roundTo5Decimals(totalCurrentCUP);
      const totalCurrentUSDRounded = roundTo5Decimals(totalCurrentUSD);

      // Check if paid amount is less than total (using rounded values and tolerance for rounding discrepancies)
      // Use tolerance of 0.1 to ignore small differences due to rounding
      const tolerance = 0.1;
      const amountDifference = Math.abs(totalPaidCUP - totalCurrentCUPRounded);
      
      // If the amount paid differs significantly from the current charged amount, require a note
      if (amountDifference > tolerance && (!ventaNota || ventaNota.trim() === '')) {
        showToast({ 
          type: 'warning', 
          message: 'Debes agregar una nota explicando por qué se está cobrando un valor diferente al total' 
        });
        return;
      }
      
      if (totalPaidCUP < totalOriginalCUPRounded - tolerance) {
        // Prepare sale data for later use
        const ventaData = {
          fecha_hora: new Date().toISOString(),
          nota: ventaNota,
          cantidad_cobrada_efectivo_cup: efectivoCup,
          cantidad_cobrada_efectivo_usd: efectivoUsd,
          cantidad_cobrada_transferencia_cup: transferenciaCup,
          cantidad_cobrada_transferencia_usd: transferenciaUsd,
          id_cuenta_efectivo_cup: efectivoCup > 0 ? selectedCuentas.efectivo_cup?.id_cuenta : null,
          id_cuenta_efectivo_usd: efectivoUsd > 0 ? selectedCuentas.efectivo_usd?.id_cuenta : null,
          id_cuenta_transferencia_cup: transferenciaCup > 0 ? selectedCuentas.transferencia_cup?.id_cuenta : null,
          id_cuenta_transferencia_usd: transferenciaUsd > 0 ? selectedCuentas.transferencia_usd?.id_cuenta : null,
          id_usuario: user.id_usuario,
          cambio_moneda: parseFloat(config.cupToUsdRate) || 1,
          totalOriginalCUP,
          totalOriginalUSD,
          totalPaidCUP,
          totalPaidUSD,
        };

        setPendingSaleData(ventaData);
        setConfirmSaleCountdown(3);
        setShowConfirmSaleModal(true);
        return;
      }

      // Process sale normally if amount is sufficient
      await processSale(efectivoCup, efectivoUsd, transferenciaCup, transferenciaUsd, totalOriginalCUP, totalOriginalUSD);
    } catch (error) {
      console.error('Error preparing sale:', error);
      showToast({ type: 'error', message: 'Error al procesar la venta' });
    }
  };

  const processSale = async (efectivoCup, efectivoUsd, transferenciaCup, transferenciaUsd, totalOriginalCUP, totalOriginalUSD) => {
    try {
      setIsSubmitting(true);

      // Round all values to 5 decimals to match backend precision and handle rounding discrepancies
      const roundTo5Decimals = (value) => Math.round(value * 100000) / 100000;
      
      const cambio = parseFloat(config.cupToUsdRate || 1);
      const efectivoCupRounded = roundTo5Decimals(efectivoCup);
      const efectivoUsdRounded = roundTo5Decimals(efectivoUsd);
      const transferenciaCupRounded = roundTo5Decimals(transferenciaCup);
      const transferenciaUsdRounded = roundTo5Decimals(transferenciaUsd);
      const totalOriginalCUPRounded = roundTo5Decimals(totalOriginalCUP);
      const totalOriginalUSDRounded = roundTo5Decimals(totalOriginalUSD);

      // Calculate difference and distribute equitably using rounded values
      const totalPaidCUP = efectivoCupRounded + transferenciaCupRounded + (efectivoUsdRounded + transferenciaUsdRounded) * cambio;
      const totalPaidUSD = efectivoUsdRounded + transferenciaUsdRounded + (efectivoCupRounded + transferenciaCupRounded) / cambio;

      const diferenciaCUP = roundTo5Decimals(totalPaidCUP - totalOriginalCUPRounded);
      const diferenciaUSD = roundTo5Decimals(totalPaidUSD - totalOriginalUSDRounded);

      // If the difference is very small (within tolerance), treat as no adjustment needed
      // Only check the currency that was actually paid in
      const tolerance = 0.1;
      const paidInCUP = efectivoCupRounded + transferenciaCupRounded > 0;
      const paidInUSD = efectivoUsdRounded + transferenciaUsdRounded > 0;
      
      const cupWithinTolerance = Math.abs(diferenciaCUP) <= tolerance;
      const usdWithinTolerance = Math.abs(diferenciaUSD) <= tolerance;
      
      // If paid in both currencies, both must be within tolerance
      // If paid in only one currency, only that one needs to be within tolerance
      const shouldSkipAdjustment = paidInCUP && paidInUSD 
        ? cupWithinTolerance && usdWithinTolerance
        : paidInCUP ? cupWithinTolerance : usdWithinTolerance;
      
      if (shouldSkipAdjustment) {
        // No adjustment needed, use exact original prices from servicio_tienda to avoid any backend calculations
        const ventasSinAjuste = saleItems.map(item => ({
          id_servicio_tienda: item.id_servicio_tienda,
          cantidad: item.cantidad,
          precio_cobrado_cup: item.precio_cup,
          precio_cobrado_usd: item.precio_usd,
        }));

        const ventaData = {
          fecha_hora: new Date().toISOString(),
          nota: ventaNota,
          cantidad_cobrada_efectivo_cup: efectivoCupRounded,
          cantidad_cobrada_efectivo_usd: efectivoUsdRounded,
          cantidad_cobrada_transferencia_cup: transferenciaCupRounded,
          cantidad_cobrada_transferencia_usd: transferenciaUsdRounded,
          id_cuenta_efectivo_cup: efectivoCupRounded > 0 ? selectedCuentas.efectivo_cup?.id_cuenta : null,
          id_cuenta_efectivo_usd: efectivoUsdRounded > 0 ? selectedCuentas.efectivo_usd?.id_cuenta : null,
          id_cuenta_transferencia_cup: transferenciaCupRounded > 0 ? selectedCuentas.transferencia_cup?.id_cuenta : null,
          id_cuenta_transferencia_usd: transferenciaUsdRounded > 0 ? selectedCuentas.transferencia_usd?.id_cuenta : null,
          id_usuario: user.id_usuario,
          cambio_moneda: cambio,
          ventas: ventasSinAjuste,
        };

        const result = await createVenta(ventaData);
        
        showToast({ type: 'success', message: 'Venta realizada correctamente' });
        
        // Save sale items for comprobante before resetting
        setComprobanteSaleItems([...saleItems]);
        
        // Show comprobante option
        setShowComprobanteModal(true);
        
        // Reset form
        setSaleItems([]);
        setPaymentAmounts({
          efectivo_cup: '',
          efectivo_usd: '',
          transferencia_cup: '',
          transferencia_usd: '',
        });
        
        setIsSubmitting(false);
        return result;
      }

      // Check if total paid is greater than 0 - if so, show price adjustment modal
      const totalPaid = efectivoCupRounded + transferenciaCupRounded + efectivoUsdRounded + transferenciaUsdRounded;
      if (totalPaid > 0) {
        // Determine sale currency type
        const paidInCUP = efectivoCupRounded + transferenciaCupRounded > 0;
        const paidInUSD = efectivoUsdRounded + transferenciaUsdRounded > 0;
        const saleCurrency = paidInCUP ? 'CUP' : 'USD';

        // Prepare items for price adjustment modal with current prices
        const adjustmentItems = saleItems.map(item => ({
          ...item,
          precio_cup_ajustado: item.precio_cup,
          precio_usd_ajustado: item.precio_usd,
        }));

        setPriceAdjustmentItems(adjustmentItems);
        setPendingSaleDataForAdjustment({
          efectivoCup: efectivoCupRounded,
          efectivoUsd: efectivoUsdRounded,
          transferenciaCup: transferenciaCupRounded,
          transferenciaUsd: transferenciaUsdRounded,
          totalOriginalCUP: totalOriginalCUPRounded,
          totalOriginalUSD: totalOriginalUSDRounded,
          cambio: cambio,
          saleCurrency: saleCurrency,
        });
        setShowPriceAdjustmentModal(true);
        setIsSubmitting(false);
        return;
      }

      // Calculate adjustment per item (equitable distribution)
      const cantidadProductos = saleItems.length;
      const ajusteCUPPorItem = cantidadProductos > 0 ? roundTo5Decimals(diferenciaCUP / cantidadProductos) : 0;
      const ajusteUSDPorItem = cantidadProductos > 0 ? roundTo5Decimals(diferenciaUSD / cantidadProductos) : 0;

      // Create adjusted sale items for the API
      const ventasConAjuste = saleItems.map(item => {
        // Prevent division by zero and limit adjustment to reasonable values
        const cantidad = item.cantidad > 0 ? item.cantidad : 1;
        const ajusteCUP = roundTo5Decimals(ajusteCUPPorItem / cantidad);
        const ajusteUSD = roundTo5Decimals(ajusteUSDPorItem / cantidad);
        
        // Limit adjusted prices to prevent overflow (max 999999999.99999)
        const precioCobradoCUP = Math.max(0, Math.min(999999999.99999, roundTo5Decimals(item.precio_cup + ajusteCUP)));
        const precioCobradoUSD = Math.max(0, Math.min(999999999.99999, roundTo5Decimals(item.precio_usd + ajusteUSD)));
        
        return {
          id_servicio_tienda: item.id_servicio_tienda,
          cantidad: item.cantidad,
          precio_cobrado_cup: precioCobradoCUP,
          precio_cobrado_usd: precioCobradoUSD,
        };
      });

      // Update sale items with adjusted prices for comprobante
      const saleItemsConAjuste = saleItems.map((item, index) => {
        const ventaAjustada = ventasConAjuste[index];
        return {
          ...item,
          precio_cup: ventaAjustada.precio_cobrado_cup,
          precio_usd: ventaAjustada.precio_cobrado_usd,
        };
      });

      const ventaData = {
        fecha_hora: new Date().toISOString(),
        nota: ventaNota,
        cantidad_cobrada_efectivo_cup: efectivoCup,
        cantidad_cobrada_efectivo_usd: efectivoUsd,
        cantidad_cobrada_transferencia_cup: transferenciaCup,
        cantidad_cobrada_transferencia_usd: transferenciaUsd,
        id_cuenta_efectivo_cup: efectivoCup > 0 ? selectedCuentas.efectivo_cup?.id_cuenta : null,
        id_cuenta_efectivo_usd: efectivoUsd > 0 ? selectedCuentas.efectivo_usd?.id_cuenta : null,
        id_cuenta_transferencia_cup: transferenciaCup > 0 ? selectedCuentas.transferencia_cup?.id_cuenta : null,
        id_cuenta_transferencia_usd: transferenciaUsd > 0 ? selectedCuentas.transferencia_usd?.id_cuenta : null,
        id_usuario: user.id_usuario,
        cambio_moneda: config.cupToUsdRate || 1,
        ventas: ventasConAjuste,
      };


      const result = await createVenta(ventaData);
      
      showToast({ type: 'success', message: 'Venta realizada correctamente' });
      
      // Save sale items with adjusted prices for comprobante before resetting
      setComprobanteSaleItems([...saleItemsConAjuste]);
      
      // Show comprobante option
      setShowComprobanteModal(true);
      
      // Reset form
      setSaleItems([]);
      setPaymentAmounts({
        efectivo_cup: '',
        efectivo_usd: '',
        transferencia_cup: '',
        transferencia_usd: '',
      });
    } catch (error) {
      const errorMessage = error.message || 'Error al realizar venta';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatComprobanteNumber = (num) => {
    const formatted = parseFloat(num).toFixed(2);
    const withoutZeros = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
    const parts = withoutZeros.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  };

  const convertToGrayscale = (base64Data) => {
    try {
      const matches = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!matches) return base64Data;
      
      const mimeType = matches[1];
      const base64String = matches[2];
      
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (mimeType !== 'image/jpeg') {
        return base64Data;
      }
      
      for (let i = 0; i < bytes.length; i += 3) {
        if (i + 2 < bytes.length) {
          const avg = Math.round((bytes[i] + bytes[i + 1] + bytes[i + 2]) / 3);
          bytes[i] = avg;
          bytes[i + 1] = avg;
          bytes[i + 2] = avg;
        }
      }
      
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const grayBase64 = btoa(binary);
      
      return `data:${mimeType};base64,${grayBase64}`;
    } catch (error) {
      return base64Data;
    }
  };

  const handleGenerateComprobante = async () => {
    try {
      const totalCUP = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0);
      const totalUSD = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_usd), 0);

      let logoBase64 = '';
      if (comprobanteConfig.logo) {
        logoBase64 = comprobanteConfig.logo;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Comprobante de Pago</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              margin: 0;
              background-color: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .logo {
              max-width: 100px;
              max-height: 100px;
              margin-bottom: 10px;
            }
            .logo-svg {
              max-width: 100px;
              max-height: 100px;
              margin-bottom: 10px;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .text {
              font-size: 12px;
              margin-bottom: 5px;
            }
            .text-centered {
              text-align: center;
              margin-top: 10px;
            }
            .table-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 5px;
            }
            .table-column {
              flex: 1;
              text-align: left;
            }
            .table-column-bold {
              font-weight: bold;
            }
            .line {
              border-top: 1px solid #000;
              margin: 10px 0;
            }
            .table-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin-bottom: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `
              <svg class="logo-svg" viewBox="0 0 100 100">
                <defs>
                  <filter id="grayscale">
                    <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0"/>
                  </filter>
                </defs>
                <image href="${logoBase64}" width="100" height="100" filter="url(#grayscale)"/>
              </svg>
            ` : ''}
            ${comprobanteConfig.nombreNegocio ? `<div class="business-name">${comprobanteConfig.nombreNegocio}</div>` : ''}
            <div class="text">DEPENDIENTE: ${user?.nombre_natural || 'N/A'}</div>
            <div class="text">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
          <div class="table-header">
            <div class="table-column table-column-bold">Servicio/Producto</div>
            <div class="table-column table-column-bold">Cant</div>
            <div class="table-column table-column-bold">Total</div>
          </div>
          <div class="line"></div>
          ${comprobanteSaleItems.map(item => `
            <div class="table-row">
              <div class="table-column">${item.nombre}</div>
              <div class="table-column">${item.cantidad}</div>
              <div class="table-column">$${formatComprobanteNumber(item.cantidad * item.precio_cup)}</div>
            </div>
          `).join('')}
          <div class="table-row">
            <div class="table-column table-column-bold">TOTAL</div>
            <div class="table-column"></div>
            <div class="table-column table-column-bold">$${formatComprobanteNumber(totalCUP)}</div>
          </div>
          <div class="line"></div>
          <div class="text-centered text">¡Gracias por su compra!</div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir comprobante',
        });
      }
      
      setShowComprobanteModal(false);
      navigation.navigate('Ventas');
    } catch (error) {
      showToast({ type: 'error', message: 'Error al generar comprobante' });
    }
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  if (!permission) {
    const styles = createStyles(responsive);
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>
            Solicitando permiso de cámara...
          </Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    const styles = createStyles(responsive);
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.container, styles.permissionContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>
            Necesitamos permiso para usar la cámara
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={async () => {
              const result = await Camera.requestCameraPermissionsAsync();
              setPermission(result);
            }}
          >
            <Text style={styles.permissionButtonText}>Conceder permiso</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Nueva Venta</Text>
        <TouchableOpacity onPress={() => setShowCamera(!showCamera)} style={styles.cameraToggle}>
          <Ionicons name="barcode" size={24} color={colors.primary} />
          <Text style={[styles.cameraToggleText, { color: colors.primary }]}>
            {showCamera ? "Escáner activo" : "Escáner desactivado"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets={true}
        >
        {/* Camera Section */}
        {showCamera && !isKeyboardVisible && (
          <View style={styles.cameraContainer}>
            <CameraView
              key={cameraKey}
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ALLOWED_BARCODE_TYPES,
              }}
              onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
            />
            <View style={styles.cameraOverlay}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <Text style={[styles.cameraHint, { color: '#fff' }]}>
                Apunta al código de barras
              </Text>
            </View>
          </View>
        )}

        {/* Store Selector and Product Search */}
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tienda</Text>
            {canChangeStores() ? (
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowTiendaSelector(!showTiendaSelector)}
              >
                <Text style={[styles.dropdownText, { color: selectedTienda ? colors.onSurface : colors.outline }]}>
                  {selectedTienda?.nombre || 'Seleccionar tienda...'}
                </Text>
                <Ionicons
                  name={showTiendaSelector ? "chevron-up" : "chevron-down"}
                  size={responsive.responsiveWidth(20)}
                  color={colors.outline}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.tiendaInfoContainer}>
                <Text style={[styles.tiendaInfoText, { color: colors.onSurface }]}>
                  {selectedTienda?.nombre || 'Tienda no asignada'}
                </Text>
                <Text style={[styles.dependienteInfoText, { color: colors.outline }]}>
                  {user?.rol ? `${user.rol}: ` : ''}{user?.nombre_natural || user?.nombre_usuario || 'Usuario'}
                </Text>
              </View>
            )}
          </View>

          {canChangeStores() && showTiendaSelector && (
            <ScrollView style={styles.dropdownMenu} nestedScrollEnabled={true}>
              {availableTiendas.map((tienda) => (
                <TouchableOpacity
                  key={tienda.id_tienda}
                  style={styles.dropdownItem}
                  onPress={async () => {
                    setShowTiendaSelector(false);
                    // Clear selected cuentas and payment amounts BEFORE changing tienda
                    setSelectedCuentas({
                      efectivo_cup: null,
                      efectivo_usd: null,
                      transferencia_cup: null,
                      transferencia_usd: null,
                    });
                    setPaymentAmounts({
                      efectivo_cup: '',
                      efectivo_usd: '',
                      transferencia_cup: '',
                      transferencia_usd: '',
                    });
                    // Load new config BEFORE changing tienda to avoid race condition
                    await loadCuentaConfig(tienda.id_tienda);
                    // Change tienda after config is loaded
                    setSelectedTienda(tienda);
                  }}
                >
                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={{ marginTop: responsive.responsiveHeight(12) }}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Buscar producto</Text>
          </View>

          <View style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="search" size={responsive.responsiveWidth(20)} color={colors.outline} />
            )}
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Buscar producto o servicio..."
              placeholderTextColor={colors.outline}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          
          {showSearchDropdown && (
            <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              {isSearching ? (
                <View style={styles.dropdownLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Buscando...</Text>
                </View>
              ) : searchResults.length > 0 ? (
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {searchResults.map((servicio, index) => {
                    // Obtener el precio de la tienda seleccionada o el primero disponible
                    let precioCup = 0;
                    if (servicio.tiendas_servicio && servicio.tiendas_servicio.length > 0) {
                      if (selectedTienda) {
                        const tiendaPrecio = servicio.tiendas_servicio.find(st => st.id_tienda === selectedTienda.id_tienda);
                        if (tiendaPrecio) {
                          precioCup = tiendaPrecio.precio_cup;
                        } else {
                          // Si no hay precio para la tienda seleccionada, usar el primero
                          precioCup = servicio.tiendas_servicio[0].precio_cup;
                        }
                      } else {
                        // Si no hay tienda seleccionada, usar el primer precio
                        precioCup = servicio.tiendas_servicio[0].precio_cup;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={servicio.id_servicio}
                        style={[styles.dropdownItem, index === searchResults.length - 1 && styles.dropdownItemLast]}
                        onPress={() => addProductBySearch(servicio)}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                        <View style={styles.dropdownItemSubtextContainer}>
                          <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>
                            {servicio.producto ? 'Producto' : 'Servicio'}
                          </Text>
                          <Text style={[styles.dropdownItemPrice, { color: colors.primary }]}>
                            ${precioCup ? formatNumber2Decimals(precioCup) : '0.00'} CUP
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[styles.dropdownEmptyText, { color: colors.outline }]}>
                  No se encontraron resultados
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Sale Items List */}
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
              Productos ({saleItems.length})
            </Text>
          </View>

          {saleItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay productos agregados
            </Text>
          ) : (
            saleItems.map((item, index) => (
              <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                {item.imagen && (
                  <Image 
                    source={{ uri: item.imagen }} 
                    style={styles.itemImage}
                  />
                )}
                <View style={styles.itemContent}>
                  <Text style={[styles.itemName, { color: colors.onSurface }]}>{item.nombre}</Text>
                  <Text style={[styles.itemPrice, { color: colors.outline }]}>
                    <Text style={{ fontWeight: 'bold' }}>
                      ${show5Decimals ? formatNumber5Decimals(item.precio_cup) : formatNumber2Decimals(item.precio_cup)} CUP
                    </Text>
                    {' / '}
                    ${show5Decimals ? formatNumber5Decimals(item.precio_usd) : formatNumber2Decimals(item.precio_usd)} USD
                  </Text>
                  {item.esOferta && (
                    <Text style={[styles.offerBadge, { color: colors.primary }]}>Contenido total</Text>
                  )}
                  {item.esOferta && item.componentes && item.componentes.length > 0 && (
                    <View style={styles.componentsContainer}>
                      {item.componentes.map((comp, compIndex) => {
                        const totalQuantity = comp.cantidad * item.cantidad;
                        return (
                          <Text key={compIndex} style={[styles.componentText, { color: colors.outline }]}>
                            • {comp.nombre} x{totalQuantity}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => updateItemQuantity(index, item.cantidad - 1)}
                  >
                    <Ionicons name="remove" size={responsive.responsiveWidth(16)} color={isDark ? colors.primary : '#fff'} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.quantityInput, { color: colors.onSurface }]}
                    value={item.cantidad === 0 ? '' : item.cantidad.toString()}
                    onChangeText={(text) => {
                      // Allow empty string while editing
                      if (text === '') {
                        updateItemQuantity(index, 0);
                        return;
                      }
                      const newQuantity = parseInt(text) || 0;
                      if (newQuantity > 0) {
                        updateItemQuantity(index, newQuantity);
                      }
                    }}
                    onBlur={() => {
                      // Set to 1 if empty on blur
                      if (item.cantidad === 0) {
                        updateItemQuantity(index, 1);
                      }
                    }}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.primaryContainer }]}
                    onPress={() => updateItemQuantity(index, item.cantidad + 1)}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(16)} color={isDark ? colors.primary : '#fff'} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: colors.errorContainer }]}
                  onPress={() => removeItem(index)}
                >
                  <Ionicons name="close" size={responsive.responsiveWidth(16)} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        {/* Payment Section */}
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeaderWithSwitch}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Pago</Text>
            <View style={styles.decimalSwitchContainer}>
              <Text style={[styles.decimalLabel, { color: colors.outline }]}>
                {show5Decimals ? '5 decimales' : '2 decimales'}
              </Text>
              <TouchableOpacity
                style={[styles.decimalSwitch, { backgroundColor: show5Decimals ? colors.primary : colors.outlineVariant }]}
                onPress={() => setShow5Decimals(!show5Decimals)}
                activeOpacity={0.7}
              >
                <View style={[styles.decimalSwitchThumb, {
                  backgroundColor: show5Decimals ? '#fff' : colors.outline,
                  transform: [{ translateX: show5Decimals ? 20 : 0 }]
                }]} />
              </TouchableOpacity>
            </View>
          </View>

          {['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd']
            .filter(tipo => cuentaConfig[tipo]?.length > 0)
            .map((tipo) => {
            const label = tipo.replace('_', ' ').toUpperCase();
            const hasCuentas = cuentaConfig[tipo]?.length > 0;
            const selectedCuenta = selectedCuentas[tipo];
            
            return (
              <View key={tipo} style={styles.paymentRow}>
                <View style={styles.paymentLabel}>
                  <Text style={[styles.paymentLabelText, { color: colors.onSurface }]}>{label}</Text>
                </View>
                
                <View style={styles.paymentInputRow}>
                  <TouchableOpacity
                    style={[styles.cuentaSelector, { backgroundColor: colors.background, borderColor: colors.outlineVariant, flex: 0.6 }]}
                    onPress={() => {
                      setSelectorTipoCuenta(tipo);
                      setShowCuentaSelector(true);
                    }}
                  >
                    <Text style={[styles.cuentaSelectorText, { color: selectedCuenta ? colors.onSurface : colors.outline }]} numberOfLines={1}>
                      {selectedCuenta?.nombre || 'Seleccionar cuenta...'}
                    </Text>
                    <Ionicons name="chevron-down" size={responsive.responsiveWidth(16)} color={colors.outline} />
                  </TouchableOpacity>
                  
                  <View style={{ flex: 0.4, marginTop: (tipo === 'efectivo_usd' || tipo === 'transferencia_usd') ? responsive.responsiveHeight(8) : 0 }}>
                    <TextInput
                      style={[
                        styles.paymentInput, 
                        { 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontSize: responsive.responsiveWidth(14)
                        }
                      ]}
                      placeholder={show5Decimals ? "0.00000" : "0.00"}
                      placeholderTextColor={colors.outline}
                      value={getPaymentDisplayValue(tipo)}
                      onChangeText={(text) => {
                        // Remove any minus signs
                        const sanitizedText = text.replace(/-/g, '');
                        setPaymentAmounts(prev => ({ ...prev, [tipo]: sanitizedText }));
                      }}
                      onFocus={() => setFocusedPaymentField(tipo)}
                      onBlur={() => {
                        setFocusedPaymentField(null);
                        // Format the value when field loses focus
                        const value = paymentAmounts[tipo];
                        if (value && value !== '') {
                          const num = parseFloat(value);
                          if (!isNaN(num)) {
                            const formatted = show5Decimals ? num.toFixed(5) : num.toFixed(2);
                            setPaymentAmounts(prev => ({ ...prev, [tipo]: formatted }));
                          }
                        }
                      }}
                      keyboardType="decimal-pad"
                    />
                    {(tipo === 'efectivo_usd' || tipo === 'transferencia_usd') && (
                      <Text style={[styles.conversionText, { color: colors.outline, fontSize: responsive.responsiveWidth(8) }]}>
                        {(() => {
                          const remainingCUP = getRemainingAmount();
                          const cambio = parseFloat(config.cupToUsdRate || 1);
                          const remainingUSD = remainingCUP > 0 ? (remainingCUP / cambio).toFixed(2) : '0.00';
                          return `(${show5Decimals ? formatNumber5Decimals(remainingCUP) : formatNumber2Decimals(remainingCUP)}) / (${cambio}) = (${remainingUSD})`;
                        })()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          <View style={[styles.totalSection, { backgroundColor: colors.primary }]}>
            <Text style={[styles.totalLabel, { color: '#fff' }]}>Total a pagar:</Text>
            <Text style={[styles.totalAmount, { color: '#fff' }]}>
              ${show5Decimals ? formatNumber5Decimals(calculateTotal()) : formatNumber2Decimals(calculateTotal())} CUP
            </Text>
          </View>

          {Math.abs(getRemainingAmount()) > 0.01 && (
            <View style={[styles.remainingSection, { backgroundColor: getRemainingAmount() > 0 ? colors.errorContainer : colors.secondaryContainer }]}>
              <Text style={[styles.remainingLabel, { color: getRemainingAmount() > 0 ? colors.error : colors.onSecondaryContainer }]}>
                {getRemainingAmount() > 0 ? 'Falta por pagar:' : 'Cambio a devolver:'}
              </Text>
              <Text style={[styles.remainingAmount, { color: getRemainingAmount() > 0 ? colors.error : colors.onSecondaryContainer }]}>
                ${show5Decimals ? formatNumber5Decimals(Math.abs(getRemainingAmount())) : formatNumber2Decimals(Math.abs(getRemainingAmount()))} CUP
              </Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Nota</Text>
          </View>
          <TextInput
            style={[styles.notaInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
            placeholder="Agregar nota a la venta (opcional)..."
            placeholderTextColor={colors.outline}
            value={ventaNota}
            onChangeText={setVentaNota}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmitSale}
          disabled={isSubmitting || saleItems.length === 0}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.submitButtonText, { color: '#fff' }]}>
                Realizar Venta
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Cuenta Selector Modal */}
      <Modal
        visible={showCuentaSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCuentaSelector(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Cuenta</Text>
              <TouchableOpacity onPress={() => setShowCuentaSelector(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {cuentaConfig[selectorTipoCuenta]?.map((cuenta) => (
                <TouchableOpacity
                  key={cuenta.id_cuenta}
                  style={[styles.modalItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => handleSelectCuenta(cuenta, selectorTipoCuenta)}
                >
                  <Text style={[styles.modalItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Sale Modal */}
      {showConfirmSaleModal && pendingSaleData && (
        <Modal
          visible={showConfirmSaleModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelSale}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmSaleModal, { backgroundColor: colors.surface }]}>
              <View style={styles.confirmSaleHeader}>
                <Ionicons name="alert-circle" size={responsive.responsiveWidth(32)} color={colors.error} />
                <Text style={[styles.confirmSaleTitle, { color: colors.onSurface }]}>Confirmar Venta</Text>
              </View>
              
              <Text style={[styles.confirmSaleMessage, { color: colors.onSurface }]}>
                ¿Estás seguro que deseas vender por el precio de{' '}
                <Text style={[styles.confirmSaleAmount, { color: colors.primary }]}>
                  ${pendingSaleData.totalPaidCUP.toFixed(2)} CUP
                </Text>
                {' '}cuando el precio real de la suma de los artículos suma{' '}
                <Text style={[styles.confirmSaleAmount, { color: colors.primary }]}>
                  ${pendingSaleData.totalOriginalCUP.toFixed(2)} CUP
                </Text>
                ?
              </Text>

              <View style={styles.confirmSaleButtons}>
                <TouchableOpacity
                  style={[styles.confirmSaleCancelButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.outline }]}
                  onPress={handleCancelSale}
                >
                  <Text style={[styles.confirmSaleCancelText, { color: colors.onSurface }]}>No</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.confirmSaleConfirmButton, 
                    { backgroundColor: colors.primary, opacity: confirmSaleCountdown > 0 ? 0.5 : 1 }
                  ]}
                  onPress={handleConfirmSale}
                  disabled={confirmSaleCountdown > 0}
                >
                  <Text style={[styles.confirmSaleConfirmText, { color: '#fff' }]}>
                    {confirmSaleCountdown > 0 ? confirmSaleCountdown : 'Sí'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Comprobante Modal */}
      <Modal
        visible={showComprobanteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowComprobanteModal(false);
          navigation.navigate('Ventas');
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Comprobante</Text>
              <TouchableOpacity onPress={() => {
                setShowComprobanteModal(false);
                navigation.navigate('Ventas');
              }}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalScrollContent}>
                <Text style={[styles.modalDescription, { color: colors.outline }]}>
                  Se generará un PDF con el comprobante de la venta.
                </Text>
                <View style={[styles.comprobantePreview, { backgroundColor: '#fff', borderColor: '#000' }]}>
                  {comprobanteConfig.logo && (
                    <View style={styles.comprobanteLogoContainer}>
                      <View style={styles.comprobanteLogo}>
                        <WebView
                          source={{
                            html: `
                              <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
                                <defs>
                                  <filter id="grayscale">
                                    <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0"/>
                                  </filter>
                                </defs>
                                <image href="${comprobanteConfig.logo}" width="100" height="100" filter="url(#grayscale)" preserveAspectRatio="xMidYMid meet"/>
                              </svg>
                            `
                          }}
                          style={{ width: '100%', height: '100%' }}
                          scrollEnabled={false}
                        />
                      </View>
                    </View>
                  )}
                  <Text style={styles.comprobanteNegocioName}>
                    {comprobanteConfig.nombreNegocio || 'Nombre del Negocio'}
                  </Text>
                  <Text style={[styles.comprobanteText, styles.comprobanteTextCentered]}>DEPENDIENTE: {user?.nombre_natural || 'N/A'}</Text>
                  <Text style={[styles.comprobanteText, styles.comprobanteTextCentered]}>
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                  <View style={styles.comprobanteTableHeader}>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Servicio/Producto</Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Cant</Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Total</Text>
                  </View>
                  <View style={styles.comprobanteLine} />
                  {comprobanteSaleItems.map((item, index) => (
                    <View key={index} style={styles.comprobanteTableRow}>
                      <Text style={styles.comprobanteTableColumn}>{item.nombre}</Text>
                      <Text style={styles.comprobanteTableColumn}>{item.cantidad}</Text>
                      <Text style={styles.comprobanteTableColumn}>${formatComprobanteNumber(item.cantidad * item.precio_cup)}</Text>
                    </View>
                  ))}
                  <View style={styles.comprobanteTableRow}>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>TOTAL</Text>
                    <Text style={styles.comprobanteTableColumn}></Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>${formatComprobanteNumber(comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0))}</Text>
                  </View>
                  <View style={styles.comprobanteLine} />
                  <Text style={[styles.comprobanteText, styles.comprobanteTextCentered]}>¡Gracias por su compra!</Text>
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: colors.primary }]}
                onPress={handleGenerateComprobante}
              >
                <Ionicons name="share-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={[styles.shareButtonText, { color: '#fff' }]}>Generar y Compartir PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Price Adjustment Modal */}
      {showPriceAdjustmentModal && (
        <Modal
          visible={showPriceAdjustmentModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowPriceAdjustmentModal(false);
            setPriceAdjustmentItems([]);
            setPendingSaleDataForAdjustment(null);
          }}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Ajustar Precios por Producto</Text>
                <TouchableOpacity onPress={() => {
                  setShowPriceAdjustmentModal(false);
                  setPriceAdjustmentItems([]);
                  setPendingSaleDataForAdjustment(null);
                }}>
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalScroll}>
                <Text style={[styles.modalDescription, { color: colors.outline }]}>
                  El monto cobrado difiere del total de la venta. Ajuste el precio de cada producto según corresponda.
                </Text>
                
                {priceAdjustmentItems.map((item, index) => (
                  <View key={index} style={[styles.priceAdjustmentItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                    <Text style={[styles.priceAdjustmentProductName, { color: colors.onSurface }]}>
                      {item.nombre} x{item.cantidad}
                    </Text>
                    
                    <View style={styles.priceAdjustmentRow}>
                      {pendingSaleDataForAdjustment?.saleCurrency === 'CUP' ? (
                        <View style={styles.priceAdjustmentField}>
                          <Text style={[styles.priceAdjustmentLabel, { color: colors.outline }]}>Precio CUP:</Text>
                          <TextInput
                            style={[styles.priceAdjustmentInput, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, color: colors.onSurface }]}
                            value={item.precio_cup_ajustado?.toString() || ''}
                            onChangeText={(text) => {
                              const newItems = [...priceAdjustmentItems];
                              const newPriceCUP = parseFloat(text) || 0;
                              newItems[index].precio_cup_ajustado = newPriceCUP;
                              // Auto-convert to USD
                              const cambio = pendingSaleDataForAdjustment?.cambio || 1;
                              newItems[index].precio_usd_ajustado = roundTo5Decimals(newPriceCUP / cambio);
                              setPriceAdjustmentItems(newItems);
                            }}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      ) : (
                        <View style={styles.priceAdjustmentField}>
                          <Text style={[styles.priceAdjustmentLabel, { color: colors.outline }]}>Precio USD:</Text>
                          <TextInput
                            style={[styles.priceAdjustmentInput, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, color: colors.onSurface }]}
                            value={item.precio_usd_ajustado?.toString() || ''}
                            onChangeText={(text) => {
                              const newItems = [...priceAdjustmentItems];
                              const newPriceUSD = parseFloat(text) || 0;
                              newItems[index].precio_usd_ajustado = newPriceUSD;
                              // Auto-convert to CUP
                              const cambio = pendingSaleDataForAdjustment?.cambio || 1;
                              newItems[index].precio_cup_ajustado = roundTo5Decimals(newPriceUSD * cambio);
                              setPriceAdjustmentItems(newItems);
                            }}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowPriceAdjustmentModal(false);
                    setPriceAdjustmentItems([]);
                    setPendingSaleDataForAdjustment(null);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleProcessSaleWithAdjustedPrices}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Confirmar Venta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    </SafeAreaView>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: responsive.responsiveWidth(16),
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(20),
  },
  permissionButton: {
    paddingHorizontal: responsive.responsiveWidth(30),
    paddingVertical: responsive.responsiveHeight(15),
    borderRadius: responsive.responsiveWidth(10),
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsive.responsiveWidth(16),
    paddingVertical: responsive.responsiveHeight(12),
    borderBottomWidth: 1,
  },
  backButton: {
    padding: responsive.responsiveWidth(8),
  },
  headerTitle: {
    fontSize: responsive.responsiveWidth(20),
    fontWeight: '700',
  },
  cameraToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsiveWidth(8),
  },
  cameraToggleText: {
    fontSize: responsive.responsiveWidth(12),
    marginLeft: responsive.responsiveWidth(4),
  },
  content: {
    flex: 1,
    padding: responsive.responsiveWidth(16),
  },
  cameraContainer: {
    height: responsive.responsiveHeight(250),
    backgroundColor: '#000',
    borderRadius: responsive.responsiveWidth(12),
    marginBottom: responsive.responsiveHeight(16),
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderColor: '#fff',
    borderWidth: responsive.responsiveWidth(3),
  },
  topLeft: {
    top: responsive.responsiveHeight(80),
    left: responsive.responsiveWidth(40),
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: responsive.responsiveHeight(80),
    right: responsive.responsiveWidth(40),
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: responsive.responsiveHeight(80),
    left: responsive.responsiveWidth(40),
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: responsive.responsiveHeight(80),
    right: responsive.responsiveWidth(40),
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  cameraHint: {
    fontSize: responsive.responsiveWidth(14),
    marginTop: responsive.responsiveHeight(20),
    textAlign: 'center',
  },
  manualInputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsiveWidth(20),
  },
  manualInputTitle: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    marginBottom: responsive.responsiveHeight(20),
  },
  manualCodeInput: {
    width: '100%',
    padding: responsive.responsiveWidth(15),
    borderRadius: responsive.responsiveWidth(10),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(16),
    marginBottom: responsive.responsiveHeight(15),
    textAlign: 'center',
  },
  addManualCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(20),
    paddingVertical: responsive.responsiveHeight(12),
    borderRadius: responsive.responsiveWidth(10),
  },
  addManualCodeButtonText: {
    color: '#fff',
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(8),
  },
  toggleModeButton: {
    position: 'absolute',
    bottom: responsive.responsiveHeight(20),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(15),
    paddingVertical: responsive.responsiveHeight(10),
    borderRadius: responsive.responsiveWidth(20),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  toggleModeButtonText: {
    fontSize: responsive.responsiveWidth(12),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(5),
    color: '#fff',
  },
  sectionCard: {
    marginBottom: responsive.responsiveHeight(16),
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(12),
  },
  sectionHeader: {
    marginBottom: responsive.responsiveHeight(12),
  },
  sectionTitle: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '600',
  },
  sectionHeaderWithSwitch: {
    marginBottom: responsive.responsiveHeight(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  decimalSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  decimalLabel: {
    fontSize: responsive.responsiveWidth(12),
    marginRight: responsive.responsiveWidth(8),
  },
  decimalSwitch: {
    width: responsive.responsiveWidth(44),
    height: responsive.responsiveHeight(24),
    borderRadius: responsive.responsiveWidth(12),
    padding: responsive.responsiveWidth(2),
    justifyContent: 'center',
  },
  decimalSwitchThumb: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
    borderRadius: responsive.responsiveWidth(10),
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsive.responsiveWidth(12),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: responsive.responsiveWidth(14),
  },
  tiendaInfoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tiendaInfoText: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  dependienteInfoText: {
    fontSize: responsive.responsiveWidth(12),
    marginTop: responsive.responsiveHeight(2),
  },
  dropdownMenu: {
    maxHeight: responsive.responsiveHeight(200),
    marginTop: responsive.responsiveHeight(8),
  },
  dropdownItem: {
    padding: responsive.responsiveWidth(12),
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dropdownItemText: {
    fontSize: responsive.responsiveWidth(14),
  },
  searchInput: {
    flex: 1,
    marginLeft: responsive.responsiveWidth(8),
    fontSize: responsive.responsiveWidth(14),
    padding: 0,
    height: responsive.responsiveHeight(20),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  searchDropdown: {
    marginTop: responsive.responsiveHeight(8),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsiveWidth(16),
  },
  dropdownLoadingText: {
    marginLeft: responsive.responsiveWidth(8),
    fontSize: responsive.responsiveWidth(14),
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(180),
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemSubtext: {
    fontSize: responsive.responsiveWidth(12),
    marginTop: responsive.responsiveHeight(2),
  },
  dropdownItemSubtextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsive.responsiveHeight(4),
  },
  dropdownItemPrice: {
    fontSize: responsive.responsiveWidth(12),
    fontWeight: '600',
  },
  dropdownEmptyText: {
    fontSize: responsive.responsiveWidth(14),
    textAlign: 'center',
    paddingVertical: responsive.responsiveHeight(16),
  },
  emptyText: {
    fontSize: responsive.responsiveWidth(14),
    textAlign: 'center',
    paddingVertical: responsive.responsiveHeight(20),
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsiveWidth(12),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    marginBottom: responsive.responsiveHeight(8),
  },
  itemImage: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveHeight(50),
    borderRadius: responsive.responsiveWidth(8),
    marginRight: responsive.responsiveWidth(12),
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    marginBottom: responsive.responsiveHeight(4),
  },
  itemPrice: {
    fontSize: responsive.responsiveWidth(12),
  },
  offerBadge: {
    fontSize: responsive.responsiveWidth(10),
    fontWeight: '600',
    marginTop: responsive.responsiveHeight(4),
  },
  componentsContainer: {
    marginTop: responsive.responsiveHeight(4),
  },
  componentText: {
    fontSize: responsive.responsiveWidth(11),
    marginTop: responsive.responsiveHeight(2),
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: responsive.responsiveWidth(8),
  },
  quantityButton: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: responsive.responsiveWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    marginHorizontal: responsive.responsiveWidth(8),
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  quantityInput: {
    marginHorizontal: responsive.responsiveWidth(8),
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    minWidth: responsive.responsiveWidth(30),
    maxWidth: responsive.responsiveWidth(40),
    textAlign: 'center',
    padding: 0,
  },
  deleteButton: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: responsive.responsiveWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRow: {
    marginBottom: responsive.responsiveHeight(12),
  },
  paymentLabel: {
    marginBottom: responsive.responsiveHeight(4),
  },
  paymentLabelText: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  noCuentaWarning: {
    fontSize: responsive.responsiveWidth(10),
    marginTop: responsive.responsiveHeight(2),
  },
  cuentaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsive.responsiveWidth(10),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
  },
  paymentInputRow: {
    flexDirection: 'row',
    gap: responsive.responsiveWidth(8),
    alignItems: 'center',
  },
  cuentaSelectorText: {
    fontSize: responsive.responsiveWidth(12),
  },
  paymentInput: {
    padding: responsive.responsiveWidth(10),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(14),
    textAlign: 'right',
    height: responsive.responsiveHeight(40),
    marginTop: 0,
  },
  conversionText: {
    marginTop: responsive.responsiveHeight(2),
    textAlign: 'right',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(8),
  },
  totalLabel: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
  },
  remainingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(8),
    overflow: 'hidden',
  },
  remainingLabel: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  remainingAmount: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '700',
  },
  notaInput: {
    padding: responsive.responsiveWidth(12),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(14),
    textAlignVertical: 'top',
    minHeight: responsive.responsiveHeight(80),
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsiveHeight(16),
    borderRadius: responsive.responsiveWidth(12),
    marginBottom: responsive.responsiveHeight(24),
  },
  submitButtonText: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(8),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  confirmSaleModal: {
    width: '85%',
    maxWidth: responsive.responsiveWidth(400),
    borderRadius: responsive.responsiveWidth(16),
    padding: responsive.responsivePadding(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmSaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  confirmSaleTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginLeft: responsive.responsiveMargin(12),
  },
  confirmSaleMessage: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    lineHeight: 24,
    marginBottom: responsive.responsiveMargin(24),
  },
  confirmSaleAmount: {
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  confirmSaleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsive.responsiveMargin(12),
  },
  confirmSaleCancelButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmSaleCancelText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  confirmSaleConfirmButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    alignItems: 'center',
  },
  confirmSaleConfirmText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    borderRadius: responsive.responsiveWidth(16),
    padding: responsive.responsiveWidth(20),
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveHeight(16),
  },
  modalTitle: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: responsive.responsiveHeight(8),
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: responsive.responsiveHeight(16),
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: responsive.responsiveHeight(8),
  },
  modalItem: {
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    marginBottom: responsive.responsiveHeight(8),
  },
  modalItemText: {
    fontSize: responsive.responsiveWidth(14),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsiveHeight(16),
    borderRadius: responsive.responsiveWidth(8),
    alignItems: 'center',
    marginHorizontal: responsive.responsiveWidth(4),
  },
  modalButtonText: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
  priceAdjustmentItem: {
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    marginBottom: responsive.responsiveHeight(12),
  },
  priceAdjustmentProductName: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    marginBottom: responsive.responsiveHeight(12),
  },
  priceAdjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceAdjustmentField: {
    flex: 1,
    marginRight: responsive.responsiveWidth(8),
  },
  priceAdjustmentLabel: {
    fontSize: responsive.responsiveWidth(12),
    marginBottom: responsive.responsiveHeight(4),
  },
  priceAdjustmentInput: {
    padding: responsive.responsiveWidth(10),
    borderRadius: responsive.responsiveWidth(6),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(14),
  },
  modalDescription: {
    fontSize: responsive.responsiveWidth(14),
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(16),
  },
  comprobantePreview: {
    flex: 1,
    padding: responsive.responsiveWidth(20),
    borderRadius: responsive.responsiveWidth(8),
    backgroundColor: '#fff',
  },
  comprobanteContainer: {
    padding: responsive.responsiveWidth(20),
    borderRadius: responsive.responsiveWidth(8),
  },
  comprobanteLogo: {
    width: responsive.responsiveWidth(80),
    height: responsive.responsiveHeight(80),
    alignSelf: 'center',
    marginBottom: responsive.responsiveHeight(12),
  },
  comprobanteBusinessName: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(8),
  },
  comprobanteTitle: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(8),
  },
  comprobanteDate: {
    fontSize: responsive.responsiveWidth(12),
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(16),
  },
  comprobanteDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: responsive.responsiveHeight(12),
  },
  comprobanteItem: {
    marginBottom: responsive.responsiveHeight(8),
  },
  comprobanteItemName: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  comprobanteItemDetails: {
    fontSize: responsive.responsiveWidth(12),
    color: '#666',
  },
  comprobanteTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsive.responsiveHeight(16),
  },
  comprobanteTotalLabel: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
  },
  comprobanteTotalAmount: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
  },
  comprobanteLogoContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveHeight(10),
  },
  comprobanteNegocioName: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(10),
  },
  comprobanteText: {
    fontSize: responsive.responsiveWidth(12),
    marginBottom: responsive.responsiveHeight(5),
  },
  comprobanteTextCentered: {
    textAlign: 'center',
  },
  comprobanteTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveHeight(5),
  },
  comprobanteTableColumn: {
    flex: 1,
    fontSize: responsive.responsiveWidth(12),
  },
  comprobanteTableColumnBold: {
    fontWeight: 'bold',
  },
  comprobanteLine: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: responsive.responsiveHeight(10),
  },
  comprobanteTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveHeight(5),
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsiveHeight(16),
    borderRadius: responsive.responsiveWidth(12),
    marginTop: responsive.responsiveHeight(16),
  },
  shareButtonText: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(8),
    color: '#fff',
  },
});

export default SalesContent;
