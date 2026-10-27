import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './firebaseConfig';
import {
  getAllWorkoutsWithDetails,
  getRoutines,
  getDailyHabits,
  getDailyHabitsSince,
  getAllCustomHabits,
  getCustomHabitLogsSince,
  getBodyweightLogs,
  getTombstones,
  clearTombstones,
  replaceWithSnapshot,
  type WorkoutWithDetails,
  type RoutineWithExercises,
  type DailyHabits,
  type CustomHabit,
  type BodyweightLog,
  type LocalSnapshot,
  type SyncTombstone,
} from '../database/db';
import { daysAgoLocalIso } from '../utils/date';
import { filterChangedOperations, hashDoc, type HashMap, type SyncOperation } from '../utils/syncDiff';

/** Número máximo de operações por batch (limite do Firestore é 500). */
const BATCH_LIMIT = 400;

const SYNC_HASH_STORAGE_PREFIX = '@focuslift_sync_hashes_';

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

// ─── Helpers de Conversão ────────────────────────────────────────────────────

function workoutToFirestoreDoc(workout: WorkoutWithDetails, userId: string) {
  return {
    userId,
    localId: workout.id,
    title: workout.title,
    date: workout.date,
    notes: workout.notes ?? null,
    exercises: workout.exercises.map((ex) => ({
      localId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscle_group ?? null,
      restTimerSeconds: ex.rest_timer_seconds ?? 90,
      sets: ex.sets.map((s) => ({
        localId: s.id,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe ?? null,
        setType: s.set_type ?? 'normal',
        completedAt: s.completed_at ?? null,
      })),
    })),
    syncedAt: new Date().toISOString(),
  };
}

function habitToFirestoreDoc(habit: DailyHabits, userId: string) {
  return {
    userId,
    localId: habit.id,
    date: habit.date,
    proteinDone: habit.protein_done === 1,
    waterDone: habit.water_done === 1,
    workoutDone: habit.workout_done === 1,
    mealsDone: habit.meals_done === 1,
    streakCount: habit.streak_count,
    waterCurrentMl: habit.water_current_ml,
    waterTargetMl: habit.water_target_ml,
    proteinCurrentG: habit.protein_current_g,
    proteinTargetG: habit.protein_target_g,
    syncedAt: new Date().toISOString(),
  };
}

function routineToFirestoreDoc(routine: RoutineWithExercises, userId: string) {
  return {
    userId,
    localId: routine.id,
    name: routine.name,
    description: routine.description ?? null,
    color: routine.color ?? null,
    createdAt: routine.created_at ?? null,
    exercises: routine.exercises.map((ex) => ({
      localId: ex.id,
      exerciseName: ex.exercise_name,
      muscleGroup: ex.muscle_group ?? null,
      targetSets: ex.target_sets,
      restTimerSeconds: ex.rest_timer_seconds,
      orderIndex: ex.order_index,
    })),
    syncedAt: new Date().toISOString(),
  };
}

function customHabitToFirestoreDoc(habit: CustomHabit, userId: string) {
  return {
    userId,
    localId: habit.id,
    emoji: habit.emoji,
    name: habit.name,
    active: habit.active === 1,
    createdAt: habit.created_at,
    syncedAt: new Date().toISOString(),
  };
}

function bodyweightToFirestoreDoc(bw: BodyweightLog, userId: string) {
  return {
    userId,
    localId: bw.id,
    date: bw.date,
    weightKg: bw.weight_kg,
    syncedAt: new Date().toISOString(),
  };
}

// ─── Persistência de Hashes para Sync Incremental ────────────────────────────

async function loadSyncHashes(userId: string): Promise<HashMap> {
  try {
    const raw = await AsyncStorage.getItem(`${SYNC_HASH_STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    return JSON.parse(raw) as HashMap;
  } catch {
    return {};
  }
}

async function saveSyncHashes(userId: string, hashes: HashMap): Promise<void> {
  try {
    await AsyncStorage.setItem(`${SYNC_HASH_STORAGE_PREFIX}${userId}`, JSON.stringify(hashes));
  } catch {
    // ignore storage errors
  }
}

export async function clearSyncHashCache(userId?: string): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.removeItem(`${SYNC_HASH_STORAGE_PREFIX}${userId}`);
    }
  } catch {}
}

// ─── Helper de Batch Particionado ────────────────────────────────────────────

interface FirestoreBatchOp extends SyncOperation {
  docRef: ReturnType<typeof doc>;
  kind?: 'set' | 'delete';
}

async function commitInBatches(
  operations: FirestoreBatchOp[]
): Promise<{ committed: number; errors: string[] }> {
  let committed = 0;
  const errors: string[] = [];

  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    const batch: WriteBatch = writeBatch(firestore);

    for (const op of chunk) {
      if (op.kind === 'delete') {
        batch.delete(op.docRef);
      } else {
        batch.set(op.docRef, op.data);
      }
    }

    try {
      await batch.commit();
      committed += chunk.length;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Batch ${Math.floor(i / BATCH_LIMIT) + 1} falhou: ${msg}`);
    }
  }

  return { committed, errors };
}

// ─── Sync Incremental (um único treino) ──────────────────────────────────────

/**
 * Envia apenas um treino recém-finalizado (e o hábito do dia correspondente) para a nuvem.
 * Muito mais barato que o sync completo — usado pelo auto-sync pós-treino (PRO).
 */
export async function syncWorkoutToCloud(
  userId: string,
  workout: WorkoutWithDetails
): Promise<void> {
  if (!userId || userId.trim().length === 0) {
    throw new Error('[syncService] syncWorkoutToCloud chamado sem userId.');
  }

  const workoutPath = `users/${userId}/workouts/${workout.id}`;
  const ops: FirestoreBatchOp[] = [
    {
      path: workoutPath,
      docRef: doc(collection(firestore, 'users', userId, 'workouts'), String(workout.id)),
      data: workoutToFirestoreDoc(workout, userId) as Record<string, unknown>,
    },
  ];

  const habit = await getDailyHabits(workout.date);
  if (habit) {
    const habitPath = `users/${userId}/habits/${workout.date}`;
    ops.push({
      path: habitPath,
      docRef: doc(collection(firestore, 'users', userId, 'habits'), workout.date),
      data: habitToFirestoreDoc(habit, userId) as Record<string, unknown>,
    });
  }

  const { errors } = await commitInBatches(ops);
  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }

  const hashes = await loadSyncHashes(userId);
  for (const op of ops) {
    hashes[op.path] = hashDoc(op.data);
  }
  await saveSyncHashes(userId, hashes);
}

// ─── Função Principal de Sincronização (Local → Nuvem) ───────────────────────

/**
 * Sincroniza os dados locais do SQLite para o Firestore com diff inteligente (FNV-1a hash),
 * propagação de exclusões (tombstones) e consultas SQL em lote (sem N+1).
 */
export async function syncLocalDataToCloud(
  userId: string,
  options?: { force?: boolean }
): Promise<SyncResult> {
  if (!userId || userId.trim().length === 0) {
    throw new Error(
      '[syncService] syncLocalDataToCloud chamado sem userId. ' +
      'O usuário deve estar autenticado para sincronizar dados.'
    );
  }

  const force = options?.force ?? false;
  const previousHashes = await loadSyncHashes(userId);
  const nextHashes: HashMap = { ...previousHashes };

  const errors: string[] = [];
  let syncedWorkouts = 0;
  let syncedHabits = 0;
  let syncedRoutines = 0;
  let syncedCustomHabits = 0;
  let syncedBodyweight = 0;
  let deletedCount = 0;
  let skippedUnchanged = 0;

  // ── 0. Propagar Exclusões (Tombstones) ────────────────────────────────────
  try {
    const tombstones = await getTombstones();
    if (tombstones.length > 0) {
      const deleteOps: FirestoreBatchOp[] = tombstones.map((t: SyncTombstone) => {
        const path = `users/${userId}/${t.collection}/${t.doc_id}`;
        delete nextHashes[path];
        return {
          path,
          docRef: doc(collection(firestore, 'users', userId, t.collection), t.doc_id),
          data: {},
          kind: 'delete',
        };
      });

      const { committed, errors: delErrors } = await commitInBatches(deleteOps);
      deletedCount = committed;
      errors.push(...delErrors);
      if (delErrors.length === 0) {
        await clearTombstones(tombstones);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao propagar exclusões: ${msg}`);
  }

  // ── 1. Sync de Treinos (consulta otimizada com JOIN/IN sem N+1) ───────────
  try {
    const workouts = await getAllWorkoutsWithDetails();
    const allWorkoutOps: FirestoreBatchOp[] = workouts.map((workout) => {
      const path = `users/${userId}/workouts/${workout.id}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'workouts'), String(workout.id)),
        data: workoutToFirestoreDoc(workout, userId) as Record<string, unknown>,
      };
    });

    const changedOps = filterChangedOperations(allWorkoutOps, previousHashes, force);
    skippedUnchanged += allWorkoutOps.length - changedOps.length;

    const { committed, errors: batchErrors } = await commitInBatches(changedOps);
    syncedWorkouts = workouts.length; // Total garantido na nuvem
    errors.push(...batchErrors);

    if (batchErrors.length === 0 && committed === changedOps.length) {
      for (const op of changedOps) {
        nextHashes[op.path] = hashDoc(op.data);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar treinos: ${msg}`);
  }

  // ── 2. Sync de Hábitos (últimos 90 dias em 1 única query SQL) ─────────────
  try {
    const sinceDate = daysAgoLocalIso(90);
    const habits = await getDailyHabitsSince(sinceDate);
    const allHabitOps: FirestoreBatchOp[] = habits.map((habit) => {
      const path = `users/${userId}/habits/${habit.date}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'habits'), habit.date),
        data: habitToFirestoreDoc(habit, userId) as Record<string, unknown>,
      };
    });

    const changedOps = filterChangedOperations(allHabitOps, previousHashes, force);
    skippedUnchanged += allHabitOps.length - changedOps.length;

    const { committed, errors: batchErrors } = await commitInBatches(changedOps);
    syncedHabits = habits.length;
    errors.push(...batchErrors);

    if (batchErrors.length === 0 && committed === changedOps.length) {
      for (const op of changedOps) {
        nextHashes[op.path] = hashDoc(op.data);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar hábitos: ${msg}`);
  }

  // ── 3. Sync de Fichas/Rotinas ─────────────────────────────────────────────
  try {
    const routines = await getRoutines();
    const allRoutineOps: FirestoreBatchOp[] = routines.map((routine) => {
      const path = `users/${userId}/routines/${routine.id}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'routines'), String(routine.id)),
        data: routineToFirestoreDoc(routine, userId) as Record<string, unknown>,
      };
    });

    const changedOps = filterChangedOperations(allRoutineOps, previousHashes, force);
    skippedUnchanged += allRoutineOps.length - changedOps.length;

    const { committed, errors: batchErrors } = await commitInBatches(changedOps);
    syncedRoutines = routines.length;
    errors.push(...batchErrors);

    if (batchErrors.length === 0 && committed === changedOps.length) {
      for (const op of changedOps) {
        nextHashes[op.path] = hashDoc(op.data);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar fichas: ${msg}`);
  }

  // ── 4. Sync de Hábitos Personalizados + Logs (em 1 única query SQL) ───────
  try {
    const sinceDate = daysAgoLocalIso(90);
    const [customHabits, customLogs] = await Promise.all([
      getAllCustomHabits(),
      getCustomHabitLogsSince(sinceDate),
    ]);

    const habitDefOps: FirestoreBatchOp[] = customHabits.map((h) => {
      const path = `users/${userId}/customHabits/${h.id}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'customHabits'), String(h.id)),
        data: customHabitToFirestoreDoc(h, userId) as Record<string, unknown>,
      };
    });

    const logOps: FirestoreBatchOp[] = customLogs.map((log) => {
      const docId = `${log.habit_id}_${log.date}`;
      const path = `users/${userId}/customHabitLogs/${docId}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'customHabitLogs'), docId),
        data: {
          userId,
          habitId: log.habit_id,
          date: log.date,
          done: log.done === 1,
          syncedAt: new Date().toISOString(),
        },
      };
    });

    const allCustomOps = [...habitDefOps, ...logOps];
    const changedOps = filterChangedOperations(allCustomOps, previousHashes, force);
    skippedUnchanged += allCustomOps.length - changedOps.length;

    const { committed, errors: batchErrors } = await commitInBatches(changedOps);
    syncedCustomHabits = allCustomOps.length;
    errors.push(...batchErrors);

    if (batchErrors.length === 0 && committed === changedOps.length) {
      for (const op of changedOps) {
        nextHashes[op.path] = hashDoc(op.data);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar hábitos personalizados: ${msg}`);
  }

  // ── 5. Sync de Peso Corporal (bodyweight_log) ─────────────────────────────
  try {
    const bwLogs = await getBodyweightLogs(0);
    const allBwOps: FirestoreBatchOp[] = bwLogs.map((bw) => {
      const path = `users/${userId}/bodyweight/${bw.date}`;
      return {
        path,
        docRef: doc(collection(firestore, 'users', userId, 'bodyweight'), bw.date),
        data: bodyweightToFirestoreDoc(bw, userId) as Record<string, unknown>,
      };
    });

    const changedOps = filterChangedOperations(allBwOps, previousHashes, force);
    skippedUnchanged += allBwOps.length - changedOps.length;

    const { committed, errors: batchErrors } = await commitInBatches(changedOps);
    syncedBodyweight = bwLogs.length;
    errors.push(...batchErrors);

    if (batchErrors.length === 0 && committed === changedOps.length) {
      for (const op of changedOps) {
        nextHashes[op.path] = hashDoc(op.data);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar peso corporal: ${msg}`);
  }

  await saveSyncHashes(userId, nextHashes);

  return {
    syncedWorkouts,
    syncedHabits,
    syncedRoutines,
    syncedCustomHabits,
    syncedBodyweight,
    deletedCount,
    skippedUnchanged,
    errors,
  };
}

// ─── Restauração Bidirecional (Nuvem → SQLite Local) ─────────────────────────

/**
 * Baixa todos os dados do usuário no Firestore e reconstrói o banco SQLite local.
 * Essencial quando o usuário troca de celular, reinstala o app ou faz login em novo aparelho.
 */
export async function restoreCloudDataToLocal(userId: string): Promise<RestoreResult> {
  if (!userId || userId.trim().length === 0) {
    throw new Error('[syncService] restoreCloudDataToLocal chamado sem userId.');
  }

  const [workoutsSnap, routinesSnap, habitsSnap, customHabitsSnap, customLogsSnap, bwSnap] =
    await Promise.all([
      getDocs(collection(firestore, 'users', userId, 'workouts')),
      getDocs(collection(firestore, 'users', userId, 'routines')),
      getDocs(collection(firestore, 'users', userId, 'habits')),
      getDocs(collection(firestore, 'users', userId, 'customHabits')),
      getDocs(collection(firestore, 'users', userId, 'customHabitLogs')),
      getDocs(collection(firestore, 'users', userId, 'bodyweight')),
    ]);

  const workouts: WorkoutWithDetails[] = workoutsSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    const wId = typeof raw.localId === 'number' ? raw.localId : Number(d.id) || idx + 1;
    const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];
    return {
      id: wId,
      title: String(raw.title ?? 'Treino'),
      date: String(raw.date ?? daysAgoLocalIso(0)),
      notes: raw.notes ?? null,
      exercises: rawExercises.map((ex: any, exIdx: number) => ({
        id: typeof ex.localId === 'number' ? ex.localId : wId * 100 + exIdx + 1,
        workout_id: wId,
        name: String(ex.name ?? 'Exercício'),
        muscle_group: ex.muscleGroup ?? null,
        rest_timer_seconds: typeof ex.restTimerSeconds === 'number' ? ex.restTimerSeconds : 90,
        sets: (Array.isArray(ex.sets) ? ex.sets : []).map((s: any, sIdx: number) => ({
          id: typeof s.localId === 'number' ? s.localId : wId * 10000 + exIdx * 100 + sIdx + 1,
          exercise_id: typeof ex.localId === 'number' ? ex.localId : wId * 100 + exIdx + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          rpe: s.rpe !== null && s.rpe !== undefined ? Number(s.rpe) : null,
          set_type: String(s.setType ?? 'normal'),
          completed_at: s.completedAt ?? null,
        })),
      })),
    };
  });

  const routines: RoutineWithExercises[] = routinesSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    const rId = typeof raw.localId === 'number' ? raw.localId : Number(d.id) || idx + 1;
    const rawExercises = Array.isArray(raw.exercises) ? raw.exercises : [];
    return {
      id: rId,
      name: String(raw.name ?? 'Ficha'),
      description: raw.description ?? null,
      color: raw.color ?? null,
      created_at: raw.createdAt ?? new Date().toISOString(),
      exercises: rawExercises.map((ex: any, exIdx: number) => ({
        id: typeof ex.localId === 'number' ? ex.localId : rId * 100 + exIdx + 1,
        routine_id: rId,
        exercise_name: String(ex.exerciseName ?? 'Exercício'),
        muscle_group: ex.muscleGroup ?? null,
        target_sets: Number(ex.targetSets) || 3,
        rest_timer_seconds: Number(ex.restTimerSeconds) || 90,
        order_index: typeof ex.orderIndex === 'number' ? ex.orderIndex : exIdx,
      })),
    };
  });

  const dailyHabits: DailyHabits[] = habitsSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    return {
      id: typeof raw.localId === 'number' ? raw.localId : idx + 1,
      date: String(raw.date ?? d.id),
      protein_done: raw.proteinDone ? 1 : 0,
      water_done: raw.waterDone ? 1 : 0,
      workout_done: raw.workoutDone ? 1 : 0,
      meals_done: raw.mealsDone ? 1 : 0,
      streak_count: Number(raw.streakCount) || 0,
      water_current_ml: Number(raw.waterCurrentMl) || 0,
      water_target_ml: Number(raw.waterTargetMl) || 3000,
      protein_current_g: Number(raw.proteinCurrentG) || 0,
      protein_target_g: Number(raw.proteinTargetG) || 160,
    };
  });

  const customHabits: CustomHabit[] = customHabitsSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    return {
      id: typeof raw.localId === 'number' ? raw.localId : Number(d.id) || idx + 1,
      emoji: String(raw.emoji ?? '✨'),
      name: String(raw.name ?? 'Hábito'),
      active: raw.active === false ? 0 : 1,
      created_at: String(raw.createdAt ?? new Date().toISOString()),
    };
  });

  const customHabitLogs = customLogsSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    return {
      id: idx + 1,
      habit_id: Number(raw.habitId) || 0,
      date: String(raw.date ?? ''),
      done: raw.done ? 1 : 0,
    };
  });

  const bodyweightLogs: BodyweightLog[] = bwSnap.docs.map((d, idx) => {
    const raw = d.data() as Record<string, any>;
    return {
      id: typeof raw.localId === 'number' ? raw.localId : idx + 1,
      date: String(raw.date ?? d.id),
      weight_kg: Number(raw.weightKg) || 0,
    };
  });

  const snapshot: LocalSnapshot = {
    workouts,
    routines,
    habits: dailyHabits,
    customHabits,
    customHabitLogs,
    bodyweight: bodyweightLogs,
  };

  await replaceWithSnapshot(snapshot);
  const remainingTombstones = await getTombstones();
  if (remainingTombstones.length > 0) {
    await clearTombstones(remainingTombstones);
  }

  return {
    restoredWorkouts: workouts.length,
    restoredRoutines: routines.length,
    restoredHabits: dailyHabits.length,
    restoredCustomHabits: customHabits.length,
    restoredBodyweight: bodyweightLogs.length,
  };
}
