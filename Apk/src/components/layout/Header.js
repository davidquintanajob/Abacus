import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useOffline } from '../../context/OfflineContext';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useResponsive } from '../../hooks/useResponsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export const Header = ({
  onMenuPress,
  onProfilePress,
  onThemePress,
  onNotificationsPress,
  onSettingsPress,
  showBackButton = false,
  onBackPress,
  isDark = false,
  title = 'abacus',
  showLogo = false,
  onViewModeToggle,
  showViewToggle = false,
  viewMode = 'table',
  isChangingView = false,
  onLogoPress,
  showVersion = true,
  version = '1.0.0'
}) => {
  const { isOfflineMode } = useOffline();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };

  const isDarkMode = isDark === true || isDark === 'true';
  const showBack = showBackButton === true || showBackButton === 'true';
  const navigation = useNavigation();
  const { isAuthenticated } = useAuth();

  const handleLogoPress = () => {
    if (onLogoPress) {
      onLogoPress();
    } else if (isAuthenticated) {
      navigation.navigate('Home');
    }
  };

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
        <TouchableOpacity 
          style={styles.titleContainer}
          onPress={handleLogoPress}
          activeOpacity={0.7}
        >
          {showLogo && title === 'Abacus' && (
            <Image
              source={isDarkMode ? require('../../../assets/Logos/Abacus_sinFondo v4.png') : require('../../../assets/Logos/Abacus_sinFondo v1.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
          <View style={styles.titleWithVersion}>
            <Text style={[styles.title, { color: colors.primary }]}>
              {title || 'Abacus'}
            </Text>
            {showVersion && (
              <Text style={[styles.version, { color: colors.outline }]}>
                v{version}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.rightSection}>
        {isOfflineMode && (
          <View style={styles.offlineIconContainer}>
            <MaterialCommunityIcons 
              name="wifi-off" 
              size={responsive.responsiveWidth(24)} 
              color={colors.primary} 
            />
          </View>
        )}
        {showViewToggle && onViewModeToggle && (
          <TouchableOpacity 
            onPress={onViewModeToggle}
            style={styles.iconButton}
            activeOpacity={0.7}
            disabled={isChangingView}
          >
            {isChangingView ? (
              <ActivityIndicator 
                size={responsive.responsiveWidth(24)} 
                color={colors.primary} 
              />
            ) : (
              <Ionicons 
                name={viewMode === 'table' ? "grid-outline" : "list-outline"} 
                size={responsive.responsiveWidth(24)} 
                color={colors.primary} 
              />
            )}
          </TouchableOpacity>
        )}
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
  titleWithVersion: {
    flexDirection: 'column',
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
  version: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.responsiveFontSize(10) * 1.2,
  },
  offlineIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
  },
});
