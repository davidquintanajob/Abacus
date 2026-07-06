import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PasswordRecoveryScreen } from './src/screens/PasswordRecoveryScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { TiendasScreen } from './src/screens/TiendasScreen';
import { TiendaFormScreen } from './src/screens/TiendaFormScreen';
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
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
