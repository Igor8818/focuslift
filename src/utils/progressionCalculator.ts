/**
 * progressionCalculator.ts
 *
 * Motor matemático determinístico local para análise de hipertrofia, 1RM,
 * volume semanal e detecção de platôs no FocusLift Mobile (Offline-First).
 *
 * Espelha a exata lógica matemática do backend Java (ProgressionMathEngine),
 * garantindo zero divergências ou alucinações matemáticas.
 */

import { type WorkoutWithDetails } from '../database/db';
import { type ProgressionMetric, type PlateauExercise, type AiCoachAnalysis } from '../services/springApiService';

export function calculateBrzycki1Rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  // Limitação estrita para 12 repetições conforme literatura biomecânica
  const boundedReps = Math.min(reps, 12);
  const est = weight * (36 / (37 - boundedReps));
  return Math.round(est * 10) / 10;
}

interface ExerciseSessionSnapshot {
  exerciseName: string;
  muscleGroup: string;
  routineTitle: string;
  date: string;
  topWeight: number;
  topReps: number;
  best1Rm: number;
  avgRpe: number;
}

export function analyzeLocalWorkoutsProgress(workouts: WorkoutWithDetails[]): AiCoachAnalysis {
  if (!workouts || workouts.length === 0) {
    return {
      athleteName: 'Atleta FocusLift',
      analyzedWorkoutsCount: 0,
      currentWeekVolumeKg: 0,
      previousWeekVolumeKg: 0,
      volumeDeltaPercent: 0,
      topProgressions: [],
      detectedPlateaus: [],
      aiSummary: 'Você ainda não possui treinos concluídos suficientes para uma análise de sobrecarga progressiva.',
      tacticalAdvice: 'Registre seu primeiro treino na aba Treino para começar o rastreamento.',
      nextSessionFocus: 'Completar o primeiro treino com foco em postura e execução correta.',
      generatedAt: new Date().toISOString(),
    };
  }

  // 1. Cálculo de Volume Semanal (Últimos 7 dias vs 7 a 14 dias atrás)
  const now = new Date();
  let currentWeekVol = 0;
  let previousWeekVol = 0;

  for (const w of workouts) {
    if (!w.date) continue;
    const wDate = new Date(w.date + 'T12:00:00');
    const diffDays = Math.floor((now.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24));

    let workoutTonnage = 0;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (s.set_type === 'warmup') continue;
        if (s.weight > 0 && s.reps > 0) {
          workoutTonnage += s.weight * s.reps;
        }
      }
    }

    if (diffDays >= 0 && diffDays <= 7) {
      currentWeekVol += workoutTonnage;
    } else if (diffDays > 7 && diffDays <= 14) {
      previousWeekVol += workoutTonnage;
    }
  }

  let volumeDeltaPercent = 0;
  if (previousWeekVol > 0) {
    volumeDeltaPercent = Math.round(((currentWeekVol - previousWeekVol) / previousWeekVol) * 1000) / 10;
  }

  // 2. Extração cronológica de histórico por exercício (ordem crescente de data)
  const sortedWorkouts = [...workouts]
    .filter((w) => !!w.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const exerciseHistory = new Map<string, ExerciseSessionSnapshot[]>();
  const routineExerciseHistory = new Map<string, ExerciseSessionSnapshot[]>();

  for (const w of sortedWorkouts) {
    const routineTitle = (w.title || 'Treino').trim();

    for (const ex of w.exercises) {
      const exName = (ex.name || '').trim();
      if (!exName) continue;

      let topWeight = 0;
      let topReps = 0;
      let best1Rm = 0;
      let totalRpe = 0;
      let rpeCount = 0;

      for (const s of ex.sets) {
        if (s.set_type === 'warmup') continue;
        if (s.weight <= 0 || s.reps <= 0) continue;

        const est1Rm = calculateBrzycki1Rm(s.weight, s.reps);
        if (est1Rm > best1Rm) best1Rm = est1Rm;

        if (s.weight > topWeight || (s.weight === topWeight && s.reps > topReps)) {
          topWeight = s.weight;
          topReps = s.reps;
        }

        if (typeof s.rpe === 'number' && s.rpe > 0) {
          totalRpe += s.rpe;
          rpeCount++;
        }
      }

      if (topWeight > 0 && topReps > 0) {
        const avgRpe = rpeCount > 0 ? totalRpe / rpeCount : 8.0;
        const snap: ExerciseSessionSnapshot = {
          exerciseName: exName,
          muscleGroup: ex.muscle_group || '',
          routineTitle,
          date: w.date,
          topWeight,
          topReps,
          best1Rm,
          avgRpe,
        };

        const list = exerciseHistory.get(exName) || [];
        list.push(snap);
        exerciseHistory.set(exName, list);

        const routineKey = `${exName.toLowerCase()}|||${routineTitle.toLowerCase()}`;
        const rList = routineExerciseHistory.get(routineKey) || [];
        rList.push(snap);
        routineExerciseHistory.set(routineKey, rList);
      }
    }
  }

  // 3. Cálculo de Top Progressões
  const topProgressions: ProgressionMetric[] = [];
  for (const [, sessions] of exerciseHistory.entries()) {
    if (sessions.length >= 2) {
      const latest = sessions[sessions.length - 1];
      const previous = sessions[sessions.length - 2];

      const deltaKg = Math.round((latest.best1Rm - previous.best1Rm) * 10) / 10;
      const deltaPct =
        previous.best1Rm > 0
          ? Math.round(((latest.best1Rm - previous.best1Rm) / previous.best1Rm) * 1000) / 10
          : 0;

      topProgressions.push({
        exerciseName: latest.exerciseName,
        muscleGroup: latest.muscleGroup,
        current1Rm: latest.best1Rm,
        previous1Rm: previous.best1Rm,
        delta1RmKg: deltaKg,
        delta1RmPercent: deltaPct,
        currentTopWeight: latest.topWeight,
        currentTopReps: latest.topReps,
        previousTopWeight: previous.topWeight,
        previousTopReps: previous.topReps,
      });
    } else if (sessions.length === 1) {
      const only = sessions[0];
      topProgressions.push({
        exerciseName: only.exerciseName,
        muscleGroup: only.muscleGroup,
        current1Rm: only.best1Rm,
        previous1Rm: only.best1Rm,
        delta1RmKg: 0,
        delta1RmPercent: 0,
        currentTopWeight: only.topWeight,
        currentTopReps: only.topReps,
        previousTopWeight: only.topWeight,
        previousTopReps: only.topReps,
      });
    }
  }

  topProgressions.sort((a, b) => b.delta1RmPercent - a.delta1RmPercent);

  // 4. Detecção de Platôs (>= 3 sessões consecutivas sem aumento na mesma ficha com RPE >= 8.0)
  const detectedPlateaus: PlateauExercise[] = [];
  for (const [, sessions] of routineExerciseHistory.entries()) {
    if (sessions.length >= 3) {
      let stagnantCount = 1;
      for (let i = sessions.length - 1; i > 0; i--) {
        if (sessions[i].best1Rm <= sessions[i - 1].best1Rm) {
          stagnantCount++;
        } else {
          break;
        }
      }

      if (stagnantCount >= 3) {
        const current = sessions[sessions.length - 1];
        if (current.avgRpe >= 8.0) {
          const suggestedAction =
            current.avgRpe >= 9.0
              ? 'Reduza 5% a 10% da carga (ou 1 série) e foque no controle excêntrico de 2 a 3 segundos com 2 a 3min de descanso.'
              : 'Adicione micro-carga de +1kg a +2kg ou tente +1 repetição na primeira série mantendo 2 a 3s na descida.';

          detectedPlateaus.push({
            exerciseName: current.exerciseName,
            routineTitle: current.routineTitle,
            consecutiveStagnantSessions: stagnantCount,
            currentWeight: current.topWeight,
            currentReps: current.topReps,
            averageRpe: Math.round(current.avgRpe * 10) / 10,
            suggestedAction,
          });
        }
      }
    }
  }

  // 5. Síntese textual inteligente em português
  let aiSummary = '';
  if (previousWeekVol > 0) {
    if (volumeDeltaPercent >= 3.0 && volumeDeltaPercent <= 12.0) {
      aiSummary = `Volume semanal subiu de ${previousWeekVol} kg para ${currentWeekVol} kg (+${volumeDeltaPercent}%). Faixa ideal de sobrecarga progressiva sem fadiga excessiva.`;
    } else if (volumeDeltaPercent > 12.0) {
      aiSummary = `Volume semanal aumentou +${volumeDeltaPercent}%. Reduza 1 série nos exercícios secundários na próxima sessão para controlar a fadiga.`;
    } else if (volumeDeltaPercent < -10.0) {
      aiSummary = `Volume semanal caiu ${volumeDeltaPercent}%. Bom deload simples para regeneração articular e muscular.`;
    } else {
      aiSummary = `Volume semanal estável (${volumeDeltaPercent >= 0 ? '+' : ''}${volumeDeltaPercent}%). Busque +1 repetição ou micro-carga de +1kg a +2kg para novo estímulo.`;
    }
  } else {
    aiSummary = `Diagnóstico inicial com base em ${workouts.length} treino(s). Registre os próximos treinos para acompanhar a sobrecarga semanal!`;
  }

  if (topProgressions.length > 0 && topProgressions[0].delta1RmKg > 0) {
    aiSummary += ` Destaque no ${topProgressions[0].exerciseName} (+${topProgressions[0].delta1RmKg} kg no 1RM estimado).`;
  }

  let tacticalAdvice = 'Aplique sobrecarga progressiva simples: busque +1 repetição ou micro-carga de +1kg a +2kg na primeira série com descanso de 2-3min nos compostos.';
  if (detectedPlateaus.length > 0) {
    tacticalAdvice = `Atenção aos ${detectedPlateaus.length} exercício(s) estagnado(s): adicione micro-carga (+1kg a +2kg) ou reduza 1 série com descida controlada em 2 a 3s.`;
  }

  const nextSessionFocus =
    topProgressions.length > 0
      ? `Buscar +1 repetição ou micro-carga (+1kg/+2kg) na primeira série de ${topProgressions[0].exerciseName} com 2 a 3s na descida.`
      : 'Executar a primeira série pesada com cadência de 2 a 3 segundos na descida e descanso adequado.';

  return {
    athleteName: 'Atleta FocusLift',
    analyzedWorkoutsCount: workouts.length,
    currentWeekVolumeKg: Math.round(currentWeekVol),
    previousWeekVolumeKg: Math.round(previousWeekVol),
    volumeDeltaPercent,
    topProgressions: topProgressions.slice(0, 5),
    detectedPlateaus,
    aiSummary,
    tacticalAdvice,
    nextSessionFocus,
    generatedAt: new Date().toISOString(),
  };
}
