import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  type Routine,
  type RoutineExercise,
  type RoutineWithExercises,
  type CreateRoutineInput,
  PRESET_ROUTINE_GROUPS,
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

  it('deve garantir que PRESET_ROUTINE_GROUPS contém todas as divisões clássicas e estruturas válidas', () => {
    expect(PRESET_ROUTINE_GROUPS).toBeDefined();
    expect(PRESET_ROUTINE_GROUPS.length).toBeGreaterThanOrEqual(4);

    const groupIds = PRESET_ROUTINE_GROUPS.map((g: any) => g.id);
    expect(groupIds).toContain('ppl');
    expect(groupIds).toContain('upper_lower');
    expect(groupIds).toContain('full_body');
    expect(groupIds).toContain('arms_shoulders');

    for (const group of PRESET_ROUTINE_GROUPS) {
      expect(group.id).toBeTruthy();
      expect(group.name).toBeTruthy();
      expect(group.description).toBeTruthy();
      expect(group.badge).toBeTruthy();
      expect(group.color).toMatch(/^#/);
      expect(group.routines.length).toBeGreaterThan(0);

      for (const r of group.routines) {
        expect(r.name).toBeTruthy();
        expect(r.exercises).toBeDefined();
        expect(r.exercises!.length).toBeGreaterThan(0);
        for (const ex of r.exercises!) {
          expect(ex.exercise_name).toBeTruthy();
          expect(ex.target_sets).toBeGreaterThan(0);
          expect(ex.rest_timer_seconds).toBeGreaterThan(0);
        }
      }
    }
  });
});
