'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { Toast } from '../../../components/common/Toast';
import { createUsuario, updateUsuario, getUsuarioById } from '../../../services/usuarioService';
import { getTiendas } from '../../../services/tiendaService';
import { 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  EyeOff, 
  Search,
  ArrowLeft,
  Edit,
  X
} from 'lucide-react';

const ROLES = ["Administrador", "Dependiente", "Almacenero", "Económico"];

export default function UsuarioFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [usuario, setUsuario] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    nombre_natural: '',
    telefono: '',
    direccion: '',
    nombre_usuario: '',
    contrasenna: '',
    salario_diario: '0',
    rol: '',
    activo: true,
    id_tienda: null as number | null,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    fetchTiendas();
    if (id && (isEditMode || isViewMode)) {
      fetchUsuario();
    }
  }, [id, mode, isEditMode, isViewMode]);

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const fetchUsuario = async () => {
    try {
      setIsLoading(true);
      const data = await getUsuarioById(id!);
      setUsuario(data);
      setFormData({
        nombre_natural: data.nombre_natural || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        nombre_usuario: (data.nombre_usuario || '').trimEnd(),
        contrasenna: '',
        salario_diario: data.salario_diario?.toString() || '0',
        rol: data.rol || '',
        activo: data.activo !== undefined ? data.activo : true,
        id_tienda: data.id_tienda || null,
      });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar usuario' });
    } finally {
      setIsLoading(false);
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

      const dataToSend: any = {
        nombre_natural: formData.nombre_natural,
        telefono: formData.telefono,
        direccion: formData.direccion,
        nombre_usuario: formData.nombre_usuario.trimEnd(),
        salario_diario: parseFloat(formData.salario_diario) || 0,
        rol: formData.rol,
        activo: formData.activo,
        id_tienda: formData.id_tienda,
      };

      // Only include password if it's provided
      if (formData.contrasenna) {
        dataToSend.contrasenna = formData.contrasenna;
      }

      if (isEditMode && id) {
        await updateUsuario(id, dataToSend);
        showToast({ type: 'success', message: 'Usuario actualizado correctamente' });
      } else {
        await createUsuario(dataToSend);
        showToast({ type: 'success', message: 'Usuario creado correctamente' });
      }
      
      router.push('/usuarios');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTienda = tiendas.find((t: any) => t.id_tienda === formData.id_tienda);

  const filteredTiendas = tiendas.filter((tienda: any) =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/usuarios')}
          isDark={isDarkMode}
          title={isViewMode ? 'Información del Usuario' : isEditMode ? 'Editar Usuario' : 'Agregar Usuario'}
          currentRoute="Usuarios"
        />

        <div className="pt-24 px-4 md:px-4 lg:px-4 pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando usuario...</p>
            </div>
          ) : (
            <div 
              className="rounded-2xl p-5 shadow-lg max-w-2xl mx-auto"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    fontFamily: 'Inter, sans-serif'
                  }}
                  placeholder="Nombre completo"
                  value={formData.nombre_natural}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre_natural: e.target.value }))}
                  disabled={isViewMode}
                />
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-5">
                <div className="flex-1">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Nombre de Usuario *
                  </label>
                  <input
                    type="text"
                    className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Nombre de usuario"
                    value={formData.nombre_usuario}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre_usuario: e.target.value }))}
                    onBlur={() => setFormData(prev => ({ ...prev, nombre_usuario: prev.nombre_usuario.trimEnd() }))}
                    disabled={isViewMode}
                  />
                </div>

                <div className="flex-1 relative">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Rol *
                  </label>
                  <button
                    className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border flex justify-between items-center ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant 
                    }}
                    onClick={() => !isViewMode && setShowRoleDropdown(!showRoleDropdown)}
                    disabled={isViewMode}
                  >
                    <span style={{ color: formData.rol ? colors.onSurface : colors.outline }}>
                      {formData.rol || 'Seleccionar rol'}
                    </span>
                    {showRoleDropdown ? (
                      <ChevronUp size={20} style={{ color: colors.outline }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: colors.outline }} />
                    )}
                  </button>
                  
                  {showRoleDropdown && !isViewMode && (
                    <div 
                      className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      {ROLES.map((role) => (
                        <button
                          key={role}
                          className="w-full px-4 py-3 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, rol: role }));
                            setShowRoleDropdown(false);
                          }}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  {isEditMode ? 'Contraseña (dejar vacío para mantener)' : 'Contraseña *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 pr-12 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder={isEditMode ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                    value={formData.contrasenna}
                    onChange={(e) => setFormData(prev => ({ ...prev, contrasenna: e.target.value }))}
                    disabled={isViewMode}
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={20} style={{ color: colors.outline }} />
                      ) : (
                        <Eye size={20} style={{ color: colors.outline }} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-5 relative">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Tienda *
                </label>
                <button
                  className={`w-full rounded-lg px-4 py-3 border flex justify-between items-center ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant 
                  }}
                  onClick={() => !isViewMode && setShowTiendaDropdown(!showTiendaDropdown)}
                  disabled={isViewMode}
                >
                  <span style={{ color: selectedTienda ? colors.onSurface : colors.outline }}>
                    {selectedTienda ? selectedTienda.nombre : 'Seleccionar tienda'}
                  </span>
                  {showTiendaDropdown ? (
                    <ChevronUp size={20} style={{ color: colors.outline }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  )}
                </button>
                
                {showTiendaDropdown && !isViewMode && (
                  <div 
                    className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                  >
                    <div className="px-3 py-2">
                      <div className="flex items-center border rounded-lg px-3 py-2" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}>
                        <Search size={18} style={{ color: colors.outline, marginRight: 8 }} />
                        <input
                          type="text"
                          className="flex-1 bg-transparent outline-none"
                          style={{ color: colors.onSurface }}
                          placeholder="Buscar tienda..."
                          value={tiendaSearchText}
                          onChange={(e) => setTiendaSearchText(e.target.value)}
                        />
                      </div>
                    </div>
                    {filteredTiendas.length > 0 ? (
                      filteredTiendas.map((tienda: any, index: number) => (
                        <button
                          key={tienda.id_tienda}
                          className="w-full px-4 py-3 text-left hover:bg-black/5"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, id_tienda: tienda.id_tienda }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                          }}
                        >
                          {tienda.nombre}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3" style={{ color: colors.outline }}>
                        No se encontraron tiendas
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-5">
                <div className="flex-1">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Teléfono"
                    value={formData.telefono}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    disabled={isViewMode}
                  />
                </div>

                <div className="flex-1">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Salario Diario
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="0.00"
                    value={formData.salario_diario}
                    onChange={(e) => setFormData(prev => ({ ...prev, salario_diario: e.target.value }))}
                    disabled={isViewMode}
                  />
                </div>
              </div>

              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Dirección
                </label>
                <input
                  type="text"
                  className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    fontFamily: 'Inter, sans-serif'
                  }}
                  placeholder="Dirección"
                  value={formData.direccion}
                  onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                  disabled={isViewMode}
                />
              </div>

              {isEditMode && (
                <div className="mb-5">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Estado
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className={`relative w-20 h-7 rounded-full transition-colors ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                      style={{ 
                        backgroundColor: formData.activo ? '#4CAF50' : '#F44336',
                      }}
                      onClick={() => !isViewMode && setFormData(prev => ({ ...prev, activo: !prev.activo }))}
                      disabled={isViewMode}
                    >
                      <div
                        className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform"
                        style={{
                          transform: formData.activo ? 'translateX(52px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                    <span 
                      className="ml-3 font-medium"
                      style={{ color: colors.onSurface }}
                    >
                      {formData.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              )}

              {!isViewMode && (
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface
                    }}
                    onClick={() => router.push('/usuarios')}
                  >
                    <span className="font-medium">Cancelar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <span className="font-medium">Guardar</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {isViewMode && isAdmin && (
            <button
              className="w-full max-w-2xl mx-auto rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 mt-6 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => router.push(`/usuarios/form?id=${id}&mode=edit`)}
            >
              <Edit size={18} />
              <span className="font-medium">Editar Usuario</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
