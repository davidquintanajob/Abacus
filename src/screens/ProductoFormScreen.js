import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
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
import { createProducto, updateProducto, getProductoById } from '../services/productoService';
import { getTiendas } from '../services/tiendaService';
import { configService } from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

const ProductoFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { producto, mode } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || (isViewMode && !canEditProduct);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingProducto, setIsFetchingProducto] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(null);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNota, setNewNota] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  const [priceInputTexts, setPriceInputTexts] = useState({});
  const [generalPriceInputTexts, setGeneralPriceInputTexts] = useState({});
  
  const [formData, setFormData] = useState({
    nombre: producto?.nombre || '',
    categoria: producto?.categoria || '',
    esvendible: producto?.esvendible !== undefined ? producto.esvendible : true,
    nota: producto?.nota || '',
    imagen: producto?.producto?.imagen || '',
    sufijo: producto?.producto?.sufijo || '',
    isVencible: producto?.producto?.isVencible !== undefined ? producto.producto.isVencible : true,
    unidad_medida: producto?.producto?.unidad_medida || '',
    productoTiendaList: producto?.tiendas_servicio || [],
    codigoList: producto?.codigos || [],
    precio_cup_general: null,
    precio_usd_general: null,
    costo_cup_general: null,
    costo_usd_general: null,
  });

  const [isCodesExpanded, setIsCodesExpanded] = useState(false);
  const [isGeneralPricesExpanded, setIsGeneralPricesExpanded] = useState(false);
  const [isPricesExpanded, setIsPricesExpanded] = useState(false);

  useEffect(() => {
    if (formData.codigoList.length > 0) {
      setIsCodesExpanded(true);
    }
    if (formData.productoTiendaList.length > 0) {
      setIsPricesExpanded(true);
    }
  }, [formData.codigoList.length, formData.productoTiendaList.length]);

  const handleGeneralPriceBlur = () => {
    const hasAllGeneralPrices = 
      formData.precio_cup_general !== null && 
      formData.precio_cup_general !== '' &&
      formData.precio_usd_general !== null && 
      formData.precio_usd_general !== '' &&
      (formData.costo_cup_general !== null && formData.costo_cup_general !== '' || !canViewCosts) &&
      (formData.costo_usd_general !== null && formData.costo_usd_general !== '' || !canViewCosts);

    if (hasAllGeneralPrices && formData.productoTiendaList.length === 0) {
      const newProductoTiendaList = tiendas.filter(tienda => tienda.activo === true).map(tienda => {
        const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(formData.precio_cup_general);
        const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(formData.precio_usd_general);
        const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(formData.costo_cup_general)) : 0;
        const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(formData.costo_usd_general)) : 0;
        
        return {
          id_tienda: tienda.id_tienda,
          precio_cup: precioCup,
          precio_usd: precioUsd,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        };
      });
      
      setFormData(prev => ({
        ...prev,
        productoTiendaList: newProductoTiendaList
      }));
      setIsPricesExpanded(true);
    } else if (hasAllGeneralPrices && formData.productoTiendaList.length > 0) {
      const precioCup = typeof formData.precio_cup_general === 'number' ? formData.precio_cup_general : parseFloat(formData.precio_cup_general);
      const precioUsd = typeof formData.precio_usd_general === 'number' ? formData.precio_usd_general : parseFloat(formData.precio_usd_general);
      const costoCup = canViewCosts ? (typeof formData.costo_cup_general === 'number' ? formData.costo_cup_general : parseFloat(formData.costo_cup_general)) : 0;
      const costoUsd = canViewCosts ? (typeof formData.costo_usd_general === 'number' ? formData.costo_usd_general : parseFloat(formData.costo_usd_general)) : 0;
      
      setFormData(prev => ({
        ...prev,
        productoTiendaList: prev.productoTiendaList.map(item => ({
          ...item,
          precio_cup: precioCup,
          precio_usd: precioUsd,
          costo_cup: costoCup,
          costo_usd: costoUsd,
        }))
      }));
    }
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const isEconomico = user?.rol === 'Económico';
  const isDependiente = user?.rol === 'Dependiente';
  const isAlmacenero = user?.rol === 'Almacenero';
  
  const canEditProduct = isAdmin;
  const canEditCodes = isAdmin;
  const canViewCosts = !isDependiente && !isAlmacenero;

  useEffect(() => {
    fetchTiendas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchCompleteProducto = async () => {
      if (producto?.id_servicio) {
        try {
          setIsFetchingProducto(true);
          
          let completeProducto;
          
          if (isOfflineMode) {
            completeProducto = producto;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeProducto = await getProductoById(producto.id_servicio);
          }
          
          const userRole = user?.rol?.toLowerCase();
          const canViewAllStores = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && permissions?.dependiente) ||
            (userRole === 'almacenero' && permissions?.almacenero) ||
            (userRole === 'económico' && permissions?.economico);

          let productoTiendaList = completeProducto.tiendas_servicio || [];
          
          if (!canViewAllStores && user?.id_tienda) {
            productoTiendaList = productoTiendaList.filter(ts => ts.id_tienda === user.id_tienda);
          }
          
          setFormData({
            nombre: completeProducto.nombre || '',
            categoria: completeProducto.categoria || '',
            esvendible: completeProducto.esvendible !== undefined ? completeProducto.esvendible : true,
            nota: completeProducto.nota || '',
            imagen: completeProducto.producto?.imagen || '',
            sufijo: completeProducto.producto?.sufijo || '',
            isVencible: completeProducto.producto?.isVencible !== undefined ? completeProducto.producto.isVencible : true,
            unidad_medida: completeProducto.producto?.unidad_medida || '',
            productoTiendaList: productoTiendaList,
            codigoList: completeProducto.codigos || [],
            precio_cup_general: null,
            precio_usd_general: null,
            costo_cup_general: null,
            costo_usd_general: null,
          });
        } catch (err) {
          console.error('Error fetching complete producto:', err);
          showToast({ type: 'error', message: 'Error al cargar datos del producto' });
        } finally {
          setIsFetchingProducto(false);
        }
      }
    };

    fetchCompleteProducto();
  }, [producto?.id_servicio, canViewCosts, user?.id_tienda, permissions, isOfflineMode]);

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        setTiendas([]);
        return;
      }
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      console.error('Error fetching tiendas:', err);
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
      console.error('Error fetching config:', err);
    }
  };

  const handleSave = async () => {
    console.log('handleSave iniciado');
    console.log('formData actual:', JSON.stringify(formData, null, 2));
    
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
    if (!formData.sufijo.trim()) {
      showToast({ type: 'warning', message: 'El sufijo es requerido' });
      return;
    }
    if (formData.sufijo.length < 1 || formData.sufijo.length > 50) {
      showToast({ type: 'error', message: 'El sufijo debe tener entre 1 y 50 caracteres' });
      return;
    }
    if (!formData.codigoList || formData.codigoList.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un código' });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSend = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        esvendible: formData.esvendible,
        nota: formData.nota || null,
        imagen: formData.imagen || null,
        sufijo: formData.sufijo,
        isVencible: formData.isVencible,
        unidad_medida: formData.unidad_medida || null,
        codigoList: formData.codigoList,
        productoTiendaList: (() => {
          const toFixed5 = (value) => {
            if (value === null || value === undefined || value === '') return 0;
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? 0 : parseFloat(num.toFixed(5));
          };

          let baseList = [];
          if (formData.precio_cup_general !== null || formData.precio_usd_general !== null || 
              formData.costo_cup_general !== null || formData.costo_usd_general !== null) {
            baseList = tiendas.filter(tienda => tienda.activo === true).map(tienda => ({
              id_tienda: tienda.id_tienda,
              precio_cup: toFixed5(formData.precio_cup_general),
              precio_usd: toFixed5(formData.precio_usd_general),
              costo_cup: toFixed5(formData.costo_cup_general),
              costo_usd: toFixed5(formData.costo_usd_general),
            }));
          }
          
          if (formData.productoTiendaList.length > 0) {
            formData.productoTiendaList.forEach(specific => {
              if (specific.id_tienda === null) return;
              
              const existingIndex = baseList.findIndex(item => item.id_tienda === specific.id_tienda);
              if (existingIndex >= 0) {
                baseList[existingIndex] = {
                  ...baseList[existingIndex],
                  precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
                  precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
                  costo_cup: specific.costo_cup !== null ? toFixed5(specific.costo_cup) : toFixed5(formData.costo_cup_general),
                  costo_usd: specific.costo_usd !== null ? toFixed5(specific.costo_usd) : toFixed5(formData.costo_usd_general),
                };
              } else {
                baseList.push({
                  id_tienda: specific.id_tienda,
                  precio_cup: specific.precio_cup !== null ? toFixed5(specific.precio_cup) : toFixed5(formData.precio_cup_general),
                  precio_usd: specific.precio_usd !== null ? toFixed5(specific.precio_usd) : toFixed5(formData.precio_usd_general),
                  costo_cup: specific.costo_cup !== null ? toFixed5(specific.costo_cup) : toFixed5(formData.costo_cup_general),
                  costo_usd: specific.costo_usd !== null ? toFixed5(specific.costo_usd) : toFixed5(formData.costo_usd_general),
                });
              }
            });
          }
          
          console.log('productoTiendaList generado:', JSON.stringify(baseList, null, 2));
          return baseList;
        })(),
      };

      console.log('Datos a enviar:', JSON.stringify(dataToSend, null, 2));

      if (isEditMode) {
        await updateProducto(producto.id_servicio, dataToSend);
        showToast({ type: 'success', message: 'Producto actualizado correctamente' });
      } else {
        await createProducto(dataToSend);
        showToast({ type: 'success', message: 'Producto creado correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
      console.error('Error en handleSave:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
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
    setIsCodesExpanded(true);
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para escanear códigos' });
        return;
      }
    }
    
    setShowScannerModal(true);
  };

  const handleOpenBarcodeScanner = () => {
    navigation.navigate('BarcodeScanner', {
      existingCodes: formData.codigoList,
      onCodeScanned: (scannedCodes) => {
        setFormData(prev => ({
          ...prev,
          codigoList: scannedCodes
        }));
        setIsCodesExpanded(true);
        showToast({ type: 'success', message: `${scannedCodes.length} códigos actualizados` });
      }
    });
  };

  const handleBarcodeScanned = ({ data }) => {
    setNewCodigo(data);
    setShowScannerModal(false);
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
  };

  const handleDeleteCode = (index) => {
    Alert.alert(
      'Eliminar Código',
      '¿Estás seguro de que quieres eliminar este código?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({
              ...prev,
              codigoList: prev.codigoList.filter((_, i) => i !== index)
            }));
          },
        },
      ]
    );
  };

  const handleAddTiendaProducto = () => {
    setFormData(prev => ({
      ...prev,
      productoTiendaList: [
        ...prev.productoTiendaList,
        { 
          id_tienda: null, 
          precio_cup: prev.precio_cup_general, 
          precio_usd: prev.precio_usd_general, 
          costo_cup: prev.costo_cup_general, 
          costo_usd: prev.costo_usd_general 
        }
      ]
    }));
  };

  const handleRemoveTiendaProducto = (index) => {
    setFormData(prev => ({
      ...prev,
      productoTiendaList: prev.productoTiendaList.filter((_, i) => i !== index)
    }));
    setPriceInputTexts(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const k = parseInt(key);
        if (k < index) updated[k] = prev[k];
        else if (k > index) updated[k - 1] = prev[k];
      });
      return updated;
    });
  };

  const handleTiendaProductoChange = (index, field, value) => {
    setFormData(prev => {
      const updatedList = prev.productoTiendaList.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          if (exchangeRate && field === 'precio_cup' && value !== null) {
            const cupValue = parseFloat(value) || 0;
            updatedItem.precio_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
          }
          
          if (exchangeRate && field === 'costo_cup' && value !== null) {
            const cupValue = parseFloat(value) || 0;
            updatedItem.costo_usd = parseFloat((cupValue / exchangeRate).toFixed(5));
          }
          
          if (exchangeRate && field === 'precio_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.precio_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
          }
          
          if (exchangeRate && field === 'costo_usd' && value !== null) {
            const usdValue = parseFloat(value) || 0;
            updatedItem.costo_cup = parseFloat((usdValue * exchangeRate).toFixed(5));
          }
          
          return updatedItem;
        }
        return item;
      });
      
      return { ...prev, productoTiendaList: updatedList };
    });
  };

  const handleGeneralPriceChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      if (exchangeRate && field === 'precio_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.precio_usd_general = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_cup_general' && value !== null) {
        const cupValue = parseFloat(value) || 0;
        updated.costo_usd_general = parseFloat((cupValue / exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'precio_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.precio_cup_general = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      if (exchangeRate && field === 'costo_usd_general' && value !== null) {
        const usdValue = parseFloat(value) || 0;
        updated.costo_cup_general = parseFloat((usdValue * exchangeRate).toFixed(5));
      }
      
      return updated;
    });
  };

  const handlePickImage = () => {
    setShowImagePickerModal(true);
  };

  const handlePickFromGallery = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso para acceder a la galería' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.cancelled && result.assets && result.assets[0]) {
        const base64 = result.assets[0].base64;
        setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${base64}` }));
        showToast({ type: 'success', message: 'Imagen seleccionada correctamente' });
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showToast({ type: 'error', message: 'Error al seleccionar la imagen' });
    }
  };

  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso para acceder a la cámara' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.cancelled && result.assets && result.assets[0]) {
        const base64 = result.assets[0].base64;
        setFormData(prev => ({ ...prev, imagen: `data:image/jpeg;base64,${base64}` }));
        showToast({ type: 'success', message: 'Foto tomada correctamente' });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showToast({ type: 'error', message: 'Error al tomar la foto' });
    }
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Eliminar Imagen',
      '¿Estás seguro de que quieres eliminar la imagen del producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setFormData(prev => ({ ...prev, imagen: '' }));
            showToast({ type: 'success', message: 'Imagen eliminada' });
          },
        },
      ]
    );
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.activo === true && tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

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
        title={isViewMode ? 'Información del Producto' : isEditMode ? 'Editar Producto' : 'Agregar Producto'}
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
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isReadOnly && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Nombre del producto"
              value={formData.nombre}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
              editable={!isReadOnly}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Categoría *</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Categoría"
                value={formData.categoria}
                onChangeText={(text) => setFormData(prev => ({ ...prev, categoria: text }))}
                editable={!isReadOnly}
              />
            </View>

            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Sufijo *</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Sufijo del producto"
                value={formData.sufijo}
                onChangeText={(text) => setFormData(prev => ({ ...prev, sufijo: text }))}
                editable={!isReadOnly}
                textAlignVertical="center"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Imagen</Text>
            <View style={styles.imageContainer}>
              {formData.imagen ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: formData.imagen }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  {!isReadOnly && (
                    <TouchableOpacity
                      style={[styles.imageRemoveButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                      onPress={handleRemoveImage}
                    >
                      <Ionicons name="close" size={responsive.responsiveWidth(20)} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.imagePlaceholder, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={handlePickImage}
                  disabled={isReadOnly}
                >
                  <Ionicons name="image-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
                  <Text style={[styles.imagePlaceholderText, { color: colors.outline }]}>
                    {isReadOnly ? 'Sin imagen' : 'Seleccionar imagen'}
                  </Text>
                </TouchableOpacity>
              )}
              {!isReadOnly && formData.imagen && (
                <TouchableOpacity
                  style={[styles.imageChangeButton, { backgroundColor: colors.primary }]}
                  onPress={handlePickImage}
                >
                  <Ionicons name="camera-outline" size={responsive.responsiveWidth(18)} color="#fff" />
                  <Text style={[styles.imageChangeButtonText, { color: '#fff' }]}>Cambiar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Unidad de Medida</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Unidad de medida (opcional)"
                value={formData.unidad_medida}
                onChangeText={(text) => setFormData(prev => ({ ...prev, unidad_medida: text }))}
                editable={!isReadOnly}
              />
            </View>

            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isReadOnly && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Nota (opcional)"
                value={formData.nota}
                onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
                editable={!isReadOnly}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Es Vencible</Text>
              <TouchableOpacity
                style={styles.statusSwitchContainer}
                onPress={() => !isReadOnly && setFormData(prev => ({ ...prev, isVencible: !prev.isVencible }))}
                disabled={isReadOnly}
              >
                <View style={[
                  styles.statusSwitch,
                  { backgroundColor: formData.isVencible ? '#4CAF50' : '#F44336' },
                  isReadOnly && styles.inputDisabled
                ]}>
                  <View style={[
                    styles.statusSwitchKnob,
                    { transform: [{ translateX: formData.isVencible ? 0 : responsive.responsiveWidth(28) }] }
                  ]}>
                    <Text style={[
                      styles.statusSwitchText,
                      { color: formData.isVencible ? '#4CAF50' : '#F44336' }
                    ]}>
                      {formData.isVencible ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.formColumn, styles.formGroup]}>
              <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
              <TouchableOpacity
                style={[styles.statusSwitchContainer, { marginLeft: responsive.responsiveMargin(0) }]}
                onPress={() => !isReadOnly && setFormData(prev => ({ ...prev, esvendible: !prev.esvendible }))}
                disabled={isReadOnly}
              >
                <View style={[
                  styles.statusSwitch,
                  { backgroundColor: formData.esvendible ? '#4CAF50' : '#F44336' },
                  isReadOnly && styles.inputDisabled
                ]}>
                  <View style={[
                    styles.statusSwitchKnob,
                    { transform: [{ translateX: formData.esvendible ? 0 : responsive.responsiveWidth(28) }] }
                  ]}>
                    <Text style={[
                      styles.statusSwitchText,
                      { color: formData.esvendible ? '#4CAF50' : '#F44336' }
                    ]}>
                      {formData.esvendible ? 'Vendible' : 'No vendible'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Códigos Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Códigos</Text>
              <View style={styles.sectionActions}>
                {canEditCodes && (
                  <TouchableOpacity
                    style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                    onPress={handleOpenBarcodeScanner}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsCodesExpanded(!isCodesExpanded)}
                >
                  <Ionicons 
                    name={isCodesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isCodesExpanded && (
              <>
                {formData.codigoList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay códigos agregados
                  </Text>
                ) : (
                  formData.codigoList.map((codigo, index) => (
                    <View key={index} style={[styles.codeItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.codeText, { color: colors.onSurface }]}>
                        {codigo.nota ? `${codigo.nota}-${codigo.codigo_barras_ean}` : codigo.codigo_barras_ean}
                      </Text>
                      {canEditCodes && (
                        <TouchableOpacity
                          style={[styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleDeleteCode(index)}
                        >
                          <Ionicons name="close" size={responsive.responsiveWidth(16)} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          {/* Precios Generales Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Precios Generales</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsGeneralPricesExpanded(!isGeneralPricesExpanded)}
                >
                  <Ionicons 
                    name={isGeneralPricesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isGeneralPricesExpanded && (
              <View style={styles.pricesGrid}>
                <View style={styles.priceField}>
                  <Text style={[styles.label, { color: colors.outline }]}>Precio CUP</Text>
                  <TextInput
                    style={[
                      styles.input, 
                      { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                      isReadOnly && styles.inputDisabled
                    ]}
                    placeholderTextColor={colors.outline}
                    placeholder="Precio CUP"
                    value={
                      generalPriceInputTexts.precio_cup !== undefined
                        ? generalPriceInputTexts.precio_cup
                        : (formData.precio_cup_general !== null && formData.precio_cup_general !== '' ? parseFloat(formData.precio_cup_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_cup: formData.precio_cup_general !== null && formData.precio_cup_general !== '' ? String(parseFloat(formData.precio_cup_general)) : ''
                    }))}
                    onChangeText={(text) => {
                      setGeneralPriceInputTexts(prev => ({ ...prev, precio_cup: text }));
                      handleGeneralPriceChange('precio_cup_general', text === '' ? null : parseFloat(text));
                    }}
                    onBlur={() => {
                      setGeneralPriceInputTexts(prev => {
                        const updated = { ...prev };
                        delete updated.precio_cup;
                        return updated;
                      });
                      handleGeneralPriceBlur();
                    }}
                    keyboardType="decimal-pad"
                    editable={!isReadOnly}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={[styles.label, { color: colors.outline }]}>Precio USD</Text>
                  <TextInput
                    style={[
                      styles.input, 
                      { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                      isReadOnly && styles.inputDisabled
                    ]}
                    placeholderTextColor={colors.outline}
                    placeholder="Precio USD"
                    value={
                      generalPriceInputTexts.precio_usd !== undefined
                        ? generalPriceInputTexts.precio_usd
                        : (formData.precio_usd_general !== null && formData.precio_usd_general !== '' ? parseFloat(formData.precio_usd_general).toFixed(2) : '')
                    }
                    onFocus={() => setGeneralPriceInputTexts(prev => ({
                      ...prev,
                      precio_usd: formData.precio_usd_general !== null && formData.precio_usd_general !== '' ? String(parseFloat(formData.precio_usd_general)) : ''
                    }))}
                    onChangeText={(text) => {
                      setGeneralPriceInputTexts(prev => ({ ...prev, precio_usd: text }));
                      handleGeneralPriceChange('precio_usd_general', text === '' ? null : parseFloat(text));
                    }}
                    onBlur={() => {
                      setGeneralPriceInputTexts(prev => {
                        const updated = { ...prev };
                        delete updated.precio_usd;
                        return updated;
                      });
                      handleGeneralPriceBlur();
                    }}
                    keyboardType="decimal-pad"
                    editable={!isReadOnly}
                  />
                </View>
                {canViewCosts && (
                  <>
                    <View style={styles.priceField}>
                      <Text style={[styles.label, { color: colors.outline }]}>Costo CUP</Text>
                      <TextInput
                        style={[
                          styles.input, 
                          { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                          isReadOnly && styles.inputDisabled
                        ]}
                        placeholderTextColor={colors.outline}
                        placeholder="Costo CUP"
                        value={
                          generalPriceInputTexts.costo_cup !== undefined
                            ? generalPriceInputTexts.costo_cup
                            : (formData.costo_cup_general !== null && formData.costo_cup_general !== '' ? parseFloat(formData.costo_cup_general).toFixed(2) : '')
                        }
                        onFocus={() => setGeneralPriceInputTexts(prev => ({
                          ...prev,
                          costo_cup: formData.costo_cup_general !== null && formData.costo_cup_general !== '' ? String(parseFloat(formData.costo_cup_general)) : ''
                        }))}
                        onChangeText={(text) => {
                          setGeneralPriceInputTexts(prev => ({ ...prev, costo_cup: text }));
                          handleGeneralPriceChange('costo_cup_general', text === '' ? null : parseFloat(text));
                        }}
                        onBlur={() => {
                          setGeneralPriceInputTexts(prev => {
                            const updated = { ...prev };
                            delete updated.costo_cup;
                            return updated;
                          });
                          handleGeneralPriceBlur();
                        }}
                        keyboardType="decimal-pad"
                        editable={!isViewMode || canEditProduct}
                      />
                    </View>
                    <View style={styles.priceField}>
                      <Text style={[styles.label, { color: colors.outline }]}>Costo USD</Text>
                      <TextInput
                        style={[
                          styles.input, 
                          { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                          isReadOnly && styles.inputDisabled
                        ]}
                        placeholderTextColor={colors.outline}
                        placeholder="Costo USD"
                        value={
                          generalPriceInputTexts.costo_usd !== undefined
                            ? generalPriceInputTexts.costo_usd
                            : (formData.costo_usd_general !== null && formData.costo_usd_general !== '' ? parseFloat(formData.costo_usd_general).toFixed(2) : '')
                        }
                        onFocus={() => setGeneralPriceInputTexts(prev => ({
                          ...prev,
                          costo_usd: formData.costo_usd_general !== null && formData.costo_usd_general !== '' ? String(parseFloat(formData.costo_usd_general)) : ''
                        }))}
                        onChangeText={(text) => {
                          setGeneralPriceInputTexts(prev => ({ ...prev, costo_usd: text }));
                          handleGeneralPriceChange('costo_usd_general', text === '' ? null : parseFloat(text));
                        }}
                        onBlur={() => {
                          setGeneralPriceInputTexts(prev => {
                            const updated = { ...prev };
                            delete updated.costo_usd;
                            return updated;
                          });
                          handleGeneralPriceBlur();
                        }}
                        keyboardType="decimal-pad"
                        editable={!isViewMode || canEditProduct}
                      />
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Tienda Productos Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Precios por Tienda</Text>
              <View style={styles.sectionActions}>
                {canEditProduct && (
                  <TouchableOpacity
                    style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                    onPress={handleAddTiendaProducto}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsPricesExpanded(!isPricesExpanded)}
                >
                  <Ionicons 
                    name={isPricesExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isPricesExpanded && (
              <>
                {formData.productoTiendaList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay precios configurados
                  </Text>
                ) : (
                  formData.productoTiendaList.map((tiendaProducto, index) => (
                    <View key={index} style={[styles.tiendaProductoItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.tiendaField}>
                        <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
                        <TouchableOpacity
                          style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                          onPress={() => setShowTiendaDropdown(index)}
                          disabled={isViewMode && !canEditProduct}
                        >
                          <Text style={[styles.dropdownText, { color: tiendaProducto.id_tienda ? colors.onSurface : colors.outline }]}>
                            {tiendas.find(t => t.id_tienda === tiendaProducto.id_tienda)?.nombre || 'Seleccionar tienda'}
                          </Text>
                          <Ionicons 
                            name="chevron-down" 
                            size={responsive.responsiveWidth(18)} 
                            color={colors.outline} 
                          />
                        </TouchableOpacity>
                        
                        {showTiendaDropdown === index && (
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
                              filteredTiendas.map((tienda, idx) => (
                                <TouchableOpacity
                                  key={tienda.id_tienda}
                                  style={[styles.dropdownItem, idx === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                                  onPress={() => {
                                    setFormData(prev => {
                                      const updatedList = prev.productoTiendaList.map((item, i) => 
                                        i === index ? { ...item, id_tienda: tienda.id_tienda } : item
                                      );
                                      return { ...prev, productoTiendaList: updatedList };
                                    });
                                    setShowTiendaDropdown(null);
                                    setTiendaSearchText('');
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
                      
                      <View style={styles.pricesGrid}>
                        <View style={styles.priceField}>
                          <Text style={[styles.label, { color: colors.outline }]}>Precio CUP</Text>
                          <TextInput
                            style={[
                              styles.input, 
                              { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                              isReadOnly && styles.inputDisabled
                            ]}
                            value={
                              priceInputTexts[index]?.precio_cup !== undefined
                                ? priceInputTexts[index].precio_cup
                                : (tiendaProducto.precio_cup !== null && tiendaProducto.precio_cup !== '' ? parseFloat(tiendaProducto.precio_cup).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_cup: tiendaProducto.precio_cup !== null && tiendaProducto.precio_cup !== '' ? String(parseFloat(tiendaProducto.precio_cup)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_cup: text } }));
                              handleTiendaProductoChange(index, 'precio_cup', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_cup;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditProduct}
                          />
                        </View>
                        <View style={styles.priceField}>
                          <Text style={[styles.label, { color: colors.outline }]}>Precio USD</Text>
                          <TextInput
                            style={[
                              styles.input, 
                              { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                              isReadOnly && styles.inputDisabled
                            ]}
                            value={
                              priceInputTexts[index]?.precio_usd !== undefined
                                ? priceInputTexts[index].precio_usd
                                : (tiendaProducto.precio_usd !== null && tiendaProducto.precio_usd !== '' ? parseFloat(tiendaProducto.precio_usd).toFixed(2) : '')
                            }
                            onFocus={() => setPriceInputTexts(prev => ({
                              ...prev,
                              [index]: { ...prev[index], precio_usd: tiendaProducto.precio_usd !== null && tiendaProducto.precio_usd !== '' ? String(parseFloat(tiendaProducto.precio_usd)) : '' }
                            }))}
                            onChangeText={(text) => {
                              setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], precio_usd: text } }));
                              handleTiendaProductoChange(index, 'precio_usd', text === '' ? null : parseFloat(text));
                            }}
                            onBlur={() => setPriceInputTexts(prev => {
                              const updated = { ...prev[index] };
                              delete updated.precio_usd;
                              return { ...prev, [index]: updated };
                            })}
                            keyboardType="decimal-pad"
                            editable={!isViewMode || canEditProduct}
                          />
                        </View>
                        {canViewCosts && (
                          <>
                            <View style={styles.priceField}>
                              <Text style={[styles.label, { color: colors.outline }]}>Costo CUP</Text>
                              <TextInput
                                style={[
                                  styles.input, 
                                  { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                                  isReadOnly && styles.inputDisabled
                                ]}
                                value={
                                  priceInputTexts[index]?.costo_cup !== undefined
                                    ? priceInputTexts[index].costo_cup
                                    : (tiendaProducto.costo_cup !== null && tiendaProducto.costo_cup !== '' ? parseFloat(tiendaProducto.costo_cup).toFixed(2) : '')
                                }
                                onFocus={() => setPriceInputTexts(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], costo_cup: tiendaProducto.costo_cup !== null && tiendaProducto.costo_cup !== '' ? String(parseFloat(tiendaProducto.costo_cup)) : '' }
                                }))}
                                onChangeText={(text) => {
                                  setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], costo_cup: text } }));
                                  handleTiendaProductoChange(index, 'costo_cup', text === '' ? null : parseFloat(text));
                                }}
                                onBlur={() => setPriceInputTexts(prev => {
                                  const updated = { ...prev[index] };
                                  delete updated.costo_cup;
                                  return { ...prev, [index]: updated };
                                })}
                                keyboardType="decimal-pad"
                                editable={!isViewMode || canEditProduct}
                              />
                            </View>
                            <View style={styles.priceField}>
                              <Text style={[styles.label, { color: colors.outline }]}>Costo USD</Text>
                              <TextInput
                                style={[
                                  styles.input, 
                                  { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant },
                                  isReadOnly && styles.inputDisabled
                                ]}
                                value={
                                  priceInputTexts[index]?.costo_usd !== undefined
                                    ? priceInputTexts[index].costo_usd
                                    : (tiendaProducto.costo_usd !== null && tiendaProducto.costo_usd !== '' ? parseFloat(tiendaProducto.costo_usd).toFixed(2) : '')
                                }
                                onFocus={() => setPriceInputTexts(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], costo_usd: tiendaProducto.costo_usd !== null && tiendaProducto.costo_usd !== '' ? String(parseFloat(tiendaProducto.costo_usd)) : '' }
                                }))}
                                onChangeText={(text) => {
                                  setPriceInputTexts(prev => ({ ...prev, [index]: { ...prev[index], costo_usd: text } }));
                                  handleTiendaProductoChange(index, 'costo_usd', text === '' ? null : parseFloat(text));
                                }}
                                onBlur={() => setPriceInputTexts(prev => {
                                  const updated = { ...prev[index] };
                                  delete updated.costo_usd;
                                  return { ...prev, [index]: updated };
                                })}
                                keyboardType="decimal-pad"
                                editable={!isViewMode || canEditProduct}
                              />
                            </View>
                          </>
                        )}
                      </View>
                      
                      {(!isViewMode || canEditProduct) && (
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleRemoveTiendaProducto(index)}
                        >
                          <Text style={[styles.removeButtonText, { color: colors.error }]}>Eliminar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          {(!isViewMode || canEditProduct) && !isOfflineMode && (
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
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Code Modal */}
      {showAddCodeModal && (
        <Modal
          visible={showAddCodeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAddCodeModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddCodeModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Agregar Código</Text>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Código *</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <TextInput
                    style={[styles.inputWithIconText, { color: colors.onSurface }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Código de barras"
                    value={newCodigo}
                    onChangeText={setNewCodigo}
                  />
                  <TouchableOpacity
                    onPress={handleOpenScanner}
                    style={styles.cameraButton}
                  >
                    <Ionicons name="camera-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Nota (opcional)"
                  value={newNota}
                  onChangeText={setNewNota}
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setNewCodigo('');
                    setNewNota('');
                    setShowAddCodeModal(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddCode}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

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

      {/* Image Picker Modal */}
      {showImagePickerModal && (
        <Modal
          visible={showImagePickerModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImagePickerModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowImagePickerModal(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} activeOpacity={1}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Imagen</Text>
              <Text style={[styles.modalDescription, { color: colors.outline }]}>
                ¿Cómo deseas obtener la imagen del producto?
              </Text>
              
              <TouchableOpacity
                style={[styles.imagePickerOption, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.imagePickerOptionText, { color: colors.onSurface }]}>Tomar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imagePickerOption, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={handlePickFromGallery}
              >
                <Ionicons name="images" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.imagePickerOptionText, { color: colors.onSurface }]}>Galería</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowImagePickerModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const ProductoFormScreen = () => <ProductoFormContent />;

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
    paddingTop: responsive.responsivePadding(65),
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
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.7,
  },
  imageContainer: {
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePreview: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
    borderRadius: 12,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: responsive.responsiveHeight(-8),
    right: responsive.responsiveWidth(-8),
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  imagePlaceholder: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePlaceholderText: {
    marginTop: responsive.responsiveMargin(8),
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  imageChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(6),
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
  },
  imageChangeButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  statusSwitchContainer: {
    alignSelf: 'flex-start',
  },
  statusSwitch: {
    width: responsive.responsiveWidth(100),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  statusSwitchKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: responsive.responsiveWidth(70),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSwitchText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'Inter',
    textAlign: 'center',
    paddingHorizontal: responsive.responsivePadding(4),
  },
  section: {
    marginTop: responsive.responsiveMargin(24),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Hanken Grotesk',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
    alignItems: 'center',
  },
  addButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emptyText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
    borderWidth: 1,
  },
  codeText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  deleteButtonSmall: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(12),
  },
  priceField: {
    flex: 1,
    minWidth: responsive.responsiveWidth(140),
  },
  tiendaProductoItem: {
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(12),
    borderWidth: 1,
  },
  tiendaField: {
    marginBottom: responsive.responsiveMargin(12),
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
  removeButton: {
    paddingVertical: responsive.responsivePadding(8),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 6,
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(8),
  },
  removeButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
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
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
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
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
  },
  modalDescription: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(20),
    textAlign: 'center',
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: responsive.responsiveMargin(12),
  },
  imagePickerOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(16),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
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
});
