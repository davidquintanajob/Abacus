import { useWindowDimensions } from 'react-native';

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  // Breakpoints
  const isSmall = width < 375; // iPhone SE, small phones
  const isMedium = width >= 375 && width < 768; // Most phones, small tablets
  const isLarge = width >= 768; // Tablets, large screens

  const breakpoint = isSmall ? 'small' : isMedium ? 'medium' : 'large';

  // Scale factor based on design width (375px as base)
  const scale = width / 375;

  // Helper functions for responsive values
  const responsiveWidth = (value) => {
    if (typeof value === 'number') {
      return value * scale;
    }
    return value;
  };

  const responsiveHeight = (value) => {
    if (typeof value === 'number') {
      return value * scale;
    }
    return value;
  };

  const responsiveFontSize = (size) => {
    if (typeof size === 'number') {
      // Clamp font sizes to be readable
      const scaled = size * scale;
      return Math.max(scaled, size * 0.85); // Don't go below 85% of original
    }
    return size;
  };

  const responsivePadding = (value) => {
    if (typeof value === 'number') {
      return value * scale;
    }
    return value;
  };

  const responsiveMargin = (value) => {
    if (typeof value === 'number') {
      return value * scale;
    }
    return value;
  };

  // Specific responsive values for common patterns
  const horizontalPadding = isSmall ? 12 : isMedium ? 16 : 24;
  const verticalPadding = isSmall ? 12 : isMedium ? 16 : 24;
  const cardPadding = isSmall ? 12 : isMedium ? 16 : 20;
  const buttonHeight = isSmall ? 44 : isMedium ? 48 : 48;
  const headerHeight = isSmall ? 52 : isMedium ? 56 : 64;

  // Font sizes
  const fontSizes = {
    h1: responsiveFontSize(28),
    h2: responsiveFontSize(24),
    h3: responsiveFontSize(20),
    bodyLarge: responsiveFontSize(16),
    body: responsiveFontSize(14),
    bodySmall: responsiveFontSize(12),
    caption: responsiveFontSize(11),
  };

  // Grid columns
  const gridColumns = isSmall ? 2 : isMedium ? 2 : 3;
  const gridGap = isSmall ? 8 : isMedium ? 12 : 16;

  // Sidebar width
  const sidebarWidth = isSmall ? width * 0.85 : isMedium ? 280 : 320;

  return {
    width,
    height,
    isSmall,
    isMedium,
    isLarge,
    breakpoint,
    scale,
    responsiveWidth,
    responsiveHeight,
    responsiveFontSize,
    responsivePadding,
    responsiveMargin,
    horizontalPadding,
    verticalPadding,
    cardPadding,
    buttonHeight,
    headerHeight,
    fontSizes,
    gridColumns,
    gridGap,
    sidebarWidth,
  };
};
