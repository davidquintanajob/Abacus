'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/common/Toast';
import { Header } from '../../components/layout/Header';
import { Sidebar } from '../../components/layout/Sidebar';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serverIP, setServerIP] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const fromLogin = searchParams.get('from') === 'Login';

  useEffect(() => {
    loadServerIP();
  }, []);

  const loadServerIP = () => {
    try {
      const savedURL = localStorage.getItem('serverIP');
      if (savedURL) {
        setServerIP(savedURL);
      } else {
        // Fallback a config por defecto
        setServerIP(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
      }
    } catch (error) {
      // Fallback en caso de error
      setServerIP(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(serverIP);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = () => {
    if (!serverIP.trim()) {
      showToast({ type: 'warning', message: 'Por favor ingrese una URL válida' });
      return;
    }

    try {
      localStorage.setItem('serverIP', serverIP.trim());
      showToast({ type: 'success', message: 'URL del servidor guardada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'No se pudo guardar la URL del servidor' });
    }
  };

  const handleTestConnection = async () => {
    if (!serverIP.trim()) {
      showToast({ type: 'warning', message: 'Por favor ingrese una URL válida' });
      return;
    }

    setIsTestingConnection(true);

    try {
      // Guardar la URL antes de probar
      localStorage.setItem('serverIP', serverIP.trim());
      
      // Crear una instancia temporal de axios con la nueva URL
      const testApi = api;
      testApi.defaults.baseURL = serverIP.trim();
      
      const response = await testApi.get('/api-docs', { timeout: 5000 });
      setIsTestingConnection(false);
      showToast({
        type: 'success',
        message: `El servidor en ${serverIP} está respondiendo correctamente.`,
      });
    } catch (error: any) {
      setIsTestingConnection(false);

      if (error.response) {
        showToast({
          type: 'success',
          message: `El servidor en ${serverIP} está activo y respondiendo.`,
          code: error.response.status,
        });
      } else if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
        showToast({
          type: 'error',
          message: `No se pudo conectar al servidor en ${serverIP}. Verifique que esté corriendo y la URL sea correcta.`,
          code: error.code ?? null,
        });
      } else if (error.code === 'ETIMEDOUT') {
        showToast({
          type: 'warning',
          message: `El servidor en ${serverIP} no respondió a tiempo. Verifique su conexión de red.`,
          code: null,
        });
      } else {
        showToast({
          type: 'error',
          message: `No se pudo conectar al servidor: ${error.message}`,
          code: error.code ?? null,
        });
      }
    }
  };

  const handleBackPress = () => {
    if (fromLogin) {
      router.push('/login');
    } else {
      router.push('/');
    }
  };

  const handleLogoPress = () => {
    if (user && !fromLogin) {
      router.push('/');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
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
        onMenuPress={() => setSidebarOpen(true)}
        onThemePress={toggleTheme}
        onSettingsPress={fromLogin ? undefined : () => {}}
        onNotificationsPress={fromLogin ? undefined : () => {}}
        onLogoPress={fromLogin ? undefined : handleLogoPress}
        showBackButton={fromLogin}
        showMinimalHeader={fromLogin}
        onBackPress={handleBackPress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        currentRoute="Settings"
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        currentRoute="Settings"
      />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {/* Page Title */}
          <div className="text-center mb-8 md:mb-12">
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ color: colors.onSurface }}
            >
              Configuraciones
            </h1>
          </div>

          {/* Header Section */}
          <div className="text-center mb-6 md:mb-8">
            <p
              className="text-base md:text-lg"
              style={{ color: colors.outline }}
            >
              Gestione sus preferencias de conexión e infraestructura
            </p>
          </div>

          {/* IP Server Card */}
          <div className="mb-6">
            <div
              className="rounded-2xl p-5 md:p-6 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="space-y-4 md:space-y-5">
                {/* Input Label */}
                <div>
                  <label
                    className="block text-xs md:text-sm font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: colors.outline }}
                  >
                    URL DE LA API
                  </label>
                </div>
                
                {/* Input Wrapper */}
                <div
                  className="flex items-center border rounded-xl px-4 py-3 md:px-5 md:py-4"
                  style={{
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  }}
                >
                  <input
                    type="text"
                    value={serverIP}
                    onChange={(e) => setServerIP(e.target.value)}
                    placeholder="http://192.168.1.100:4000"
                    className="flex-1 bg-transparent outline-none text-base md:text-lg"
                    style={{ color: colors.onSurface }}
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 ml-2 rounded-full hover:bg-black/5 transition-colors"
                  >
                    {isCopied ? (
                      <Check size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7" style={{ color: colors.primary }} />
                    ) : (
                      <Copy size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7" style={{ color: colors.primary }} />
                    )}
                  </button>
                </div>
                
                {/* Helper Text */}
                <p
                  className="text-sm md:text-base"
                  style={{ color: colors.outline }}
                >
                  Ingrese la URL completa de la API del servidor (ej: http://192.168.1.100:4000).
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <button
              onClick={handleSave}
              className="flex-1 py-3 md:py-4 rounded-xl font-semibold text-base md:text-lg shadow-md transition-all hover:opacity-90"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}
            >
              Guardar Cambios
            </button>
            
            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="flex-1 py-3 md:py-4 rounded-xl font-semibold text-base md:text-lg border-2 transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.primary,
                color: colors.primary,
              }}
            >
              {isTestingConnection ? (
                <>
                  <Loader2 size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7 animate-spin" />
                  Probando...
                </>
              ) : (
                'Probar Conexión'
              )}
            </button>
          </div>

          {/* Equalizer Graphic */}
          <div className="flex justify-center mb-6">
            <div className="flex items-end gap-1.5 md:gap-2 h-20 md:h-24">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div
                  key={item}
                  className="w-2 md:w-2.5 rounded-t"
                  style={{
                    backgroundColor: colors.primary,
                    height: `${20 + (item * 8)}px`,
                    opacity: 0.3 + (item * 0.08),
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4">
            <p
              className="text-xs md:text-sm font-semibold uppercase tracking-wider"
              style={{ color: colors.outline }}
            >
              PROTOCOLO ÁBACUS V1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}