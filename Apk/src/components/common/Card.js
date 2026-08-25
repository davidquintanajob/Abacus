import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';

export const Card = ({ children, style, variant = 'default' }) => {
  const { colors } = useTheme();
  const responsive = useResponsive();

  const styles = createStyles(responsive);

  const getBackgroundColor = () => {
    const variantStr = String(variant || 'default');
    switch (variantStr) {
      case 'primary':
        return colors.primaryContainer;
      case 'secondary':
        return colors.secondaryContainer;
      case 'surface':
        return colors.surface;
      default:
        return colors.surfaceContainerLowest;
    }
  };

  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: getBackgroundColor(),
        borderColor: colors.outlineVariant,
        shadowColor: colors.shadow 
      },
      style
    ]}>
      {children}
    </View>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: responsive.cardPadding,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
});
