import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const DeudaFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();

  const { deuda, mode } = route.params || { mode: 'add' };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title={mode === 'add' ? 'Nueva Deuda' : mode === 'edit' ? 'Editar Deuda' : 'Ver Deuda'}
          onMenuPress={() => {}}
          onThemePress={() => {}}
          onSettingsPress={undefined}
          onNotificationsPress={undefined}
          onProfilePress={() => navigation.navigate('UserProfile')}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          isDark={isDarkMode}
          showLogo={true}
        />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <View style={styles.messageContainer}>
            <Ionicons name="construct-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.messageTitle, { color: colors.onSurface }]}>
              Módulo de Deudas en Desarrollo
            </Text>
            <Text style={[styles.messageText, { color: colors.outline }]}>
              El módulo de gestión de deudas aún no está implementado en el backend. 
              Contacte al ingeniero de backend para crear el modelo de deudas y sus servicios.
            </Text>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.backButtonText, { color: '#fff' }]}>Volver</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    </SafeAreaView>
  </>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  messageContainer: {
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  messageTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(8),
    textAlign: 'center',
  },
  messageText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: responsive.responsiveHeight(24),
    marginBottom: responsive.responsiveMargin(24),
  },
  backButton: {
    paddingHorizontal: responsive.responsivePadding(32),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default DeudaFormScreen;
