import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { createTienda, updateTienda } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const TiendaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const { tienda, mode } = route.params || { mode: 'add' };

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: tienda?.nombre || '',
    tipo: tienda?.tipo || '',
    activo: tienda?.activo !== undefined ? tienda.activo : true,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';

  useEffect(() => {
    if (isEditMode && tienda) {
      setFormData({
        nombre: tienda.nombre || '',
        tipo: tienda.tipo || '',
        activo: tienda.activo !== undefined ? tienda.activo : true,
      });
    }
  }, [tienda, isEditMode]);

  const handleSave = async () => {
    // Validation
    if (!formData.nombre.trim()) {
      showToast({ type: 'warning', message: 'El nombre es requerido' });
      return;
    }
    if (formData.nombre.length < 3 || formData.nombre.length > 100) {
      showToast({ type: 'error', message: 'El nombre debe tener entre 3 y 100 caracteres' });
      return;
    }
    if (!formData.tipo.trim()) {
      showToast({ type: 'warning', message: 'El tipo es requerido' });
      return;
    }
    if (formData.tipo.length < 2 || formData.tipo.length > 50) {
      showToast({ type: 'error', message: 'El tipo debe tener entre 2 y 50 caracteres' });
      return;
    }

    try {
      setIsSaving(true);

      if (isEditMode) {
        await updateTienda(tienda.id_tienda, formData);
        showToast({ type: 'success', message: 'Tienda actualizada correctamente' });
      } else {
        await createTienda(formData);
        showToast({ type: 'success', message: 'Tienda creada correctamente' });
      }
      
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
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
        onBackPress={() => navigation.goBack()}
        isDark={isDarkMode}
        title={isEditMode ? 'Editar Tienda' : 'Agregar Tienda'}
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nombre *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isViewMode && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Nombre de la tienda"
              value={formData.nombre}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
              editable={!isViewMode}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tipo *</Text>
            <TextInput
              style={[
                styles.input, 
                { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant },
                isViewMode && styles.inputDisabled
              ]}
              placeholderTextColor={colors.outline}
              placeholder="Tipo de tienda"
              value={formData.tipo}
              onChangeText={(text) => setFormData(prev => ({ ...prev, tipo: text }))}
              editable={!isViewMode}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  { 
                    backgroundColor: formData.activo ? colors.primary : colors.background, 
                    borderColor: formData.activo ? colors.primary : colors.outlineVariant 
                  },
                  isViewMode && styles.inputDisabled
                ]}
                onPress={() => !isViewMode && setFormData(prev => ({ ...prev, activo: true }))}
                disabled={isViewMode}
              >
                <Text style={[styles.statusButtonText, { color: formData.activo ? '#fff' : colors.onSurface }]}>
                  Activa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  { 
                    backgroundColor: !formData.activo ? colors.error : colors.background, 
                    borderColor: !formData.activo ? colors.error : colors.outlineVariant 
                  },
                  isViewMode && styles.inputDisabled
                ]}
                onPress={() => !isViewMode && setFormData(prev => ({ ...prev, activo: false }))}
                disabled={isViewMode}
              >
                <Text style={[styles.statusButtonText, { color: !formData.activo ? '#fff' : colors.onSurface }]}>
                  Inactiva
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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

        {isViewMode && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.setParams({ mode: 'edit' })}
          >
            <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color="#fff" />
            <Text style={[styles.editButtonText, { color: '#fff' }]}>Editar Tienda</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const TiendaFormScreen = () => <TiendaFormContent />;

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
  inputDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    opacity: 0.7,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  statusButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: responsive.fontSizes.body,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
    borderWidth: 1,
  },
  deleteButtonText: {
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
