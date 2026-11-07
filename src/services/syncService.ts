/**
 * syncService.ts
 *
 * Sincronização em nuvem offline-first bidirecional com a API REST FocusLift Backend
 * (Java 21 + Spring Boot 3 + PostgreSQL).
 *
 * Substitui o Firebase Firestore por endpoints REST dedicados (/api/v1/sync/push e /pull),
 * respeitando transações SQLite e preservando a integridade local.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllWorkoutsWithDetails,
  getRoutines,
  getDailyHabitsSince,
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
} from './springApiService';

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

/**
 * Envia um único treino imediatamente para a nuvem após sua finalização.
 */
export async function syncWorkoutToCloud(
  userId: string,
  workout: WorkoutWithDetails
): Promise<void> {
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

  const res = await fetch(`${baseUrl}/api/v1/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Falha no sync de treino (${res.status})`);
  }
}

/**
 * Sincronização completa (push) de todos os dados locais para o backend Spring Boot.
 */
export async function syncLocalDataToCloud(userId: string): Promise<SyncResult> {
  const errors: string[] = [];
  try {
    const token = await ensureValidSpringSession();
    const baseUrl = await getBackendBaseUrl();

    const [workouts, routines, habits, tombstones] = await Promise.all([
      getAllWorkoutsWithDetails(),
      getRoutines(),
      getDailyHabitsSince(daysAgoLocalIso(90)),
      getTombstones(),
    ]);

    const payload = {
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
      routines: routines.map((r) => ({
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
      habits: habits.map((h) => ({
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

    const res = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `Erro HTTP ${res.status}`);
    }

    const pushRes = await res.json();
    await clearTombstones(tombstones);

    return {
      syncedWorkouts: pushRes.workoutsSaved ?? workouts.length,
      syncedHabits: pushRes.habitsSaved ?? habits.length,
      syncedRoutines: pushRes.routinesSaved ?? routines.length,
      syncedCustomHabits: 0,
      syncedBodyweight: 0,
      deletedCount: pushRes.tombstonesProcessed ?? tombstones.length,
      errors: [],
    };
  } catch (err: any) {
    errors.push(err?.message || 'Falha ao sincronizar com o backend.');
    return {
      syncedWorkouts: 0,
      syncedHabits: 0,
      syncedRoutines: 0,
      syncedCustomHabits: 0,
      errors,
    };
  }
}

/**
 * Restaura todos os dados da nuvem para o banco local SQLite (pull).
 */
export async function restoreCloudDataToLocal(userId: string): Promise<RestoreResult> {
  const token = await ensureValidSpringSession();
  const baseUrl = await getBackendBaseUrl();

  const res = await fetch(`${baseUrl}/api/v1/sync/pull`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Erro ao restaurar dados (${res.status})`);
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

  return {
    restoredWorkouts: snapshot.workouts.length,
    restoredRoutines: snapshot.routines.length,
    restoredHabits: snapshot.habits.length,
    restoredCustomHabits: 0,
    restoredBodyweight: 0,
  };
}
