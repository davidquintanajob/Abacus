'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { Toast } from '../../../components/common/Toast';
import { Search, Plus, Minus, X, ChevronDown, ChevronUp, Trash2, ArrowLeft, Camera, CameraOff, CheckCircle, Barcode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getTiendas } from '../../../services/tiendaService';
import { getServicios } from '../../../services/servicioService';
import { getCuentas } from '../../../services/cuentaService';
import { createVenta } from '../../../services/ventaService';
import { configService } from '../../../services/configService';
import jsPDF from 'jspdf';

const VentasCreatePage = () => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user, ventaAccessLevels, priceChangePermissions, deudaManagePermissions, clienteManagePermissions } = useAuth();
  const { showToast } = useToast();
  const { isDesktop, isMobile, isTablet } = useResponsive();

  // State
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTienda, setSelectedTienda] = useState<any>(null);
  const [availableTiendas, setAvailableTiendas] = useState<any[]>([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
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
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteSaleItems, setComprobanteSaleItems] = useState<any[]>([]);
  const [comprobanteConfig, setComprobanteConfig] = useState({
    logo: null,
    nombreNegocio: '',
  });
  const [config, setConfig] = useState<any>({});
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemPrices, setEditingItemPrices] = useState({ cup: '', usd: '' });
  
  // Scanner state
  const [showCamera, setShowCamera] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scannerEnabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScannedTimestamp, setLastScannedTimestamp] = useState<number | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Deuda mode
  const [isDeudaMode, setIsDeudaMode] = useState(false);
  const [deudaMonedaCUP, setDeudaMonedaCUP] = useState(true);
  const [deudaCliente, setDeudaCliente] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearchText, setClienteSearchText] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [deudaPagoInicial, setDeudaPagoInicial] = useState({
    activo: false,
    cantidad_pagada: '',
    forma_pago: '',
    id_cuenta_operacion: null,
    cuentaNombre: '',
  });
  
  // Confirm sale modal
  const [showConfirmSaleModal, setShowConfirmSaleModal] = useState(false);
  const [confirmSaleCountdown, setConfirmSaleCountdown] = useState(3);
  const [pendingSaleData, setPendingSaleData] = useState<any>(null);
  
  // Cuenta selector
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState<string | null>(null);
  const [availableCuentas, setAvailableCuentas] = useState<any[]>([]);
  
  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save scanner preference to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('scannerEnabled', showCamera.toString());
    } catch (error) {
      console.error('Error saving scanner preference:', error);
    }
  }, [showCamera]);

  // Initialize camera and barcode scanner when showCamera changes
  useEffect(() => {
    if (showCamera) {
      const startCamera = async () => {
        // Wait for DOM to be ready with multiple checks
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const readerElement = document.getElementById("reader");
          if (readerElement) {
            break;
          }
          retries++;
        }

        const readerElement = document.getElementById("reader");
        if (!readerElement) {
          console.error('Reader element not found after retries');
          setShowCamera(false);
          return;
        }

        try {
          const html5QrCode = new Html5Qrcode("reader");
          html5QrCodeRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.5
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              const now = Date.now();
              // Debounce: prevent same code from being scanned within 2 seconds
              if (lastScannedCode === decodedText && lastScannedTimestamp && now - lastScannedTimestamp < 2000) {
                return;
              }

              setLastScannedCode(decodedText);
              setLastScannedTimestamp(now);
              handleBarcodeScanned(decodedText);
            },
            (errorMessage) => {
              // Ignore scanning errors
            }
          );

          setIsScanning(true);
        } catch (error) {
          console.error('Error accessing camera:', error);
          showToast({ type: 'error', message: 'No se pudo acceder a la cámara. Verifica los permisos.' });
          setShowCamera(false);
        }
      };

      startCamera();
    } else {
      // Stop camera and scanner
      const stopScanner = async () => {
        if (html5QrCodeRef.current) {
          try {
            // Check if scanner is running before stopping
            const isRunning = html5QrCodeRef.current.isScanning;
            if (isRunning) {
              await html5QrCodeRef.current.stop();
            }
            await html5QrCodeRef.current.clear();
            html5QrCodeRef.current = null;
          } catch (error) {
            console.error('Error stopping scanner:', error);
          }
        }
        setIsScanning(false);
      };
      stopScanner();
    }

    return () => {
      const cleanup = async () => {
        if (html5QrCodeRef.current) {
          try {
            // Check if scanner is running before stopping
            const isRunning = html5QrCodeRef.current.isScanning;
            if (isRunning) {
              await html5QrCodeRef.current.stop();
            }
            await html5QrCodeRef.current.clear();
          } catch (error) {
            console.error('Error cleaning up scanner:', error);
          }
        }
      };
      cleanup();
    };
  }, [showCamera]);

  // Permissions
  const canViewAllStores = 
    user?.rol?.toLowerCase() === 'administrador' ||
    (user?.rol?.toLowerCase() === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
    (user?.rol?.toLowerCase() === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
    (user?.rol?.toLowerCase() === 'económico' && ventaAccessLevels?.economico === 'all_stores');

  const canChangePrice = () => {
    const userRole = user?.rol?.toLowerCase();
    if (userRole === 'administrador') return true;
    if (userRole === 'dependiente' && priceChangePermissions?.dependiente) return true;
    if (userRole === 'almacenero' && priceChangePermissions?.almacenero) return true;
    if (userRole === 'económico' && priceChangePermissions?.economico) return true;
    return false;
  };

  const hasDeudaPermissions = () => {
    const userRole = user?.rol?.toLowerCase();
    return userRole === 'administrador' ||
           (userRole === 'dependiente' && deudaManagePermissions?.dependiente) ||
           (userRole === 'almacenero' && deudaManagePermissions?.almacenero) ||
           (userRole === 'económico' && deudaManagePermissions?.economico);
  };

  const hasClientePermissions = () => {
    const userRole = user?.rol?.toLowerCase();
    return userRole === 'administrador' ||
           (userRole === 'dependiente' && clienteManagePermissions?.dependiente) ||
           (userRole === 'almacenero' && clienteManagePermissions?.almacenero) ||
           (userRole === 'económico' && clienteManagePermissions?.economico);
  };

  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadConfig();
    loadCuentas();
    loadClientes();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await configService.getConfig();
      setConfig(data);
      if (data.comprobanteConfig) {
        setComprobanteConfig({
          logo: data.comprobanteConfig.logo ?? null,
          nombreNegocio: data.comprobanteConfig.nombreNegocio ?? '',
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      if (canViewAllStores) {
        const tiendasData = await getTiendas({}, 1, 1000);
        setAvailableTiendas(tiendasData.data || []);

        if (user?.id_tienda) {
          const userTienda = tiendasData.data?.find((t: any) => t.id_tienda === user.id_tienda);
          if (userTienda) {
            setSelectedTienda(userTienda);
            await loadCuentaConfig(userTienda.id_tienda);
          }
        }
      } else if (user?.id_tienda) {
        const tiendasData = await getTiendas({}, 1, 1000);
        const userTienda = tiendasData.data?.find((t: any) => t.id_tienda === user.id_tienda);
        if (userTienda) {
          setAvailableTiendas([userTienda]);
          setSelectedTienda(userTienda);
          await loadCuentaConfig(userTienda.id_tienda);
        }
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar datos iniciales' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCuentaConfig = async (tiendaId: number) => {
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
      console.error('Error loading cuenta config:', error);
    }
  };

  const loadCuentas = async () => {
    try {
      const cuentasData = await getCuentas({}, 1, 1000);
      setAvailableCuentas(cuentasData.data || []);
    } catch (error) {
      console.error('Error loading cuentas:', error);
    }
  };

  const loadClientes = async () => {
    try {
      // Import dynamically to avoid circular dependency
      const { getClientes } = await import('../../../services/clienteService');
      const clientesData = await getClientes({}, 1, 1000);
      setClientes(clientesData.data || []);
    } catch (error) {
      console.error('Error loading clientes:', error);
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

      const newSelectedCuentas: any = {};

      ['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd'].forEach(tipo => {
        if (cuentaConfig[tipo as keyof typeof cuentaConfig]?.length > 0) {
          const cuenta = cuentaConfig[tipo as keyof typeof cuentaConfig][0];
          if (cuenta.tipo_cuenta === tipoCuentaEsperado[tipo as keyof typeof tipoCuentaEsperado]) {
            newSelectedCuentas[tipo] = cuenta;
          }
        }
      });

      setSelectedCuentas(newSelectedCuentas);
    }
  }, [cuentaConfig]);

  // Search products
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
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

    return () => clearTimeout(searchTimeout);
  }, [searchText, selectedTienda]);

  // Confirm sale countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showConfirmSaleModal && confirmSaleCountdown > 0) {
      interval = setInterval(() => {
        setConfirmSaleCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showConfirmSaleModal, confirmSaleCountdown]);

  const formatNumberWithSpaces = (num: number) => {
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setIsScanning(true);
      
      // Search for product by barcode
      const filters: any = { codigo_barras: barcode, fetchProducto: true };
      if (selectedTienda) {
        filters.id_tienda = selectedTienda.id_tienda;
      }
      
      const data = await getServicios(filters, 1, 10);
      const products = data.data || [];
      
      if (products.length > 0) {
        const product = products[0];
        handleAddProduct(product);
      } else {
        showToast({ type: 'warning', message: 'Producto no encontrado con este código de barras' });
      }
    } catch (error) {
      console.error('Error scanning barcode:', error);
      showToast({ type: 'error', message: 'Error al escanear código de barras' });
    } finally {
      setIsScanning(false);
    }
  };

  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error('Error playing beep:', err));
    }
  };

  const handleAddProduct = (product: any) => {
    const itemExists = saleItems.some(
      (item) => item.codigo_barras_ean?.trim().toLowerCase() === product.codigos?.[0]?.codigo_barras_ean?.trim().toLowerCase()
    );

    if (itemExists) {
      showToast({ type: 'warning', message: 'Este producto ya está en la lista' });
      return;
    }

    const servicioTienda = product.tiendas_servicio?.find((t: any) => t.id_tienda === selectedTienda?.id_tienda);
    if (!servicioTienda) {
      showToast({ type: 'error', message: 'Producto no disponible en esta tienda' });
      return;
    }

    const newItem = {
      id_servicio_tienda: servicioTienda.id_servicio_tienda,
      id_servicio: product.id_servicio,
      codigo_barras_ean: product.codigos?.[0]?.codigo_barras_ean || '',
      nombre: product.nombre || 'Sin nombre',
      imagen: product.producto?.imagen || null,
      cantidad: 1,
      precio_cup: parseFloat(servicioTienda.precio_cup || 0),
      precio_usd: parseFloat(servicioTienda.precio_usd || 0),
      precio_original_cup: parseFloat(servicioTienda.precio_cup || 0),
      precio_original_usd: parseFloat(servicioTienda.precio_usd || 0),
    };

    setSaleItems([...saleItems, newItem]);
    setSearchText('');
    setShowSearchDropdown(false);
    playBeep();
    showToast({ type: 'success', message: 'Producto agregado correctamente' });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = saleItems.filter((_, i) => i !== index);
    setSaleItems(newItems);
  };

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const newItems = [...saleItems];
    newItems[index].cantidad = newQuantity;
    setSaleItems(newItems);
  };

  const handleOpenPriceEditModal = (index: number) => {
    if (!canChangePrice()) {
      showToast({ type: 'error', message: 'No tienes permiso para cambiar el precio de los productos' });
      return;
    }

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
      const newCup = parseFloat(editingItemPrices.cup) || 0;
      const newUsd = parseFloat(editingItemPrices.usd) || 0;

      const newItems = [...saleItems];
      newItems[editingItemIndex].precio_cup = newCup;
      newItems[editingItemIndex].precio_usd = newUsd;
      setSaleItems(newItems);

      setShowPriceEditModal(false);
      setEditingItemIndex(null);
      setEditingItemPrices({ cup: '', usd: '' });
      showToast({ type: 'success', message: 'Precio actualizado correctamente' });
    }
  };

  const handleCancelPriceEdit = () => {
    setShowPriceEditModal(false);
    setEditingItemIndex(null);
    setEditingItemPrices({ cup: '', usd: '' });
  };

  const calculateTotal = () => {
    return saleItems.reduce((sum, item) => sum + (item.precio_cup * item.cantidad), 0);
  };

  const getRemainingAmount = () => {
    const cambio = parseFloat(config.cupToUsdRate || 1);
    const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
    const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
    const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
    const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;

    const totalPaid = efectivoCup + transferenciaCup + (efectivoUsd + transferenciaUsd) * cambio;
    const total = calculateTotal();

    return total - totalPaid;
  };

  const handleSelectCuenta = (cuenta: any) => {
    if (selectorTipoCuenta) {
      setSelectedCuentas(prev => ({ ...prev, [selectorTipoCuenta]: cuenta }));
    }
    setShowCuentaSelector(false);
    setSelectorTipoCuenta(null);
  };

  const getFilteredCuentas = () => {
    if (!selectorTipoCuenta || !selectedTienda) return [];
    
    const tipoCuentaEsperado = {
      efectivo_cup: 'Efectivo CUP',
      efectivo_usd: 'Efectivo USD',
      transferencia_cup: 'Transferencia CUP',
      transferencia_usd: 'Transferencia USD',
    };
    
    const tipoEsperado = tipoCuentaEsperado[selectorTipoCuenta as keyof typeof tipoCuentaEsperado];
    
    // Filter by tipo and by tienda config
    const cuentasConfiguradas = cuentaConfig[selectorTipoCuenta as keyof typeof cuentaConfig] || [];
    const cuentasConfiguradasIds = cuentasConfiguradas.map((c: any) => c.id_cuenta);
    
    return availableCuentas.filter((cuenta: any) => {
      return cuenta.tipo_cuenta === tipoEsperado && cuentasConfiguradasIds.includes(cuenta.id_cuenta);
    });
  };

  const handleSubmitSale = () => {
    if (saleItems.length === 0) {
      showToast({ type: 'warning', message: 'Agrega productos a la venta' });
      return;
    }

    if (!selectedTienda) {
      showToast({ type: 'warning', message: 'Selecciona una tienda' });
      return;
    }

    if (isDeudaMode && !deudaCliente) {
      showToast({ type: 'warning', message: 'Selecciona un cliente para la deuda' });
      return;
    }

    const total = calculateTotal();
    const remaining = getRemainingAmount();

    if (!isDeudaMode && Math.abs(remaining) > 0.01) {
      showToast({ type: 'warning', message: 'El monto pagado no coincide con el total' });
      return;
    }

    // Show confirm modal
    setPendingSaleData({
      total,
      remaining,
      isDeuda: isDeudaMode,
    });
    setShowConfirmSaleModal(true);
    setConfirmSaleCountdown(3);
  };

  const handleConfirmSale = async () => {
    if (!pendingSaleData) return;

    setIsSubmitting(true);
    setShowConfirmSaleModal(false);
    setPendingSaleData(null);

    try {
      const roundTo5Decimals = (value: number) => Math.round(value * 100000) / 100000;
      const cambio = parseFloat(config.cupToUsdRate || 1);
      const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
      const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
      const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
      const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;

      const efectivoCupRounded = roundTo5Decimals(efectivoCup);
      const efectivoUsdRounded = roundTo5Decimals(efectivoUsd);
      const transferenciaCupRounded = roundTo5Decimals(transferenciaCup);
      const transferenciaUsdRounded = roundTo5Decimals(transferenciaUsd);

      const ventas = saleItems.map(item => ({
        id_servicio_tienda: item.id_servicio_tienda,
        cantidad: item.cantidad,
        precio_cobrado_cup: item.precio_cup,
        precio_cobrado_usd: item.precio_usd,
      }));

      if (isDeudaMode) {
        // Create venta as deuda
        const ventaData = {
          fecha_hora: new Date().toISOString(),
          nota: ventaNota,
          cantidad_cobrada_efectivo_cup: 0,
          cantidad_cobrada_efectivo_usd: 0,
          cantidad_cobrada_transferencia_cup: 0,
          cantidad_cobrada_transferencia_usd: 0,
          id_usuario: user?.id_usuario,
          cambio_moneda: cambio,
          ventas: ventas,
          is_deuda: true,
        };

        const ventaResult = await createVenta(ventaData);
        const id_lista_venta = ventaResult?.data?.id_lista_venta || ventaResult?.id_lista_venta;

        // Create deuda
        const { createDeuda } = await import('../../../services/deudaService');
        const totalCUP = saleItems.reduce((sum, item) => sum + (item.precio_cup * item.cantidad), 0);
        const totalUSD = saleItems.reduce((sum, item) => sum + (item.precio_usd * item.cantidad), 0);

        let pago_deuda = undefined;
        if (deudaPagoInicial.activo && deudaPagoInicial.cantidad_pagada && parseFloat(deudaPagoInicial.cantidad_pagada) > 0) {
          pago_deuda = {
            cantidad_pagada: parseFloat(deudaPagoInicial.cantidad_pagada),
            forma_pago: deudaPagoInicial.forma_pago,
            id_cuenta_operacion: deudaPagoInicial.id_cuenta_operacion,
            id_usuario: user?.id_usuario,
          };
        }

        await createDeuda({
          fecha_hora: new Date().toISOString(),
          monto_cup: deudaMonedaCUP ? totalCUP : 0,
          monto_usd: deudaMonedaCUP ? 0 : totalUSD,
          cambio_moneda: cambio,
          id_cliente: deudaCliente.id_cliente,
          id_lista_venta: id_lista_venta || null,
          ...(pago_deuda ? { pago_deuda } : {}),
        });

        showToast({ type: 'success', message: 'Venta registrada como deuda correctamente' });
      } else {
        // Normal sale
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
          id_usuario: user?.id_usuario,
          cambio_moneda: cambio,
          ventas: ventas,
        };

        await createVenta(ventaData);
        showToast({ type: 'success', message: 'Venta realizada correctamente' });
      }

      setComprobanteSaleItems([...saleItems]);
      setShowComprobanteModal(true);

      // Reset form
      setSaleItems([]);
      setPaymentAmounts({
        efectivo_cup: '',
        efectivo_usd: '',
        transferencia_cup: '',
        transferencia_usd: '',
      });
      setVentaNota('');
      if (isDeudaMode) {
        setIsDeudaMode(false);
        setDeudaCliente(null);
        setDeudaMonedaCUP(true);
        setDeudaPagoInicial({ activo: false, cantidad_pagada: '', forma_pago: '', id_cuenta_operacion: null, cuentaNombre: '' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al realizar venta' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSale = () => {
    setShowConfirmSaleModal(false);
    setPendingSaleData(null);
    setConfirmSaleCountdown(3);
  };

  const handleGeneratePDF = () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 20;

      if (comprobanteConfig.logo) {
        const imgWidth = 40;
        const imgHeight = 40;
        const x = (pageWidth - imgWidth) / 2;
        const img = new Image();
        img.src = comprobanteConfig.logo;
        const canvas = document.createElement('canvas');
        canvas.width = imgWidth * 3;
        canvas.height = imgHeight * 3;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.filter = 'grayscale(100%)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const grayscaleDataUrl = canvas.toDataURL('image/png');
          pdf.addImage(grayscaleDataUrl, 'PNG', x, y, imgWidth, imgHeight);
        }
        y += imgHeight + 10;
      }

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(comprobanteConfig.nombreNegocio || 'Nombre del Negocio', pageWidth / 2, y, { align: 'center' });
      y += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`DEPENDIENTE: ${user?.nombre_natural || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
      y += 7;

      const now = new Date();
      pdf.text(`${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, pageWidth / 2, y, { align: 'center' });
      y += 15;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Servicio/Producto', 20, y);
      pdf.text('Cant', pageWidth / 2, y, { align: 'center' });
      pdf.text('Total', pageWidth - 20, y, { align: 'right' });
      y += 5;
      pdf.line(20, y, pageWidth - 20, y);
      y += 10;

      pdf.setFont('helvetica', 'normal');
      comprobanteSaleItems.forEach((item) => {
        pdf.text(item.nombre, 20, y);
        pdf.text(item.cantidad.toString(), pageWidth / 2, y, { align: 'center' });
        pdf.text(`$${formatNumberWithSpaces(item.cantidad * item.precio_cup)}`, pageWidth - 20, y, { align: 'right' });
        y += 7;
      });

      y += 5;
      pdf.line(20, y, pageWidth - 20, y);
      y += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL', 20, y);
      const total = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0);
      pdf.text(`$${formatNumberWithSpaces(total)}`, pageWidth - 20, y, { align: 'right' });
      y += 10;
      pdf.line(20, y, pageWidth - 20, y);
      y += 15;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('¡Gracias por su compra!', pageWidth / 2, y, { align: 'center' });

      pdf.save('comprobante.pdf');
      setShowComprobanteModal(false);
      router.push('/ventas');
      showToast({ type: 'success', message: 'PDF generado exitosamente' });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showToast({ type: 'error', message: 'Error al generar PDF: ' + error.message });
    }
  };

  const totalCUP = saleItems.reduce((sum, item) => sum + (item.precio_cup * item.cantidad), 0);
  const totalUSD = saleItems.reduce((sum, item) => sum + (item.precio_usd * item.cantidad), 0);
  const totalProducts = saleItems.length;

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.primary }}></div>
        <p style={{ color: colors.outline }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Header 
        showBackButton={true}
        onBackPress={() => router.push('/ventas')}
        title="Nueva Venta"
        showScannerButton={true}
        onScannerPress={() => setShowCamera(!showCamera)}
        scannerActive={showCamera}
        hideUserIcon={true}
      />
      <Toast />
      <audio ref={audioRef} src="/beep.mp3" preload="auto" />

      <div style={{ 
        paddingTop: isMobile ? '80px' : isTablet ? '100px' : '120px',
        paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingBottom: '40px',
        maxWidth: isDesktop ? '900px' : '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {/* Scanner Section */}
        {showCamera && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <div
              id="reader"
              style={{
                width: isDesktop ? '450px' : isTablet ? '250px' : '300px',
                height: isDesktop ? '300px' : isTablet ? '250px' : '300px',
                margin: '0 auto',
                display: 'block',
                position: 'relative',
                overflow: 'hidden'
              }}
            ></div>
            <p style={{ color: colors.onSurface, fontSize: '14px', textAlign: 'center', marginTop: '12px' }}>
              Apunta al código de barras
            </p>
          </div>
        )}

        {/* Tienda Selector */}
        <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
          <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Tienda</label>
          <div className="relative">
            <button
              onClick={() => canViewAllStores && setShowTiendaDropdown(!showTiendaDropdown)}
              className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
              disabled={!canViewAllStores}
              style={{
                backgroundColor: colors.background,
                color: selectedTienda ? colors.onSurface : colors.outline,
                border: `1px solid ${colors.outlineVariant}`,
                opacity: canViewAllStores ? 1 : 0.5
              }}
            >
              <span>{selectedTienda ? selectedTienda.nombre : 'Seleccionar tienda...'}</span>
              {canViewAllStores && (showTiendaDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />)}
            </button>

            {showTiendaDropdown && canViewAllStores && (
              <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                {availableTiendas.map((tienda) => (
                  <button
                    key={tienda.id_tienda}
                    onClick={() => {
                      setSelectedTienda(tienda);
                      setShowTiendaDropdown(false);
                      loadCuentaConfig(tienda.id_tienda);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                    style={{ color: colors.onSurface }}
                  >
                    {tienda.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Search */}
        <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
          <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Buscar Producto</label>
          
          <div className="relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Escribe para buscar productos..."
              className="w-full px-4 py-2 rounded-lg pl-10"
              disabled={!selectedTienda}
              style={{
                backgroundColor: colors.background,
                color: colors.onSurface,
                border: `1px solid ${colors.outlineVariant}`,
                opacity: selectedTienda ? 1 : 0.5
              }}
            />
            <Search size={18} color={colors.outline} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />

            {showSearchDropdown && (
              <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                {searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <button
                      key={product.id_servicio}
                      onClick={() => handleAddProduct(product)}
                      className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                      style={{ color: colors.onSurface }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{product.nombre}</div>
                      <div style={{ fontSize: '12px', color: colors.outline }}>
                        CUP: {formatNumberWithSpaces(product.tiendas_servicio?.[0]?.precio_cup || 0)} | 
                        USD: {formatNumberWithSpaces(product.tiendas_servicio?.[0]?.precio_usd || 0)}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3" style={{ color: colors.outline }}>No se encontraron productos</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sale Items */}
        {saleItems.length > 0 && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>
              Productos ({totalProducts})
            </h2>
            <div className="space-y-3">
              {saleItems.map((item, index) => (
                <div key={index} className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}` }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p style={{ fontWeight: 'bold', color: colors.onSurface }}>{item.nombre}</p>
                      <p style={{ fontSize: '12px', color: colors.outline }}>
                        CUP: {formatNumberWithSpaces(item.precio_cup)} | USD: {formatNumberWithSpaces(item.precio_usd)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="p-1 rounded hover:bg-black/5"
                      style={{ color: colors.error }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(index, item.cantidad - 1)}
                      className="p-2 rounded"
                      style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 1)}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!val || val < 1) handleUpdateQuantity(index, 1);
                      }}
                      className="w-16 text-center rounded"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        border: `1px solid ${colors.outlineVariant}`,
                        fontWeight: 'bold'
                      }}
                    />
                    <button
                      onClick={() => handleUpdateQuantity(index, item.cantidad + 1)}
                      className="p-2 rounded"
                      style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenPriceEditModal(index)}
                      className="ml-auto px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: colors.primary, color: '#fff' }}
                    >
                      Editar Precio
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.outlineVariant }}>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '16px', color: colors.outline }}>Total:</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: colors.onSurface }}>
                  {formatNumberWithSpaces(totalCUP)} CUP / {formatNumberWithSpaces(totalUSD)} USD
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Section */}
        {saleItems.length > 0 && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            {/* Header: Pago + Generar Deuda toggle */}
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface }}>Pago</h2>
              {hasDeudaPermissions() && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '14px', color: isDeudaMode ? colors.primary : colors.outline }}>
                    Generar Deuda
                  </span>
                  <button
                    onClick={() => setIsDeudaMode(!isDeudaMode)}
                    className="w-12 h-6 rounded-full relative transition-colors"
                    style={{ backgroundColor: isDeudaMode ? colors.primary : colors.outlineVariant }}
                  >
                    <div
                      className="w-5 h-5 rounded-full absolute top-0.5 transition-transform"
                      style={{
                        backgroundColor: isDeudaMode ? '#fff' : colors.outline,
                        transform: isDeudaMode ? 'translateX(24px)' : 'translateX(2px)'
                      }}
                    />
                  </button>
                </div>
              )}
            </div>

            {isDeudaMode ? (
              /* DEUDA MODE FORM */
              <>
                {/* Moneda de la deuda */}
                <div className="mb-4">
                  <label style={{ display: 'block', fontSize: '14px', color: colors.onSurface, marginBottom: '8px' }}>
                    Moneda de la deuda
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDeudaMonedaCUP(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.outlineVariant}`,
                        color: deudaMonedaCUP ? colors.primary : colors.outline
                      }}
                    >
                      <span style={{ fontWeight: deudaMonedaCUP ? 'bold' : 'normal' }}>CUP</span>
                      <div
                        className="w-10 h-5 rounded-full relative"
                        style={{ backgroundColor: deudaMonedaCUP ? colors.primary : colors.outlineVariant }}
                      >
                        <div
                          className="w-4 h-4 rounded-full absolute top-0.5"
                          style={{
                            backgroundColor: deudaMonedaCUP ? '#fff' : colors.outline,
                            transform: deudaMonedaCUP ? 'translateX(20px)' : 'translateX(2px)'
                          }}
                        />
                      </div>
                    </button>
                    <button
                      onClick={() => setDeudaMonedaCUP(false)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: colors.background,
                        border: `1px solid ${colors.outlineVariant}`,
                        color: !deudaMonedaCUP ? colors.primary : colors.outline
                      }}
                    >
                      <span style={{ fontWeight: !deudaMonedaCUP ? 'bold' : 'normal' }}>USD</span>
                      <div
                        className="w-10 h-5 rounded-full relative"
                        style={{ backgroundColor: !deudaMonedaCUP ? colors.primary : colors.outlineVariant }}
                      >
                        <div
                          className="w-4 h-4 rounded-full absolute top-0.5"
                          style={{
                            backgroundColor: !deudaMonedaCUP ? '#fff' : colors.outline,
                            transform: !deudaMonedaCUP ? 'translateX(20px)' : 'translateX(2px)'
                          }}
                        />
                      </div>
                    </button>
                  </div>
                </div>

                {/* Total de la deuda */}
                <div className="p-3 rounded-lg mb-2" style={{ backgroundColor: colors.primary }}>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#fff', fontSize: '14px' }}>Total venta:</span>
                    <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                      ${formatNumberWithSpaces(deudaMonedaCUP ? totalCUP : totalUSD)} {deudaMonedaCUP ? 'CUP' : 'USD'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: colors.error }}>
                  <div className="flex justify-between items-center">
                    <span style={{ color: colors.error, fontSize: '14px' }}>Queda debiendo:</span>
                    <span style={{ color: colors.error, fontSize: '18px', fontWeight: 'bold' }}>
                      ${formatNumberWithSpaces(deudaMonedaCUP ? totalCUP : totalUSD)} {deudaMonedaCUP ? 'CUP' : 'USD'}
                    </span>
                  </div>
                </div>

                {/* Cliente selector */}
                <div className="mb-4">
                  <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>
                    Cliente *
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                      className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                      style={{
                        backgroundColor: colors.background,
                        color: deudaCliente ? colors.onSurface : colors.outline,
                        border: `1px solid ${colors.outlineVariant}`
                      }}
                    >
                      <span>{deudaCliente ? deudaCliente.nombre : 'Seleccionar cliente...'}</span>
                      {showClienteDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                    </button>

                    {showClienteDropdown && (
                      <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                        <input
                          type="text"
                          value={clienteSearchText}
                          onChange={(e) => setClienteSearchText(e.target.value)}
                          placeholder="Buscar cliente..."
                          className="w-full px-4 py-2 sticky top-0"
                          style={{ backgroundColor: colors.background, color: colors.onSurface, borderBottom: `1px solid ${colors.outlineVariant}` }}
                        />
                        {clientes
                          .filter(c => c.nombre.toLowerCase().includes(clienteSearchText.toLowerCase()))
                          .map((cliente) => (
                            <button
                              key={cliente.id_cliente}
                              onClick={() => {
                                setDeudaCliente(cliente);
                                setShowClienteDropdown(false);
                                setClienteSearchText('');
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                              style={{ color: colors.onSurface }}
                            >
                              {cliente.nombre}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* NORMAL PAYMENT FORM */
              <>
                {['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd']
                  .filter(tipo => cuentaConfig[tipo as keyof typeof cuentaConfig]?.length > 0)
                  .map((tipo) => {
                    const label = tipo.replace('_', ' ').toUpperCase();
                    const selectedCuenta = selectedCuentas[tipo as keyof typeof selectedCuentas];
                    
                    return (
                      <div key={tipo} className="mb-4">
                        <div className="flex items-center gap-4">
                          <div style={{ flex: 0.4 }}>
                            <label style={{ display: 'block', fontSize: '14px', color: colors.onSurface, marginBottom: '8px' }}>
                              {label}
                            </label>
                            <button
                              onClick={() => {
                                setSelectorTipoCuenta(tipo);
                                setShowCuentaSelector(true);
                              }}
                              className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                              style={{
                                backgroundColor: colors.background,
                                color: selectedCuenta ? colors.onSurface : colors.outline,
                                border: `1px solid ${colors.outlineVariant}`,
                                height: '42px'
                              }}
                            >
                              <span className="truncate">{selectedCuenta?.nombre || 'Seleccionar cuenta...'}</span>
                              <ChevronDown size={16} color={colors.outline} />
                            </button>
                          </div>
                          
                          <div style={{ flex: 0.6 }}>
                            <label style={{ display: 'block', fontSize: '14px', color: colors.onSurface, marginBottom: '8px' }}>
                              Monto
                            </label>
                            <input
                              type="number"
                              value={paymentAmounts[tipo as keyof typeof paymentAmounts]}
                              onChange={(e) => setPaymentAmounts({...paymentAmounts, [tipo]: e.target.value})}
                              placeholder="0.00"
                              className="w-full px-4 py-2 rounded-lg"
                              style={{
                                backgroundColor: colors.background,
                                color: colors.onSurface,
                                border: `1px solid ${colors.outlineVariant}`,
                                height: '42px'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Total a pagar */}
                <div className="p-3 rounded-lg mb-2" style={{ backgroundColor: colors.primary }}>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#fff', fontSize: '14px' }}>Total a pagar:</span>
                    <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                      ${formatNumberWithSpaces(calculateTotal())} CUP
                    </span>
                  </div>
                </div>

                {/* Falta por pagar / Cambio a devolver */}
                {Math.abs(getRemainingAmount()) > 0.01 && (
                  <div
                    className="p-3 rounded-lg mb-4"
                    style={{
                      backgroundColor: getRemainingAmount() > 0 ? colors.error : colors.secondary,
                      color: getRemainingAmount() > 0 ? '#fff' : '#fff'
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>
                        {getRemainingAmount() > 0 ? 'Falta por pagar:' : 'Cambio a devolver:'}
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        ${formatNumberWithSpaces(Math.abs(getRemainingAmount()))} CUP
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Nota */}
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '14px', color: colors.onSurface, marginBottom: '8px' }}>Nota</label>
              <textarea
                value={ventaNota}
                onChange={(e) => setVentaNota(e.target.value)}
                placeholder="Agregar nota a la venta (opcional)..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  border: `1px solid ${colors.outlineVariant}`,
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitSale}
              disabled={isSubmitting || saleItems.length === 0}
              className="w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff', opacity: (isSubmitting || saleItems.length === 0) ? 0.7 : 1 }}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <CheckCircle size={20} />
              )}
              <span>{isSubmitting ? 'Procesando...' : 'Realizar Venta'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Price Edit Modal */}
      {showPriceEditModal && editingItemIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPriceEditModal(false)}
        >
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-lg"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.onSurface }}>
                Editar Precio
              </h3>
              <button
                onClick={() => setShowPriceEditModal(false)}
                className="p-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Precio CUP</label>
                <input
                  type="number"
                  value={editingItemPrices.cup}
                  onChange={(e) => setEditingItemPrices({...editingItemPrices, cup: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    border: `1px solid ${colors.outlineVariant}`
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Precio USD</label>
                <input
                  type="number"
                  value={editingItemPrices.usd}
                  onChange={(e) => setEditingItemPrices({...editingItemPrices, usd: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    border: `1px solid ${colors.outlineVariant}`
                  }}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleCancelPriceEdit}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePriceEdit}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cuenta Selector Modal */}
      {showCuentaSelector && selectorTipoCuenta && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCuentaSelector(false)}
        >
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-lg"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.onSurface }}>
                Seleccionar Cuenta
              </h3>
              <button
                onClick={() => setShowCuentaSelector(false)}
                className="p-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-auto">
              {getFilteredCuentas().length > 0 ? (
                getFilteredCuentas().map((cuenta) => (
                  <button
                    key={cuenta.id_cuenta}
                    onClick={() => handleSelectCuenta(cuenta)}
                    className="w-full px-4 py-3 rounded-lg text-left hover:bg-black/5 transition-colors"
                    style={{ backgroundColor: colors.background, color: colors.onSurface }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{cuenta.nombre}</div>
                    <div style={{ fontSize: '12px', color: colors.outline }}>{cuenta.tipo_cuenta}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-center" style={{ color: colors.outline }}>
                  No hay cuentas configuradas para este tipo
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Sale Modal */}
      {showConfirmSaleModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCancelSale}
        >
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-lg"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.onSurface, marginBottom: '8px' }}>
                Confirmar Venta
              </h3>
              <p style={{ color: colors.outline, fontSize: '14px' }}>
                {isDeudaMode ? '¿Confirmar venta como deuda?' : '¿Confirmar venta?'}
              </p>
              <p style={{ color: colors.primary, fontSize: '24px', fontWeight: 'bold', marginTop: '16px' }}>
                {confirmSaleCountdown}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCancelSale}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSale}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprobante Modal */}
      {showComprobanteModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowComprobanteModal(false)}
        >
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-lg"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.onSurface }}>
                Comprobante
              </h3>
              <button
                onClick={() => setShowComprobanteModal(false)}
                className="p-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="text-center mb-4">
              <p style={{ color: colors.onSurface }}>¿Deseas generar el comprobante de la venta?</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowComprobanteModal(false);
                  router.push('/ventas');
                }}
                className="flex-1 px-4 py-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
              >
                No
              </button>
              <button
                onClick={handleGeneratePDF}
                className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
              >
                <CheckCircle size={18} />
                <span>Generar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasCreatePage;
