'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useConfirmDialog } from '../../../context/ConfirmDialogContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { createProducto, updateProducto, getProductoById } from '../../../services/productoService';
import { getTiendas } from '../../../services/tiendaService';
import { getEntradas } from '../../../services/entradaService';
import { configService } from '../../../services/configService';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Image,
  X,
  Camera,
  XCircle,
  Package,
  ArrowRightLeft,
  Box,
  ShoppingCart,
  Info,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function ProductoFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { isMobile } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingProducto, setIsFetchingProducto] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    esvendible: true,
    nota: '',
    sufijo: '',
    isVencible: false,
    unidad_medida: '',
    imagen: null as string | null,
    codigoList: [] as Array<{ codigo_barras_ean: string; nota: string | null }>,
    productoTiendaList: [] as Array<{ id_tienda: number; precio_cup: number | null; precio_usd: number | null; costo_cup: number | null; costo_usd: number | null }>,
    precio_cup_general: null as number | null,
    precio_usd_general: null as number | null,
    costo_cup_general: null as number | null,
    costo_usd_general: null as number | null,
  });

  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const barcodeVideoRef = useRef<HTMLVideoElement>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [priceInputTexts, setPriceInputTexts] = useState<{ [key: number]: { precio_cup?: string; precio_usd?: string; costo_cup?: string; costo_usd?: string } }>({});
  const [generalPriceInputTexts, setGeneralPriceInputTexts] = useState<{ precio_cup?: string; precio_usd?: string; costo_cup?: string; costo_usd?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imagen: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    setShowImagePickerModal(false);
  };

  const handlePickImage = () => {
    setShowImagePickerModal(true);
  };

  const handlePickFromFile = () => {
    setShowImagePickerModal(false);
    fileInputRef.current?.click();
  };

  const handlePickFromCamera = async () => {
    setShowImagePickerModal(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      cameraStreamRef.current = stream;
      setShowCameraModal(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      showToast({ type: 'error', message: 'No se pudo acceder a la cámara' });
    }
  };

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, imagen: imageData }));
      }
    }
    handleCloseCamera();
  };

  const handleCloseCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setShowCameraModal(false);
  };

  const handleOpenBarcodeScanner = () => {
    // Store existing codes in sessionStorage
    sessionStorage.setItem('existingCodes', JSON.stringify(formData.codigoList));
    // Navigate to barcode scanner page
    router.push('/barcode-scanner');
  };

  const detectBarcode = async () => {
    if (!barcodeVideoRef.current || !showBarcodeScannerModal) return;
    
    // Check if BarcodeDetector API is available
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector();
        const barcodes = await barcodeDetector.detect(barcodeVideoRef.current);
        
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          
          // Check if code already exists
          const codeExists = formData.codigoList.some(
            c => c.codigo_barras_ean.trim().toLowerCase() === code.trim().toLowerCase()
          );
          
          if (codeExists) {
            showToast({ type: 'warning', message: 'Este código ya existe en la lista' });
          } else {
            setNewCodigo(code);
            handleCloseBarcodeScanner();
            showToast({ type: 'success', message: `Código escaneado: ${code}` });
          }
          return;
        }
      } catch (error) {
        console.error('Barcode detection error:', error);
      }
    }
    
    // If BarcodeDetector not available or no barcode found, continue scanning
    requestAnimationFrame(detectBarcode);
  };

  const handleCloseBarcodeScanner = () => {
    if (barcodeStreamRef.current) {
      barcodeStreamRef.current.getTracks().forEach(track => track.stop());
      barcodeStreamRef.current = null;
    }
    setShowBarcodeScannerModal(false);
  };

  const userRole = user?.rol?.toLowerCase();
  const isAdmin = userRole === 'administrador';
  const isEconomico = userRole === 'económico';
  const isDependiente = userRole === 'dependiente';
  const isAlmacenero = userRole === 'almacenero';
  const canEditProduct = isAdmin;
  const canEditCodes = isAdmin;
  const canViewCosts = !isDependiente && !isAlmacenero;

  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);
  const [showExpirationAlert, setShowExpirationAlert] = useState(false);
  const [expirationAlertData, setExpirationAlertData] = useState<{ productoId: string | null; message: string } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  // Function to generate suffix based on product name
  const generateSuffix = (nombre: string) => {
    if (!nombre || nombre.length < 3) return '';
    
    // Get first 3 letters of name (uppercase)
    const firstThreeLetters = nombre.substring(0, 3).toUpperCase();
    
    // Generate random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    
    return `${firstThreeLetters}-${randomNum}`;
  };

  // Check for scanned codes when returning from barcode scanner
  useEffect(() => {
    const checkScannedCodes = () => {
      const scannedCodes = sessionStorage.getItem('scannedCodes');
      if (scannedCodes) {
        try {
          const codes = JSON.parse(scannedCodes);
          setFormData(prev => ({ ...prev, codigoList: codes }));
          sessionStorage.removeItem('scannedCodes');
          showToast({ type: 'success', message: `${codes.length} códigos agregados` });
        } catch (error) {
          console.error('Error parsing scanned codes:', error);
        }
      }
    };

    checkScannedCodes();
  }, []);

  // Auto-generate suffix when name changes (only for new products or when suffix is empty)
  useEffect(() => {
    if (isAddMode && formData.nombre.length >= 3 && (!formData.sufijo || formData.sufijo === '')) {
      const generatedSuffix = generateSuffix(formData.nombre);
      setFormData(prev => ({ ...prev, sufijo: generatedSuffix }));
    }
  }, [formData.nombre, isAddMode]);

  // Function to generate random EAN-13 code
  const generateRandomEAN13 = () => {
    // Generate 12 random digits
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10);
    }

    // Calculate checksum for EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i]);
      if (i % 2 === 0) {
        sum += digit * 1;
      } else {
        sum += digit * 3;
      }
    }
    const checksum = (10 - (sum % 10)) % 10;

    // Add checksum to complete EAN-13
    const fullCode = code + checksum;

    setNewCodigo(fullCode);
    showToast({ type: 'success', message: 'Código aleatorio generado' });
  };

  // Function to calculate the threshold for expiration alerts
  const calculateThreshold = (vidaUtil: number, percentage: number, minDays: number, maxDays: number) => {
    const threshold = vidaUtil * percentage;
    return Math.max(minDays, Math.min(maxDays, threshold));
  };

  // Function to determine the expiration alert level
  const getExpirationAlert = (fechaCreacion: string, fechaVencimiento: string) => {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const creacion = new Date(fechaCreacion);
    
    // Calculate days
    const vidaUtil = Math.ceil((vencimiento.getTime() - creacion.getTime()) / (1000 * 60 * 60 * 24));
    const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    
    // If already expired
    if (diasRestantes <= 0) {
      return { level: 'expired', days: diasRestantes, label: 'Vencido' };
    }
    
    // Calculate thresholds
    const umbralAmarillo = calculateThreshold(vidaUtil, 0.20, 3, 30);
    const umbralRojo = calculateThreshold(vidaUtil, 0.10, 1, 7);
    
    // Determine level
    if (diasRestantes <= umbralRojo) {
      return { level: 'critical', days: diasRestantes, label: 'Crítico' };
    } else if (diasRestantes <= umbralAmarillo) {
      return { level: 'warning', days: diasRestantes, label: 'Próximo a vencer' };
    } else {
      return { level: 'ok', days: diasRestantes, label: 'Vigente' };
    }
  };

  useEffect(() => {
    if (id && (isEditMode || isViewMode)) {
      fetchProducto();
      checkExpirationAlert();
    }
    fetchTiendas();
    fetchExchangeRate();
  }, [id]);

  // Check for expiration alerts
  const checkExpirationAlert = async () => {
    if (!id || isAddMode) return;
    
    try {
      const hoy = new Date();
      const fechaMaxima = new Date(hoy);
      fechaMaxima.setDate(fechaMaxima.getDate() + 30);
      const fechaMaximaStr = fechaMaxima.toISOString().split('T')[0];
      
      const response = await getEntradas({ 
        id_servicio: id,
        fecha_vencimiento_hasta: fechaMaximaStr 
      }, 1, 100);
      
      if (response.data && response.data.length > 0) {
        const filteredEntries = response.data.filter((entrada: any) => {
          const productoId = entrada.servicioTienda?.servicio?.id_servicio;
          return productoId === parseInt(id!);
        });
        
        const hasExpiringEntries = filteredEntries.some((entrada: any) => {
          if (!entrada.fecha || !entrada.fecha_vencimiento || entrada.cantidad_restante <= 0) {
            return false;
          }
          const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
          return alerta.level === 'critical' || alerta.level === 'warning' || alerta.level === 'expired';
        });
        
        if (hasExpiringEntries) {
          setShowExpirationAlert(true);
          setExpirationAlertData({
            productoId: id,
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
    } catch (error) {
      console.error('Error checking expiration alerts:', error);
      setShowExpirationAlert(false);
      setExpirationAlertData(null);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const config = await configService.getConfig();
      if (config.cupToUsdRate) {
        setExchangeRate(config.cupToUsdRate);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const fetchProducto = async () => {
    if (!id) return;
    try {
      setIsFetchingProducto(true);
      const producto = await getProductoById(id);
      
      // Extract cost from first tienda if general cost is not available
      const tiendaList = producto.tiendas_servicio || producto.tiendas_producto || [];
      const firstTienda = tiendaList.length > 0 ? tiendaList[0] : null;
      
      const imagenValue = producto.producto?.imagen || producto.imagen || null;
      
      setFormData({
        nombre: producto.nombre || '',
        categoria: producto.categoria || '',
        esvendible: producto.esvendible !== undefined ? producto.esvendible : true,
        nota: producto.nota || '',
        sufijo: producto.producto?.sufijo || producto.sufijo || '',
        isVencible: producto.producto?.isVencible !== undefined ? producto.producto.isVencible : (producto.isVencible || false),
        unidad_medida: producto.producto?.unidad_medida || producto.unidad_medida || '',
        imagen: imagenValue,
        codigoList: producto.codigos || [],
        productoTiendaList: tiendaList,
        precio_cup_general: producto.precio_cup_general || null,
        precio_usd_general: producto.precio_usd_general || null,
        costo_cup_general: producto.costo_cup_general ?? firstTienda?.costo_cup ?? null,
        costo_usd_general: producto.costo_usd_general ?? firstTienda?.costo_usd ?? null,
      });

      if (producto.codigos && producto.codigos.length > 0) {
        setIsCodesExpanded(true);
      }
      if (tiendaList && tiendaList.length > 0) {
        setIsPricesExpanded(true);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar datos del producto' });
    } finally {
      setIsFetchingProducto(false);
    }
  };

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
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

    try {
      setIsSaving(true);

      // Helper function to safely convert to number with 5 decimal places
      const toFixed5 = (value: any) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
      };

      // Construct productoTiendaList without cantidad field (like APK)
      const productoTiendaList = (() => {
        let baseList: any[] = [];
        
        // If user has configured specific stores in productoTiendaList, only include those stores
        // This respects the user's decision to remove stores from the form
        if (formData.productoTiendaList.length > 0) {
          formData.productoTiendaList.forEach((specific: any) => {
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
        
        return baseList.map((item: any) => ({
          ...item,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        }));
      })();

      const dataToSend = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        esvendible: formData.esvendible,
        nota: formData.nota || null,
        sufijo: formData.sufijo || null,
        isVencible: formData.isVencible,
        unidad_medida: formData.unidad_medida || null,
        imagen: (() => {
          // Only send image if it's base64 or full URL, not relative path
          if (!formData.imagen) return undefined;
          const isBase64 = formData.imagen.startsWith('data:');
          const isFullUrl = formData.imagen.startsWith('http://') || formData.imagen.startsWith('https://');
          return (isBase64 || isFullUrl) ? formData.imagen : undefined;
        })(),
        codigoList: formData.codigoList,
        productoTiendaList,
      };

      if (isEditMode) {
        await updateProducto(id!, dataToSend);
        showToast({ type: 'success', message: 'Producto actualizado correctamente' });
      } else {
        await createProducto(dataToSend);
        showToast({ type: 'success', message: 'Producto creado correctamente' });
      }
      
      router.push('/productos');
    } catch (err: any) {
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
    setShowScannerModal(false);
    setIsCodesExpanded(true);
  };

  const handleDeleteCode = (index: number) => {
    showConfirmDialog({
      title: 'Eliminar Código',
      message: '¿Estás seguro de que quieres eliminar este código?',
      onConfirm: () => {
        hideConfirmDialog();
        setFormData(prev => ({
          ...prev,
          codigoList: prev.codigoList.filter((_, i) => i !== index)
        }));
      },
      type: 'danger'
    });
  };

  const handleAddTiendaProducto = () => {
    const existingTiendaIds = formData.productoTiendaList.map(item => item.id_tienda);
    const availableTiendas = tiendas.filter(tienda => 
      tienda.activo === true && !existingTiendaIds.includes(tienda.id_tienda)
    );

    if (availableTiendas.length === 0) {
      showToast({ type: 'warning', message: 'Todas las tiendas ya están agregadas' });
      return;
    }

    const newTiendaEntries = availableTiendas.map(tienda => ({
      id_tienda: tienda.id_tienda,
      precio_cup: formData.precio_cup_general || 0,
      precio_usd: formData.precio_usd_general || 0,
      costo_cup: formData.costo_cup_general || 0,
      costo_usd: formData.costo_usd_general || 0,
    }));

    setFormData(prev => ({
      ...prev,
      productoTiendaList: [...prev.productoTiendaList, ...newTiendaEntries]
    }));
  };

  const handleRemoveTiendaProducto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.filter((_, i) => i !== index)
    }));
  };

  const handleTiendaProductoChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedList = prev.productoTiendaList.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: parseFloat(value) || 0 };
          
          // Automatic currency conversion for tienda prices
          if (exchangeRate !== null && exchangeRate > 0) {
            if (field === 'precio_cup' && value !== '') {
              const usdValue = parseFloat(value) / exchangeRate;
              updatedItem.precio_usd = parseFloat(usdValue.toFixed(5));
            }
            if (field === 'precio_usd' && value !== '') {
              const cupValue = parseFloat(value) * exchangeRate;
              updatedItem.precio_cup = parseFloat(cupValue.toFixed(5));
            }
            if (field === 'costo_cup' && value !== '') {
              const usdValue = parseFloat(value) / exchangeRate;
              updatedItem.costo_usd = parseFloat(usdValue.toFixed(5));
            }
            if (field === 'costo_usd' && value !== '') {
              const cupValue = parseFloat(value) * exchangeRate;
              updatedItem.costo_cup = parseFloat(cupValue.toFixed(5));
            }
          }
          
          return updatedItem;
        }
        return item;
      });
      return { ...prev, productoTiendaList: updatedList };
    });
  };

  const handleTiendaPriceFocus = (index: number, field: string) => {
    const tiendaProducto = formData.productoTiendaList[index];
    const value = tiendaProducto[field as keyof typeof tiendaProducto];
    
    if (value !== null && value !== 0 && !isNaN(parseFloat(String(value)))) {
      setPriceInputTexts(prev => ({
        ...prev,
        [index]: { ...prev[index], [field]: String(parseFloat(String(value))) }
      }));
    } else {
      setPriceInputTexts(prev => ({
        ...prev,
        [index]: { ...prev[index], [field]: '' }
      }));
    }
  };

  const handleTiendaPriceBlur = (index: number, field: string) => {
    setPriceInputTexts(prev => {
      const updated = { ...prev[index] };
      if (updated) {
        delete updated[field as keyof typeof updated];
      }
      return { ...prev, [index]: updated };
    });
  };

  const handleGeneralPriceChange = (field: string, value: number | null) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Automatic currency conversion
      if (exchangeRate !== null && exchangeRate > 0) {
        if (field === 'precio_cup_general' && value !== null) {
          const usdValue = value / exchangeRate;
          updated.precio_usd_general = parseFloat(usdValue.toFixed(5));
        }
        if (field === 'precio_usd_general' && value !== null) {
          const cupValue = value * exchangeRate;
          updated.precio_cup_general = parseFloat(cupValue.toFixed(5));
        }
        if (field === 'costo_cup_general' && value !== null) {
          const usdValue = value / exchangeRate;
          updated.costo_usd_general = parseFloat(usdValue.toFixed(5));
        }
        if (field === 'costo_usd_general' && value !== null) {
          const cupValue = value * exchangeRate;
          updated.costo_cup_general = parseFloat(cupValue.toFixed(5));
        }
      }
      
      return updated;
    });
  };

  const handleGeneralPriceBlur = () => {
    // Check if general prices are defined and update tiendas accordingly
    const hasAnyGeneralPrice = 
      (formData.precio_cup_general !== null && formData.precio_cup_general !== 0) ||
      (formData.precio_usd_general !== null && formData.precio_usd_general !== 0);

    if (hasAnyGeneralPrice && formData.productoTiendaList.length > 0) {
      const precioCup = formData.precio_cup_general !== null && formData.precio_cup_general !== 0
        ? (typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : (isNaN(parseFloat(formData.precio_cup_general)) ? 0 : parseFloat(formData.precio_cup_general)))
        : null;
      const precioUsd = formData.precio_usd_general !== null && formData.precio_usd_general !== 0
        ? (typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : (isNaN(parseFloat(formData.precio_usd_general)) ? 0 : parseFloat(formData.precio_usd_general)))
        : null;
      
      // Get all active tienda IDs
      const activeTiendaIds = tiendas.filter(tienda => tienda.activo === true).map(tienda => tienda.id_tienda);
      
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
      setFormData(prev => ({
        ...prev,
        productoTiendaList: [
          ...prev.productoTiendaList.map(item => ({
            ...item,
            ...(precioCup !== null && { precio_cup: precioCup }),
            ...(precioUsd !== null && { precio_usd: precioUsd }),
            costo_cup: formData.costo_cup_general || 0,
            costo_usd: formData.costo_usd_general || 0,
          })),
          ...newTiendaEntries
        ]
      }));
    }
  };

  const handleApplyGeneralPrices = () => {
    if (!formData.precio_cup_general && !formData.precio_usd_general && !formData.costo_cup_general && !formData.costo_usd_general) {
      showToast({ type: 'warning', message: 'Debe especificar al menos un precio o costo general' });
      return;
    }

    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.map(item => ({
        ...item,
        precio_cup: formData.precio_cup_general !== null ? formData.precio_cup_general : item.precio_cup,
        precio_usd: formData.precio_usd_general !== null ? formData.precio_usd_general : item.precio_usd,
        costo_cup: canViewCosts ? (formData.costo_cup_general !== null ? formData.costo_cup_general : item.costo_cup) : item.costo_cup,
        costo_usd: canViewCosts ? (formData.costo_usd_general !== null ? formData.costo_usd_general : item.costo_usd) : item.costo_usd,
      }))
    }));

    showToast({ type: 'success', message: 'Precios aplicados a todas las tiendas' });
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/productos')}
          isDark={isDarkMode}
          title={isViewMode ? 'Información del Producto' : isEditMode ? 'Editar Producto' : 'Agregar Producto'}
          currentRoute="Productos"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
          {isFetchingProducto ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando datos del producto...</p>
            </div>
          ) : (
            <>
              {/* Action Buttons Section - For Admin and users with permissions */}
              {(() => {
                const canManageEntradas = isAdmin || (user?.permissions?.entrada);
                const canManageSalidas = isAdmin || (user?.permissions?.salida);
                const mobile = isMobile;
                
                if ((!canManageEntradas && !canManageSalidas) || !(isViewMode || isEditMode)) return null;
                
                return (
                  <div 
                    className="rounded-2xl p-4 mb-6 shadow-lg"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <div className="flex gap-3 flex-wrap justify-center">
                      {canManageEntradas && (
                        <button
                          className="flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ 
                            backgroundColor: isDarkMode ? '#1B5E20' : '#E8F5E9',
                            width: mobile ? '48px' : 'auto',
                            height: mobile ? '48px' : 'auto',
                            borderRadius: mobile ? '50%' : '8px',
                            padding: mobile ? '0' : '12px'
                          }}
                          onClick={() => router.push(`/entradas/form?mode=add&productoId=${id}`)}
                        >
                          <img 
                            src="/package-add.png" 
                            alt="Agregar Entrada" 
                            style={{ 
                              width: '24px', 
                              height: '24px',
                              filter: isDarkMode ? 'brightness(0) invert(1)' : 'brightness(0)'
                            }}
                          />
                          {!mobile && (
                            <span className="ml-2 text-sm font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}>Agregar Entrada</span>
                          )}
                        </button>
                      )}
                      <button
                        className="flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: isDarkMode ? '#0D47A1' : '#E3F2FD', 
                          opacity: 0.5,
                          width: mobile ? '48px' : 'auto',
                          height: mobile ? '48px' : 'auto',
                          borderRadius: mobile ? '50%' : '8px',
                          padding: mobile ? '0' : '12px'
                        }}
                        disabled={true}
                      >
                        <img 
                          src="/moving.png" 
                          alt="Movimiento" 
                          style={{ 
                            width: '24px', 
                            height: '24px',
                            filter: isDarkMode ? 'brightness(0) invert(1)' : 'brightness(0)'
                          }}
                        />
                        {!mobile && (
                          <span className="ml-2 text-sm font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}>Movimiento</span>
                        )}
                      </button>
                      {canManageSalidas && (
                        <button
                          className="flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ 
                            backgroundColor: isDarkMode ? '#B71C1C' : '#FFEBEE',
                            width: mobile ? '48px' : 'auto',
                            height: mobile ? '48px' : 'auto',
                            borderRadius: mobile ? '50%' : '8px',
                            padding: mobile ? '0' : '12px'
                          }}
                          onClick={() => router.push(`/salidas/form?mode=add&productoId=${id}`)}
                        >
                          <img 
                            src="/box.png" 
                            alt="Hacer Salida" 
                            style={{ 
                              width: '24px', 
                              height: '24px',
                              filter: isDarkMode ? 'brightness(0) invert(1)' : 'brightness(0)'
                            }}
                          />
                          {!mobile && (
                            <span className="ml-2 text-sm font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}>Hacer Salida</span>
                          )}
                        </button>
                      )}
                      <button
                        className="flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: isDarkMode ? '#F57C00' : '#FFF3E0',
                          width: mobile ? '48px' : 'auto',
                          height: mobile ? '48px' : 'auto',
                          borderRadius: mobile ? '50%' : '8px',
                          padding: mobile ? '0' : '12px'
                        }}
                        onClick={() => router.push(`/ventas/form?mode=add&productoId=${id}`)}
                      >
                        <img 
                          src="/sales.png" 
                          alt="Vender" 
                          style={{ 
                            width: '24px', 
                            height: '24px',
                            filter: isDarkMode ? 'brightness(0) invert(1)' : 'brightness(0)'
                          }}
                        />
                        {!mobile && (
                          <span className="ml-2 text-sm font-medium" style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}>Vender</span>
                        )}
                      </button>
                      <button
                        className="flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', 
                          border: '1px solid',
                          borderColor: colors.primary,
                          width: mobile ? '48px' : 'auto',
                          height: mobile ? '48px' : 'auto',
                          borderRadius: mobile ? '50%' : '8px',
                          padding: mobile ? '0' : '12px'
                        }}
                        onClick={() => setShowInfoModal(true)}
                      >
                        <img 
                          src="/information.png" 
                          alt="Info" 
                          style={{ 
                            width: '24px', 
                            height: '24px',
                            filter: isDarkMode ? 'brightness(0) invert(1)' : 'brightness(0)'
                          }}
                        />
                        {!mobile && (
                          <span className="ml-2 text-sm font-medium" style={{ color: isDarkMode ? colors.primary : '#1976D2' }}>Info</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Expiration Alert */}
              {showExpirationAlert && (
                <div 
                  className="rounded-2xl p-4 mb-6 shadow-lg flex items-center gap-3"
                  style={{ backgroundColor: '#FFF3E0', border: '1px solid #FF9800' }}
                >
                  <AlertTriangle size={20} style={{ color: '#FF9800' }} />
                  <p className="text-sm font-medium" style={{ color: '#E65100' }}>
                    {expirationAlertData?.message || 'Este producto tiene entradas próximas a vencer'}
                  </p>
                </div>
              )}

              {/* Form Card */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                {/* Nombre */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Nombre *
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Nombre del producto"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Categoría and Sufijo in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Categoría *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Categoría"
                      value={formData.categoria}
                      onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Código interno (Sufijo) *
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Sufijo"
                      value={formData.sufijo}
                      onChange={(e) => setFormData(prev => ({ ...prev, sufijo: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Image Section */}
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2 text-center"
                    style={{ color: colors.outline }}
                  >
                    Imagen
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    {(() => {
                      if (!formData.imagen) return null;
                      
                      const isBase64 = formData.imagen.startsWith('data:');
                      const isFullUrl = formData.imagen.startsWith('http://') || formData.imagen.startsWith('https://');
                      const fullImageUrl = isBase64 || isFullUrl ? formData.imagen : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}${formData.imagen}`;
                      
                      return (
                        <div className="relative">
                          <img
                            src={fullImageUrl}
                            alt="Producto"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          {!isReadOnly && (
                            <button
                              className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white"
                              onClick={() => setFormData(prev => ({ ...prev, imagen: null }))}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })() || (
                      <button
                        className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: colors.background, 
                          borderColor: colors.outlineVariant 
                        }}
                        onClick={() => !isReadOnly && handlePickImage()}
                        disabled={isReadOnly}
                      >
                        <Image size={32} style={{ color: colors.outline }} />
                        <span className="text-xs mt-1" style={{ color: colors.outline }}>
                          {isReadOnly ? 'Sin imagen' : 'Seleccionar'}
                        </span>
                      </button>
                    )}
                    {!isReadOnly && formData.imagen && (
                      <button
                        className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={handlePickImage}
                      >
                        <Image size={16} />
                        <span>Cambiar</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImagePick}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Image Picker Modal */}
                {showImagePickerModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div 
                      className="rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <button
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setShowImagePickerModal(false)}
                      >
                        <X size={24} style={{ color: colors.outline }} />
                      </button>
                      <h2 
                        className="text-xl font-bold mb-4"
                        style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
                        Seleccionar Imagen
                      </h2>
                      <div className="space-y-3">
                        <button
                          className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                          style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                          onClick={handlePickFromFile}
                        >
                          <Image size={20} />
                          <span>Buscar en la PC</span>
                        </button>
                        <button
                          className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                          style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                          onClick={handlePickFromCamera}
                        >
                          <Camera size={20} />
                          <span>Usar cámara</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Camera Modal */}
                {showCameraModal && (
                  <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                    <div className="relative w-full h-full flex flex-col">
                      <div className="absolute top-4 right-4 z-10">
                        <button
                          className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          onClick={handleCloseCamera}
                        >
                          <X size={24} color="white" />
                        </button>
                      </div>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                        <button
                          className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition-colors"
                          onClick={handleCapturePhoto}
                        >
                          <div className="w-12 h-12 rounded-full border-4 border-gray-800" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Barcode Scanner Modal */}
                {showBarcodeScannerModal && (
                  <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                    <div className="relative w-full h-full flex flex-col">
                      <div className="absolute top-4 right-4 z-10">
                        <button
                          className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          onClick={handleCloseBarcodeScanner}
                        >
                          <X size={24} color="white" />
                        </button>
                      </div>
                      <video
                        ref={barcodeVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative w-64 h-64">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
                        </div>
                      </div>
                      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white text-center">
                        <p className="text-lg font-semibold">Escanea el código de barras</p>
                        <p className="text-sm opacity-75">Apunta la cámara al código</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cost fields (only for canViewCosts) */}
                {canViewCosts && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Costo CUP
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Costo CUP"
                        value={formData.costo_cup_general || ''}
                        onChange={(e) => handleGeneralPriceChange('costo_cup_general', parseFloat(e.target.value) || null)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label 
                        className="block text-sm font-medium mb-2"
                        style={{ color: colors.outline }}
                      >
                        Costo USD
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Costo USD"
                        value={formData.costo_usd_general || ''}
                        onChange={(e) => handleGeneralPriceChange('costo_usd_general', parseFloat(e.target.value) || null)}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                )}

                {/* Unidad de Medida and Nota in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Unidad de Medida
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Unidad (opcional)"
                      value={formData.unidad_medida}
                      onChange={(e) => setFormData(prev => ({ ...prev, unidad_medida: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Nota
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Nota (opcional)"
                      value={formData.nota}
                      onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Es Perecedero and Estado in same row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Es Perecedero
                    </label>
                    <div className="flex items-center">
                      <button
                        className={`relative w-28 h-8 rounded-full transition-colors duration-200 ${formData.isVencible ? 'bg-green-500' : 'bg-red-500'}`}
                        onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, isVencible: !prev.isVencible }))}
                        disabled={isReadOnly}
                      >
                        <div 
                          className="absolute top-1 left-1 w-20 h-6 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center text-xs font-bold"
                          style={{
                            transform: formData.isVencible ? 'translateX(0)' : 'translateX(28px)',
                            color: formData.isVencible ? '#4CAF50' : '#F44336'
                          }}
                        >
                          {formData.isVencible ? 'Sí' : 'No'}
                        </div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Estado
                    </label>
                    <div className="flex items-center">
                      <button
                        className={`relative w-32 h-8 rounded-full transition-colors duration-200 ${formData.esvendible ? 'bg-green-500' : 'bg-red-500'}`}
                        onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, esvendible: !prev.esvendible }))}
                        disabled={isReadOnly}
                      >
                        <div 
                          className="absolute top-1 left-1 w-24 h-6 bg-white rounded-full shadow-md transition-transform duration-200 flex items-center justify-center text-xs font-bold"
                          style={{
                            transform: formData.esvendible ? 'translateX(0)' : 'translateX(28px)',
                            color: formData.esvendible ? '#4CAF50' : '#F44336'
                          }}
                        >
                          {formData.esvendible ? 'Vendible' : 'No vendible'}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Códigos Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Códigos de los productos
                  </h2>
                  <div className="flex gap-2">
                    {canEditCodes && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={() => setShowScannerModal(true)}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, border: '1px solid' }}
                      onClick={() => setIsCodesExpanded(!isCodesExpanded)}
                    >
                      {isCodesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isCodesExpanded && (
                  <>
                    <div className="space-y-3 mb-4">
                      {formData.codigoList.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: colors.outline }}>
                          No hay códigos agregados
                        </p>
                      ) : (
                        formData.codigoList.map((codigo, index) => (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ backgroundColor: colors.background }}
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                                {codigo.nota ? `${codigo.nota}-${codigo.codigo_barras_ean}` : codigo.codigo_barras_ean}
                              </p>
                            </div>
                            {canEditCodes && (
                              <button
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                onClick={() => handleDeleteCode(index)}
                              >
                                <Trash2 size={16} style={{ color: colors.error }} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Precios Generales Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Precios Generales
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Precio CUP
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Precio CUP"
                      value={formData.precio_cup_general || ''}
                      onChange={(e) => handleGeneralPriceChange('precio_cup_general', e.target.value === '' ? null : parseFloat(e.target.value))}
                      onBlur={handleGeneralPriceBlur}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                      Precio USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Precio USD"
                      value={formData.precio_usd_general || ''}
                      onChange={(e) => handleGeneralPriceChange('precio_usd_general', e.target.value === '' ? null : parseFloat(e.target.value))}
                      onBlur={handleGeneralPriceBlur}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Precios por Tienda Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Precios por Tienda
                  </h2>
                  <div className="flex gap-2">
                    {canEditProduct && (
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
                            ? colors.outlineVariant 
                            : colors.primary,
                          color: formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length 
                            ? colors.outline 
                            : '#fff'
                        }}
                        onClick={handleAddTiendaProducto}
                        disabled={formData.productoTiendaList.filter(item => item.id_tienda !== null).length >= tiendas.filter(t => t.activo === true).length}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, border: '1px solid' }}
                      onClick={() => setIsPricesExpanded(!isPricesExpanded)}
                    >
                      {isPricesExpanded ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                    </button>
                  </div>
                </div>

                {isPricesExpanded && (
                  <>
                    {formData.productoTiendaList.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: colors.outline }}>
                        No hay precios configurados
                      </p>
                    ) : (
                      <div className="space-y-4 mb-4">
                        {formData.productoTiendaList.map((tiendaProducto, index) => {
                          const tienda = tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda);
                          return (
                            <div 
                              key={index}
                              className="p-4 rounded-lg"
                              style={{ backgroundColor: colors.background }}
                            >
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold" style={{ color: colors.onSurface }}>
                                  {tienda?.nombre || `Tienda ${tiendaProducto.id_tienda}`}
                                </h3>
                                {!isReadOnly && (
                                  <button
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                    onClick={() => handleRemoveTiendaProducto(index)}
                                  >
                                    <Trash2 size={16} style={{ color: colors.error }} />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                    Precio CUP
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                    style={{ 
                                      backgroundColor: colors.surface, 
                                      color: colors.onSurface, 
                                      borderColor: colors.outlineVariant
                                    }}
                                    value={tiendaProducto.precio_cup ?? ''}
                                    onChange={(e) => handleTiendaProductoChange(index, 'precio_cup', e.target.value)}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                    Precio USD
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                    style={{ 
                                      backgroundColor: colors.surface, 
                                      color: colors.onSurface, 
                                      borderColor: colors.outlineVariant
                                    }}
                                    value={tiendaProducto.precio_usd ?? ''}
                                    onChange={(e) => handleTiendaProductoChange(index, 'precio_usd', e.target.value)}
                                    disabled={isReadOnly}
                                  />
                                </div>
                                {canViewCosts && (
                                  <>
                                    <div>
                                      <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                        Costo CUP
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                        style={{ 
                                          backgroundColor: colors.surface, 
                                          color: colors.onSurface, 
                                          borderColor: colors.outlineVariant
                                        }}
                                        value={tiendaProducto.costo_cup ?? ''}
                                        onChange={(e) => handleTiendaProductoChange(index, 'costo_cup', e.target.value)}
                                        disabled={isReadOnly}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium mb-1" style={{ color: colors.outline }}>
                                        Costo USD
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                                        style={{ 
                                          backgroundColor: colors.surface, 
                                          color: colors.onSurface, 
                                          borderColor: colors.outlineVariant
                                        }}
                                        value={tiendaProducto.costo_usd ?? ''}
                                        onChange={(e) => handleTiendaProductoChange(index, 'costo_usd', e.target.value)}
                                        disabled={isReadOnly}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface, border: '1px solid', borderColor: colors.outlineVariant }}
                    onClick={() => router.back()}
                  >
                    <XCircle size={18} />
                    <span>Cancelar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Save size={18} />
                        <span>Guardar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Code Modal */}
        {showAddCodeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: colors.surface }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Agregar Código
              </h2>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Código *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Código de barras"
                  value={newCodigo}
                  onChange={(e) => setNewCodigo(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Nota"
                  value={newNota}
                  onChange={(e) => setNewNota(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                  onClick={() => {
                    setShowAddCodeModal(false);
                    setNewCodigo('');
                    setNewNota('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAddCode}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanner Modal */}
        {showScannerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: colors.surface }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Escanear Código
              </h2>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Código de barras
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="Escanear o ingresar código"
                    value={newCodigo}
                    onChange={(e) => setNewCodigo(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="px-3 py-3 rounded-lg flex items-center gap-2 transition-colors hover:opacity-80"
                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                    onClick={handleOpenBarcodeScanner}
                  >
                    <Camera size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                  </button>
                  <button
                    className="px-3 py-3 rounded-lg flex items-center gap-2 transition-colors hover:opacity-80"
                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                    onClick={generateRandomEAN13}
                  >
                    <RefreshCw size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="Nota"
                  value={newNota}
                  onChange={(e) => setNewNota(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                  onClick={() => {
                    setShowScannerModal(false);
                    setNewCodigo('');
                    setNewNota('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAddCode}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-2xl p-6 w-full max-w-md"
              style={{ backgroundColor: colors.surface }}
            >
              <h2 
                className="text-xl font-bold mb-4"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Información de Acciones
              </h2>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? '#1B5E20' : '#E8F5E9' }}
                  >
                    <Package size={20} style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>Agregar Entrada</h3>
                    <p className="text-xs mt-1" style={{ color: colors.outline }}>Registra la entrada de stock al inventario del producto.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? '#0D47A1' : '#E3F2FD' }}
                  >
                    <ArrowRightLeft size={20} style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>Movimiento</h3>
                    <p className="text-xs mt-1" style={{ color: colors.outline }}>Realiza transferencias de stock entre tiendas o almacenes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? '#B71C1C' : '#FFEBEE' }}
                  >
                    <Box size={20} style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>Hacer Salida</h3>
                    <p className="text-xs mt-1" style={{ color: colors.outline }}>Registra la salida de stock del inventario del producto.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: isDarkMode ? '#F57C00' : '#FFF3E0' }}
                  >
                    <ShoppingCart size={20} style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>Vender</h3>
                    <p className="text-xs mt-1" style={{ color: colors.outline }}>Registra una venta del producto reduciendo el stock disponible.</p>
                  </div>
                </div>
              </div>
              <button
                className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                onClick={() => setShowInfoModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
