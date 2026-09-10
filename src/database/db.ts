import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Constantes de configuração do banco de dados
 */
export const DATABASE_NAME = 'focuslift.db';

let dbInstance: SQLiteDatabase | null = null;

/* ==========================================================================
   TIPOS E INTERFACES (TypeScript)
   ========================================================================== */

export interface Workout {
  id: number;
  title: string;
  date: string;
  notes?: string | null;
}

export interface Exercise {
  id: number;
  workout_id: number;
  name: string;
  muscle_group?: string | null;
  rest_timer_seconds?: number | null;
}

export interface WorkoutSet {
  id: number;
  exercise_id: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  set_type?: string | null;
  completed_at?: string | null;
}

export interface DailyHabits {
  id: number;
  date: string;
  protein_done: number; // 0 ou 1
  water_done: number;   // 0 ou 1
  workout_done: number; // 0 ou 1
  meals_done: number;   // 0 ou 1
  streak_count: number;
}

// Estruturas aninhadas / detalhadas
export interface ExerciseWithSets extends Exercise {
  sets: WorkoutSet[];
}

export interface WorkoutWithDetails extends Workout {
  exercises: ExerciseWithSets[];
}

// Tipos para inserção e atualização
export interface CreateSetInput {
  weight: number;
  reps: number;
  rpe?: number | null;
  set_type?: string | null;
  completed_at?: string | null;
}

export interface CreateExerciseInput {
  name: string;
  muscle_group?: string | null;
  rest_timer_seconds?: number | null;
  sets?: CreateSetInput[];
}

export interface CreateWorkoutInput {
  title: string;
  date: string;
  notes?: string | null;
  exercises?: CreateExerciseInput[];
}

export interface UpsertDailyHabitsInput {
  date: string;
  protein_done?: number | boolean;
  water_done?: number | boolean;
  workout_done?: number | boolean;
  meals_done?: number | boolean;
  streak_count?: number;
}

// Entidades de Fichas / Rotinas de Treino (Fase 2)
export interface Routine {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at?: string | null;
}

export interface RoutineExercise {
  id: number;
  routine_id: number;
  exercise_name: string;
  muscle_group?: string | null;
  target_sets: number;
  rest_timer_seconds: number;
  order_index: number;
}

export interface RoutineWithExercises extends Routine {
  exercises: RoutineExercise[];
}

export interface CreateRoutineExerciseInput {
  exercise_name: string;
  muscle_group?: string | null;
  target_sets?: number;
  rest_timer_seconds?: number;
  order_index?: number;
}

export interface CreateRoutineInput {
  name: string;
  description?: string | null;
  color?: string | null;
  exercises?: CreateRoutineExerciseInput[];
}

export interface UpdateRoutineInput {
  id: number;
  name?: string;
  description?: string | null;
  color?: string | null;
  exercises?: CreateRoutineExerciseInput[];
}

/* ==========================================================================
   INICIALIZAÇÃO DO BANCO DE DADOS
   ========================================================================== */

/**
 * Inicializa a conexão assíncrona com o banco 'focuslift.db', ativa chaves
 * estrangeiras e garante a criação de todas as tabelas e índices necessários.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await openDatabaseAsync(DATABASE_NAME);

  // Ativa a integridade referencial de chaves estrangeiras
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Criação das tabelas e índices
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      muscle_group TEXT,
      rest_timer_seconds INTEGER,
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      rpe REAL,
      set_type TEXT,
      completed_at TEXT,
      FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      protein_done INTEGER NOT NULL DEFAULT 0,
      water_done INTEGER NOT NULL DEFAULT 0,
      workout_done INTEGER NOT NULL DEFAULT 0,
      meals_done INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      muscle_group TEXT,
      target_sets INTEGER NOT NULL DEFAULT 3,
      rest_timer_seconds INTEGER NOT NULL DEFAULT 90,
      order_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises (workout_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise_id ON sets (exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts (date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_habits_date ON daily_habits (date);
    CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_id ON routine_exercises (routine_id);
    CREATE INDEX IF NOT EXISTS idx_routine_exercises_order ON routine_exercises (routine_id, order_index ASC);
  `);

  dbInstance = db;
  return dbInstance;
}

/**
 * Retorna a instância ativa do banco de dados (inicializa automaticamente caso necessário).
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbInstance) {
    return await initDatabase();
  }
  return dbInstance;
}

/**
 * Fecha a conexão com o banco de dados (útil para testes ou finalização).
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/* ==========================================================================
   FUNÇÕES DE TREINOS (WORKOUTS, EXERCISES, SETS)
   ========================================================================== */

/**
 * Cria um treino completo de forma atômica com exercícios e séries associados.
 */
export async function createWorkout(
  workoutData: CreateWorkoutInput
): Promise<WorkoutWithDetails> {
  const db = await getDatabase();

  let createdWorkoutId: number = 0;

  // Execução dentro de transação atômica
  await db.withTransactionAsync(async () => {
    // 1. Inserir o treino (garantindo valores estritamente definidos ou null)
    const title = (workoutData.title && workoutData.title.trim()) || 'Treino Concluído';
    const date = (workoutData.date && workoutData.date.trim()) || new Date().toISOString().split('T')[0];
    const notes = (workoutData.notes && workoutData.notes.trim().length > 0) ? workoutData.notes.trim() : null;

    const workoutResult = await db.runAsync(
      `INSERT INTO workouts (title, date, notes) VALUES (?, ?, ?);`,
      [title, date, notes]
    );
    createdWorkoutId = workoutResult.lastInsertRowId;

    // 2. Inserir os exercícios e séries associadas
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      for (const exerciseData of workoutData.exercises) {
        const exName = (exerciseData.name && exerciseData.name.trim()) || 'Exercício';
        const muscleGroup = (exerciseData.muscle_group && exerciseData.muscle_group.trim().length > 0)
          ? exerciseData.muscle_group.trim()
          : null;
        const restTimer = typeof exerciseData.rest_timer_seconds === 'number' && !isNaN(exerciseData.rest_timer_seconds)
          ? exerciseData.rest_timer_seconds
          : null;

        const exerciseResult = await db.runAsync(
          `INSERT INTO exercises (workout_id, name, muscle_group, rest_timer_seconds) VALUES (?, ?, ?, ?);`,
          [
            createdWorkoutId,
            exName,
            muscleGroup,
            restTimer,
          ]
        );
        const exerciseId = exerciseResult.lastInsertRowId;

        // 3. Inserir as séries do exercício
        if (exerciseData.sets && exerciseData.sets.length > 0) {
          for (const setData of exerciseData.sets) {
            const weight = typeof setData.weight === 'number' && !isNaN(setData.weight) ? setData.weight : 0;
            const reps = typeof setData.reps === 'number' && !isNaN(setData.reps) ? setData.reps : 0;
            const rpe = typeof setData.rpe === 'number' && !isNaN(setData.rpe) ? setData.rpe : null;
            const setType = setData.set_type ? String(setData.set_type) : 'normal';
            const completedAt = setData.completed_at ? String(setData.completed_at) : new Date().toISOString();

            await db.runAsync(
              `INSERT INTO sets (exercise_id, weight, reps, rpe, set_type, completed_at) VALUES (?, ?, ?, ?, ?, ?);`,
              [
                exerciseId,
                weight,
                reps,
                rpe,
                setType,
                completedAt,
              ]
            );
          }
        }
      }
    }
  });

  const fullWorkout = await getWorkoutById(createdWorkoutId);
  if (!fullWorkout) {
    throw new Error(`Erro ao recuperar o treino recém-criado com ID ${createdWorkoutId}`);
  }

  return fullWorkout;
}

/**
 * Busca um treino detalhado pelo ID com todos os seus exercícios e séries.
 */
export async function getWorkoutById(id: number): Promise<WorkoutWithDetails | null> {
  const db = await getDatabase();

  const workout = await db.getFirstAsync<Workout>(
    `SELECT id, title, date, notes FROM workouts WHERE id = ?;`,
    [id]
  );

  if (!workout) {
    return null;
  }

  const exercises = await db.getAllAsync<Exercise>(
    `SELECT id, workout_id, name, muscle_group, rest_timer_seconds 
     FROM exercises 
     WHERE workout_id = ? 
     ORDER BY id ASC;`,
    [id]
  );

  if (exercises.length === 0) {
    return {
      ...workout,
      exercises: [],
    };
  }

  const exerciseIds = exercises.map((e) => e.id);
  const placeholders = exerciseIds.map(() => '?').join(',');

  const allSets = await db.getAllAsync<WorkoutSet>(
    `SELECT id, exercise_id, weight, reps, rpe, set_type, completed_at 
     FROM sets 
     WHERE exercise_id IN (${placeholders}) 
     ORDER BY id ASC;`,
    exerciseIds
  );

  const setsByExerciseId = new Map<number, WorkoutSet[]>();
  for (const setItem of allSets) {
    const list = setsByExerciseId.get(setItem.exercise_id) ?? [];
    list.push(setItem);
    setsByExerciseId.set(setItem.exercise_id, list);
  }

  const exercisesWithSets: ExerciseWithSets[] = exercises.map((exercise) => ({
    ...exercise,
    sets: setsByExerciseId.get(exercise.id) ?? [],
  }));

  return {
    ...workout,
    exercises: exercisesWithSets,
  };
}

/**
 * Lista os treinos recentes ordenados por data decrescente, incluindo todo o histórico de cargas e séries.
 * @param limit Quantidade máxima de treinos a retornar (padrão: 10).
 */
export async function getRecentWorkouts(limit: number = 10): Promise<WorkoutWithDetails[]> {
  const db = await getDatabase();

  // 1. Buscar os treinos mais recentes
  const workouts = await db.getAllAsync<Workout>(
    `SELECT id, title, date, notes FROM workouts ORDER BY date DESC, id DESC LIMIT ?;`,
    [limit]
  );

  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((w) => w.id);
  const workoutPlaceholders = workoutIds.map(() => '?').join(',');

  // 2. Buscar todos os exercícios vinculados a esses treinos
  const exercises = await db.getAllAsync<Exercise>(
    `SELECT id, workout_id, name, muscle_group, rest_timer_seconds 
     FROM exercises 
     WHERE workout_id IN (${workoutPlaceholders}) 
     ORDER BY id ASC;`,
    workoutIds
  );

  // 3. Buscar todas as séries vinculadas a esses exercícios
  let allSets: WorkoutSet[] = [];
  if (exercises.length > 0) {
    const exerciseIds = exercises.map((e) => e.id);
    const exercisePlaceholders = exerciseIds.map(() => '?').join(',');

    allSets = await db.getAllAsync<WorkoutSet>(
      `SELECT id, exercise_id, weight, reps, rpe, set_type, completed_at 
       FROM sets 
       WHERE exercise_id IN (${exercisePlaceholders}) 
       ORDER BY id ASC;`,
      exerciseIds
    );
  }

  // Agrupar as séries por ID do exercício
  const setsByExerciseId = new Map<number, WorkoutSet[]>();
  for (const setItem of allSets) {
    const list = setsByExerciseId.get(setItem.exercise_id) ?? [];
    list.push(setItem);
    setsByExerciseId.set(setItem.exercise_id, list);
  }

  // Agrupar os exercícios por ID do treino
  const exercisesByWorkoutId = new Map<number, ExerciseWithSets[]>();
  for (const exercise of exercises) {
    const exerciseWithSets: ExerciseWithSets = {
      ...exercise,
      sets: setsByExerciseId.get(exercise.id) ?? [],
    };

    const list = exercisesByWorkoutId.get(exercise.workout_id) ?? [];
    list.push(exerciseWithSets);
    exercisesByWorkoutId.set(exercise.workout_id, list);
  }

  // Montar a lista completa de treinos
  return workouts.map((workout) => ({
    ...workout,
    exercises: exercisesByWorkoutId.get(workout.id) ?? [],
  }));
}

/**
 * Remove um treino e todos os seus exercícios e séries dependentes (via ON DELETE CASCADE).
 */
export async function deleteWorkout(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM workouts WHERE id = ?;`, [id]);
}

/* ==========================================================================
   FUNÇÕES DE HÁBITOS DO DIA (DAILY_HABITS)
   ========================================================================== */

/**
 * Converte valor booleano ou numérico para inteiro (0 ou 1) para armazenamento no SQLite.
 */
function toSqliteBoolean(val: number | boolean | undefined | null, fallback: number): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val ? 1 : 0;
}

/**
 * Busca os hábitos registrados para uma data específica (formato esperado: 'YYYY-MM-DD').
 */
export async function getDailyHabits(date: string): Promise<DailyHabits | null> {
  const db = await getDatabase();
  const dateClean = (date && date.trim()) || new Date().toISOString().split('T')[0];

  const habit = await db.getFirstAsync<DailyHabits>(
    `SELECT id, date, protein_done, water_done, workout_done, meals_done, streak_count 
     FROM daily_habits 
     WHERE date = ?;`,
    [dateClean]
  );

  return habit ?? null;
}

/**
 * Insere ou atualiza os hábitos do dia (UPSERT).
 * Preserva os campos não informados caso o registro da data já exista.
 */
export async function upsertDailyHabits(
  input: UpsertDailyHabitsInput
): Promise<DailyHabits> {
  const db = await getDatabase();
  const date = (input.date && input.date.trim()) || new Date().toISOString().split('T')[0];

  const existing = await getDailyHabits(date);

  const protein = toSqliteBoolean(input.protein_done, existing ? existing.protein_done : 0);
  const water = toSqliteBoolean(input.water_done, existing ? existing.water_done : 0);
  const workout = toSqliteBoolean(input.workout_done, existing ? existing.workout_done : 0);
  const meals = toSqliteBoolean(input.meals_done, existing ? existing.meals_done : 0);
  const streak = typeof input.streak_count === 'number' && !isNaN(input.streak_count)
    ? input.streak_count 
    : (existing ? existing.streak_count : 0);

  await db.runAsync(
    `INSERT INTO daily_habits (date, protein_done, water_done, workout_done, meals_done, streak_count)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       protein_done = excluded.protein_done,
       water_done = excluded.water_done,
       workout_done = excluded.workout_done,
       meals_done = excluded.meals_done,
       streak_count = excluded.streak_count;`,
    [date, protein, water, workout, meals, streak]
  );

  const updated = await getDailyHabits(date);
  if (!updated) {
    throw new Error(`Erro ao recuperar o registro de hábitos do dia ${date}`);
  }

  return updated;
}

/**
 * Busca os hábitos da data indicada ou inicializa um novo registro zerado se não existir.
 */
export async function getOrCreateDailyHabits(date: string): Promise<DailyHabits> {
  const existing = await getDailyHabits(date);
  if (existing) {
    return existing;
  }

  return await upsertDailyHabits({
    date,
    protein_done: 0,
    water_done: 0,
    workout_done: 0,
    meals_done: 0,
    streak_count: 0,
  });
}

/* ==========================================================================
   FUNÇÕES DE FICHAS / ROTINAS DE TREINO (ROUTINES & ROUTINE_EXERCISES)
   ========================================================================== */

/**
 * Cria uma nova ficha de treino de forma atômica com seus exercícios planejados.
 */
export async function createRoutine(
  input: CreateRoutineInput
): Promise<RoutineWithExercises> {
  const db = await getDatabase();
  let createdRoutineId = 0;
  const createdAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const name = (input.name && input.name.trim()) || 'Nova Ficha';
    const description = (input.description && input.description.trim().length > 0) ? input.description.trim() : null;
    const color = (input.color && input.color.trim().length > 0) ? input.color.trim() : null;

    const res = await db.runAsync(
      `INSERT INTO routines (name, description, color, created_at) VALUES (?, ?, ?, ?);`,
      [name, description, color, createdAt]
    );
    createdRoutineId = res.lastInsertRowId;

    if (input.exercises && input.exercises.length > 0) {
      for (let i = 0; i < input.exercises.length; i++) {
        const ex = input.exercises[i];
        const exName = (ex.exercise_name && ex.exercise_name.trim()) || 'Exercício';
        const muscleGroup = (ex.muscle_group && ex.muscle_group.trim().length > 0) ? ex.muscle_group.trim() : null;
        const targetSets = typeof ex.target_sets === 'number' && !isNaN(ex.target_sets) ? ex.target_sets : 3;
        const restTimer = typeof ex.rest_timer_seconds === 'number' && !isNaN(ex.rest_timer_seconds) ? ex.rest_timer_seconds : 90;
        const orderIdx = typeof ex.order_index === 'number' && !isNaN(ex.order_index) ? ex.order_index : i;

        await db.runAsync(
          `INSERT INTO routine_exercises (routine_id, exercise_name, muscle_group, target_sets, rest_timer_seconds, order_index)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            createdRoutineId,
            exName,
            muscleGroup,
            targetSets,
            restTimer,
            orderIdx,
          ]
        );
      }
    }
  });

  const fullRoutine = await getRoutineById(createdRoutineId);
  if (!fullRoutine) {
    throw new Error(`Erro ao recuperar a rotina recém-criada com ID ${createdRoutineId}`);
  }
  return fullRoutine;
}

/**
 * Busca uma ficha de treino específica pelo ID com todos os seus exercícios planejados.
 */
export async function getRoutineById(id: number): Promise<RoutineWithExercises | null> {
  const db = await getDatabase();

  const routine = await db.getFirstAsync<Routine>(
    `SELECT id, name, description, color, created_at FROM routines WHERE id = ?;`,
    [id]
  );

  if (!routine) {
    return null;
  }

  const exercises = await db.getAllAsync<RoutineExercise>(
    `SELECT id, routine_id, exercise_name, muscle_group, target_sets, rest_timer_seconds, order_index
     FROM routine_exercises
     WHERE routine_id = ?
     ORDER BY order_index ASC, id ASC;`,
    [id]
  );

  return {
    ...routine,
    exercises,
  };
}

/**
 * Lista todas as fichas cadastradas com seus respectivos exercícios ordenados.
 */
export async function getRoutines(): Promise<RoutineWithExercises[]> {
  const db = await getDatabase();

  const routines = await db.getAllAsync<Routine>(
    `SELECT id, name, description, color, created_at FROM routines ORDER BY id ASC;`
  );

  if (routines.length === 0) {
    return [];
  }

  const routineIds = routines.map((r) => r.id);
  const placeholders = routineIds.map(() => '?').join(',');

  const allExercises = await db.getAllAsync<RoutineExercise>(
    `SELECT id, routine_id, exercise_name, muscle_group, target_sets, rest_timer_seconds, order_index
     FROM routine_exercises
     WHERE routine_id IN (${placeholders})
     ORDER BY order_index ASC, id ASC;`,
    routineIds
  );

  const exercisesByRoutineId = new Map<number, RoutineExercise[]>();
  for (const ex of allExercises) {
    const list = exercisesByRoutineId.get(ex.routine_id) ?? [];
    list.push(ex);
    exercisesByRoutineId.set(ex.routine_id, list);
  }

  return routines.map((r) => ({
    ...r,
    exercises: exercisesByRoutineId.get(r.id) ?? [],
  }));
}

/**
 * Atualiza os dados de uma ficha existente e, se fornecidos, substitui a lista de exercícios.
 */
export async function updateRoutine(
  input: UpdateRoutineInput
): Promise<RoutineWithExercises> {
  const db = await getDatabase();

  const existing = await getRoutineById(input.id);
  if (!existing) {
    throw new Error(`Rotina com ID ${input.id} não encontrada.`);
  }

  await db.withTransactionAsync(async () => {
    // 1. Atualizar campos cadastrais da ficha
    const name = input.name && input.name.trim().length > 0 ? input.name.trim() : existing.name;
    const description = input.description !== undefined 
      ? (input.description && input.description.trim().length > 0 ? input.description.trim() : null) 
      : (existing.description ?? null);
    const color = input.color !== undefined 
      ? (input.color && input.color.trim().length > 0 ? input.color.trim() : null) 
      : (existing.color ?? null);

    await db.runAsync(
      `UPDATE routines SET
         name = ?,
         description = ?,
         color = ?
       WHERE id = ?;`,
      [
        name,
        description,
        color,
        input.id,
      ]
    );

    // 2. Se nova lista de exercícios foi fornecida, sincroniza
    if (input.exercises) {
      await db.runAsync(`DELETE FROM routine_exercises WHERE routine_id = ?;`, [input.id]);

      for (let i = 0; i < input.exercises.length; i++) {
        const ex = input.exercises[i];
        const exName = (ex.exercise_name && ex.exercise_name.trim()) || 'Exercício';
        const muscleGroup = (ex.muscle_group && ex.muscle_group.trim().length > 0) ? ex.muscle_group.trim() : null;
        const targetSets = typeof ex.target_sets === 'number' && !isNaN(ex.target_sets) ? ex.target_sets : 3;
        const restTimer = typeof ex.rest_timer_seconds === 'number' && !isNaN(ex.rest_timer_seconds) ? ex.rest_timer_seconds : 90;
        const orderIdx = typeof ex.order_index === 'number' && !isNaN(ex.order_index) ? ex.order_index : i;

        await db.runAsync(
          `INSERT INTO routine_exercises (routine_id, exercise_name, muscle_group, target_sets, rest_timer_seconds, order_index)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            input.id,
            exName,
            muscleGroup,
            targetSets,
            restTimer,
            orderIdx,
          ]
        );
      }
    }
  });

  const updated = await getRoutineById(input.id);
  if (!updated) {
    throw new Error(`Erro ao recuperar a rotina atualizada com ID ${input.id}`);
  }
  return updated;
}

/**
 * Exclui uma ficha de treino e todos os seus exercícios associados (via ON DELETE CASCADE).
 */
export async function deleteRoutine(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM routines WHERE id = ?;`, [id]);
}

/**
 * Cadastra fichas clássicas padrão (Push, Pull e Legs) caso ainda não haja nenhuma ficha no banco.
 * Ideal para inicialização imediata e testes do carrossel na HomeScreen.
 */
export async function seedDefaultRoutinesIfEmpty(): Promise<void> {
  const existing = await getRoutines();
  if (existing.length > 0) {
    return;
  }

  // Ficha A: Push (Peito, Ombros e Tríceps)
  await createRoutine({
    name: 'Push A - Peito, Ombro e Tríceps',
    description: 'Foco em peitoral, deltoide anterior/lateral e tríceps.',
    color: '#38BDF8', // Sky Blue
    exercises: [
      { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: 4, rest_timer_seconds: 120, order_index: 0 },
      { exercise_name: 'Supino Inclinado com Halteres', muscle_group: 'Peito', target_sets: 3, rest_timer_seconds: 90, order_index: 1 },
      { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 90, order_index: 2 },
      { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 4, rest_timer_seconds: 60, order_index: 3 },
      { exercise_name: 'Tríceps Corda na Polia', muscle_group: 'Tríceps', target_sets: 3, rest_timer_seconds: 60, order_index: 4 },
    ],
  });

  // Ficha B: Pull (Costas e Bíceps)
  await createRoutine({
    name: 'Pull B - Costas e Bíceps',
    description: 'Foco em dorsal, trapézio, deltoide posterior e bíceps.',
    color: '#10B981', // Emerald Green
    exercises: [
      { exercise_name: 'Puxada Alta Aberta', muscle_group: 'Costas', target_sets: 4, rest_timer_seconds: 90, order_index: 0 },
      { exercise_name: 'Remada Curvada com Barra', muscle_group: 'Costas', target_sets: 4, rest_timer_seconds: 90, order_index: 1 },
      { exercise_name: 'Crucifixo Invertido', muscle_group: 'Ombros / Posterior', target_sets: 3, rest_timer_seconds: 60, order_index: 2 },
      { exercise_name: 'Rosca Direta com Barra W', muscle_group: 'Bíceps', target_sets: 3, rest_timer_seconds: 60, order_index: 3 },
      { exercise_name: 'Rosca Martelo com Halteres', muscle_group: 'Bíceps', target_sets: 3, rest_timer_seconds: 60, order_index: 4 },
    ],
  });

  // Ficha C: Legs (Pernas Completo)
  await createRoutine({
    name: 'Legs C - Membros Inferiores',
    description: 'Treino completo de quadríceps, posteriores, glúteos e panturrilhas.',
    color: '#F59E0B', // Amber
    exercises: [
      { exercise_name: 'Agachamento Livre', muscle_group: 'Pernas', target_sets: 4, rest_timer_seconds: 120, order_index: 0 },
      { exercise_name: 'Leg Press 45°', muscle_group: 'Pernas', target_sets: 4, rest_timer_seconds: 90, order_index: 1 },
      { exercise_name: 'Cadeira Extensora', muscle_group: 'Pernas / Quadríceps', target_sets: 3, rest_timer_seconds: 60, order_index: 2 },
      { exercise_name: 'Mesa Flexora', muscle_group: 'Pernas / Posterior', target_sets: 3, rest_timer_seconds: 60, order_index: 3 },
      { exercise_name: 'Panturrilha em Pé', muscle_group: 'Panturrilhas', target_sets: 4, rest_timer_seconds: 60, order_index: 4 },
    ],
  });
}
