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
});
