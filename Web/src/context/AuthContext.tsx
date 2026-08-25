'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    try {
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedConfig = localStorage.getItem('appConfig');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedConfig) {
            setConfig(JSON.parse(storedConfig));
          }
        }
      }
    } catch (error) {
      // Error checking auth
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (nombre_usuario: string, contrasenna: string) => {
    try {
      const response = await api.post('/usuario/login', {
        nombre_usuario,
        contrasenna,
      });

      const { usuario, token: newToken } = response.data;
      
      if (usuario.estado === 'Inactivo' || usuario.activo === false) {
        return {
          success: false,
          error: 'Tu usuario está inactivo. Contacta al administrador.',
          code: 403,
        };
      }
      
      setUser(usuario);
      setToken(newToken);
      setIsOfflineMode(false);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(usuario));
      }
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.errors?.[0] || error.response?.data?.message || error.message || 'Error al iniciar sesión',
        code: error.response?.status ?? null,
      };
    }
  };

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('appConfig');
      }
      setUser(null);
      setToken(null);
      setConfig(null);
    } catch (error) {
      // Error logging out
    }
  };

  const value = {
    user,
    token,
    config,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    isOfflineMode,
    setOfflineMode: setIsOfflineMode,
    permissions: config?.permissions || {
      dependiente: false,
      almacenero: false,
      economico: false,
    },
    entradaAccessLevels: config?.entradaAccessLevels || {
      dependiente: 'none',
      almacenero: 'none',
      economico: 'none',
    },
    entradaManagePermissions: config?.entradaManagePermissions || {
      dependiente: false,
      almacenero: false,
      economico: false,
    },
    salidaAccessLevels: config?.salidaAccessLevels || {
      dependiente: 'none',
      almacenero: 'none',
      economico: 'none',
    },
    salidaManagePermissions: config?.salidaManagePermissions || {
      dependiente: false,
      almacenero: false,
      economico: false,
    },
    operacionAccessLevels: config?.operacionAccessLevels || {
      dependiente: 'none',
      almacenero: 'none',
      economico: 'none',
    },
    operacionManagePermissions: config?.operacionManagePermissions || {
      dependiente: false,
      almacenero: false,
      economico: false,
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};