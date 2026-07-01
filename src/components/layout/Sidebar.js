import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export const Sidebar = ({ isOpen = false, onClose, navigation }) => {
  const { colors } = useTheme();

  const menuItems = [
    { icon: '📊', label: 'Panel', route: 'Dashboard' },
    { icon: '📦', label: 'Inventario', route: 'Inventory' },
    { icon: '🛒', label: 'Ventas', route: 'Sales' },
    { icon: '👥', label: 'Clientes', route: 'Customers' },
    { icon: '📈', label: 'Reportes', route: 'Reports' },
    { icon: '⚙️', label: 'Configuración', route: 'Settings' },
  ];

  const isSidebarOpen = isOpen === true || isOpen === 'true';

  const translateX = useRef(new Animated.Value(-288)).current;
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
          toValue: -288,
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
  }, [isSidebarOpen]);

  if (!isSidebarOpen && translateX._value === -288) return null;

  return (
    <>
      <Animated.View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayOpacity }]} />
      <Animated.View style={[styles.sidebar, { backgroundColor: colors.surfaceContainer, transform: [{ translateX }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.primary }]}>abacus</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeIcon, { color: colors.outline }]}>✕</Text>
          </TouchableOpacity>
        </View>


        {/* Navigation */}
        <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.navItem,
                index === 0 && { backgroundColor: colors.primary }
              ]}
              onPress={() => {
                if (navigation && item.route === 'Settings') {
                  navigation.navigate('Settings');
                }
                onClose();
              }}
            >
              <Text style={[
                styles.navIcon,
                index === 0 ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }
              ]}>
                {item.icon}
              </Text>
              <Text style={[
                styles.navLabel,
                index === 0 ? { color: colors.onPrimary } : { color: colors.onSurfaceVariant }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
          <Text style={[styles.version, { color: colors.outline }]}>v1.0.0</Text>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
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
    width: 288,
    zIndex: 50,
    padding: 16,
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
    marginBottom: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  closeButton: {
    padding: 4,
    borderRadius: 9999,
  },
  closeIcon: {
    fontSize: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
  },
  avatar: {
    width: 48,
    height: 48,
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
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
  userStatus: {
    fontSize: 12,
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
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    marginBottom: 4,
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  version: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
});
