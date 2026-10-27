import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do expo-sqlite
const mockRunAsync = vi.fn();
const mockExecAsync = vi.fn();
const mockGetFirstAsync = vi.fn();
const mockGetAllAsync = vi.fn();
const mockWithTransactionAsync = vi.fn(async (cb: () => Promise<unknown>) => {
  return await cb();
});

const mockDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  withTransactionAsync: mockWithTransactionAsync,
  closeAsync: vi.fn(),
};

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(async () => mockDb),
}));

import {
  createWorkout,
  upsertDailyHabits,
  createRoutine,
  updateRoutine,
  getLastWorkoutSetsWithMetaForExercise,
  type CreateWorkoutInput,
} from '../../database/db';

describe('SQLite Database Parameter Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createWorkout não deve passar nenhum parâmetro undefined para o runAsync mesmo com campos opcionais ausentes', async () => {
    mockRunAsync
      .mockResolvedValueOnce({ lastInsertRowId: 10 }) // INSERT workouts
      .mockResolvedValueOnce({ lastInsertRowId: 101 }) // INSERT exercises
      .mockResolvedValueOnce({ lastInsertRowId: 1001 }); // INSERT sets

    mockGetFirstAsync.mockResolvedValueOnce({
      id: 10,
      title: 'Treino Sem Notas',
      date: '2026-09-09',
      notes: null,
    });

    mockGetAllAsync
      .mockResolvedValueOnce([
        {
          id: 101,
          workout_id: 10,
          name: 'Supino',
          muscle_group: null,
          rest_timer_seconds: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1001,
          exercise_id: 101,
          weight: 60,
          reps: 10,
          rpe: null,
          set_type: 'normal',
          completed_at: '2026-09-09T10:00:00.000Z',
        },
      ]);

    const input: CreateWorkoutInput = {
      title: 'Treino Sem Notas',
      date: '2026-09-09',
      notes: undefined, // Testando explicitamente undefined
      exercises: [
        {
          name: 'Supino',
          muscle_group: undefined, // Testando explicitamente undefined
          rest_timer_seconds: undefined, // Testando explicitamente undefined
          sets: [
            {
              weight: 60,
              reps: 10,
              rpe: undefined, // Testando explicitamente undefined
              set_type: undefined,
              completed_at: undefined,
            },
          ],
        },
      ],
    };

    const result = await createWorkout(input);

    expect(result).toBeDefined();
    expect(result.id).toBe(10);

    // Verifica cada chamada ao runAsync
    for (const call of mockRunAsync.mock.calls) {
      const [sql, params] = call;
      expect(typeof sql).toBe('string');
      expect(Array.isArray(params)).toBe(true);
      for (const param of params) {
        expect(param).not.toBeUndefined();
      }
    }

    // Verifica que workouts recebeu notes como null
    expect(mockRunAsync.mock.calls[0][1]).toEqual(['Treino Sem Notas', '2026-09-09', null]);

    // Verifica que exercises recebeu muscle_group e rest_timer_seconds como null
    expect(mockRunAsync.mock.calls[1][1]).toEqual([10, 'Supino', null, null]);

    // Verifica que sets recebeu rpe como null
    expect(mockRunAsync.mock.calls[2][1][3]).toBeNull();
  });

  it('upsertDailyHabits não deve passar parâmetros undefined', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // existing
      .mockResolvedValueOnce(null) // yesterday (streak check)
      .mockResolvedValueOnce({
        id: 1,
        date: '2026-09-09',
        protein_done: 0,
        water_done: 0,
        workout_done: 1,
        meals_done: 0,
        streak_count: 0,
      }); // updated

    mockRunAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

    const habit = await upsertDailyHabits({
      date: '2026-09-09',
      workout_done: 1,
      // protein_done, water_done, meals_done, streak_count são undefined
    });

    expect(habit).toBeDefined();
    for (const call of mockRunAsync.mock.calls) {
      const [, params] = call;
      for (const param of params) {
        expect(param).not.toBeUndefined();
      }
    }
  });

  it('createRoutine não deve passar parâmetros undefined', async () => {
    mockRunAsync
      .mockResolvedValueOnce({ lastInsertRowId: 5 })
      .mockResolvedValueOnce({ lastInsertRowId: 50 });

    mockGetFirstAsync.mockResolvedValueOnce({
      id: 5,
      name: 'Ficha Teste',
      description: null,
      color: null,
      created_at: '2026-09-09T10:00:00.000Z',
    });

    mockGetAllAsync.mockResolvedValueOnce([]);

    await createRoutine({
      name: 'Ficha Teste',
      description: undefined,
      color: undefined,
      exercises: [
        {
          exercise_name: 'Barra Fixa',
          muscle_group: undefined,
          target_sets: undefined,
          rest_timer_seconds: undefined,
        },
      ],
    });

    for (const call of mockRunAsync.mock.calls) {
      const [, params] = call;
      for (const param of params) {
        expect(param).not.toBeUndefined();
      }
    }
  });

  it('updateRoutine não deve passar parâmetros undefined', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce({
        id: 5,
        name: 'Ficha Existente',
        description: null,
        color: null,
        created_at: '2026-09-09T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 5,
        name: 'Ficha Atualizada',
        description: null,
        color: null,
        created_at: '2026-09-09T10:00:00.000Z',
      });

    mockGetAllAsync.mockResolvedValueOnce([]);
    mockRunAsync.mockResolvedValueOnce({ lastInsertRowId: 5 });

    await updateRoutine({
      id: 5,
      name: 'Ficha Atualizada',
      description: undefined,
      color: undefined,
    });

    for (const call of mockRunAsync.mock.calls) {
      const [, params] = call;
      for (const param of params) {
        expect(param).not.toBeUndefined();
      }
    }
  });

  it('upsertDailyHabits deve calcular automaticamente water_done e protein_done ao atingir metas quantitativas', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // existing
      .mockResolvedValueOnce({
        id: 1,
        date: '2026-09-09',
        protein_done: 1,
        water_done: 1,
        workout_done: 0,
        meals_done: 0,
        streak_count: 0,
        water_current_ml: 3000,
        water_target_ml: 3000,
        protein_current_g: 160,
        protein_target_g: 160,
      });

    mockRunAsync.mockResolvedValueOnce({ lastInsertRowId: 1 });

    const result = await upsertDailyHabits({
      date: '2026-09-09',
      water_current_ml: 3200,
      water_target_ml: 3000,
      protein_current_g: 165,
      protein_target_g: 160,
    });

    expect(result).toBeDefined();

    // Inserção no banco deve ter gravado protein_done = 1 e water_done = 1
    const lastRunCall = mockRunAsync.mock.calls[0];
    const params = lastRunCall[1];
    expect(params[1]).toBe(1); // protein_done
    expect(params[2]).toBe(1); // water_done
    expect(params[6]).toBe(3200); // water_current_ml
    expect(params[7]).toBe(3000); // water_target_ml
    expect(params[8]).toBe(165); // protein_current_g
    expect(params[9]).toBe(160); // protein_target_g
  });

  it('getLastWorkoutSetsWithMetaForExercise deve priorizar o último treino da mesma ficha quando routineTitle for informado', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({
      exerciseId: 42,
      workoutId: 7,
      workoutTitle: 'Treino A - Peito',
      workoutDate: '2026-10-20',
    });
    mockGetAllAsync.mockResolvedValueOnce([
      { id: 1, exercise_id: 42, weight: 80, reps: 10, rpe: 8, set_type: 'normal', completed_at: '2026-10-20T10:00:00Z' },
      { id: 2, exercise_id: 42, weight: 85, reps: 8, rpe: 9, set_type: 'normal', completed_at: '2026-10-20T10:02:00Z' },
    ]);

    const meta = await getLastWorkoutSetsWithMetaForExercise('Supino Reto com Barra', 'Treino A - Peito');

    expect(meta).not.toBeNull();
    expect(meta?.matchedSameRoutine).toBe(true);
    expect(meta?.workoutTitle).toBe('Treino A - Peito');
    expect(meta?.workoutDate).toBe('2026-10-20');
    expect(meta?.sets).toHaveLength(2);
    expect(meta?.sets[0].weight).toBe(80);
    expect(meta?.sets[1].weight).toBe(85);
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(1);
    expect(mockGetFirstAsync.mock.calls[0][1]).toEqual(['Supino Reto com Barra', 'Treino A - Peito']);
  });

  it('getLastWorkoutSetsWithMetaForExercise deve fazer fallback para qualquer treino anterior caso a ficha ainda não tenha histórico', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // Não achou na mesma ficha
      .mockResolvedValueOnce({
        exerciseId: 39,
        workoutId: 5,
        workoutTitle: 'Treino Livre',
        workoutDate: '2026-10-15',
      }); // Achou no fallback geral
    mockGetAllAsync.mockResolvedValueOnce([
      { id: 9, exercise_id: 39, weight: 75, reps: 12, rpe: null, set_type: 'normal', completed_at: '2026-10-15T10:00:00Z' },
    ]);

    const meta = await getLastWorkoutSetsWithMetaForExercise('Supino Reto com Barra', 'Ficha Nova');

    expect(meta).not.toBeNull();
    expect(meta?.matchedSameRoutine).toBe(false);
    expect(meta?.workoutTitle).toBe('Treino Livre');
    expect(meta?.sets).toHaveLength(1);
    expect(meta?.sets[0].weight).toBe(75);
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(2);
  });
});
