import {
  collection,
  doc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { firestore } from './firebaseConfig';
import {
  getRecentWorkouts,
  getRoutines,
  getDailyHabits,
  getActiveCustomHabits,
  getCustomHabitLogsForDate,
  type WorkoutWithDetails,
  type RoutineWithExercises,
  type DailyHabits,
  type CustomHabit,
} from '../database/db';

/** Número máximo de operações por batch (limite do Firestore é 500). */
const BATCH_LIMIT = 400;

export interface SyncResult {
  syncedWorkouts: number;
  syncedHabits: number;
  syncedRoutines: number;
  syncedCustomHabits: number;
  errors: string[];
}

// ─── Helpers de Conversão ────────────────────────────────────────────────────

/**
 * Converte um WorkoutWithDetails em um documento Firestore plano.
 * O campo `userId` é obrigatório em todos os documentos — preparação para RLS.
 */
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

/**
 * Converte um registro de DailyHabits em um documento Firestore.
 * O campo `userId` é obrigatório — preparação para RLS.
 */
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

/**
 * Converte uma RoutineWithExercises em um documento Firestore.
 * O campo `userId` é obrigatório — preparação para RLS.
 */
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

/** Converte um CustomHabit em documento Firestore. */
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

// ─── Helper de Batch Particionado ────────────────────────────────────────────

/**
 * Executa uma lista de operações de escrita particionadas em lotes de BATCH_LIMIT.
 * Retorna o número de operações confirmadas e uma lista de erros.
 */
async function commitInBatches(
  operations: Array<{ docRef: ReturnType<typeof doc>; data: Record<string, unknown> }>
): Promise<{ committed: number; errors: string[] }> {
  let committed = 0;
  const errors: string[] = [];

  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    const batch: WriteBatch = writeBatch(firestore);

    for (const op of chunk) {
      batch.set(op.docRef, op.data);
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

// ─── Função Principal de Sincronização ───────────────────────────────────────

/**
 * Sincroniza todos os dados locais do SQLite para o Firestore.
 *
 * @security REGRA #3 — Guard de autenticação: lança erro imediatamente se userId ausente.
 * @security REGRA #1 — Todos os documentos escritos incluem o campo `userId` para RLS.
 * @security REGRA #2 — Nenhuma lógica de negócio de segurança baseada em estado local.
 *
 * @param userId UID do usuário autenticado no Firebase Auth (obrigatório).
 */
export async function syncLocalDataToCloud(userId: string): Promise<SyncResult> {
  // ── Guard de Autenticação (Regra #3) ──────────────────────────────────────
  if (!userId || userId.trim().length === 0) {
    throw new Error(
      '[syncService] syncLocalDataToCloud chamado sem userId. ' +
      'O usuário deve estar autenticado para sincronizar dados.'
    );
  }

  const errors: string[] = [];
  let syncedWorkouts = 0;
  let syncedHabits = 0;
  let syncedRoutines = 0;
  let syncedCustomHabits = 0;

  // ── 1. Sync de Treinos ────────────────────────────────────────────────────
  try {
    // Busca todos os treinos locais (sem limite para sync completo)
    const workouts = await getRecentWorkouts(9999);

    const workoutOps = workouts.map((workout) => ({
      docRef: doc(collection(firestore, 'users', userId, 'workouts'), String(workout.id)),
      data: workoutToFirestoreDoc(workout, userId) as Record<string, unknown>,
    }));

    const { committed, errors: batchErrors } = await commitInBatches(workoutOps);
    syncedWorkouts = committed;
    errors.push(...batchErrors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar treinos: ${msg}`);
  }

  // ── 2. Sync de Hábitos (últimos 90 dias) ──────────────────────────────────
  try {
    const habitOps: Array<{ docRef: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

    // Itera os últimos 90 dias e coleta hábitos registrados
    const today = new Date();
    for (let d = 0; d < 90; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];

      const habit = await getDailyHabits(dateStr);
      if (habit) {
        habitOps.push({
          docRef: doc(collection(firestore, 'users', userId, 'habits'), dateStr),
          data: habitToFirestoreDoc(habit, userId) as Record<string, unknown>,
        });
      }
    }

    const { committed, errors: batchErrors } = await commitInBatches(habitOps);
    syncedHabits = committed;
    errors.push(...batchErrors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar hábitos: ${msg}`);
  }

  // ── 3. Sync de Fichas/Rotinas ─────────────────────────────────────────────
  try {
    const routines = await getRoutines();

    const routineOps = routines.map((routine) => ({
      docRef: doc(collection(firestore, 'users', userId, 'routines'), String(routine.id)),
      data: routineToFirestoreDoc(routine, userId) as Record<string, unknown>,
    }));

    const { committed, errors: batchErrors } = await commitInBatches(routineOps);
    syncedRoutines = committed;
    errors.push(...batchErrors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar fichas: ${msg}`);
  }

  // ── 4. Sync de Hábitos Personalizados ─────────────────────────────────────
  try {
    const customHabits = await getActiveCustomHabits();

    // Sincroniza as definições dos hábitos
    const habitDefOps = customHabits.map((h) => ({
      docRef: doc(collection(firestore, 'users', userId, 'customHabits'), String(h.id)),
      data: customHabitToFirestoreDoc(h, userId) as Record<string, unknown>,
    }));

    // Sincroniza os logs dos últimos 90 dias
    const today = new Date();
    const logOps: Array<{ docRef: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
    for (let d = 0; d < 90; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const logsMap = await getCustomHabitLogsForDate(dateStr);
      for (const [habitId, done] of logsMap.entries()) {
        logOps.push({
          docRef: doc(
            collection(firestore, 'users', userId, 'customHabitLogs'),
            `${habitId}_${dateStr}`
          ),
          data: { userId, habitId, date: dateStr, done: done === 1, syncedAt: new Date().toISOString() },
        });
      }
    }

    const allOps = [...habitDefOps, ...logOps];
    const { committed, errors: batchErrors } = await commitInBatches(allOps);
    syncedCustomHabits = committed;
    errors.push(...batchErrors);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erro ao sincronizar hábitos personalizados: ${msg}`);
  }

  return { syncedWorkouts, syncedHabits, syncedRoutines, syncedCustomHabits, errors };
}
