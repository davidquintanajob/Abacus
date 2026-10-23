'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { useResponsive } from '../../../../hooks/useResponsive';
import { Header } from '../../../../components/layout/Header';
import { Toast } from '../../../../components/common/Toast';
import { Search, Plus, Minus, X, ChevronDown, ChevronUp, Trash2, ArrowLeft, Camera, CameraOff, CheckCircle, Barcode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getTiendas } from '../../../../services/tiendaService';
import { getServicios } from '../../../../services/servicioService';
import { getCuentas } from '../../../../services/cuentaService';
import { getVentaById, updateVenta } from '../../../../services/ventaService';
import { configService } from '../../../../services/configService';
import jsPDF from 'jspdf';

const VentasEditPage = () => {
  const router = useRouter();
  const params = useParams();
  const { colors, isDark } = useTheme();
  const { user, ventaAccessLevels, priceChangePermissions, deudaManagePermissions, clienteManagePermissions } = useAuth();
  const { showToast } = useToast();
  const { isDesktop, isMobile, isTablet } = useResponsive();

  const ventaId = params.id as string;

  // State
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [usedPaymentTypes, setUsedPaymentTypes] = useState({
    efectivo_cup: false,
    efectivo_usd: false,
    transferencia_cup: false,
    transferencia_usd: false,
  });
  const [show5Decimals, setShow5Decimals] = useState(false);
  const [ventaNota, setVentaNota] = useState('');
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState<string | null>(null);
  const [availableCuentas, setAvailableCuentas] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemPrices, setEditingItemPrices] = useState({ cup: '', usd: '' });
  
  // Scanner state
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScannedTimestamp, setLastScannedTimestamp] = useState<number | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPreferenceLoaded, setIsPreferenceLoaded] = useState(false);
  
  // Deuda mode
  const [isDeudaMode, setIsDeudaMode] = useState(false);
  const [deudaMonedaCUP, setDeudaMonedaCUP] = useState(true);
  const [deudaCliente, setDeudaCliente] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearchText, setClienteSearchText] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [deudaPagoInicial, setDeudaPagoInicial] = useState({
    activo: false,
    monto: '',
  });
  
  // Modals
  const [showConfirmSaleModal, setShowConfirmSaleModal] = useState(false);
  const [confirmSaleCountdown, setConfirmSaleCountdown] = useState(3);
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteData, setComprobanteData] = useState<any>(null);
  const [pendingSaleData, setPendingSaleData] = useState<any>(null);
  
  // Cuenta selector
  const [showCuentaSelectorModal, setShowCuentaSelectorModal] = useState(false);
  const [selectorTipoCuentaModal, setSelectorTipoCuentaModal] = useState<string | null>(null);
  const [availableCuentasModal, setAvailableCuentasModal] = useState<any[]>([]);
  
  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load venta data
  useEffect(() => {
    const loadVenta = async () => {
      try {
        setIsLoading(true);
        const venta = await getVentaById(ventaId);
        
        // Set venta data
        setVentaNota(venta.nota || '');
        console.log('Venta loaded:', venta);
        // Get tienda from ventas[0].servicioTienda.tienda like in APK
        const ventaTienda = venta.ventas?.[0]?.servicioTienda?.tienda || venta.tienda;
        console.log('Tienda:', ventaTienda);
        setSelectedTienda(ventaTienda);
        
        // Set sale items
        const items = venta.ventas?.map((v: any) => ({
          id_servicio_tienda: v.id_servicio_tienda,
          id_servicio: v.servicio?.id_servicio,
          nombre: v.servicio?.nombre,
          imagen: v.servicio?.producto?.imagen,
          cantidad: v.cantidad,
          precio_cup: v.precio_cobrado_cup,
          precio_usd: v.precio_cobrado_usd,
          precio_original_cup: v.precio_cobrado_cup,
          precio_original_usd: v.precio_cobrado_usd,
        })) || [];
        setSaleItems(items);
        
        // Set payment amounts
        setPaymentAmounts({
          efectivo_cup: venta.cantidad_cobrada_efectivo_cup?.toString() || '',
          efectivo_usd: venta.cantidad_cobrada_efectivo_usd?.toString() || '',
          transferencia_cup: venta.cantidad_cobrada_transferencia_cup?.toString() || '',
          transferencia_usd: venta.cantidad_cobrada_transferencia_usd?.toString() || '',
        });
        
        // Set selected cuentas from venta
        const cuentasData = await getCuentas({}, 1, 100);
        const allCuentas = cuentasData.data || [];
        
        setSelectedCuentas({
          efectivo_cup: allCuentas.find((c: any) => c.id_cuenta === venta.id_cuenta_efectivo_cup) || null,
          efectivo_usd: allCuentas.find((c: any) => c.id_cuenta === venta.id_cuenta_efectivo_usd) || null,
          transferencia_cup: allCuentas.find((c: any) => c.id_cuenta === venta.id_cuenta_transferencia_cup) || null,
          transferencia_usd: allCuentas.find((c: any) => c.id_cuenta === venta.id_cuenta_transferencia_usd) || null,
        });
        
        // Determine which payment types are used
        const usedPaymentTypes = {
          efectivo_cup: (venta.cantidad_cobrada_efectivo_cup || 0) > 0,
          efectivo_usd: (venta.cantidad_cobrada_efectivo_usd || 0) > 0,
          transferencia_cup: (venta.cantidad_cobrada_transferencia_cup || 0) > 0,
          transferencia_usd: (venta.cantidad_cobrada_transferencia_usd || 0) > 0,
        };
        setUsedPaymentTypes(usedPaymentTypes);
        
        // Set deuda mode
        setIsDeudaMode(venta.is_deuda || false);
        
      } catch (error) {
        console.error('Error loading venta:', error);
        showToast({ type: 'error', message: 'Error al cargar la venta' });
        router.push('/ventas');
      } finally {
        setIsLoading(false);
      }
    };

    loadVenta();
  }, [ventaId]);

  // Load tiendas
  useEffect(() => {
    const loadTiendas = async () => {
      try {
        const data = await getTiendas({}, 1, 100);
        setAvailableTiendas(data.data || []);
      } catch (error) {
        console.error('Error loading tiendas:', error);
      }
    };
    loadTiendas();
  }, []);

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await configService.getConfig();
        setConfig(cfg);
        setCupToUsdRate(parseFloat(String(cfg.cupToUsdRate || 1)));
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };
    loadConfig();
  }, []);

  // Load cuentas
  useEffect(() => {
    const loadCuentas = async () => {
      try {
        const data = await getCuentas({}, 1, 100);
        setAvailableCuentas(data.data || []);
      } catch (error) {
        console.error('Error loading cuentas:', error);
      }
    };
    loadCuentas();
  }, []);

  // Load cuenta config for selected tienda
  useEffect(() => {
    console.log('useEffect loadCuentaConfig triggered, selectedTienda:', selectedTienda);
    const loadCuentaConfig = async () => {
      if (!selectedTienda) {
        console.log('No selectedTienda, skipping config load');
        return;
      }
      try {
        const cfg = await configService.getConfig();
        console.log('Full config:', cfg);
        console.log('Tienda ID:', selectedTienda.id_tienda);
        // Like in APK: use tiendaCuentasConfig[tiendaId]
        const tiendaConfig = (cfg as any).tiendaCuentasConfig && (cfg as any).tiendaCuentasConfig[selectedTienda.id_tienda];
        console.log('Tienda config found:', tiendaConfig);
        if (tiendaConfig) {
          console.log('Setting cuentaConfig:', tiendaConfig);
          setCuentaConfig(tiendaConfig);
        } else {
          console.log('No tienda config found for tienda:', selectedTienda.id_tienda);
        }
      } catch (error) {
        console.error('Error loading cuenta config:', error);
      }
    };
    loadCuentaConfig();
  }, [selectedTienda]);

  // Load scanner preference from localStorage
  useEffect(() => {
    const loadScannerPreference = () => {
      try {
        const savedScannerState = localStorage.getItem('scannerEnabled');
        if (savedScannerState !== null) {
          const enabled = savedScannerState === 'true';
          setShowCamera(enabled);
        } else {
          // First time: set to active by default
          setShowCamera(true);
        }
        setIsPreferenceLoaded(true);
      } catch (error) {
        console.error('Error loading scanner preference:', error);
        setShowCamera(true); // Default to active on error
        setIsPreferenceLoaded(true);
      }
    };

    loadScannerPreference();
  }, []);

  // Save scanner preference to localStorage when it changes (only after preference is loaded)
  useEffect(() => {
    if (isPreferenceLoaded) {
      try {
        localStorage.setItem('scannerEnabled', showCamera.toString());
      } catch (error) {
        console.error('Error saving scanner preference:', error);
      }
    }
  }, [showCamera, isPreferenceLoaded]);

  // Save scanner state before unmount
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem('scannerEnabled', showCamera.toString());
      } catch (error) {
        console.error('Error saving scanner preference on unmount:', error);
      }
    };
  }, [showCamera]);

  // Initialize camera and barcode scanner when showCamera changes
  useEffect(() => {
    if (showCamera && isPreferenceLoaded) {
      const startCamera = async () => {
        // Wait for DOM to be ready with multiple checks
        let retries = 0;
        const maxRetries = 10;
        
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const readerElement = document.getElementById("reader-edit");
          if (readerElement) {
            break;
          }
          retries++;
        }

        const readerElement = document.getElementById("reader-edit");
        if (!readerElement) {
          console.error('Reader element not found after retries');
          setShowCamera(false);
          return;
        }
        
        try {
          const html5QrCode = new Html5Qrcode("reader-edit");
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
  }, [showCamera, isPreferenceLoaded]);

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

  const canManageDebt = () => {
    const userRole = user?.rol?.toLowerCase();
    if (userRole === 'administrador') return true;
    if (userRole === 'dependiente' && deudaManagePermissions?.dependiente) return true;
    if (userRole === 'almacenero' && deudaManagePermissions?.almacenero) return true;
    if (userRole === 'económico' && deudaManagePermissions?.economico) return true;
    return false;
  };

  const canManageClients = () => {
    const userRole = user?.rol?.toLowerCase();
    if (userRole === 'administrador') return true;
    if (userRole === 'dependiente' && clienteManagePermissions?.dependiente) return true;
    if (userRole === 'almacenero' && clienteManagePermissions?.almacenero) return true;
    if (userRole === 'económico' && clienteManagePermissions?.economico) return true;
    return false;
  };

  // Search products
  useEffect(() => {
    const searchProducts = async () => {
      if (searchText.length < 2) {
        setSearchResults([]);
        setShowSearchDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const filters: any = { nombre: searchText, fetchProducto: true };
        if (selectedTienda) {
          filters.id_tienda = selectedTienda.id_tienda;
        }
        
        const data = await getServicios(filters, 1, 20);
        setSearchResults(data.data || []);
        setShowSearchDropdown(true);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchText, selectedTienda]);

  // Calculations
  const totalProducts = saleItems.length;
  const totalCUP = saleItems.reduce((sum, item) => sum + (item.precio_cup * item.cantidad), 0);
  const totalUSD = saleItems.reduce((sum, item) => sum + (item.precio_usd * item.cantidad), 0);

  const [cupToUsdRate, setCupToUsdRate] = useState(1);

  const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
  const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
  const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
  const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;

  const totalPagadoCUP = efectivoCup + transferenciaCup;
  const totalPagadoUSD = efectivoUsd + transferenciaUsd;
  const totalPagadoUSDInCUP = totalPagadoUSD * cupToUsdRate;
  const totalPagado = totalPagadoCUP + totalPagadoUSDInCUP;

  const faltaPorPagar = totalCUP - totalPagado;
  const cambio = totalPagado - totalCUP;

  const formatNumberWithSpaces = (num: number) => {
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setIsScanning(true);
      
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
      (item) => item.id_servicio === product.id_servicio
    );

    if (itemExists) {
      const existingIndex = saleItems.findIndex((item) => item.id_servicio === product.id_servicio);
      const updatedItems = [...saleItems];
      updatedItems[existingIndex].cantidad += 1;
      setSaleItems(updatedItems);
      playBeep();
    } else {
      const servicioTienda = product.tiendas_servicio?.find(
        (st: any) => st.id_tienda === selectedTienda?.id_tienda
      );

      const newItem = {
        id_servicio_tienda: servicioTienda?.id_servicio_tienda,
        id_servicio: product.id_servicio,
        nombre: product.nombre,
        imagen: product.producto?.imagen,
        cantidad: 1,
        precio_cup: servicioTienda?.precio_cup || 0,
        precio_usd: servicioTienda?.precio_usd || 0,
        precio_original_cup: servicioTienda?.precio_cup || 0,
        precio_original_usd: servicioTienda?.precio_usd || 0,
      };

      setSaleItems([...saleItems, newItem]);
      playBeep();
    }

    setSearchText('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const updatedItems = [...saleItems];
    updatedItems[index].cantidad += delta;
    
    if (updatedItems[index].cantidad <= 0) {
      handleRemoveItem(index);
    } else {
      setSaleItems(updatedItems);
      if (delta > 0) playBeep();
    }
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = saleItems.filter((_, i) => i !== index);
    setSaleItems(updatedItems);
  };

  const handleEditPrice = (index: number) => {
    if (!canChangePrice()) {
      showToast({ type: 'warning', message: 'No tienes permiso para cambiar precios' });
      return;
    }
    setEditingItemIndex(index);
    setEditingItemPrices({
      cup: saleItems[index].precio_cup.toString(),
      usd: saleItems[index].precio_usd.toString(),
    });
    setShowPriceEditModal(true);
  };

  const handleSavePriceEdit = () => {
    if (editingItemIndex === null) return;

    const updatedItems = [...saleItems];
    updatedItems[editingItemIndex].precio_cup = parseFloat(editingItemPrices.cup) || 0;
    updatedItems[editingItemIndex].precio_usd = parseFloat(editingItemPrices.usd) || 0;
    setSaleItems(updatedItems);
    setShowPriceEditModal(false);
    setEditingItemIndex(null);
    setEditingItemPrices({ cup: '', usd: '' });
  };

  const handleSelectCuenta = (cuenta: any) => {
    if (selectorTipoCuentaModal) {
      setSelectedCuentas(prev => ({ ...prev, [selectorTipoCuentaModal]: cuenta }));
    }
    setShowCuentaSelectorModal(false);
    setSelectorTipoCuentaModal(null);
  };

  const getFilteredCuentas = () => {
    if (!selectorTipoCuentaModal) return [];

    console.log('getFilteredCuentas called:', { selectorTipoCuentaModal, cuentaConfig });

    // Like in APK, just return the cuentas from cuentaConfig for this tipo
    const cuentas = cuentaConfig[selectorTipoCuentaModal as keyof typeof cuentaConfig] || [];

    console.log('Cuentas from config:', cuentas);
    return cuentas;
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

    setPendingSaleData({
      saleItems,
      selectedTienda,
      paymentAmounts,
      ventaNota,
      isDeudaMode,
      deudaCliente,
      deudaMonedaCUP,
      deudaPagoInicial,
    });
    setShowConfirmSaleModal(true);
    setConfirmSaleCountdown(3);
  };

  useEffect(() => {
    if (showConfirmSaleModal && confirmSaleCountdown > 0) {
      const interval = setInterval(() => {
        setConfirmSaleCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showConfirmSaleModal, confirmSaleCountdown]);

  const handleConfirmSale = async () => {
    if (!pendingSaleData) return;

    setIsSubmitting(true);
    setShowConfirmSaleModal(false);

    try {
      const roundTo5Decimals = (value: number) => Math.round(value * 100000) / 100000;
      const cambio = parseFloat(config.cupToUsdRate || 1);
      const efectivoCup = parseFloat(paymentAmounts.efectivo_cup) || 0;
      const efectivoUsd = parseFloat(paymentAmounts.efectivo_usd) || 0;
      const transferenciaCup = parseFloat(paymentAmounts.transferencia_cup) || 0;
      const transferenciaUsd = parseFloat(paymentAmounts.transferencia_usd) || 0;

      const ventas = saleItems.map(item => ({
        id_servicio_tienda: item.id_servicio_tienda,
        cantidad: item.cantidad,
        precio_cobrado_cup: item.precio_cup,
        precio_cobrado_usd: item.precio_usd,
      }));

      const ventaData = {
        id_tienda: selectedTienda.id_tienda,
        fecha_hora: new Date().toISOString(),
        nota: ventaNota,
        cantidad_cobrada_efectivo_cup: efectivoCup,
        cantidad_cobrada_efectivo_usd: efectivoUsd,
        cantidad_cobrada_transferencia_cup: transferenciaCup,
        cantidad_cobrada_transferencia_usd: transferenciaUsd,
        id_usuario: user?.id_usuario,
        cambio_moneda: cambio,
        ventas: ventas,
      };

      await updateVenta(ventaId, ventaData);

      showToast({ type: 'success', message: 'Venta actualizada correctamente' });
      router.push('/ventas');
    } catch (error) {
      console.error('Error updating venta:', error);
      showToast({ type: 'error', message: 'Error al actualizar la venta' });
    } finally {
      setIsSubmitting(false);
      setPendingSaleData(null);
    }
  };

  const handleCancelSale = () => {
    setShowConfirmSaleModal(false);
    setPendingSaleData(null);
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  // Get mode from URL params
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    if (modeParam === 'view' || modeParam === 'edit') {
      setMode(modeParam);
    }
  }, []);

  const isViewMode = mode === 'view';

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
        title={isViewMode ? 'Ver Venta' : 'Editar Venta'}
        showScannerButton={!isViewMode}
        onScannerPress={() => setShowCamera(!showCamera)}
        scannerActive={showCamera}
        hideUserIcon={true}
      />
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
        {showCamera && !isViewMode && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <div 
              id="reader-edit" 
              style={{ 
                width: isDesktop ? '450px' : isTablet ? '250px' : '300px',
                height: isDesktop ? '300px' : isTablet ? '250px' : '300px',
                margin: '0 auto',
                display: 'block'
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
              disabled={!canViewAllStores || isViewMode}
              style={{
                backgroundColor: colors.background,
                border: `1px solid ${colors.outlineVariant}`,
                color: colors.onSurface,
                opacity: canViewAllStores && !isViewMode ? 1 : 0.5,
              }}
            >
              <span>{selectedTienda ? selectedTienda.nombre : 'Selecciona una tienda'}</span>
              {canViewAllStores && !isViewMode && <ChevronDown size={20} />}
            </button>
            {showTiendaDropdown && canViewAllStores && !isViewMode && (
              <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                {availableTiendas.map((tienda) => (
                  <button
                    key={tienda.id_tienda}
                    onClick={() => {
                      setSelectedTienda(tienda);
                      setShowTiendaDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:opacity-80 transition-colors"
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
        {!isViewMode && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Buscar Producto</label>
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Nombre del producto..."
                className="w-full px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.outlineVariant}`,
                  color: colors.onSurface,
                }}
              />
              <Search size={20} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.outline }} />
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                {searchResults.map((product) => (
                  <button
                    key={product.id_servicio}
                    onClick={() => handleAddProduct(product)}
                    className="w-full px-4 py-2 text-left hover:opacity-80 transition-colors"
                    style={{ color: colors.onSurface }}
                  >
                    {product.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
                    {!isViewMode && (
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 rounded hover:bg-black/5"
                        style={{ color: colors.error }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isViewMode && (
                      <>
                        <button
                          onClick={() => handleUpdateQuantity(index, -1)}
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
                          onClick={() => handleUpdateQuantity(index, 1)}
                          className="p-2 rounded"
                          style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                        >
                          <Plus size={16} />
                        </button>
                        {!isViewMode && canChangePrice() && (
                          <button
                            onClick={() => handleEditPrice(index)}
                            className="ml-auto px-3 py-2 rounded text-sm"
                            style={{ backgroundColor: colors.primary, color: '#fff' }}
                          >
                            Editar Precio
                          </button>
                        )}
                      </>
                    )}
                    {isViewMode && (
                      <span style={{ color: colors.onSurface, fontWeight: '600' }}>
                        Cantidad: {item.cantidad}
                      </span>
                    )}
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
        {!isViewMode && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>
              Pago
            </h2>
            
            {/* Efectivo CUP */}
            {usedPaymentTypes.efectivo_cup && (
              <div className="mb-4">
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Efectivo CUP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentAmounts.efectivo_cup}
                    onChange={(e) => setPaymentAmounts(prev => ({ ...prev, efectivo_cup: e.target.value }))}
                    placeholder="Monto"
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.background,
                      border: `1px solid ${colors.outlineVariant}`,
                      color: colors.onSurface,
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectorTipoCuentaModal('efectivo_cup');
                      setShowCuentaSelectorModal(true);
                    }}
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                  >
                    {selectedCuentas.efectivo_cup?.nombre || 'Cuenta'}
                  </button>
                </div>
              </div>
            )}

            {/* Efectivo USD */}
            {usedPaymentTypes.efectivo_usd && (
              <div className="mb-4">
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Efectivo USD</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentAmounts.efectivo_usd}
                    onChange={(e) => setPaymentAmounts(prev => ({ ...prev, efectivo_usd: e.target.value }))}
                    placeholder="Monto"
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.background,
                      border: `1px solid ${colors.outlineVariant}`,
                      color: colors.onSurface,
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectorTipoCuentaModal('efectivo_usd');
                      setShowCuentaSelectorModal(true);
                    }}
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                  >
                    {selectedCuentas.efectivo_usd?.nombre || 'Cuenta'}
                  </button>
                </div>
              </div>
            )}

            {/* Transferencia CUP */}
            {usedPaymentTypes.transferencia_cup && (
              <div className="mb-4">
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Transferencia CUP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentAmounts.transferencia_cup}
                    onChange={(e) => setPaymentAmounts(prev => ({ ...prev, transferencia_cup: e.target.value }))}
                    placeholder="Monto"
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.background,
                      border: `1px solid ${colors.outlineVariant}`,
                      color: colors.onSurface,
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectorTipoCuentaModal('transferencia_cup');
                      setShowCuentaSelectorModal(true);
                    }}
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                  >
                    {selectedCuentas.transferencia_cup?.nombre || 'Cuenta'}
                  </button>
                </div>
              </div>
            )}

            {/* Transferencia USD */}
            {usedPaymentTypes.transferencia_usd && (
              <div className="mb-4">
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Transferencia USD</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentAmounts.transferencia_usd}
                    onChange={(e) => setPaymentAmounts(prev => ({ ...prev, transferencia_usd: e.target.value }))}
                    placeholder="Monto"
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: colors.background,
                      border: `1px solid ${colors.outlineVariant}`,
                      color: colors.onSurface,
                    }}
                  />
                  <button
                    onClick={() => {
                      setSelectorTipoCuentaModal('transferencia_usd');
                      setShowCuentaSelectorModal(true);
                    }}
                    className="px-4 py-2 rounded-lg"
                    style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                  >
                    {selectedCuentas.transferencia_usd?.nombre || 'Cuenta'}
                  </button>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="mt-4 space-y-2">
              {/* Total a pagar */}
              <div className="p-3 rounded-lg mb-2" style={{ backgroundColor: colors.primary }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: '#fff', fontSize: '14px' }}>Total a pagar:</span>
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                    ${formatNumberWithSpaces(totalCUP)} CUP
                  </span>
                </div>
              </div>

              {/* Pagado */}
              <div className="p-3 rounded-lg mb-2" style={{ backgroundColor: colors.background, border: `1px solid ${colors.outlineVariant}` }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: colors.onSurface, fontSize: '14px' }}>Pagado:</span>
                  <span style={{ color: colors.onSurface, fontSize: '18px', fontWeight: 'bold' }}>
                    ${formatNumberWithSpaces(totalPagado)} CUP
                  </span>
                </div>
              </div>

              {/* Falta por pagar / Cambio a devolver */}
              {Math.abs(faltaPorPagar) > 0.01 && (
                <div
                  className="p-3 rounded-lg mb-4"
                  style={{
                    backgroundColor: faltaPorPagar > 0 ? colors.error : colors.secondary,
                    color: '#fff'
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: '14px' }}>
                      {faltaPorPagar > 0 ? 'Falta por pagar:' : 'Cambio a devolver:'}
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      ${formatNumberWithSpaces(Math.abs(faltaPorPagar))} CUP
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
          <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Nota</label>
          <textarea
            value={ventaNota}
            onChange={(e) => setVentaNota(e.target.value)}
            placeholder="Agregar una nota..."
            className="w-full px-4 py-2 rounded-lg resize-none"
            rows={3}
            disabled={isViewMode}
            style={{
              backgroundColor: colors.background,
              border: `1px solid ${colors.outlineVariant}`,
              color: colors.onSurface,
            }}
          />
        </div>

        {/* Submit Button */}
        {!isViewMode && (
          <button
            onClick={handleSubmitSale}
            disabled={isSubmitting || saleItems.length === 0}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90"
            style={{
              backgroundColor: colors.primary,
              color: '#fff',
              opacity: isSubmitting || saleItems.length === 0 ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        )}
      </div>

      {/* Cuenta Selector Modal */}
      {showCuentaSelectorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ backgroundColor: colors.surface }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>
              Seleccionar Cuenta
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {getFilteredCuentas().length > 0 ? (
                getFilteredCuentas().map((cuenta) => (
                  <button
                    key={cuenta.id_cuenta}
                    onClick={() => handleSelectCuenta(cuenta)}
                    className="w-full px-4 py-2 rounded-lg text-left hover:opacity-80 transition-colors"
                    style={{ backgroundColor: colors.background, color: colors.onSurface }}
                  >
                    {cuenta.nombre}
                  </button>
                ))
              ) : (
                <p style={{ color: colors.outline }}>No hay cuentas disponibles</p>
              )}
            </div>
            <button
              onClick={() => setShowCuentaSelectorModal(false)}
              className="mt-4 w-full py-2 rounded-lg"
              style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Price Edit Modal */}
      {showPriceEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ backgroundColor: colors.surface }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>
              Editar Precio
            </h3>
            <div className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Precio CUP</label>
                <input
                  type="text"
                  value={editingItemPrices.cup}
                  onChange={(e) => setEditingItemPrices(prev => ({ ...prev, cup: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.outlineVariant}`,
                    color: colors.onSurface,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Precio USD</label>
                <input
                  type="text"
                  value={editingItemPrices.usd}
                  onChange={(e) => setEditingItemPrices(prev => ({ ...prev, usd: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.outlineVariant}`,
                    color: colors.onSurface,
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowPriceEditModal(false)}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePriceEdit}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Sale Modal */}
      {showConfirmSaleModal && pendingSaleData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ backgroundColor: colors.surface }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>
              {confirmSaleCountdown > 0 ? `Confirmar en ${confirmSaleCountdown}s` : 'Confirmar'}
            </h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span style={{ color: colors.outline }}>Total:</span>
                <span style={{ color: colors.onSurface }}>${formatNumberWithSpaces(totalCUP)} CUP</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: colors.outline }}>Pagado:</span>
                <span style={{ color: colors.onSurface }}>${formatNumberWithSpaces(totalPagado)} CUP</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelSale}
                disabled={confirmSaleCountdown > 0}
                className="flex-1 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  border: `1px solid ${colors.outlineVariant}`,
                  opacity: confirmSaleCountdown > 0 ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSale}
                disabled={confirmSaleCountdown > 0}
                className="flex-1 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.primary,
                  color: '#fff',
                  opacity: confirmSaleCountdown > 0 ? 0.5 : 1,
                }}
              >
                {confirmSaleCountdown > 0 ? 'Esperando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasEditPage;
