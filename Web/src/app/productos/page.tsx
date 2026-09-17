'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getProductos, deleteProducto } from '../../services/productoService';
import { getTiendas } from '../../services/tiendaService';
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Grid,
  List,
  AlertCircle,
  Download,
  X,
  Box,
  QrCode,
  FileText,
  Barcode
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export default function ProductosPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  // Reset navigation loading state when page loads
  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [productos, setProductos] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '', cantidad_min: '0.01', cantidad_max: '' });
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [showTiendaInfoModal, setShowTiendaInfoModal] = useState(false);
  const [showInventoryOptionsModal, setShowInventoryOptionsModal] = useState(false);
  const [showCodesOptionsModal, setShowCodesOptionsModal] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [exportType, setExportType] = useState<'inventory_excel' | 'inventory_pdf' | 'qr' | 'barcode' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    nombre: true,
    codigo_qr_barra: false,
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
  const [tiendas, setTiendas] = useState<any[]>([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;
  const permissions = user?.permissions || {};

  const canViewAllStores = 
    isAdmin ||
    (user?.rol?.toLowerCase() === 'dependiente' && permissions?.dependiente) ||
    (user?.rol?.toLowerCase() === 'almacenero' && permissions?.almacenero) ||
    (user?.rol?.toLowerCase() === 'económico' && permissions?.economico);

  useEffect(() => {
    // Use API URL from environment or config service
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    setApiBaseUrl(apiUrl.replace('/api', ''));
  }, []);

  // Initialize user's store from session data immediately
  useEffect(() => {
    if (user?.id_tienda) {
      const userTienda = {
        id_tienda: user.id_tienda,
        nombre: user.tienda?.nombre || `Tienda ${user.id_tienda}`
      };
      setTiendas([userTienda]);
      setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
      setUserTiendaReady(true);
      setIsInitialized(true);
    }
  }, [user?.id_tienda]);

  // Single API call when all data is ready
  useEffect(() => {
    if (userTiendaReady) {
      fetchProductos();
    }
  }, [userTiendaReady]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (isInitialized) {
      fetchProductos();
    }
  }, [pagination.currentPage]);


  const fetchTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      let allTiendas = [];
      
      if (canViewAllStores) {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      } else if (user?.id_tienda) {
        // Only show user's store
        allTiendas = tiendas.filter(t => t.id_tienda === user.id_tienda);
      }
      
      setTiendas(allTiendas);
      setHasLoadedAllTiendas(true);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchProductos = async (overrideIdTienda = null) => {
    try {
      setIsLoading(true);
      setError(null);

      const apiFilters = { ...filters };
      if (overrideIdTienda !== null) {
        apiFilters.id_tienda = overrideIdTienda;
      }

      const data = await getProductos(apiFilters, pagination.currentPage, pagination.limit);
      let productos = data.data || [];

      // Apply store visibility permissions
      if (!canViewAllStores && user?.id_tienda) {
        productos = productos.filter((p: any) => {
          return p.tiendas_servicio?.some((ts: any) => ts.id_tienda === user.id_tienda);
        });
      }

      setProductos(productos);
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchProductos(null);
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      nombre: '', 
      codigo: '', 
      categoria: '', 
      esvendible: '', 
      id_tienda: (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : '',
      cantidad_min: '0.01', 
      cantidad_max: '' 
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    const overrideIdTienda = (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : null;
    fetchProductos(overrideIdTienda);
  };

  const handleDelete = (producto: any) => {
    showConfirmDialog({
      title: 'Eliminar Producto',
      message: `¿Estás seguro de que quieres eliminar el producto "${producto.nombre}"?`,
      onConfirm: () => {
        deleteProducto(producto.id_producto)
          .then(() => {
            showToast({ type: 'success', message: 'Producto eliminado correctamente' });
            fetchProductos();
          })
          .catch((err: any) => {
            showToast({ type: 'error', message: err.message, code: err.code });
          });
      },
      type: 'danger'
    });
  };

  const handleProductoPress = (producto: any) => {
    const mode = canEdit ? 'edit' : 'view';
    router.push(`/productos/form?id=${producto.id_servicio}&mode=${mode}`);
  };

  const handleEdit = (producto: any, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/productos/form?id=${producto.id_servicio}&mode=edit`);
  };

  const handleAdd = () => {
    router.push('/productos/form?mode=add');
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

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    router.push('/profile');
  };

  const handleExportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Get all products for export (ignore pagination)
      const data = await getProductos(filters, 1, 10000);
      const allProductos = data.data || [];

      if (allProductos.length === 0) {
        showToast({ type: 'warning', message: 'No hay productos para exportar' });
        return;
      }

      // Build headers based on selected fields
      const headers = [];
      if (selectedFields.nombre) headers.push('Nombre');
      if (selectedFields.categoria) headers.push('Categoría');
      if (selectedFields.sufijo) headers.push('Sufijo');
      if (selectedFields.codigo) headers.push('Códigos');
      if (selectedFields.precio_cup) headers.push('Precio CUP');
      if (selectedFields.precio_usd) headers.push('Precio USD');
      if (selectedFields.costo_cup) headers.push('Costo CUP');
      if (selectedFields.costo_usd) headers.push('Costo USD');
      if (selectedFields.nota) headers.push('Nota');

      const csvContent = [
        headers.join(','),
        ...allProductos.map((producto: any) => {
          const row = [];
          if (selectedFields.nombre) row.push(`"${producto.nombre || ''}"`);
          if (selectedFields.categoria) row.push(`"${producto.categoria || ''}"`);
          if (selectedFields.sufijo) row.push(`"${producto.producto?.sufijo || producto.sufijo || ''}"`);
          if (selectedFields.codigo) row.push(`"${producto.codigos?.map((c: any) => c.codigo_barras_ean).join('; ') || ''}"`);
          if (selectedFields.precio_cup) row.push(parseFloat(getProductPrice(producto)).toFixed(2));
          if (selectedFields.precio_usd) row.push(parseFloat(getProductPriceUSD(producto)).toFixed(2));
          if (selectedFields.costo_cup) row.push(parseFloat(getProductCost(producto)).toFixed(2));
          if (selectedFields.costo_usd) row.push(parseFloat(getProductCostUSD(producto)).toFixed(2));
          if (selectedFields.nota) row.push(`"${producto.nota || ''}"`);
          return row.join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({ type: 'success', message: 'Productos exportados correctamente' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al exportar: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportTypeSelect = (type: 'inventory_excel' | 'inventory_pdf' | 'qr' | 'barcode') => {
    setExportType(type);
    setShowExportModal(false);
    setShowFieldSelectionModal(true);
  };

  const handleExportToPDF = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all products for export
      const allData = await getProductos(filters, 1, 10000);
      const allProductos = allData.data || [];
      
      if (allProductos.length === 0) {
        showToast({ type: 'warning', message: 'No hay productos para exportar' });
        return;
      }

      // Check if prices differ across stores
      const hasDifferentPrices = hasDifferentPricesAcrossStores(allProductos);

      // Build table header (main table - like APK)
      let tableHeader = '<tr style="background-color: #002440;">';
      if (selectedFields.nombre) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Nombre</th>';
      if (selectedFields.categoria) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Categoría</th>';
      if (!hasDifferentPrices || filters.id_tienda) {
        if (selectedFields.precio_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Precio (CUP)</th>';
        if (selectedFields.costo_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Costo (CUP)</th>';
        if (selectedFields.precio_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Precio (USD)</th>';
        if (selectedFields.costo_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Costo (USD)</th>';
      }
      if (selectedFields.sufijo) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px; color: white;">Sufijo</th>';
      tableHeader += '</tr>';

      // Table rows (main table)
      let tableRows = '';
      allProductos.forEach((producto: any) => {
        tableRows += '<tr>';
        if (selectedFields.nombre) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.nombre}</td>`;
        if (selectedFields.categoria) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.categoria || 'N/A'}</td>`;
        if (!hasDifferentPrices || filters.id_tienda) {
          if (selectedFields.precio_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(getProductPrice(producto)).toFixed(2)}</td>`;
          if (selectedFields.costo_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(getProductCost(producto)).toFixed(2)}</td>`;
          if (selectedFields.precio_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(getProductPriceUSD(producto)).toFixed(2)}</td>`;
          if (selectedFields.costo_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(getProductCostUSD(producto)).toFixed(2)}</td>`;
        }
        if (selectedFields.sufijo) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.producto?.sufijo || producto.sufijo || 'N/A'}</td>`;
        tableRows += '</tr>';
      });

      // Generate quantity breakdown table if cantidad is selected
      let quantityBreakdownSection = '';
      if (selectedFields.cantidad) {
        let visibleTiendas = tiendas;
        if (!canViewAllStores && user?.id_tienda) {
          visibleTiendas = tiendas.filter(t => t.id_tienda === user.id_tienda);
        }

        let breakdownHeader = '<tr style="background-color: #f0f0f0;">';
        breakdownHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Producto</th>';
        visibleTiendas.forEach(tienda => {
          breakdownHeader += `<th style="border: 1px solid #ddd; padding: 8px;">${tienda.nombre}</th>`;
        });
        breakdownHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Total</th>';
        breakdownHeader += '</tr>';

        let breakdownRows = '';
        allProductos.forEach((producto: any) => {
          breakdownRows += '<tr>';
          breakdownRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.nombre}</td>`;
          
          let totalQuantity = 0;
          visibleTiendas.forEach(tienda => {
            const tiendaServicio = producto.tiendas_servicio?.find((ts: any) => ts.id_tienda === tienda.id_tienda);
            const cantidad = tiendaServicio?.cantidad || 0;
            totalQuantity += parseFloat(cantidad) || 0;
            breakdownRows += `<td style="border: 1px solid #ddd; padding: 8px;">${parseFloat(cantidad).toFixed(2)}</td>`;
          });
          
          breakdownRows += `<td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${parseFloat(totalQuantity).toFixed(2)}</td>`;
          breakdownRows += '</tr>';
        });

        quantityBreakdownSection = `
          <h2 style="color: #002440; margin-top: 40px; margin-bottom: 10px;">Desglose Cantidad</h2>
          <table>
            ${breakdownHeader}
            ${breakdownRows}
          </table>
        `;
      }

      // Generate codes breakdown table if codigo or nota is selected
      let codesBreakdownSection = '';
      if (selectedFields.codigo || selectedFields.nota) {
        let codesHeader = '<tr style="background-color: #f0f0f0;">';
        codesHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Producto</th>';
        if (selectedFields.codigo) codesHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Código</th>';
        if (selectedFields.nota) codesHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Nota</th>';
        codesHeader += '</tr>';

        let codesRows = '';
        allProductos.forEach((producto: any) => {
          const codigos = producto.codigos || [];
          if (codigos.length === 0) {
            codesRows += '<tr>';
            codesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.nombre}</td>`;
            if (selectedFields.codigo) codesRows += `<td style="border: 1px solid #ddd; padding: 8px;">N/A</td>`;
            if (selectedFields.nota) codesRows += `<td style="border: 1px solid #ddd; padding: 8px;">N/A</td>`;
            codesRows += '</tr>';
          } else {
            codigos.forEach((codigo: any, index: number) => {
              codesRows += '<tr>';
              if (index === 0) {
                codesRows += `<td style="border: 1px solid #ddd; padding: 8px;" rowspan="${codigos.length}">${producto.nombre}</td>`;
              }
              if (selectedFields.codigo) codesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${codigo.codigo_barras_ean || 'N/A'}</td>`;
              if (selectedFields.nota) codesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${codigo.nota || 'N/A'}</td>`;
              codesRows += '</tr>';
            });
          }
        });

        codesBreakdownSection = `
          <h2 style="color: #002440; margin-top: 40px; margin-bottom: 10px;">Desglose de Códigos</h2>
          <table>
            ${codesHeader}
            ${codesRows}
          </table>
        `;
      }

      // Generate prices breakdown table if prices are different across stores AND no store filter is active
      let pricesBreakdownSection = '';
      if (hasDifferentPrices && !filters.id_tienda && (selectedFields.precio_cup || selectedFields.costo_cup || selectedFields.precio_usd || selectedFields.costo_usd)) {
        let visibleTiendas = tiendas;
        if (!canViewAllStores && user?.id_tienda) {
          visibleTiendas = tiendas.filter(t => t.id_tienda === user.id_tienda);
        }

        let pricesHeader = '<tr style="background-color: #f0f0f0;">';
        pricesHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Producto</th>';
        visibleTiendas.forEach(tienda => {
          if (selectedFields.precio_cup || selectedFields.costo_cup || selectedFields.precio_usd || selectedFields.costo_usd) {
            pricesHeader += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center;" colspan="4">${tienda.nombre}</th>`;
          }
        });
        pricesHeader += '</tr>';

        let pricesSubHeader = '<tr style="background-color: #f0f0f0;">';
        pricesSubHeader += '<th style="border: 1px solid #ddd; padding: 8px;"></th>';
        visibleTiendas.forEach(() => {
          if (selectedFields.precio_cup) pricesSubHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Precio CUP</th>';
          if (selectedFields.costo_cup) pricesSubHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo CUP</th>';
          if (selectedFields.precio_usd) pricesSubHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Precio USD</th>';
          if (selectedFields.costo_usd) pricesSubHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo USD</th>';
        });
        pricesSubHeader += '</tr>';

        let pricesRows = '';
        allProductos.forEach((producto: any) => {
          pricesRows += '<tr>';
          pricesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${producto.nombre}</td>`;
          
          visibleTiendas.forEach(tienda => {
            const tiendaServicio = producto.tiendas_servicio?.find((ts: any) => ts.id_tienda === tienda.id_tienda);
            if (selectedFields.precio_cup) pricesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${tiendaServicio?.precio_cup || 'N/A'}</td>`;
            if (selectedFields.costo_cup) pricesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${tiendaServicio?.costo_cup || 'N/A'}</td>`;
            if (selectedFields.precio_usd) pricesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${tiendaServicio?.precio_usd || 'N/A'}</td>`;
            if (selectedFields.costo_usd) pricesRows += `<td style="border: 1px solid #ddd; padding: 8px;">${tiendaServicio?.costo_usd || 'N/A'}</td>`;
          });
          
          pricesRows += '</tr>';
        });

        pricesBreakdownSection = `
          <div style="page-break-before: always;"></div>
          <h2 style="color: #002440; margin-top: 40px; margin-bottom: 10px;">Desglose de Precios y Costos</h2>
          <table>
            ${pricesHeader}
            ${pricesSubHeader}
            ${pricesRows}
          </table>
        `;
      }

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; color: #002440; margin-bottom: 10px; }
              h2 { text-align: center; color: #002440; margin-bottom: 10px; }
              p { text-align: center; color: #0b1c30; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th { background-color: #002440; color: #ffffff; border: 1px solid #002440; padding: 12px 8px; text-align: left; font-weight: bold; }
              td { border: 1px solid #d3e4fe; padding: 8px; text-align: left; color: #0b1c30; }
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
            ${quantityBreakdownSection}
            ${codesBreakdownSection}
            ${pricesBreakdownSection}
          </body>
        </html>
      `;

      // Use html2pdf.js to generate PDF
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      document.body.appendChild(element);
      
      const opt = {
        margin: 10,
        filename: `inventario_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);

      showToast({ type: 'success', message: 'PDF exportado correctamente' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al exportar PDF: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToQR = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all products for export
      const allData = await getProductos(filters, 1, 10000);
      const allProductos = allData.data || [];
      
      if (allProductos.length === 0) {
        showToast({ type: 'warning', message: 'No hay productos para exportar' });
        return;
      }

      const QRCode = (await import('qrcode')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Calculate field count for grid configuration (excluding nombre and codigo_qr_barra)
      let fieldCount = 0;
      if (selectedFields.codigo) fieldCount++;
      if (selectedFields.categoria) fieldCount++;
      if (selectedFields.precio_cup) fieldCount++;
      if (selectedFields.costo_cup) fieldCount++;
      if (selectedFields.precio_usd) fieldCount++;
      if (selectedFields.costo_usd) fieldCount++;
      if (selectedFields.nota) fieldCount++;
      if (selectedFields.cantidad) fieldCount++;
      if (selectedFields.sufijo) fieldCount++;
      
      const pdf = new jsPDF();
      const pageWidth = 210;
      const pageHeight = 297;
      const pageMargin = 10;
      const cols = 3;
      const rows = fieldCount <= 5 ? 2 : 1;
      const cellMargin = 5;
      const cellWidth = (pageWidth - pageMargin * 2 - cellMargin * (cols - 1)) / cols;
      
      let currentPage = pdf;
      let colIndex = 0;
      let rowIndex = 0;
      
      for (const producto of allProductos) {
        const codigo = producto.codigos?.[0]?.codigo_barras_ean || 'N/A';
        
        // Calculate content height
        let contentHeight = 10;
        
        if (selectedFields.codigo_qr_barra) {
          const qrSize = cellWidth * 0.55;
          contentHeight += qrSize + 8;
        }
        
        // Calculate text height (order: nombre, then other fields in modal order)
        // The QR/barcode code is shown as an image, not as text
        const textLines = [];
        if (selectedFields.nombre) textLines.push({ text: `Nombre: ${producto.nombre}`, isPrice: false });
        if (selectedFields.categoria) textLines.push({ text: `Categoría: ${producto.categoria || 'N/A'}`, isPrice: false });
        if (selectedFields.sufijo) textLines.push({ text: `Sufijo: ${producto.producto?.sufijo || producto.sufijo || 'N/A'}`, isPrice: false });
        if (selectedFields.precio_cup) textLines.push({ text: `Precio: ${parseFloat(getProductPrice(producto)).toFixed(2)} (c/u)`, isPrice: true });
        if (selectedFields.costo_cup) textLines.push({ text: `Costo: ${parseFloat(getProductCost(producto)).toFixed(2)}`, isPrice: false });
        if (selectedFields.precio_usd) textLines.push({ text: `Precio: ${parseFloat(getProductPriceUSD(producto)).toFixed(2)} (usd)`, isPrice: true });
        if (selectedFields.costo_usd) textLines.push({ text: `Costo USD: ${parseFloat(getProductCostUSD(producto)).toFixed(2)}`, isPrice: false });
        if (selectedFields.nota) textLines.push({ text: `Nota: ${producto.producto?.nota || producto.nota || 'N/A'}`, isPrice: false });
        if (selectedFields.cantidad) textLines.push({ text: `Cantidad: ${calculateTotalQuantity(producto)}`, isPrice: false });
        
        const fontSize = 12;
        for (let i = 0; i < textLines.length; i++) {
          const line = textLines[i];
          const lineFontSize = line.isPrice ? 18 : fontSize;
          if (line.isPrice && i > 0) {
            contentHeight += 18;
          }
          contentHeight += lineFontSize;
          if (i < textLines.length - 1) {
            contentHeight += line.isPrice ? 4 : 2;
          }
        }
        
        const cellHeight = contentHeight + 10;
        
        // Calculate position
        const x = pageMargin + colIndex * (cellWidth + cellMargin);
        const y = pageHeight - pageMargin - (rowIndex + 1) * cellHeight;
        
        // Draw rectangle
        currentPage.rect(x, y, cellWidth, cellHeight);
        currentPage.setDrawColor(0, 0, 0);
        currentPage.setLineWidth(0.5);
        
        let textY;
        
        if (selectedFields.codigo_qr_barra) {
          const qrSize = cellWidth * 0.55;
          const qrDataUrl = await QRCode.toDataURL(codigo, {
            width: qrSize * 10,
            margin: 0
          });
          
          const qrX = x + (cellWidth - qrSize) / 2;
          const qrY = y + 5;
          
          currentPage.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
          textY = qrY + qrSize + 8;
        } else {
          textY = y + 20;
        }
        
        // Draw text
        currentPage.setFont('helvetica', 'bold');
        
        for (const line of textLines) {
          const lineFontSize = line.isPrice ? 18 : fontSize;
          currentPage.setFontSize(lineFontSize);
          const textWidth = currentPage.getTextWidth(line.text);
          const textX = x + (cellWidth - textWidth) / 2;
          currentPage.text(line.text, textX, textY);
          
          const isLastLine = textLines.indexOf(line) === textLines.length - 1;
          const spacing = isLastLine ? 0 : (line.isPrice ? 4 : 2);
          textY += lineFontSize + spacing;
          
          if (textY > y + cellHeight - 5) break;
        }
        
        colIndex++;
        if (colIndex >= cols) {
          colIndex = 0;
          rowIndex++;
          if (rowIndex >= rows) {
            rowIndex = 0;
            currentPage.addPage();
          }
        }
      }
      
      pdf.save(`codigos_qr_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast({ type: 'success', message: 'Códigos QR exportados correctamente' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al exportar QR: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToBarcode = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all products for export
      const allData = await getProductos(filters, 1, 10000);
      const allProductos = allData.data || [];
      
      if (allProductos.length === 0) {
        showToast({ type: 'warning', message: 'No hay productos para exportar' });
        return;
      }

      const JsBarcode = (await import('jsbarcode')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Calculate field count for grid configuration (excluding nombre and codigo_qr_barra)
      let fieldCount = 0;
      if (selectedFields.codigo) fieldCount++;
      if (selectedFields.categoria) fieldCount++;
      if (selectedFields.precio_cup) fieldCount++;
      if (selectedFields.costo_cup) fieldCount++;
      if (selectedFields.precio_usd) fieldCount++;
      if (selectedFields.costo_usd) fieldCount++;
      if (selectedFields.nota) fieldCount++;
      if (selectedFields.cantidad) fieldCount++;
      if (selectedFields.sufijo) fieldCount++;
      
      const pdf = new jsPDF();
      const pageWidth = 210;
      const pageHeight = 297;
      const pageMargin = 10;
      const cols = 3;
      const rows = fieldCount <= 5 ? 2 : 1;
      const cellMargin = 5;
      const cellWidth = (pageWidth - pageMargin * 2 - cellMargin * (cols - 1)) / cols;
      
      let currentPage = pdf;
      let colIndex = 0;
      let rowIndex = 0;
      
      for (const producto of allProductos) {
        const codigo = producto.codigos?.[0]?.codigo_barras_ean || 'N/A';
        
        // Calculate content height
        let contentHeight = 10;
        
        if (selectedFields.codigo_qr_barra) {
          const barcodeHeight = 30;
          contentHeight += barcodeHeight + 8;
        }
        
        // Calculate text height (order: nombre, then other fields in modal order)
        // The QR/barcode code is shown as an image, not as text
        const textLines = [];
        if (selectedFields.nombre) textLines.push({ text: `Nombre: ${producto.nombre}`, isPrice: false });
        if (selectedFields.categoria) textLines.push({ text: `Categoría: ${producto.categoria || 'N/A'}`, isPrice: false });
        if (selectedFields.sufijo) textLines.push({ text: `Sufijo: ${producto.producto?.sufijo || producto.sufijo || 'N/A'}`, isPrice: false });
        if (selectedFields.precio_cup) textLines.push({ text: `Precio: ${parseFloat(getProductPrice(producto)).toFixed(2)} (c/u)`, isPrice: true });
        if (selectedFields.costo_cup) textLines.push({ text: `Costo: ${parseFloat(getProductCost(producto)).toFixed(2)}`, isPrice: false });
        if (selectedFields.precio_usd) textLines.push({ text: `Precio: ${parseFloat(getProductPriceUSD(producto)).toFixed(2)} (usd)`, isPrice: true });
        if (selectedFields.costo_usd) textLines.push({ text: `Costo USD: ${parseFloat(getProductCostUSD(producto)).toFixed(2)}`, isPrice: false });
        if (selectedFields.nota) textLines.push({ text: `Nota: ${producto.producto?.nota || producto.nota || 'N/A'}`, isPrice: false });
        if (selectedFields.cantidad) textLines.push({ text: `Cantidad: ${calculateTotalQuantity(producto)}`, isPrice: false });
        
        const fontSize = 12;
        for (let i = 0; i < textLines.length; i++) {
          const line = textLines[i];
          const lineFontSize = line.isPrice ? 18 : fontSize;
          if (line.isPrice && i > 0) {
            contentHeight += 18;
          }
          contentHeight += lineFontSize;
          if (i < textLines.length - 1) {
            contentHeight += line.isPrice ? 4 : 2;
          }
        }
        
        const cellHeight = contentHeight + 10;
        
        // Calculate position
        const x = pageMargin + colIndex * (cellWidth + cellMargin);
        const y = pageHeight - pageMargin - (rowIndex + 1) * cellHeight;
        
        // Draw rectangle
        currentPage.rect(x, y, cellWidth, cellHeight);
        currentPage.setDrawColor(0, 0, 0);
        currentPage.setLineWidth(0.5);
        
        let textY;
        
        if (selectedFields.codigo_qr_barra) {
          const barcodeWidth = cellWidth * 0.8;
          const barcodeHeight = 30;
          
          // Create canvas for barcode
          const canvas = document.createElement('canvas');
          try {
            JsBarcode(canvas, codigo, {
              format: 'CODE128',
              width: 2,
              height: 40,
              displayValue: true,
              margin: 0
            });
            
            const barcodeDataUrl = canvas.toDataURL();
            const barcodeX = x + (cellWidth - barcodeWidth) / 2;
            const barcodeY = y + 5;
            
            currentPage.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
            textY = barcodeY + barcodeHeight + 8;
          } catch (e) {
            // If barcode generation fails, skip it
            textY = y + 20;
          }
        } else {
          textY = y + 20;
        }
        
        // Draw text
        currentPage.setFont('helvetica', 'bold');
        
        for (const line of textLines) {
          const lineFontSize = line.isPrice ? 18 : fontSize;
          currentPage.setFontSize(lineFontSize);
          const textWidth = currentPage.getTextWidth(line.text);
          const textX = x + (cellWidth - textWidth) / 2;
          currentPage.text(line.text, textX, textY);
          
          const isLastLine = textLines.indexOf(line) === textLines.length - 1;
          const spacing = isLastLine ? 0 : (line.isPrice ? 4 : 2);
          textY += lineFontSize + spacing;
          
          if (textY > y + cellHeight - 5) break;
        }
        
        colIndex++;
        if (colIndex >= cols) {
          colIndex = 0;
          rowIndex++;
          if (rowIndex >= rows) {
            rowIndex = 0;
            currentPage.addPage();
          }
        }
      }
      
      pdf.save(`codigos_barra_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast({ type: 'success', message: 'Códigos de barra exportados correctamente' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al exportar códigos de barra: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFieldSelectionConfirm = async () => {
    setShowFieldSelectionModal(false);
    
    if (exportType === 'inventory_excel') {
      await handleExportToCSV();
    } else if (exportType === 'inventory_pdf') {
      await handleExportToPDF();
    } else if (exportType === 'qr') {
      await handleExportToQR();
    } else if (exportType === 'barcode') {
      await handleExportToBarcode();
    }
  };

  // Helper functions for price and quantity calculations
  const calculateTotalQuantity = (producto: any) => {
    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    if (filters.id_tienda && filters.id_tienda !== '') {
      const tiendaServicio = producto.tiendas_servicio.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.cantidad || 0;
    }
    
    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
    }

    return visibleTiendasServicio.reduce((sum: number, ts: any) => sum + (parseFloat(ts.cantidad) || 0), 0);
  };

  const getProductPrice = (producto: any) => {
    if (producto.producto?.precio_cup !== null && producto.producto?.precio_cup !== undefined) {
      return producto.producto.precio_cup;
    }

    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      const tiendaServicio = visibleTiendasServicio.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_cup || 0;
    } else {
      return visibleTiendasServicio[0]?.precio_cup || 0;
    }
  };

  const getProductPriceUSD = (producto: any) => {
    if (producto.producto?.precio_usd !== null && producto.producto?.precio_usd !== undefined) {
      return producto.producto.precio_usd;
    }

    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      const tiendaServicio = visibleTiendasServicio.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_usd || 0;
    } else {
      return visibleTiendasServicio[0]?.precio_usd || 0;
    }
  };

  const getProductCost = (producto: any) => {
    if (producto.producto?.costo_cup !== null && producto.producto?.costo_cup !== undefined) {
      return producto.producto.costo_cup;
    }

    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      const tiendaServicio = visibleTiendasServicio.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.costo_cup || 0;
    } else {
      return visibleTiendasServicio[0]?.costo_cup || 0;
    }
  };

  const getProductCostUSD = (producto: any) => {
    if (producto.producto?.costo_usd !== null && producto.producto?.costo_usd !== undefined) {
      return producto.producto.costo_usd;
    }

    if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
      return 0;
    }

    let visibleTiendasServicio = producto.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      const tiendaServicio = visibleTiendasServicio.find((ts: any) => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.costo_usd || 0;
    } else {
      return visibleTiendasServicio[0]?.costo_usd || 0;
    }
  };

  const wrapTextByWords = (text: string, maxCharsPerLine: number) => {
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

  const hasDifferentPricesAcrossStores = (productos: any[]) => {
    let visibleTiendas = tiendas;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendas = tiendas.filter(t => t.id_tienda === user.id_tienda);
    }

    if (visibleTiendas.length <= 1) {
      return false;
    }

    for (const producto of productos) {
      if (!producto.tiendas_servicio || producto.tiendas_servicio.length === 0) {
        continue;
      }

      let visibleTiendasServicio = producto.tiendas_servicio;
      if (!canViewAllStores && user?.id_tienda) {
        visibleTiendasServicio = producto.tiendas_servicio.filter((ts: any) => ts.id_tienda === user.id_tienda);
      }

      if (visibleTiendasServicio.length <= 1) {
        continue;
      }

      const firstPrice = visibleTiendasServicio[0]?.precio_cup;
      const firstCost = visibleTiendasServicio[0]?.costo_cup;
      const firstPriceUSD = visibleTiendasServicio[0]?.precio_usd;
      const firstCostUSD = visibleTiendasServicio[0]?.costo_usd;

      for (let i = 1; i < visibleTiendasServicio.length; i++) {
        const current = visibleTiendasServicio[i];
        if (current?.precio_cup !== firstPrice || 
            current?.costo_cup !== firstCost ||
            current?.precio_usd !== firstPriceUSD ||
            current?.costo_usd !== firstCostUSD) {
          return true;
        }
      }
    }

    return false;
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
      
      {/* ConfirmDialog is now global via GlobalConfirmDialog in layout */}
      <SidebarNavigation 
        currentRoute="Productos" 
        ref={sidebarNavRef}
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onNotificationsPress={handleNotificationsPress}
          onProfilePress={handleProfilePress}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode === 'card' ? 'table' : 'grid'}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Productos"
        />

        <div style={{ 
          marginTop: '80px',
          marginRight: 'auto',
          marginBottom: '0',
          marginLeft: 'auto',
          paddingTop: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingBottom: '120px',
          paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
          maxWidth: isDesktop ? '1400px' : '100%',
        }}>
          {/* Page Title */}
          <div className="text-center mb-6 mt-4">
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Gestión de Productos
            </h1>
          </div>

          {/* Filter Section - Wrapped to maintain compact width */}
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
          <div 
            className="rounded-2xl p-5 mb-6 shadow-lg"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 
                className="text-lg font-bold"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Filtros
              </h2>
              <button
                className="w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                style={{ 
                  backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                  borderColor: colors.primary 
                }}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? (
                  <ChevronUp size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                ) : (
                  <ChevronDown size={24} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                )}
              </button>
            </div>

            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: colors.outline }}
              >
                Nombre
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
                placeholder="Buscar por nombre..."
                value={filters.nombre}
                onChange={(e) => setFilters(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label 
                  className="block text-sm font-medium"
                  style={{ color: colors.outline }}
                >
                  Tienda
                </label>
                <button
                  onClick={() => setShowTiendaInfoModal(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <AlertCircle size={18} style={{ color: colors.primary }} />
                </button>
              </div>
              <button
                className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                style={{ 
                  backgroundColor: colors.background, 
                  color: filters.id_tienda ? colors.onSurface : colors.outline,
                  borderColor: colors.outlineVariant,
                  fontFamily: 'Inter, sans-serif'
                }}
                onClick={() => {
                  if (canViewAllStores) {
                    setShowTiendaDropdown(!showTiendaDropdown);
                    if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                      fetchTiendas();
                    }
                  }
                }}
              >
                <span>
                  {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                </span>
                {showTiendaDropdown ? (
                  <ChevronUp size={20} style={{ color: colors.outline }} />
                ) : (
                  <ChevronDown size={20} style={{ color: colors.outline }} />
                )}
              </button>
              
              {showTiendaDropdown && (
                <div 
                  className="mt-2 rounded-lg border overflow-hidden"
                  style={{ 
                    backgroundColor: colors.surface, 
                    borderColor: colors.outlineVariant,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {isLoadingTiendas ? (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                      <span style={{ color: colors.outline, fontSize: '14px' }}>Cargando tiendas...</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border-b"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant,
                          fontFamily: 'Inter, sans-serif'
                        }}
                        placeholder="Buscar tienda..."
                        value={tiendaSearchText}
                        onChange={(e) => setTiendaSearchText(e.target.value)}
                      />
                      {canViewAllStores && (
                        <button
                          className="w-full px-4 py-3 text-left border-b hover:bg-black/5 transition-colors"
                          style={{ 
                            color: colors.onSurface,
                            borderColor: 'rgba(0,0,0,0.05)',
                            fontFamily: 'Inter, sans-serif'
                          }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchProductos(null);
                          }}
                        >
                          Todas las tiendas
                        </button>
                      )}
                      {tiendas
                        .filter(t => t.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase()))
                        .map((tienda) => (
                          <button
                            key={tienda.id_tienda}
                            className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors"
                            style={{ 
                              color: colors.onSurface,
                              fontFamily: 'Inter, sans-serif'
                            }}
                            onClick={() => {
                              const newIdTienda = tienda.id_tienda.toString();
                              setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                              setShowTiendaDropdown(false);
                              setTiendaSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchProductos(newIdTienda);
                            }}
                          >
                            {tienda.nombre}
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {showAdvancedFilters && (
              <>
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Código
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Buscar por código de barras..."
                      value={filters.codigo}
                      onChange={(e) => setFilters(prev => ({ ...prev, codigo: e.target.value }))}
                    />
                    <button
                      className="w-12 h-12 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                      style={{ 
                        backgroundColor: colors.surface,
                        borderColor: colors.primary
                      }}
                      onClick={() => {
                        // Barcode scanner - for web we'll use a placeholder
                        showToast({ type: 'warning', message: 'Escáner de código de barras próximamente disponible en web' });
                      }}
                    >
                      <Search size={20} style={{ color: colors.primary }} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Categoría
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
                    placeholder="Buscar por categoría..."
                    value={filters.categoria}
                    onChange={(e) => setFilters(prev => ({ ...prev, categoria: e.target.value }))}
                  />
                </div>

                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Estado
                  </label>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.esvendible === '' ? '#9E9E9E' : '#E0E0E0',
                        color: filters.esvendible === '' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: '' }))}
                    >
                      Todos
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.esvendible === 'true' ? '#4CAF50' : '#E0E0E0',
                        color: filters.esvendible === 'true' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: 'true' }))}
                    >
                      Vendible
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-2 transition-colors font-medium"
                      style={{ 
                        backgroundColor: filters.esvendible === 'false' ? '#F44336' : '#E0E0E0',
                        color: filters.esvendible === 'false' ? '#fff' : '#9E9E9E'
                      }}
                      onClick={() => setFilters(prev => ({ ...prev, esvendible: 'false' }))}
                    >
                      No vendible
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Cantidad Mín
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="0"
                      value={filters.cantidad_min}
                      onChange={(e) => setFilters(prev => ({ ...prev, cantidad_min: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Cantidad Máx
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="0"
                      value={filters.cantidad_max}
                      onChange={(e) => setFilters(prev => ({ ...prev, cantidad_max: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                style={{ 
                  backgroundColor: colors.surface, 
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface
                }}
                onClick={handleClearFilters}
              >
                <RefreshCw size={18} />
                <span>Limpiar</span>
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <Search size={18} />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            {isAdmin && (
              <button
                className="flex-1 rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleAdd}
              >
                <Plus size={20} />
                <span className="font-medium">Agregar Producto</span>
              </button>
            )}
            <button
              className="flex-1 rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => setShowExportModal(true)}
            >
              <Download size={20} />
              <span className="font-medium">Exportar Datos</span>
            </button>
          </div>
          </div>

          {/* Productos List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando productos...</p>
            </div>
          ) : error ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <AlertCircle size={40} style={{ color: colors.error, marginBottom: 16 }} />
              <p style={{ color: colors.onSurface, marginBottom: 16 }}>{error}</p>
              <button
                className="rounded-lg px-6 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={() => fetchProductos(null)}
              >
                Reintentar
              </button>
            </div>
          ) : productos.length === 0 ? (
            <div 
              className="rounded-2xl p-8 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
              <p style={{ color: colors.outline }}>No se encontraron productos</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                productos.map((producto, index) => {
                  const totalQuantity = calculateTotalQuantity(producto);
                  const productImage = producto.producto?.imagen;
                  const fullImageUrl = productImage && apiBaseUrl ? `${apiBaseUrl}${productImage}` : null;
                  
                  return (
                    <div
                      key={producto.id_servicio || index}
                      className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                      style={{ backgroundColor: colors.surface }}
                      onClick={() => handleProductoPress(producto)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          {/* Product Image */}
                          <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden" style={{ backgroundColor: colors.surfaceVariant }}>
                            {fullImageUrl ? (
                              <img 
                                src={fullImageUrl} 
                                alt={producto.nombre}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.log('Error loading image for product:', producto.nombre, 'URL:', fullImageUrl);
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${fullImageUrl ? 'hidden' : ''}`}>
                              <AlertCircle size={24} style={{ color: colors.outline }} />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1">
                              <h3 
                                className="font-semibold text-base truncate mr-2"
                                style={{ 
                                  color: colors.onSurface,
                                  fontFamily: 'Hanken Grotesk, sans-serif'
                                }}
                              >
                                {wrapTextByWords(producto.nombre, 15)}
                              </h3>
                              <span 
                                className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                                style={{ 
                                  backgroundColor: producto.esvendible ? '#E8F5E9' : '#FFEBEE',
                                  color: producto.esvendible ? '#2E7D32' : '#C62828',
                                  fontFamily: 'Inter, sans-serif'
                                }}
                              >
                                {producto.esvendible ? 'Vendible' : 'No vendible'}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                              Categoría: {producto.categoria}
                            </p>
                            {filters.id_tienda && (
                              <>
                                <p className="text-sm" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                                  Precio CUP: ${parseFloat(getProductPrice(producto)).toFixed(2)}
                                </p>
                                <p className="text-sm" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                                  Precio USD: ${parseFloat(getProductPriceUSD(producto)).toFixed(2)}
                                </p>
                              </>
                            )}
                            <p className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                              Cantidad: {parseFloat(totalQuantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-2 ml-3">
                            <button
                              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              onClick={(e) => handleEdit(producto, e)}
                            >
                              <Edit size={22} style={{ color: colors.primary }} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(producto);
                            }}
                          >
                            <Trash2 size={22} style={{ color: colors.error }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-lg">
                  <table className="w-full" style={{ backgroundColor: colors.surface }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.primary }}>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Nombre</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Categoría</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '80px' }}>Estado</th>
                        {filters.id_tienda && (
                          <>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Precio CUP</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Precio USD</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Cantidad</th>
                        {canEdit && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((producto, index) => {
                        const totalQuantity = calculateTotalQuantity(producto);
                        return (
                          <tr
                            key={producto.id_servicio || index}
                            className="cursor-pointer hover:bg-black/5 transition-colors"
                            style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                            onClick={() => handleProductoPress(producto)}
                          >
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {producto.nombre}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {producto.categoria || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium" style={{ color: producto.esvendible ? '#4CAF50' : '#F44336' }}>
                              {producto.esvendible ? 'Vendible' : 'No vendible'}
                            </td>
                            {filters.id_tienda && (
                              <>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  ${parseFloat(getProductPrice(producto)).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  ${parseFloat(getProductPriceUSD(producto)).toFixed(2)}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {parseFloat(totalQuantity).toFixed(2)}
                            </td>
                            {canEdit && (
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                    onClick={(e) => handleEdit(producto, e)}
                                  >
                                    <Edit size={18} style={{ color: colors.primary }} />
                                  </button>
                                  <button
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(producto);
                                    }}
                                  >
                                    <Trash2 size={18} style={{ color: colors.error }} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    onClick={handlePrevPage}
                    disabled={pagination.currentPage === 1}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span style={{ color: colors.onSurface }}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: colors.surface, color: colors.onSurface }}
                    onClick={handleNextPage}
                    disabled={pagination.currentPage === pagination.totalPages}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}

              {/* Total Count */}
              <div className="text-center mt-4">
                <span style={{ color: colors.outline, fontSize: '14px' }}>
                  Total: {pagination.totalItems} productos
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tienda Info Modal */}
      {showTiendaInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={28} style={{ color: colors.primary }} />
              <h2 
                className="text-xl font-bold"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Información de Tienda
              </h2>
            </div>
            <p 
              className="text-sm mb-6"
              style={{ 
                color: colors.onSurface, 
                fontFamily: 'Inter, sans-serif',
                lineHeight: '1.5'
              }}
            >
              Cuando seleccionas una tienda específica, la cantidad mostrada será la existencia en esa tienda. Si no seleccionas ninguna tienda, se mostrará la sumatoria de todas las existencias en todas las tiendas.
            </p>
            <button
              className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => setShowTiendaInfoModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            style={{ backgroundColor: colors.surface }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowExportModal(false)}
            >
              <X size={24} style={{ color: colors.outline }} />
            </button>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Exportar Datos
            </h2>
            <div className="space-y-3">
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowExportModal(false);
                  setShowInventoryOptionsModal(true);
                }}
              >
                <Box size={20} style={{ color: colors.primary }} />
                <span>Exportar Inventario</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowExportModal(false);
                  setShowCodesOptionsModal(true);
                }}
              >
                <QrCode size={20} style={{ color: colors.primary }} />
                <span>Exportar Códigos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Options Modal */}
      {showInventoryOptionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            style={{ backgroundColor: colors.surface }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowInventoryOptionsModal(false)}
            >
              <X size={24} style={{ color: colors.outline }} />
            </button>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Exportar Inventario
            </h2>
            <div className="space-y-3">
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowInventoryOptionsModal(false);
                  setExportType('inventory_excel');
                  setShowFieldSelectionModal(true);
                }}
              >
                <FileText size={20} style={{ color: colors.primary }} />
                <span>Inventario en Excel</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowInventoryOptionsModal(false);
                  setExportType('inventory_pdf');
                  setShowFieldSelectionModal(true);
                }}
              >
                <FileText size={20} style={{ color: colors.primary }} />
                <span>Inventario en PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Codes Options Modal */}
      {showCodesOptionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            style={{ backgroundColor: colors.surface }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowCodesOptionsModal(false)}
            >
              <X size={24} style={{ color: colors.outline }} />
            </button>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Exportar Códigos
            </h2>
            <div className="space-y-3">
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowCodesOptionsModal(false);
                  setExportType('barcode');
                  setSelectedFields(prev => ({ ...prev, codigo_qr_barra: true }));
                  setShowFieldSelectionModal(true);
                }}
              >
                <Barcode size={20} style={{ color: colors.primary }} />
                <span>Código de Barra</span>
              </button>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.surfaceVariant, color: colors.onSurface }}
                onClick={() => {
                  setShowCodesOptionsModal(false);
                  setExportType('qr');
                  setSelectedFields(prev => ({ ...prev, codigo_qr_barra: true }));
                  setShowFieldSelectionModal(true);
                }}
              >
                <QrCode size={20} style={{ color: colors.primary }} />
                <span>Código QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto relative"
            style={{ backgroundColor: colors.surface }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowFieldSelectionModal(false)}
            >
              <X size={24} style={{ color: colors.outline }} />
            </button>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Seleccionar Campos
            </h2>
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.nombre}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, nombre: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Nombre</span>
              </label>
              {(exportType === 'qr' || exportType === 'barcode') && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.codigo_qr_barra}
                    onChange={(e) => setSelectedFields(prev => ({ ...prev, codigo_qr_barra: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  <span style={{ color: colors.onSurface }}>Código QR/Barra</span>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.categoria}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, categoria: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Categoría</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.sufijo}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, sufijo: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Sufijo</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.codigo}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, codigo: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Códigos</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.precio_cup}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, precio_cup: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Precio CUP</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.precio_usd}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, precio_usd: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Precio USD</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.costo_cup}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_cup: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Costo CUP</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.costo_usd}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_usd: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Costo USD</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.nota}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, nota: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Nota</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.cantidad}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, cantidad: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Cantidad</span>
              </label>
            </div>
            <button
              className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleFieldSelectionConfirm}
            >
              Generar Exportación
            </button>
          </div>
        </div>
      )}
    </>
  );
}
