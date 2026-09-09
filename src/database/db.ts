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

    CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises (workout_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise_id ON sets (exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts (date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_habits_date ON daily_habits (date);
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
    // 1. Inserir o treino
    const workoutResult = await db.runAsync(
      `INSERT INTO workouts (title, date, notes) VALUES (?, ?, ?);`,
      [workoutData.title, workoutData.date, workoutData.notes ?? null]
    );
    createdWorkoutId = workoutResult.lastInsertRowId;

    // 2. Inserir os exercícios e séries associadas
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      for (const exerciseData of workoutData.exercises) {
        const exerciseResult = await db.runAsync(
          `INSERT INTO exercises (workout_id, name, muscle_group, rest_timer_seconds) VALUES (?, ?, ?, ?);`,
          [
            createdWorkoutId,
            exerciseData.name,
            exerciseData.muscle_group ?? null,
            exerciseData.rest_timer_seconds ?? null,
          ]
        );
        const exerciseId = exerciseResult.lastInsertRowId;

        // 3. Inserir as séries do exercício
        if (exerciseData.sets && exerciseData.sets.length > 0) {
          for (const setData of exerciseData.sets) {
            await db.runAsync(
              `INSERT INTO sets (exercise_id, weight, reps, rpe, set_type, completed_at) VALUES (?, ?, ?, ?, ?, ?);`,
              [
                exerciseId,
                setData.weight,
                setData.reps,
                setData.rpe ?? null,
                setData.set_type ?? null,
                setData.completed_at ?? new Date().toISOString(),
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
function toSqliteBoolean(val: number | boolean | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val ? 1 : 0;
}

/**
 * Busca os hábitos registrados para uma data específica (formato esperado: 'YYYY-MM-DD').
 */
export async function getDailyHabits(date: string): Promise<DailyHabits | null> {
  const db = await getDatabase();

  const habit = await db.getFirstAsync<DailyHabits>(
    `SELECT id, date, protein_done, water_done, workout_done, meals_done, streak_count 
     FROM daily_habits 
     WHERE date = ?;`,
    [date]
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

  const existing = await getDailyHabits(input.date);

  const protein = toSqliteBoolean(input.protein_done, existing ? existing.protein_done : 0);
  const water = toSqliteBoolean(input.water_done, existing ? existing.water_done : 0);
  const workout = toSqliteBoolean(input.workout_done, existing ? existing.workout_done : 0);
  const meals = toSqliteBoolean(input.meals_done, existing ? existing.meals_done : 0);
  const streak = input.streak_count !== undefined 
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
    [input.date, protein, water, workout, meals, streak]
  );

  const updated = await getDailyHabits(input.date);
  if (!updated) {
    throw new Error(`Erro ao recuperar o registro de hábitos do dia ${input.date}`);
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
