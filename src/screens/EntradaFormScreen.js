import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
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
import { createEntrada, updateEntrada, getEntradaById, getEntradas } from '../services/entradaService';
import { getProductos, getProductoById, updateProducto } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import { configService } from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';

const EntradaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, entradaAccessLevels, entradaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { entrada, mode, productoPreSeleccionado, canViewAllEntradas: canViewAllEntradasParam, entradaData } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingEntrada, setIsFetchingEntrada] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [productos, setProductos] = useState([]);
  const [productoSearchResults, setProductoSearchResults] = useState([]);
  const [isSearchingProductos, setIsSearchingProductos] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  // Tracks raw text while the user is typing in costo fields (avoids .toFixed forcing cursor to end)
  const [costoInputTexts, setCostoInputTexts] = useState({});
  // Tracks raw text while the user is typing in precio fields
  const [precioInputTexts, setPrecioInputTexts] = useState({});
  
  const [formData, setFormData] = useState({
    id_servicio_tienda: null,
    cantidad_entrada: '',
    costo_usd: '',
    costo_cup: '',
    precio_usd: '',
    precio_cup: '',
    fecha_vencimiento: '',
    nombre_proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    producto: null,
    tienda: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFechaEntradaPicker, setShowFechaEntradaPicker] = useState(false);

  // Helper function to format date correctly without timezone issues
  const formatDateToLocal = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const userRole = user?.rol?.toLowerCase();
  const canManageEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
    (userRole === 'económico' && entradaManagePermissions?.economico);

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchCompleteEntrada = async () => {
      if (entrada?.id_entrada) {
        try {
          setIsFetchingEntrada(true);
          
          let completeEntrada;
          if (isOfflineMode) {
            completeEntrada = entrada;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeEntrada = await getEntradaById(entrada.id_entrada);
          }
          
          setFormData({
            id_servicio_tienda: completeEntrada.id_servicio_tienda,
            cantidad_entrada: completeEntrada.cantidad_entrada.toString(),
            costo_usd: completeEntrada.costo_usd.toString(),
            costo_cup: completeEntrada.costo_cup.toString(),
            precio_usd: '',
            precio_cup: '',
            fecha_vencimiento: completeEntrada.fecha_vencimiento ? formatDateToLocal(completeEntrada.fecha_vencimiento) : '',
            nombre_proveedor: completeEntrada.nombre_proveedor || '',
            fecha: completeEntrada.fecha ? formatDateToLocal(completeEntrada.fecha) : formatDateToLocal(new Date().toISOString()),
            producto: completeEntrada.servicioTienda?.servicio,
            tienda: completeEntrada.servicioTienda?.tienda,
          });
          
          setProductoSearchText(completeEntrada.servicioTienda?.servicio?.nombre || '');
        } catch (err) {
          console.error('[fetchCompleteEntrada] Error:', err);
          console.error('[fetchCompleteEntrada] Error message:', err.message);
          // showToast({ type: 'error', message: 'Error al cargar datos de la entrada' });
        } finally {
          setIsFetchingEntrada(false);
        }
      }
    };

    fetchCompleteEntrada();
  }, [entrada?.id_entrada, isOfflineMode]);

  useEffect(() => {
    if (productoPreSeleccionado && isAddMode) {
      // Get costs from the first tienda_servicio entry if available
      const firstTiendaServicio = productoPreSeleccionado.tiendas_servicio?.[0];
      const costoCup = firstTiendaServicio?.costo_cup || '';
      const costoUsd = firstTiendaServicio?.costo_usd || '';
      
      setFormData(prev => ({
        ...prev,
        producto: productoPreSeleccionado,
        costo_cup: costoCup,
        costo_usd: costoUsd,
      }));
      
      setProductoSearchText(productoPreSeleccionado.nombre || '');
    }
  }, [productoPreSeleccionado, isAddMode]);

  // Efecto para restaurar datos cuando regresa de ProductoFormScreen
  useEffect(() => {
    if (entradaData && isAddMode) {
      const restoreProducto = async () => {
        try {
          const productoActualizado = await getProductoById(entradaData.producto.id_servicio);
          
          // Buscar la tienda que se agregó en ProductoFormScreen
          const tiendaRelacion = productoActualizado.tiendas_servicio?.find(
            ts => ts.id_tienda === entradaData.tienda?.id_tienda
          );

          if (tiendaRelacion) {
            setFormData(prev => ({
              ...prev,
              producto: productoActualizado,
              tienda: entradaData.tienda,
              id_servicio_tienda: tiendaRelacion.id_servicio_tienda,
              costo_cup: tiendaRelacion.costo_cup?.toString() || '',
              costo_usd: tiendaRelacion.costo_usd?.toString() || '',
            }));
            
            setProductoSearchText(productoActualizado.nombre || '');
            
            showToast({ 
              type: 'success', 
              message: 'Relación producto-tienda creada correctamente. Ahora puedes crear la entrada.' 
            });
          }
        } catch (err) {
          console.error('[restoreProducto] Error:', err);
          console.error('[restoreProducto] Error message:', err.message);
          // showToast({ type: 'error', message: 'Error al cargar producto actualizado' });
        }
      };

      restoreProducto();
    }
  }, [entradaData, isAddMode]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        setTiendas([]);
        return;
      }
      
      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        canViewAllEntradasParam !== undefined ? canViewAllEntradasParam :
        (userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores'));
      
      const data = await getTiendas({}, 1, 1000);
      let allTiendas = data.data?.filter(t => t.activo === true) || [];
      
      if (user?.id_tienda && !canViewAllEntradas) {
        const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
        setTiendas(userTienda ? [userTienda] : []);
      } else {
        setTiendas(allTiendas);
      }
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const searchProductos = async (searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
        setProductoSearchResults([]);
        return;
      }
      setIsSearchingProductos(true);
      const data = await getProductos({ nombre: searchTerm, skipCantidadMin: true, skipEsvendible: true }, 1, 20);
      setProductoSearchResults(data.data || []);
    } catch (err) {
      setProductoSearchResults([]);
    } finally {
      setIsSearchingProductos(false);
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

  const calcularCostoPromedioPonderado = async (producto, tienda, nuevaCantidad, nuevoCostoCup, nuevoCostoUsd) => {
    try {
      // Obtener todas las entradas anteriores del producto en esta tienda
      const servicioTienda = producto.tiendas_servicio?.find(ts => ts.id_tienda === tienda.id_tienda);
      
      if (!servicioTienda) {
        return { costo_cup: nuevoCostoCup, costo_usd: nuevoCostoUsd };
      }

      const entradas = await getEntradas({ 
        id_servicio_tienda: servicioTienda.id_servicio_tienda 
      }, 1, 1000);
      
      const cantidadActual = parseFloat(servicioTienda.cantidad) || 0;
      const costoActualCup = parseFloat(servicioTienda.costo_cup) || 0;
      const costoActualUsd = parseFloat(servicioTienda.costo_usd) || 0;

      // Calcular costo promedio ponderado
      const cantidadTotal = cantidadActual + parseFloat(nuevaCantidad);
      const costoTotalCup = (costoActualCup * cantidadActual) + (nuevoCostoCup * parseFloat(nuevaCantidad));
      const costoTotalUsd = (costoActualUsd * cantidadActual) + (nuevoCostoUsd * parseFloat(nuevaCantidad));

      const nuevoCostoPromedioCup = costoTotalCup / cantidadTotal;
      const nuevoCostoPromedioUsd = costoTotalUsd / cantidadTotal;

      return {
        costo_cup: parseFloat(nuevoCostoPromedioCup.toFixed(5)),
        costo_usd: parseFloat(nuevoCostoPromedioUsd.toFixed(5)),
      };
    } catch (error) {
      return { costo_cup: nuevoCostoCup, costo_usd: nuevoCostoUsd };
    }
  };

  const handleSave = async () => {
    if (!formData.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto' });
      return;
    }
    if (!formData.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
      return;
    }
    if (!formData.cantidad_entrada || parseFloat(formData.cantidad_entrada) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que 0' });
      return;
    }
    if (formData.costo_usd !== '' && parseFloat(formData.costo_usd) < 0) {
      showToast({ type: 'warning', message: 'El costo USD debe ser mayor o igual a 0' });
      return;
    }
    if (formData.costo_cup !== '' && parseFloat(formData.costo_cup) < 0) {
      showToast({ type: 'warning', message: 'El costo CUP debe ser mayor o igual a 0' });
      return;
    }

    // Validar si el producto tiene relación con la tienda
    const productoTienda = formData.producto?.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda?.id_tienda
    );

    // Si no existe relación, validar que se ingresen los precios
    if (!productoTienda && formData.producto && formData.tienda) {
      if (!formData.precio_cup || formData.precio_cup === '') {
        showToast({ type: 'warning', message: 'Debe ingresar el precio CUP del producto para esta tienda' });
        return;
      }
      if (!formData.precio_usd || formData.precio_usd === '') {
        showToast({ type: 'warning', message: 'Debe ingresar el precio USD del producto para esta tienda' });
        return;
      }
    }

    // Validar fecha de vencimiento si el producto es vencible
    if (formData.producto.producto?.isVencible && !formData.fecha_vencimiento) {
      showToast({ type: 'warning', message: 'El producto requiere fecha de vencimiento' });
      return;
    }

    // Validar si la fecha de vencimiento es anterior o igual a la fecha de entrada
    if (formData.producto.producto?.isVencible && formData.fecha_vencimiento) {
      const fechaVencimiento = new Date(formData.fecha_vencimiento);
      const fechaEntrada = new Date(formData.fecha);
      
      if (fechaVencimiento <= fechaEntrada) {
        Alert.alert(
          'Advertencia: Fecha de vencimiento',
          'La fecha de vencimiento es anterior o igual a la fecha de entrada. Esto puede ocasionar que el producto esté vencido al momento de ingresarlo al inventario. ¿Está seguro que desea continuar con la entrada?',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Continuar',
              style: 'destructive',
              onPress: () => executeSave()
            }
          ]
        );
        return;
      }
    }

    executeSave();
  };

  const executeSave = async () => {
    // Helper function to safely convert to number with 5 decimal places
    const toFixed5 = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
    };

    try {
      setIsSaving(true);

      // Verificar si el producto existe en la tienda seleccionada
      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );

      let id_servicio_tienda = productoTienda?.id_servicio_tienda;

      // Si el producto no existe en la tienda, primero actualizar el producto
      if (!productoTienda) {
        const productoActualizado = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTienda = {
          id_tienda: formData.tienda.id_tienda,
          precio_cup: toFixed5(formData.precio_cup || 0),
          precio_usd: toFixed5(formData.precio_usd || 0),
          costo_cup: toFixed5(formData.costo_cup),
          costo_usd: toFixed5(formData.costo_usd),
        };

        const productoTiendaList = [
          ...(productoActualizado.tiendas_servicio || []).map(ts => ({
            id_tienda: ts.id_tienda,
            precio_cup: ts.precio_cup,
            precio_usd: ts.precio_usd,
            costo_cup: ts.costo_cup,
            costo_usd: ts.costo_usd,
            cantidad_alerta: ts.cantidad_alerta,
          })),
          nuevoProductoTienda
        ];
        
        await updateProducto(formData.producto.id_servicio, {
          productoTiendaList: productoTiendaList,
        });

        // Obtener el producto actualizado para obtener el nuevo id_servicio_tienda
        const productoActualizado2 = await getProductoById(formData.producto.id_servicio);
        const nuevoProductoTiendaCreado = productoActualizado2.tiendas_servicio?.find(
          ts => ts.id_tienda === formData.tienda.id_tienda
        );
        id_servicio_tienda = nuevoProductoTiendaCreado?.id_servicio_tienda;

        if (!id_servicio_tienda) {
          throw new Error('Error al crear relación producto-tienda');
        }
      }

      // Calcular costo promedio ponderado si está activado
      let costo_cup = toFixed5(formData.costo_cup);
      let costo_usd = toFixed5(formData.costo_usd);

      if (config.applyWeightedAverageCost && !isEditMode) {
        const nuevosCostos = await calcularCostoPromedioPonderado(
          formData.producto,
          formData.tienda,
          formData.cantidad_entrada,
          costo_cup,
          costo_usd
        );
        costo_cup = nuevosCostos.costo_cup;
        costo_usd = nuevosCostos.costo_usd;
        
        // showToast({ 
        //   type: 'info', 
        //   message: `Costo promedio calculado: CUP ${costo_cup}, USD ${costo_usd}` 
        // });
      }

      const entradaData = {
        id_servicio_tienda,
        cantidad_entrada: parseFloat(formData.cantidad_entrada),
        costo_usd: toFixed5(costo_usd),
        costo_cup: toFixed5(costo_cup),
        fecha_vencimiento: formData.fecha_vencimiento || null,
        nombre_proveedor: formData.nombre_proveedor || null,
        fecha: formData.fecha,
        id_usuario: user.id_usuario,
      };

      if (isEditMode) {
        await updateEntrada(entrada.id_entrada, entradaData);
        showToast({ type: 'success', message: 'Entrada actualizada correctamente' });
      } else {
        await createEntrada(entradaData);
        showToast({ type: 'success', message: 'Entrada creada correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
      console.error('[executeSave] Error:', err);
      // showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setFormData(prev => ({ ...prev, fecha_vencimiento: formattedDate }));
    }
  };

  const handleFechaEntradaChange = (event, selectedDate) => {
    setShowFechaEntradaPicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setFormData(prev => ({ ...prev, fecha: formattedDate }));
    }
  };

  const handleTiendaSelect = (tienda) => {
    // Verificar si el producto ya tiene una relación con esta tienda
    if (formData.producto) {
      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === tienda.id_tienda
      );

      if (productoTienda) {
        // Si existe relación, autorellenar los costos
        const costoCup = productoTienda.costo_cup?.toString() || '';
        const costoUsd = productoTienda.costo_usd?.toString() || '';
        
        setFormData(prev => ({
          ...prev,
          tienda,
          id_servicio_tienda: productoTienda.id_servicio_tienda,
          costo_cup: costoCup,
          costo_usd: costoUsd,
          precio_cup: '',
          precio_usd: '',
        }));
      } else {
        // Si no existe relación, solo actualizar la tienda y limpiar precios
        setFormData(prev => ({
          ...prev,
          tienda,
          id_servicio_tienda: null,
          precio_cup: '',
          precio_usd: '',
        }));
      }
    } else {
      // Si no hay producto seleccionado, solo actualizar la tienda
      setFormData(prev => ({ ...prev, tienda }));
    }

    setShowTiendaDropdown(false);
    setTiendaSearchText('');
  };


  const handleCostoChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value === '' ? '' : parseFloat(value) };
      
      if (exchangeRate && field === 'costo_cup' && value !== '') {
        const cupValue = parseFloat(value) || 0;
        updated.costo_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_usd' && value !== '') {
        const usdValue = parseFloat(value) || 0;
        updated.costo_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  const handlePrecioChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value === '' ? '' : parseFloat(value) };
      
      if (exchangeRate && field === 'precio_cup' && value !== '') {
        const cupValue = parseFloat(value) || 0;
        updated.precio_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'precio_usd' && value !== '') {
        const usdValue = parseFloat(value) || 0;
        updated.precio_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Don't show dropdown if the text matches the selected product (editing mode)
      const isMatchingSelectedProduct = formData.producto && 
        productoSearchText === formData.producto.nombre;
      
      if (productoSearchText.length >= 2 && !isMatchingSelectedProduct) {
        searchProductos(productoSearchText);
        setShowProductoDropdown(true);
      } else {
        setProductoSearchResults([]);
        setShowProductoDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [productoSearchText, formData.producto]);

  // Efecto para autorellenar costos cuando la fórmula de costo promedio ponderado está activa
  useEffect(() => {
    if (config.applyWeightedAverageCost) {
      // Cuando la fórmula está activa, NO autorellenar costos (usuario debe ingresar costo de entrada)
      return;
    }
    
    if (!formData.producto || !formData.tienda) {
      return;
    }

    const servicioTienda = formData.producto.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda.id_tienda
    );

    if (servicioTienda) {
      // Cuando la fórmula NO está activa, autorellenar con el costo actual del producto en la tienda
      setFormData(prev => ({
        ...prev,
        costo_cup: servicioTienda.costo_cup?.toString() || '',
        costo_usd: servicioTienda.costo_usd?.toString() || '',
      }));
    }
  }, [formData.producto, formData.tienda, config.applyWeightedAverageCost]);

  const handleProductoSelect = (producto) => {
    let costoCup = '';
    let costoUsd = '';
    
    if (formData.tienda && !config.applyWeightedAverageCost) {
      const tiendaServicio = producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      costoCup = tiendaServicio?.costo_cup?.toString() || '';
      costoUsd = tiendaServicio?.costo_usd?.toString() || '';
    } else if (!config.applyWeightedAverageCost) {
      const firstTiendaServicio = producto.tiendas_servicio?.[0];
      costoCup = firstTiendaServicio?.costo_cup?.toString() || '';
      costoUsd = firstTiendaServicio?.costo_usd?.toString() || '';
    }
    
    setFormData(prev => ({
      ...prev,
      producto,
      costo_cup: costoCup,
      costo_usd: costoUsd,
    }));
    
    setProductoSearchText(producto.nombre);
    setShowProductoDropdown(false);
    setProductoSearchResults([]);
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const getCantidadStatus = () => {
    if (!formData.producto || !formData.tienda) {
      return null;
    }
    
    // In view/edit mode, use the cantidad_restante from the entrada data
    // In add mode, use the producto's tiendas_servicio
    let cantidadActual = 0;
    
    if ((isViewMode || isEditMode) && entrada?.cantidad_restante !== undefined) {
      cantidadActual = parseFloat(entrada.cantidad_restante) || 0;
    } else {
      const servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      if (servicioTienda) {
        cantidadActual = parseFloat(servicioTienda.cantidad) || 0;
      }
    }
    
    const cantidadTotal = parseFloat(formData.cantidad_entrada) || 0;
    
    if (cantidadActual === cantidadTotal) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Completo' };
    } else if (cantidadActual === 0) {
      return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336', label: 'Agotado' };
    } else {
      return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800', label: 'Parcial' };
    }
  };

  const getFinancialInfo = () => {
    if (!formData.cantidad_entrada) {
      return null;
    }

    const cantidad = parseFloat(formData.cantidad_entrada) || 0;
    const costoCup = parseFloat(formData.costo_cup) || 0;
    const costoUsd = parseFloat(formData.costo_usd) || 0;

    let precioCup = 0;
    let precioUsd = 0;

    // In view/edit mode, use the servicioTienda from the entrada data
    if ((isViewMode || isEditMode) && entrada?.servicioTienda) {
      const parsedPrecioCup = parseFloat(entrada.servicioTienda.precio_cup);
      const parsedPrecioUsd = parseFloat(entrada.servicioTienda.precio_usd);
      precioCup = !isNaN(parsedPrecioCup) ? parsedPrecioCup : 0;
      precioUsd = !isNaN(parsedPrecioUsd) ? parsedPrecioUsd : 0;
    } 
    // In add mode, use the product's tiendas_servicio
    else if (formData.producto && formData.tienda) {
      const servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
      const parsedPrecioCup = parseFloat(servicioTienda?.precio_cup);
      const parsedPrecioUsd = parseFloat(servicioTienda?.precio_usd);
      precioCup = !isNaN(parsedPrecioCup) ? parsedPrecioCup : 0;
      precioUsd = !isNaN(parsedPrecioUsd) ? parsedPrecioUsd : 0;
    }

    // Calculate total cost
    const costoTotalCup = costoCup * cantidad;
    const costoTotalUsd = costoUsd * cantidad;

    // Calculate expected profit
    const gananciaCup = precioCup - costoCup;
    const gananciaUsd = precioUsd - costoUsd;

    // Calculate profit percentage
    const porcentajeGananciaCup = precioCup > 0 ? (gananciaCup / precioCup) * 100 : 0;
    const porcentajeGananciaUsd = precioUsd > 0 ? (gananciaUsd / precioUsd) * 100 : 0;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      precioCup: !isNaN(precioCup) ? precioCup : 0,
      precioUsd: !isNaN(precioUsd) ? precioUsd : 0,
      gananciaCup: !isNaN(gananciaCup) ? gananciaCup : 0,
      gananciaUsd: !isNaN(gananciaUsd) ? gananciaUsd : 0,
      porcentajeGananciaCup: !isNaN(porcentajeGananciaCup) ? porcentajeGananciaCup : 0,
      porcentajeGananciaUsd: !isNaN(porcentajeGananciaUsd) ? porcentajeGananciaUsd : 0
    };
  };


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
        title={isViewMode ? 'Información de Entrada' : isEditMode ? 'Editar Entrada' : 'Agregar Entrada'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={responsive.headerHeight + 20}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {isFetchingEntrada ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando datos...
              </Text>
            </View>
          ) : (
            <>
              {/* Producto Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Producto *</Text>
                <View style={styles.relativeContainer}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar producto..."
                    value={productoSearchText}
                    onChangeText={setProductoSearchText}
                    editable={!isReadOnly}
                    onBlur={() => setShowProductoDropdown(false)}
                  />
                  {showProductoDropdown && !isReadOnly && (
                    <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      {isSearchingProductos ? (
                        <View style={styles.dropdownItem}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      ) : productoSearchResults.length > 0 ? (
                        productoSearchResults.map((producto, index) => (
                          <TouchableOpacity
                            key={producto.id_servicio}
                            style={[styles.dropdownItem, index === productoSearchResults.length - 1 && styles.dropdownItemLast]}
                            onPress={() => handleProductoSelect(producto)}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.dropdownItem}>
                          <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Tienda Selection and Cantidad Entrante */}
              <View style={styles.formRow}>
                <View style={[styles.formColumn60, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                    onPress={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                    disabled={isReadOnly}
                  >
                    <Text style={[styles.dropdownText, { color: formData.tienda ? colors.onSurface : colors.outline }]}>
                      {formData.tienda?.nombre || 'Seleccionar...'}
                    </Text>
                    {!isReadOnly && (
                      <Ionicons 
                        name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                        size={responsive.responsiveWidth(20)} 
                        color={colors.outline} 
                      />
                    )}
                  </TouchableOpacity>
                  
                  {showTiendaDropdown && !isReadOnly && (
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
                      {filteredTiendas.length > 0 ? (
                        filteredTiendas.map((tienda, index) => (
                          <TouchableOpacity
                            key={tienda.id_tienda}
                            style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                            onPress={() => handleTiendaSelect(tienda)}
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

                <View style={[styles.formColumn40, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cant.Entrante *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad"
                    value={formData.cantidad_entrada}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_entrada: text.replace(/-/g, '') }))}
                    keyboardType="decimal-pad"
                    editable={!isReadOnly}
                  />
                  {(isViewMode || isEditMode) && getCantidadStatus() && (
                    <View style={styles.cantidadInfoRow}>
                      <Text style={[styles.cantidadInfoLabel, { color: colors.outline }]}>
                        Cant. Actual:
                      </Text>
                      <View style={[styles.cantidadOval, { backgroundColor: getCantidadStatus().bgColor, borderColor: getCantidadStatus().borderColor }]}>
                        <Text style={[styles.cantidadOvalText, { color: getCantidadStatus().color }]}>
                          {entrada?.cantidad_restante || 0}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Costos */}
              <View style={styles.formRow}>
                <View style={[styles.formColumn, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Costo CUP *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Costo CUP"
                    value={
                      costoInputTexts.costo_cup !== undefined
                        ? costoInputTexts.costo_cup
                        : (formData.costo_cup !== null && formData.costo_cup !== '' ? parseFloat(formData.costo_cup).toFixed(2) : '')
                    }
                    onFocus={() => setCostoInputTexts(prev => ({
                      ...prev,
                      costo_cup: formData.costo_cup !== null && formData.costo_cup !== '' ? String(parseFloat(formData.costo_cup)) : ''
                    }))}
                    onChangeText={(text) => {
                      setCostoInputTexts(prev => ({ ...prev, costo_cup: text }));
                      handleCostoChange('costo_cup', text);
                    }}
                    onBlur={() => {
                      setCostoInputTexts(prev => {
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
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Costo USD"
                    value={
                      costoInputTexts.costo_usd !== undefined
                        ? costoInputTexts.costo_usd
                        : (formData.costo_usd !== null && formData.costo_usd !== '' ? parseFloat(formData.costo_usd).toFixed(2) : '')
                    }
                    onFocus={() => setCostoInputTexts(prev => ({
                      ...prev,
                      costo_usd: formData.costo_usd !== null && formData.costo_usd !== '' ? String(parseFloat(formData.costo_usd)) : ''
                    }))}
                    onChangeText={(text) => {
                      setCostoInputTexts(prev => ({ ...prev, costo_usd: text }));
                      handleCostoChange('costo_usd', text);
                    }}
                    onBlur={() => {
                      setCostoInputTexts(prev => {
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

              {/* Precios (solo cuando no existe relación producto-tienda en add mode) */}
              {isAddMode && formData.producto && formData.tienda && !formData.producto.tiendas_servicio?.find(
                ts => ts.id_tienda === formData.tienda.id_tienda
              ) && (
                <View style={styles.formRow}>
                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Precio CUP *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="Precio CUP"
                      value={
                        precioInputTexts.precio_cup !== undefined
                          ? precioInputTexts.precio_cup
                          : (formData.precio_cup !== null && formData.precio_cup !== '' ? parseFloat(formData.precio_cup).toFixed(2) : '')
                      }
                      onFocus={() => setPrecioInputTexts(prev => ({
                        ...prev,
                        precio_cup: formData.precio_cup !== null && formData.precio_cup !== '' ? String(parseFloat(formData.precio_cup)) : ''
                      }))}
                      onChangeText={(text) => {
                        setPrecioInputTexts(prev => ({ ...prev, precio_cup: text }));
                        handlePrecioChange('precio_cup', text);
                      }}
                      onBlur={() => {
                        setPrecioInputTexts(prev => {
                          const updated = { ...prev };
                          delete updated.precio_cup;
                          return updated;
                        });
                      }}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                    />
                  </View>

                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Precio USD *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="Precio USD"
                      value={
                        precioInputTexts.precio_usd !== undefined
                          ? precioInputTexts.precio_usd
                          : (formData.precio_usd !== null && formData.precio_usd !== '' ? parseFloat(formData.precio_usd).toFixed(2) : '')
                      }
                      onFocus={() => setPrecioInputTexts(prev => ({
                        ...prev,
                        precio_usd: formData.precio_usd !== null && formData.precio_usd !== '' ? String(parseFloat(formData.precio_usd)) : ''
                      }))}
                      onChangeText={(text) => {
                        setPrecioInputTexts(prev => ({ ...prev, precio_usd: text }));
                        handlePrecioChange('precio_usd', text);
                      }}
                      onBlur={() => {
                        setPrecioInputTexts(prev => {
                          const updated = { ...prev };
                          delete updated.precio_usd;
                          return updated;
                        });
                      }}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                    />
                  </View>
                </View>
              )}

              {/* Fecha de Vencimiento and Fecha de Entrada */}
              {formData.producto?.producto?.isVencible ? (
                <View style={styles.formRow}>
                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Fecha Vencimiento *</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      onPress={() => !isReadOnly && setShowDatePicker(true)}
                      disabled={isReadOnly}
                    >
                      <Text style={[styles.inputText, { color: formData.fecha_vencimiento ? colors.onSurface : colors.outline }]}>
                        {formData.fecha_vencimiento || 'Seleccionar...'}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                      />
                    )}
                  </View>

                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Fecha de Entrada</Text>
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      onPress={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                      disabled={isReadOnly}
                    >
                      <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                        {formData.fecha || 'Seleccionar...'}
                      </Text>
                    </TouchableOpacity>
                    {showFechaEntradaPicker && (
                      <DateTimePicker
                        value={formData.fecha ? new Date(formData.fecha) : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleFechaEntradaChange}
                      />
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha de Entrada</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => !isReadOnly && setShowFechaEntradaPicker(true)}
                    disabled={isReadOnly}
                  >
                    <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                      {formData.fecha || 'Seleccionar...'}
                    </Text>
                  </TouchableOpacity>
                  {showFechaEntradaPicker && (
                    <DateTimePicker
                      value={formData.fecha ? new Date(formData.fecha) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaEntradaChange}
                    />
                  )}
                </View>
              )}

              {/* Proveedor */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nombre del Proveedor</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Proveedor (opcional)"
                  value={formData.nombre_proveedor}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, nombre_proveedor: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Info about weighted average */}
              {config.applyWeightedAverageCost && isAddMode && (
                <View style={[styles.infoSection, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(20)} color="#fff" />
                  <Text style={[styles.infoText, { color: '#fff' }]}>
                    La fórmula de costo promedio ponderado está activada. El costo se calculará automáticamente.
                  </Text>
                </View>
              )}

              {/* Financial Information Section (View Mode, Edit Mode, and Add Mode) */}
              {(isViewMode || isEditMode || isAddMode) && getFinancialInfo() && (
                <View style={[styles.financialInfoSection, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.8)', borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.5)' }]}>
                  <View style={styles.financialInfoHeader}>
                    <Ionicons name="trending-up-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                    <Text style={[styles.financialInfoTitle, { color: colors.onSurface }]}>
                      Información Financiera
                    </Text>
                  </View>
                  
                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />
                  
                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total CUP</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                        ${getFinancialInfo().costoTotalCup.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Costo Total USD</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.primary }]}>
                        ${getFinancialInfo().costoTotalUsd.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Precio CUP en Tienda</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo().precioCup.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Precio USD en Tienda</Text>
                      <Text style={[styles.financialInfoValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo().precioUsd.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada CUP</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().gananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().gananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFinancialInfo().gananciaCup.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>Ganancia Esperada USD</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().gananciaUsd >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().gananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                          ${getFinancialInfo().gananciaUsd.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.financialInfoDivider, { backgroundColor: colors.outlineVariant }]} />

                  <View style={styles.financialInfoRow}>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>% Ganancia CUP</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().porcentajeGananciaCup >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().porcentajeGananciaCup >= 0 ? '#4CAF50' : '#F44336' }]}>
                          {getFinancialInfo().porcentajeGananciaCup.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.financialInfoColumn}>
                      <Text style={[styles.financialInfoLabel, { color: colors.outline }]}>% Ganancia USD</Text>
                      <View style={[styles.profitBadge, { backgroundColor: getFinancialInfo().porcentajeGananciaUsd >= 0 ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)') : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'), borderColor: getFinancialInfo().porcentajeGananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Text style={[styles.financialInfoValue, { color: getFinancialInfo().porcentajeGananciaUsd >= 0 ? '#4CAF50' : '#F44336' }]}>
                          {getFinancialInfo().porcentajeGananciaUsd.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {isViewMode && canManageEntradas && (
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, styles.editButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      if (isOfflineMode) {
                        showToast({ type: 'warning', message: 'No disponible en modo offline' });
                        return;
                      }
                      navigation.setParams({ mode: 'edit' });
                    }}
                  >
                    <Ionicons name="create-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Editar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isReadOnly && !isViewMode && (
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
            </>
          )}
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const EntradaFormScreen = () => <EntradaFormContent />;

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
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    marginTop: responsive.responsiveMargin(55),
    marginBottom: responsive.responsiveMargin(16),
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    minHeight: responsive.responsiveHeight(50),
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    height: responsive.responsiveHeight(50),
    justifyContent: 'center',
  },
  inputInner: {
    paddingHorizontal: responsive.responsivePadding(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    height: responsive.responsiveHeight(50),
  },
  inputText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
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
  formColumn40: {
    flex: 0.4,
  },
  relativeContainer: {
    position: 'relative',
    width: '100%',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(12),
    minHeight: responsive.responsiveHeight(50),
  },
  dropdownText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(8),
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: '#fff',
    maxHeight: responsive.responsiveHeight(200),
  },
  searchDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    padding: responsive.responsivePadding(8),
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(8),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(8),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.responsiveFontSize(16),
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
  },
  infoText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  cantidadInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(8),
  },
  cantidadInfoLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  cantidadOval: {
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
  },
  cantidadOvalText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  financialInfoSection: {
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    borderWidth: 1,
    marginTop: responsive.responsiveMargin(16),
  },
  financialInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  financialInfoDivider: {
    height: 1,
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoRow: {
    flexDirection: 'row',
    marginBottom: responsive.responsiveMargin(12),
  },
  financialInfoColumn: {
    flex: 1,
  },
  financialInfoLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  financialInfoValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  profitBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: responsive.responsiveWidth(500),
    borderRadius: 16,
    maxHeight: responsive.responsiveHeight(700),
    minHeight: responsive.responsiveHeight(400),
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: responsive.responsivePadding(8),
  },
  modalSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    margin: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  modalSearchInputText: {
    flex: 1,
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  modalList: {
    flex: 1,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingBottom: responsive.responsivePadding(16),
    minHeight: responsive.responsiveHeight(300),
  },
  modalListContent: {
    paddingVertical: responsive.responsivePadding(8),
  },
  modalListItem: {
    paddingVertical: responsive.responsivePadding(14),
    borderBottomWidth: 1,
  },
  modalListItemText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  modalEmptyState: {
    paddingVertical: responsive.responsivePadding(40),
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
});
