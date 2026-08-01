import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image, TouchableWithoutFeedback, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { navigationRef } from '../../navigationRef';
import { Toast } from '../common/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';

export const Sidebar = ({ isOpen = false, onClose, navigation, currentRoute = 'Home' }) => {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };
  const { toast, showToast, hideToast } = useToast();
  const { user, permissions, entradaAccessPermissions } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canAccessEntradas = 
    isAdmin ||
    (userRole === 'dependiente' && entradaAccessPermissions?.dependiente) ||
    (userRole === 'almacenero' && entradaAccessPermissions?.almacenero) ||
    (userRole === 'económico' && entradaAccessPermissions?.economico);

  const menuItems = [
    { icon: require('../../../assets/bar-chart.png'), label: 'Panel', route: 'Home' },
    { icon: require('../../../assets/lanza-libre.png'), label: 'Servicios y Ofertas', route: 'Servicios' },
    { icon: require('../../../assets/product.png'), label: 'Productos', route: 'Productos' },
    ...(canAccessEntradas ? [{ icon: require('../../../assets/moving.png'), label: 'Entradas', route: 'Entradas' }] : []),
    ...(isAdmin ? [{ icon: require('../../../assets/tienda.png'), label: 'Tiendas', route: 'Tiendas' }] : []),
    ...(isAdmin ? [{ icon: require('../../../assets/usuarios.png'), label: 'Usuarios', route: 'Usuarios' }] : []),
    ...(isAdmin ? [{ icon: require('../../../assets/Servicios.png'), label: 'Configuraciones del Administrador', route: 'CurrencyExchange' }] : []),
    { icon: require('../../../assets/config.png'), label: 'Configuración', route: 'Settings' },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión? Se sincronizarán los datos para uso offline.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSyncing(true);
              
              // Sincronizar datos antes de cerrar sesión
              // Pasar usuario y permisos para filtrar según los permisos del usuario
              const syncResult = await storageService.syncAllData(user, permissions);
              
              if (syncResult.success) {
                console.log(`Datos sincronizados: ${syncResult.serviciosCount} servicios (incluyendo ofertas)`);
              } else {
                console.warn('No se pudo sincronizar los datos:', syncResult.error);
              }
              
              await SecureStore.deleteItemAsync('token');
              await SecureStore.deleteItemAsync('refreshToken');
              await SecureStore.deleteItemAsync('user');
              
              if (navigationRef.isReady()) {
                navigationRef.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
              onClose();
              setIsSyncing(false);
            } catch (error) {
              console.error('Error logging out:', error);
              setIsSyncing(false);
              showToast({ type: 'error', message: 'No se pudo cerrar sesión', code: error.code ?? null });
            }
          },
        },
      ]
    );
  };

  const isSidebarOpen = isOpen === true || isOpen === 'true';

  const sidebarWidth = responsive.sidebarWidth;
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSidebarOpen) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -sidebarWidth,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isSidebarOpen, sidebarWidth]);

  if (!isSidebarOpen && translateX._value === -sidebarWidth) return null;

  const styles = createStyles(responsive, insets);

  return (
    <>
      <TouchableWithoutFeedback onPress={onClose} disabled={!isSidebarOpen}>
        <Animated.View 
          style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayOpacity }]}
          pointerEvents={isSidebarOpen ? 'auto' : 'none'}
        />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.sidebar, { backgroundColor: colors.surfaceContainer, width: sidebarWidth, transform: [{ translateX }] }]}>
        <Toast
          visible={toast.visible}
          type={toast.type}
          message={toast.message}
          code={toast.code}
          duration={toast.duration}
          onHide={hideToast}
          toastKey={toast.key}
        />
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.primary }]}>Abacus</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeIcon, { color: colors.outline }]}>✕</Text>
          </TouchableOpacity>
        </View>


        {/* Navigation */}
        <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, index) => {
            const isActive = item.route === currentRoute;
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.navItem,
                  isActive && { backgroundColor: colors.primary }
                ]}
                onPress={() => {
                  if (navigationRef.isReady()) {
                    navigationRef.navigate(item.route);
                  }
                  onClose();
                }}
              >
                <Image
                  source={item.icon}
                  style={[
                    styles.navIcon,
                    { tintColor: isActive ? colors.onPrimary : colors.onSurfaceVariant }
                  ]}
                  resizeMode="contain"
                />
                <Text style={[
                  styles.navLabel,
                  isActive ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
          <TouchableOpacity
            style={styles.logoutItem}
            onPress={handleLogout}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size={responsive.responsiveWidth(24)} color={colors.error} />
            ) : (
              <Image
                source={require('../../../assets/cerrar-sesion.png')}
                style={[styles.navIcon, { tintColor: colors.error }]}
                resizeMode="contain"
              />
            )}
            <Text style={[styles.navLabel, { color: colors.error }]}>
              {isSyncing ? 'Sincronizando...' : 'Cerrar Sesión'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.version, { color: colors.outline }]}>v1.0.0</Text>
        </View>
      </Animated.View>
    </>
  );
};

const createStyles = (responsive, insets) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
    paddingTop: insets.top + 10,
    paddingLeft: responsive.responsivePadding(16),
    paddingRight: responsive.responsivePadding(16),
    paddingBottom: responsive.responsivePadding(16),
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(24),
  },
  logo: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  closeButton: {
    padding: 4,
    borderRadius: 9999,
  },
  closeIcon: {
    fontSize: responsive.responsiveFontSize(20),
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: responsive.responsiveMargin(40),
  },
  avatar: {
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
  userStatus: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
    marginTop: 2,
  },
  navContainer: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 9999,
    marginBottom: 4,
  },
  navIcon: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
  },
  navLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: responsive.responsivePadding(16),
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 9999,
    marginBottom: responsive.responsiveMargin(16),
  },
  version: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
});
