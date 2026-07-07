import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../../hooks/useResponsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Header = ({ 
  onMenuPress, 
  onProfilePress, 
  onThemePress, 
  onSettingsPress, 
  onNotificationsPress, 
  showBackButton = false, 
  onBackPress, 
  isDark = false, 
  title = 'abacus',
  showLogo = false
}) => {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const insets = useSafeAreaInsets();

  const isDarkMode = isDark === true || isDark === 'true';
  const showBack = showBackButton === true || showBackButton === 'true';

  const styles = createStyles(responsive, insets);

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
      <View style={styles.leftSection}>
        {showBack ? (
          <TouchableOpacity 
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={onMenuPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.primary }]}>
            {title || 'Abacus'}
          </Text>
          {showLogo && title === 'Abacus' && (
            <Image
              source={isDarkMode ? require('../../../Logos/Abacus_sinFondo v4.png') : require('../../../Logos/Abacus_sinFondo v1.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
      
      <View style={styles.rightSection}>
        {onNotificationsPress && (
          <TouchableOpacity 
            onPress={onNotificationsPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onThemePress && (
          <TouchableOpacity 
            onPress={onThemePress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onSettingsPress && (
          <TouchableOpacity 
            onPress={onSettingsPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onProfilePress && (
          <TouchableOpacity 
            onPress={onProfilePress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (responsive, insets) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsive.horizontalPadding,
    paddingTop: insets.top + 10,
    paddingBottom: 10,
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
    gap: responsive.responsiveMargin(8),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  logo: {
    width: responsive.responsiveWidth(30),
    height: responsive.responsiveHeight(30),
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(4),
  },
  iconButton: {
    padding: 4,
    borderRadius: 9999,
  },
  icon: {
    fontSize: responsive.responsiveFontSize(24),
  },
  title: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
});
