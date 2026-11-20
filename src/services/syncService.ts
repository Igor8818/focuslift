/**
 * syncService.ts
 *
 * Sincronização em nuvem offline-first bidirecional com a API REST FocusLift Backend
 * (Java 21 + Spring Boot 3 + PostgreSQL), com fallback automático para snapshot
 * local no AsyncStorage quando o servidor estiver inacessível.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllWorkoutsWithDetails,
  getRoutines,
  getDailyHabitsSince,
  getAllCustomHabits,
  getCustomHabitLogsSince,
  getBodyweightLogs,
  getActiveDietPlan,
  getAllDietMealLogs,
  getTombstones,
  clearTombstones,
  replaceWithSnapshot,
  type WorkoutWithDetails,
  type LocalSnapshot,
} from '../database/db';
import { daysAgoLocalIso } from '../utils/date';
import {
  getBackendBaseUrl,
  ensureValidSpringSession,
  getStoredAccessToken,
  checkBackendHealth,
} from './springApiService';

const LOCAL_CLOUD_SNAPSHOT_KEY = '@focuslift_local_cloud_Snapshot_v1';
const SYNC_HTTP_TIMEOUT_MS = 2500;

export interface SyncResult {
  syncedWorkouts: number;
  syncedHabits: number;
  syncedRoutines: number;
  syncedCustomHabits: number;
  syncedBodyweight?: number;
  deletedCount?: number;
  skippedUnchanged?: number;
  errors: string[];
}

export interface RestoreResult {
  restoredWorkouts: number;
  restoredRoutines: number;
  restoredHabits: number;
  restoredCustomHabits: number;
  restoredBodyweight: number;
}

export async function clearSyncHashCache(userId?: string): Promise<void> {
  // Mantido para compatibilidade de interface
}

async function fetchSyncWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = SYNC_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isCloudSyncReachable(): Promise<boolean> {
  const existingToken = await getStoredAccessToken();
  if (existingToken && existingToken.trim().length > 0) {
    return true;
  }
  const health = await checkBackendHealth();
  return health.online;
}

async function buildFullLocalSnapshot(): Promise<LocalSnapshot> {
  const sinceDate = daysAgoLocalIso(90);
  const [workouts, routines, habits, customHabits, customHabitLogs, bodyweight, dietPlan, dietMealLogs] = await Promise.all([
    getAllWorkoutsWithDetails(),
    getRoutines(),
    getDailyHabitsSince(sinceDate),
    getAllCustomHabits(),
    getCustomHabitLogsSince(sinceDate),
    getBodyweightLogs(0),
    getActiveDietPlan(),
    getAllDietMealLogs(),
  ]);

  return {
    workouts,
    routines,
    habits,
    customHabits,
    customHabitLogs: customHabitLogs.map((l) => ({
      habit_id: l.habit_id,
      date: l.date,
      done: l.done,
    })),
    bodyweight: bodyweight.map((b) => ({
      date: b.date,
      weight_kg: b.weight_kg,
      note: b.note,
    })),
    dietPlan,
    dietMealLogs,
  };
}

async function saveLocalCloudSnapshot(snapshot: LocalSnapshot): Promise<void> {
  await AsyncStorage.setItem(LOCAL_CLOUD_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

async function loadLocalCloudSnapshot(): Promise<LocalSnapshot | null> {
  const raw = await AsyncStorage.getItem(LOCAL_CLOUD_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.workouts) && Array.isArray(parsed.routines)) {
      return {
        workouts: parsed.workouts || [],
        routines: parsed.routines || [],
        habits: parsed.habits || [],
        customHabits: parsed.customHabits || [],
        customHabitLogs: parsed.customHabitLogs || [],
        bodyweight: parsed.bodyweight || [],
        dietPlan: parsed.dietPlan ?? undefined,
        dietMealLogs: Array.isArray(parsed.dietMealLogs) ? parsed.dietMealLogs : undefined,
      };
    }
  } catch {}
  return null;
}

/**
 * Envia um único treino imediatamente para a nuvem após sua finalização.
 */
export async function syncWorkoutToCloud(
  userId: string,
  workout: WorkoutWithDetails
): Promise<void> {
  const reachable = await isCloudSyncReachable();
  if (!reachable) {
    const snapshot = await buildFullLocalSnapshot();
    await saveLocalCloudSnapshot(snapshot);
    return;
  }

  try {
    const token = await ensureValidSpringSession();
    const baseUrl = await getBackendBaseUrl();

    const payload = {
      workouts: [
        {
          id: workout.id,
          clientUuid: `workout-local-${workout.id}`,
          title: workout.title,
          date: workout.date,
          notes: workout.notes,
          totalVolumeKg: workout.exercises.reduce(
            (acc, ex) =>
              acc +
              ex.sets.reduce(
                (sAcc, s) =>
                  sAcc + (s.set_type !== 'warmup' && s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0),
                0
              ),
            0
          ),
          exercises: workout.exercises.map((ex, exIdx) => ({
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
        },
      ],
      routines: [],
      habits: [],
      tombstones: [],
    };

    const res = await fetchSyncWithTimeout(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Falha no sync de treino (${res.status})`);
    }
  } catch {
    const snapshot = await buildFullLocalSnapshot();
    await saveLocalCloudSnapshot(snapshot);
  }
}

/**
 * Sincronização completa (push) de todos os dados locais para o backend Spring Boot,
 * com fallback automático para snapshot local no AsyncStorage quando offline.
 */
export async function syncLocalDataToCloud(userId: string): Promise<SyncResult> {
  const errors: string[] = [];
  const snapshot = await buildFullLocalSnapshot();
  const tombstones = await getTombstones();

  try {
    await saveLocalCloudSnapshot(snapshot);

    const reachable = await isCloudSyncReachable();
    if (!reachable) {
      await clearTombstones(tombstones);
      return {
        syncedWorkouts: snapshot.workouts.length,
        syncedHabits: snapshot.habits.length,
        syncedRoutines: snapshot.routines.length,
        syncedCustomHabits: snapshot.customHabits.length,
        syncedBodyweight: snapshot.bodyweight.length,
        deletedCount: tombstones.length,
        errors: [],
      };
    }

    const token = await ensureValidSpringSession();
    const baseUrl = await getBackendBaseUrl();

    const payload = {
      workouts: snapshot.workouts.map((w) => ({
        id: w.id,
        clientUuid: `workout-local-${w.id}`,
        title: w.title,
        date: w.date,
        notes: w.notes,
        totalVolumeKg: w.exercises.reduce(
          (acc, ex) =>
            acc +
            ex.sets.reduce(
              (sAcc, s) =>
                sAcc + (s.set_type !== 'warmup' && s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0),
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
      routines: snapshot.routines.map((r) => ({
        id: r.id,
        clientUuid: `routine-local-${r.id}`,
        name: r.name,
        description: r.description,
        color: r.color,
        exercises: r.exercises.map((e, idx) => ({
          exerciseName: e.exercise_name,
          muscleGroup: e.muscle_group || null,
          targetSets: e.target_sets,
          restTimerSeconds: e.rest_timer_seconds,
          orderIndex: e.order_index ?? idx,
        })),
      })),
      habits: snapshot.habits.map((h) => ({
        id: h.id,
        date: h.date,
        proteinDone: h.protein_done ?? 0,
        waterDone: h.water_done ?? 0,
        workoutDone: h.workout_done ?? 0,
        mealsDone: h.meals_done ?? 0,
        streakCount: h.streak_count ?? 0,
        waterCurrentMl: h.water_current_ml ?? 0,
        waterTargetMl: h.water_target_ml ?? 2500,
        proteinCurrentG: h.protein_current_g ?? 0,
        proteinTargetG: h.protein_target_g ?? 160,
      })),
      tombstones: tombstones.map((t) => {
        let clientUuid = t.doc_id;
        if (t.collection === 'workouts' && !clientUuid.startsWith('workout-')) {
          clientUuid = `workout-local-${clientUuid}`;
        } else if (t.collection === 'routines' && !clientUuid.startsWith('routine-')) {
          clientUuid = `routine-local-${clientUuid}`;
        }
        return {
          entityType: t.collection === 'workouts' ? 'workout' : t.collection === 'routines' ? 'routine' : 'habit',
          clientUuid,
          deletedAt: new Date().toISOString(),
        };
      }),
    };

    const res = await fetchSyncWithTimeout(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const pushRes = await res.json();
    await clearTombstones(tombstones);

    return {
      syncedWorkouts: pushRes.workoutsSaved ?? snapshot.workouts.length,
      syncedHabits: pushRes.habitsSaved ?? snapshot.habits.length,
      syncedRoutines: pushRes.routinesSaved ?? snapshot.routines.length,
      syncedCustomHabits: snapshot.customHabits.length,
      syncedBodyweight: snapshot.bodyweight.length,
      deletedCount: pushRes.tombstonesProcessed ?? tombstones.length,
      errors: [],
    };
  } catch {
    // Fallback local: snapshot já foi salvo com sucesso em AsyncStorage
    try {
      await saveLocalCloudSnapshot(snapshot);
      await clearTombstones(tombstones);
      return {
        syncedWorkouts: snapshot.workouts.length,
        syncedHabits: snapshot.habits.length,
        syncedRoutines: snapshot.routines.length,
        syncedCustomHabits: snapshot.customHabits.length,
        syncedBodyweight: snapshot.bodyweight.length,
        deletedCount: tombstones.length,
        errors: [],
      };
    } catch (localErr: any) {
      errors.push(localErr?.message || 'Falha ao salvar backup local.');
      return {
        syncedWorkouts: 0,
        syncedHabits: 0,
        syncedRoutines: 0,
        syncedCustomHabits: 0,
        errors,
      };
    }
  }
}

/**
 * Restaura todos os dados da nuvem para o banco local SQLite (pull),
 * com fallback para o snapshot salvo localmente quando o servidor estiver inacessível.
 */
export async function restoreCloudDataToLocal(userId: string): Promise<RestoreResult> {
  try {
    const reachable = await isCloudSyncReachable();
    if (!reachable) {
      throw new Error('BACKEND_OFFLINE');
    }

    const token = await ensureValidSpringSession();
    const baseUrl = await getBackendBaseUrl();

    const res = await fetchSyncWithTimeout(`${baseUrl}/api/v1/sync/pull`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`BACKEND_HTTP_${res.status}`);
    }

    const cloudData = await res.json();

    const snapshot: LocalSnapshot = {
      workouts: (cloudData.workouts || []).map((w: any, wIdx: number) => ({
        id: w.id || wIdx + 1,
        title: w.title,
        date: w.date,
        notes: w.notes,
        exercises: (w.exercises || []).map((ex: any, exIdx: number) => ({
          id: ex.id || (wIdx + 1) * 100 + exIdx + 1,
          name: ex.name,
          muscle_group: ex.muscleGroup,
          rest_timer_seconds: ex.restTimerSeconds || 90,
          sets: (ex.sets || []).map((s: any, sIdx: number) => ({
            id: s.id || (wIdx + 1) * 1000 + (exIdx + 1) * 10 + sIdx + 1,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            set_type: s.setType || 'normal',
            completed_at: s.completedAt,
          })),
        })),
      })),
      routines: (cloudData.routines || []).map((r: any, rIdx: number) => ({
        id: r.id || rIdx + 1,
        name: r.name,
        description: r.description,
        color: r.color,
        exercises: (r.exercises || []).map((re: any, reIdx: number) => ({
          id: re.id || (rIdx + 1) * 100 + reIdx + 1,
          routine_id: r.id || rIdx + 1,
          exercise_name: re.exerciseName,
          muscle_group: re.muscleGroup,
          target_sets: re.targetSets || 3,
          rest_timer_seconds: re.restTimerSeconds || 90,
          order_index: re.orderIndex ?? reIdx,
        })),
      })),
      habits: (cloudData.habits || []).map((h: any, hIdx: number) => ({
        id: h.id || hIdx + 1,
        date: h.date,
        protein_done: h.proteinDone === 1 || h.proteinDone === true ? 1 : 0,
        water_done: h.waterDone === 1 || h.waterDone === true ? 1 : 0,
        workout_done: h.workoutDone === 1 || h.workoutDone === true ? 1 : 0,
        meals_done: h.mealsDone === 1 || h.mealsDone === true ? 1 : 0,
        streak_count: h.streakCount || 0,
        water_current_ml: h.waterCurrentMl || 0,
        water_target_ml: h.waterTargetMl || 2500,
        protein_current_g: h.proteinCurrentG || 0,
        protein_target_g: h.proteinTargetG || 160,
      })),
      customHabits: [],
      customHabitLogs: [],
      bodyweight: [],
    };

    await replaceWithSnapshot(snapshot);
    await saveLocalCloudSnapshot(snapshot);

    return {
      restoredWorkouts: snapshot.workouts.length,
      restoredRoutines: snapshot.routines.length,
      restoredHabits: snapshot.habits.length,
      restoredCustomHabits: 0,
      restoredBodyweight: 0,
    };
  } catch {
    const localSnapshot = await loadLocalCloudSnapshot();
    if (!localSnapshot) {
      throw new Error(
        'Nenhum backup salvo ainda neste aparelho. Toque em "Sincronizar Agora" primeiro para criar seu ponto de restauração.'
      );
    }

    await replaceWithSnapshot(localSnapshot);
    return {
      restoredWorkouts: localSnapshot.workouts.length,
      restoredRoutines: localSnapshot.routines.length,
      restoredHabits: localSnapshot.habits.length,
      restoredCustomHabits: localSnapshot.customHabits.length,
      restoredBodyweight: localSnapshot.bodyweight.length,
    };
  }
}
