import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useOffline } from '../context/OfflineContext';
import { useAuth } from '../context/AuthContext';
import { getEntradas } from '../services/entradaService';
import packageJson from '../../package.json';

const HomeContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { enableOfflineMode, isOfflineMode: contextOfflineMode } = useOffline();
  const { user, permissions } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [greeting, setGreeting] = useState('Buenos días');
  const [expiringProducts, setExpiringProducts] = useState([]);
  const [loadingExpiring, setLoadingExpiring] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const appVersion = packageJson.version;

  // Activar modo offline si viene del login
  useEffect(() => {
    if (route.params?.isOfflineMode) {
      enableOfflineMode();
    }
  }, [route.params?.isOfflineMode]);

  // Establecer fecha actual
  useEffect(() => {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const date = new Date().toLocaleDateString('es-ES', options);
    setCurrentDate(date);
  }, []);

  const logoSource = isDarkMode
    ? require('../../Logos/Abacus v4.1.png')
    : require('../../Logos/Abacus v1.1.png');

  const storeImageSource = isDarkMode
    ? require('../../assets/Home_logo_darck (2).png')
    : require('../../assets/Home_Logo.png');

  const getFirstName = (fullName) => {
    if (!fullName) return 'Administrador';
    const name = fullName.trim();
    if (name === 'Administrador') return 'Administrador';
    return name.split(' ')[0];
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings', { from: 'Home' });
  };

  const handleNotificationsPress = () => {
    // Implementar lógica de notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleLogoPress = () => {
    navigation.navigate('Home');
  };

  const handleSupportCall = () => {
    Linking.openURL('tel:56242671');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/56242671');
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  // Función para calcular el umbral dinámico de alerta
  const calculateThreshold = (vidaUtil, porcentaje, minAbs, maxAbs) => {
    return Math.max(minAbs, Math.min(maxAbs, porcentaje * vidaUtil));
  };

  // Función para determinar el nivel de alerta de un producto
  const getExpirationAlert = (fechaCreacion, fechaVencimiento) => {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const creacion = new Date(fechaCreacion);
    
    // Calcular días
    const vidaUtil = Math.ceil((vencimiento - creacion) / (1000 * 60 * 60 * 24));
    const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    // Si ya venció
    if (diasRestantes <= 0) {
      return { level: 'expired', days: diasRestantes, label: 'Vencido' };
    }
    
    // Calcular umbrales
    const umbralAmarillo = calculateThreshold(vidaUtil, 0.20, 3, 30);
    const umbralRojo = calculateThreshold(vidaUtil, 0.10, 1, 7);
    
    // Determinar nivel
    if (diasRestantes <= umbralRojo) {
      return { level: 'critical', days: diasRestantes, label: 'Crítico' };
    } else if (diasRestantes <= umbralAmarillo) {
      return { level: 'warning', days: diasRestantes, label: 'Próximo a vencer' };
    } else {
      return { level: 'ok', days: diasRestantes, label: 'Vigente' };
    }
  };

  // Consultar productos próximos a vencer
  useEffect(() => {
    const fetchExpiringProducts = async () => {
      try {
        setLoadingExpiring(true);
        
        // Calcular fecha de vencimiento máximo (30 días desde hoy para el umbral amarillo)
        const hoy = new Date();
        const fechaMaxima = new Date(hoy);
        fechaMaxima.setDate(fechaMaxima.getDate() + 30);
        
        const fechaMaximaStr = fechaMaxima.toISOString().split('T')[0];
        
        // Consultar entradas con fecha de vencimiento hasta 30 días
        const response = await getEntradas(
          { fecha_vencimiento_hasta: fechaMaximaStr },
          1,
          20
        );
        
        // Filtrar y clasificar productos según la fórmula
        const productosConAlerta = response.data
          .filter(entrada => entrada.fecha_vencimiento && entrada.cantidad_restante > 0)
          .map(entrada => {
            const alerta = getExpirationAlert(entrada.fecha, entrada.fecha_vencimiento);
            return {
              ...entrada,
              alerta,
              nombreProducto: entrada.servicioTienda?.servicio?.nombre || 'Producto desconocido',
              codigoLote: entrada.codigo_lote || 'N/A'
            };
          })
          .filter(item => item.alerta.level === 'critical' || item.alerta.level === 'warning' || item.alerta.level === 'expired')
          .sort((a, b) => a.alerta.days - b.alerta.days) // Ordenar por días restantes (menor primero)
          .slice(0, 5); // Mostrar máximo 5 productos
        
        setExpiringProducts(productosConAlerta);
      } catch (error) {
        // Error handling without console log
      } finally {
        setLoadingExpiring(false);
      }
    };
    
    fetchExpiringProducts();
  }, []);

  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();
  const { entradaAccessLevels, salidaAccessLevels, operacionAccessLevels } = useAuth();
  const { isOfflineMode } = useOffline();
  
  const canAccessSalidas = 
    !isOfflineMode &&
    (isAdmin ||
    (userRole === 'dependiente' && salidaAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && salidaAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && salidaAccessLevels?.economico !== 'none'));

  const canAccessOperaciones = 
    !isOfflineMode &&
    (isAdmin ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente !== 'none') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero !== 'none') ||
    (userRole === 'económico' && operacionAccessLevels?.economico !== 'none'));
  
  const mainModules = [
    {
      id: 'servicios',
      icon: require('../../assets/lanza-libre.png'),
      iconType: 'image',
      label: 'Servicios y Ofertas',
      description: 'Gestionar servicios y ofertas',
      color: colors.primary,
      screen: 'Servicios',
      permission: true,
      hasPermission: true
    },
    {
      id: 'productos',
      icon: require('../../assets/product.png'),
      iconType: 'image',
      label: 'Productos',
      description: 'Gestionar inventario',
      color: '#16A34A',
      screen: 'Productos',
      permission: true,
      hasPermission: true
    },
    {
      id: 'ventas',
      icon: require('../../assets/box.png'),
      iconType: 'image',
      label: 'Ventas',
      description: 'Registrar ventas',
      color: '#185FA5',
      screen: null,
      permission: canAccessSalidas,
      hasPermission: canAccessSalidas
    },
    {
      id: 'operaciones',
      icon: require('../../assets/report.png'),
      iconType: 'image',
      label: 'Operaciones',
      description: 'Gestión de operaciones',
      color: colors.secondary,
      screen: 'Operaciones',
      permission: canAccessOperaciones,
      hasPermission: canAccessOperaciones
    },
  ];

  const renderIcon = (item) => {
    const iconColor = item.hasPermission ? item.color : colors.outline;
    if (item.iconType === 'image') {
      return (
        <Image
          source={item.icon}
          style={[
            styles.moduleIconImage,
            { tintColor: iconColor }
          ]}
          resizeMode="contain"
        />
      );
    }
    switch (item.iconSet) {
      case 'Ionicons':
        return <Ionicons name={item.icon} size={responsive.responsiveWidth(28)} color={iconColor} />;
      case 'MaterialIcons':
        return <MaterialIcons name={item.icon} size={responsive.responsiveWidth(28)} color={iconColor} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={item.icon} size={responsive.responsiveWidth(24)} color={iconColor} />;
      default:
        return <Ionicons name="help-circle" size={responsive.responsiveWidth(28)} color={iconColor} />;
    }
  };

  const handleModulePress = (module) => {
    if (module.hasPermission && module.screen) {
      navigation.navigate(module.screen);
    }
  };

  const getExpirationAlertColor = (level) => {
    switch (level) {
      case 'critical':
        return isDarkMode ? '#EF4444' : '#DC2626'; // Rojo más claro en modo oscuro
      case 'warning':
        return isDarkMode ? '#FBBF24' : '#F59E0B'; // Amarillo más claro en modo oscuro
      case 'expired':
        return isDarkMode ? '#9CA3AF' : '#1F2937'; // Gris en modo oscuro, negro en claro
      default:
        return colors.outline;
    }
  };

  const getExpirationAlertIcon = (level) => {
    const iconColor = getExpirationAlertColor(level);
    switch (level) {
      case 'critical':
        return <Ionicons name="warning" size={responsive.responsiveWidth(20)} color={iconColor} />;
      case 'warning':
        return <Ionicons name="time" size={responsive.responsiveWidth(20)} color={iconColor} />;
      case 'expired':
        return <Ionicons name="close-circle" size={responsive.responsiveWidth(20)} color={iconColor} />;
      default:
        return <Ionicons name="checkmark-circle" size={responsive.responsiveWidth(20)} color="#16A34A" />;
    }
  };

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
      <Header 
        onMenuPress={() => setSidebarOpen(true)}
        onThemePress={toggleTheme}
        onSettingsPress={handleSettingsPress}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        onLogoPress={handleLogoPress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        showVersion={true}
        version={appVersion}
      />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Bienvenida */}
        <View style={styles.hero}>
          <Card style={[styles.welcomeCard, { backgroundColor: isDarkMode ? '#0A1628' : '#F5F8FC' }]}>
            <View style={styles.welcomeContainer}>
              <View style={styles.welcomeTextContainer}>
                <Text style={[styles.greeting, { color: colors.onSurface }]}>
                  ¡Bienvenido!
                </Text>
                <Text style={[styles.userName, { color: colors.onSurface }]}>
                  {getFirstName(user?.nombre_natural || user?.nombre_usuario)}
                </Text>
                <Text style={[styles.userRole, { color: colors.outline }]}>
                  {user?.rol || 'Administrador'}
                </Text>
                <Text style={[styles.currentDate, { color: colors.outline }]}>
                  {currentDate}
                </Text>
              </View>
              <Image
                source={storeImageSource}
                style={styles.storeImage}
                resizeMode="contain"
              />
            </View>
          </Card>
        </View>

        {/* Módulos Principales */}
        <View style={styles.modulesSection}>
          <Text style={[styles.sectionTitle, { color: colors.outline }]}>
            MÓDULOS PRINCIPALES
          </Text>
          <View style={styles.modulesGrid}>
            {mainModules.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleItem}
                onPress={() => handleModulePress(module)}
                activeOpacity={module.hasPermission ? 0.7 : 1}
                disabled={!module.hasPermission}
              >
                <Card style={[
                  styles.moduleCard, 
                  { 
                    backgroundColor: isDarkMode ? '#0A1628' : '#F5F8FC',
                    opacity: module.hasPermission ? 1 : 0.5
                  }
                ]}>
                  <View style={styles.moduleIconContainer}>
                    {renderIcon(module)}
                  </View>
                  <Text style={[styles.moduleLabel, { color: colors.onSurface }]}>
                    {module.label}
                  </Text>
                  <Text style={[styles.moduleDescription, { color: colors.outline }]}>
                    {module.description}
                  </Text>
                  {module.hasPermission ? (
                    <View style={styles.accessButton}>
                      <Text style={[styles.accessButtonText, { color: module.color }]}>
                        Acceder
                      </Text>
                      <Ionicons name="arrow-forward" size={responsive.responsiveWidth(16)} color={module.color} />
                    </View>
                  ) : (
                    <View style={[styles.accessButton, styles.disabledButton]}>
                      <Text style={[styles.accessButtonText, { color: colors.outline }]}>
                        Sin permisos
                      </Text>
                      <Ionicons name="lock-closed" size={responsive.responsiveWidth(16)} color={colors.outline} />
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.outline }]}>
            RESUMEN
          </Text>
          <Card style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statItemIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="cube" size={responsive.responsiveWidth(20)} color={colors.primary} />
                </View>
                <Text style={[styles.statItemValue, { color: colors.onSurface }]}>
                  128
                </Text>
                <Text style={[styles.statItemLabel, { color: colors.outline }]}>
                  Productos
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statItemIconContainer, { backgroundColor: '#16A34A15' }]}>
                  <Ionicons name="cart" size={responsive.responsiveWidth(20)} color="#16A34A" />
                </View>
                <Text style={[styles.statItemValue, { color: colors.onSurface }]}>
                  56
                </Text>
                <Text style={[styles.statItemLabel, { color: colors.outline }]}>
                  Ventas hoy
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statItemIconContainer, { backgroundColor: '#185FA515' }]}>
                  <Ionicons name="people" size={responsive.responsiveWidth(20)} color="#185FA5" />
                </View>
                <Text style={[styles.statItemValue, { color: colors.onSurface }]}>
                  12
                </Text>
                <Text style={[styles.statItemLabel, { color: colors.outline }]}>
                  Usuarios
                </Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statItemIconContainer, { backgroundColor: `${colors.secondary}15` }]}>
                  <Ionicons name="cash" size={responsive.responsiveWidth(20)} color={colors.secondary} />
                </View>
                <Text style={[styles.statItemValue, { color: colors.onSurface }]}>
                  7.8K
                </Text>
                <Text style={[styles.statItemLabel, { color: colors.outline }]}>
                  Ingresos (mes)
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Alertas de Vencimiento */}
        {expiringProducts.length > 0 && (
          <View style={styles.expirationSection}>
            <Text style={[styles.sectionTitle, { color: colors.outline }]}>
              ALERTAS DE VENCIMIENTO
            </Text>
            <View style={styles.expirationList}>
              {expiringProducts.map((producto, index) => (
                <Card 
                  key={producto.id || index} 
                  style={[
                    styles.expirationItem, 
                    { 
                      backgroundColor: colors.surface,
                      borderLeftWidth: 4,
                      borderLeftColor: getExpirationAlertColor(producto.alerta.level)
                    }
                  ]}
                >
                  <View style={styles.expirationIconContainer}>
                    {getExpirationAlertIcon(producto.alerta.level)}
                  </View>
                  <View style={styles.expirationContent}>
                    <Text style={[styles.expirationProductName, { color: colors.onSurface }]}>
                      {producto.nombreProducto}
                    </Text>
                    <Text style={[styles.expirationLote, { color: colors.outline }]}>
                      Lote: {producto.codigoLote}
                    </Text>
                  </View>
                  <View style={styles.expirationRight}>
                    <Text 
                      style={[
                        styles.expirationLabel, 
                        { color: getExpirationAlertColor(producto.alerta.level) }
                      ]}
                    >
                      {producto.alerta.label}
                    </Text>
                    <Text style={[styles.expirationDays, { color: colors.outline }]}>
                      {producto.alerta.days === 0 ? 'Hoy' : 
                       producto.alerta.days === 1 ? 'Mañana' :
                       producto.alerta.days === -1 ? 'Ayer' :
                       producto.alerta.days < 0 ? `${Math.abs(producto.alerta.days)} días` :
                       `${producto.alerta.days} días`}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Sección de Soporte */}
        <View style={styles.supportSection}>
          <Card style={[styles.supportCard, { backgroundColor: colors.surface }]}>
            <View style={styles.supportHeader}>
              <View style={[styles.supportIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="headset" size={responsive.responsiveWidth(24)} color={colors.primary} />
              </View>
              <View style={styles.supportHeaderText}>
                <Text style={[styles.supportTitle, { color: colors.onSurface }]}>
                  ¿Necesitas ayuda?
                </Text>
                <Text style={[styles.supportSubtitle, { color: colors.outline }]}>
                  Contáctanos para soporte técnico
                </Text>
              </View>
            </View>
            <View style={styles.supportContact}>
              <TouchableOpacity 
                style={styles.supportContactItem}
                onPress={handleSupportCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={responsive.responsiveWidth(20)} color={colors.primary} />
                <Text style={[styles.supportPhone, { color: colors.onSurface }]}>
                  56242671
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.supportContactItem}
                onPress={handleWhatsApp}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={responsive.responsiveWidth(20)} color="#25D366" />
                <Text style={[styles.supportWhatsApp, { color: colors.onSurface }]}>
                  También por WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Espacio inferior */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

export const HomeScreen = () => {
  return <HomeContent />;
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: responsive.headerHeight,
  },
  scrollContent: {
    paddingHorizontal: responsive.horizontalPadding,
    paddingBottom: 120,
  },
  hero: {
    marginBottom: responsive.responsiveMargin(24),
    paddingTop: responsive.responsiveMargin(32),
  },
  welcomeCard: {
    borderRadius: 16,
    padding: responsive.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: responsive.responsiveFontSize(28),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.responsiveFontSize(28) * 1.3,
    marginBottom: 4,
  },
  userName: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.responsiveFontSize(24) * 1.3,
    marginBottom: 4,
  },
  userRole: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
    marginBottom: 4,
  },
  currentDate: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
  },
  storeImage: {
    width: responsive.responsiveWidth(120),
    height: responsive.responsiveHeight(120),
  },
  modulesSection: {
    marginBottom: responsive.responsiveMargin(24),
  },
  statsSection: {
    marginBottom: responsive.responsiveMargin(24),
  },
  statsCard: {
    borderRadius: 16,
    padding: responsive.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsive.gridGap,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemIconContainer: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  statItemValue: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.responsiveFontSize(20) * 1.2,
    marginBottom: 4,
  },
  statItemLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.3,
    textAlign: 'center',
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.gridGap,
  },
  moduleItem: {
    flex: 1,
    minWidth: responsive.isSmall ? '45%' : responsive.isMedium ? '45%' : '22%',
    maxWidth: responsive.isSmall ? '48%' : responsive.isMedium ? '48%' : '25%',
  },
  moduleCard: {
    borderRadius: 16,
    padding: responsive.cardPadding,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  moduleIconContainer: {
    width: responsive.responsiveWidth(56),
    height: responsive.responsiveHeight(56),
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  moduleIconImage: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
  },
  moduleLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.body * 1.4,
    marginBottom: 4,
    textAlign: 'center',
    minHeight: responsive.responsiveFontSize(24) * 1.4,
  },
  moduleDescription: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.3,
    textAlign: 'center',
    marginBottom: 12,
    minHeight: responsive.fontSizes.bodySmall * 1.3 * 2,
  },
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  accessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  accessButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  supportSection: {
    marginBottom: responsive.responsiveMargin(24),
  },
  supportCard: {
    borderRadius: 16,
    padding: responsive.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  supportIconContainer: {
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  supportHeaderText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.body * 1.4,
    marginBottom: 4,
  },
  supportSubtitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.3,
  },
  supportContact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  supportContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportPhone: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  supportWhatsApp: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
  },
  sectionTitle: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.1,
    marginBottom: responsive.responsiveMargin(16),
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  expirationSection: {
    marginBottom: responsive.responsiveMargin(24),
  },
  expirationList: {
    gap: responsive.gridGap,
  },
  expirationItem: {
    borderRadius: 14,
    padding: responsive.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  expirationIconContainer: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(12),
  },
  expirationContent: {
    flex: 1,
  },
  expirationProductName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.body * 1.4,
    marginBottom: 2,
  },
  expirationLote: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodySmall * 1.3,
  },
  expirationRight: {
    alignItems: 'flex-end',
  },
  expirationLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    lineHeight: responsive.fontSizes.bodySmall * 1.4,
    marginBottom: 2,
  },
  expirationDays: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.caption * 1.4,
  },
  bottomSpacer: {
    height: 20,
  },
});
