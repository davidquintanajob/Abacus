import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as loginService, logout as logoutService, getUser, getToken } from '../services/authService';
import configService from '../services/configService';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = await getToken();
      const storedUser = await getUser();
      const storedConfig = await SecureStore.getItemAsync('appConfig');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        if (storedConfig) {
          setConfig(JSON.parse(storedConfig));
        }
      }
    } catch (error) {
      // Error checking auth
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (nombre_usuario, contrasenna) => {
    try {
      const { usuario, token: newToken } = await loginService(nombre_usuario, contrasenna);
      
      // Check if user is inactive
      if (usuario.estado === 'Inactivo' || usuario.activo === false) {
        return {
          success: false,
          error: 'Tu usuario está inactivo. Contacta al administrador.',
          code: 403,
        };
      }
      
      setUser(usuario);
      setToken(newToken);
      setIsOfflineMode(false); // Desactivar modo offline al iniciar sesión
      
      // Fetch and store configuration after successful login
      try {
        const appConfig = await configService.getConfig();
        setConfig(appConfig);
        await SecureStore.setItemAsync('appConfig', JSON.stringify(appConfig));
      } catch (configError) {
        // Don't fail login if config fetch fails
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code ?? null,
      };
    }
  };

  const logout = async () => {
    try {
      await logoutService();
      setUser(null);
      setToken(null);
      setConfig(null);
      await SecureStore.deleteItemAsync('appConfig');
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
    ventaAccessLevels: config?.ventaAccessLevels || {
      dependiente: 'none',
      almacenero: 'none',
      economico: 'none',
    },
    ventaManagePermissions: config?.ventaManagePermissions || {
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
