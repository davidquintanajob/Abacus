import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, Dimensions, Image, Vibration, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { getCuentas } from '../services/cuentaService';
import { getOfertaById } from '../services/ofertaService';
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
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const { user, ventaAccessLevels, cuentaChangePermissions } = useAuth();
  const [permission, setPermission] = useState(null);

  const [isScanning, setIsScanning] = useState(true);
  const [sound, setSound] = useState();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showCamera, setShowCamera] = useState(true);

  const [saleItems, setSaleItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [ventaNota, setVentaNota] = useState('');
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState(null);
  const [availableCuentas, setAvailableCuentas] = useState([]);

  const [config, setConfig] = useState({});
  const [comprobanteConfig, setComprobanteConfig] = useState({
    logo: null,
    nombreNegocio: '',
  });
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteSaleItems, setComprobanteSaleItems] = useState([]);

  const barcodeEngineRef = useRef(null);

  useEffect(() => {
    barcodeEngineRef.current = new BarcodeEngine('SALES');
    return () => {
      if (barcodeEngineRef.current && typeof barcodeEngineRef.current.cleanup === 'function') {
        barcodeEngineRef.current.cleanup();
      }
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
          const filters = { nombre: searchText, fetchProducto: true };
          if (selectedTienda) {
            filters.id_tienda = selectedTienda.id_tienda;
          }
          const data = await getServicios(filters, 1, 10);
          
          // Filter out products with zero stock in the selected store
          const filteredResults = (data.data || []).filter(servicio => {
            if (!selectedTienda) return true;
            const servicioTienda = servicio.tiendas_servicio?.find(t => t.id_tienda === selectedTienda.id_tienda);
            // Allow services without tienda relationship (cantidad could be null/undefined)
            if (!servicioTienda) return false;
            const stock = parseFloat(servicioTienda.cantidad || 0);
            return stock > 0;
          });
          
          setSearchResults(filteredResults);
          setShowSearchDropdown(true);
        } catch (error) {
          console.error('Error searching productos:', error);
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

  useEffect(() => {
    barcodeEngineRef.current.startSession();
    
    loadConfig();
    loadInitialData();
    loadApiBaseUrl();

    return () => {
      if (barcodeEngineRef.current) {
        barcodeEngineRef.current.resetSession();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadApiBaseUrl = async () => {
    const baseUrl = await getApiBaseUrl();
    setApiBaseUrl(baseUrl);
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
      console.error('Error loading config:', error);
    }
  };

  // Auto-select first configured account for each type
  useEffect(() => {
    if (cuentaConfig) {
      const newSelectedCuentas = {};
      ['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd'].forEach(tipo => {
        if (cuentaConfig[tipo]?.length > 0) {
          newSelectedCuentas[tipo] = cuentaConfig[tipo][0];
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
      console.error('Error loading initial data:', error);
      showToast({ type: 'error', message: 'Error al cargar datos iniciales' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCuentaConfig = async (tiendaId) => {
    try {
      const data = await configService.getConfig();
      if (data.tiendaCuentasConfig && data.tiendaCuentasConfig[tiendaId]) {
        setCuentaConfig(data.tiendaCuentasConfig[tiendaId]);
      }
    } catch (error) {
      console.error('Error loading cuenta config:', error);
    }
  };

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    const loadSound = async () => {
      try {
        // Sound loading disabled temporarily to fix Audio import error
        // const { Audio } = await import('expo-av');
        // const { sound } = await Audio.Sound.createAsync(
        //   require('../../assets/beep.mp3'),
        //   { shouldPlay: false }
        // );
        // setSound(sound);
      } catch (error) {
        console.log('Error loading sound:', error);
      }
    };

    loadSound();
  }, []);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    }
  };

  const handleBarcodeScanned = async (scanningResult) => {
    if (!isScanning || !barcodeEngineRef.current) {
      return;
    }

    try {
      const rawCode = scanningResult.data;
      
      // Disable scanning immediately to prevent duplicate detections
      setIsScanning(false);

      const result = await barcodeEngineRef.current.processScanningResult({ 
        data: rawCode, 
        type: scanningResult.type 
      });
      
      if (result && result.success) {
        await addProductByCode(rawCode);
      }

      // Re-enable scanning after 1.5 seconds
      setTimeout(() => {
        setIsScanning(true);
      }, 1500);
    } catch (error) {
      console.error('Error processing barcode:', error);
      showToast({ type: 'error', message: 'Error al procesar código' });
      
      // Re-enable scanning on error
      setTimeout(() => {
        setIsScanning(true);
      }, 1500);
    }
  };

  const addProductByCode = async (code) => {
    try {
      console.log('[SalesScreen] addProductByCode called with code:', code);
      console.log('[SalesScreen] selectedTienda:', selectedTienda);

      if (!selectedTienda) {
        showToast({ type: 'warning', message: 'Selecciona una tienda primero' });
        return;
      }

      // Check if product already exists in sale list
      const existingItem = saleItems.find(item => 
        item.codigo_barras_ean?.trim().toLowerCase() === code.trim().toLowerCase()
      );

      if (existingItem) {
        console.log('[SalesScreen] Product already in list, increasing quantity');
        updateItemQuantity(saleItems.indexOf(existingItem), existingItem.cantidad + 1);
        if (Platform.OS === 'android') {
          Vibration.vibrate(100);
        }
        playSound();
        showToast({ type: 'success', message: 'Cantidad aumentada' });
        return;
      }

      // Use getServicios with codigo filter to search both services and products
      const filters = { codigo: code, fetchProducto: true };
      console.log('[SalesScreen] Searching with filters:', filters);
      
      const data = await getServicios(filters, 1, 10);
      console.log('[SalesScreen] Search results:', data);
      
      const servicio = data.data?.[0];

      if (!servicio) {
        console.log('[SalesScreen] No service/product found with code:', code);
        showToast({ type: 'error', message: 'Producto o servicio no encontrado' });
        return;
      }

      console.log('[SalesScreen] Found servicio:', servicio);
      console.log('[SalesScreen] Servicio tiendas_servicio:', servicio.tiendas_servicio);

      // Find the servicio_tienda for the selected store (using tiendas_servicio, not tiendas)
      const servicioTienda = servicio.tiendas_servicio?.find(t => t.id_tienda === selectedTienda.id_tienda);

      if (!servicioTienda) {
        console.log('[SalesScreen] No servicio_tienda found for tienda:', selectedTienda.id_tienda);
        showToast({ type: 'error', message: 'Producto no disponible en esta tienda' });
        return;
      }

      console.log('[SalesScreen] Found servicioTienda:', servicioTienda);

      const newItem = {
        id_servicio_tienda: servicioTienda.id_servicio_tienda,
        id_servicio: servicio.id_servicio,
        codigo_barras_ean: code,
        nombre: servicio.nombre || 'Sin nombre',
        imagen: servicio.producto?.imagen || null,
        cantidad: 1,
        precio_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_usd: parseFloat(servicioTienda.precio_usd || 0),
        esOferta: servicio.ofertas_que_incluyen?.length > 0,
        componentes: [],
      };

      // If it's an offer, load components
      if (newItem.esOferta && servicio.ofertas_que_incluyen?.length > 0) {
        try {
          const ofertaId = servicio.ofertas_que_incluyen[0].id_oferta;
          const oferta = await getOfertaById(ofertaId);
          if (oferta && oferta.componentes) {
            newItem.componentes = oferta.componentes.map(comp => ({
              nombre: comp.servicio?.nombre || 'Componente',
              cantidad: comp.cantidad || 1
            }));
          }
        } catch (error) {
          console.error('Error loading offer components:', error);
        }
      }

      console.log('[SalesScreen] Adding item to sale:', newItem);
      setSaleItems(prev => [...prev, newItem]);
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
      playSound();
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
    } catch (error) {
      console.error('[SalesScreen] Error adding product:', error);
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
        console.log('[SalesScreen] Product already in list, increasing quantity');
        updateItemQuantity(saleItems.indexOf(existingItem), existingItem.cantidad + 1);
        if (Platform.OS === 'android') {
          Vibration.vibrate(100);
        }
        playSound();
        showToast({ type: 'success', message: 'Cantidad aumentada' });
        setSearchText('');
        return;
      }

      const newItem = {
        id_servicio_tienda: servicioTienda.id_servicio_tienda,
        id_servicio: servicio.id_servicio,
        codigo_barras_ean: servicio.codigos?.[0]?.codigo_barras_ean || '',
        nombre: servicio.nombre || 'Sin nombre',
        imagen: servicio.producto?.imagen || null,
        cantidad: 1,
        precio_cup: parseFloat(servicioTienda.precio_cup || 0),
        precio_usd: parseFloat(servicioTienda.precio_usd || 0),
        esOferta: servicio.ofertas_que_incluyen?.length > 0,
        componentes: [],
      };

      // If it's an offer, load components
      if (newItem.esOferta && servicio.ofertas_que_incluyen?.length > 0) {
        try {
          const ofertaId = servicio.ofertas_que_incluyen[0].id_oferta;
          const oferta = await getOfertaById(ofertaId);
          if (oferta && oferta.componentes) {
            newItem.componentes = oferta.componentes.map(comp => ({
              nombre: comp.servicio?.nombre || 'Componente',
              cantidad: comp.cantidad || 1
            }));
          }
        } catch (error) {
          console.error('Error loading offer components:', error);
        }
      }

      console.log('[SalesScreen] Adding item to sale:', newItem);
      setSaleItems(prev => [...prev, newItem]);
      if (Platform.OS === 'android') {
        Vibration.vibrate(100);
      }
      playSound();
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
      setSearchText('');
    } catch (error) {
      console.error('[SalesScreen] Error adding product:', error);
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
    const cup = parseFloat(paymentAmounts.efectivo_cup || 0) + parseFloat(paymentAmounts.transferencia_cup || 0);
    const usd = parseFloat(paymentAmounts.efectivo_usd || 0) + parseFloat(paymentAmounts.transferencia_usd || 0);
    const cambio = parseFloat(config.cupToUsdRate || 1);
    return cup + (usd * cambio);
  };

  const getRemainingAmount = () => {
    return calculateTotal() - calculatePaidTotal();
  };

  const handleSelectCuenta = (cuenta, tipoCuenta) => {
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

    const remaining = getRemainingAmount();
    if (remaining > 0.01) {
      showToast({ type: 'error', message: `Falta por pagar: $${remaining.toFixed(2)} CUP` });
      return;
    }

    try {
      setIsSubmitting(true);

      const ventaData = {
        fecha_hora: new Date().toISOString(),
        nota: ventaNota,
        cantidad_cobrada_efectivo_cup: parseFloat(paymentAmounts.efectivo_cup || 0),
        cantidad_cobrada_efectivo_usd: parseFloat(paymentAmounts.efectivo_usd || 0),
        cantidad_cobrada_transferencia_cup: parseFloat(paymentAmounts.transferencia_cup || 0),
        cantidad_cobrada_transferencia_usd: parseFloat(paymentAmounts.transferencia_usd || 0),
        id_cuenta_efectivo_cup: selectedCuentas.efectivo_cup?.id_cuenta || null,
        id_cuenta_efectivo_usd: selectedCuentas.efectivo_usd?.id_cuenta || null,
        id_cuenta_transferencia_cup: selectedCuentas.transferencia_cup?.id_cuenta || null,
        id_cuenta_transferencia_usd: selectedCuentas.transferencia_usd?.id_cuenta || null,
        id_usuario: user.id_usuario,
        cambio_moneda: config.cupToUsdRate || 1,
        ventas: saleItems.map(item => ({
          id_servicio_tienda: item.id_servicio_tienda,
          cantidad: item.cantidad,
          precio_cobrado_cup: item.precio_cup,
          precio_cobrado_usd: item.precio_usd,
        })),
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
    } catch (error) {
      console.error('Error submitting sale:', error);
      const errorMessage = error.response?.data?.errors?.[0] || error.message || 'Error al realizar venta';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateComprobante = async () => {
    try {
      const totalCUP = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0);
      const totalUSD = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_usd), 0);

      // Use logo directly — it's stored as a base64 data URI or remote URL
      let logoBase64 = '';
      if (comprobanteConfig.logo) {
        logoBase64 = comprobanteConfig.logo; // already a data: URI or https:// URL
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
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .logo {
              max-width: 100px;
              max-height: 100px;
              margin-bottom: 10px;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 5px;
            }
            .date {
              font-size: 12px;
              color: #666;
              margin-bottom: 20px;
            }
            .divider {
              border-top: 1px solid #e0e0e0;
              margin: 15px 0;
            }
            .item {
              margin-bottom: 10px;
            }
            .item-name {
              font-weight: 600;
              font-size: 14px;
            }
            .item-details {
              font-size: 12px;
              color: #666;
            }
            .total {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              font-size: 18px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo" />` : ''}
            ${comprobanteConfig.nombreNegocio ? `<div class="business-name">${comprobanteConfig.nombreNegocio}</div>` : ''}
            <div class="title">COMPROBANTE DE PAGO</div>
            <div class="date">${new Date().toLocaleString()}</div>
          </div>
          <div class="divider"></div>
          ${comprobanteSaleItems.map(item => `
            <div class="item">
              <div class="item-name">${item.nombre}</div>
              <div class="item-details">${item.cantidad} x $${item.precio_cup.toFixed(2)} = $${(item.cantidad * item.precio_cup).toFixed(2)}</div>
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="total">
            <span>TOTAL:</span>
            <span>$${totalCUP.toFixed(2)} CUP</span>
          </div>
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
      
      // Close modal and navigate to VentasScreen after sharing
      setShowComprobanteModal(false);
      navigation.navigate('Ventas');
    } catch (error) {
      console.error('Error generating comprobante:', error);
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Camera Section */}
        {showCamera && !isKeyboardVisible && (
          <View style={styles.cameraContainer}>
            <CameraView
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
          </View>
          
          {showTiendaSelector && (
            <ScrollView style={styles.dropdownMenu} nestedScrollEnabled={true}>
              {availableTiendas.map((tienda) => (
                <TouchableOpacity
                  key={tienda.id_tienda}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedTienda(tienda);
                    setShowTiendaSelector(false);
                    loadCuentaConfig(tienda.id_tienda);
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
            <Ionicons name="search" size={responsive.responsiveWidth(20)} color={colors.outline} />
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
                  {searchResults.map((servicio, index) => (
                    <TouchableOpacity
                      key={servicio.id_servicio}
                      style={[styles.dropdownItem, index === searchResults.length - 1 && styles.dropdownItemLast]}
                      onPress={() => addProductBySearch(servicio)}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                      {servicio.producto && (
                        <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>Producto</Text>
                      )}
                    </TouchableOpacity>
                  ))}
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
                {item.imagen && (() => {
                  const isBase64 = item.imagen.startsWith('data:');
                  let fullImageUrl;
                  if (isBase64) {
                    fullImageUrl = item.imagen;
                  } else {
                    // Ensure proper URL construction
                    const imagePath = item.imagen.startsWith('/') ? item.imagen : `/${item.imagen}`;
                    fullImageUrl = apiBaseUrl ? `${apiBaseUrl}${imagePath}` : item.imagen;
                  }
                  return (
                    <Image 
                      source={{ uri: fullImageUrl }} 
                      style={styles.itemImage}
                      onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                    />
                  );
                })()}
                <View style={styles.itemContent}>
                  <Text style={[styles.itemName, { color: colors.onSurface }]}>{item.nombre}</Text>
                  <Text style={[styles.itemPrice, { color: colors.outline }]}>
                    ${item.precio_cup.toFixed(2)} CUP / ${item.precio_usd.toFixed(2)} USD
                  </Text>
                  {item.esOferta && (
                    <Text style={[styles.offerBadge, { color: colors.primary }]}>Oferta</Text>
                  )}
                  {item.esOferta && item.componentes && item.componentes.length > 0 && (
                    <View style={styles.componentsContainer}>
                      {item.componentes.map((comp, compIndex) => (
                        <Text key={compIndex} style={[styles.componentText, { color: colors.outline }]}>
                          • {comp.nombre} x{comp.cantidad}
                        </Text>
                      ))}
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Pago</Text>
          </View>

          {['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd'].map((tipo) => {
            const label = tipo.replace('_', ' ').toUpperCase();
            const hasCuentas = cuentaConfig[tipo]?.length > 0;
            const selectedCuenta = selectedCuentas[tipo];
            
            return (
              <View key={tipo} style={styles.paymentRow}>
                <View style={styles.paymentLabel}>
                  <Text style={[styles.paymentLabelText, { color: colors.onSurface }]}>{label}</Text>
                  {!hasCuentas && (
                    <Text style={[styles.noCuentaWarning, { color: colors.error }]}>
                      Sin cuenta asignada
                    </Text>
                  )}
                </View>
                
                {hasCuentas && (
                  <View style={styles.paymentInputRow}>
                    <TouchableOpacity
                      style={[styles.cuentaSelector, { backgroundColor: colors.background, borderColor: colors.outlineVariant, flex: 0.6 }]}
                      onPress={() => {
                        setSelectorTipoCuenta(tipo);
                        setShowCuentaSelector(true);
                      }}
                      disabled={!hasCuentas}
                    >
                      <Text style={[styles.cuentaSelectorText, { color: selectedCuenta ? colors.onSurface : colors.outline }]} numberOfLines={1}>
                        {selectedCuenta?.nombre || 'Seleccionar cuenta...'}
                      </Text>
                      <Ionicons name="chevron-down" size={responsive.responsiveWidth(16)} color={colors.outline} />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={[styles.paymentInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, flex: 0.4 }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.outline}
                      value={paymentAmounts[tipo]}
                      onChangeText={(text) => {
                        // Remove any minus signs
                        const sanitizedText = text.replace(/-/g, '');
                        setPaymentAmounts(prev => ({ ...prev, [tipo]: sanitizedText }));
                      }}
                      keyboardType="decimal-pad"
                      editable={hasCuentas}
                    />
                  </View>
                )}
              </View>
            );
          })}

          <View style={[styles.totalSection, { backgroundColor: colors.primary }]}>
            <Text style={[styles.totalLabel, { color: '#fff' }]}>Total a pagar:</Text>
            <Text style={[styles.totalAmount, { color: '#fff' }]}>
              ${calculateTotal().toFixed(2)} CUP
            </Text>
          </View>

          <View style={[styles.remainingSection, { backgroundColor: getRemainingAmount() > 0 ? colors.errorContainer : colors.successContainer }]}>
            <Text style={[styles.remainingLabel, { color: getRemainingAmount() > 0 ? colors.error : '#fff' }]}>
              {getRemainingAmount() > 0 ? 'Falta por pagar:' : 'Pago completo:'}
            </Text>
            <Text style={[styles.remainingAmount, { color: getRemainingAmount() > 0 ? colors.error : '#fff' }]}>
              ${Math.abs(getRemainingAmount()).toFixed(2)} CUP
            </Text>
          </View>

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
                <View style={styles.comprobantePreview}>
                  {comprobanteConfig.logo && (
                    <Image source={{ uri: comprobanteConfig.logo }} style={styles.comprobanteLogo} />
                  )}
                  {comprobanteConfig.nombreNegocio && (
                    <Text style={styles.comprobanteBusinessName}>{comprobanteConfig.nombreNegocio}</Text>
                  )}
                  <Text style={styles.comprobanteTitle}>COMPROBANTE DE PAGO</Text>
                  <Text style={styles.comprobanteDate}>{new Date().toLocaleString()}</Text>
                  
                  <View style={styles.comprobanteDivider} />
                  
                  {comprobanteSaleItems.map((item, index) => (
                    <View key={index} style={styles.comprobanteItem}>
                      <Text style={styles.comprobanteItemName}>{item.nombre}</Text>
                      <Text style={styles.comprobanteItemDetails}>
                        {item.cantidad} x ${item.precio_cup.toFixed(2)} = ${(item.cantidad * item.precio_cup).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  
                  <View style={styles.comprobanteDivider} />
                  
                  <View style={styles.comprobanteTotal}>
                    <Text style={styles.comprobanteTotalLabel}>TOTAL:</Text>
                    <Text style={styles.comprobanteTotalAmount}>${comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0).toFixed(2)} CUP</Text>
                  </View>
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
  },
  comprobanteTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comprobanteTotalLabel: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '700',
  },
  comprobanteTotalAmount: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
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
