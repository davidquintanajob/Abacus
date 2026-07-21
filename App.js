import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PasswordRecoveryScreen } from './src/screens/PasswordRecoveryScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { TiendasScreen } from './src/screens/TiendasScreen';
import { TiendaFormScreen } from './src/screens/TiendaFormScreen';
import { UsuariosScreen } from './src/screens/UsuariosScreen';
import { UsuarioFormScreen } from './src/screens/UsuarioFormScreen';
import { ServiciosScreen } from './src/screens/ServiciosScreen';
import { ServicioFormScreen } from './src/screens/ServicioFormScreen';
import { ProductosScreen } from './src/screens/ProductosScreen';
import { ProductoFormScreen } from './src/screens/ProductoFormScreen';
import { BarcodeScannerScreen } from './src/screens/BarcodeScannerScreen';
import { CurrencyExchangeScreen } from './src/screens/CurrencyExchangeScreen';
import { navigationRef } from './src/navigationRef';

const Stack = createNativeStackNavigator();

// El stack se define siempre con todas las pantallas.
// initialRouteName se fija una sola vez al montarse — no se
// reconstruye el árbol por re-renders del AuthContext.
const AppStack = ({ initialRoute }) => (
  <Stack.Navigator
    initialRouteName={initialRoute}
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}
  >
    <Stack.Screen
      name="Login"
      component={LoginScreen}
      options={{ animation: 'fade' }}
    />
    <Stack.Screen name="PasswordRecovery" component={PasswordRecoveryScreen} />
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    <Stack.Screen name="Tiendas" component={TiendasScreen} />
    <Stack.Screen name="TiendaForm" component={TiendaFormScreen} />
    <Stack.Screen name="Usuarios" component={UsuariosScreen} />
    <Stack.Screen name="UsuarioForm" component={UsuarioFormScreen} />
    <Stack.Screen name="Servicios" component={ServiciosScreen} />
    <Stack.Screen name="ServicioForm" component={ServicioFormScreen} />
    <Stack.Screen name="Productos" component={ProductosScreen} />
    <Stack.Screen name="ProductoForm" component={ProductoFormScreen} />
    <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
    <Stack.Screen name="CurrencyExchange" component={CurrencyExchangeScreen} />
  </Stack.Navigator>
);

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppStack initialRoute={isAuthenticated ? 'Home' : 'Login'} />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineProvider>
          <ThemeProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </ThemeProvider>
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
