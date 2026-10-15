import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { getUsuarioById, changePassword } from '../services/usuarioService';
import configService from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const UserProfileContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { user, token } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  const [dataConsumption, setDataConsumption] = useState(null);
  const [isLoadingConsumption, setIsLoadingConsumption] = useState(false);
  
  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchUserData();
    fetchDataConsumption();
  }, []);

  const fetchDataConsumption = async () => {
    try {
      setIsLoadingConsumption(true);
      
      if (!user?.id_usuario) {
        return;
      }

      // Calcular fechas: primer día del mes actual hasta hoy
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const formatDate = (date) => {
        return date.toISOString().split('T')[0];
      };

      const fechaDesde = formatDate(firstDayOfMonth);
      const fechaHasta = formatDate(today);

      const data = await configService.getAuditLogSummary(user.id_usuario, fechaDesde, fechaHasta);
      setDataConsumption(data);
    } catch (err) {
      // Error fetching data consumption
    } finally {
      setIsLoadingConsumption(false);
    }
  };

  const formatDataConsumption = () => {
    if (!dataConsumption?.sumatorias) return null;
    
    const { totalReq, totalRes } = dataConsumption.sumatorias;
    
    // Convertir todo a KB para sumar
    const toKB = (value, unit) => {
      if (unit === 'GB') return value * 1024 * 1024;
      if (unit === 'MB') return value * 1024;
      return value; // KB
    };
    
    const totalReqKB = toKB(totalReq.valor, totalReq.unidad);
    const totalResKB = toKB(totalRes.valor, totalRes.unidad);
    const totalKB = totalReqKB + totalResKB;
    
    // Determinar la unidad apropiada
    let valor = totalKB;
    let unidad = 'KB';
    
    if (totalKB >= 1024 * 1024) {
      valor = totalKB / (1024 * 1024);
      unidad = 'GB';
    } else if (totalKB >= 1024) {
      valor = totalKB / 1024;
      unidad = 'MB';
    }
    
    // Formatear fechas para mostrar solo la fecha (sin hora)
    const formatDateOnly = (dateString) => {
      if (!dateString) return '';
      // Intentar separar por T (formato ISO)
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }
      // Intentar separar por espacio (formato común)
      if (dateString.includes(' ')) {
        return dateString.split(' ')[0];
      }
      // Si no tiene separador, devolver tal cual
      return dateString;
    };
    
    return {
      valor: valor.toFixed(2),
      unidad,
      fechaDesde: formatDateOnly(dataConsumption.fecha_desde),
      fechaHasta: formatDateOnly(dataConsumption.fecha_hasta),
    };
  };

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!user?.id_usuario) {
        throw new Error('Usuario no autenticado');
      }

      const data = await getUsuarioById(user.id_usuario);

      // Exclude password, createdAt, updatedAt from display
      const { contrasenna, createdAt, updatedAt, ...displayData } = data;
      setUserData(displayData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast({ type: 'warning', message: 'Todos los campos son requeridos' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({ type: 'error', message: 'La nueva contraseña no coincide' });
      return;
    }

    if (newPassword.length < 6) {
      showToast({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }

    try {
      setIsChangingPassword(true);
      
      await changePassword(oldPassword, newPassword);

      showToast({ type: 'success', message: 'Contraseña actualizada correctamente' });
      
      // Reset form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowChangePassword(false);
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderUserInfo = () => {
    if (!userData) return null;

    const fields = [
      { key: 'nombre_natural', label: 'Nombre' },
      { key: 'nombre_usuario', label: 'Usuario' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'direccion', label: 'Dirección' },
      { key: 'rol', label: 'Rol' },
      { key: 'salario_diario', label: 'Salario Diario' },
      { key: 'activo', label: 'Estado' },
    ];

    return (
      <Card style={[styles.userInfoCard, { backgroundColor: colors.surface }]}>
        {fields.map((field) => {
          const value = userData[field.key];
          if (value === undefined || value === null) return null;
          
          let displayValue = value;
          if (field.key === 'salario_diario') {
            displayValue = `$${parseFloat(value).toFixed(2)}`;
          }
          if (field.key === 'activo') {
            displayValue = value ? 'Activo' : 'Inactivo';
          }

          return (
            <View key={field.key} style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.outline }]}>
                {field.label}
              </Text>
              <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                {displayValue}
              </Text>
            </View>
          );
        })}
        
        {userData.tienda && (
          <View style={styles.tiendaSection}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              Información de Tienda
            </Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.outline }]}>
                Nombre Tienda
              </Text>
              <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                {userData.tienda.nombre}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.outline }]}>
                Tipo
              </Text>
              <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                {userData.tienda.tipo}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.outline }]}>
                Estado Tienda
              </Text>
              <Text style={[styles.infoValue, { color: colors.onSurface }]}>
                {userData.tienda.activo ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderDataConsumption = () => {
    const consumption = formatDataConsumption();
    
    if (!consumption) return null;

    return (
      <Card style={[styles.dataConsumptionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.consumptionHeader}>
          <Ionicons name="cloud-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Consumo de Datos
          </Text>
        </View>
        
        {isLoadingConsumption ? (
          <View style={styles.consumptionLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.consumptionContent}>
            <Text style={[styles.consumptionText, { color: colors.outline }]}>
              Desde el {consumption.fechaDesde} hasta el {consumption.fechaHasta}
            </Text>
            <View style={styles.consumptionValueContainer}>
              <Text style={[styles.consumptionValue, { color: colors.primary }]}>
                {consumption.valor} {consumption.unidad}
              </Text>
              <Text style={[styles.consumptionLabel, { color: colors.outline }]}>
                Datos consumidos
              </Text>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderChangePasswordForm = () => {
    if (!showChangePassword) return null;

    return (
      <Card style={[styles.changePasswordCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Cambiar Contraseña
        </Text>
        
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.outline }]}>Contraseña Actual</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholderTextColor={colors.outline}
              secureTextEntry={!showOldPassword}
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TouchableOpacity
              onPress={() => setShowOldPassword(!showOldPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showOldPassword ? "eye-outline" : "eye-off-outline"}
                size={responsive.responsiveWidth(20)}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.outline }]}>Nueva Contraseña</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholderTextColor={colors.outline}
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                size={responsive.responsiveWidth(20)}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.outline }]}>Confirmar Nueva Contraseña</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
            <TextInput
              style={[styles.input, { color: colors.onSurface }]}
              placeholderTextColor={colors.outline}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={responsive.responsiveWidth(20)}
                color={colors.outline}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outline : colors.outlineVariant }]}
            onPress={() => {
              setShowChangePassword(false);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
          >
            <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.confirmButton, { backgroundColor: isDarkMode ? colors.primary : colors.primary }]}
            onPress={handleChangePassword}
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: '#fff' }]}>Cambiar</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <Header 
        showBackButton={true}
        onBackPress={handleBackPress}
        onProfilePress={null}
        isDark={isDarkMode}
        title="Perfil de Usuario"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando datos del usuario...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(48)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchUserData}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Card style={[styles.profileCard, { backgroundColor: colors.surface }]}>
              <View style={styles.profileHeader}>
                <Text style={[styles.profileName, { color: colors.onSurface }]}>
                  {userData?.nombre_natural || 'Usuario'}
                </Text>
                <Text style={[styles.profileRole, { color: colors.outline }]}>
                  {userData?.rol || 'Sin rol'}
                </Text>
              </View>
            </Card>

            {renderUserInfo()}

            {renderDataConsumption()}

            <TouchableOpacity
              style={[styles.changePasswordButton, { backgroundColor: colors.surface }]}
              onPress={() => setShowChangePassword(!showChangePassword)}
            >
              <Ionicons name="lock-closed-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
              <Text style={[styles.changePasswordButtonText, { color: colors.primary }]}>
                {showChangePassword ? 'Ocultar formulario' : 'Cambiar contraseña'}
              </Text>
            </TouchableOpacity>

            {renderChangePasswordForm()}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const UserProfileScreen = () => {
  return <UserProfileContent />;
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: responsive.headerHeight,
  },
  scrollContent: {
    paddingHorizontal: responsive.horizontalPadding,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsive.responsiveMargin(40),
  },
  loadingText: {
    fontSize: responsive.fontSizes.body,
    marginTop: responsive.responsiveMargin(16),
    fontFamily: 'Inter',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsive.responsiveMargin(40),
  },
  errorText: {
    fontSize: responsive.fontSizes.body,
    marginTop: responsive.responsiveMargin(16),
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  retryButton: {
    marginTop: responsive.responsiveMargin(24),
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  profileCard: {
    borderRadius: 16,
    paddingVertical: responsive.responsivePadding(16),
    paddingHorizontal: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(16),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  profileName: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  userInfoCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoLabel: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    flex: 1,
  },
  infoValue: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
    textAlign: 'right',
  },
  tiendaSection: {
    marginTop: responsive.responsiveMargin(20),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  dataConsumptionCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  consumptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginBottom: responsive.responsiveMargin(16),
  },
  consumptionLoading: {
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(20),
  },
  consumptionContent: {
    alignItems: 'center',
  },
  consumptionText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  consumptionValueContainer: {
    alignItems: 'center',
  },
  consumptionValue: {
    fontSize: responsive.responsiveFontSize(28),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  consumptionLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(24),
    gap: responsive.responsiveMargin(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  changePasswordButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  changePasswordCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    marginBottom: responsive.responsiveMargin(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(20),
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  input: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  eyeIcon: {
    padding: responsive.responsivePadding(4),
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
});
