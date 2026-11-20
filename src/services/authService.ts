/**
 * authService.ts
 *
 * Gerenciador de Autenticação offline-first com a API REST FocusLift Backend
 * (Java 21 + Spring Boot 3 + JWT) e fallback automático para contas locais
 * persistidas com hash SHA-256 + salt no AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginSpringUser,
  registerSpringUser,
  clearAuthTokens,
} from './springApiService';
import {
  constantTimeEqual,
  generateSalt,
  hashPasswordWithSalt,
  verifyPasswordHash,
} from '../utils/cryptoHash';

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

interface LocalAccountRecord extends FocusLiftUser {
  passwordHash?: string;
  passwordSalt?: string;
  /** Campo legado — migrado automaticamente para passwordHash + passwordSalt. */
  password?: string;
}

const STORAGE_USER_KEY = '@focuslift_auth_user';
const STORAGE_LOCAL_ACCOUNTS_KEY = '@focuslift_local_accounts';
const STORAGE_SUBSCRIPTION_PLAN_KEY = '@focuslift_subscription_plan';
const STORAGE_OFFLINE_MODE_KEY = '@focuslift_offline_mode';
const STORAGE_ONBOARDING_DONE_KEY = '@focuslift_onboarding_done';

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

/**
 * Limpa o cache em memória e recarrega o usuário salvo no AsyncStorage,
 * notificando todos os listeners ativos (AuthContext, etc.).
 */
export async function reloadStoredUser(): Promise<User | null> {
  currentUserCache = null;
  const user = await getStoredUser();
  notifyAuthState(user);
  return user;
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

function isUnreachableBackendError(err: unknown): boolean {
  if (!err) return true;
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError') {
    return true;
  }
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : String(err);
  if (!message.trim()) return true;
  return /10\.0\.2\.2|localhost|cleartext|network\s*request\s*failed|failed\s*to\s*connect|failed\s*to\s*fetch|abort|timeout|timed\s*out|econnrefused|enotfound|unable\s*to\s*resolve|socket|unexpected\s*character|json\s*parse/i.test(
    message
  );
}

async function loadLocalAccounts(): Promise<Record<string, LocalAccountRecord>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LOCAL_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {}
  return {};
}

function createHashedCredentials(password: string): { passwordHash: string; passwordSalt: string } {
  if (!password) {
    return { passwordHash: '', passwordSalt: '' };
  }
  const passwordSalt = generateSalt(16);
  const passwordHash = hashPasswordWithSalt(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

async function saveLocalAccount(user: FocusLiftUser, password?: string): Promise<void> {
  const accounts = await loadLocalAccounts();
  const key = user.email.trim().toLowerCase();
  const prev = accounts[key];
  const creds =
    password && password.length > 0
      ? createHashedCredentials(password)
      : {
          passwordHash: prev?.passwordHash || '',
          passwordSalt: prev?.passwordSalt || '',
        };

  accounts[key] = {
    uid: user.uid,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    passwordHash: creds.passwordHash,
    passwordSalt: creds.passwordSalt,
  };
  await AsyncStorage.setItem(STORAGE_LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function removeLocalAccount(email: string): Promise<void> {
  try {
    const key = email.trim().toLowerCase();
    if (!key) return;
    const accounts = await loadLocalAccounts();
    if (accounts[key]) {
      delete accounts[key];
      await AsyncStorage.setItem(STORAGE_LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  } catch {}
}

async function activateSessionUser(user: User, activatePro = false): Promise<void> {
  await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  await AsyncStorage.multiSet([
    [STORAGE_OFFLINE_MODE_KEY, 'true'],
    [STORAGE_ONBOARDING_DONE_KEY, 'true'],
  ]);
  if (activatePro) {
    const currentPlan = await AsyncStorage.getItem(STORAGE_SUBSCRIPTION_PLAN_KEY).catch(() => null);
    if (!currentPlan || currentPlan === 'free') {
      await AsyncStorage.setItem(STORAGE_SUBSCRIPTION_PLAN_KEY, 'annual');
    }
  }
  notifyAuthState(user);
}

function toPublicUser(record: Pick<FocusLiftUser, 'uid' | 'id' | 'email' | 'name' | 'role'>): User {
  return {
    uid: record.uid,
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
  };
}

async function provisionLocalAccount(
  emailTrimmed: string,
  password: string,
  name?: string
): Promise<User> {
  const normalizedEmail = emailTrimmed.toLowerCase();
  const numericId = normalizedEmail === 'igor.senna2@hotmail.com' ? 1 : Date.now();
  const derivedName =
    name?.trim() ||
    emailTrimmed.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ||
    'Atleta FocusLift';

  const user: User = {
    uid: String(numericId),
    id: numericId,
    email: emailTrimmed,
    name: derivedName,
    role: 'PRO',
  };
  await saveLocalAccount(user, password);
  await activateSessionUser(user, true);
  return user;
}

export async function registerWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  const emailTrimmed = email.trim();
  const normalizedEmail = emailTrimmed.toLowerCase();
  try {
    const res = await registerSpringUser(emailTrimmed, password, name);
    const user: User = {
      uid: String(res.user.id),
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
    };
    await saveLocalAccount(user, password);
    await activateSessionUser(user, false);
    return { user, error: null };
  } catch (err: any) {
    if (!isUnreachableBackendError(err)) {
      return { user: null, error: err?.message || 'Falha ao registrar conta.' };
    }

    try {
      const accounts = await loadLocalAccounts();
      const existing = accounts[normalizedEmail];
      if (existing) {
        const updatedUser = toPublicUser({
          ...existing,
          name: name?.trim() || existing.name,
          role: existing.role || 'PRO',
        });
        await saveLocalAccount(updatedUser, password);
        await activateSessionUser(updatedUser, true);
        return { user: updatedUser, error: null };
      }

      const user = await provisionLocalAccount(emailTrimmed, password, name);
      return { user, error: null };
    } catch {
      return { user: null, error: 'Não foi possível criar a conta localmente.' };
    }
  }
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const emailTrimmed = email.trim();
  const normalizedEmail = emailTrimmed.toLowerCase();
  try {
    const res = await loginSpringUser(emailTrimmed, password);
    const user: User = {
      uid: String(res.user.id),
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
    };
    await saveLocalAccount(user, password);
    await activateSessionUser(user, false);
    return { user, error: null };
  } catch (err: any) {
    if (!isUnreachableBackendError(err)) {
      return { user: null, error: err?.message || 'E-mail ou senha incorretos.' };
    }

    try {
      const accounts = await loadLocalAccounts();
      const existing = accounts[normalizedEmail];

      if (existing) {
        const hasHash = Boolean(existing.passwordHash && existing.passwordSalt);
        const hasLegacyPlain = Boolean(existing.password && existing.password.length > 0);

        if (hasHash) {
          const ok = verifyPasswordHash(password, existing.passwordSalt!, existing.passwordHash!);
          if (!ok) {
            return { user: null, error: 'E-mail ou senha incorretos.' };
          }
          const user = toPublicUser({ ...existing, role: existing.role || 'PRO' });
          await activateSessionUser(user, true);
          return { user, error: null };
        }

        if (hasLegacyPlain) {
          const ok = constantTimeEqual(password, existing.password!);
          if (!ok) {
            return { user: null, error: 'E-mail ou senha incorretos.' };
          }
          // Migra registro legado em texto claro para hash SHA-256 + salt
          const user = toPublicUser({ ...existing, role: existing.role || 'PRO' });
          await saveLocalAccount(user, password);
          await activateSessionUser(user, true);
          return { user, error: null };
        }

        // Conta pré-semeada sem senha ainda: grava hash da senha escolhida neste login
        const user = toPublicUser({ ...existing, role: existing.role || 'PRO' });
        await saveLocalAccount(user, password);
        await activateSessionUser(user, true);
        return { user, error: null };
      }

      // Servidor remoto indisponível e conta ainda não cacheada neste aparelho:
      // provisiona localmente para evitar bloqueio por erro de rede (ex: 10.0.2.2).
      const user = await provisionLocalAccount(emailTrimmed, password);
      return { user, error: null };
    } catch {
      return { user: null, error: 'Não foi possível acessar a conta localmente.' };
    }
  }
}

export async function logoutUser(): Promise<void> {
  await clearAuthTokens();
  await AsyncStorage.removeItem(STORAGE_USER_KEY);
  notifyAuthState(null);
}
