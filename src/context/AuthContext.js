import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as loginService, logout as logoutService, getUser, getToken } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = await getToken();
      const storedUser = await getUser();
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (nombre_usuario, contrasenna) => {
    try {
      const { usuario, token: newToken } = await loginService(nombre_usuario, contrasenna);
      setUser(usuario);
      setToken(newToken);
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
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
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
