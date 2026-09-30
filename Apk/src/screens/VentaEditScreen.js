import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, Dimensions, Image, Vibration, Modal } from 'react-native';
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
import { getVentaById, updateVenta } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getApiBaseUrl } from '../services/api';
import { getUsuarios } from '../services/usuarioService';
import { getServicios } from '../services/servicioService';
import { getCuentas } from '../services/cuentaService';
import configService from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, Camera } from 'expo-camera';
import { ALLOWED_BARCODE_TYPES } from '../barcode/config/BarcodeTypes';

const VentaEditContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { venta, mode } = route.params || {};

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit' || !mode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingVenta, setIsFetchingVenta] = useState(false);

  // Camera state (disabled by default)
  const [permission, setPermission] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // SalesScreen-like state
  const [selectedTienda, setSelectedTienda] = useState(null);
  const [availableTiendas, setAvailableTiendas] = useState([]);
  const [showTiendaSelector, setShowTiendaSelector] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [saleItems, setSaleItems] = useState([]);
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
  const [show5Decimals, setShow5Decimals] = useState(false);
  const [ventaNota, setVentaNota] = useState('');
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState(null);
  const [availableCuentas, setAvailableCuentas] = useState([]);
  const [cupToUsdRate, setCupToUsdRate] = useState(1);
  // Track which payment field is focused to prevent formatting while typing
  const [focusedPaymentField, setFocusedPaymentField] = useState(null);

  // Original VentaEditScreen state
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showUsuarioDropdown, setShowUsuarioDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showCuentaEfectivoCupDropdown, setShowCuentaEfectivoCupDropdown] = useState(false);
  const [showCuentaEfectivoUsdDropdown, setShowCuentaEfectivoUsdDropdown] = useState(false);
  const [showCuentaTransferenciaCupDropdown, setShowCuentaTransferenciaCupDropdown] = useState(false);
  const [showCuentaTransferenciaUsdDropdown, setShowCuentaTransferenciaUsdDropdown] = useState(false);
  
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const searchDebounceRef = useRef(null);

  const [formData, setFormData] = useState({
    fecha_hora: new Date().toISOString(),
    nota: '',
    cantidad_cobrada_efectivo_cup: '',
    cantidad_cobrada_efectivo_usd: '',
    cantidad_cobrada_transferencia_cup: '',
    cantidad_cobrada_transferencia_usd: '',
    id_cuenta_efectivo_cup: null,
    id_cuenta_efectivo_usd: null,
    id_cuenta_transferencia_cup: null,
    id_cuenta_transferencia_usd: null,
    id_usuario: user?.id_usuario || null,
    cambio_moneda: '',
    ventas: [],
  });

  const [ventaItems, setVentaItems] = useState([]);
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [servicioSearchResults, setServicioSearchResults] = useState([]);
  const [isSearchingServicios, setIsSearchingServicios] = useState(false);
  
  const [hasLoadedUsuarios, setHasLoadedUsuarios] = useState(false);
  const [hasLoadedTiendas, setHasLoadedTiendas] = useState(false);
  const [hasLoadedCuentas, setHasLoadedCuentas] = useState(false);
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(false);
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);

  // State for individual price edit modal
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemPrices, setEditingItemPrices] = useState({ cup: '', usd: '' });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isReadOnly = isViewMode || isOfflineMode;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status);
    })();

  }, []);

  useEffect(() => {
    if (venta?.id_lista_venta) {
      fetchVentaData();
    }
    // Load tiendas for selector
    loadTiendas();
  }, [venta?.id_lista_venta]);

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
  }, [searchText, selectedTienda]);

  const loadTiendas = async () => {
    try {
      const tiendasData = await getTiendas();
      setAvailableTiendas(tiendasData.data || []);
    } catch (error) {
      console.error('Error loading tiendas:', error);
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
      showToast({ type: 'success', message: 'Producto agregado correctamente' });
      setSearchText('');
    } catch (error) {
      console.error('Error adding product by search:', error);
      showToast({ type: 'error', message: 'Error al agregar producto' });
    }
  };

  const fetchVentaData = async () => {
    try {
      setIsFetchingVenta(true);
      const ventaData = await getVentaById(venta.id_lista_venta);

      // Extract data from venta response to avoid unnecessary API calls
      const ventaUsuario = ventaData.operaciones?.[0]?.usuario;
      const ventaCuentas = ventaData.operaciones?.map(op => op.cuenta).filter(Boolean) || [];
      const ventaTienda = ventaData.ventas?.[0]?.servicioTienda?.tienda;

      // Set tienda
      if (ventaTienda) {
        setSelectedTienda(ventaTienda);
      }

      // Set sale items from ventas
      const items = await Promise.all(ventaData.ventas?.map(async (v) => {
        const servicio = v.servicio || v.servicioTienda?.servicio;

        // Build full image URL
        let fullImageUrl = null;
        if (servicio?.producto?.imagen) {
          const isBase64 = servicio.producto.imagen.startsWith('data:');
          if (isBase64) {
            fullImageUrl = servicio.producto.imagen;
          } else {
            const imagePath = servicio.producto.imagen.startsWith('/') ? servicio.producto.imagen : `/${servicio.producto.imagen}`;
            const currentBaseUrl = await getApiBaseUrl();
            fullImageUrl = currentBaseUrl ? `${currentBaseUrl}${imagePath}` : servicio.producto.imagen;
          }
        }

        return {
          id_servicio_tienda: v.id_servicio_tienda,
          id_servicio: v.id_servicio,
          codigo_barras_ean: servicio?.producto?.codigo_barras_ean || '',
          nombre: servicio?.nombre || 'Sin nombre',
          imagen: fullImageUrl,
          cantidad: v.cantidad,
          precio_cup: v.precio_cobrado_cup || 0,
          precio_usd: v.precio_cobrado_usd || 0,
          esOferta: servicio?.componentes?.length > 0,
          componentes: servicio?.componentes?.map(comp => ({
            nombre: comp.nombre || 'Componente',
            cantidad: comp.Oferta?.cantidad || 1
          })) || [],
        };
      }) || []);
      setSaleItems(items);

      // Set nota
      setVentaNota(ventaData.nota || '');

      // Set original form data for additional fields
      setFormData({
        id_usuario: ventaUsuario?.id_usuario || null,
        cambio_moneda: ventaData.cambio_moneda?.toString() || cupToUsdRate.toString(),
        fecha_hora: ventaData.fecha_hora || new Date().toISOString(),
        nota: ventaData.nota || '',
      });
      
      // Set dropdown data from venta response (only what's needed for display)
      if (ventaUsuario) {
        setUsuarios([ventaUsuario]);
        setHasLoadedUsuarios(true);
      }
      // Load all available cuentas, not just those with payments
      await fetchCuentas();
      if (ventaTienda) {
        setTiendas([ventaTienda]);
        setHasLoadedTiendas(true);
        await loadCuentaConfig(ventaTienda.id_tienda);
      }

      // Set payment amounts and selected cuentas from operaciones (after loading cuentaConfig)
      const payments = {
        efectivo_cup: '',
        efectivo_usd: '',
        transferencia_cup: '',
        transferencia_usd: '',
      };
      ventaData.operaciones?.forEach(op => {
        const tipoCuenta = op.cuenta?.tipo_cuenta;
        if (tipoCuenta === 'Efectivo CUP') {
          payments.efectivo_cup = op.cantidad_operacion?.toString() || '';
          setSelectedCuentas(prev => ({ ...prev, efectivo_cup: op.cuenta }));
        } else if (tipoCuenta === 'Efectivo USD') {
          payments.efectivo_usd = op.cantidad_operacion?.toString() || '';
          setSelectedCuentas(prev => ({ ...prev, efectivo_usd: op.cuenta }));
        } else if (tipoCuenta === 'Transferencia CUP') {
          payments.transferencia_cup = op.cantidad_operacion?.toString() || '';
          setSelectedCuentas(prev => ({ ...prev, transferencia_cup: op.cuenta }));
        } else if (tipoCuenta === 'Transferencia USD') {
          payments.transferencia_usd = op.cantidad_operacion?.toString() || '';
          setSelectedCuentas(prev => ({ ...prev, transferencia_usd: op.cuenta }));
        }
      });
      setPaymentAmounts(payments);

      setFormData({
        fecha_hora: ventaData.fecha_hora,
        nota: ventaData.nota || '',
        cantidad_cobrada_efectivo_cup: ventaData.cantidad_cobrada_efectivo_cup?.toString() || '',
        cantidad_cobrada_efectivo_usd: ventaData.cantidad_cobrada_efectivo_usd?.toString() || '',
        cantidad_cobrada_transferencia_cup: ventaData.cantidad_cobrada_transferencia_cup?.toString() || '',
        cantidad_cobrada_transferencia_usd: ventaData.cantidad_cobrada_transferencia_usd?.toString() || '',
        id_cuenta_efectivo_cup: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Efectivo CUP')?.id_cuenta || null,
        id_cuenta_efectivo_usd: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Efectivo USD')?.id_cuenta || null,
        id_cuenta_transferencia_cup: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Transferencia CUP')?.id_cuenta || null,
        id_cuenta_transferencia_usd: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Transferencia USD')?.id_cuenta || null,
        id_usuario: ventaData.id_usuario || ventaData.operaciones?.[0]?.id_usuario || user?.id_usuario,
        cambio_moneda: ventaData.cambio_moneda?.toString() || ventaData.operaciones?.[0]?.cambio_moneda?.toString() || cupToUsdRate.toString(),
      });

      const ventaItemsData = ventaData.ventas?.map(v => ({
        id: v.id_venta,
        id_servicio_tienda: v.id_servicio_tienda,
        servicio: v.servicioTienda?.servicio,
        cantidad: v.cantidad?.toString() || '',
        precio_cobrado_cup: v.precio_cobrado_cup?.toString() || '',
        precio_cobrado_usd: v.precio_cobrado_usd?.toString() || '',
      })) || [];

      setVentaItems(ventaItemsData);
    } catch (error) {
      console.error('Error fetching venta data:', error);
      showToast({ type: 'error', message: 'Error al cargar datos de la venta' });
    } finally {
      setIsFetchingVenta(false);
    }
  };

  // Lazy load functions for dropdowns
  const fetchUsuarios = async () => {
    if (isLoadingUsuarios) return;
    try {
      setIsLoadingUsuarios(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsuarios(data.data || []);
      setHasLoadedUsuarios(true);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
    } finally {
      setIsLoadingUsuarios(false);
    }
  };

  const fetchTiendas = async () => {
    if (hasLoadedTiendas || isLoadingTiendas) return;
    try {
      setIsLoadingTiendas(true);
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
      setHasLoadedTiendas(true);
    } catch (error) {
      console.error('Error fetching tiendas:', error);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchCuentas = async () => {
    if (hasLoadedCuentas || isLoadingCuentas) return;
    try {
      setIsLoadingCuentas(true);
      const data = await getCuentas({ activo: true }, 1, 1000);
      setCuentas(data.data || []);
      setHasLoadedCuentas(true);
    } catch (error) {
      console.error('Error fetching cuentas:', error);
    } finally {
      setIsLoadingCuentas(false);
    }
  };

  const loadCuentaConfig = async (tiendaId) => {
    try {
      const data = await configService.getConfig();
      if (data.tiendaCuentasConfig && data.tiendaCuentasConfig[tiendaId]) {
        setCuentaConfig(data.tiendaCuentasConfig[tiendaId]);
      }
      if (data.cupToUsdRate) {
        setCupToUsdRate(data.cupToUsdRate);
      }
    } catch (error) {
    }
  };

  const roundTo5Decimals = (value) => Math.round(value * 100000) / 100000;

  const handleOpenPriceEditModal = (index) => {
    const item = saleItems[index];
    setEditingItemIndex(index);
    setEditingItemPrices({
      cup: item.precio_cup?.toString() || '',
      usd: item.precio_usd?.toString() || ''
    });
    setShowPriceEditModal(true);
  };

  const handleSavePriceEdit = () => {
    if (editingItemIndex !== null) {
      const newItems = [...saleItems];
      newItems[editingItemIndex].precio_cup = parseFloat(editingItemPrices.cup) || 0;
      newItems[editingItemIndex].precio_usd = parseFloat(editingItemPrices.usd) || 0;
      setSaleItems(newItems);
    }
    setShowPriceEditModal(false);
    setEditingItemIndex(null);
    setEditingItemPrices({ cup: '', usd: '' });
  };

  const handleCancelPriceEdit = () => {
    setShowPriceEditModal(false);
    setEditingItemIndex(null);
    setEditingItemPrices({ cup: '', usd: '' });
  };

  const searchServicios = async (searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
        setServicioSearchResults([]);
        return;
      }
      setIsSearchingServicios(true);
      const data = await getServicios({ nombre: searchTerm }, 1, 20);
      setServicioSearchResults(data.data || []);
    } catch (err) {
      setServicioSearchResults([]);
    } finally {
      setIsSearchingServicios(false);
    }
  };

  const handleAddVentaItem = () => {
    setVentaItems([...ventaItems, {
      id: Date.now(),
      id_servicio_tienda: null,
      servicio: null,
      cantidad: '',
      precio_cobrado_cup: '',
      precio_cobrado_usd: '',
    }]);
  };

  const handleRemoveVentaItem = (id) => {
    setVentaItems(ventaItems.filter(item => item.id !== id));
  };

  const handleUpdateVentaItem = (id, field, value) => {
    setVentaItems(ventaItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleServicioSelect = (itemId, servicio) => {
    handleUpdateVentaItem(itemId, 'servicio', servicio);
    handleUpdateVentaItem(itemId, 'id_servicio_tienda', null);
    setServicioSearchText('');
    setServicioSearchResults([]);
    setShowServicioDropdown(false);
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.fecha_hora) {
      showToast({ type: 'warning', message: 'La fecha y hora son obligatorias' });
      return;
    }

    // Allow paying more or less than total (for change or partial payments)
    // No validation on remaining amount needed

    if (!formData.cambio_moneda || parseFloat(formData.cambio_moneda) <= 0) {
      showToast({ type: 'warning', message: 'El cambio de moneda debe ser mayor que 0' });
      return;
    }

    const montos = [
      parseFloat(paymentAmounts.efectivo_cup) || 0,
      parseFloat(paymentAmounts.efectivo_usd) || 0,
      parseFloat(paymentAmounts.transferencia_cup) || 0,
      parseFloat(paymentAmounts.transferencia_usd) || 0,
    ];

    if (montos.some(m => m < 0)) {
      showToast({ type: 'warning', message: 'Los montos cobrados no pueden ser negativos' });
      return;
    }

    // Validar cuentas
    if (montos[0] > 0 && !selectedCuentas.efectivo_cup) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para efectivo CUP' });
      return;
    }
    if (montos[1] > 0 && !selectedCuentas.efectivo_usd) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para efectivo USD' });
      return;
    }
    if (montos[2] > 0 && !selectedCuentas.transferencia_cup) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para transferencia CUP' });
      return;
    }
    if (montos[3] > 0 && !selectedCuentas.transferencia_usd) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para transferencia USD' });
      return;
    }

    // Validar items de venta
    if (ventaItems.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos una venta' });
      return;
    }

    for (let i = 0; i < ventaItems.length; i++) {
      const item = ventaItems[i];
      if (!item.id_servicio_tienda) {
        showToast({ type: 'warning', message: `La venta ${i + 1} requiere un servicio-tienda` });
        return;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        showToast({ type: 'warning', message: `La cantidad de la venta ${i + 1} debe ser mayor que 0` });
        return;
      }
      if (item.precio_cobrado_cup === '' || parseFloat(item.precio_cobrado_cup) < 0) {
        showToast({ type: 'warning', message: `El precio CUP de la venta ${i + 1} no es válido` });
        return;
      }
      if (item.precio_cobrado_usd === '' || parseFloat(item.precio_cobrado_usd) < 0) {
        showToast({ type: 'warning', message: `El precio USD de la venta ${i + 1} no es válido` });
        return;
      }
    }

    try {
      setIsSaving(true);

      const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
      const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
      const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
      const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;
      const cambio = parseFloat(formData.cambio_moneda) || 1;

      // Calculate total original prices from ventaItems
      const totalOriginalCUP = ventaItems.reduce((sum, item) => {
        const cantidad = parseFloat(item.cantidad) || 0;
        const precioCup = parseFloat(item.precio_cobrado_cup) || 0;
        return sum + (cantidad * precioCup);
      }, 0);
      const totalOriginalUSD = ventaItems.reduce((sum, item) => {
        const cantidad = parseFloat(item.cantidad) || 0;
        const precioUsd = parseFloat(item.precio_cobrado_usd) || 0;
        return sum + (cantidad * precioUsd);
      }, 0);

      // Calculate total paid
      const totalPaidCUP = efectivoCup + transferenciaCup + (efectivoUsd + transferenciaUsd) * cambio;
      const totalPaidUSD = efectivoUsd + transferenciaUsd + (efectivoCup + transferenciaCup) / cambio;

      // Check if paid amount differs from total (using tolerance for rounding discrepancies)
      const tolerance = 0.1;
      const amountDifference = Math.abs(totalPaidCUP - totalOriginalCUP);
      
      // If the amount paid differs significantly from the total, require a note
      if (amountDifference > tolerance && (!formData.nota || formData.nota.trim() === '')) {
        showToast({ 
          type: 'warning', 
          message: 'Debes agregar una nota explicando por qué se está cobrando un valor diferente al total' 
        });
        setIsSaving(false);
        return;
      }

      // Calculate difference and distribute equitably
      const diferenciaCUP = totalPaidCUP - totalOriginalCUP;
      const diferenciaUSD = totalPaidUSD - totalOriginalUSD;

      // Calculate adjustment per item (equitable distribution)
      const cantidadProductos = ventaItems.length;
      const ajusteCUPPorItem = cantidadProductos > 0 ? diferenciaCUP / cantidadProductos : 0;
      const ajusteUSDPorItem = cantidadProductos > 0 ? diferenciaUSD / cantidadProductos : 0;

      // Create adjusted sale items for the API
      const ventasConAjuste = ventaItems.map(item => {
        const cantidad = parseFloat(item.cantidad) || 1;
        const precioOriginalCUP = parseFloat(item.precio_cobrado_cup) || 0;
        const precioOriginalUSD = parseFloat(item.precio_cobrado_usd) || 0;
        
        const ajusteCUP = ajusteCUPPorItem / cantidad;
        const ajusteUSD = ajusteUSDPorItem / cantidad;
        const precioCobradoCUP = Math.max(0, precioOriginalCUP + ajusteCUP);
        const precioCobradoUSD = Math.max(0, precioOriginalUSD + ajusteUSD);
        
        return {
          id_servicio_tienda: item.id_servicio_tienda,
          cantidad: cantidad,
          precio_cobrado_cup: precioCobradoCUP,
          precio_cobrado_usd: precioCobradoUSD,
        };
      });

      const ventaData = {
        fecha_hora: formData.fecha_hora,
        nota: formData.nota || null,
        cantidad_cobrada_efectivo_cup: efectivoCup,
        cantidad_cobrada_efectivo_usd: efectivoUsd,
        cantidad_cobrada_transferencia_cup: transferenciaCup,
        cantidad_cobrada_transferencia_usd: transferenciaUsd,
        id_cuenta_efectivo_cup: selectedCuentas.efectivo_cup?.id_cuenta,
        id_cuenta_efectivo_usd: selectedCuentas.efectivo_usd?.id_cuenta,
        id_cuenta_transferencia_cup: selectedCuentas.transferencia_cup?.id_cuenta,
        id_cuenta_transferencia_usd: selectedCuentas.transferencia_usd?.id_cuenta,
        id_usuario: user?.id_usuario || formData.id_usuario,
        cambio_moneda: cambio,
        ventas: ventasConAjuste,
      };

      await updateVenta(venta.id_lista_venta, ventaData);
      showToast({ type: 'success', message: 'Venta actualizada correctamente' });
      navigation.goBack();
    } catch (error) {
      const errorMessage = error.message || 'Error al actualizar venta';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFechaChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowFechaPicker(false);
      return;
    }
    if (selectedDate) {
      setShowFechaPicker(false);
      setFormData(prev => ({ ...prev, fecha_hora: selectedDate.toISOString() }));
    }
  };

  const formatNumber = (num) => {
    if (num === '' || num === null || num === undefined) return '';
    return parseFloat(num).toFixed(2);
  };

  const calculateTotalToReceive = () => {
    const total = saleItems.reduce((total, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precioCup = parseFloat(item.precio_cup) || 0;
      return total + (cantidad * precioCup);
    }, 0);
    return total;
  };

  const calculateTotalReceived = () => {
    const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
    const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
    const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
    const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;
    const cambio = parseFloat(formData.cambio_moneda) || 1;

    return efectivoCup + transferenciaCup + (efectivoUsd * cambio) + (transferenciaUsd * cambio);
  };

  const getRemainingAmount = () => {
    return calculateTotalToReceive() - calculateTotalReceived();
  };

  // SalesScreen-like helper functions
  const updateItemQuantity = (index, newQuantity) => {
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

  const formatNumber2Decimals = (num) => {
    return parseFloat(num).toFixed(2);
  };

  const formatNumber5Decimals = (num) => {
    return parseFloat(num).toFixed(5);
  };

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
    return show5Decimals ? formatNumber5Decimals(parseFloat(value) || 0) : formatNumber2Decimals(parseFloat(value) || 0);
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

  const styles = createStyles(responsive);

  if (isFetchingVenta) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Editar Venta</Text>
          <TouchableOpacity onPress={() => setShowCamera(!showCamera)} style={styles.cameraToggle}>
            <Ionicons name="barcode" size={24} color={colors.primary} />
            <Text style={[styles.cameraToggleText, { color: colors.primary }]}>
              {showCamera ? "Escáner activo" : "Escáner desactivado"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.outline }]}>
            Cargando datos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Editar Venta</Text>
        <TouchableOpacity onPress={() => setShowCamera(!showCamera)} style={styles.cameraToggle}>
          <Ionicons name="barcode" size={24} color={colors.primary} />
          <Text style={[styles.cameraToggleText, { color: colors.primary }]}>
            {showCamera ? "Escáner activo" : "Escáner desactivado"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView
          style={styles.content}
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
          <Card style={[styles.sectionCardCompact, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Tienda</Text>
            </View>

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
          <Card style={[styles.sectionCardCompact, { backgroundColor: colors.surface }]}>
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
                <TouchableOpacity
                  key={index}
                  style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => handleOpenPriceEditModal(index)}
                  activeOpacity={0.7}
                >
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
                </TouchableOpacity>
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
                            const cambio = parseFloat(formData.cambio_moneda || cupToUsdRate);
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

          {/* Additional Fields Card - Usuario, Cambio de Moneda, Fecha */}
          <Card style={[styles.sectionCardCompact, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Información Adicional</Text>
            </View>

            {/* Usuario */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Usuario *</Text>
              <View
                style={[styles.dropdown, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant }]}
              >
                <Text style={[styles.dropdownText, { color: formData.id_usuario ? colors.onSurface : colors.outline }]}>
                  {usuarios.find(u => u.id_usuario === formData.id_usuario)?.nombre_natural || user?.nombre_natural || 'Usuario actual'}
                </Text>
              </View>
            </View>

            {/* Cambio de Moneda y Fecha */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: responsive.responsiveWidth(8) }]}>
                <Text style={[styles.label, { color: colors.outline }]}>Cambio de Moneda *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Tasa de cambio..."
                  value={formData.cambio_moneda}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, cambio_moneda: text }))}
                  keyboardType="numeric"
                  editable={false}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.outline }]}>Fecha *</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  onPress={() => !isReadOnly && setShowFechaPicker(true)}
                  disabled={isReadOnly}
                >
                  <Text style={[styles.inputText, { color: colors.onSurface }]}>
                    {new Date(formData.fecha_hora).toLocaleDateString('es-ES')}
                  </Text>
                </TouchableOpacity>
                {showFechaPicker && !isReadOnly && (
                  <DateTimePicker
                    value={new Date(formData.fecha_hora)}
                    mode="date"
                    display="default"
                    onChange={handleFechaChange}
                  />
                )}
              </View>
            </View>
          </Card>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving || saleItems.length === 0}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={[styles.submitButtonText, { color: '#fff' }]}>
                  Actualizar Venta
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

      {/* Price Edit Modal */}
      {showPriceEditModal && (
        <Modal
          visible={showPriceEditModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelPriceEdit}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.priceEditModalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Editar Precio</Text>
                <TouchableOpacity onPress={handleCancelPriceEdit}>
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <View style={styles.priceEditModalBody}>
                <View style={styles.priceEditModalRow}>
                  <View style={styles.priceEditModalField}>
                    <Text style={[styles.priceEditModalLabel, { color: colors.outline }]}>Precio CUP:</Text>
                    <TextInput
                      style={[styles.priceEditModalInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant, color: colors.onSurface }]}
                      value={editingItemPrices.cup}
                      onChangeText={(text) => {
                        const newPriceCUP = parseFloat(text) || 0;
                        const cambio = parseFloat(cupToUsdRate || 1);
                        const newPriceUSD = roundTo5Decimals(newPriceCUP / cambio);
                        setEditingItemPrices({ cup: text, usd: newPriceUSD.toString() });
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.priceEditModalField}>
                    <Text style={[styles.priceEditModalLabel, { color: colors.outline }]}>Precio USD:</Text>
                    <TextInput
                      style={[styles.priceEditModalInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant, color: colors.onSurface }]}
                      value={editingItemPrices.usd}
                      onChangeText={(text) => {
                        const newPriceUSD = parseFloat(text) || 0;
                        const cambio = parseFloat(cupToUsdRate || 1);
                        const newPriceCUP = roundTo5Decimals(newPriceUSD * cambio);
                        setEditingItemPrices({ cup: newPriceCUP.toString(), usd: text });
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.outlineVariant }]}
                  onPress={handleCancelPriceEdit}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePriceEdit}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default function VentaEditScreen() {
  return <VentaEditContent />;
}

const createStyles = (responsive) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
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
  sectionCard: {
    marginBottom: responsive.responsiveHeight(16),
    padding: responsive.responsiveWidth(16),
    borderRadius: responsive.responsiveWidth(12),
  },
  sectionCardCompact: {
    marginBottom: responsive.responsiveHeight(16),
    paddingHorizontal: responsive.responsiveWidth(16),
    paddingBottom: responsive.responsiveWidth(16),
    paddingTop: responsive.responsiveWidth(4),
    borderRadius: responsive.responsiveWidth(12),
  },
  sectionHeader: {
    marginBottom: responsive.responsiveHeight(8),
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
  priceEditModalContent: {
    width: '80%',
    borderRadius: responsive.responsiveWidth(16),
    padding: responsive.responsiveWidth(20),
  },
  priceEditModalBody: {
    paddingVertical: responsive.responsiveHeight(20),
  },
  priceEditModalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceEditModalField: {
    flex: 1,
    marginRight: responsive.responsiveWidth(12),
  },
  priceEditModalLabel: {
    fontSize: responsive.responsiveWidth(14),
    marginBottom: responsive.responsiveHeight(8),
  },
  priceEditModalInput: {
    padding: responsive.responsiveWidth(12),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(16),
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: responsive.responsiveHeight(16),
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  modalItem: {
    padding: responsive.responsiveWidth(12),
    borderRadius: responsive.responsiveWidth(8),
    borderWidth: 1,
    marginBottom: responsive.responsiveHeight(8),
  },
  modalItemText: {
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
  scrollContent: {
    paddingBottom: responsive.responsivePadding(20),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(0),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
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
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  inputText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(150),
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  dropdownLoadingText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(16),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
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
  receivedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(8),
  },
  receivedLabel: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  receivedAmount: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '700',
  },
  remainingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(16),
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
  addButtonSmall: {
    width: responsive.responsiveWidth(36),
    height: responsive.responsiveHeight(36),
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ventaItemCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  ventaItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  ventaItemTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  actionButtons: {
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
  },
  safeArea: {
    flex: 1,
  },
});
