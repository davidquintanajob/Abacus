import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Keyboard, Image, Modal, Switch } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import configService from '../services/configService';
import { exchangeRateService } from '../services/exchangeRateService';
import { getCuentas } from '../services/cuentaService';
import { getTiendas } from '../services/tiendaService';
import { getProductos } from '../services/productoService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const AccessLevelSwitch = ({ value, onChange, colors, responsive }) => {
  const levels = [
    { key: 'none', label: 'Sin acceso', icon: 'lock-closed' },
    { key: 'own_store', label: 'Mi tienda', icon: 'storefront' },
    { key: 'all_stores', label: 'Todas', icon: 'globe' },
  ];

  return (
    <View style={accessLevelSwitchStyles.container}>
      {levels.map((level, index) => (
        <TouchableOpacity
          key={level.key}
          style={[
            accessLevelSwitchStyles.iconButton,
            { 
              backgroundColor: value === level.key ? colors.primary : 'transparent',
              borderColor: value === level.key ? colors.primary : colors.outlineVariant,
            },
          ]}
          onPress={() => onChange(level.key)}
        >
          <Ionicons 
            name={level.icon} 
            size={responsive.responsiveWidth(20)} 
            color={value === level.key ? '#fff' : colors.outline} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const DeudaClienteAccessLevelSwitch = ({ value, onChange, colors, responsive }) => {
  const levels = [
    { key: 'none', label: 'No ver', icon: 'lock-closed' },
    { key: 'clientes', label: 'Ver clientes', icon: 'person' },
    { key: 'ambos', label: 'Ver ambos', icon: 'people' },
  ];

  return (
    <View style={accessLevelSwitchStyles.container}>
      {levels.map((level, index) => (
        <TouchableOpacity
          key={level.key}
          style={[
            accessLevelSwitchStyles.iconButton,
            { 
              backgroundColor: value === level.key ? colors.primary : 'transparent',
              borderColor: value === level.key ? colors.primary : colors.outlineVariant,
            },
          ]}
          onPress={() => onChange(level.key)}
        >
          <Ionicons 
            name={level.icon} 
            size={responsive.responsiveWidth(20)} 
            color={value === level.key ? '#fff' : colors.outline} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const accessLevelSwitchStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const CurrencyExchangeContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [config, setConfig] = useState({});
  const [permissions, setPermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [productoAccessLevels, setProductoAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [productoManagePermissions, setProductoManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [entradaAccessLevels, setEntradaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [entradaManagePermissions, setEntradaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [salidaAccessLevels, setSalidaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [salidaManagePermissions, setSalidaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [operacionAccessLevels, setOperacionAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [operacionManagePermissions, setOperacionManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [ventaAccessLevels, setVentaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [ventaManagePermissions, setVentaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [deudaAccessLevels, setDeudaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [deudaManagePermissions, setDeudaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [clienteManagePermissions, setClienteManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [deudaConfigPermissions, setDeudaConfigPermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showDeudaPermissions, setShowDeudaPermissions] = useState(false);
  const [showDeudaManage, setShowDeudaManage] = useState(false);
  const [showDeudaConfig, setShowDeudaConfig] = useState(false);
  const [showClienteManage, setShowClienteManage] = useState(false);
  const [movimientoAccessLevels, setMovimientoAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [movimientoManagePermissions, setMovimientoManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showMovimientoPermissions, setShowMovimientoPermissions] = useState(false);
  const [showMovimientoManage, setShowMovimientoManage] = useState(false);
  const [applyWeightedAverageCost, setApplyWeightedAverageCost] = useState(false);
  const [autoApplySuggestedCost, setAutoApplySuggestedCost] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [autoWithdrawOnEntry, setAutoWithdrawOnEntry] = useState(false);
  const [showEntradaModalAfterProductCreation, setShowEntradaModalAfterProductCreation] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showProductoPermissions, setShowProductoPermissions] = useState(false);
  const [showProductoManage, setShowProductoManage] = useState(false);
  const [showEntradaPermissions, setShowEntradaPermissions] = useState(false);
  const [showEntradaConfig, setShowEntradaConfig] = useState(false);
  const [showEntradaManage, setShowEntradaManage] = useState(false);
  const [showSalidaPermissions, setShowSalidaPermissions] = useState(false);
  const [showSalidaManage, setShowSalidaManage] = useState(false);
  const [showOperacionPermissions, setShowOperacionPermissions] = useState(false);
  const [showOperacionManage, setShowOperacionManage] = useState(false);
  const [showVentaPermissions, setShowVentaPermissions] = useState(false);
  const [showVentaManage, setShowVentaManage] = useState(false);
  const [customSalidaTypes, setCustomSalidaTypes] = useState([]);
  const [cuentaChangePermissions, setCuentaChangePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showCuentaChangePermissions, setShowCuentaChangePermissions] = useState(false);
  const [priceChangePermissions, setPriceChangePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showComprobanteConfigCard, setShowComprobanteConfigCard] = useState(false);
  const [showComprobanteConfig, setShowComprobanteConfig] = useState(false);
  const [comprobanteConfig, setComprobanteConfig] = useState({
    logo: null,
    nombreNegocio: '',
  });
  const [showSalesConfigurations, setShowSalesConfigurations] = useState(false);
  const [infoModal, setInfoModal] = useState({
    visible: false,
    title: '',
    description: '',
  });
  const [exchangeRates, setExchangeRates] = useState(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyModalConfig, setCurrencyModalConfig] = useState({
    datosModificar: 'ambos',
    modificarSoloServicios: false,
    tipoDatoModificar: 'usd',
    redondeo_exeso: 'ninguna',
    categoria_servicio: '',
  });
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [categoriaSearchText, setCategoriaSearchText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);

  const predefinedCategories = ['Alimentos', 'Bebidas', 'Limpieza', 'Higiene', 'Electrónicos', 'Ropa', 'Medicamentos', 'Otros'];
  const [customCategories, setCustomCategories] = useState([]);

  // Cargar categorías personalizadas
  const loadCustomCategories = async () => {
    try {
      const savedCategories = await AsyncStorage.getItem('customCategories');
      if (savedCategories) {
        setCustomCategories(JSON.parse(savedCategories));
      }
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  useEffect(() => {
    loadCustomCategories();
  }, []);

  // Función para calcular nuevo precio con redondeo por exceso
  // Lógica igual al backend (configController.js líneas 294-310)
  const calculateNewPrice = (currentPrice, tipoDatoModificar, rate, redondeo_exeso) => {
    let newPrice;
    if (tipoDatoModificar === 'usd') {
      // Actualizar USD a partir de CUP: USD = CUP / rate
      newPrice = currentPrice / rate;
    } else {
      // Actualizar CUP a partir de USD: CUP = USD * rate
      newPrice = currentPrice * rate;
    }

    // Aplicar redondeo por exceso solo para CUP (igual que el backend)
    if (tipoDatoModificar === 'cup' && redondeo_exeso && redondeo_exeso !== 'ninguna') {
      const roundTo = parseInt(redondeo_exeso, 10);
      newPrice = Math.ceil(newPrice / roundTo) * roundTo;
    }

    // Redondear a 5 decimales (igual que el backend usa round5)
    newPrice = Math.round(newPrice * 100000) / 100000;

    return newPrice;
  };

  // Función para obtener vista previa de productos/servicios a modificar
  const fetchPreviewItems = async () => {
    try {
      const rate = parseFloat(exchangeRate);
      const filters = {};

      // Agregar filtro de categoría si está seleccionada
      if (currencyModalConfig.categoria_servicio && currencyModalConfig.categoria_servicio.trim() !== '') {
        filters.categoria = currencyModalConfig.categoria_servicio;
      }

      // Agregar filtro de esvendible según configuración
      // modificarSoloServicios=true significa solo servicios (esvendible=false)
      // modificarSoloServicios=false significa todos (no agregar filtro)
      if (currencyModalConfig.modificarSoloServicios) {
        filters.esvendible = 'false';
      }

      // Skip filtros automáticos del servicio
      filters.skipEsvendible = true;
      filters.skipCantidadMin = true;

      const data = await getProductos(filters, 1, 1000);
      const productos = data.data || [];

      // Si tenemos tiendas_servicio, calcular precios. Si no, vista previa simplificada.
      const itemsWithNewPrices = [];
      productos.forEach(producto => {
        if (producto.tiendas_servicio && producto.tiendas_servicio.length > 0) {
          // Tenemos tiendas_servicio, calcular precios
          // Calcular ambos precios (USD y CUP) independientemente de la opción seleccionada

          producto.tiendas_servicio.forEach(ts => {
            const precioCUP = parseFloat(ts.precio_cup) || 0;
            const precioUSD = parseFloat(ts.precio_usd) || 0;
            const costoCUP = parseFloat(ts.costo_cup) || 0;
            const costoUSD = parseFloat(ts.costo_usd) || 0;

            // Calcular nuevos precios basándose en la configuración
            // Si tipoDatoModificar='usd', actualizamos CUP basándonos en USD (basar conversión en USD)
            // Si tipoDatoModificar='cup', actualizamos USD basándonos en CUP (basar conversión en CUP)
            let newPrecioCUP, newPrecioUSD, newCostoCUP, newCostoUSD;

            if (currencyModalConfig.tipoDatoModificar === 'usd') {
              // Basar conversión en USD: actualizar CUP basándose en USD
              newPrecioCUP = calculateNewPrice(precioUSD, 'cup', rate, currencyModalConfig.redondeo_exeso);
              newCostoCUP = calculateNewPrice(costoUSD, 'cup', rate, currencyModalConfig.redondeo_exeso);
              // USD se mantiene igual
              newPrecioUSD = precioUSD;
              newCostoUSD = costoUSD;
            } else {
              // Basar conversión en CUP: actualizar USD basándose en CUP
              newPrecioUSD = calculateNewPrice(precioCUP, 'usd', rate, currencyModalConfig.redondeo_exeso);
              newCostoUSD = calculateNewPrice(costoCUP, 'usd', rate, currencyModalConfig.redondeo_exeso);
              // CUP se mantiene igual
              newPrecioCUP = precioCUP;
              newCostoCUP = costoCUP;
            }

            itemsWithNewPrices.push({
              ...producto,
              tiendaNombre: ts.tienda?.nombre || 'Tienda desconocida',
              currentPrecioCUP: precioCUP,
              currentPrecioUSD: precioUSD,
              currentCostoCUP: costoCUP,
              currentCostoUSD: costoUSD,
              newPrecioCUP,
              newPrecioUSD,
              newCostoCUP,
              newCostoUSD,
            });
          });
        } else {
          // No tenemos tiendas_servicio, vista previa simplificada
          itemsWithNewPrices.push({
            ...producto,
            tiendaNombre: 'Sin datos de tienda',
            currentPrecioCUP: null,
            currentPrecioUSD: null,
            currentCostoCUP: null,
            currentCostoUSD: null,
            newPrecioCUP: null,
            newPrecioUSD: null,
            newCostoCUP: null,
            newCostoUSD: null,
          });
        }
      });

      setPreviewItems(itemsWithNewPrices);
      setShowPreview(true);
    } catch (error) {
      console.error('[Preview] Error:', error);
      showToast({ type: 'error', message: 'Error al cargar vista previa' });
    }
  };

  // Estados para configuración de cuentas por tienda
  const [showSalesConfigCard, setShowSalesConfigCard] = useState(false);
  const [showSalesConfig, setShowSalesConfig] = useState(false);
  const [tiendaCuentasConfig, setTiendaCuentasConfig] = useState({});
  const [selectedTienda, setSelectedTienda] = useState(null);
  const [availableTiendas, setAvailableTiendas] = useState([]);
  const [availableCuentas, setAvailableCuentas] = useState([]);
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState(null);
  const [selectorIndex, setSelectorIndex] = useState(0);
  const [prioritizeWifiConnection, setPrioritizeWifiConnection] = useState(false);
  const [showWifiConfig, setShowWifiConfig] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchConfig();
    // Cargar tasas automáticamente al inicio si hay conexión
    if (isConnected) {
      fetchExchangeRates();
    }
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      // Cargar tasas cuando se reconecta a internet
      if (state.isConnected && !isConnected) {
        fetchExchangeRates();
      }
    });

    return () => unsubscribe();
  }, []); // Solo se ejecuta al montar el componente

  const togglePrioritizeWifiConnection = async () => {
    const newValue = !prioritizeWifiConnection;
    setPrioritizeWifiConnection(newValue);

    try {
      // Guardar en SecureStore para que el módulo API pueda leerlo
      await SecureStore.setItemAsync('prioritizeWifiConnection', newValue.toString());

      const updatedConfig = {
        ...config,
        prioritizeWifiConnection: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);

      showToast({
        type: 'success',
        message: newValue
          ? 'Prioridad de WiFi activada'
          : 'Prioridad de WiFi desactivada'
      });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración de WiFi' });
      setPrioritizeWifiConnection(prioritizeWifiConnection);
    }
  };

  const fetchExchangeRates = async (manualRetry = false) => {
    // Evitar reintentos si ya estamos cargando
    if (isLoadingRates) {
      return;
    }

    try {
      setIsLoadingRates(true);
      const data = await exchangeRateService.getExchangeRates();
      setExchangeRates(data);
    } catch (error) {
      console.warn('[ExchangeRates]', error.message);
      setExchangeRates(null);
      if (manualRetry) {
        showToast({ type: 'error', message: 'No se pudieron cargar las tasas de cambio' });
      }
    } finally {
      setIsLoadingRates(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      if (data.cupToUsdRate) {
        setExchangeRate(data.cupToUsdRate.toString());
      }
      if (data.permissions) {
        setPermissions(data.permissions);
      }
      if (data.productoAccessLevels) {
        setProductoAccessLevels(data.productoAccessLevels);
      }
      if (data.productoManagePermissions) {
        setProductoManagePermissions(data.productoManagePermissions);
      }
      if (data.entradaAccessLevels) {
        setEntradaAccessLevels(data.entradaAccessLevels);
      }
      if (data.entradaManagePermissions) {
        setEntradaManagePermissions(data.entradaManagePermissions);
      }
      if (data.salidaAccessLevels) {
        setSalidaAccessLevels(data.salidaAccessLevels);
      }
      if (data.salidaManagePermissions) {
        setSalidaManagePermissions(data.salidaManagePermissions);
      }
      if (data.operacionAccessLevels) {
        setOperacionAccessLevels(data.operacionAccessLevels);
      }
      if (data.operacionManagePermissions) {
        setOperacionManagePermissions(data.operacionManagePermissions);
      }
      if (data.ventaAccessLevels) {
        setVentaAccessLevels(data.ventaAccessLevels);
      }
      if (data.ventaManagePermissions) {
        setVentaManagePermissions(data.ventaManagePermissions);
      }
      if (data.deudaAccessLevels) {
        setDeudaAccessLevels(data.deudaAccessLevels);
      }
      if (data.deudaManagePermissions) {
        setDeudaManagePermissions(data.deudaManagePermissions);
      }
      if (data.clienteManagePermissions) {
        setClienteManagePermissions(data.clienteManagePermissions);
      }
      if (data.deudaConfigPermissions) {
        setDeudaConfigPermissions(data.deudaConfigPermissions);
      }
      if (data.applyWeightedAverageCost !== undefined) {
        setApplyWeightedAverageCost(data.applyWeightedAverageCost);
      }
      if (data.autoApplySuggestedCost) {
        setAutoApplySuggestedCost(data.autoApplySuggestedCost);
      }
      if (data.autoWithdrawOnEntry !== undefined) {
        setAutoWithdrawOnEntry(data.autoWithdrawOnEntry);
      }
      if (data.showEntradaModalAfterProductCreation !== undefined) {
        setShowEntradaModalAfterProductCreation(data.showEntradaModalAfterProductCreation);
      }
      if (data.customSalidaTypes) {
        setCustomSalidaTypes(data.customSalidaTypes);
      }
      if (data.tiendaCuentasConfig) {
        setTiendaCuentasConfig(data.tiendaCuentasConfig);
      }
      if (data.cuentaChangePermissions) {
        setCuentaChangePermissions(data.cuentaChangePermissions);
      }
      if (data.priceChangePermissions) {
        setPriceChangePermissions(data.priceChangePermissions);
      }
      if (data.comprobanteConfig) {
        setComprobanteConfig(data.comprobanteConfig);
      }
      if (data.prioritizeWifiConnection !== undefined) {
        setPrioritizeWifiConnection(data.prioritizeWifiConnection);
      }
      if (data.movimientoAccessLevels) {
        setMovimientoAccessLevels(data.movimientoAccessLevels);
      }
      if (data.movimientoManagePermissions) {
        setMovimientoManagePermissions(data.movimientoManagePermissions);
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar configuración' });
    } finally {
      setIsLoading(false);
    }
  };

  // Funciones para configuración de comprobante
  const formatComprobanteNumber = (num) => {
    const formatted = parseFloat(num).toFixed(2);
    // Remove .00 if no decimal part
    const withoutZeros = formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
    // Add spaces every 3 digits
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

  const handleSelectLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se necesita permiso para acceder a la galería' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        // Store as a base64 data URI so it works in PDF generation without any file reading
        if (asset.base64) {
          const ext = (asset.uri.split('.').pop() || 'jpeg').toLowerCase();
          const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const dataUri = `data:${mime};base64,${asset.base64}`;
          setComprobanteConfig(prev => ({ ...prev, logo: dataUri }));
        } else {
          // Fallback to URI if base64 unavailable
          setComprobanteConfig(prev => ({ ...prev, logo: asset.uri }));
        }
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al seleccionar imagen' });
    }
  };

  // Funciones para configuración de cuentas por tienda
  const fetchTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const data = await getTiendas({}, 1, 100);
      setAvailableTiendas(data.data || []);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar tiendas' });
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchCuentas = async () => {
    try {
      setIsLoadingCuentas(true);
      const data = await getCuentas({}, 1, 100);
      setAvailableCuentas(data.data || []);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar cuentas' });
    } finally {
      setIsLoadingCuentas(false);
    }
  };

  const handleOpenSalesConfig = async () => {
    try {
      setShowSalesConfig(true);
      await fetchTiendas();
      await fetchCuentas();
    } catch (error) {
      console.error('Error al abrir configuración de ventas:', error);
      showToast({ type: 'error', message: 'Error al cargar configuración' });
      setShowSalesConfig(false);
    }
  };

  const handleSelectTienda = (tienda) => {
    setSelectedTienda(tienda);
    // Inicializar configuración para esta tienda si no existe
    if (!tiendaCuentasConfig[tienda.id_tienda]) {
      setTiendaCuentasConfig(prev => ({
        ...prev,
        [tienda.id_tienda]: {
          efectivo_cup: [],
          efectivo_usd: [],
          transferencia_cup: [],
          transferencia_usd: [],
        }
      }));
    }
  };

  const tiendaHasCuentas = (tiendaId) => {
    const config = tiendaCuentasConfig[tiendaId];
    if (!config) return false;
    const totalCuentas = 
      (config.efectivo_cup?.length || 0) +
      (config.efectivo_usd?.length || 0) +
      (config.transferencia_cup?.length || 0) +
      (config.transferencia_usd?.length || 0);
    return totalCuentas > 0;
  };

  const handleSelectCuenta = (cuenta) => {
    if (!selectedTienda) return;
    if (!selectorTipoCuenta) {
      showToast({ type: 'error', message: 'Tipo de cuenta no especificado' });
      return;
    }
    
    const currentConfig = tiendaCuentasConfig[selectedTienda.id_tienda] || {
      efectivo_cup: [],
      efectivo_usd: [],
      transferencia_cup: [],
      transferencia_usd: [],
    };
    
    const tipoCuenta = selectorTipoCuenta;
    const currentCuentas = currentConfig[tipoCuenta] || [];
    
    // Mapeo de tipo de configuración a tipo de cuenta esperado
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
        message: `La cuenta "${cuenta.nombre}" es de tipo "${cuenta.tipo_cuenta}" pero se requiere tipo "${tipoCuentaEsperado[tipoCuenta]}"` 
      });
      return;
    }
    
    // Verificar si ya está seleccionada
    if (currentCuentas.some(c => c.id_cuenta === cuenta.id_cuenta)) {
      showToast({ type: 'warning', message: 'Esta cuenta ya está seleccionada' });
      return;
    }
    
    // Verificar límite de 4 cuentas
    if (currentCuentas.length >= 4) {
      showToast({ type: 'warning', message: 'Máximo 4 cuentas por tipo' });
      return;
    }
    
    // Agregar cuenta
    setTiendaCuentasConfig(prev => ({
      ...prev,
      [selectedTienda.id_tienda]: {
        ...currentConfig,
        [tipoCuenta]: [...currentCuentas, cuenta]
      }
    }));
    
    setShowCuentaSelector(false);
    showToast({ type: 'success', message: 'Cuenta agregada correctamente' });
  };

  const handleRemoveCuenta = (tipoCuenta, cuentaIndex) => {
    if (!selectedTienda) return;
    
    const currentConfig = tiendaCuentasConfig[selectedTienda.id_tienda];
    const updatedCuentas = currentConfig[tipoCuenta].filter((_, index) => index !== cuentaIndex);
    
    setTiendaCuentasConfig(prev => ({
      ...prev,
      [selectedTienda.id_tienda]: {
        ...currentConfig,
        [tipoCuenta]: updatedCuentas
      }
    }));
  };

  const handleOpenCuentaSelector = (tipoCuenta, index = 0) => {
    if (!tipoCuenta) {
      showToast({ type: 'error', message: 'Tipo de cuenta no especificado' });
      return;
    }
    setSelectorTipoCuenta(tipoCuenta);
    setSelectorIndex(index);
    setShowCuentaSelector(true);
  };

  const handleSaveSalesConfig = async () => {
    try {
      const updatedConfig = {
        ...config,
        tiendaCuentasConfig: tiendaCuentasConfig,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de cuentas guardada correctamente' });
      setShowSalesConfig(false);
      setSelectedTienda(null);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración de cuentas' });
    }
  };

  const handleSave = async () => {
    // Validation
    if (!exchangeRate.trim()) {
      showToast({ type: 'warning', message: 'El tipo de cambio es requerido' });
      return;
    }

    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      showToast({ type: 'warning', message: 'El tipo de cambio debe ser un número positivo' });
      return;
    }

    // Show currency conversion modal
    setShowCurrencyModal(true);
  };

  const handleCurrencyModalConfirm = async () => {
    const rate = parseFloat(exchangeRate);

    try {
      setIsSaving(true);
      setShowCurrencyModal(false);

      // Invertir tipoDatoModificar porque el backend tiene la lógica invertida
      // Si el usuario quiere basar en USD (mantener USD, actualizar CUP),
      // el backend espera 'cup' para actualizar CUP basándose en USD
      const invertedTipoDato = currencyModalConfig.tipoDatoModificar === 'usd' ? 'cup' : 'usd';

      const updatedConfig = {
        ...config,
        cupToUsdRate: rate,
        permissions: permissions,
        productoAccessLevels: productoAccessLevels,
        productoManagePermissions: productoManagePermissions,
        entradaAccessLevels: entradaAccessLevels,
        entradaManagePermissions: entradaManagePermissions,
        salidaAccessLevels: salidaAccessLevels,
        salidaManagePermissions: salidaManagePermissions,
        operacionAccessLevels: operacionAccessLevels,
        operacionManagePermissions: operacionManagePermissions,
        ventaAccessLevels: ventaAccessLevels,
        ventaManagePermissions: ventaManagePermissions,
        deudaAccessLevels: deudaAccessLevels,
        deudaManagePermissions: deudaManagePermissions,
        clienteManagePermissions: clienteManagePermissions,
        deudaConfigPermissions: deudaConfigPermissions,
        autoApplySuggestedCost: autoApplySuggestedCost,
        customSalidaTypes: customSalidaTypes,
        tiendaCuentasConfig: tiendaCuentasConfig,
        cuentaChangePermissions: cuentaChangePermissions,
        priceChangePermissions: priceChangePermissions,
        comprobanteConfig: comprobanteConfig,
        prioritizeWifiConnection: prioritizeWifiConnection,
      };

      // Only include monedaConfig if not 'nada'
      if (currencyModalConfig.datosModificar !== 'nada') {
        updatedConfig.monedaConfig = {
          modificarSoloServicios: currencyModalConfig.modificarSoloServicios,
          datosModificar: currencyModalConfig.datosModificar,
          tipoDatoModificar: invertedTipoDato,
          monedaValor: rate,
        };

        // Only include redondeo_exeso if not 'ninguna'
        if (currencyModalConfig.redondeo_exeso !== 'ninguna') {
          updatedConfig.monedaConfig.redondeo_exeso = parseInt(currencyModalConfig.redondeo_exeso, 10);
        }

        // Include categoria_servicio if a category is selected
        if (currencyModalConfig.categoria_servicio && currencyModalConfig.categoria_servicio.trim() !== '') {
          updatedConfig.monedaConfig.categoria_servicio = currencyModalConfig.categoria_servicio;
        }
      }

      const response = await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);

      const message = currencyModalConfig.datosModificar === 'nada'
        ? 'Tipo de cambio actualizado sin modificar precios ni costos'
        : (response?.updatedServiciosTienda
          ? `Configuración guardada. ${response.updatedServiciosTienda} servicios actualizados.`
          : 'Configuración guardada correctamente');

      showToast({ type: 'success', message });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCurrencyModalCancel = () => {
    setShowCurrencyModal(false);
  };

  const showInfoModal = (title, description) => {
    setInfoModal({ visible: true, title, description });
  };

  const closeInfoModal = () => {
    setInfoModal({ visible: false, title: '', description: '' });
  };

  const togglePermission = async (role) => {
    const newPermissions = { ...permissions, [role]: !permissions[role] };
    setPermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        permissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de productos y servicios actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de productos y servicios' });
      setPermissions(permissions);
    }
  };

  const toggleCuentaChangePermission = async (role) => {
    const newCuentaChangePermissions = { ...cuentaChangePermissions, [role]: !cuentaChangePermissions[role] };
    setCuentaChangePermissions(newCuentaChangePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        cuentaChangePermissions: newCuentaChangePermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de cambio de cuenta actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de cambio de cuenta' });
      setCuentaChangePermissions(cuentaChangePermissions);
    }
  };

  const togglePriceChangePermission = async (role) => {
    const newPriceChangePermissions = { ...priceChangePermissions, [role]: !priceChangePermissions[role] };
    setPriceChangePermissions(newPriceChangePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        priceChangePermissions: newPriceChangePermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de cambio de precio actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de cambio de precio' });
      setPriceChangePermissions(priceChangePermissions);
    }
  };

  const updateEntradaAccessLevel = async (role, newLevel) => {
    const newEntradaAccessLevels = { ...entradaAccessLevels, [role]: newLevel };
    setEntradaAccessLevels(newEntradaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        entradaAccessLevels: newEntradaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a entradas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a entradas' });
      setEntradaAccessLevels(entradaAccessLevels);
    }
  };

  const toggleEntradaManagePermission = async (role) => {
    const newEntradaManagePermissions = { ...entradaManagePermissions, [role]: !entradaManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        entradaManagePermissions: newEntradaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      setEntradaManagePermissions(newEntradaManagePermissions);
      showToast({ type: 'success', message: 'Permiso de gestión de entradas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de entradas' });
      setEntradaManagePermissions(entradaManagePermissions);
    }
  };

  const updateProductoAccessLevel = async (role, newLevel) => {
    const newProductoAccessLevels = { ...productoAccessLevels, [role]: newLevel };
    setProductoAccessLevels(newProductoAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        productoAccessLevels: newProductoAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso a productos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a productos' });
      setProductoAccessLevels(productoAccessLevels);
    }
  };

  const toggleProductoManagePermission = async (role) => {
    const newProductoManagePermissions = { ...productoManagePermissions, [role]: !productoManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        productoManagePermissions: newProductoManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      setProductoManagePermissions(newProductoManagePermissions);
      showToast({ type: 'success', message: 'Permiso de gestión de productos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de productos' });
      setProductoManagePermissions(productoManagePermissions);
    }
  };

  const updateVentaAccessLevel = async (role, newLevel) => {
    const newVentaAccessLevels = { ...ventaAccessLevels, [role]: newLevel };
    setVentaAccessLevels(newVentaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        ventaAccessLevels: newVentaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a ventas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a ventas' });
      setVentaAccessLevels(ventaAccessLevels);
    }
  };

  const toggleVentaManagePermission = async (role) => {
    const newVentaManagePermissions = { ...ventaManagePermissions, [role]: !ventaManagePermissions[role] };
    setVentaManagePermissions(newVentaManagePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        ventaManagePermissions: newVentaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de ventas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de ventas' });
    }
  };

  const updateDeudaAccessLevel = async (role, newLevel) => {
    const newDeudaAccessLevels = { ...deudaAccessLevels, [role]: newLevel };
    setDeudaAccessLevels(newDeudaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        deudaAccessLevels: newDeudaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a deudas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a deudas' });
      setDeudaAccessLevels(deudaAccessLevels);
    }
  };

  const updateMovimientoAccessLevel = async (role, newLevel) => {
    const newMovimientoAccessLevels = { ...movimientoAccessLevels, [role]: newLevel };
    setMovimientoAccessLevels(newMovimientoAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        movimientoAccessLevels: newMovimientoAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a movimientos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a movimientos' });
      setMovimientoAccessLevels(movimientoAccessLevels);
    }
  };

  const toggleDeudaManagePermission = async (role) => {
    const newDeudaManagePermissions = { ...deudaManagePermissions, [role]: !deudaManagePermissions[role] };
    setDeudaManagePermissions(newDeudaManagePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        deudaManagePermissions: newDeudaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de deudas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de deudas' });
    }
  };

  const toggleClienteManagePermission = async (role) => {
    const newClienteManagePermissions = { ...clienteManagePermissions, [role]: !clienteManagePermissions[role] };
    setClienteManagePermissions(newClienteManagePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        clienteManagePermissions: newClienteManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de clientes actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de clientes' });
    }
  };

  const toggleMovimientoManagePermission = async (role) => {
    const newMovimientoManagePermissions = { ...movimientoManagePermissions, [role]: !movimientoManagePermissions[role] };
    setMovimientoManagePermissions(newMovimientoManagePermissions);
    
    try {
      const updatedConfig = {
        ...config,
        movimientoManagePermissions: newMovimientoManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de movimientos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de movimientos' });
    }
  };

  const toggleDeudaConfigPermission = async (role) => {
    const newDeudaConfigPermissions = { ...deudaConfigPermissions, [role]: !deudaConfigPermissions[role] };
    setDeudaConfigPermissions(newDeudaConfigPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        deudaConfigPermissions: newDeudaConfigPermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de configuración de deudas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de configuración de deudas' });
    }
  };

  const toggleWeightedAverageCost = async () => {
    const newValue = !applyWeightedAverageCost;
    setApplyWeightedAverageCost(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        applyWeightedAverageCost: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de costo promedio actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración de costo promedio' });
      setApplyWeightedAverageCost(applyWeightedAverageCost);
    }
  };

  const toggleAutoWithdrawOnEntry = async () => {
    const newValue = !autoWithdrawOnEntry;
    setAutoWithdrawOnEntry(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        autoWithdrawOnEntry: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de retiro automático actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración de retiro automático' });
      setAutoWithdrawOnEntry(autoWithdrawOnEntry);
    }
  };

  const toggleAutoApplySuggestedCost = async (role) => {
    const newAutoApplySuggestedCost = { ...autoApplySuggestedCost, [role]: !autoApplySuggestedCost[role] };
    setAutoApplySuggestedCost(newAutoApplySuggestedCost);
    
    try {
      const updatedConfig = {
        ...config,
        autoApplySuggestedCost: newAutoApplySuggestedCost,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de auto-aplicar costo sugerido actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de auto-aplicar costo sugerido' });
      setAutoApplySuggestedCost(autoApplySuggestedCost);
    }
  };

  const hasFullEntradaPermissions = (role) => {
    return entradaManagePermissions[role] === true && entradaAccessLevels[role] !== 'none';
  };

  const getRolesWithFullEntradaPermissions = () => {
    const roles = [];
    if (hasFullEntradaPermissions('dependiente')) roles.push('dependiente');
    if (hasFullEntradaPermissions('almacenero')) roles.push('almacenero');
    if (hasFullEntradaPermissions('economico')) roles.push('economico');
    return roles;
  };

  const toggleEntradaModalAfterProductCreation = async () => {
    const newValue = !showEntradaModalAfterProductCreation;
    setShowEntradaModalAfterProductCreation(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        showEntradaModalAfterProductCreation: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de pregunta de entrada actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración de pregunta de entrada' });
      setShowEntradaModalAfterProductCreation(showEntradaModalAfterProductCreation);
    }
  };

  const updateSalidaAccessLevel = async (role, newLevel) => {
    const newSalidaAccessLevels = { ...salidaAccessLevels, [role]: newLevel };
    setSalidaAccessLevels(newSalidaAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        salidaAccessLevels: newSalidaAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a salidas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a salidas' });
      setSalidaAccessLevels(salidaAccessLevels);
    }
  };

  const toggleSalidaManagePermission = async (role) => {
    const newSalidaManagePermissions = { ...salidaManagePermissions, [role]: !salidaManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        salidaManagePermissions: newSalidaManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de salidas actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de salidas' });
    }
  };

  const updateOperacionAccessLevel = async (role, newLevel) => {
    const newOperacionAccessLevels = { ...operacionAccessLevels, [role]: newLevel };
    setOperacionAccessLevels(newOperacionAccessLevels);
    
    try {
      const updatedConfig = {
        ...config,
        operacionAccessLevels: newOperacionAccessLevels,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Nivel de acceso a operaciones actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a operaciones' });
      setOperacionAccessLevels(operacionAccessLevels);
    }
  };

  const toggleOperacionManagePermission = async (role) => {
    const newOperacionManagePermissions = { ...operacionManagePermissions, [role]: !operacionManagePermissions[role] };
    
    try {
      const updatedConfig = {
        ...config,
        operacionManagePermissions: newOperacionManagePermissions,
      };
      await configService.updateConfig(updatedConfig);
      
      await fetchConfig();
      
      showToast({ type: 'success', message: 'Permiso de gestión de operaciones actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de operaciones' });
    }
  };

  const styles = createStyles(responsive);

  const CuentaTipoConfig = ({ tipo, label, icon, color, config, onAdd, onRemove }) => {
    const tiposCuentaDisplay = {
      efectivo_cup: 'Efectivo CUP',
      efectivo_usd: 'Efectivo USD',
      transferencia_cup: 'Transferencia CUP',
      transferencia_usd: 'Transferencia USD',
    };

    if (!tipo || !label || !icon) {
      return null;
    }

    const safeConfig = config || [];
    const displayTipo = tiposCuentaDisplay[tipo] || label;

    return (
      <View style={[styles.cuentaTipoSection, { borderColor: colors.outlineVariant }]}>
        <View style={styles.cuentaTipoHeader}>
          <View style={[styles.cuentaTipoIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <Text style={[styles.cuentaTipoLabel, { color: colors.onSurface }]}>
            {label}
          </Text>
          <Text style={[styles.cuentaTipoCount, { color: colors.outline }]}>
            {safeConfig.length}/4
          </Text>
        </View>

        <View style={styles.cuentaTipoList}>
          {safeConfig.length === 0 ? (
            <Text style={[styles.cuentaTipoEmpty, { color: colors.outline }]}>
              No hay cuentas seleccionadas
            </Text>
          ) : (
            safeConfig.map((cuenta, index) => {
              if (!cuenta || !cuenta.id_cuenta) return null;
              return (
                <View key={cuenta.id_cuenta} style={[styles.cuentaTipoItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <Text style={[styles.cuentaTipoItemName, { color: colors.onSurface }]} numberOfLines={1}>
                    {cuenta.nombre || 'Sin nombre'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.cuentaTipoRemoveButton, { backgroundColor: `${color}20` }]}
                    onPress={() => onRemove(index)}
                  >
                    <Ionicons name="close" size={16} color={color} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {safeConfig.length < 4 && (
          <TouchableOpacity
            style={[styles.cuentaTipoAddButton, { backgroundColor: `${color}20`, borderColor: color }]}
            onPress={onAdd}
          >
            <Ionicons name="add" size={18} color={color} />
            <Text style={[styles.cuentaTipoAddText, { color: color }]}>
              Agregar cuenta {displayTipo}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        onMenuPress={() => setSidebarOpen(true)}
        isDark={isDarkMode}
        title="Configuraciones del Admin"
        showVersion={false}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="CurrencyExchange"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando configuración...
              </Text>
            </View>
          ) : (
            <>
              {isConnected && (
                <View style={styles.exchangeRatesSection}>
                  <View style={styles.exchangeRatesHeader}>
                    <Ionicons name="cash" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.exchangeRatesTitle, { color: colors.onSurface }]}>
                      Tasas de cambio en vivo segùn elTOQUE
                    </Text>
                    <TouchableOpacity 
                      onPress={() => fetchExchangeRates(true)} 
                      style={styles.refreshButton}
                      disabled={isLoadingRates}
                    >
                      {isLoadingRates ? (
                        <ActivityIndicator size={responsive.responsiveWidth(18)} color={colors.primary} />
                      ) : (
                        <Ionicons 
                          name="refresh" 
                          size={responsive.responsiveWidth(18)} 
                          color={colors.primary} 
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {isLoadingRates ? (
                    <View style={styles.ratesLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.ratesLoadingText, { color: colors.outline }]}>
                        Cargando tasas...
                      </Text>
                    </View>
                  ) : exchangeRates ? (
                    <View style={styles.ratesContainer}>
                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🇺🇸</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>USD</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Dólar Americano</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.USD, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🇪🇺</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>ECU</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Euro</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.ECU, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>🏦</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>MLC</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Divisa Cubana</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.MLC, 'CUP')}
                        </Text>
                      </View>

                      <View style={styles.rateItem}>
                        <View style={styles.rateInfo}>
                          <Text style={styles.currencyFlag}>💵</Text>
                          <View>
                            <Text style={[styles.currencyName, { color: colors.onSurface }]}>USDT</Text>
                            <Text style={[styles.currencyLabel, { color: colors.outline }]}>Tether TRC20</Text>
                          </View>
                        </View>
                        <Text style={[styles.rateValue, { color: colors.primary }]}>
                          {exchangeRateService.formatCurrency(exchangeRates.tasas.USDT_TRC20, 'CUP')}
                        </Text>
                      </View>

                      <Text style={[styles.ratesSource, { color: colors.outline }]}>
                        Actualizado: {exchangeRates.date} {exchangeRates.hour}:{exchangeRates.minutes.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.ratesErrorContainer}>
                      <Ionicons name="alert-circle" size={responsive.responsiveWidth(20)} color={colors.error} />
                      <Text style={[styles.ratesErrorText, { color: colors.error }]}>
                        No se pudieron cargar las tasas de cambio
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cambio CUP → USD *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Ej: 630"
                  value={exchangeRate}
                  onChangeText={setExchangeRate}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.helperText, { color: colors.outline }]}>
                  Ingresa el valor de 1 CUP en USD
                </Text>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(24)} color={colors.primary} />
                  <Text style={[styles.infoTitle, { color: colors.onSurface }]}>
                    Información
                  </Text>
                </View>
                <Text style={[styles.infoText, { color: colors.outline }]}>
                  Esta configuración se utiliza para convertir precios de CUP a USD en toda la aplicación.
                </Text>
              </View>

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
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/product.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Productos y Servicios
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowProductoPermissions(!showProductoPermissions)}
            >
              <Ionicons 
                name={showProductoPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showProductoPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a productos y servicios para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Productos/Servicios ni ningún producto del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Productos/Servicios pero solo los de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Productos/Servicios y los de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Productos - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a productos, solo pueden ver los de su tienda, o pueden ver los de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={productoAccessLevels.dependiente}
              onChange={(newLevel) => updateProductoAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Productos - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a productos, solo pueden ver los de su tienda, o pueden ver los de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={productoAccessLevels.almacenero}
              onChange={(newLevel) => updateProductoAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Productos - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a productos, solo pueden ver los de su tienda, o pueden ver los de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={productoAccessLevels.economico}
              onChange={(newLevel) => updateProductoAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(productoAccessLevels.dependiente !== 'none' || productoAccessLevels.almacenero !== 'none' || productoAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Productos y Servicios
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowProductoManage(!showProductoManage)}
                >
                  <Ionicons 
                    name={showProductoManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showProductoManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar productos y servicios (solo visible para roles con acceso)
                  </Text>
                  {productoAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Productos - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar productos y servicios. Cuando está desactivado, solo pueden ver la información sin poder modificarla.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={productoManagePermissions.dependiente}
                        onValueChange={() => toggleProductoManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={productoManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {productoAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Productos - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar productos y servicios. Cuando está desactivado, solo pueden ver la información sin poder modificarla.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={productoManagePermissions.almacenero}
                        onValueChange={() => toggleProductoManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={productoManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {productoAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Productos - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar productos y servicios. Cuando está desactivado, solo pueden ver la información sin poder modificarla.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={productoManagePermissions.economico}
                        onValueChange={() => toggleProductoManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={productoManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/package-add - copia.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Configuración de Entradas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowEntradaConfig(!showEntradaConfig)}
            >
              <Ionicons 
                name={showEntradaConfig ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showEntradaConfig && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el cálculo automático de costo promedio ponderado y el modal de entrada para nuevos productos
              </Text>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Aplicar Fórmula de Costo Promedio Ponderado
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Fórmula de Costo Promedio Ponderado',
                      'Cuando está activo, el costo de los productos se recalcula automáticamente al crear una entrada usando la fórmula: (costo_actual × cantidad_actual + costo_entrada × cantidad_entrada) / (cantidad_actual + cantidad_entrada)'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={applyWeightedAverageCost}
                  onValueChange={toggleWeightedAverageCost}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={applyWeightedAverageCost ? '#fff' : colors.outline}
                />
              </View>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Retiro Automático al Agregar Entrada
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Retiro Automático al Agregar Entrada',
                      'Cuando está activo, al agregar una nueva entrada se preguntará al usuario si desea hacer una operación de retiro de una cuenta relacionada a la tienda. El motivo será "compra de X cantidad de productos Y".'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={autoWithdrawOnEntry}
                  onValueChange={toggleAutoWithdrawOnEntry}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={autoWithdrawOnEntry ? '#fff' : colors.outline}
                />
              </View>

              {applyWeightedAverageCost && getRolesWithFullEntradaPermissions().length > 0 && (
                <>
                  <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden aplicar automáticamente el costo sugerido por la fórmula sin confirmación
                  </Text>

                  {getRolesWithFullEntradaPermissions().includes('dependiente') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Dependiente',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.dependiente}
                        onValueChange={() => toggleAutoApplySuggestedCost('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}

                  {getRolesWithFullEntradaPermissions().includes('almacenero') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Almacenero',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.almacenero}
                        onValueChange={() => toggleAutoApplySuggestedCost('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}

                  {getRolesWithFullEntradaPermissions().includes('economico') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Auto-aplicar Costo Sugerido - Económico',
                            'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={autoApplySuggestedCost.economico}
                        onValueChange={() => toggleAutoApplySuggestedCost('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={autoApplySuggestedCost.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Preguntar si Agregar Entrada al Crear Producto
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Pregunta de Entrada al Crear Producto',
                      'Cuando está activo, después de crear un nuevo producto se preguntará si deseas agregar una entrada de stock para ese producto (solo para usuarios con permisos de gestión de entradas).'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={showEntradaModalAfterProductCreation}
                  onValueChange={toggleEntradaModalAfterProductCreation}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={showEntradaModalAfterProductCreation ? '#fff' : colors.outline}
                />
              </View>
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/package-add.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Entradas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowEntradaPermissions(!showEntradaPermissions)}
            >
              <Ionicons 
                name={showEntradaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showEntradaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las entradas para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Entradas ni ninguna entrada del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Entradas pero solo las entradas de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Entradas y las entradas de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Entradas - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.dependiente}
              onChange={(newLevel) => updateEntradaAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Entradas - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.almacenero}
              onChange={(newLevel) => updateEntradaAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Entradas - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={entradaAccessLevels.economico}
              onChange={(newLevel) => updateEntradaAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(entradaAccessLevels.dependiente !== 'none' || entradaAccessLevels.almacenero !== 'none' || entradaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Entradas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowEntradaManage(!showEntradaManage)}
                >
                  <Ionicons 
                    name={showEntradaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showEntradaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar entradas (solo visible para roles con acceso)
                  </Text>
                  {entradaAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.dependiente}
                        onValueChange={() => toggleEntradaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {entradaAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.almacenero}
                        onValueChange={() => toggleEntradaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {entradaAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Entradas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={entradaManagePermissions.economico}
                        onValueChange={() => toggleEntradaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={entradaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/box.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Salidas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowSalidaPermissions(!showSalidaPermissions)}
            >
              <Ionicons 
                name={showSalidaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showSalidaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las salidas para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Salidas ni ninguna salida del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Salidas pero solo las salidas de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Salidas y las salidas de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Salidas - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.dependiente}
              onChange={(newLevel) => updateSalidaAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Salidas - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.almacenero}
              onChange={(newLevel) => updateSalidaAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Salidas - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={salidaAccessLevels.economico}
              onChange={(newLevel) => updateSalidaAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(salidaAccessLevels.dependiente !== 'none' || salidaAccessLevels.almacenero !== 'none' || salidaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Salidas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowSalidaManage(!showSalidaManage)}
                >
                  <Ionicons 
                    name={showSalidaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showSalidaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar salidas (solo visible para roles con acceso)
                  </Text>
                  {salidaAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.dependiente}
                        onValueChange={() => toggleSalidaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {salidaAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.almacenero}
                        onValueChange={() => toggleSalidaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {salidaAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Salidas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={salidaManagePermissions.economico}
                        onValueChange={() => toggleSalidaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={salidaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/report.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Operaciones
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowOperacionPermissions(!showOperacionPermissions)}
            >
              <Ionicons 
                name={showOperacionPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showOperacionPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las operaciones para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Operaciones ni ninguna operación del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Operaciones pero solo las operaciones de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Operaciones y las operaciones de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Operaciones - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a operaciones, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={operacionAccessLevels.dependiente}
              onChange={(newLevel) => updateOperacionAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Operaciones - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a operaciones, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={operacionAccessLevels.almacenero}
              onChange={(newLevel) => updateOperacionAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Operaciones - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a operaciones, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={operacionAccessLevels.economico}
              onChange={(newLevel) => updateOperacionAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(operacionAccessLevels.dependiente !== 'none' || operacionAccessLevels.almacenero !== 'none' || operacionAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Operaciones
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowOperacionManage(!showOperacionManage)}
                >
                  <Ionicons 
                    name={showOperacionManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showOperacionManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar operaciones (solo visible para roles con acceso)
                  </Text>
                  {operacionAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Operaciones - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={operacionManagePermissions.dependiente}
                        onValueChange={() => toggleOperacionManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={operacionManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {operacionAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Operaciones - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={operacionManagePermissions.almacenero}
                        onValueChange={() => toggleOperacionManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={operacionManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {operacionAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Operaciones - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={operacionManagePermissions.economico}
                        onValueChange={() => toggleOperacionManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={operacionManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/sales (1).png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Configuraciones de Ventas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowSalesConfigurations(!showSalesConfigurations)}
            >
              <Ionicons 
                name={showSalesConfigurations ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showSalesConfigurations && (
            <>
              {/* Configurar Cuentas para Ventas */}
              <View style={styles.subSection}>
                <Text style={[styles.subSectionTitle, { color: colors.onSurface }]}>
                  Configurar Cuentas para Ventas
                </Text>
                <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                  Configura hasta 4 cuentas por tipo de cuenta para cada tienda. Estas cuentas se usarán por defecto al realizar ventas.
                </Text>
                <TouchableOpacity
                  style={[styles.configCuentasButton, { backgroundColor: colors.primary }]}
                  onPress={handleOpenSalesConfig}
                >
                  <Ionicons name="settings-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                  <Text style={styles.configCuentasButtonText}>Configurar Cuentas</Text>
                </TouchableOpacity>
              </View>

              {/* Cambio de Cuenta en Ventas */}
              <View style={styles.subSection}>
                <Text style={[styles.subSectionTitle, { color: colors.onSurface }]}>
                  Cambio de Cuenta en Ventas
                </Text>
                <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                  Configura qué roles pueden cambiar la cuenta seleccionada al momento de realizar una venta
                </Text>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Dependiente
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Cuenta - Dependiente',
                        'Cuando está activo, los usuarios con rol Dependiente pueden cambiar la cuenta seleccionada al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={cuentaChangePermissions.dependiente}
                    onValueChange={() => toggleCuentaChangePermission('dependiente')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={cuentaChangePermissions.dependiente ? '#fff' : colors.outline}
                  />
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Almacenero
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Cuenta - Almacenero',
                        'Cuando está activo, los usuarios con rol Almacenero pueden cambiar la cuenta seleccionada al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={cuentaChangePermissions.almacenero}
                    onValueChange={() => toggleCuentaChangePermission('almacenero')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={cuentaChangePermissions.almacenero ? '#fff' : colors.outline}
                  />
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Económico
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Cuenta - Económico',
                        'Cuando está activo, los usuarios con rol Económico pueden cambiar la cuenta seleccionada al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={cuentaChangePermissions.economico}
                    onValueChange={() => toggleCuentaChangePermission('economico')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={cuentaChangePermissions.economico ? '#fff' : colors.outline}
                  />
                </View>
              </View>

              {/* Cambio de Precio en Ventas */}
              <View style={styles.subSection}>
                <Text style={[styles.subSectionTitle, { color: colors.onSurface }]}>
                  Cambio de Precio en Ventas
                </Text>
                <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                  Configura qué roles pueden cambiar el precio de los productos al momento de realizar una venta
                </Text>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Dependiente
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Precio - Dependiente',
                        'Cuando está activo, los usuarios con rol Dependiente pueden cambiar el precio de los productos al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={priceChangePermissions.dependiente}
                    onValueChange={() => togglePriceChangePermission('dependiente')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={priceChangePermissions.dependiente ? '#fff' : colors.outline}
                  />
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Almacenero
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Precio - Almacenero',
                        'Cuando está activo, los usuarios con rol Almacenero pueden cambiar el precio de los productos al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={priceChangePermissions.almacenero}
                    onValueChange={() => togglePriceChangePermission('almacenero')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={priceChangePermissions.almacenero ? '#fff' : colors.outline}
                  />
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.permissionInfo}>
                    <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                      Económico
                    </Text>
                    <TouchableOpacity 
                      style={[styles.infoButton, { backgroundColor: colors.primary }]}
                      onPress={() => showInfoModal(
                        'Cambio de Precio - Económico',
                        'Cuando está activo, los usuarios con rol Económico pueden cambiar el precio de los productos al momento de realizar una venta.'
                      )}
                    >
                      <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                    </TouchableOpacity>
                  </View>
                  <Switch
                    value={priceChangePermissions.economico}
                    onValueChange={() => togglePriceChangePermission('economico')}
                    trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                    thumbColor={priceChangePermissions.economico ? '#fff' : colors.outline}
                  />
                </View>
              </View>

              {/* Configuración de Comprobante */}
              <View style={styles.subSection}>
                <Text style={[styles.subSectionTitle, { color: colors.onSurface }]}>
                  Configuración de Comprobante
                </Text>
                <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                  Personaliza el logo y nombre del negocio que aparecerán en los comprobantes de venta
                </Text>
                <TouchableOpacity
                  style={[styles.configCuentasButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowComprobanteConfig(true)}
                >
                  <Ionicons name="settings-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                  <Text style={styles.configCuentasButtonText}>Configurar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/sales.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Ventas
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowVentaPermissions(!showVentaPermissions)}
            >
              <Ionicons 
                name={showVentaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showVentaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a las ventas para cada rol
              </Text>

              <View style={styles.accessLevelExplanation}>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="lock-closed" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Sin acceso:</Text> No puede ver la pantalla de Ventas ni ninguna venta del sistema
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="storefront" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Mi tienda:</Text> Puede ver la pantalla de Ventas pero solo las ventas de su tienda
                  </Text>
                </View>
                <View style={styles.accessLevelExplanationItem}>
                  <Ionicons name="globe" size={16} color={colors.outline} />
                  <Text style={[styles.accessLevelExplanationText, { color: colors.outline }]}>
                    <Text style={{ fontWeight: '600' }}>Todas las tiendas:</Text> Puede ver la pantalla de Ventas y las ventas de todas las tiendas
                  </Text>
                </View>
              </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Dependiente
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Ventas - Dependiente',
                  'Define si los usuarios con rol Dependiente no tienen acceso a ventas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={ventaAccessLevels.dependiente}
              onChange={(newLevel) => updateVentaAccessLevel('dependiente', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Almacenero
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Ventas - Almacenero',
                  'Define si los usuarios con rol Almacenero no tienen acceso a ventas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={ventaAccessLevels.almacenero}
              onChange={(newLevel) => updateVentaAccessLevel('almacenero', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                Económico
              </Text>
              <TouchableOpacity 
                style={[styles.infoButton, { backgroundColor: colors.primary }]}
                onPress={() => showInfoModal(
                  'Acceso a Ventas - Económico',
                  'Define si los usuarios con rol Económico no tienen acceso a ventas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                )}
              >
                <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
              </TouchableOpacity>
            </View>
            <AccessLevelSwitch
              value={ventaAccessLevels.economico}
              onChange={(newLevel) => updateVentaAccessLevel('economico', newLevel)}
              colors={colors}
              responsive={responsive}
            />
          </View>

          {(ventaAccessLevels.dependiente !== 'none' || ventaAccessLevels.almacenero !== 'none' || ventaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Ventas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowVentaManage(!showVentaManage)}
                >
                  <Ionicons 
                    name={showVentaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showVentaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar ventas (solo visible para roles con acceso)
                  </Text>
                  {ventaAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Ventas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={ventaManagePermissions.dependiente}
                        onValueChange={() => toggleVentaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={ventaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {ventaAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Ventas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={ventaManagePermissions.almacenero}
                        onValueChange={() => toggleVentaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={ventaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {ventaAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Ventas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={ventaManagePermissions.economico}
                        onValueChange={() => toggleVentaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={ventaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/customer-search.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                Permisos de Deudas y Clientes
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowDeudaPermissions(!showDeudaPermissions)}
            >
              <Ionicons 
                name={showDeudaPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showDeudaPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a deudas y clientes para cada rol (No ver, Ver clientes, Ver ambos)
              </Text>
              
              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Dependiente
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Deudas - Dependiente',
                      'No ver: No puede ver deudas ni clientes. Ver clientes: Solo puede ver clientes. Ver ambos: Puede ver deudas y clientes.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <DeudaClienteAccessLevelSwitch
                  value={deudaAccessLevels.dependiente}
                  onChange={(newLevel) => updateDeudaAccessLevel('dependiente', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Almacenero
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Deudas - Almacenero',
                      'No ver: No puede ver deudas ni clientes. Ver clientes: Solo puede ver clientes. Ver ambos: Puede ver deudas y clientes.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <DeudaClienteAccessLevelSwitch
                  value={deudaAccessLevels.almacenero}
                  onChange={(newLevel) => updateDeudaAccessLevel('almacenero', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Económico
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Deudas - Económico',
                      'No ver: No puede ver deudas ni clientes. Ver clientes: Solo puede ver clientes. Ver ambos: Puede ver deudas y clientes.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <DeudaClienteAccessLevelSwitch
                  value={deudaAccessLevels.economico}
                  onChange={(newLevel) => updateDeudaAccessLevel('economico', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

          {(deudaAccessLevels.dependiente !== 'none' || deudaAccessLevels.almacenero !== 'none' || deudaAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Deudas
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowDeudaManage(!showDeudaManage)}
                >
                  <Ionicons 
                    name={showDeudaManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showDeudaManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar deudas y pagos (solo visible para roles con acceso a deudas)
                  </Text>
                  {deudaAccessLevels.dependiente === 'ambos' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Deudas - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar deudas y pagos. Cuando está desactivado, solo pueden ver la información sin poder gestionar deudas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={deudaManagePermissions.dependiente}
                        onValueChange={() => toggleDeudaManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={deudaManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {deudaAccessLevels.almacenero === 'ambos' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Deudas - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar deudas y pagos. Cuando está desactivado, solo pueden ver la información sin poder gestionar deudas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={deudaManagePermissions.almacenero}
                        onValueChange={() => toggleDeudaManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={deudaManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {deudaAccessLevels.economico === 'ambos' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Deudas - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar deudas y pagos. Cuando está desactivado, solo pueden ver la información sin poder gestionar deudas.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={deudaManagePermissions.economico}
                        onValueChange={() => toggleDeudaManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={deudaManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {(deudaAccessLevels.dependiente === 'clientes' || deudaAccessLevels.dependiente === 'ambos' ||
            deudaAccessLevels.almacenero === 'clientes' || deudaAccessLevels.almacenero === 'ambos' ||
            deudaAccessLevels.economico === 'clientes' || deudaAccessLevels.economico === 'ambos') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Clientes
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowClienteManage(!showClienteManage)}
                >
                  <Ionicons 
                    name={showClienteManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showClienteManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar clientes (solo visible para roles con acceso a clientes)
                  </Text>
                  {(deudaAccessLevels.dependiente === 'clientes' || deudaAccessLevels.dependiente === 'ambos') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Clientes - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar clientes. Cuando está desactivado, solo pueden ver la información sin poder gestionar clientes.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={clienteManagePermissions.dependiente}
                        onValueChange={() => toggleClienteManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={clienteManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {(deudaAccessLevels.almacenero === 'clientes' || deudaAccessLevels.almacenero === 'ambos') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Clientes - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar clientes. Cuando está desactivado, solo pueden ver la información sin poder gestionar clientes.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={clienteManagePermissions.almacenero}
                        onValueChange={() => toggleClienteManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={clienteManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {(deudaAccessLevels.economico === 'clientes' || deudaAccessLevels.economico === 'ambos') && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Clientes - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar clientes. Cuando está desactivado, solo pueden ver la información sin poder gestionar clientes.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={clienteManagePermissions.economico}
                        onValueChange={() => toggleClienteManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={clienteManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/lanza-libre.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Permisos de Movimientos
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowMovimientoPermissions(!showMovimientoPermissions)}
            >
              <Ionicons 
                name={showMovimientoPermissions ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showMovimientoPermissions && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura el nivel de acceso a los movimientos para cada rol
              </Text>
              
              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Dependiente
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Movimientos - Dependiente',
                      'Sin acceso: No puede ver movimientos. Mi tienda: Solo puede ver movimientos de su tienda (origen o destino). Todas: Puede ver movimientos de todas las tiendas.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <AccessLevelSwitch
                  value={movimientoAccessLevels.dependiente}
                  onChange={(newLevel) => updateMovimientoAccessLevel('dependiente', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Almacenero
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Movimientos - Almacenero',
                      'Sin acceso: No puede ver movimientos. Mi tienda: Solo puede ver movimientos de su tienda (origen o destino). Todas: Puede ver movimientos de todas las tiendas.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <AccessLevelSwitch
                  value={movimientoAccessLevels.almacenero}
                  onChange={(newLevel) => updateMovimientoAccessLevel('almacenero', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Económico
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Acceso Movimientos - Económico',
                      'Sin acceso: No puede ver movimientos. Mi tienda: Solo puede ver movimientos de su tienda (origen o destino). Todas: Puede ver movimientos de todas las tiendas.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <AccessLevelSwitch
                  value={movimientoAccessLevels.economico}
                  onChange={(newLevel) => updateMovimientoAccessLevel('economico', newLevel)}
                  colors={colors}
                  responsive={responsive}
                />
              </View>

          {(movimientoAccessLevels.dependiente !== 'none' || movimientoAccessLevels.almacenero !== 'none' || movimientoAccessLevels.economico !== 'none') && (
            <View style={styles.permissionSection}>
              <View style={styles.permissionSectionHeader}>
                <Text style={[styles.permissionSectionTitle, { color: colors.onSurface }]}>
                  Gestión de Movimientos
                </Text>
                <TouchableOpacity 
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setShowMovimientoManage(!showMovimientoManage)}
                >
                  <Ionicons 
                    name={showMovimientoManage ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
              {showMovimientoManage && (
                <>
                  <Text style={[styles.permissionSectionSubtitle, { color: colors.outline }]}>
                    Configura qué roles pueden crear, editar y eliminar movimientos (solo visible para roles con acceso)
                  </Text>
                  {movimientoAccessLevels.dependiente !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Dependiente
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Movimientos - Dependiente',
                            'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos. Solo pueden usar su propia tienda como origen.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={movimientoManagePermissions.dependiente}
                        onValueChange={() => toggleMovimientoManagePermission('dependiente')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={movimientoManagePermissions.dependiente ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {movimientoAccessLevels.almacenero !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Almacenero
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Movimientos - Almacenero',
                            'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos. Solo pueden usar su propia tienda como origen.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={movimientoManagePermissions.almacenero}
                        onValueChange={() => toggleMovimientoManagePermission('almacenero')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={movimientoManagePermissions.almacenero ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                  {movimientoAccessLevels.economico !== 'none' && (
                    <View style={styles.permissionItem}>
                      <View style={styles.permissionInfo}>
                        <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                          Económico
                        </Text>
                        <TouchableOpacity 
                          style={[styles.infoButton, { backgroundColor: colors.primary }]}
                          onPress={() => showInfoModal(
                            'Gestión Movimientos - Económico',
                            'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos. Solo pueden usar su propia tienda como origen.'
                          )}
                        >
                          <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={movimientoManagePermissions.economico}
                        onValueChange={() => toggleMovimientoManagePermission('economico')}
                        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                        thumbColor={movimientoManagePermissions.economico ? '#fff' : colors.outline}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}
            </>
          )}
        </Card>

        <Card style={[styles.permissionsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.permissionsHeader}>
            <View style={styles.permissionsHeaderLeft}>
              <Image source={require('../../assets/wi-fi.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.permissionsTitle, { color: colors.onSurface }]}>
                Priorizar Conexión WiFi Local
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowWifiConfig(!showWifiConfig)}
            >
              <Ionicons 
                name={showWifiConfig ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          {showWifiConfig && (
            <>
              <Text style={[styles.permissionsSubtitle, { color: colors.outline }]}>
                Configura si la app debe priorizar la conexión al servidor local por WiFi
              </Text>

              <View style={styles.permissionItem}>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionLabel, { color: colors.onSurface }]}>
                    Activar prioridad WiFi
                  </Text>
                  <TouchableOpacity 
                    style={[styles.infoButton, { backgroundColor: colors.primary }]}
                    onPress={() => showInfoModal(
                      'Priorizar Conexión WiFi Local',
                      'Cuando está activo, la app priorizará la conexión al servidor local por WiFi cuando esté disponible. Esto mejora el rendimiento cuando usas un servidor local en tu red. Desactívalo si usas principalmente un servidor remoto.'
                    )}
                  >
                    <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={prioritizeWifiConnection}
                  onValueChange={togglePrioritizeWifiConnection}
                  trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                  thumbColor={prioritizeWifiConnection ? '#fff' : colors.outline}
                />
              </View>
            </>
          )}
        </Card>

      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={infoModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeInfoModal}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="information-circle" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                {infoModal.title}
              </Text>
            </View>
            <Text style={[styles.modalDescription, { color: colors.outline }]}>
              {infoModal.description}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={closeInfoModal}
            >
              <Text style={[styles.modalButtonText, { color: '#fff' }]}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCurrencyModalCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="swap-horizontal" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Actualizar Precios y Costos
              </Text>
            </View>
            
            <ScrollView 
              style={styles.currencyModalScrollView}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                La tasa de cambio ha cambiado. ¿Deseas actualizar los precios y/o costos de tus productos y servicios?
              </Text>

              <View style={styles.currencyModalSection}>
                <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                  ¿Qué deseas modificar?
                </Text>
                <View style={styles.currencyModalOptions}>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'nada' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'nada' })}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={currencyModalConfig.datosModificar === 'nada' ? '#fff' : colors.outline}
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'nada' ? '#fff' : colors.onSurface }]}>
                      Nada
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'precios' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'precios' })}
                  >
                    <Ionicons
                      name="pricetag"
                      size={20}
                      color={currencyModalConfig.datosModificar === 'precios' ? '#fff' : colors.outline}
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'precios' ? '#fff' : colors.onSurface }]}>
                      Solo Precios
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'costos' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'costos' })}
                  >
                    <Ionicons
                      name="wallet"
                      size={20}
                      color={currencyModalConfig.datosModificar === 'costos' ? '#fff' : colors.outline}
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'costos' ? '#fff' : colors.onSurface }]}>
                      Solo Costos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.currencyModalOption,
                      currencyModalConfig.datosModificar === 'ambos' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, datosModificar: 'ambos' })}
                  >
                    <Ionicons
                      name="layers"
                      size={20}
                      color={currencyModalConfig.datosModificar === 'ambos' ? '#fff' : colors.outline}
                    />
                    <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.datosModificar === 'ambos' ? '#fff' : colors.onSurface }]}>
                      Ambos
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {currencyModalConfig.datosModificar !== 'nada' && (
                <>
                  <View style={styles.currencyModalSection}>
                    <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                      ¿Qué servicios actualizar?
                    </Text>
                    <View style={styles.currencyModalOptions}>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          !currencyModalConfig.modificarSoloServicios && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, modificarSoloServicios: false })}
                      >
                        <Ionicons
                          name="apps"
                          size={20}
                          color={!currencyModalConfig.modificarSoloServicios ? '#fff' : colors.outline}
                        />
                        <Text style={[styles.currencyModalOptionText, { color: !currencyModalConfig.modificarSoloServicios ? '#fff' : colors.onSurface }]}>
                          Todos (Productos + Servicios)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.modificarSoloServicios && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, modificarSoloServicios: true })}
                      >
                        <Ionicons
                          name="list"
                          size={20}
                          color={currencyModalConfig.modificarSoloServicios ? '#fff' : colors.outline}
                        />
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.modificarSoloServicios ? '#fff' : colors.onSurface }]}>
                          Solo Servicios (sin producto)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.currencyModalSection}>
                    <View style={styles.currencyModalSectionHeader}>
                      <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                        Categoría (Opcional)
                      </Text>
                    </View>
                    <View style={styles.currencyModalInputContainer}>
                      <TextInput
                        style={[styles.currencyModalInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholder="Todas las categorías"
                        placeholderTextColor={colors.outline}
                        value={currencyModalConfig.categoria_servicio}
                        onChangeText={(text) => {
                          setCurrencyModalConfig({ ...currencyModalConfig, categoria_servicio: text });
                          setCategoriaSearchText(text);
                        }}
                        onFocus={() => setShowCategoriaDropdown(true)}
                      />
                      <TouchableOpacity
                        style={styles.dropdownIcon}
                        onPress={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
                      >
                        <Ionicons name={showCategoriaDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.outline} />
                      </TouchableOpacity>
                    </View>
                    {showCategoriaDropdown && (
                      <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              setCurrencyModalConfig({ ...currencyModalConfig, categoria_servicio: '' });
                              setShowCategoriaDropdown(false);
                              setCategoriaSearchText('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las categorías</Text>
                          </TouchableOpacity>
                          {[...predefinedCategories, ...customCategories]
                            .filter(cat => cat.toLowerCase().includes(categoriaSearchText.toLowerCase()))
                            .map((category, index, filteredArray) => (
                              <TouchableOpacity
                                key={category}
                                style={[styles.dropdownItem, index === filteredArray.length - 1 && styles.dropdownItemLast]}
                                onPress={() => {
                                  setCurrencyModalConfig({ ...currencyModalConfig, categoria_servicio: category });
                                  setShowCategoriaDropdown(false);
                                  setCategoriaSearchText('');
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{category}</Text>
                              </TouchableOpacity>
                            ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={styles.currencyModalSection}>
                    <View style={styles.currencyModalSectionHeader}>
                      <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                        ¿Basar conversión en?
                      </Text>
                    </View>
                    <View style={styles.currencyModalOptions}>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.tipoDatoModificar === 'usd' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, tipoDatoModificar: 'usd' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.tipoDatoModificar === 'usd' ? '#fff' : colors.onSurface }]}>
                          USD (Actualizar CUP)
                        </Text>
                        <Text style={[styles.currencyModalOptionSubtext, { color: currencyModalConfig.tipoDatoModificar === 'usd' ? '#fff' : colors.outline }]}>
                          CUP = USD × {exchangeRate}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.tipoDatoModificar === 'cup' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, tipoDatoModificar: 'cup' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.tipoDatoModificar === 'cup' ? '#fff' : colors.onSurface }]}>
                          CUP (Actualizar USD)
                        </Text>
                        <Text style={[styles.currencyModalOptionSubtext, { color: currencyModalConfig.tipoDatoModificar === 'cup' ? '#fff' : colors.outline }]}>
                          USD = CUP / {exchangeRate}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.currencyModalSection}>
                    <View style={styles.currencyModalSectionHeader}>
                      <Text style={[styles.currencyModalSectionTitle, { color: colors.onSurface }]}>
                        Redondeo por exceso (CUP)
                      </Text>
                      <TouchableOpacity
                        style={[styles.infoButton, { backgroundColor: colors.primary }]}
                        onPress={() => showInfoModal(
                          'Redondeo por Exceso',
                          'El redondeo por exceso se aplica al precio CUP calculado. Por ejemplo: si el precio calculado es 364.5 y seleccionas redondeo a 5, el precio será 365. Si seleccionas redondeo a 10, será 370. Esto ayuda a evitar precios con decimales.'
                        )}
                      >
                        <Text style={[styles.infoButtonText, { color: '#fff' }]}>!</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.currencyModalOptions}>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.redondeo_exeso === 'ninguna' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, redondeo_exeso: 'ninguna' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.redondeo_exeso === 'ninguna' ? '#fff' : colors.onSurface }]}>
                          Ninguna
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.redondeo_exeso === '5' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, redondeo_exeso: '5' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.redondeo_exeso === '5' ? '#fff' : colors.onSurface }]}>
                          5
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.redondeo_exeso === '10' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, redondeo_exeso: '10' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.redondeo_exeso === '10' ? '#fff' : colors.onSurface }]}>
                          10
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.redondeo_exeso === '20' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, redondeo_exeso: '20' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.redondeo_exeso === '20' ? '#fff' : colors.onSurface }]}>
                          20
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencyModalOption,
                          currencyModalConfig.redondeo_exeso === '50' && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setCurrencyModalConfig({ ...currencyModalConfig, redondeo_exeso: '50' })}
                      >
                        <Text style={[styles.currencyModalOptionText, { color: currencyModalConfig.redondeo_exeso === '50' ? '#fff' : colors.onSurface }]}>
                          50
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.currencyModalButtons}>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={handleCurrencyModalCancel}
              >
                <Text style={[styles.currencyModalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  if (currencyModalConfig.datosModificar !== 'nada') {
                    await fetchPreviewItems();
                  } else {
                    handleCurrencyModalConfirm();
                  }
                }}
              >
                <Text style={[styles.currencyModalButtonText, { color: '#fff' }]}>Aplicar Cambios</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="list" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Vista Previa de Cambios
              </Text>
            </View>

            <ScrollView style={styles.currencyModalScrollView} showsVerticalScrollIndicator={true}>
              <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                {previewItems.length} {previewItems.length === 1 ? 'producto/servicio' : 'productos/servicios'} serán modificados
                {currencyModalConfig.categoria_servicio ? ` en la categoría "${currencyModalConfig.categoria_servicio}"` : ''}
              </Text>
              <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                Los cambios se aplicarán a todas las tiendas del sistema.
              </Text>

              {previewItems.length === 0 ? (
                <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                  No se encontraron productos/servicios para modificar
                </Text>
              ) : (
                <View style={styles.previewList}>
                  {previewItems.slice(0, 50).map((item, index) => (
                    <View key={`${item.id_servicio}-${item.tiendaNombre}-${index}`} style={[styles.previewItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.previewItemName, { color: colors.onSurface }]}>{item.nombre}</Text>
                      <Text style={[styles.previewItemCategory, { color: colors.outline }]}>{item.categoria}</Text>
                      {item.currentPrecioCUP !== null && item.currentPrecioCUP !== undefined ? (
                        <>
                          <Text style={[styles.previewItemTienda, { color: colors.outline }]}>{item.tiendaNombre}</Text>
                          <View style={styles.previewItemDetails}>
                            <View style={styles.previewItemRow}>
                              <View style={styles.previewItemDetail}>
                                <Text style={[styles.previewItemLabel, { color: colors.outline }]}>Precio actual CUP:</Text>
                                <Text style={[styles.previewItemValue, { color: colors.onSurface }]}>{item.currentPrecioCUP.toFixed(2)}</Text>
                              </View>
                              <View style={styles.previewItemDetail}>
                                <Text style={[styles.previewItemLabel, { color: colors.outline }]}>Nuevo precio CUP:</Text>
                                <Text style={[styles.previewItemValue, { color: colors.primary }]}>{item.newPrecioCUP !== undefined ? item.newPrecioCUP.toFixed(5) : 'N/A'}</Text>
                              </View>
                            </View>
                            <View style={styles.previewItemRow}>
                              <View style={styles.previewItemDetail}>
                                <Text style={[styles.previewItemLabel, { color: colors.outline }]}>Precio actual USD:</Text>
                                <Text style={[styles.previewItemValue, { color: colors.onSurface }]}>{item.currentPrecioUSD.toFixed(2)}</Text>
                              </View>
                              <View style={styles.previewItemDetail}>
                                <Text style={[styles.previewItemLabel, { color: colors.outline }]}>Nuevo precio USD:</Text>
                                <Text style={[styles.previewItemValue, { color: colors.primary }]}>{item.newPrecioUSD !== undefined ? item.newPrecioUSD.toFixed(5) : 'N/A'}</Text>
                              </View>
                            </View>
                          </View>
                        </>
                      ) : (
                        <Text style={[styles.previewItemTienda, { color: colors.outline }]}>
                          {item.tiendaNombre}
                        </Text>
                      )}
                    </View>
                  ))}
                  {previewItems.length > 50 && (
                    <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                      ... y {previewItems.length - 50} más
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.currencyModalButtons}>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => setShowPreview(false)}
              >
                <Text style={[styles.currencyModalButtonText, { color: colors.onSurface }]}>Volver</Text>
              </TouchableOpacity>
              {previewItems.length > 0 && (
                <TouchableOpacity
                  style={[styles.currencyModalButton, styles.currencyModalConfirmButton, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    setShowPreview(false);
                    await handleCurrencyModalConfirm();
                  }}
                >
                  <Text style={[styles.currencyModalButtonText, { color: '#fff' }]}>Confirmar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSalesConfig}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSalesConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Image source={require('../../assets/sales.png')} style={[styles.permissionsIcon, { tintColor: colors.primary }]} resizeMode="contain" />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Configurar Cuentas por Tienda
              </Text>
              <TouchableOpacity onPress={() => setShowSalesConfig(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.currencyModalScrollView}>
              {!selectedTienda ? (
                <>
                  <Text style={[styles.currencyModalSubtitle, { color: colors.outline }]}>
                    Selecciona una tienda para configurar sus cuentas por defecto
                  </Text>
                  
                  {isLoadingTiendas ? (
                    <View style={styles.ratesLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.ratesLoadingText, { color: colors.outline }]}>
                        Cargando tiendas...
                      </Text>
                    </View>
                  ) : availableTiendas.length === 0 ? (
                    <Text style={[styles.infoText, { color: colors.outline }]}>
                      No hay tiendas disponibles
                    </Text>
                  ) : (
                    <View style={styles.currencyModalOptions}>
                      {availableTiendas.map((tienda) => {
                        const hasConfig = tiendaCuentasConfig[tienda.id_tienda];
                        const hasCuentas = tiendaHasCuentas(tienda.id_tienda);
                        const isSelected = hasConfig && hasCuentas;
                        
                        return (
                          <TouchableOpacity
                            key={tienda.id_tienda}
                            style={[styles.currencyModalOption, { 
                              backgroundColor: isSelected ? colors.primary : 'transparent',
                              borderColor: isSelected ? colors.primary : colors.outlineVariant 
                            }]}
                            onPress={() => handleSelectTienda(tienda)}
                          >
                            <Text style={[styles.currencyModalOptionText, { color: isSelected ? '#fff' : colors.onSurface }]}>
                              {tienda.nombre}
                            </Text>
                            {isSelected && (
                              <Ionicons name="checkmark" size={20} color="#fff" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.selectedTiendaHeader}>
                    <TouchableOpacity onPress={() => setSelectedTienda(null)}>
                      <Ionicons name="arrow-back" size={responsive.responsiveWidth(24)} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.selectedTiendaTitle, { color: colors.onSurface }]}>
                      {selectedTienda.nombre}
                    </Text>
                    <View style={{ width: responsive.responsiveWidth(24) }} />
                  </View>

                  <CuentaTipoConfig
                    tipo="efectivo_cup"
                    label="Efectivo CUP"
                    icon="cash"
                    color="#4CAF50"
                    config={tiendaCuentasConfig[selectedTienda.id_tienda]?.efectivo_cup || []}
                    onAdd={() => handleOpenCuentaSelector('efectivo_cup')}
                    onRemove={(index) => handleRemoveCuenta('efectivo_cup', index)}
                    colors={colors}
                    responsive={responsive}
                  />

                  <CuentaTipoConfig
                    tipo="efectivo_usd"
                    label="Efectivo USD"
                    icon="logo-usd"
                    color="#2196F3"
                    config={tiendaCuentasConfig[selectedTienda.id_tienda]?.efectivo_usd || []}
                    onAdd={() => handleOpenCuentaSelector('efectivo_usd')}
                    onRemove={(index) => handleRemoveCuenta('efectivo_usd', index)}
                    colors={colors}
                    responsive={responsive}
                  />

                  <CuentaTipoConfig
                    tipo="transferencia_cup"
                    label="Transferencia CUP"
                    icon="swap-horizontal"
                    color="#FF9800"
                    config={tiendaCuentasConfig[selectedTienda.id_tienda]?.transferencia_cup || []}
                    onAdd={() => handleOpenCuentaSelector('transferencia_cup')}
                    onRemove={(index) => handleRemoveCuenta('transferencia_cup', index)}
                    colors={colors}
                    responsive={responsive}
                  />

                  <CuentaTipoConfig
                    tipo="transferencia_usd"
                    label="Transferencia USD"
                    icon="card"
                    color="#9C27B0"
                    config={tiendaCuentasConfig[selectedTienda.id_tienda]?.transferencia_usd || []}
                    onAdd={() => handleOpenCuentaSelector('transferencia_usd')}
                    onRemove={(index) => handleRemoveCuenta('transferencia_usd', index)}
                    colors={colors}
                    responsive={responsive}
                  />
                </>
              )}
            </ScrollView>

            <View style={styles.currencyModalButtons}>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowSalesConfig(false);
                  setSelectedTienda(null);
                }}
              >
                <Text style={[styles.currencyModalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyModalButton, styles.currencyModalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveSalesConfig}
              >
                <Text style={[styles.currencyModalButtonText, { color: '#fff' }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCuentaSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCuentaSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Seleccionar Cuenta
              </Text>
              <TouchableOpacity onPress={() => setShowCuentaSelector(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.currencyModalScrollView}>
              {isLoadingCuentas ? (
                <View style={styles.ratesLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.ratesLoadingText, { color: colors.outline }]}>
                    Cargando cuentas...
                  </Text>
                </View>
              ) : !selectorTipoCuenta ? (
                <Text style={[styles.infoText, { color: colors.outline }]}>
                  Tipo de cuenta no especificado
                </Text>
              ) : availableCuentas.length === 0 ? (
                <Text style={[styles.infoText, { color: colors.outline }]}>
                  No hay cuentas disponibles
                </Text>
              ) : (
                <View style={styles.currencyModalOptions}>
                  {(() => {
                    // Mapeo de tipos internos a tipos del backend
                    const tipoMapping = {
                      'efectivo_cup': 'Efectivo CUP',
                      'efectivo_usd': 'Efectivo USD',
                      'transferencia_cup': 'Transferencia CUP',
                      'transferencia_usd': 'Transferencia USD',
                    };
                    
                    const tipoBuscado = tipoMapping[selectorTipoCuenta];
                    const cuentasFiltradas = availableCuentas.filter(cuenta => cuenta.tipo_cuenta === tipoBuscado);
                    
                    if (cuentasFiltradas.length === 0) {
                      return (
                        <Text style={[styles.infoText, { color: colors.outline }]}>
                          No hay cuentas de tipo "{tipoBuscado}" disponibles
                        </Text>
                      );
                    }
                    
                    return cuentasFiltradas.map((cuenta) => (
                      <TouchableOpacity
                        key={cuenta.id_cuenta}
                        style={[styles.currencyModalOption, { borderColor: colors.outlineVariant }]}
                        onPress={() => handleSelectCuenta(cuenta)}
                      >
                        <View style={styles.cuentaOptionInfo}>
                          <Text style={[styles.currencyModalOptionText, { color: colors.onSurface }]}>
                            {cuenta.nombre}
                          </Text>
                          <Text style={[styles.cuentaOptionFondo, { color: colors.primary }]}>
                            Fondo: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ));
                  })()}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showComprobanteConfig}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowComprobanteConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.currencyModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Configuración de Comprobante
              </Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowComprobanteConfig(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.currencyModalScrollView}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nombre del Negocio</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Ej: Mi Tienda"
                  value={comprobanteConfig.nombreNegocio}
                  onChangeText={(text) => setComprobanteConfig(prev => ({ ...prev, nombreNegocio: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Logo (opcional)</Text>
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: colors.outlineVariant }]}
                  onPress={handleSelectLogo}
                >
                  {comprobanteConfig.logo ? (
                    <View style={styles.logoPreview}>
                      <WebView
                        source={{
                          html: `
                            <html>
                              <head>
                                <style>
                                  body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: transparent; }
                                  img { max-width: 100%; max-height: 100%; object-fit: contain; filter: grayscale(100%); }
                                </style>
                              </head>
                              <body>
                                <img src="${comprobanteConfig.logo}" />
                              </body>
                            </html>
                          `
                        }}
                        style={{ width: '100%', height: '100%' }}
                        scrollEnabled={false}
                      />
                    </View>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image" size={responsive.responsiveWidth(32)} color={colors.outline} />
                      <Text style={[styles.uploadText, { color: colors.outline }]}>
                        Toca para seleccionar logo
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.previewSection}>
                <Text style={[styles.previewTitle, { color: colors.onSurface }]}>
                  Previsualización
                </Text>
                <View style={[styles.comprobantePreview, { backgroundColor: '#fff', borderColor: '#000' }]}>
                  {comprobanteConfig.logo && (
                    <View style={styles.comprobanteLogoContainer}>
                      <View style={styles.comprobanteLogo}>
                        <WebView
                          source={{
                            html: `
                              <html>
                                <head>
                                  <style>
                                    body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: transparent; }
                                    img { max-width: 100%; max-height: 100%; object-fit: contain; filter: grayscale(100%); }
                                  </style>
                                </head>
                                <body>
                                  <img src="${comprobanteConfig.logo}" />
                                </body>
                              </html>
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
                  <Text style={styles.comprobanteText}>DEPENDIENTE: Juan Pérez</Text>
                  <Text style={styles.comprobanteText}>
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                  <View style={styles.comprobanteTableHeader}>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Servicio/Producto</Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Cant</Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>Total</Text>
                  </View>
                  <View style={styles.comprobanteLine} />
                  <View style={styles.comprobanteTableRow}>
                    <Text style={styles.comprobanteTableColumn}>Producto 1</Text>
                    <Text style={styles.comprobanteTableColumn}>1</Text>
                    <Text style={styles.comprobanteTableColumn}>${formatComprobanteNumber(10)}</Text>
                  </View>
                  <View style={styles.comprobanteTableRow}>
                    <Text style={styles.comprobanteTableColumn}>Producto 2</Text>
                    <Text style={styles.comprobanteTableColumn}>2</Text>
                    <Text style={styles.comprobanteTableColumn}>${formatComprobanteNumber(30)}</Text>
                  </View>
                  <View style={styles.comprobanteTableRow}>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>TOTAL</Text>
                    <Text style={styles.comprobanteTableColumn}></Text>
                    <Text style={[styles.comprobanteTableColumn, styles.comprobanteTableColumnBold]}>${formatComprobanteNumber(40)}</Text>
                  </View>
                  <View style={styles.comprobanteLine} />
                  <Text style={styles.comprobanteText}>¡Gracias por su compra!</Text>
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[styles.configCuentasButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  try {
                    const updatedConfig = {
                      ...config,
                      comprobanteConfig: comprobanteConfig,
                    };
                    await configService.updateConfig(updatedConfig);
                    setConfig(updatedConfig);
                    showToast({ type: 'success', message: 'Configuración de comprobante guardada correctamente' });
                    setShowComprobanteConfig(false);
                  } catch (error) {
                    showToast({ type: 'error', message: 'Error al guardar configuración de comprobante' });
                  }
                }}
              >
                <Ionicons name="save" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={styles.configCuentasButtonText}>Guardar Configuración</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export const CurrencyExchangeScreen = () => <CurrencyExchangeContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: {
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
    marginTop: responsive.responsiveMargin(55),
    marginBottom: responsive.responsiveMargin(16),
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(24),
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  helperText: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
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
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  infoSection: {
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  infoTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  infoText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
  },
  permissionsCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    marginBottom: responsive.responsiveMargin(16),
  },
  permissionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  permissionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  permissionsIcon: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  permissionsTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  permissionsSubtitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
  },
  subSection: {
    marginTop: responsive.responsiveMargin(24),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  subSectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(8),
  },
  accessLevelExplanation: {
    marginBottom: responsive.responsiveMargin(20),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  accessLevelExplanationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  accessLevelExplanationText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
    flex: 1,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  permissionSection: {
    marginTop: responsive.responsiveMargin(16),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  permissionSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  permissionSectionTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  permissionSectionSubtitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(16),
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    flex: 1,
    marginRight: responsive.responsiveMargin(16),
  },
  permissionLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  infoButton: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '100%',
    maxWidth: responsive.responsiveWidth(400),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(16),
  },
  modalTitle: {
    fontSize: responsive.fontSizes.h6,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  modalDescription: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.5,
    marginBottom: responsive.responsiveMargin(24),
  },
  modalButton: {
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  exchangeRatesSection: {
    marginBottom: responsive.responsiveMargin(24),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  exchangeRatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(16),
  },
  exchangeRatesTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginLeft: responsive.responsiveMargin(8),
    flex: 1,
  },
  refreshButton: {
    padding: responsive.responsivePadding(8),
  },
  ratesLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  ratesLoadingText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  ratesContainer: {
    gap: responsive.responsiveMargin(12),
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
  },
  currencyFlag: {
    fontSize: responsive.responsiveFontSize(24),
  },
  currencyName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  currencyLabel: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
  },
  rateValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  ratesSource: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: responsive.responsiveMargin(8),
    fontStyle: 'italic',
  },
  ratesErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  ratesErrorText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  currencyModalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '100%',
    maxWidth: responsive.responsiveWidth(500),
    maxHeight: '90%',
  },
  currencyModalScrollView: {
    maxHeight: responsive.responsiveHeight(400),
    marginBottom: responsive.responsiveMargin(16),
  },
  currencyModalSubtitle: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  currencyModalSection: {
    marginBottom: responsive.responsiveMargin(20),
  },
  currencyModalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(12),
  },
  currencyModalSectionTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  currencyModalOptions: {
    gap: responsive.responsiveMargin(8),
  },
  currencyModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: responsive.responsiveMargin(12),
    backgroundColor: 'transparent',
  },
  currencyModalOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  currencyModalOptionSubtext: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  currencyModalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  currencyModalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyModalCancelButton: {
    borderWidth: 1,
  },
  currencyModalConfirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyModalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cuentaTipoSection: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
  },
  cuentaTipoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(12),
  },
  cuentaTipoIcon: {
    width: responsive.responsiveWidth(36),
    height: responsive.responsiveHeight(36),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaTipoLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
  },
  cuentaTipoCount: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  cuentaTipoList: {
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(12),
  },
  cuentaTipoEmpty: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: responsive.responsivePadding(8),
  },
  cuentaTipoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsive.responsivePadding(12),
    borderRadius: 6,
    borderWidth: 1,
  },
  cuentaTipoItemName: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    flex: 1,
  },
  cuentaTipoRemoveButton: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaTipoAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(10),
    borderRadius: 6,
    borderWidth: 1.5,
  },
  cuentaTipoAddText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  selectedTiendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(16),
    paddingBottom: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  selectedTiendaTitle: {
    fontSize: responsive.fontSizes.h6,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
    textAlign: 'center',
  },
  cuentaOptionInfo: {
    flex: 1,
  },
  cuentaOptionFondo: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  uploadButton: {
    borderWidth: 2,
    borderRadius: 8,
    padding: responsive.responsivePadding(20),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: responsive.responsiveHeight(120),
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  uploadText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  logoPreview: {
    width: responsive.responsiveWidth(100),
    height: responsive.responsiveHeight(100),
    resizeMode: 'contain',
  },
  previewSection: {
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(24),
  },
  previewTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  comprobantePreview: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 4,
    padding: responsive.responsivePadding(16),
    alignItems: 'center',
  },
  comprobanteLogo: {
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    resizeMode: 'contain',
    marginBottom: responsive.responsiveMargin(8),
  },
  comprobanteLogoContainer: {
    marginBottom: responsive.responsiveMargin(8),
  },
  comprobanteNegocioName: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
    textAlign: 'center',
  },
  comprobanteTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  comprobanteTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(4),
  },
  comprobanteTableColumn: {
    flex: 1,
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    textAlign: 'left',
  },
  comprobanteTableColumnBold: {
    fontWeight: '700',
  },
  comprobanteLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#000',
    marginVertical: responsive.responsiveMargin(8),
  },
  comprobanteText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    color: '#000',
    marginBottom: responsive.responsiveMargin(4),
  },
  comprobanteTotal: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    color: '#000',
    marginTop: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  modalFooter: {
    padding: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalCloseButton: {
    position: 'absolute',
    right: responsive.responsivePadding(16),
    top: responsive.responsivePadding(16),
  },
  configCuentasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  configCuentasButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  currencyModalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencyModalInput: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(14),
    borderRadius: 8,
    borderWidth: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownIcon: {
    position: 'absolute',
    right: responsive.responsivePadding(12),
    padding: responsive.responsivePadding(4),
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: responsive.responsiveMargin(4),
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: responsive.responsiveHeight(200),
    zIndex: 10,
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  previewList: {
    gap: responsive.responsiveMargin(8),
  },
  previewItem: {
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
  },
  previewItemName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  previewItemCategory: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
    fontStyle: 'italic',
  },
  previewItemDetails: {
    flexDirection: 'column',
    gap: responsive.responsiveMargin(8),
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsive.responsiveMargin(16),
  },
  previewItemDetail: {
    flex: 1,
  },
  previewItemLabel: {
    fontSize: responsive.fontSizes.caption,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  previewItemValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
