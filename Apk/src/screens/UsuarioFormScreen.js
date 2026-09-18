import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { createUsuario, updateUsuario } from '../services/usuarioService';
import { getTiendas } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const ROLES = ["Administrador", "Dependiente", "Almacenero", "Económico"];

const UsuarioFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const { usuario, mode } = route.params || { mode: 'add' };

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  
  const [formData, setFormData] = useState({
    nombre_natural: usuario?.nombre_natural || '',
    telefono: usuario?.telefono || '',
    direccion: usuario?.direccion || '',
    nombre_usuario: usuario?.nombre_usuario || '',
    contrasenna: '',
    salario_diario: usuario?.salario_diario?.toString() || '0',
    rol: usuario?.rol || '',
    activo: usuario?.activo !== undefined ? usuario.activo : true,
    id_tienda: usuario?.id_tienda || null,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
  }, []);

  useEffect(() => {
    if (isEditMode && usuario) {
      setFormData({
        nombre_natural: usuario.nombre_natural || '',
        telefono: usuario.telefono || '',
        direccion: usuario.direccion || '',
        nombre_usuario: (usuario.nombre_usuario || '').trimEnd(),
        contrasenna: '',
        salario_diario: usuario.salario_diario?.toString() || '0',
        rol: usuario.rol || '',
        activo: usuario.activo !== undefined ? usuario.activo : true,
        id_tienda: usuario.id_tienda || null,
      });
    }
  }, [usuario, isEditMode]);

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.nombre_natural.trim()) {
      showToast({ type: 'warning', message: 'El nombre es requerido' });
      return;
    }
    if (formData.nombre_natural.length < 3 || formData.nombre_natural.length > 100) {
      showToast({ type: 'error', message: 'El nombre debe tener entre 3 y 100 caracteres' });
      return;
    }
    if (!formData.nombre_usuario.trim()) {
      showToast({ type: 'warning', message: 'El nombre de usuario es requerido' });
      return;
    }
    if (formData.nombre_usuario.length < 3 || formData.nombre_usuario.length > 50) {
      showToast({ type: 'error', message: 'El nombre de usuario debe tener entre 3 y 50 caracteres' });
      return;
    }
    if (!isEditMode && !formData.contrasenna.trim()) {
      showToast({ type: 'warning', message: 'La contraseña es requerida' });
      return;
    }
    if (formData.contrasenna && formData.contrasenna.length < 6) {
      showToast({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (!formData.rol) {
      showToast({ type: 'warning', message: 'El rol es requerido' });
      return;
    }
    if (!formData.id_tienda) {
      showToast({ type: 'warning', message: 'La tienda es requerida' });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSend = {
        ...formData,
        nombre_usuario: formData.nombre_usuario.trimEnd(),
        salario_diario: parseFloat(formData.salario_diario) || 0,
      };

      // Only include password if it's provided
      if (!dataToSend.contrasenna) {
        delete dataToSend.contrasenna;
      }

      if (isEditMode) {
        await updateUsuario(usuario.id_usuario, dataToSend);
        showToast({ type: 'success', message: 'Usuario actualizado correctamente' });
      } else {
        await createUsuario(dataToSend);
        showToast({ type: 'success', message: 'Usuario creado correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(responsive);

  const selectedTienda = tiendas.find(t => t.id_tienda === formData.id_tienda);

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

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
        onBackPress={() => navigation.goBack()}
        isDark={isDarkMode}
        title={isViewMode ? 'Información del Usuario' : isEditMode ? 'Editar Usuario' : 'Agregar Usuario'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
        keyboardVerticalOffset={responsive.headerHeight + 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre Completo *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isViewMode && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Nombre completo"
              value={formData.nombre_natural}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nombre_natural: text }))}
              editable={!isViewMode}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[styles.label, { color: colors.outline }]}>Nombre de Usuario *</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isViewMode && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Nombre de usuario"
                value={formData.nombre_usuario}
                onChangeText={(text) => setFormData(prev => ({ ...prev, nombre_usuario: text }))}
                onBlur={() => setFormData(prev => ({ ...prev, nombre_usuario: prev.nombre_usuario.trimEnd() }))}
                editable={!isViewMode}
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[styles.label, { color: colors.outline }]}>Rol *</Text>
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  { backgroundColor: colors.background, borderColor: colors.outlineVariant },
                  isViewMode && styles.inputDisabled
                ]}
                onPress={() => !isViewMode && setShowRoleDropdown(!showRoleDropdown)}
                disabled={isViewMode}
              >
                <Text style={[styles.dropdownText, { color: formData.rol ? colors.onSurface : colors.outline }]}>
                  {formData.rol || 'Seleccionar rol'}
                </Text>
                <Ionicons 
                  name={showRoleDropdown ? "chevron-up" : "chevron-down"} 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showRoleDropdown && !isViewMode && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, rol: role }));
                        setShowRoleDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={[styles.formGroup, styles.formGroupWithTopMargin]}>
            <Text style={[styles.label, { color: colors.outline }]}>
              {isEditMode ? 'Contraseña (dejar vacío para mantener)' : 'Contraseña *'}
            </Text>
            <View style={[
              styles.inputWithIcon,
              { backgroundColor: colors.background, borderColor: colors.outlineVariant },
              isViewMode && styles.inputDisabled
            ]}>
              <TextInput
                style={[styles.inputWithIconText, { color: colors.onSurface }]}
                placeholderTextColor={colors.outline}
                placeholder={isEditMode ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                value={formData.contrasenna}
                onChangeText={(text) => setFormData(prev => ({ ...prev, contrasenna: text }))}
                editable={!isViewMode}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              {!isViewMode && (
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
              )}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda *</Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                { backgroundColor: colors.background, borderColor: colors.outlineVariant },
                isViewMode && styles.inputDisabled
              ]}
              onPress={() => !isViewMode && setShowTiendaDropdown(!showTiendaDropdown)}
              disabled={isViewMode}
            >
              <Text style={[styles.dropdownText, { color: selectedTienda ? colors.onSurface : colors.outline }]}>
                {selectedTienda ? selectedTienda.nombre : 'Seleccionar tienda'}
              </Text>
              <Ionicons 
                name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(20)} 
                color={colors.outline} 
              />
            </TouchableOpacity>
            
            {showTiendaDropdown && !isViewMode && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <Ionicons 
                    name="search-outline" 
                    size={responsive.responsiveWidth(18)} 
                    color={colors.outline} 
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar tienda..."
                    value={tiendaSearchText}
                    onChangeText={setTiendaSearchText}
                  />
                </View>
                {filteredTiendas.length > 0 ? (
                  filteredTiendas.map((tienda, index) => (
                    <TouchableOpacity
                      key={tienda.id_tienda}
                      style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, id_tienda: tienda.id_tienda }));
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.dropdownItem}>
                    <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[styles.label, { color: colors.outline }]}>Teléfono</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isViewMode && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="Teléfono"
                value={formData.telefono}
                onChangeText={(text) => setFormData(prev => ({ ...prev, telefono: text }))}
                editable={!isViewMode}
                keyboardType="phone-pad"
              />
            </View>

            <View style={[styles.formGroup, styles.formGroupHalf]}>
              <Text style={[styles.label, { color: colors.outline }]}>Salario Diario</Text>
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                  isViewMode && styles.inputDisabled
                ]}
                placeholderTextColor={colors.outline}
                placeholder="0.00"
                value={formData.salario_diario}
                onChangeText={(text) => setFormData(prev => ({ ...prev, salario_diario: text }))}
                editable={!isViewMode}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={[styles.formGroup, styles.formGroupWithTopMargin]}>
            <Text style={[styles.label, { color: colors.outline }]}>Dirección</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isViewMode && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Dirección"
              value={formData.direccion}
              onChangeText={(text) => setFormData(prev => ({ ...prev, direccion: text }))}
              editable={!isViewMode}
            />
          </View>

          {isEditMode && (
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
              <TouchableOpacity
                style={styles.statusSwitchContainer}
                onPress={() => !isViewMode && setFormData(prev => ({ ...prev, activo: !prev.activo }))}
                disabled={isViewMode}
              >
                <View style={[
                  styles.statusSwitch,
                  { backgroundColor: formData.activo ? '#4CAF50' : '#F44336' },
                  isViewMode && styles.inputDisabled
                ]}>
                  <View style={[
                    styles.statusSwitchKnob,
                    { transform: [{ translateX: formData.activo ? responsive.responsiveWidth(26) : 0 }] }
                  ]}>
                    <Text style={[
                      styles.statusSwitchText,
                      { color: formData.activo ? '#4CAF50' : '#F44336' }
                    ]}>
                      {formData.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {!isViewMode && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {isViewMode && isAdmin && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.setParams({ mode: 'edit' })}
          >
            <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color="#fff" />
            <Text style={[styles.editButtonText, { color: '#fff' }]}>Editar Usuario</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const UsuarioFormScreen = () => <UsuarioFormContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(50),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(20),
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  formGroupHalf: {
    flex: 1,
    marginBottom: 0,
  },
  formGroupWithTopMargin: {
    marginTop: responsive.responsiveMargin(12),
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  inputWithIcon: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(12),
  },
  inputWithIconText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    paddingVertical: responsive.responsivePadding(12),
  },
  eyeIcon: {
    padding: responsive.responsivePadding(8),
  },
  inputDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    opacity: 0.7,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  statusSwitchContainer: {
    alignSelf: 'flex-start',
  },
  statusSwitch: {
    width: responsive.responsiveWidth(80),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    padding: 2,
  },
  statusSwitchKnob: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSwitchText: {
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
