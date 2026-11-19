import { describe, it, expect } from 'vitest';
import { calculateBrzycki1Rm, analyzeLocalWorkoutsProgress, calculateLocalAcwr } from '../progressionCalculator';
import { type WorkoutWithDetails } from '../../database/db';

describe('progressionCalculator (Mobile Math Engine)', () => {
  it('calculateBrzycki1Rm deve calcular 1RM com precisão e limitar a 12 repetições', () => {
    expect(calculateBrzycki1Rm(100, 1)).toBe(100);
    expect(calculateBrzycki1Rm(100, 10)).toBe(133.3);
    // 25 reps deve ser limitado a 12 reps
    expect(calculateBrzycki1Rm(60, 25)).toBe(calculateBrzycki1Rm(60, 12));
    expect(calculateBrzycki1Rm(0, 10)).toBe(0);
    expect(calculateBrzycki1Rm(100, 0)).toBe(0);
  });

  it('analyzeLocalWorkoutsProgress deve calcular deltas reais e detectar platô de 3 sessões', () => {
    const workouts: WorkoutWithDetails[] = [
      {
        id: 1,
        title: 'Ficha Peito',
        date: '2026-10-01',
        notes: null,
        exercises: [
          {
            id: 101,
            workout_id: 1,
            name: 'Supino Reto',
            muscle_group: 'Peito',
            rest_timer_seconds: 90,
            sets: [
              { id: 1, exercise_id: 101, weight: 80, reps: 10, rpe: 9, set_type: 'normal', completed_at: null },
            ],
          },
        ],
      },
      {
        id: 2,
        title: 'Ficha Peito',
        date: '2026-10-08',
        notes: null,
        exercises: [
          {
            id: 102,
            workout_id: 2,
            name: 'Supino Reto',
            muscle_group: 'Peito',
            rest_timer_seconds: 90,
            sets: [
              { id: 2, exercise_id: 102, weight: 80, reps: 10, rpe: 9, set_type: 'normal', completed_at: null },
            ],
          },
        ],
      },
      {
        id: 3,
        title: 'Ficha Peito',
        date: '2026-10-15',
        notes: null,
        exercises: [
          {
            id: 103,
            workout_id: 3,
            name: 'Supino Reto',
            muscle_group: 'Peito',
            rest_timer_seconds: 90,
            sets: [
              { id: 3, exercise_id: 103, weight: 80, reps: 10, rpe: 9.5, set_type: 'normal', completed_at: null },
            ],
          },
        ],
      },
    ];

    const result = analyzeLocalWorkoutsProgress(workouts);
    expect(result.analyzedWorkoutsCount).toBe(3);
    expect(result.detectedPlateaus).toHaveLength(1);
    expect(result.detectedPlateaus[0].exerciseName).toBe('Supino Reto');
    expect(result.detectedPlateaus[0].consecutiveStagnantSessions).toBe(3);
    expect(result.detectedPlateaus[0].averageRpe).toBe(9.5);
  });

  it('calculateLocalAcwr deve calcular ACWR em Sweet Spot e em Zona de Perigo', () => {
    const isoDaysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const mkWorkout = (id: number, daysAgo: number, weight: number): WorkoutWithDetails => ({
      id,
      title: 'Treino',
      date: isoDaysAgo(daysAgo),
      notes: null,
      exercises: [
        {
          id,
          workout_id: id,
          name: 'Agachamento',
          muscle_group: 'Pernas',
          rest_timer_seconds: 120,
          sets: [{ id, exercise_id: id, weight, reps: 10, rpe: 8, set_type: 'normal', completed_at: null }],
        },
      ],
    });

    const regularWorkouts = [
      mkWorkout(1, 1, 100), // 1000kg nos últimos 7d
      mkWorkout(2, 10, 100),
      mkWorkout(3, 17, 100),
      mkWorkout(4, 24, 100),
    ];

    const optimal = calculateLocalAcwr(regularWorkouts);
    expect(optimal.riskLevel).toBe('OPTIMAL');
    expect(optimal.ratio).toBe(1);

    const spike = calculateLocalAcwr([...regularWorkouts, mkWorkout(5, 3, 120)]);
    expect(spike.riskLevel).toBe('DANGER_ZONE');
    expect(spike.ratio).toBeGreaterThanOrEqual(1.5);
  });
});
