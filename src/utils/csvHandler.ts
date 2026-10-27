import {
  type WorkoutWithDetails,
  type CreateWorkoutInput,
  type CreateExerciseInput,
  type CreateSetInput,
  createWorkout,
  getRecentWorkouts,
} from '../database/db';

/**
 * Cabeçalho padrão do arquivo CSV do FocusLift
 */
export const CSV_HEADER = [
  'workout_title',
  'workout_date',
  'workout_notes',
  'exercise_name',
  'muscle_group',
  'rest_timer_seconds',
  'weight',
  'reps',
  'rpe',
  'set_type',
  'completed_at',
].join(',');

/**
 * Escapa uma célula individual para conformidade com a RFC 4180 de CSV
 * e previne ataques de CSV Formula Injection (DDE / Excel / Google Sheets).
 */
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val);

  // Proteção contra CSV Formula Injection: se começar com =, +, -, @, \t ou \r
  // (e não for um número negativo legítimo como "-10" ou "-2.5"), prefixa com apóstrofo (')
  if (/^[=+\-@\t\r]/.test(str) && !/^-\d+(\.\d+)?$/.test(str)) {
    str = `'${str}`;
  }

  // Se contiver vírgula, aspas duplas ou quebras de linha, deve ser envolvido em aspas
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parser de texto CSV compatível com RFC 4180.
 * Suporta campos com quebras de linha, aspas duplas escapadas ("") e vírgulas internas.
 */
export function parseCsvRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvContent.length) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Aspas duplas escapadas dentro de campo entre aspas ("")
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Fim do campo entre aspas
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Adiciona a última célula e linha se houver conteúdo restante
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  // Remove linhas completamente vazias
  return rows.filter((r) => r.some((c) => c.length > 0));
}

/**
 * Converte uma lista hierárquica de treinos em uma string formatada em CSV.
 * 
 * @param workouts Lista de treinos com exercícios e séries
 * @returns String contendo o arquivo CSV completo
 */
export function exportWorkoutsToCSV(workouts: WorkoutWithDetails[]): string {
  const lines: string[] = [CSV_HEADER];

  for (const workout of workouts) {
    const workoutTitle = escapeCsvCell(workout.title);
    const workoutDate = escapeCsvCell(workout.date);
    const workoutNotes = escapeCsvCell(workout.notes);

    if (!workout.exercises || workout.exercises.length === 0) {
      // Treino sem exercícios registrados
      lines.push(`${workoutTitle},${workoutDate},${workoutNotes},,,,,,,,`);
      continue;
    }

    for (const exercise of workout.exercises) {
      const exerciseName = escapeCsvCell(exercise.name);
      const muscleGroup = escapeCsvCell(exercise.muscle_group);
      const restTimer = escapeCsvCell(exercise.rest_timer_seconds);

      if (!exercise.sets || exercise.sets.length === 0) {
        // Exercício sem séries registradas
        lines.push(
          `${workoutTitle},${workoutDate},${workoutNotes},${exerciseName},${muscleGroup},${restTimer},,,,,`
        );
        continue;
      }

      for (const setItem of exercise.sets) {
        const weight = escapeCsvCell(setItem.weight);
        const reps = escapeCsvCell(setItem.reps);
        const rpe = escapeCsvCell(setItem.rpe);
        const setType = escapeCsvCell(setItem.set_type);
        const completedAt = escapeCsvCell(setItem.completed_at);

        lines.push(
          [
            workoutTitle,
            workoutDate,
            workoutNotes,
            exerciseName,
            muscleGroup,
            restTimer,
            weight,
            reps,
            rpe,
            setType,
            completedAt,
          ].join(',')
        );
      }
    }
  }

  return lines.join('\n');
}

/**
 * Busca os treinos mais recentes do banco SQLite e os exporta para CSV.
 *
 * @param limit Quantidade máxima de treinos para exportar (padrão: 100)
 */
export async function exportRecentWorkoutsToCSV(limit: number = 100): Promise<string> {
  const workouts = await getRecentWorkouts(limit);
  return exportWorkoutsToCSV(workouts);
}

/**
 * Analisa o conteúdo de um arquivo CSV e reconstrói as estruturas tipadas `CreateWorkoutInput`.
 *
 * @param csvContent Conteúdo em formato CSV
 * @returns Lista de treinos prontos para inserção no banco de dados
 */
export function parseWorkoutsCSV(csvContent: string): CreateWorkoutInput[] {
  const parsedRows = parseCsvRows(csvContent);
  if (parsedRows.length < 2) {
    return [];
  }

  // Mapeia colunas através do cabeçalho
  const rawHeaders = parsedRows[0].map((h) => h.toLowerCase().trim());
  const colMap = new Map<string, number>();
  rawHeaders.forEach((name, idx) => colMap.set(name, idx));

  const getCol = (row: string[], colName: string): string => {
    const idx = colMap.get(colName);
    if (idx === undefined || idx >= row.length) {
      return '';
    }
    return row[idx];
  };

  const workoutsList: CreateWorkoutInput[] = [];
  let currentWorkout: CreateWorkoutInput | null = null;
  let currentExercise: CreateExerciseInput | null = null;

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];

    const title = getCol(row, 'workout_title');
    const date = getCol(row, 'workout_date');
    const notes = getCol(row, 'workout_notes') || null;

    const exerciseName = getCol(row, 'exercise_name');
    const muscleGroup = getCol(row, 'muscle_group') || null;
    const restTimerRaw = getCol(row, 'rest_timer_seconds');
    const restTimer = restTimerRaw ? parseInt(restTimerRaw, 10) : null;

    const weightRaw = getCol(row, 'weight');
    const repsRaw = getCol(row, 'reps');
    const rpeRaw = getCol(row, 'rpe');
    const setType = getCol(row, 'set_type') || 'normal';
    const completedAt = getCol(row, 'completed_at') || null;

    if (!title || !date) {
      continue;
    }

    // Verifica se a linha atual pertence a um novo treino
    const isNewWorkout =
      !currentWorkout ||
      currentWorkout.title !== title ||
      currentWorkout.date !== date ||
      currentWorkout.notes !== notes;

    if (isNewWorkout) {
      currentWorkout = {
        title,
        date,
        notes,
        exercises: [],
      };
      workoutsList.push(currentWorkout);
      currentExercise = null;
    }

    // Processamento do exercício
    if (exerciseName) {
      const isNewExercise =
        !currentExercise ||
        currentExercise.name !== exerciseName ||
        currentExercise.muscle_group !== muscleGroup;

      if (isNewExercise) {
        currentExercise = {
          name: exerciseName,
          muscle_group: muscleGroup,
          rest_timer_seconds: restTimer,
          sets: [],
        };
        currentWorkout!.exercises!.push(currentExercise);
      }

      // Processamento da série
      if (weightRaw !== '' && repsRaw !== '') {
        const weight = parseFloat(weightRaw);
        const reps = parseInt(repsRaw, 10);

        if (!isNaN(weight) && !isNaN(reps)) {
          const setInput: CreateSetInput = {
            weight,
            reps,
            rpe: rpeRaw ? parseFloat(rpeRaw) : null,
            set_type: setType,
            completed_at: completedAt,
          };
          currentExercise!.sets!.push(setInput);
        }
      }
    }
  }

  return workoutsList;
}

/**
 * Importa e insere no banco de dados SQLite todos os treinos descritos no arquivo CSV.
 *
 * @param csvContent Conteúdo do arquivo CSV
 * @returns Lista de treinos cadastrados com seus IDs gerados
 */
export async function importWorkoutsFromCSV(csvContent: string): Promise<WorkoutWithDetails[]> {
  const parsedWorkouts = parseWorkoutsCSV(csvContent);
  const importedWorkouts: WorkoutWithDetails[] = [];

  for (const workoutInput of parsedWorkouts) {
    const created = await createWorkout(workoutInput);
    importedWorkouts.push(created);
  }

  return importedWorkouts;
}
