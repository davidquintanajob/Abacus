'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/common/Toast';
import { Eye, EyeOff, User, Lock, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  
  const [nombre_usuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      router.push('/');
    } else {
      const code = result.code ?? null;
      showToast({ type: 'error', message: result.error, code, duration: 6000 });
    }
  };

  const handleForgotPassword = () => {
    router.push('/password-recovery');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
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

      <div className="w-full max-w-md md:max-w-md lg:max-w-md xl:max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8 md:mb-12">
          <div
            className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden"
            style={{ backgroundColor: colors.surface }}
          >
            <Image
              src={isDarkMode ? '/logo-light.png' : '/logo-dark.png'}
              alt="Abacus Logo"
              width={96}
              height={96}
              className="w-full h-full object-contain"
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: colors.primary }}
          >
            Abacus
          </h1>
          <p
            className="text-sm md:text-base"
            style={{ color: colors.outline }}
          >
            Sistema de Gestión
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
          {/* Username Input */}
          <div>
            <label
              className="block text-sm md:text-base font-medium mb-2"
              style={{ color: colors.onSurface }}
            >
              Nombre de Usuario
            </label>
            <div
              className="flex items-center border rounded-xl px-4 py-3 md:px-4 md:py-3"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              }}
            >
              <User size={20} className="mr-3" style={{ color: colors.outline }} />
              <input
                type="text"
                placeholder="tu_usuario"
                value={nombre_usuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                className="flex-1 bg-transparent outline-none text-base md:text-lg"
                style={{ color: colors.onSurface }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              className="block text-sm md:text-base font-medium mb-2"
              style={{ color: colors.onSurface }}
            >
              Contraseña
            </label>
            <div
              className="flex items-center border rounded-xl px-4 py-3 md:px-4 md:py-3"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              }}
            >
              <Lock size={20} className="mr-3" style={{ color: colors.outline }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent outline-none text-base md:text-lg"
                style={{ color: colors.onSurface }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff size={20} className={isLoading ? 'opacity-50' : ''} style={{ color: colors.outline }} />
                ) : (
                  <Eye size={20} className={isLoading ? 'opacity-50' : ''} style={{ color: colors.outline }} />
                )}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-center">
            <button
              onClick={handleForgotPassword}
              className="text-sm md:text-base font-medium hover:underline"
              style={{ color: colors.primary }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 md:py-4 rounded-xl font-semibold text-base md:text-lg shadow-md transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: colors.primary,
              color: colors.onPrimary,
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-t-2 mr-2" style={{ borderColor: colors.onPrimary, borderTopColor: 'transparent' }} />
                Cargando...
              </div>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}