import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export const Header = ({ 
  onMenuPress, 
  onProfilePress, 
  onThemePress, 
  onSettingsPress, 
  onNotificationsPress, 
  showBackButton = false, 
  onBackPress, 
  isDark = false, 
  title = 'abacus' 
}) => {
  const { colors } = useTheme();

  const isDarkMode = isDark === true || isDark === 'true';
  const showBack = showBackButton === true || showBackButton === 'true';

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity 
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={onMenuPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: colors.primary }]}>
          {title || 'abacus'}
        </Text>
      </View>
      
      <View style={styles.rightSection}>
        {onNotificationsPress && (
          <TouchableOpacity 
            onPress={onNotificationsPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onThemePress && (
          <TouchableOpacity 
            onPress={onThemePress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onSettingsPress && (
          <TouchableOpacity 
            onPress={onSettingsPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          onPress={onProfilePress}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 4,
    borderRadius: 9999,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
});
