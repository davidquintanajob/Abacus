import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
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
import { createSalida, updateSalida, getSalidaById } from '../services/salidaService';
import { getProductos, getProductoById } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import configService from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SalidaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, salidaAccessLevels, salidaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const productoInputRef = useRef(null);

  const { salida, mode, productoPreSeleccionado, canViewAllSalidas: canViewAllSalidasParam } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingSalida, setIsFetchingSalida] = useState(false);
  const [isEditingProducto, setIsEditingProducto] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');
  const [displayProductoName, setDisplayProductoName] = useState('');
  const [productos, setProductos] = useState([]);
  const [productoSearchResults, setProductoSearchResults] = useState([]);
  const [isSearchingProductos, setIsSearchingProductos] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [justSelectedProducto, setJustSelectedProducto] = useState(false);
  
  const predefinedSalidaTypes = ['Perdida', 'Consumo personal', 'Baja', 'Ajuste de Inventario'];
  const [customSalidaTypes, setCustomSalidaTypes] = useState([]);
  const [showTipoSalidaDropdown, setShowTipoSalidaDropdown] = useState(false);
  const [tipoSalidaSearchText, setTipoSalidaSearchText] = useState('');

  // Helper function to get current local date in YYYY-MM-DD format
  const getCurrentLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [formData, setFormData] = useState({
    id_servicio_tienda: null,
    cantidad_total: '',
    descripcion: '',
    tipo_salida: '',
    fecha: getCurrentLocalDate(),
    producto: null,
    tienda: null,
  });

  const [originalCantidad, setOriginalCantidad] = useState(0);

  const [showFechaPicker, setShowFechaPicker] = useState(false);

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
  const canManageSalidas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && salidaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && salidaManagePermissions?.almacenero) ||
    (userRole === 'económico' && salidaManagePermissions?.economico);

  useEffect(() => {
    fetchTiendas();
    loadCustomSalidaTypes();
  }, []);

  const loadCustomSalidaTypes = async () => {
    try {
      // Load from config
      const config = await configService.getConfig();
      if (config.customSalidaTypes) {
        setCustomSalidaTypes(config.customSalidaTypes);
      }
      
      // Load from AsyncStorage as backup
      const asyncStorageTypes = await AsyncStorage.getItem('customSalidaTypes');
      if (asyncStorageTypes) {
        const parsedTypes = JSON.parse(asyncStorageTypes);
        setCustomSalidaTypes(prev => {
          const combined = [...new Set([...prev, ...parsedTypes])];
          return combined;
        });
      }
    } catch (error) {
      console.error('Error loading custom salida types:', error);
    }
  };

  const saveCustomSalidaType = async (newType) => {
    if (!newType || newType.trim() === '') return;
    
    // Check if already exists
    const allTypes = [...predefinedSalidaTypes, ...customSalidaTypes];
    if (allTypes.includes(newType.trim())) return;
    
    const updatedTypes = [...customSalidaTypes, newType.trim()];
    setCustomSalidaTypes(updatedTypes);
    
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('customSalidaTypes', JSON.stringify(updatedTypes));
      
      // Save to config
      const config = await configService.getConfig();
      const updatedConfig = {
        ...config,
        customSalidaTypes: updatedTypes,
      };
      await configService.updateConfig(updatedConfig);
    } catch (error) {
      console.error('Error saving custom salida type:', error);
    }
  };

  useEffect(() => {
    const fetchCompleteSalida = async () => {
      if (salida?.id_salida) {
        try {
          setIsFetchingSalida(true);
          
          let completeSalida;
          if (isOfflineMode) {
            completeSalida = salida;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeSalida = await getSalidaById(salida.id_salida);
          }
          
          // Product data is already included in the salida response from backend
          // The servicioTienda relation includes the servicio (product) with all necessary data
          const productoCompleto = completeSalida.servicioTienda?.servicio;
          
          // Add tiendas_servicio to the product using the servicioTienda data from the salida
          // This provides the stock and cost information needed for the specific tienda
          if (productoCompleto && completeSalida.servicioTienda) {
            productoCompleto.tiendas_servicio = [completeSalida.servicioTienda];
          }
          
          setFormData({
            id_servicio_tienda: completeSalida.id_servicio_tienda,
            cantidad_total: completeSalida.cantidad_total.toString(),
            descripcion: completeSalida.descripcion || '',
            tipo_salida: completeSalida.tipo_salida || 'Venta',
            fecha: completeSalida.fecha ? formatDateToLocal(completeSalida.fecha) : formatDateToLocal(new Date().toISOString()),
            producto: productoCompleto,
            tienda: completeSalida.servicioTienda?.tienda,
          });
          
          setDisplayProductoName((productoCompleto?.nombre || '').trimEnd());
          setOriginalCantidad(completeSalida.cantidad_total);
        } catch (err) {
          console.error('[fetchCompleteSalida] Error:', err);
          console.error('[fetchCompleteSalida] Error message:', err.message);
        } finally {
          setIsFetchingSalida(false);
        }
      }
    };

    fetchCompleteSalida();
  }, [salida?.id_salida, isOfflineMode]);

  useEffect(() => {
    if (productoPreSeleccionado && isAddMode) {
      setFormData(prev => ({
        ...prev,
        producto: productoPreSeleccionado,
      }));
      
      setProductoSearchText((productoPreSeleccionado.nombre || '').trimEnd());
      
      // If user only has access to one store, automatically select it
      const userRole = user?.rol?.toLowerCase();
      const canViewAllSalidas = 
        canViewAllSalidasParam !== undefined ? canViewAllSalidasParam :
        (userRole === 'administrador' ||
        (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores'));
      
      if (!canViewAllSalidas && user?.id_tienda && tiendas.length === 1) {
        const userTienda = tiendas.find(t => t.id_tienda === user.id_tienda);
        if (userTienda) {
          setFormData(prev => ({
            ...prev,
            tienda: userTienda,
          }));
          setTiendaSearchText(userTienda.nombre || '');
        }
      }
    }
  }, [productoPreSeleccionado, isAddMode, tiendas, user, salidaAccessLevels, canViewAllSalidasParam]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        setTiendas([]);
        return;
      }
      
      const userRole = user?.rol?.toLowerCase();
      const canViewAllSalidas = 
        canViewAllSalidasParam !== undefined ? canViewAllSalidasParam :
        (userRole === 'administrador' ||
        (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores'));
      
      const data = await getTiendas({}, 1, 1000);
      let allTiendas = data.data?.filter(t => t.activo === true) || [];
      
      if (user?.id_tienda && !canViewAllSalidas) {
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

  const handleSave = async () => {
    // Validaciones
    if (!formData.producto) {
      showToast({ type: 'warning', message: 'Debe seleccionar un producto' });
      return;
    }
    if (!formData.tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar una tienda' });
      return;
    }
    if (!formData.cantidad_total || parseFloat(formData.cantidad_total) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que 0' });
      return;
    }
    if (!formData.descripcion || formData.descripcion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar una descripción' });
      return;
    }
    if (!formData.tipo_salida || formData.tipo_salida.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar el tipo de salida' });
      return;
    }

    // Validar si el producto tiene relación con la tienda
    const productoTienda = formData.producto?.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda?.id_tienda
    );

    if (!productoTienda) {
      showToast({ type: 'warning', message: 'El producto no tiene relación con esta tienda. Primero debe agregar el producto a la tienda mediante una entrada.' });
      return;
    }

    // Validar stock disponible
    const cantidadDisponible = parseFloat(productoTienda.cantidad) || 0;
    const cantidadSolicitada = parseFloat(formData.cantidad_total);
    
    // En modo edición, el stock disponible efectivo es el actual + cantidad original (que se devolverá)
    const stockDisponibleEfectivo = isEditMode ? cantidadDisponible + originalCantidad : cantidadDisponible;
    
    if (cantidadSolicitada > stockDisponibleEfectivo) {
      Alert.alert(
        'Stock Insuficiente',
        isEditMode 
          ? `Solo hay ${cantidadDisponible} unidades disponibles + ${originalCantidad} unidades de la salida original (${stockDisponibleEfectivo} total). No puede solicitar ${cantidadSolicitada} unidades.`
          : `Solo hay ${cantidadDisponible} unidades disponibles en la tienda "${formData.tienda.nombre}". ¿Desea continuar con la salida de ${cantidadSolicitada} unidades?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: isEditMode ? 'Entendido' : 'Continuar',
            style: isEditMode ? 'default' : 'destructive',
            onPress: isEditMode ? () => {} : () => executeSave()
          }
        ]
      );
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    try {
      setIsSaving(true);

      const productoTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );

      const id_servicio_tienda = productoTienda?.id_servicio_tienda;

      if (!id_servicio_tienda) {
        throw new Error('Error al obtener relación producto-tienda');
      }

      // Format date to ISO with local time to avoid timezone issues
      const formatFechaForServer = (dateString) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-');
        // Use noon local time to avoid timezone issues
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0).toISOString();
      };

      const salidaData = {
        id_servicio_tienda,
        cantidad_total: parseFloat(formData.cantidad_total),
        descripcion: formData.descripcion,
        tipo_salida: formData.tipo_salida,
        fecha: formatFechaForServer(formData.fecha),
        id_usuario: user.id_usuario,
      };

      if (isEditMode) {
        await updateSalida(salida.id_salida, salidaData);
        showToast({ type: 'success', message: 'Salida actualizada correctamente' });
      } else {
        await createSalida(salidaData);
        showToast({ type: 'success', message: 'Salida creada correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
      console.error('[executeSave] Error:', err);
      showToast({ type: 'error', message: err.message || 'Error al guardar salida', code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowFechaPicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setFormData(prev => ({ ...prev, fecha: formattedDate }));
    }
  };

  const handleTiendaSelect = (tienda) => {
    setFormData(prev => ({
      ...prev,
      tienda,
    }));

    setShowTiendaDropdown(false);
    setTiendaSearchText('');
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only trigger search if user is actively editing the producto field
      if (!isEditingProducto) {
        return;
      }
      
      // Prevent search immediately after selecting a product
      if (justSelectedProducto) {
        // Don't reset justSelectedProducto here - it will be reset when user types again
        return;
      }
      
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
  }, [productoSearchText, formData.producto, isEditingProducto, justSelectedProducto]);

  const handleProductoSelect = (producto) => {
    setFormData(prev => ({
      ...prev,
      producto,
    }));
    
    setDisplayProductoName(producto.nombre.trimEnd());
    setProductoSearchText('');
    setIsEditingProducto(false);
    setShowProductoDropdown(false);
    setProductoSearchResults([]);
    setJustSelectedProducto(true);
    
    // Dismiss keyboard and blur the input to prevent unnecessary API requests
    Keyboard.dismiss();
    if (productoInputRef.current) {
      productoInputRef.current.blur();
    }
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const getStockInfo = () => {
    if (!formData.producto || !formData.tienda) {
      return null;
    }
    
    // Try to find servicioTienda in producto's tiendas_servicio
    let servicioTienda = formData.producto.tiendas_servicio?.find(
      ts => ts.id_tienda === formData.tienda.id_tienda
    );
    
    // If not found and we have id_servicio_tienda (edit mode), try to use that
    if (!servicioTienda && formData.id_servicio_tienda) {
      // In edit mode, the servicioTienda data might be in the original salida data
      // We'll use the tienda's current stock from the producto data
      servicioTienda = formData.producto.tiendas_servicio?.find(
        ts => ts.id_tienda === formData.tienda.id_tienda
      );
    }
    
    // If no relationship exists, use costs from any tienda (cost is unique across all tiendas)
    let costoCup = 0;
    let costoUsd = 0;
    
    if (servicioTienda) {
      costoCup = parseFloat(servicioTienda.costo_cup) || 0;
      costoUsd = parseFloat(servicioTienda.costo_usd) || 0;
    } else {
      // Use costs from first available tienda (cost is unique)
      const firstTiendaServicio = formData.producto.tiendas_servicio?.[0];
      costoCup = parseFloat(firstTiendaServicio?.costo_cup) || 0;
      costoUsd = parseFloat(firstTiendaServicio?.costo_usd) || 0;
    }
    
    const currentStock = servicioTienda ? (parseFloat(servicioTienda.cantidad) || 0) : 0;
    const newCantidad = parseFloat(formData.cantidad_total) || 0;
    const cantidadDiff = originalCantidad - newCantidad;
    
    return {
      cantidad: currentStock,
      cantidadDiff: cantidadDiff,
      costo_cup: costoCup,
      costo_usd: costoUsd,
    };
  };

  const getFinancialInfo = () => {
    if (!formData.cantidad_total) {
      return null;
    }

    const stockInfo = getStockInfo();
    if (!stockInfo) return null;

    const cantidad = parseFloat(formData.cantidad_total) || 0;
    const costoCup = stockInfo.costo_cup;
    const costoUsd = stockInfo.costo_usd;

    const costoTotalCup = costoCup * cantidad;
    const costoTotalUsd = costoUsd * cantidad;
    
    const originalCostoTotalCup = costoCup * originalCantidad;
    const originalCostoTotalUsd = costoUsd * originalCantidad;
    
    const costoTotalCupDiff = originalCostoTotalCup - costoTotalCup;
    const costoTotalUsdDiff = originalCostoTotalUsd - costoTotalUsd;

    return {
      costoTotalCup: !isNaN(costoTotalCup) ? costoTotalCup : 0,
      costoTotalUsd: !isNaN(costoTotalUsd) ? costoTotalUsd : 0,
      costoCup: !isNaN(costoCup) ? costoCup : 0,
      costoUsd: !isNaN(costoUsd) ? costoUsd : 0,
      costoTotalCupDiff: !isNaN(costoTotalCupDiff) ? costoTotalCupDiff : 0,
      costoTotalUsdDiff: !isNaN(costoTotalUsdDiff) ? costoTotalUsdDiff : 0,
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
        title={isViewMode ? 'Información de Salida' : isEditMode ? 'Editar Salida' : 'Agregar Salida'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
        keyboardVerticalOffset={responsive.headerHeight}
        enabled={true}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {isFetchingSalida ? (
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
                    ref={productoInputRef}
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar producto..."
                    value={isEditingProducto ? productoSearchText : displayProductoName}
                    onChangeText={(text) => {
                      setProductoSearchText(text);
                      setJustSelectedProducto(false);
                      if (!isEditingProducto) {
                        setIsEditingProducto(true);
                      }
                    }}
                    onFocus={() => {
                      if (!isReadOnly && !justSelectedProducto) {
                        setIsEditingProducto(true);
                        setProductoSearchText(displayProductoName);
                      }
                    }}
                    onBlur={() => {
                      setIsEditingProducto(false);
                      if (!formData.producto) {
                        setDisplayProductoName(productoSearchText);
                      } else if (!justSelectedProducto) {
                        setProductoSearchText('');
                        setDisplayProductoName(formData.producto.nombre);
                      }
                    }}
                    editable={!isReadOnly}
                    autoFocus={false}
                  />
                  {showProductoDropdown && productoSearchResults.length > 0 && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      {isSearchingProductos && (
                        <View style={styles.dropdownLoadingContainer}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Buscando...</Text>
                        </View>
                      )}
                      {!isSearchingProductos && productoSearchResults.map((producto) => (
                        <TouchableOpacity
                          key={producto.id_servicio}
                          style={styles.dropdownItem}
                          onPress={() => handleProductoSelect(producto)}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Tienda Selection and Cantidad Total */}
              <View style={styles.formRow}>
                <View style={[styles.formColumn60, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                    onPress={() => !isReadOnly && setShowTiendaDropdown(!showTiendaDropdown)}
                    disabled={isReadOnly}
                  >
                    <Text style={[styles.dropdownText, { color: formData.tienda ? colors.onSurface : colors.outline }]}>
                      {formData.tienda?.nombre || 'Seleccionar tienda'}
                    </Text>
                    {!isReadOnly && (
                      <Ionicons 
                        name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                        size={responsive.responsiveWidth(20)} 
                        color={colors.outline} 
                      />
                    )}
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
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad Total *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad"
                    value={formData.cantidad_total}
                    onChangeText={(text) => {
                      // Remove negative sign immediately
                      const sanitizedText = text.replace(/-/g, '');
                      
                      const stockInfo = getStockInfo();
                      if (stockInfo) {
                        const maxValue = isEditMode ? stockInfo.cantidad + originalCantidad : stockInfo.cantidad;
                        const newValue = parseFloat(sanitizedText);
                        
                        // Allow empty input for editing
                        if (sanitizedText === '') {
                          setFormData(prev => ({ ...prev, cantidad_total: sanitizedText }));
                          return;
                        }
                        
                        // Validate against max value
                        if (!isNaN(newValue) && newValue > maxValue) {
                          showToast({ 
                            type: 'warning', 
                            message: `La cantidad no puede exceder ${maxValue} (stock disponible${isEditMode ? ' + cantidad original' : ''})` 
                          });
                          return; // Don't update if exceeds max
                        }
                      }
                      setFormData(prev => ({ ...prev, cantidad_total: sanitizedText }));
                    }}
                    keyboardType="numeric"
                    editable={!isReadOnly}
                    autoFocus={false}
                  />
                </View>
              </View>

              {/* Stock Info */}
              {canManageSalidas && formData.producto && formData.tienda && (
                <View style={[styles.infoCard, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}>
                  <Text style={[styles.infoCardTitle, { color: colors.primary }]}>Información de Stock</Text>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Cantidad disponible:</Text>
                    <View style={styles.infoValueWithDiff}>
                      <Text style={[styles.infoValue, { color: colors.primary }]}>
                        {getStockInfo()?.cantidad || 0}
                      </Text>
                      {isEditMode && getStockInfo()?.cantidadDiff !== 0 && (
                        <Text style={[styles.infoDiff, { color: getStockInfo()?.cantidadDiff > 0 ? '#4CAF50' : '#F44336' }]}>
                          {getStockInfo()?.cantidadDiff > 0 ? '+' : ''}{getStockInfo()?.cantidadDiff}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Costo unitario CUP:</Text>
                    <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                      ${getStockInfo()?.costo_cup?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.onSurface }]}>Costo unitario USD:</Text>
                    <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                      ${getStockInfo()?.costo_usd?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Tipo de Salida and Fecha */}
              <View style={styles.formRow}>
                <View style={[styles.formColumn60, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tipo de Salida *</Text>
                  <View style={styles.relativeContainer}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="Seleccionar o escribir tipo..."
                      value={formData.tipo_salida}
                      onChangeText={(text) => {
                        setFormData(prev => ({ ...prev, tipo_salida: text }));
                        setTipoSalidaSearchText(text);
                      }}
                      onFocus={() => !isReadOnly && setShowTipoSalidaDropdown(true)}
                      onBlur={() => {
                        setShowTipoSalidaDropdown(false);
                        // Save custom type if it doesn't exist in predefined or custom types
                        if (formData.tipo_salida && formData.tipo_salida.trim() !== '') {
                          const allTypes = [...predefinedSalidaTypes, ...customSalidaTypes];
                          if (!allTypes.includes(formData.tipo_salida.trim())) {
                            saveCustomSalidaType(formData.tipo_salida);
                          }
                        }
                      }}
                      editable={!isReadOnly}
                      autoFocus={false}
                    />
                    {showTipoSalidaDropdown && (
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
                            placeholder="Buscar tipo..."
                            value={tipoSalidaSearchText}
                            onChangeText={setTipoSalidaSearchText}
                          />
                        </View>
                        {[...predefinedSalidaTypes, ...customSalidaTypes]
                          .filter(type => type.toLowerCase().includes(tipoSalidaSearchText.toLowerCase()))
                          .map((type, index) => (
                            <TouchableOpacity
                              key={type}
                              style={[styles.dropdownItem, index === ([...predefinedSalidaTypes, ...customSalidaTypes].filter(t => t.toLowerCase().includes(tipoSalidaSearchText.toLowerCase())).length - 1) && styles.dropdownItemLast]}
                              onPress={() => {
                                setFormData(prev => ({ ...prev, tipo_salida: type }));
                                setShowTipoSalidaDropdown(false);
                                setTipoSalidaSearchText('');
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{type}</Text>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.formColumn40, styles.formGroup]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => !isReadOnly && setShowFechaPicker(true)}
                    disabled={isReadOnly}
                  >
                    <Text style={[styles.inputText, { color: formData.fecha ? colors.onSurface : colors.outline }]}>
                      {formData.fecha || 'Seleccionar fecha'}
                    </Text>
                  </TouchableOpacity>
                  {showFechaPicker && (
                    <DateTimePicker
                      value={formData.fecha ? new Date(formData.fecha) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                    />
                  )}
                </View>
              </View>

              {/* Descripción */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Descripción *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Descripción de la salida"
                  value={formData.descripcion}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, descripcion: text }))}
                  multiline
                  numberOfLines={3}
                  editable={!isReadOnly}
                  autoFocus={false}
                />
              </View>

              {/* Financial Summary */}
              {canManageSalidas && formData.cantidad_total && getFinancialInfo() && (
                <View style={[styles.summaryCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant }]}>
                  <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>Resumen Financiero</Text>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.outline }]}>Costo total CUP:</Text>
                    <View style={styles.infoValueWithDiff}>
                      <Text style={[styles.summaryValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo()?.costoTotalCup?.toFixed(2) || '0.00'}
                      </Text>
                      {isEditMode && getFinancialInfo()?.costoTotalCupDiff !== 0 && (
                        <Text style={[styles.infoDiff, { color: getFinancialInfo()?.costoTotalCupDiff > 0 ? '#4CAF50' : '#F44336' }]}>
                          {getFinancialInfo()?.costoTotalCupDiff > 0 ? '+' : ''}${getFinancialInfo()?.costoTotalCupDiff?.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.outline }]}>Costo total USD:</Text>
                    <View style={styles.infoValueWithDiff}>
                      <Text style={[styles.summaryValue, { color: colors.onSurface }]}>
                        ${getFinancialInfo()?.costoTotalUsd?.toFixed(2) || '0.00'}
                      </Text>
                      {isEditMode && getFinancialInfo()?.costoTotalUsdDiff !== 0 && (
                        <Text style={[styles.infoDiff, { color: getFinancialInfo()?.costoTotalUsdDiff > 0 ? '#4CAF50' : '#F44336' }]}>
                          {getFinancialInfo()?.costoTotalUsdDiff > 0 ? '+' : ''}${getFinancialInfo()?.costoTotalUsdDiff?.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {!isReadOnly && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.saveButtonText, { color: '#fff' }]}>
                        {isEditMode ? 'Actualizar' : 'Guardar'}
                      </Text>
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

export const SalidaFormScreen = () => <SalidaFormContent />;

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
    paddingTop: responsive.responsivePadding(75),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
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
  formColumn40: {
    flex: 0.4,
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
  inputText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  textArea: {
    height: responsive.responsiveHeight(80),
    textAlignVertical: 'top',
  },
  relativeContainer: {
    position: 'relative',
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
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(4),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
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
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  dropdownLoadingText: {
    fontSize: responsive.fontSizes.body,
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
  infoCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    borderWidth: 1,
  },
  infoCardTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  infoLabel: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  infoValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  infoValueWithDiff: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  infoDiff: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  summaryCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(8),
  },
  summaryLabel: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  summaryValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  saveButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
