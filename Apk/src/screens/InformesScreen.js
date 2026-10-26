import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const InformesContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const reportOptions = [
    {
      id: 'general',
      title: 'Informe General',
      subtitle: 'Ganancias, ventas, pérdidas y costos',
      icon: 'bar-chart-outline',
      color: '#4CAF50',
      route: 'InformeGeneral',
      available: true,
    },
    {
      id: 'ventas',
      title: 'Informe de Ventas',
      subtitle: 'Análisis detallado de ventas',
      icon: 'cart-outline',
      color: '#2196F3',
      route: 'InformeVentas',
      available: true,
    },
    {
      id: 'perdidas',
      title: 'Pérdidas por Salidas',
      subtitle: 'Reporte de pérdidas de productos',
      icon: 'trending-down-outline',
      color: '#F44336',
      route: 'InformeSalidas',
      available: true,
    },
    {
      id: 'inventario',
      title: 'Inventario de Productos',
      subtitle: 'Stock y valor de inventario',
      icon: 'cube-outline',
      color: '#9C27B0',
      route: 'InventarioProductos',
      available: true,
    },
    {
      id: 'cuentas',
      title: 'Informe de Cuentas',
      subtitle: 'Estado y movimientos de cuentas',
      icon: 'wallet-outline',
      color: '#FF9800',
      route: 'InformeCuentas',
      available: true,
    },
  ];

  const handleReportPress = (report) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    if (!report.available) {
      showToast({ type: 'info', message: 'Este informe está en desarrollo' });
      return;
    }

    if (report.route) {
      navigation.navigate(report.route);
    }
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
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
        onSettingsPress={undefined}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        onViewModeToggle={undefined}
        showViewToggle={false}
        viewMode={null}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="Informes"
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Informes</Text>
          <Text style={[styles.pageSubtitle, { color: colors.outline }]}>
            Selecciona el informe que deseas generar
          </Text>
        </View>

        {/* Report Options */}
        {reportOptions.map((report) => (
          <TouchableOpacity
            key={report.id}
            onPress={() => handleReportPress(report)}
            activeOpacity={0.7}
            disabled={isOfflineMode}
          >
            <Card style={[styles.reportCard, { backgroundColor: colors.surface }]}>
              <View style={styles.reportContent}>
                <View style={[styles.reportIconContainer, { backgroundColor: `${report.color}20` }]}>
                  <Ionicons name={report.icon} size={32} color={report.color} />
                </View>
                <View style={styles.reportInfo}>
                  <Text style={[styles.reportTitle, { color: colors.onSurface }]}>
                    {report.title}
                  </Text>
                  <Text style={[styles.reportSubtitle, { color: colors.outline }]}>
                    {report.subtitle}
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={colors.outline} 
                />
              </View>
              {!report.available && (
                <View style={styles.developmentBadge}>
                  <Text style={[styles.developmentBadgeText, { color: colors.outline }]}>
                    En desarrollo
                  </Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
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
    marginBottom: responsive.responsiveMargin(24),
    marginTop: responsive.responsiveMargin(60),
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(8),
  },
  pageSubtitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  reportCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  reportContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsive.responsiveMargin(16),
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(4),
  },
  reportSubtitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  developmentBadge: {
    alignSelf: 'flex-start',
    marginTop: responsive.responsiveMargin(12),
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(4),
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
  },
  developmentBadgeText: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
});

export default InformesContent;
