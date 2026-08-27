'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { Menu, ArrowLeft, Moon, Sun, Bell, User, WifiOff, Grid, List } from 'lucide-react';

interface HeaderProps {
  onMenuPress?: () => void;
  onProfilePress?: () => void;
  onThemePress?: () => void;
  onNotificationsPress?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
  isDark?: boolean;
  title?: string;
  showLogo?: boolean;
  onViewModeToggle?: () => void;
  showViewToggle?: boolean;
  viewMode?: 'table' | 'grid';
  currentRoute?: string;
  showMinimalHeader?: boolean;
  onLogoPress?: () => void;
}

export const Header = ({
  onMenuPress,
  onProfilePress,
  onThemePress,
  onNotificationsPress,
  showBackButton = false,
  onBackPress,
  isDark = false,
  title = 'Abacus',
  showLogo = false,
  onViewModeToggle,
  showViewToggle = false,
  viewMode = 'table',
  currentRoute = 'Home',
  showMinimalHeader = false,
  onLogoPress
}: HeaderProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const showBack = typeof showBackButton === 'boolean' ? showBackButton : showBackButton === 'true';


  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push('/profile');
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 md:px-6 pt-4 pb-2 border-b"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.outlineVariant,
      }}
    >
      <div className="flex items-center gap-2">
        {showBack ? (
          <button
            onClick={onBackPress}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
          </button>
        ) : (
          <button
            onClick={onMenuPress}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <Menu size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
          </button>
        )}
        {onLogoPress ? (
          <button
            onClick={onLogoPress}
            className="flex items-center gap-2 hover:bg-black/5 rounded-lg px-2 py-1 transition-colors"
          >
            {showLogo && title === 'Abacus' && (
              <div className="w-8 h-8 md:w-10 md:h-10">
                <Image
                  src={isDarkMode ? '/logo-header-dark.png' : '/logo-header-light.png'}
                  alt="Abacus Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <h1
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.primary }}
            >
              {title || 'Abacus'}
            </h1>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {showLogo && title === 'Abacus' && (
              <div className="w-8 h-8 md:w-10 md:h-10">
                <Image
                  src={isDarkMode ? '/logo-header-dark.png' : '/logo-header-light.png'}
                  alt="Abacus Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <h1
              className="text-2xl md:text-3xl font-bold"
              style={{ color: colors.primary }}
            >
              {title || 'Abacus'}
            </h1>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1 md:gap-2">
        {!showMinimalHeader && showViewToggle && onViewModeToggle && (
          <button
            onClick={onViewModeToggle}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            {viewMode === 'table' ? (
              <Grid size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
            ) : (
              <List size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
            )}
          </button>
        )}
        {!showMinimalHeader && onNotificationsPress && (
          <button
            onClick={onNotificationsPress}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <Bell size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
          </button>
        )}
        {onThemePress && (
          <button
            onClick={onThemePress}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            {isDarkMode ? (
              <Sun size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
            ) : (
              <Moon size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} fill={colors.primary} />
            )}
          </button>
        )}
        {!showMinimalHeader && currentRoute !== 'Profile' && (
          <button
            onClick={handleProfilePress}
            className="p-1 md:p-2 rounded-full hover:bg-black/5 transition-colors"
          >
            <User size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
          </button>
        )}
      </div>
    </header>
  );
};