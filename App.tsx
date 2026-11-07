import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { setupForegroundNotificationHandler } from './src/services/notificationService';

// Configura o handler de foreground de notificações uma única vez no boot.
// No-op automático no Expo Go (sem crash).
setupForegroundNotificationHandler();


export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <SubscriptionProvider>
              <AppNavigator />
            </SubscriptionProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
