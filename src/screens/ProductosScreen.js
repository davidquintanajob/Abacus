import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal, Share, Linking } from 'react-native';
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
import { getProductos, getProductoByCodigo, deleteProducto } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import { getApiBaseUrl } from '../services/api';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView } from 'expo-camera';
import * as Camera from 'expo-camera';
import { storageService } from '../services/storageService';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import bwipjs from '@bwip-js/react-native';
import { PDFDocument, rgb } from 'pdf-lib';

const ProductosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' });
  const [tiendas, setTiendas] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTiendaInfoModal, setShowTiendaInfoModal] = useState(false);
  const [showInventoryOptionsModal, setShowInventoryOptionsModal] = useState(false);
  const [showCodesOptionsModal, setShowCodesOptionsModal] = useState(false);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [exportType, setExportType] = useState(null); // 'inventory_excel', 'inventory_pdf', 'barcode', 'qr'
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    nombre: true,
    codigo: false,
    categoria: false,
    precio_cup: false,
    costo_cup: false,
    precio_usd: false,
    costo_usd: false,
    nota: false,
    cantidad: false,
    sufijo: false
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;

  useEffect(() => {
    fetchTiendas();
    loadApiBaseUrl();
  }, []);

  const loadApiBaseUrl = async () => {
    const baseUrl = await getApiBaseUrl();
    setApiBaseUrl(baseUrl);
  };

  // Mostrar toast al entrar en modo offline
  useEffect(() => {
    if (isOfflineMode && !hasShownOfflineToast) {
      showToast({ 
        type: 'warning', 
        message: 'Modo offline activado. Usando datos locales.',
        duration: 4000 
      });
      setHasShownOfflineToast(true);
    } else if (!isOfflineMode) {
      setHasShownOfflineToast(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    React.useCallback(() => {
      fetchProductos();
    }, [pagination.currentPage, filters])
  );

  const fetchTiendas = async () => {
    try {
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      let allTiendas = [];
      
      if (isOfflineMode) {
        // En modo offline, cargar tiendas de AsyncStorage
        allTiendas = await storageService.getTiendas();
      } else {
        // En modo online, cargar tiendas de la API
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      // Always default to user's store if they have one
      if (user?.id_tienda) {
        // If user can view all stores, show all stores in dropdown
        // If user cannot view all stores, show only their store
        if (canViewAllStores) {
          setTiendas(allTiendas);
        } else {
          const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
          setTiendas(userTienda ? [userTienda] : []);
        }
        // Always auto-select the user's store in the filter by default
        setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
      } else {
        setTiendas(allTiendas);
      }
    } catch (err) {
      console.error('Error fetching tiendas:', err);
      if (!isOfflineMode) {
        setTiendas([]);
      }
    }
  };

  const fetchProductos = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Modo offline: usar datos de AsyncStorage
      if (isOfflineMode) {
        const allProductos = await storageService.getProductos();
        
        if (filters.codigo) {
          // Buscar por código específico en el array de códigos
          const filtered = allProductos.filter(p => 
            p.codigos?.some(c => c.codigo_barras_ean?.toLowerCase() === filters.codigo.toLowerCase())
          );
          setProductos(filtered);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: filtered.length });
        } else {
          // Aplicar filtros localmente
          const filteredProductos = await storageService.filterProductosLocal(filters);
          
          // Paginación cliente
          const totalFilteredItems = filteredProductos.length;
          const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
          const startIndex = (pagination.currentPage - 1) * pagination.limit;
          const endIndex = startIndex + pagination.limit;
          const paginatedProductos = filteredProductos.slice(startIndex, endIndex);
          
          setProductos(paginatedProductos);
          setPagination({
            currentPage: pagination.currentPage,
            limit: pagination.limit,
            totalPages: totalFilteredPages,
            totalItems: totalFilteredItems
          });
        }
        setIsLoading(false);
        setIsSearching(false);
        return;
      }

      // Modo online: usar API
      // Si hay código, usar el endpoint específico
      if (filters.codigo) {
        try {
          const producto = await getProductoByCodigo(filters.codigo);
          
          // Apply store visibility permissions
          const userRole = user?.rol?.toLowerCase();
          const canViewAllStores = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && permissions?.dependiente) ||
            (userRole === 'almacenero' && permissions?.almacenero) ||
            (userRole === 'económico' && permissions?.economico);

          // If user cannot view all stores, check if product belongs to their store
          if (!canViewAllStores && user?.id_tienda) {
            const belongsToStore = producto.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
            if (!belongsToStore) {
              setProductos([]);
              setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
              setIsLoading(false);
              setIsSearching(false);
              return;
            }
          }
          
          // Devolver como array con una sola posición para mantener la estructura
          setProductos([producto]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 1 });
        } catch (error) {
          // Si no se encuentra el producto, mostrar lista vacía
          setProductos([]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
        }
      } else {
        // Check if any filters are active
        const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);
        
        // If filters are active, fetch all data to ensure accurate pagination
        // Otherwise, use paginated fetch from backend
        const fetchLimit = hasActiveFilters ? 10000 : pagination.limit;
        const fetchPage = hasActiveFilters ? 1 : pagination.currentPage;
        const data = await getProductos(filters, fetchPage, fetchLimit);
        let productos = data.data || [];

        // Apply store visibility permissions
        const userRole = user?.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // If user cannot view all stores, filter to show only products from their own store
        if (!canViewAllStores && user?.id_tienda) {
          productos = productos.filter(p => {
            // Check if the product belongs to the user's store via tiendas_servicio
            return p.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
          });
        }

        // If filters are active, paginate client-side
        if (hasActiveFilters) {
          const totalFilteredItems = productos.length;
          const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
          const startIndex = (pagination.currentPage - 1) * pagination.limit;
          const endIndex = startIndex + pagination.limit;
          const paginatedProductos = productos.slice(startIndex, endIndex);
          
          setProductos(paginatedProductos);
          setPagination({
            currentPage: pagination.currentPage,
            limit: pagination.limit,
            totalPages: totalFilteredPages,
            totalItems: totalFilteredItems
          });
        } else {
          // No filters active, use backend pagination
          setProductos(productos);
          setPagination(data.pagination || pagination);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching productos:', err);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchProductos();
  };

  const handleClearFilters = () => {
    // Check if user can view all stores
    const userRole = user?.rol?.toLowerCase();
    const canViewAllStores = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && permissions?.dependiente) ||
      (userRole === 'almacenero' && permissions?.almacenero) ||
      (userRole === 'económico' && permissions?.economico);

    // Preserve tienda filter for users without permission
    const clearedFilters = { 
      nombre: '', 
      codigo: '', 
      categoria: '', 
      esvendible: '', 
      id_tienda: (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : '' 
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    // Simply call fetchProductos which handles both online and offline modes correctly
    fetchProductos();
  };

  const handleDelete = (producto) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Producto',
      `¿Estás seguro de que quieres eliminar el producto "${producto.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProducto(producto.id_servicio);
              showToast({ type: 'success', message: 'Producto eliminado correctamente' });
              fetchProductos();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleProductoPress = (producto) => {
    const mode = canEdit ? 'edit' : 'view';
    navigation.navigate('ProductoForm', { producto, mode });
  };

  const handleEdit = (producto) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('ProductoForm', { producto, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('ProductoForm', { mode: 'add' });
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    console.log('Notificaciones');
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleOpenScanner = async () => {
    console.log('handleOpenScanner called');
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    // Clear all fields except tienda before searching by code
    const userRole = user?.rol?.toLowerCase();
    const canViewAllStores = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && permissions?.dependiente) ||
      (userRole === 'almacenero' && permissions?.almacenero) ||
      (userRole === 'económico' && permissions?.economico);

    const clearedFilters = { 
      nombre: '', 
      codigo: data, 
      categoria: '', 
      esvendible: '', 
      id_tienda: (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : filters.id_tienda 
    };
    
    setFilters(clearedFilters);
    setShowScannerModal(false);
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchProductos();
  };

  const handleExport = async () => {
    try {
      setShowFieldSelectionModal(false);
      
      // Get all products for export (ignore pagination)
      let allProductos = [];
      if (isOfflineMode) {
        allProductos = await storageService.getProductos();
      } else {
        const data = await getProductos(filters, 1, 10000);
        allProductos = data.data || [];
      }

      // Apply store filter if needed
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      if (!canViewAllStores && user?.id_tienda) {
        allProductos = allProductos.filter(p => {
          return p.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
        });
      }

      if (exportType === 'inventory_excel') {
        await exportToExcel(allProductos);
      } else if (exportType === 'inventory_pdf') {
        await exportToPDF(allProductos);
      } else if (exportType === 'qr') {
        await exportToQR(allProductos);
      } else if (exportType === 'barcode') {
        await exportToBarcode(allProductos);
      }
    } catch (error) {
      console.error('Error exporting:', error);
      showToast({ type: 'error', message: 'Error al exportar: ' + error.message });
    }
  };

  const showExportSuccessAlert = (fileUri, fileName) => {
    Alert.alert(
      'Documento Exportado',
      `Guardado en: ${fileUri}`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Ver',
          onPress: async () => {
            try {
              // Use Sharing.shareAsync with dialog to open file with system picker
              const isAvailable = await Sharing.isAvailableAsync();
              if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                  mimeType: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
                  dialogTitle: 'Abrir documento',
                  UTI: fileName.endsWith('.xlsx') ? 'com.microsoft.excel.xls' : 'com.adobe.pdf',
                });
              } else {
                showToast({ type: 'error', message: 'No se puede abrir archivos en este dispositivo' });
              }
            } catch (error) {
              console.error('Error opening file:', error);
              showToast({ type: 'error', message: 'Error al abrir el archivo: ' + error.message });
            }
          },
        },
        {
          text: 'Compartir',
          onPress: async () => {
            try {
              const isAvailable = await Sharing.isAvailableAsync();
              if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                  mimeType: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
                  dialogTitle: 'Compartir documento',
                });
              } else {
                showToast({ type: 'error', message: 'Compartir no está disponible en este dispositivo' });
              }
            } catch (error) {
              console.error('Error sharing file:', error);
              showToast({ type: 'error', message: 'Error al compartir el archivo' });
            }
          },
        },
      ]
    );
  };

  const exportToExcel = async (productos) => {
    try {
      // Prepare data based on selected fields
      const data = productos.map(producto => {
        const row = {};
        if (selectedFields.nombre) row['Nombre'] = producto.nombre;
        if (selectedFields.codigo) row['Código'] = producto.codigos?.[0]?.codigo_barras_ean || 'N/A';
        if (selectedFields.categoria) row['Categoría'] = producto.categoria || 'N/A';
        if (selectedFields.precio_cup) row['Precio (CUP)'] = getProductPrice(producto);
        if (selectedFields.costo_cup) row['Costo (CUP)'] = getProductCost(producto);
        if (selectedFields.precio_usd) row['Precio (USD)'] = getProductPriceUSD(producto);
        if (selectedFields.costo_usd) row['Costo (USD)'] = getProductCostUSD(producto);
        if (selectedFields.nota) row['Nota'] = producto.producto?.nota || 'N/A';
        if (selectedFields.cantidad) row['Cantidad'] = calculateTotalQuantity(producto);
        if (selectedFields.sufijo) row['Sufijo'] = producto.producto?.sufijo || 'N/A';
        return row;
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

      // Generate file
      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      // Save file (using FileSystem)
      const fileName = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      showExportSuccessAlert(fileUri, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  };

  const exportToPDF = async (productos) => {
    try {
      // Prepare HTML content based on selected fields
      let tableRows = '';
      
      // Table header
      let tableHeader = '<tr style="background-color: #f0f0f0;">';
      if (selectedFields.nombre) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Nombre</th>';
      if (selectedFields.codigo) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Código</th>';
      if (selectedFields.categoria) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Categoría</th>';
      if (selectedFields.precio_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Precio (CUP)</th>';
      if (selectedFields.costo_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo (CUP)</th>';
      if (selectedFields.precio_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Precio (USD)</th>';
      if (selectedFields.costo_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo (USD)</th>';
      if (selectedFields.nota) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Nota</th>';
      if (selectedFields.cantidad) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Cantidad</th>';
      if (selectedFields.sufijo) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Sufijo</th>';
      tableHeader += '</tr>';

      // Table rows
      productos.forEach(producto => {
        tableRows += '<tr>';
        if (selectedFields.nombre) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.nombre}</td>`;
        if (selectedFields.codigo) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.codigos?.[0]?.codigo_barras_ean || 'N/A'}</td>`;
        if (selectedFields.categoria) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.categoria || 'N/A'}</td>`;
        if (selectedFields.precio_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${getProductPrice(producto)}</td>`;
        if (selectedFields.costo_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${getProductCost(producto)}</td>`;
        if (selectedFields.precio_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${getProductPriceUSD(producto)}</td>`;
        if (selectedFields.costo_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${getProductCostUSD(producto)}</td>`;
        if (selectedFields.nota) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.producto?.nota || 'N/A'}</td>`;
        if (selectedFields.cantidad) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${calculateTotalQuantity(producto)}</td>`;
        if (selectedFields.sufijo) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.producto?.sufijo || 'N/A'}</td>`;
        tableRows += '</tr>';
      });

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; color: #002440; margin-bottom: 10px; }
              p { text-align: center; color: #0b1c30; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th { 
                background-color: #002440; 
                color: #ffffff; 
                border: 1px solid #002440; 
                padding: 12px 8px; 
                text-align: left; 
                font-weight: bold;
              }
              td { 
                border: 1px solid #d3e4fe; 
                padding: 8px; 
                text-align: left; 
                color: #0b1c30;
              }
              tr:nth-child(even) { background-color: #f8f9ff; }
              tr:nth-child(odd) { background-color: #ffffff; }
            </style>
          </head>
          <body>
            <h1>Inventario de Productos</h1>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
            <table>
              ${tableHeader}
              ${tableRows}
            </table>
          </body>
        </html>
      `;

      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Rename the file
      const fileName = `inventario_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });

      showExportSuccessAlert(newUri, fileName);
    } catch (error) {
      console.error('Error exporting to HTML:', error);
      throw error;
    }
  };

  const exportToQR = async (productos) => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Define page size (A4)
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      
      // Grid settings (4x3 for 8.5 x 11 inch paper)
      const cols = 4;
      const rows = 3;
      const margin = 20;
      const cellWidth = (pageWidth - margin * 5) / cols;
      const cellHeight = 220;
      
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let colIndex = 0;
      let rowIndex = 0;
      
      for (const producto of productos) {
        // Prepare data for QR code based on selected fields
        const qrData = {};
        if (selectedFields.nombre) qrData.nombre = producto.nombre;
        if (selectedFields.codigo) qrData.codigo = producto.codigos?.[0]?.codigo_barras_ean || 'N/A';
        if (selectedFields.categoria) qrData.categoria = producto.categoria || 'N/A';
        if (selectedFields.precio_cup) qrData.precio_cup = getProductPrice(producto);
        if (selectedFields.costo_cup) qrData.costo_cup = getProductCost(producto);
        if (selectedFields.precio_usd) qrData.precio_usd = getProductPriceUSD(producto);
        if (selectedFields.costo_usd) qrData.costo_usd = getProductCostUSD(producto);
        if (selectedFields.nota) qrData.nota = producto.producto?.nota || 'N/A';
        if (selectedFields.cantidad) qrData.cantidad = calculateTotalQuantity(producto);
        if (selectedFields.sufijo) qrData.sufijo = producto.producto?.sufijo || 'N/A';
        
        const qrString = JSON.stringify(qrData);
        
        // Generate QR code as PNG using bwip-js
        const qrResult = await bwipjs.toDataURL({
          bcid: 'qrcode',
          text: qrString,
          scale: 4,
          height: 10,
          includetext: false,
          eclevel: 'H',
          rotate: 'N',
        });
        
        // Embed QR image in PDF
        const qrImage = await pdfDoc.embedPng(qrResult.uri);
        
        // Calculate position in grid
        const x = margin + colIndex * (cellWidth + margin);
        const y = pageHeight - margin - (rowIndex + 1) * cellHeight;
        
        // Draw rectangle around the cell
        currentPage.drawRectangle({
          x: x,
          y: y,
          width: cellWidth,
          height: cellHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        
        // Draw QR code (smaller size)
        const qrSize = Math.min(cellWidth, cellHeight) * 0.35;
        const qrX = x + (cellWidth - qrSize) / 2;
        const qrY = y + cellHeight - qrSize - 10;
        
        currentPage.drawImage(qrImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        });
        
        // Draw product info text (larger font, centered)
        const font = await pdfDoc.embedFont('Helvetica');
        const fontSize = 10;
        let textY = qrY - 20;
        
        const textLines = [];
        if (selectedFields.nombre) textLines.push(`Nombre: ${producto.nombre}`);
        if (selectedFields.codigo) textLines.push(`Código: ${producto.codigos?.[0]?.codigo_barras_ean || 'N/A'}`);
        if (selectedFields.categoria) textLines.push(`Categoría: ${producto.categoria || 'N/A'}`);
        if (selectedFields.precio_cup) textLines.push(`Precio: ${getProductPrice(producto)}`);
        if (selectedFields.costo_cup) textLines.push(`Costo: ${getProductCost(producto)}`);
        if (selectedFields.precio_usd) textLines.push(`Precio USD: ${getProductPriceUSD(producto)}`);
        if (selectedFields.costo_usd) textLines.push(`Costo USD: ${getProductCostUSD(producto)}`);
        if (selectedFields.nota) textLines.push(`Nota: ${producto.producto?.nota || 'N/A'}`);
        if (selectedFields.cantidad) textLines.push(`Cantidad: ${calculateTotalQuantity(producto)}`);
        if (selectedFields.sufijo) textLines.push(`Sufijo: ${producto.producto?.sufijo || 'N/A'}`);
        
        for (const line of textLines) {
          const textWidth = font.widthOfTextAtSize(line, fontSize);
          const textX = x + (cellWidth - textWidth) / 2;
          currentPage.drawText(line, {
            x: textX,
            y: textY,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          });
          textY -= fontSize + 2;
          // Stop if text would go outside the rectangle
          if (textY < y + 5) break;
        }
        
        // Move to next grid cell
        colIndex++;
        if (colIndex >= cols) {
          colIndex = 0;
          rowIndex++;
          if (rowIndex >= rows) {
            rowIndex = 0;
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          }
        }
      }
      
      // Save PDF to bytes
      const pdfBytes = await pdfDoc.save();
      
      // Convert to base64 using React Native compatible method
      const pdfBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pdfBytes)));
      const fileName = `codigos_qr_${new Date().toISOString().split('T')[0]}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      showExportSuccessAlert(fileUri, fileName);
    } catch (error) {
      console.error('Error exporting QR codes:', error);
      throw error;
    }
  };

  const exportToBarcode = async (productos) => {
    try {
      // Create HTML with real barcodes for each product
      let barcodeContent = '';
      
      for (const producto of productos) {
        const codigo = producto.codigos?.[0]?.codigo_barras_ean || 'N/A';
        
        // Generate barcode as base64 image using bwip-js
        let barcodeImageBase64 = '';
        if (codigo !== 'N/A') {
          try {
            // Use bwip-js to generate barcode as data URL
            const barcodeResult = await bwipjs.toDataURL({
              bcid: 'code128',     // Barcode type (accepts any length)
              text: codigo,        // Text to encode
              scale: 3,             // Reduced scale for smaller barcode
              height: 10,           // Reduced bar height
              includetext: true,    // Show human-readable text
              textxalign: 'center', // Text alignment
              textsize: 10,         // Text size
            });
            
            // Extract the data URI from the result
            barcodeImageBase64 = barcodeResult.uri;
          } catch (error) {
            console.error('Error generating barcode:', error);
            // Fallback to simple pattern if barcode generation fails
            const barcodePattern = generateSimpleBarcode(codigo);
            barcodeImageBase64 = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="50" font-family="monospace" font-size="8">${barcodePattern}</text><text x="10" y="90" font-size="10">${codigo}</text></svg>`)}`;
          }
        }
        
        // Prepare product info display
        let productInfo = '';
        if (selectedFields.nombre) productInfo += `<p><strong>Nombre:</strong> ${producto.nombre}</p>`;
        if (selectedFields.codigo) productInfo += `<p><strong>Código:</strong> ${codigo}</p>`;
        if (selectedFields.categoria) productInfo += `<p><strong>Categoría:</strong> ${producto.categoria || 'N/A'}</p>`;
        if (selectedFields.precio_cup) productInfo += `<p><strong>Precio (CUP):</strong> ${getProductPrice(producto)}</p>`;
        if (selectedFields.costo_cup) productInfo += `<p><strong>Costo (CUP):</strong> ${getProductCost(producto)}</p>`;
        if (selectedFields.precio_usd) productInfo += `<p><strong>Precio (USD):</strong> ${getProductPriceUSD(producto)}</p>`;
        if (selectedFields.costo_usd) productInfo += `<p><strong>Costo (USD):</strong> ${getProductCostUSD(producto)}</p>`;
        if (selectedFields.nota) productInfo += `<p><strong>Nota:</strong> ${producto.producto?.nota || 'N/A'}</p>`;
        if (selectedFields.cantidad) productInfo += `<p><strong>Cantidad:</strong> ${calculateTotalQuantity(producto)}</p>`;
        if (selectedFields.sufijo) productInfo += `<p><strong>Sufijo:</strong> ${producto.producto?.sufijo || 'N/A'}</p>`;

        barcodeContent += `
          <div class="barcode-item">
            <img class="barcode-image" src="${barcodeImageBase64}" />
            <div class="product-info">
              ${productInfo}
            </div>
          </div>
        `;
      }

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
              .barcode-container { 
                display: grid; 
                grid-template-columns: repeat(4, 1fr); 
                gap: 15px; 
                width: 100%;
              }
              .barcode-item {
                border: 1px solid #ddd; 
                padding: 10px; 
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .barcode-image {
                width: 100%;
                max-width: 150px;
                height: auto;
                margin-bottom: 8px;
              }
              .product-info {
                font-size: 12px;
                text-align: center;
                width: 100%;
              }
              .product-info p {
                margin: 3px 0;
              }
              @media print {
                .barcode-container { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <h1 style="text-align: center;">Códigos de Barra de Productos</h1>
            <p style="text-align: center;">Fecha: ${new Date().toLocaleDateString()}</p>
            <div class="barcode-container">
              ${barcodeContent}
            </div>
          </body>
        </html>
      `;

      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Rename the file
      const fileName = `codigos_barra_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });

      showExportSuccessAlert(newUri, fileName);
    } catch (error) {
      console.error('Error exporting barcodes:', error);
      throw error;
    }
  };

  const generateSimpleBarcode = (code) => {
    // Simple barcode pattern generator for offline use
    // This creates a visual representation that looks like a barcode
    if (!code || code === 'N/A') return '||||||||||||||||||||||||||||';
    
    let pattern = '';
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      // Generate a pattern based on the character
      for (let j = 0; j < 5; j++) {
        pattern += (charCode + j) % 2 === 0 ? '|' : ' ';
      }
    }
    return pattern;
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  // Check if user can view all stores
  const userRole = user?.rol?.toLowerCase();
  const canViewAllStores = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && permissions?.dependiente) ||
    (userRole === 'almacenero' && permissions?.almacenero) ||
    (userRole === 'económico' && permissions?.economico);

  // Calculate total quantity for a product
  const calculateTotalQuantity = (producto) => {
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show quantity for specific store (if user has permission to view it)
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.cantidad || 0;
    } else {
      // Show sum of all visible stores
      return visibleTiendasServicio.reduce((sum, ts) => sum + (ts.cantidad || 0), 0);
    }
  };

  // Get price for a product based on user permissions
  const getProductPrice = (producto) => {
    // First try to get general price from producto.producto
    if (producto.producto?.precio_cup !== null && producto.producto?.precio_cup !== undefined) {
      return producto.producto.precio_cup;
    }

    // If no general price, get from tiendas_servicio based on permissions
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show price for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_cup || 0;
    } else {
      // Show price from first visible store (or could use average/sum depending on business logic)
      return visibleTiendasServicio[0]?.precio_cup || 0;
    }
  };

  // Get cost for a product based on user permissions
  const getProductCost = (producto) => {
    // First try to get general cost from producto.producto
    if (producto.producto?.costo_cup !== null && producto.producto?.costo_cup !== undefined) {
      return producto.producto.costo_cup;
    }

    // If no general cost, get from tiendas_servicio based on permissions
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show cost for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.costo_cup || 0;
    } else {
      // Show cost from first visible store (or could use average/sum depending on business logic)
      return visibleTiendasServicio[0]?.costo_cup || 0;
    }
  };

  // Get price in USD for a product based on user permissions
  const getProductPriceUSD = (producto) => {
    // First try to get general price from producto.producto
    if (producto.producto?.precio_usd !== null && producto.producto?.precio_usd !== undefined) {
      return producto.producto.precio_usd;
    }

    // If no general price, get from tiendas_servicio based on permissions
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show price for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_usd || 0;
    } else {
      // Show price from first visible store (or could use average/sum depending on business logic)
      return visibleTiendasServicio[0]?.precio_usd || 0;
    }
  };

  // Get cost in USD for a product based on user permissions
  const getProductCostUSD = (producto) => {
    // First try to get general cost from producto.producto
    if (producto.producto?.costo_usd !== null && producto.producto?.costo_usd !== undefined) {
      return producto.producto.costo_usd;
    }

    // If no general cost, get from tiendas_servicio based on permissions
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show cost for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.costo_usd || 0;
    } else {
      // Show cost from first visible store (or could use average/sum depending on business logic)
      return visibleTiendasServicio[0]?.costo_usd || 0;
    }
  };

  // Function to wrap text by words, not cutting words in the middle
  const wrapTextByWords = (text, maxCharsPerLine) => {
    if (text.length <= maxCharsPerLine) {
      return text;
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

  const styles = createStyles(responsive);

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
        onThemePress={toggleTheme}
        onSettingsPress={handleSettingsPress}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Productos</Text>
        </View>

        {/* Filter Section */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Ionicons 
                name={showAdvancedFilters ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre: text }))}
            />
          </View>

          <View style={styles.filterGroup}>
            <View style={styles.filterLabelRow}>
              <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => setShowTiendaInfoModal(true)}
              >
                <Ionicons name="information-circle-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllStores) {
                  setShowTiendaDropdown(!showTiendaDropdown);
                }
              }}
            >
              <Text style={[styles.dropdownText, { color: filters.id_tienda ? colors.onSurface : colors.outline }]}>
                {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
              </Text>
              <Ionicons 
                name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(20)} 
                color={colors.outline} 
              />
            </TouchableOpacity>
            
            {showTiendaDropdown && (
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
                {canViewAllStores && (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFilters(prev => ({ ...prev, id_tienda: '' }));
                      setShowTiendaDropdown(false);
                      setTiendaSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchProductos();
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                  </TouchableOpacity>
                )}
                {filteredTiendas.length > 0 ? (
                  filteredTiendas.map((tienda, index) => (
                    <TouchableOpacity
                      key={tienda.id_tienda}
                      style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchProductos();
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.dropdownItem}>
                    <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Código</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <TextInput
                    style={[styles.inputWithIconText, { color: colors.onSurface }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar por código de barras..."
                    value={filters.codigo}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, codigo: text }))}
                  />
                  <TouchableOpacity
                    onPress={handleOpenScanner}
                    style={styles.cameraButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="camera-outline" 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.primary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Categoría</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por categoría..."
                  value={filters.categoria}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, categoria: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                <View style={styles.statusFilterSwitches}>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: '' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === '' ? '#9E9E9E' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === '' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === '' ? '#9E9E9E' : '#9E9E9E' }
                        ]}>
                          Todos
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: 'true' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === 'true' ? '#4CAF50' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === 'true' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === 'true' ? '#4CAF50' : '#9E9E9E' }
                        ]}>
                          Vendible
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: 'false' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === 'false' ? '#F44336' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === 'false' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === 'false' ? '#F44336' : '#9E9E9E' }
                        ]}>
                          No vendible
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, styles.clearButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              onPress={handleClearFilters}
            >
              <Ionicons name="refresh-outline" size={responsive.responsiveWidth(18)} color={colors.onSurface} />
              <Text style={[styles.filterButtonText, { color: colors.onSurface }]}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search-outline" size={responsive.responsiveWidth(18)} color="#fff" />
                  <Text style={[styles.filterButtonText, { color: '#fff' }]}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {isAdmin && !isOfflineMode && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Agregar Producto</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowExportModal(true)}
          >
            <Ionicons name="download-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Exportar Datos</Text>
          </TouchableOpacity>
        </View>

        {/* Productos List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando productos...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchProductos}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : productos.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron productos
            </Text>
          </Card>
        ) : (
          <>
            {productos.map((producto) => {
              const totalQuantity = calculateTotalQuantity(producto);
              const productImage = producto.producto?.imagen;
              const fullImageUrl = productImage && apiBaseUrl ? `${apiBaseUrl}${productImage}` : productImage;

              return (
                <TouchableOpacity
                  key={producto.id_servicio}
                  onPress={() => handleProductoPress(producto)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.productoCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.productoImageContainer}>
                      {fullImageUrl ? (
                        <Image
                          source={{ uri: fullImageUrl }}
                          style={styles.productoImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.productoImage, styles.productoImagePlaceholder, { backgroundColor: colors.surfaceVariant }]}>
                          <Ionicons name="cube-outline" size={responsive.responsiveWidth(30)} color={colors.outline} />
                        </View>
                      )}
                    </View>
                    <View style={styles.productoInfo}>
                      <View style={styles.productoHeader}>
                        <Text style={[styles.productoName, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {wrapTextByWords(producto.nombre, 10)}
                      </Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: producto.esvendible ? '#E8F5E9' : '#FFEBEE' }
                        ]}>
                          <Text style={[styles.statusText, { color: producto.esvendible ? '#2E7D32' : '#C62828' }]}>
                            {producto.esvendible ? 'Vendible' : 'No vendible'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.productoDetails, { color: colors.outline }]}>Categoría: {producto.categoria}</Text>
                      <Text style={[styles.productoDetails, { color: colors.outline }]}>Sufijo: {producto.producto?.sufijo || 'N/A'}</Text>
                      <Text style={[styles.productoQuantity, { color: colors.primary }]}>
                        Cantidad: {totalQuantity}
                      </Text>
                    </View>
                    {canEdit && (
                      <View style={styles.productoActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(producto);
                          }}
                        >
                          <Image
                            source={require('../../assets/editar.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(producto);
                          }}
                        >
                          <Image
                            source={require('../../assets/basura.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.surface, opacity: pagination.currentPage === 1 ? 0.5 : 1 }
                  ]}
                  onPress={handlePrevPage}
                  disabled={pagination.currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
                <View style={styles.paginationInfo}>
                  <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </Text>
                  <Text style={[styles.paginationText, styles.paginationSubtext, { color: colors.outline }]}>
                    Total de productos: {pagination.totalItems}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.surface, opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1 }
                  ]}
                  onPress={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute="Productos"
      />

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
                style={styles.scannerCloseButton}
                onPress={() => setShowScannerModal(false)}
              >
                <Ionicons name="close" size={responsive.responsiveWidth(30)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <Modal
          visible={showExportModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowExportModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowExportModal(false)}
          >
            <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Exportar Datos</Text>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowExportModal(false);
                  setShowInventoryOptionsModal(true);
                }}
              >
                <Ionicons name="cube-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Exportar Inventario</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowExportModal(false);
                  setShowCodesOptionsModal(true);
                }}
              >
                <Ionicons name="qr-code-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Exportar Códigos</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Inventory Options Modal */}
      {showInventoryOptionsModal && (
        <Modal
          visible={showInventoryOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowInventoryOptionsModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowInventoryOptionsModal(false)}
          >
            <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Exportar Inventario</Text>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowInventoryOptionsModal(false);
                  setExportType('inventory_excel');
                  setShowFieldSelectionModal(true);
                }}
              >
                <Ionicons name="document-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Inventario en Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowInventoryOptionsModal(false);
                  setExportType('inventory_pdf');
                  setShowFieldSelectionModal(true);
                }}
              >
                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Inventario en PDF</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Codes Options Modal */}
      {showCodesOptionsModal && (
        <Modal
          visible={showCodesOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCodesOptionsModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCodesOptionsModal(false)}
          >
            <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Exportar Códigos</Text>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowCodesOptionsModal(false);
                  setExportType('barcode');
                  setShowFieldSelectionModal(true);
                }}
              >
                <Ionicons name="barcode-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Código de Barra</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowCodesOptionsModal(false);
                  setExportType('qr');
                  setShowFieldSelectionModal(true);
                }}
              >
                <Ionicons name="qr-code-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Código QR</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <Modal
          visible={showFieldSelectionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFieldSelectionModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFieldSelectionModal(false)}
          >
            <View style={[styles.fieldSelectionModal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Seleccionar Campos</Text>
              <ScrollView style={styles.fieldSelectionScroll}>
                {Object.keys(selectedFields).map((field) => (
                  <TouchableOpacity
                    key={field}
                    style={[styles.fieldSelectionItem, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }))}
                  >
                    <View style={[styles.checkbox, { borderColor: colors.outlineVariant, backgroundColor: selectedFields[field] ? colors.primary : 'transparent' }]}>
                      {selectedFields[field] && (
                        <Ionicons name="checkmark" size={responsive.responsiveWidth(16)} color="#fff" />
                      )}
                    </View>
                    <Text style={[styles.fieldSelectionText, { color: colors.onSurface }]}>
                      {field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.exportConfirmButton, { backgroundColor: colors.primary }]}
                onPress={handleExport}
              >
                <Text style={[styles.exportConfirmButtonText, { color: '#fff' }]}>Generar Exportación</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Tienda Info Modal */}
      {showTiendaInfoModal && (
        <Modal
          visible={showTiendaInfoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTiendaInfoModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowTiendaInfoModal(false)}
          >
            <View style={[styles.infoModal, { backgroundColor: colors.surface }]}>
              <View style={styles.infoModalHeader}>
                <Ionicons name="information-circle" size={responsive.responsiveWidth(28)} color={colors.primary} />
                <Text style={[styles.infoModalTitle, { color: colors.onSurface }]}>Información de Tienda</Text>
              </View>
              <Text style={[styles.infoModalText, { color: colors.onSurface }]}>
                Cuando seleccionas una tienda específica, la cantidad mostrada será la existencia en esa tienda. Si no seleccionas ninguna tienda, se mostrará la sumatoria de todas las existencias en todas las tiendas.
              </Text>
              <TouchableOpacity
                style={[styles.infoModalButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowTiendaInfoModal(false)}
              >
                <Text style={[styles.infoModalButtonText, { color: '#fff' }]}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const ProductosScreen = () => <ProductosContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: responsive.headerHeight,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(5),
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  filterCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoButton: {
    padding: 4,
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
  filterActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  clearButton: {
    borderWidth: 1,
  },
  searchButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
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
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  retryButton: {
    marginTop: responsive.responsiveMargin(16),
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  productoCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productoImageContainer: {
    marginRight: responsive.responsiveMargin(12),
  },
  productoImage: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveHeight(50),
    borderRadius: responsive.responsiveWidth(25),
  },
  productoImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productoInfo: {
    flex: 1,
  },
  productoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  productoName: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  statusBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 9999,
  },
  statusText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  productoDetails: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  productoQuantity: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  productoActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  actionButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSmall: {
    width: responsive.responsiveWidth(22),
    height: responsive.responsiveHeight(22),
  },
  editButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
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
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  statusFilterSwitches: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  statusFilterItem: {
    flex: 1,
  },
  statusFilterSwitch: {
    height: responsive.responsiveHeight(36),
    borderRadius: 18,
    padding: 3,
    width: '100%',
  },
  statusFilterKnob: {
    width: responsive.responsiveWidth(55),
    height: responsive.responsiveHeight(30),
    borderRadius: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFilterText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  paginationButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  paginationSubtext: {
    fontSize: responsive.fontSizes.bodySmall,
    marginTop: responsive.responsiveMargin(2),
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
    borderRadius: responsive.responsiveWidth(20),
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '80%',
    maxWidth: responsive.responsiveWidth(400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  exportModalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(20),
    textAlign: 'center',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(12),
  },
  exportOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  infoModal: {
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
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  infoModalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  infoModalText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.5,
    marginBottom: responsive.responsiveMargin(20),
  },
  infoModalButton: {
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(24),
    borderRadius: 8,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  fieldSelectionModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '85%',
    maxWidth: responsive.responsiveWidth(400),
    maxHeight: responsive.responsiveHeight(500),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  fieldSelectionScroll: {
    maxHeight: responsive.responsiveHeight(300),
    marginBottom: responsive.responsiveMargin(16),
  },
  fieldSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
  },
  checkbox: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldSelectionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  exportConfirmButton: {
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(24),
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exportConfirmButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
