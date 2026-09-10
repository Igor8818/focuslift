import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  type Routine,
  type RoutineExercise,
  type RoutineWithExercises,
  type CreateRoutineInput,
} from '../../database/db';

describe('Sistema de Fichas / Rotinas (Routines)', () => {
  it('deve validar a estrutura e propriedades de uma RoutineWithExercises', () => {
    const mockRoutine: RoutineWithExercises = {
      id: 1,
      name: 'Push A - Peito e Tríceps',
      description: 'Treino de empurrar com ênfase em peito',
      color: '#38BDF8',
      created_at: '2026-09-09T10:00:00.000Z',
      exercises: [
        {
          id: 101,
          routine_id: 1,
          exercise_name: 'Supino Reto com Barra',
          muscle_group: 'Peito',
          target_sets: 4,
          rest_timer_seconds: 120,
          order_index: 0,
        },
        {
          id: 102,
          routine_id: 1,
          exercise_name: 'Tríceps Testa',
          muscle_group: 'Tríceps',
          target_sets: 3,
          rest_timer_seconds: 60,
          order_index: 1,
        },
      ],
    };

    expect(mockRoutine.id).toBe(1);
    expect(mockRoutine.name).toBe('Push A - Peito e Tríceps');
    expect(mockRoutine.color).toBe('#38BDF8');
    expect(mockRoutine.exercises).toHaveLength(2);

    const firstEx = mockRoutine.exercises[0];
    expect(firstEx.exercise_name).toBe('Supino Reto com Barra');
    expect(firstEx.target_sets).toBe(4);
    expect(firstEx.rest_timer_seconds).toBe(120);
    expect(firstEx.order_index).toBe(0);
  });

  it('deve validar que CreateRoutineInput aceita exercícios opcionais e campos de descanso', () => {
    const input: CreateRoutineInput = {
      name: 'Legs C - Inferiores',
      color: '#F59E0B',
      exercises: [
        {
          exercise_name: 'Agachamento Livre',
          muscle_group: 'Pernas',
          target_sets: 4,
          rest_timer_seconds: 120,
        },
      ],
    };

    expect(input.name).toBe('Legs C - Inferiores');
    expect(input.exercises![0].rest_timer_seconds).toBe(120);
  });
});
