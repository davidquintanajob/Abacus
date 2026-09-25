import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import * as SecureStore from 'expo-secure-store';

const LoginContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const responsive = useResponsive();
  const [nombre_usuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const [hasOfflineData, setHasOfflineData] = useState(false);

  useEffect(() => {
    checkOfflineData();
    checkVersionError();
  }, []);

  const checkVersionError = async () => {
    try {
      const versionError = await SecureStore.getItemAsync('versionError');
      if (versionError) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'PasswordRecovery' }],
        });
      }
    } catch (error) {
      // Error checking version error
    }
  };

  const checkOfflineData = async () => {
    const hasData = await storageService.hasOfflineData();
    setHasOfflineData(hasData);
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const handleLogin = async () => {
    const trimmedUsername = nombre_usuario.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      showToast({ type: 'warning', message: 'Por favor completa todos los campos' });
      return;
    }

    setIsLoading(true);
    const result = await login(trimmedUsername, trimmedPassword);
    setIsLoading(false);

    if (result.success) {
      navigation.navigate('Home');
    } else {
      const code = result.code ?? null;
      showToast({ type: 'error', message: result.error, code });
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('PasswordRecovery');
  };

  const handleSettings = () => {
    navigation.navigate('Settings', { from: 'Login' });
  };

  const handleOfflineMode = () => {
    navigation.navigate('Home', { isOfflineMode: true });
  };

  const logoSource = isDarkMode
    ? require('../../assets/Logos/Abacus v1.png')
    : require('../../assets/Logos/Abacus v4.png');

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      {/* Settings Button */}
      <TouchableOpacity
        onPress={handleSettings}
        style={styles.settingsButton}
        hitSlop={{ top: responsive.responsiveMargin(10), bottom: responsive.responsiveMargin(10), left: responsive.responsiveMargin(10), right: responsive.responsiveMargin(10) }}
      >
        <Ionicons name="settings-outline" size={responsive.responsiveWidth(24)} color={colors.outline} />
      </TouchableOpacity>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={[styles.logoContainer, { backgroundColor: colors.surface }]}>
              <Image
                source={logoSource}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.primary }]}>
              Abacus
            </Text>
            <Text style={[styles.subtitle, { color: colors.outline }]}>
              Sistema de Gestión
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.onSurface }]}>
                Nombre de Usuario
              </Text>
              <View style={[
                styles.inputWrapper,
                { 
                  backgroundColor: colors.surface,
                  borderColor: colors.outlineVariant 
                }
              ]}>
                <Ionicons 
                  name="person-outline" 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.outline} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="tu_usuario"
                  placeholderTextColor={colors.outline}
                  value={nombre_usuario}
                  onChangeText={(text) => setNombreUsuario(text.trim())}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.onSurface }]}>
                Contraseña
              </Text>
              <View style={[
                styles.inputWrapper,
                { 
                  backgroundColor: colors.surface,
                  borderColor: colors.outlineVariant 
                }
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.outline} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: colors.onSurface }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.outline}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={responsive.responsiveWidth(20)}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.loginButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.loginButtonText, { color: colors.onPrimary }]}>
                  Iniciar Sesión
                </Text>
              )}
            </TouchableOpacity>

            {/* Offline Mode Button */}
            {hasOfflineData && (
              <TouchableOpacity
                onPress={handleOfflineMode}
                style={[styles.offlineButton, { borderColor: colors.outlineVariant }]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="wifi-outline"
                  size={responsive.responsiveWidth(20)}
                  color={colors.outline}
                  style={styles.offlineIcon}
                />
                <Text style={[styles.offlineButtonText, { color: colors.outline }]}>
                  Continuar sin conexión
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const LoginScreen = () => {
  return <LoginContent />;
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: responsive.horizontalPadding,
    paddingVertical: responsive.responsivePadding(40),
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(48),
  },
  logoContainer: {
    width: responsive.responsiveWidth(100),
    height: responsive.responsiveHeight(100),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  logo: {
    width: responsive.responsiveWidth(100),
    height: responsive.responsiveHeight(100),
  },
  title: {
    fontSize: responsive.responsiveFontSize(32),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.responsiveFontSize(32) * 1.25,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
    textAlign: 'center',
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: responsive.responsiveMargin(20),
  },
  inputLabel: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: responsive.responsivePadding(16),
    paddingVertical: responsive.responsivePadding(14),
  },
  inputIcon: {
    marginRight: responsive.responsiveMargin(12),
  },
  input: {
    flex: 1,
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '400',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.bodyLarge * 1.4,
  },
  eyeIcon: {
    padding: responsive.responsivePadding(4),
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(24),
  },
  forgotPasswordText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  loginButton: {
    width: '100%',
    paddingVertical: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsive.responsiveMargin(32),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: responsive.fontSizes.bodyLarge * 1.4,
  },
  offlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(12),
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(16),
  },
  offlineIcon: {
    marginRight: responsive.responsiveMargin(8),
  },
  offlineButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    lineHeight: responsive.fontSizes.body * 1.4,
  },
  settingsButton: {
    position: 'absolute',
    top: responsive.responsiveHeight(50),
    right: responsive.horizontalPadding,
    zIndex: 10,
  },
});
