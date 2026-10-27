import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - Firebase auth React Native types can be tricky
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Indica se as variáveis de ambiente do Firebase foram configuradas no arquivo `.env`.
 * Permite que o app rode 100% em modo offline caso alguém clone o repositório público sem `.env`.
 */
export const isFirebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY.trim().length > 0 &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID.trim().length > 0
);

/**
 * Configuração do Firebase via variáveis de ambiente seguras (EXPO_PUBLIC_*).
 * Nunca coloque valores reais aqui — use o arquivo .env local (ignorado pelo .gitignore).
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'offline-demo-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'offline-demo.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'offline-demo',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'offline-demo.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

/**
 * Singleton do Firebase App — evita múltiplas inicializações em hot-reload.
 */
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Auth com persistência nativa via AsyncStorage.
 * Usa initializeAuth na primeira vez; getAuth nas reinicializações (hot-reload).
 * Isso garante que a sessão do usuário sobreviva ao fechamento e reabertura do app.
 */
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth já foi chamado (hot-reload), reutiliza a instância existente
  auth = getAuth(app);
}

/**
 * Instância do Firestore.
 */
const firestore = getFirestore(app);

export { auth, firestore };
