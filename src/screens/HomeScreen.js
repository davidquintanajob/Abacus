import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const HomeContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [greeting, setGreeting] = useState('Buenos días');

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Implementar lógica de notificaciones
    console.log('Notificaciones');
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  const quickAccessItems = [
    { 
      icon: 'cube-outline', 
      iconSet: 'Ionicons',
      label: 'Inventario', 
      description: 'Gestionar stock',
      color: colors.primary 
    },
    { 
      icon: 'shopping-cart', 
      iconSet: 'MaterialIcons',
      label: 'Ventas', 
      description: 'Registrar ventas',
      color: '#16A34A'
    },
    { 
      icon: 'users', 
      iconSet: 'FontAwesome5',
      label: 'Clientes', 
      description: 'Base de datos',
      color: '#185FA5'
    },
    { 
      icon: 'bar-chart', 
      iconSet: 'MaterialIcons',
      label: 'Reportes', 
      description: 'Análisis detallado',
      color: colors.secondary
    },
  ];

  const recentActivities = [
    { id: 1, title: 'Venta #204', subtitle: 'Cliente: Juan Pérez', amount: '+$120', type: 'sale', time: '2 min' },
    { id: 2, title: 'Cliente registrado', subtitle: 'María García', amount: '', type: 'customer', time: '15 min' },
    { id: 3, title: 'Stock actualizado', subtitle: 'Producto: Laptop HP', amount: '-5 unidades', type: 'inventory', time: '1 hora' },
  ];

  const renderIcon = (item) => {
    switch (item.iconSet) {
      case 'Ionicons':
        return <Ionicons name={item.icon} size={28} color={item.color} />;
      case 'MaterialIcons':
        return <MaterialIcons name={item.icon} size={28} color={item.color} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={item.icon} size={24} color={item.color} />;
      default:
        return <Ionicons name="help-circle" size={28} color={item.color} />;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'sale':
        return <Ionicons name="cart" size={20} color="#16A34A" />;
      case 'customer':
        return <Ionicons name="person-add" size={20} color="#185FA5" />;
      case 'inventory':
        return <Ionicons name="cube" size={20} color={colors.secondary} />;
      default:
        return <Ionicons name="information-circle" size={20} color={colors.outline} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
      <Header 
        onMenuPress={() => setSidebarOpen(true)}
        onThemePress={toggleTheme}
        onSettingsPress={handleSettingsPress}
        onNotificationsPress={handleNotificationsPress}
        isDark={isDarkMode}
        title="abacus"
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
          <Text style={[styles.greeting, { color: colors.onSurface }]}>
            {greeting} 👋
          </Text>
          <Text style={[styles.greetingSubtitle, { color: colors.outline }]}>
            Resumen general de tu negocio
          </Text>
        </View>

        {/* Tarjeta Principal Financiera */}
        <View style={styles.financialCardContainer}>
          <Card style={[styles.financialCard, { backgroundColor: isDark ? '#0C447C' : colors.primary }]}>
            <View style={styles.financialCardHeader}>
              <View>
                <Text style={[styles.financialLabel, { color: isDark ? '#ffffff' : colors.onPrimary }]}>
                  Balance Actual
                </Text>
                <Text style={[styles.financialValue, { color: isDark ? '#ffffff' : colors.onPrimary }]}>
                  $24,942
                </Text>
              </View>
              <View style={styles.financialIndicator}>
                <Text style={[styles.financialChange, { color: '#4ADE80' }]}>
                  +12.4%
                </Text>
                <Text style={[styles.financialChangeLabel, { color: isDark ? 'rgba(255,255,255,0.8)' : colors.onPrimaryContainer }]}>
                  este mes
                </Text>
              </View>
            </View>
            
            <View style={[styles.financialDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.15)' }]} />
            
            <View style={styles.financialSecondary}>
              <View style={styles.financialSecondaryItem}>
                <Text style={[styles.financialSecondaryLabel, { color: isDark ? 'rgba(255,255,255,0.8)' : colors.onPrimaryContainer }]}>
                  Ventas
                </Text>
                <Text style={[styles.financialSecondaryValue, { color: isDark ? '#ffffff' : colors.onPrimary }]}>
                  1,204
                </Text>
              </View>
              <View style={[styles.financialVerticalDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.financialSecondaryItem}>
                <Text style={[styles.financialSecondaryLabel, { color: isDark ? 'rgba(255,255,255,0.8)' : colors.onPrimaryContainer }]}>
                  Gastos
                </Text>
                <Text style={[styles.financialSecondaryValue, { color: isDark ? '#ffffff' : colors.onPrimary }]}>
                  $5,200
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Acciones Rápidas */}
        <View style={styles.quickAccessSection}>
          <Text style={[styles.sectionTitle, { color: colors.outline }]}>
            ACCIONES RÁPIDAS
          </Text>
          <View style={styles.quickAccessGrid}>
            {quickAccessItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickAccessItem}
                activeOpacity={0.7}
              >
                <Card style={[styles.quickAccessCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.quickAccessIconContainer, { backgroundColor: `${item.color}15` }]}>
                    {renderIcon(item)}
                  </View>
                  <Text style={[styles.quickAccessLabel, { color: colors.onSurface }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.quickAccessDescription, { color: colors.outline }]}>
                    {item.description}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actividad Reciente */}
        <View style={styles.activitySection}>
          <Text style={[styles.sectionTitle, { color: colors.outline }]}>
            ACTIVIDAD RECIENTE
          </Text>
          <View style={styles.activityList}>
            {recentActivities.map((activity) => (
              <Card key={activity.id} style={[styles.activityItem, { backgroundColor: colors.surface }]}>
                <View style={styles.activityIconContainer}>
                  {getActivityIcon(activity.type)}
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                    {activity.title}
                  </Text>
                  <Text style={[styles.activitySubtitle, { color: colors.outline }]}>
                    {activity.subtitle}
                  </Text>
                </View>
                <View style={styles.activityRight}>
                  {activity.amount && (
                    <Text style={[styles.activityAmount, { color: activity.amount.startsWith('+') ? '#16A34A' : colors.error }]}>
                      {activity.amount}
                    </Text>
                  )}
                  <Text style={[styles.activityTime, { color: colors.outline }]}>
                    {activity.time}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: 56,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  hero: {
    marginBottom: 24,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 36,
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  financialCardContainer: {
    marginBottom: 24,
  },
  financialCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  financialCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  financialLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: 18,
    opacity: 0.9,
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  financialIndicator: {
    alignItems: 'flex-end',
  },
  financialChange: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 24,
  },
  financialChangeLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: 16,
    opacity: 0.8,
  },
  financialDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 16,
  },
  financialSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialSecondaryItem: {
    flex: 1,
  },
  financialSecondaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: 16,
    opacity: 0.8,
    marginBottom: 4,
  },
  financialSecondaryValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 28,
  },
  financialVerticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.1,
    marginBottom: 16,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessItem: {
    width: '48%',
  },
  quickAccessCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  quickAccessIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickAccessLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
  },
  quickAccessDescription: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: 16,
    textAlign: 'center',
  },
  activitySection: {
    marginBottom: 24,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 20,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: 16,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 20,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: 16,
  },
  bottomSpacer: {
    height: 20,
  },
});
