import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
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
import { getEntradas, deleteEntrada } from '../services/entradaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import ExportService from '../services/ExportService';
import DateTimePicker from '@react-native-community/datetimepicker';

const EntradasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [entradas, setEntradas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre_servicio: '', codigo_lote: '', fecha_desde: '', fecha_hasta: '', id_tienda: '', id_usuario: '' });
  const [tiendas, setTiendas] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
    fetchUsers();
  }, []);

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
      fetchEntradas();
    }, [pagination.currentPage, filters])
  );

  const fetchTiendas = async () => {
    try {
      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.entradas?.dependiente?.general) ||
        (userRole === 'almacenero' && permissions?.entradas?.almacenero?.general) ||
        (userRole === 'económico' && permissions?.entradas?.economico?.general);

      let allTiendas = [];
      
      if (isOfflineMode) {
        allTiendas = await storageService.getTiendas();
      } else {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      if (user?.id_tienda) {
        if (canViewAllEntradas) {
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

  const fetchUsers = async () => {
    try {
      if (isOfflineMode) {
        return;
      }
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
  };

  const fetchEntradas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setEntradas([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.entradas?.dependiente?.general) ||
        (userRole === 'almacenero' && permissions?.entradas?.almacenero?.general) ||
        (userRole === 'económico' && permissions?.entradas?.economico?.general);

      const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);
      const fetchLimit = hasActiveFilters ? 10000 : pagination.limit;
      const fetchPage = hasActiveFilters ? 1 : pagination.currentPage;
      
      const data = await getEntradas(filters, fetchPage, fetchLimit);
      let entradas = data.data || [];

      // Filter by selected store if id_tienda filter is active
      if (filters.id_tienda) {
        entradas = entradas.filter(e => {
          return e.servicioTienda?.id_tienda === parseInt(filters.id_tienda);
        });
      }

      // Filter by user's store if they don't have general permission
      if (!canViewAllEntradas && user?.id_tienda) {
        entradas = entradas.filter(e => {
          return e.servicioTienda?.id_tienda === user.id_tienda;
        });
      }

      if (hasActiveFilters) {
        const totalFilteredItems = entradas.length;
        const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
        const startIndex = (pagination.currentPage - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedEntradas = entradas.slice(startIndex, endIndex);
        
        setEntradas(paginatedEntradas);
        setPagination({
          currentPage: pagination.currentPage,
          limit: pagination.limit,
          totalPages: totalFilteredPages,
          totalItems: totalFilteredItems
        });
      } else {
        setEntradas(entradas);
        setPagination(data.pagination || pagination);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching entradas:', err);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchEntradas();
  };

  const handleClearFilters = () => {
    const userRole = user?.rol?.toLowerCase();
    const canViewAllEntradas = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && permissions?.entradas?.dependiente?.general) ||
      (userRole === 'almacenero' && permissions?.entradas?.almacenero?.general) ||
      (userRole === 'económico' && permissions?.entradas?.economico?.general);

    const clearedFilters = { 
      nombre_servicio: '', 
      codigo_lote: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      id_tienda: (!canViewAllEntradas && user?.id_tienda) ? user.id_tienda.toString() : '',
      id_usuario: ''
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchEntradas();
  };

  const handleDelete = (entrada) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Entrada',
      `¿Estás seguro de que quieres eliminar la entrada "${entrada.codigo_lote}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntrada(entrada.id_entrada);
              showToast({ type: 'success', message: 'Entrada eliminada correctamente' });
              fetchEntradas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleEntradaPress = (entrada) => {
    navigation.navigate('EntradaForm', { entrada, mode: 'view' });
  };

  const handleEdit = (entrada) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('EntradaForm', { entrada, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('EntradaForm', { mode: 'add' });
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

  const handleExport = async () => {
    try {
      setShowExportModal(false);
      setIsExporting(true);
      
      let allEntradas = [];
      const data = await getEntradas(filters, 1, 10000);
      allEntradas = data.data || [];

      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.entradas?.dependiente?.general) ||
        (userRole === 'almacenero' && permissions?.entradas?.almacenero?.general) ||
        (userRole === 'económico' && permissions?.entradas?.economico?.general);

      if (!canViewAllEntradas && user?.id_tienda) {
        allEntradas = allEntradas.filter(e => {
          return e.servicioTienda?.id_tienda === user.id_tienda;
        });
      }

      if (exportType === 'excel') {
        await exportToExcel(allEntradas);
      } else if (exportType === 'pdf') {
        await exportToPDF(allEntradas);
      }
    } catch (error) {
      console.error('Error exporting:', error);
      showToast({ type: 'error', message: 'Error al exportar: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const sanitizeFileName = (fileName) => {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
  };

  const exportToExcel = async (entradas) => {
    try {
      const data = entradas.map(entrada => ({
        'Código Lote': entrada.codigo_lote,
        'Producto': entrada.servicioTienda?.servicio?.nombre || 'N/A',
        'Tienda': entrada.servicioTienda?.tienda?.nombre || 'N/A',
        'Cantidad': entrada.cantidad_entrada,
        'Costo CUP': entrada.costo_cup,
        'Costo USD': entrada.costo_usd,
        'Fecha': new Date(entrada.fecha).toLocaleDateString(),
        'Fecha Vencimiento': entrada.fecha_vencimiento ? new Date(entrada.fecha_vencimiento).toLocaleDateString() : 'N/A',
        'Proveedor': entrada.nombre_proveedor || 'N/A',
        'Usuario': entrada.usuario?.nombre || 'N/A',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Entradas');

      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Entradas_${formattedDate}.xlsx`);
      const downloadDir = FileSystem.cacheDirectory;
      const fileUri = `${downloadDir}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      showExportSuccessAlert(fileUri, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  };

  const exportToPDF = async (entradas) => {
    try {
      let tableRows = '';
      
      const tableHeader = '<tr style="background-color: #f0f0f0;">';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Código Lote</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Producto</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Tienda</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Cantidad</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo CUP</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo USD</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Fecha</th>';
      tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Proveedor</th>';
      tableHeader += '</tr>';

      entradas.forEach(entrada => {
        tableRows += '<tr>';
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.codigo_lote}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.servicioTienda?.servicio?.nombre || 'N/A'}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.servicioTienda?.tienda?.nombre || 'N/A'}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.cantidad_entrada}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.costo_cup}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.costo_usd}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${new Date(entrada.fecha).toLocaleDateString()}</td>`;
        tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.nombre_proveedor || 'N/A'}</td>`;
        tableRows += '</tr>';
      });

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #002440; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            </style>
          </head>
          <body>
            <h1>Reporte de Entradas</h1>
            <table>
              ${tableHeader}
              ${tableRows}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Entradas_${formattedDate}.pdf`);
      
      showExportSuccessAlert(uri, fileName);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  };

  const showExportSuccessAlert = (fileUri, fileName) => {
    Alert.alert(
      'Documento Exportado',
      `El documento "${fileName}" ha sido generado. ¿Qué deseas hacer?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Guardar',
          onPress: async () => {
            try {
              const fileContent = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              const mimeType = fileName.endsWith('.xlsx') 
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/pdf';
              
              const result = await ExportService.saveFile({
                filename: fileName,
                mimeType: mimeType,
                base64: fileContent
              });
              
              if (result.success) {
                showToast({ type: 'success', message: result.message || 'Archivo guardado correctamente' });
              } else {
                showToast({ type: 'error', message: result.error || 'Error al guardar el archivo' });
              }
            } catch (error) {
              console.error('Error saving to Downloads:', error);
              showToast({ type: 'error', message: 'Error al guardar: ' + error.message });
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

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_desde: formattedDate }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_hasta: formattedDate }));
    }
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewAllEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && permissions?.entradas?.dependiente?.general) ||
    (userRole === 'almacenero' && permissions?.entradas?.almacenero?.general) ||
    (userRole === 'económico' && permissions?.entradas?.economico?.general);

  const canManageEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && permissions?.entradas?.dependiente) ||
    (userRole === 'almacenero' && permissions?.entradas?.almacenero) ||
    (userRole === 'económico' && permissions?.entradas?.economico);

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

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="Entradas"
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
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Entradas</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Nombre del Producto</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre_servicio}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_servicio: text }))}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllEntradas) {
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
                {canViewAllEntradas && (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFilters(prev => ({ ...prev, id_tienda: '' }));
                      setShowTiendaDropdown(false);
                      setTiendaSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchEntradas();
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
                        fetchEntradas();
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
                <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    if (canViewAllEntradas) {
                      setShowUserDropdown(!showUserDropdown);
                    }
                  }}
                >
                  <Text style={[styles.dropdownText, { color: filters.id_usuario ? colors.onSurface : colors.outline }]}>
                    {users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}
                  </Text>
                  <Ionicons 
                    name={showUserDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showUserDropdown && (
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
                        placeholder="Buscar usuario..."
                        value={userSearchText}
                        onChangeText={setUserSearchText}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, id_usuario: '' }));
                        setShowUserDropdown(false);
                        setUserSearchText('');
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchEntradas();
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los usuarios</Text>
                    </TouchableOpacity>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((userItem, index) => (
                        <TouchableOpacity
                          key={userItem.id_usuario}
                          style={[styles.dropdownItem, index === filteredUsers.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                            setShowUserDropdown(false);
                            setUserSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchEntradas();
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{userItem.nombre_natural}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.dropdownItem}>
                        <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron usuarios</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Código de Lote</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por código de lote..."
                  value={filters.codigo_lote}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, codigo_lote: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Fecha Desde</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowFechaDesdePicker(true)}
                >
                  <Text style={[styles.inputText, { color: filters.fecha_desde ? colors.onSurface : colors.outline }]}>
                    {filters.fecha_desde || 'Seleccionar fecha'}
                  </Text>
                </TouchableOpacity>
                {showFechaDesdePicker && (
                  <DateTimePicker
                    value={filters.fecha_desde ? new Date(filters.fecha_desde) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleFechaDesdeChange}
                  />
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Fecha Hasta</Text>
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowFechaHastaPicker(true)}
                >
                  <Text style={[styles.inputText, { color: filters.fecha_hasta ? colors.onSurface : colors.outline }]}>
                    {filters.fecha_hasta || 'Seleccionar fecha'}
                  </Text>
                </TouchableOpacity>
                {showFechaHastaPicker && (
                  <DateTimePicker
                    value={filters.fecha_hasta ? new Date(filters.fecha_hasta) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleFechaHastaChange}
                  />
                )}
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
          {canManageEntradas && !isOfflineMode && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Entrada</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowExportModal(true)}
          >
            <Ionicons name="download-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.exportButtonText, { color: '#fff' }]}>Exportar Datos</Text>
          </TouchableOpacity>
        </View>

        {/* Entradas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando entradas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchEntradas}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : entradas.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron entradas
            </Text>
          </Card>
        ) : (
          <>
            {entradas.map((entrada) => (
              <TouchableOpacity
                key={entrada.id_entrada}
                onPress={() => handleEntradaPress(entrada)}
                activeOpacity={0.7}
              >
                <Card style={[styles.entradaCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.entradaHeader}>
                    <View style={styles.entradaInfo}>
                      <Text style={[styles.entradaCodigo, { color: colors.onSurface }]}>
                        {entrada.codigo_lote}
                      </Text>
                      <Text style={[styles.entradaProducto, { color: colors.outline }]}>
                        {entrada.servicioTienda?.servicio?.nombre}
                      </Text>
                    </View>
                    <View style={styles.entradaActions}>
                      {canManageEntradas && !isOfflineMode && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(entrada);
                          }}
                        >
                          <Image
                            source={require('../../assets/editar.png')}
                            style={styles.actionIcon}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                      {canManageEntradas && !isOfflineMode && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(entrada);
                          }}
                        >
                          <Image
                            source={require('../../assets/basura.png')}
                            style={styles.actionIcon}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.entradaDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="storefront-outline" size={responsive.responsiveWidth(16)} color={colors.outline} />
                      <Text style={[styles.detailText, { color: colors.outline }]}>
                        {entrada.servicioTienda?.tienda?.nombre}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="cube-outline" size={responsive.responsiveWidth(16)} color={colors.outline} />
                      <Text style={[styles.detailText, { color: colors.outline }]}>
                        Cantidad: {entrada.cantidad_entrada}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="cash-outline" size={responsive.responsiveWidth(16)} color={colors.outline} />
                      <Text style={[styles.detailText, { color: colors.outline }]}>
                        CUP: {parseFloat(entrada.costo_cup).toFixed(2)} | USD: {parseFloat(entrada.costo_usd).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={responsive.responsiveWidth(16)} color={colors.outline} />
                      <Text style={[styles.detailText, { color: colors.outline }]}>
                        {new Date(entrada.fecha).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}

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
                    Total de entradas: {pagination.totalItems}
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
                  setExportType('excel');
                  handleExport();
                }}
                disabled={isExporting}
              >
                <Ionicons name="document-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Entradas en Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setExportType('pdf');
                  handleExport();
                }}
                disabled={isExporting}
              >
                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Entradas en PDF</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Export Loading Modal */}
      {isExporting && (
        <Modal
          visible={isExporting}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.loadingModal, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingModalText, { color: colors.onSurface }]}>
                Generando documento...
              </Text>
              <Text style={[styles.loadingModalSubtext, { color: colors.onSurfaceVariant }]}>
                Por favor espere, esto puede tomar unos segundos
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const EntradasScreen = () => <EntradasContent />;

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
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
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
  addButton: {
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
  addButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
  },
  exportButton: {
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
  exportButtonText: {
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
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  entradaCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
  },
  entradaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  entradaInfo: {
    flex: 1,
  },
  entradaCodigo: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  entradaProducto: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  entradaActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  actionButton: {
    padding: responsive.responsivePadding(8),
  },
  editButton: {
    borderRadius: 8,
  },
  deleteButton: {
    borderRadius: 8,
  },
  actionIcon: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
  },
  entradaDetails: {
    gap: responsive.responsiveMargin(8),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  detailText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(24),
  },
  paginationButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  paginationText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationSubtext: {
    fontSize: responsive.responsiveFontSize(12),
    marginTop: responsive.responsiveMargin(4),
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
  loadingModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(32),
    width: '85%',
    maxWidth: responsive.responsiveWidth(350),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingModalText: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginTop: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  loadingModalSubtext: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(8),
    textAlign: 'center',
  },
});
