'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/common/Toast';
import { ArrowLeft, Lock, User, Headphones, Phone } from 'lucide-react';

export default function PasswordRecoveryPage() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { toast, showToast, hideToast } = useToast();

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const handleCallSupport = () => {
    const phoneNumber = '+5356242671';
    
    if (!phoneNumber) {
      showToast({
        type: 'error',
        message: 'Teléfono no disponible',
      });
      return;
    }

    // En web, abrir WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\+/g, '')}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleBackPress = () => {
    router.push('/login');
  };

  return (
    <div
      className="min-h-screen flex flex-col p-4"
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

      {/* Header - Fixed at top left */}
      <div className="flex items-center mb-6 md:mb-8">
        <button
          onClick={handleBackPress}
          className="p-2 mr-3 rounded-full hover:bg-black/5 transition-colors"
        >
          <ArrowLeft size={24} className="md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.primary }} />
        </button>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: colors.primary }}
        >
          Recuperar Contraseña
        </h1>
      </div>

      {/* Content - Centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md md:max-w-md lg:max-w-md xl:max-w-md">
          {/* Icon */}
          <div
            className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 md:mb-8 rounded-full flex items-center justify-center shadow-lg"
            style={{ backgroundColor: colors.surface }}
          >
            <Lock size={64} className="md:w-20 md:h-20 lg:w-24 lg:h-24" style={{ color: colors.primary }} />
          </div>

          {/* Title */}
          <h2
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-6 md:mb-8"
            style={{ color: colors.onSurface }}
          >
            ¿Olvidaste tu contraseña?
          </h2>

          {/* Description */}
          <div className="mb-8 md:mb-10">
            <p
              className="text-base md:text-lg mb-6"
              style={{ color: colors.onSurfaceVariant }}
            >
              Para restablecer tu contraseña, por favor comunícate con:
            </p>
            
            <div className="flex items-start mb-4 md:mb-5">
              <User size={20} className="mr-3 mt-1 md:w-6 md:h-6 lg:w-7 lg:h-7" style={{ color: colors.primary }} />
              <p
                className="text-base md:text-lg font-medium"
                style={{ color: colors.onSurface }}
              >
                Tu administrador o jefe del negocio
              </p>
            </div>
            
            <div className="flex items-start mb-4 md:mb-5">
              <Headphones size={20} className="mr-3 mt-1 md:w-6 md:h-6 lg:w-7 lg:h-7" style={{ color: colors.primary }} />
              <p
                className="text-base md:text-lg font-medium"
                style={{ color: colors.onSurface }}
              >
                El soporte técnico
              </p>
            </div>

            <p
              className="text-sm md:text-base italic mt-6 leading-relaxed"
              style={{ color: colors.outline }}
            >
              Por razones de seguridad, no puedes restablecer tu contraseña por ti mismo. El administrador te asignará una nueva contraseña temporal que podrás cambiar después de iniciar sesión.
            </p>
          </div>

          {/* Call Support Button */}
          <button
            onClick={handleCallSupport}
            className="w-full flex items-center justify-center py-4 md:py-4 px-6 rounded-2xl shadow-lg transition-all hover:opacity-90"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}
          >
            <Phone size={24} className="mr-3 md:w-8 md:h-8 lg:w-9 lg:h-9" style={{ color: colors.onPrimary }} />
            <div className="text-left">
              <p
                className="text-base md:text-lg font-semibold"
                style={{ color: colors.onPrimary }}
              >
                Llamar al Soporte
              </p>
              <p
                className="text-sm md:text-base"
                style={{ color: colors.onPrimary }}
              >
                +53 56242671
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}