import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks/useResponsive';

// type: 'success' | 'warning' | 'error'
const TOAST_CONFIG = {
  success: {
    background: '#16A34A',
    icon: 'checkmark-circle',
    label: 'Éxito',
  },
  warning: {
    background: '#D97706',
    icon: 'warning',
    label: 'Advertencia',
  },
  error: {
    background: '#DC2626',
    icon: 'close-circle',
    label: 'Error',
  },
};

export const Toast = ({ visible, type = 'error', message, code, duration = 4000, onHide, toastKey }) => {
  const insets = useSafeAreaInsets() || { top: 0, bottom: 0, left: 0, right: 0 };
  const responsive = useResponsive();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const config = TOAST_CONFIG[type] || TOAST_CONFIG.error;

  useEffect(() => {
    if (visible) {
      // Cancelar timer anterior si hay uno corriendo
      if (timerRef.current) clearTimeout(timerRef.current);

      // Resetear posición antes de animar (por si ya estaba visible)
      translateY.setValue(-120);
      opacity.setValue(0);

      // Entrar
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-cerrar después de `duration` ms
      timerRef.current = setTimeout(() => {
        hide();
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, toastKey]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hide();
  };

  if (!visible) return null;

  const styles = createStyles(responsive, insets);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.background, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      {/* Icono de estado */}
      <View style={styles.iconWrapper}>
        <Ionicons name={config.icon} size={responsive.responsiveWidth(22)} color="#fff" />
      </View>

      {/* Texto */}
      <View style={styles.textWrapper}>
        <Text style={styles.typeLabel}>{config.label}</Text>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        {(code !== undefined && code !== null) ? (
          <Text style={styles.code}>{`Código: ${code}`}</Text>
        ) : null}
      </View>

      {/* Botón cerrar */}
      <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={responsive.responsiveWidth(18)} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (responsive, insets) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: insets.top + 8,
      left: responsive.horizontalPadding,
      right: responsive.horizontalPadding,
      zIndex: 99999,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: responsive.responsivePadding(12),
      paddingHorizontal: responsive.responsivePadding(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 12,
      gap: responsive.responsiveMargin(10),
    },
    iconWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    textWrapper: {
      flex: 1,
      gap: 2,
    },
    typeLabel: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: responsive.fontSizes.caption,
      fontWeight: '600',
      fontFamily: 'JetBrains Mono',
      textTransform: 'uppercase',
      letterSpacing: 0.08,
    },
    message: {
      color: '#fff',
      fontSize: responsive.fontSizes.body,
      fontWeight: '500',
      fontFamily: 'Inter',
      lineHeight: responsive.fontSizes.body * 1.4,
    },
    code: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: responsive.fontSizes.bodySmall,
      fontWeight: '400',
      fontFamily: 'JetBrains Mono',
      marginTop: 2,
    },
    closeButton: {
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
