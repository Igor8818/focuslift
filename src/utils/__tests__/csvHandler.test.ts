import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  parseCsvRows,
  exportWorkoutsToCSV,
  parseWorkoutsCSV,
} from '../csvHandler';
import { type WorkoutWithDetails } from '../../database/db';

describe('CSV Handler', () => {
  describe('parseCsvRows (RFC 4180)', () => {
    it('deve parsear linhas simples separadas por vírgula', () => {
      const csv = 'a,b,c\n1,2,3';
      const rows = parseCsvRows(csv);
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('deve lidar com campos entre aspas contendo vírgulas e quebras de linha', () => {
      const csv = 'col1,col2\n"Texto com, virgula","Linha 1\nLinha 2"';
      const rows = parseCsvRows(csv);
      expect(rows).toEqual([
        ['col1', 'col2'],
        ['Texto com, virgula', 'Linha 1\nLinha 2'],
      ]);
    });

    it('deve desescapar aspas duplas internas ("")', () => {
      const csv = 'quote\n"Ele disse ""Oi"""';
      const rows = parseCsvRows(csv);
      expect(rows).toEqual([
        ['quote'],
        ['Ele disse "Oi"'],
      ]);
    });
  });

  describe('exportWorkoutsToCSV e parseWorkoutsCSV', () => {
    const mockWorkouts: WorkoutWithDetails[] = [
      {
        id: 1,
        title: 'Treino A - Peito e Tríceps',
        date: '2026-09-09',
        notes: 'Foco em progressão de carga',
        exercises: [
          {
            id: 10,
            workout_id: 1,
            name: 'Supino Reto',
            muscle_group: 'Peito',
            rest_timer_seconds: 120,
            sets: [
              {
                id: 100,
                exercise_id: 10,
                weight: 80,
                reps: 8,
                rpe: 8.5,
                set_type: 'normal',
                completed_at: '2026-09-09T10:00:00.000Z',
              },
              {
                id: 101,
                exercise_id: 10,
                weight: 85,
                reps: 6,
                rpe: 9,
                set_type: 'normal',
                completed_at: '2026-09-09T10:05:00.000Z',
              },
            ],
          },
          {
            id: 11,
            workout_id: 1,
            name: 'Tríceps Corda',
            muscle_group: 'Tríceps',
            rest_timer_seconds: 60,
            sets: [
              {
                id: 102,
                exercise_id: 11,
                weight: 25,
                reps: 12,
                rpe: 8,
                set_type: 'normal',
                completed_at: '2026-09-09T10:15:00.000Z',
              },
            ],
          },
        ],
      },
    ];

    it('deve exportar para CSV e re-importar com integridade dos dados', () => {
      const csvString = exportWorkoutsToCSV(mockWorkouts);
      expect(csvString).toContain('Treino A - Peito e Tríceps');
      expect(csvString).toContain('Supino Reto');
      expect(csvString).toContain('Tríceps Corda');

      const parsed = parseWorkoutsCSV(csvString);
      expect(parsed).toHaveLength(1);

      const w = parsed[0];
      expect(w.title).toBe('Treino A - Peito e Tríceps');
      expect(w.date).toBe('2026-09-09');
      expect(w.notes).toBe('Foco em progressão de carga');
      expect(w.exercises).toHaveLength(2);

      const supino = w.exercises![0];
      expect(supino.name).toBe('Supino Reto');
      expect(supino.muscle_group).toBe('Peito');
      expect(supino.rest_timer_seconds).toBe(120);
      expect(supino.sets).toHaveLength(2);
      expect(supino.sets![0].weight).toBe(80);
      expect(supino.sets![0].reps).toBe(8);
      expect(supino.sets![0].rpe).toBe(8.5);

      const triceps = w.exercises![1];
      expect(triceps.name).toBe('Tríceps Corda');
      expect(triceps.sets).toHaveLength(1);
      expect(triceps.sets![0].weight).toBe(25);
    });

    it('deve retornar array vazio se CSV estiver vazio ou apenas com cabeçalho', () => {
      expect(parseWorkoutsCSV('')).toEqual([]);
      expect(parseWorkoutsCSV('workout_title,workout_date\n')).toEqual([]);
    });

    it('deve neutralizar tentativas de CSV Formula Injection (=, +, -, @)', () => {
      const maliciousWorkout: WorkoutWithDetails[] = [
        {
          id: 99,
          title: '=cmd|\'/C calc\'!A0',
          date: '2026-09-10',
          notes: '@SUM(1+1)',
          exercises: [],
        },
      ];
      const csv = exportWorkoutsToCSV(maliciousWorkout);
      expect(csv).toContain("'=cmd|'/C calc'!A0");
      expect(csv).toContain("'@SUM(1+1)");
    });

    it('deve ignorar cargas negativas, repetições inválidas ou datas malformadas na importação CSV', () => {
      const invalidCsv = [
        'workout_title,workout_date,workout_notes,exercise_name,muscle_group,rest_timer_seconds,weight,reps,rpe,set_type,completed_at',
        'Treino Valido,2026-09-10,,Supino,Peito,90,-50,10,8,normal,',
        'Treino Valido,2026-09-10,,Supino,Peito,90,80,0,8,normal,',
        'Treino Valido,2026-09-10,,Supino,Peito,90,80,10,15,normal,',
        'Treino Data Invalida,data-errada,,Agachamento,Pernas,90,100,8,8,normal,',
      ].join('\n');

      const parsed = parseWorkoutsCSV(invalidCsv);
      // "Treino Data Invalida" deve ser descartado por data inválida
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Treino Valido');
      // As duas primeiras séries (-50kg e 0 reps) foram rejeitadas; a 3ª série (80kg x 10) entrou com RPE inválido sanitizado para null
      expect(parsed[0].exercises![0].sets).toHaveLength(1);
      expect(parsed[0].exercises![0].sets![0].weight).toBe(80);
      expect(parsed[0].exercises![0].sets![0].reps).toBe(10);
      expect(parsed[0].exercises![0].sets![0].rpe).toBeNull();
    });
  });
});
