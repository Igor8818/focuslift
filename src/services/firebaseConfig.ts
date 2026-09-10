import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Configuração do Firebase via variáveis de ambiente seguras (EXPO_PUBLIC_*).
 * Nunca coloque valores reais aqui — use o arquivo .env local (ignorado pelo .gitignore).
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
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
