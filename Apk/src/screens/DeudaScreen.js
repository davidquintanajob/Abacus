import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { useViewMode } from '../context/ViewModeContext';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const DeudaScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { user, deudaAccessLevels, deudaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [deudas, setDeudas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    setIsLoading(true);
    // TODO: Implementar cuando el backend tenga el modelo de deudas
    setTimeout(() => {
      setIsLoading(false);
      setError('El módulo de deudas aún no está implementado en el backend. Contacte al ingeniero de backend.');
    }, 500);
  }, []);

  const userRole = user?.rol?.toLowerCase();
  const canViewAllDeudas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && deudaAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && deudaAccessLevels?.economico === 'all_stores');

  const canManageDeudas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && deudaManagePermissions?.almacenero) ||
    (userRole === 'económico' && deudaManagePermissions?.economico);

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title="Deudas"
          onMenuPress={() => setSidebarOpen(true)}
          onThemePress={toggleTheme}
          onSettingsPress={undefined}
          onNotificationsPress={undefined}
          onProfilePress={() => navigation.navigate('UserProfile')}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode}
          isChangingView={isChangingView}
          isDark={isDarkMode}
          showLogo={true}
        />
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigation}
          currentRoute="Deudas"
        />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Deudas</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Clientes')}
          >
            <Ionicons name="people-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Ver Clientes</Text>
          </TouchableOpacity>
        </View>

        {/* Deudas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando deudas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Clientes')}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Ir a Clientes</Text>
            </TouchableOpacity>
          </Card>
        ) : deudas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay deudas registradas
            </Text>
          </View>
        ) : null}
        </ScrollView>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    </SafeAreaView>
  </>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
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
  actionButtonsContainer: {
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
  },
  errorText: {
    marginTop: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
});

export default DeudaScreen;
