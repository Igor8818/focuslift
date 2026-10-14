/**
 * autoSyncService.ts
 *
 * Backup automático na nuvem ao finalizar um treino (recurso FocusLift PRO).
 *
 * Por que NÃO um webhook: webhooks são chamadas servidor→servidor. O app já escreve
 * direto no Firestore (protegido por Auth + Security Rules), então basta disparar a
 * escrita no momento certo — sem servidor intermediário, sem custo extra de infra.
 *
 * Estratégia offline-first:
 *  1. Treino sempre salva no SQLite primeiro (nunca depende de rede).
 *  2. Se PRO + logado + auto-sync ligado → envia só o treino novo (incremental).
 *  3. Se falhar (sem internet, timeout), marca `pending` e tenta o sync completo
 *     na próxima abertura do app (`retryPendingSync`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  syncWorkoutToCloud,
  syncLocalDataToCloud,
} from './syncService';
import type { WorkoutWithDetails } from '../database/db';

export const AUTO_SYNC_ENABLED_KEY = '@focuslift_auto_sync_enabled';
const PENDING_SYNC_KEY = '@focuslift_sync_pending';
export const LAST_SYNC_KEY = '@focuslift_last_sync';

/** Tempo máximo esperando a nuvem — evita ficar preso offline (o Firestore enfileira escritas). */
const SYNC_TIMEOUT_MS = 15000;

export type AutoSyncStatus = 'skipped' | 'synced' | 'pending';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado ao sincronizar.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function stampLastSync(): Promise<void> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await AsyncStorage.setItem(LAST_SYNC_KEY, `${now.toLocaleDateString()} às ${timeStr}`);
}

/** Auto-sync vem LIGADO por padrão para quem é PRO. */
export async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
    return stored !== 'false';
  } catch {
    return true;
  }
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Dispara o backup do treino recém-finalizado. Nunca lança — a UI de treino
 * não pode quebrar por causa de rede.
 */
export async function autoSyncAfterWorkout(params: {
  userId: string | null | undefined;
  isPro: boolean;
  workout: WorkoutWithDetails;
}): Promise<AutoSyncStatus> {
  const { userId, isPro, workout } = params;

  // Gate PRO + guard de autenticação (a regra de segurança real fica nas Firestore Rules).
  if (!isPro || !userId) return 'skipped';
  if (!(await isAutoSyncEnabled())) return 'skipped';

  try {
    await withTimeout(syncWorkoutToCloud(userId, workout), SYNC_TIMEOUT_MS);
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
    await stampLastSync();
    return 'synced';
  } catch (err) {
    console.warn('Auto-sync falhou, será tentado novamente na próxima abertura:', err);
    try {
      await AsyncStorage.setItem(PENDING_SYNC_KEY, '1');
    } catch {}
    return 'pending';
  }
}

/** Chamado ao abrir o app: se algum auto-sync ficou pendente, faz o sync completo. */
export async function retryPendingSync(params: {
  userId: string | null | undefined;
  isPro: boolean;
}): Promise<boolean> {
  const { userId, isPro } = params;
  if (!isPro || !userId) return false;

  try {
    const pending = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    if (pending !== '1') return false;
    if (!(await isAutoSyncEnabled())) return false;

    const result = await withTimeout(syncLocalDataToCloud(userId), SYNC_TIMEOUT_MS * 4);
    if (result.errors.length === 0) {
      await AsyncStorage.removeItem(PENDING_SYNC_KEY);
      await stampLastSync();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Retry de sync pendente falhou:', err);
    return false;
  }
}
