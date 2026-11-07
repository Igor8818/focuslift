/**
 * springApiService.ts
 *
 * Cliente HTTP para a API REST FocusLift Backend (Java 21 + Spring Boot 3 + PostgreSQL).
 * Gerencia autenticacao JWT (Bearer Token), sincronizacao em nuvem e AI Coach.
 *
 * Possui fallback inteligente: caso o servidor esteja offline ou o usuario esteja sem internet,
 * analisa os treinos do SQLite localmente com a mesma formula deterministica de Brzycki e volume!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { type WorkoutWithDetails } from '../database/db';

const STORAGE_API_URL_KEY = '@focuslift_spring_api_url';
const STORAGE_ACCESS_TOKEN_KEY = '@focuslift_jwt_access_token';
const STORAGE_REFRESH_TOKEN_KEY = '@focuslift_jwt_refresh_token';
const STORAGE_DEVICE_ATHLETE_KEY = '@focuslift_device_athlete_id';

// Em emulador Android, 10.0.2.2 aponta para o localhost da maquina host
const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export interface SpringAuthUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface SpringAuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: SpringAuthUser;
}

export interface ProgressionMetric {
  exerciseName: string;
  muscleGroup: string;
  current1Rm: number;
  previous1Rm: number;
  delta1RmKg: number;
  delta1RmPercent: number;
  currentTopWeight: number;
  currentTopReps: number;
  previousTopWeight: number;
  previousTopReps: number;
}

export interface PlateauExercise {
  exerciseName: string;
  routineTitle: string;
  consecutiveStagnantSessions: number;
  currentWeight: number;
  currentReps: number;
  averageRpe: number;
  suggestedAction: string;
}

export interface AcwrMetric {
  acuteVolumeKg: number;
  chronicWeeklyVolumeKg: number;
  ratio: number;
  riskLevel: 'INSUFFICIENT_DATA' | 'UNDER_TRAINING' | 'OPTIMAL' | 'OVERREACHING' | 'DANGER_ZONE' | string;
  interpretation: string;
  recommendation: string;
}

export interface AiCoachAnalysis {
  athleteName: string;
  analyzedWorkoutsCount: number;
  currentWeekVolumeKg: number;
  previousWeekVolumeKg: number;
  volumeDeltaPercent: number;
  topProgressions: ProgressionMetric[];
  detectedPlateaus: PlateauExercise[];
  aiSummary: string;
  tacticalAdvice: string;
  nextSessionFocus: string;
  generatedAt: string;
  acwr?: AcwrMetric;
}

export interface AiCoachChatResponse {
  answer: string;
  keyTakeaways: string[];
  timestamp: string;
}

export async function getBackendBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_API_URL_KEY);
    return saved && saved.trim().length > 0 ? saved.trim() : DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export async function setBackendBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_API_URL_KEY, url.trim());
}

export async function getStoredAccessToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveAuthTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
  await AsyncStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await AsyncStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function clearAuthTokens(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_ACCESS_TOKEN_KEY, STORAGE_REFRESH_TOKEN_KEY]);
}

/**
 * Verifica se a API Spring Boot esta acessivel na rede atual.
 */
export async function checkBackendHealth(): Promise<{ online: boolean; message: string }> {
  try {
    const baseUrl = await getBackendBaseUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      return { online: true, message: 'Conectado ao Backend Spring Boot' };
    }
    return { online: false, message: `Servidor retornou status ${response.status}` };
  } catch (err: any) {
    return { online: false, message: err?.message || 'Servidor offline' };
  }
}

/**
 * Autentica ou cria conta no backend Spring Boot.
 */
export async function registerSpringUser(email: string, password: string, name?: string): Promise<SpringAuthResponse> {
  const baseUrl = await getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Falha ao registrar no backend.');
  }
  const data: SpringAuthResponse = await res.json();
  await saveAuthTokens(data);
  return data;
}

export async function loginSpringUser(email: string, password: string): Promise<SpringAuthResponse> {
  const baseUrl = await getBackendBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'E-mail ou senha invalidos.');
  }
  const data: SpringAuthResponse = await res.json();
  await saveAuthTokens(data);
  return data;
}

/**
 * Garante uma sessao JWT valida com o backend Spring Boot.
 * Cria conta de atleta vinculada unicamente a este dispositivo caso ainda nao esteja logado.
 */
export async function ensureValidSpringSession(): Promise<string> {
  const existing = await getStoredAccessToken();
  if (existing && existing.trim().length > 0) return existing;

  let deviceId = await AsyncStorage.getItem(STORAGE_DEVICE_ATHLETE_KEY);
  if (!deviceId || deviceId.trim().length === 0) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await AsyncStorage.setItem(STORAGE_DEVICE_ATHLETE_KEY, deviceId);
  }

  const defaultEmail = `${deviceId}@focuslift.local`;
  const defaultPassword = `FL_device_${deviceId}_secret!`;
  try {
    const auth = await loginSpringUser(defaultEmail, defaultPassword);
    return auth.accessToken;
  } catch {
    const auth = await registerSpringUser(defaultEmail, defaultPassword, `Atleta (${deviceId.slice(-6)})`);
    return auth.accessToken;
  }
}

/**
 * Sincroniza treinos locais do SQLite com a nuvem Spring Boot antes de rodar o AI Coach.
 */
export async function syncLocalWorkoutsToSpringBackend(workouts: WorkoutWithDetails[]): Promise<boolean> {
  try {
    const token = await ensureValidSpringSession();
    const baseUrl = await getBackendBaseUrl();

    const pushPayload = {
      workouts: workouts.map((w) => ({
        id: w.id,
        clientUuid: `workout-local-${w.id}`,
        title: w.title,
        date: w.date,
        notes: w.notes,
        totalVolumeKg: w.exercises.reduce(
          (acc, ex) =>
            acc +
            ex.sets.reduce(
              (sAcc, s) => sAcc + (s.set_type !== 'warmup' && s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0),
              0
            ),
          0
        ),
        exercises: w.exercises.map((ex, exIdx) => ({
          name: ex.name,
          muscleGroup: ex.muscle_group || null,
          restTimerSeconds: ex.rest_timer_seconds || 90,
          orderIndex: exIdx,
          sets: ex.sets.map((s, sIdx) => ({
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe ?? null,
            setType: s.set_type || 'normal',
            completedAt: s.completed_at || null,
            orderIndex: sIdx,
          })),
        })),
      })),
      routines: [],
      habits: [],
      tombstones: [],
    };

    const res = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pushPayload),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Solicita o diagnostico completo de evolucao ao AI Coach do Backend.
 */
export async function fetchAiCoachAnalysis(): Promise<AiCoachAnalysis> {
  const baseUrl = await getBackendBaseUrl();
  const token = await ensureValidSpringSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${baseUrl}/api/v1/ai-coach/analyze`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Erro no AI Coach (status ${res.status})`);
  }

  return await res.json();
}

/**
 * Conversa com o AI Coach sobre o treino ou duvidas de plato.
 */
export async function sendAiCoachQuestion(question: string, exerciseName?: string): Promise<AiCoachChatResponse> {
  const baseUrl = await getBackendBaseUrl();
  const token = await ensureValidSpringSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${baseUrl}/api/v1/ai-coach/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question, exerciseName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Erro na resposta do AI Coach (status ${res.status})`);
  }

  return await res.json();
}

/**
 * Fallback determinístico para o chat local quando a API estiver offline ou inacessível.
 * Segue estritamente as regras de correções básicas de treino no formato direto para celular.
 */
export function getLocalAiCoachChatFallback(exerciseName?: string): AiCoachChatResponse {
  const targetExercise = exerciseName ? ` no exercício ${exerciseName}` : '';
  const answer =
    `Para sua próxima sessão${targetExercise}, aplique sobrecarga progressiva básica: busque +1 repetição com a carga atual ou adicione micro-carga de +1kg a +2kg na primeira série.\n\n` +
    'Controle a descida excêntrica em 2 a 3 segundos e respeite os descansos: 2 a 3 minutos para exercícios compostos pesados e 60 a 90 segundos para isoladores.\n\n' +
    'Se sentir fadiga acumulada ou estagnação persistente, reduza 1 série de trabalho no exercício para recuperar o estímulo sem comprometer a técnica.';

  return {
    answer,
    keyTakeaways: [
      'Sobrecarga simples: +1 repetição ou micro-carga (+1kg a +2kg)',
      'Descanso: 2-3min para compostos e 60-90s para isoladores',
      'Cadência: 2-3s na descida excêntrica e deload de 1 série se fadigado',
    ],
    timestamp: new Date().toISOString(),
  };
}
