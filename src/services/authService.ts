/**
 * authService.ts
 *
 * Gerenciador de Autenticação com a API REST FocusLift Backend (Java 21 + Spring Boot 3 + JWT).
 * Substitui o Firebase Auth com segurança nativa Bearer Token e persistência local no AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginSpringUser,
  registerSpringUser,
  clearAuthTokens,
} from './springApiService';

export interface FocusLiftUser {
  uid: string;
  id: number;
  email: string;
  name: string | null;
  role?: string;
}

export type User = FocusLiftUser;

export interface AuthResult {
  user: User | null;
  error: string | null;
}

const STORAGE_USER_KEY = '@focuslift_auth_user';

type AuthStateListener = (user: User | null) => void;
const listeners = new Set<AuthStateListener>();

let currentUserCache: User | null = null;

export async function getStoredUser(): Promise<User | null> {
  if (currentUserCache) return currentUserCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_USER_KEY);
    if (raw) {
      currentUserCache = JSON.parse(raw);
      return currentUserCache;
    }
  } catch {}
  return null;
}

export function getCurrentUser(): User | null {
  return currentUserCache;
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  getStoredUser()
    .then((u) => {
      callback(u);
    })
    .catch(() => {
      callback(null);
    });
  return () => {
    listeners.delete(callback);
  };
}

function notifyAuthState(user: User | null) {
  currentUserCache = user;
  for (const listener of listeners) {
    try {
      listener(user);
    } catch (e) {
      console.warn('Erro no auth listener:', e);
    }
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  try {
    const res = await registerSpringUser(email.trim(), password, name);
    const user: User = {
      uid: String(res.user.id),
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
    };
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    notifyAuthState(user);
    return { user, error: null };
  } catch (err: any) {
    return { user: null, error: err?.message || 'Falha ao registrar conta.' };
  }
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const res = await loginSpringUser(email.trim(), password);
    const user: User = {
      uid: String(res.user.id),
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
    };
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    notifyAuthState(user);
    return { user, error: null };
  } catch (err: any) {
    return { user: null, error: err?.message || 'E-mail ou senha incorretos.' };
  }
}

export async function logoutUser(): Promise<void> {
  await clearAuthTokens();
  await AsyncStorage.removeItem(STORAGE_USER_KEY);
  notifyAuthState(null);
}
