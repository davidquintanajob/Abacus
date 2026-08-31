'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/common/Toast';
import { Header } from '../../components/layout/Header';
import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { getUsuarioById, changePassword } from '../../services/usuarioService';
import { useResponsive } from '../../hooks/useResponsive';

export default function ProfilePage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchUserData();
  }, []);

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
    } catch (err: any) {
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
    } catch (err: any) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleBackPress = () => {
    router.push('/');
  };

  const handleNotificationsPress = () => {
    // TODO: Implement notifications functionality
  };

  const handleLogoPress = () => {
    if (user) {
      router.push('/');
    }
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
      <div
        className="rounded-2xl p-5 md:p-6 shadow-lg mb-6"
        style={{ 
          backgroundColor: colors.surface,
          transition: isDesktop ? 'transform 0.2s ease, box-shadow 0.2s ease' : 'none'
        }}
        onMouseEnter={(e) => {
          if (isDesktop) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (isDesktop) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }
        }}
      >
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
            <div
              key={field.key}
              className="flex justify-between py-3 border-b"
              style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
            >
              <span
                style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.outline }}
              >
                {field.label}
              </span>
              <span
                style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', fontWeight: '600', color: colors.onSurface }}
              >
                {displayValue}
              </span>
            </div>
          );
        })}
        
        {userData.tienda && (
          <div
            className="mt-5 pt-4 border-t"
            style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}
          >
            <h3
              style={{ fontSize: isDesktop ? '20px' : isTablet ? '18px' : '16px', fontWeight: 'bold', marginBottom: '16px', color: colors.primary, margin: '0 0 16px 0' }}
            >
              Información de Tienda
            </h3>
            <div className="flex justify-between py-3 border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}>
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.outline }}>Nombre Tienda</span>
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', fontWeight: '600', color: colors.onSurface }}>{userData.tienda.nombre}</span>
            </div>
            <div className="flex justify-between py-3 border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}>
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.outline }}>Tipo</span>
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', fontWeight: '600', color: colors.onSurface }}>{userData.tienda.tipo}</span>
            </div>
            <div className="flex justify-between py-3">
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.outline }}>Estado Tienda</span>
              <span style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', fontWeight: '600', color: colors.onSurface }}>{userData.tienda.activo ? 'Activa' : 'Inactiva'}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChangePasswordForm = () => {
    if (!showChangePassword) return null;

    return (
      <div
        className="rounded-2xl p-5 md:p-6 shadow-lg mb-6"
        style={{ 
          backgroundColor: colors.surface,
          transition: isDesktop ? 'transform 0.2s ease, box-shadow 0.2s ease' : 'none'
        }}
        onMouseEnter={(e) => {
          if (isDesktop) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (isDesktop) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }
        }}
      >
        <h3
          style={{ fontSize: isDesktop ? '20px' : isTablet ? '18px' : '16px', fontWeight: 'bold', marginBottom: '20px', color: colors.onSurface, margin: '0 0 20px 0' }}
        >
          Cambiar Contraseña
        </h3>
        
        <div className="mb-4">
          <label
            style={{ fontSize: isDesktop ? '14px' : isTablet ? '13px' : '12px', fontWeight: '500', marginBottom: '8px', display: 'block', color: colors.outline }}
          >
            Contraseña Actual
          </label>
          <div
            className="flex items-center border rounded-lg px-4 py-3 md:px-4 md:py-3"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            }}
          >
            <input
              type={showOldPassword ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.onSurface }}
            />
            <button
              onClick={() => setShowOldPassword(!showOldPassword)}
              className="p-1"
            >
              {showOldPassword ? (
                <EyeOff size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              ) : (
                <Eye size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label
            style={{ fontSize: isDesktop ? '14px' : isTablet ? '13px' : '12px', fontWeight: '500', marginBottom: '8px', display: 'block', color: colors.outline }}
          >
            Nueva Contraseña
          </label>
          <div
            className="flex items-center border rounded-lg px-4 py-3 md:px-4 md:py-3"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            }}
          >
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.onSurface }}
            />
            <button
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="p-1"
            >
              {showNewPassword ? (
                <EyeOff size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              ) : (
                <Eye size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label
            style={{ fontSize: isDesktop ? '14px' : isTablet ? '13px' : '12px', fontWeight: '500', marginBottom: '8px', display: 'block', color: colors.outline }}
          >
            Confirmar Nueva Contraseña
          </label>
          <div
            className="flex items-center border rounded-lg px-4 py-3 md:px-4 md:py-3"
            style={{
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            }}
          >
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', color: colors.onSurface }}
            />
            <button
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="p-1"
            >
              {showConfirmPassword ? (
                <EyeOff size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              ) : (
                <Eye size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.outline }} />
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setShowChangePassword(false);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
            className="flex-1 py-3 md:py-3 rounded-lg font-semibold border-2 transition-all hover:opacity-90"
            style={{
              backgroundColor: colors.surface,
              borderColor: isDarkMode ? colors.outline : colors.outlineVariant,
              color: colors.onSurface,
              fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px',
            }}
          >
            Cancelar
          </button>
          
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="flex-1 py-3 md:py-3 rounded-lg font-semibold shadow-md transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px',
            }}
          >
            {isChangingPassword ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Cambiando...
              </>
            ) : (
              'Cambiar'
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.background }}
    >
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
        onThemePress={toggleTheme}
        onNotificationsPress={handleNotificationsPress}
        onLogoPress={handleLogoPress}
        isDark={isDarkMode}
        title="Perfil de Usuario"
        currentRoute="Profile"
      />

      <div style={{
        marginTop: '80px',
        marginRight: 'auto',
        marginBottom: '0',
        marginLeft: 'auto',
        paddingTop: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingBottom: '120px',
        paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
        maxWidth: isDesktop ? '600px' : '100%',
      }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={isDesktop ? 56 : isTablet ? 52 : 48} className="animate-spin" style={{ color: colors.primary }} />
            <p
              style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', marginTop: '16px', color: colors.outline, margin: '16px 0 0 0' }}
            >
              Cargando datos del usuario...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle size={isDesktop ? 56 : isTablet ? 52 : 48} style={{ color: colors.error }} />
            <p
              style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', marginTop: '16px', textAlign: 'center', color: colors.onSurface, margin: '16px 0 0 0' }}
            >
              {error}
            </p>
            <button
              onClick={fetchUserData}
              className="mt-6 px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold shadow-md transition-all hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff', fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px' }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl p-5 md:p-6 shadow-lg mb-4 text-center"
              style={{ 
                backgroundColor: colors.surface,
                transition: isDesktop ? 'transform 0.2s ease, box-shadow 0.2s ease' : 'none'
              }}
              onMouseEnter={(e) => {
                if (isDesktop) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (isDesktop) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <h2
                style={{ fontSize: isDesktop ? '28px' : isTablet ? '24px' : '20px', fontWeight: 'bold', color: colors.onSurface, margin: 0 }}
              >
                {userData?.nombre_natural || 'Usuario'}
              </h2>
              <p
                style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', marginTop: '8px', color: colors.outline, margin: '8px 0 0 0' }}
              >
                {userData?.rol || 'Sin rol'}
              </p>
            </div>

            {renderUserInfo()}

            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="w-full flex items-center justify-center gap-2 py-4 md:py-4 rounded-xl shadow-md mb-6 transition-all hover:opacity-90"
              style={{ backgroundColor: colors.surface }}
            >
              <Lock size={isDesktop ? 24 : isTablet ? 22 : 20} style={{ color: colors.primary }} />
              <span
                style={{ fontSize: isDesktop ? '16px' : isTablet ? '15px' : '14px', fontWeight: '600', color: colors.primary }}
              >
                {showChangePassword ? 'Ocultar formulario' : 'Cambiar contraseña'}
              </span>
            </button>

            {renderChangePasswordForm()}
          </>
        )}
      </div>
    </div>
  );
}