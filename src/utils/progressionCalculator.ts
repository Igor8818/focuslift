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
import {
  type ProgressionMetric,
  type PlateauExercise,
  type AiCoachAnalysis,
  type AcwrMetric,
} from '../services/springApiService';

function roundOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

function toDisplayUnit(kg: number, unit: string): number {
  if (unit !== 'lbs' || kg <= 0) return Math.round(kg);
  return Math.round(kg * 2.20462);
}

export function calculateLocalAcwr(
  workouts: WorkoutWithDetails[],
  language = 'pt'
): AcwrMetric {
  const isPt = language === 'pt';
  if (!workouts || workouts.length === 0) {
    return {
      acuteVolumeKg: 0,
      chronicWeeklyVolumeKg: 0,
      ratio: 0,
      riskLevel: 'INSUFFICIENT_DATA',
      interpretation: isPt ? 'Sem dados de treino suficientes' : 'Insufficient workout data',
      recommendation: isPt
        ? 'Registre treinos com consistência nas próximas semanas para habilitar o monitoramento de fadiga.'
        : 'Log workouts consistently over the next few weeks to unlock fatigue monitoring.',
    };
  }

  const now = new Date();
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
  let acuteVolume = 0;
  let total28dVolume = 0;
  let workoutsIn28d = 0;

  for (const w of workouts) {
    if (!w.date) continue;
    const parts = w.date.trim().split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) continue;
    const wNoon = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0).getTime();
    const diffDays = Math.round((todayNoon - wNoon) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < 28) {
      let workoutTonnage = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.set_type === 'warmup') continue;
          if (s.weight > 0 && s.reps > 0) {
            workoutTonnage += s.weight * s.reps;
          }
        }
      }
      total28dVolume += workoutTonnage;
      workoutsIn28d++;
      if (diffDays < 7) {
        acuteVolume += workoutTonnage;
      }
    }
  }

  if (workoutsIn28d < 2 || total28dVolume <= 0) {
    return {
      acuteVolumeKg: roundOneDecimal(acuteVolume),
      chronicWeeklyVolumeKg: 0,
      ratio: 0,
      riskLevel: 'INSUFFICIENT_DATA',
      interpretation: isPt
        ? 'Histórico inicial insuficiente (mínimo de 2 treinos no mês)'
        : 'Insufficient monthly history (minimum 2 logged workouts in 28 days)',
      recommendation: isPt
        ? 'Continue registrando seus treinos regularmente.'
        : 'Keep logging your workouts regularly.',
    };
  }

  const chronicWeeklyVolume = total28dVolume / 4;
  const ratio = roundOneDecimal(acuteVolume / chronicWeeklyVolume);

  let riskLevel: AcwrMetric['riskLevel'];
  let interpretation: string;
  let recommendation: string;

  if (ratio < 0.8) {
    riskLevel = 'UNDER_TRAINING';
    interpretation = isPt
      ? 'Volume agudo abaixo da média crônica (sub-recuperação ou fase regenerativa).'
      : 'Acute workload is below your chronic average (deload or under-stimulation phase).';
    recommendation = isPt
      ? 'Aumente gradualmente o volume para evitar destreino ou aproveite para consolidar técnica.'
      : 'Gradually increase working volume to avoid detraining or refine exercise technique.';
  } else if (ratio <= 1.3) {
    riskLevel = 'OPTIMAL';
    interpretation = isPt
      ? 'Sweet Spot fisiológico (0.8 - 1.3): sobrecarga segura e máxima adaptação hipertrófica.'
      : 'Physiological Sweet Spot (0.8 - 1.3): safe progressive overload and optimal hypertrophy zone.';
    recommendation = isPt
      ? 'Mantenha o ritmo atual com sobrecarga progressiva de +1 rep ou micro-carga de +1kg a +2kg.'
      : 'Keep your pace with +1 rep or small micro-loading increments.';
  } else if (ratio < 1.5) {
    riskLevel = 'OVERREACHING';
    interpretation = isPt
      ? 'Sobrecarga aguda acelerada (+30% acima da base crônica). Risco moderado de fadiga.'
      : 'Accelerated acute workload (+30% above chronic baseline). Moderate fatigue risk.';
    recommendation = isPt
      ? 'Monitore sono e alimentação. Se o RPE passar de 9 em vários exercícios, reduza 1 série de trabalho.'
      : 'Monitor sleep and recovery; cut 1 accessory working set if RPE consistently exceeds 9.';
  } else {
    riskLevel = 'DANGER_ZONE';
    interpretation = isPt
      ? 'Zona de Perigo (ACWR >= 1.5): pico excessivo de fadiga neuromuscular acumulada.'
      : 'Danger Zone (ACWR >= 1.5): excessive acute neuromuscular fatigue spike detected.';
    recommendation = isPt
      ? 'Risco agudo de lesão. Aplique deload leve: reduza 20% do volume na próxima semana.'
      : 'Elevated injury risk. Apply a light deload reducing next week volume by 20%.';
  }

  return {
    acuteVolumeKg: roundOneDecimal(acuteVolume),
    chronicWeeklyVolumeKg: roundOneDecimal(chronicWeeklyVolume),
    ratio,
    riskLevel,
    interpretation,
    recommendation,
  };
}

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

export function analyzeLocalWorkoutsProgress(
  workouts: WorkoutWithDetails[],
  language = 'pt',
  unit = 'kg'
): AiCoachAnalysis {
  const isPt = language === 'pt';
  if (!workouts || workouts.length === 0) {
    return {
      athleteName: isPt ? 'Atleta FocusLift' : 'FocusLift Athlete',
      analyzedWorkoutsCount: 0,
      currentWeekVolumeKg: 0,
      previousWeekVolumeKg: 0,
      volumeDeltaPercent: 0,
      topProgressions: [],
      detectedPlateaus: [],
      aiSummary: isPt
        ? 'Você ainda não possui treinos concluídos suficientes para uma análise de sobrecarga progressiva.'
        : 'You do not have enough logged workouts yet for a progressive overload analysis.',
      tacticalAdvice: isPt
        ? 'Registre seu primeiro treino na aba Treino para começar o rastreamento.'
        : 'Log your first workout in the Workout tab to begin tracking.',
      nextSessionFocus: isPt
        ? 'Completar o primeiro treino com foco em postura e execução correta.'
        : 'Complete your first workout focusing on clean form and full range of motion.',
      generatedAt: new Date().toISOString(),
      acwr: calculateLocalAcwr(workouts, language),
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

  // 5. Síntese textual inteligente localizada
  const wUnit = unit === 'lbs' ? 'lbs' : 'kg';
  const curDisplayVol = toDisplayUnit(currentWeekVol, wUnit);
  const prevDisplayVol = toDisplayUnit(previousWeekVol, wUnit);
  let aiSummary = '';

  if (isPt) {
    if (previousWeekVol > 0) {
      if (volumeDeltaPercent >= 3.0 && volumeDeltaPercent <= 12.0) {
        aiSummary = `Volume semanal subiu de ${prevDisplayVol} ${wUnit} para ${curDisplayVol} ${wUnit} (+${volumeDeltaPercent}%). Faixa ideal de sobrecarga progressiva sem fadiga excessiva.`;
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
  } else {
    if (previousWeekVol > 0) {
      if (volumeDeltaPercent >= 3.0 && volumeDeltaPercent <= 12.0) {
        aiSummary = `Weekly tonnage climbed from ${prevDisplayVol} ${wUnit} to ${curDisplayVol} ${wUnit} (+${volumeDeltaPercent}%). Ideal progressive overload zone without excessive fatigue.`;
      } else if (volumeDeltaPercent > 12.0) {
        aiSummary = `Weekly volume jumped +${volumeDeltaPercent}%. Trim 1 working set on accessory lifts next session to manage fatigue.`;
      } else if (volumeDeltaPercent < -10.0) {
        aiSummary = `Weekly volume dropped ${volumeDeltaPercent}%. Solid natural deload for joint and muscle recovery.`;
      } else {
        aiSummary = `Weekly volume steady (${volumeDeltaPercent >= 0 ? '+' : ''}${volumeDeltaPercent}%). Push for +1 rep or a small micro-load bump next session.`;
      }
    } else {
      aiSummary = `Baseline report built from ${workouts.length} workout(s). Keep logging sessions to track weekly overload!`;
    }

    if (topProgressions.length > 0 && topProgressions[0].delta1RmKg > 0) {
      const topDelta = wUnit === 'lbs' ? roundOneDecimal(topProgressions[0].delta1RmKg * 2.20462) : topProgressions[0].delta1RmKg;
      aiSummary += ` Highlight: ${topProgressions[0].exerciseName} (+${topDelta} ${wUnit} est. 1RM).`;
    }
  }

  let tacticalAdvice = isPt
    ? 'Aplique sobrecarga progressiva simples: busque +1 repetição ou micro-carga de +1kg a +2kg na primeira série com descanso de 2-3min nos compostos.'
    : 'Apply simple progressive overload: target +1 rep or a small micro-load on your top set with 2-3min rest on compounds.';
  if (detectedPlateaus.length > 0) {
    tacticalAdvice = isPt
      ? `Atenção aos ${detectedPlateaus.length} exercício(s) estagnado(s): adicione micro-carga (+1kg a +2kg) ou reduza 1 série com descida controlada em 2 a 3s.`
      : `Watch ${detectedPlateaus.length} stalled lift(s): add a small micro-load or trim 1 working set with controlled 2-3s eccentrics.`;
  }

  const nextSessionFocus =
    topProgressions.length > 0
      ? isPt
        ? `Buscar +1 repetição ou micro-carga (+1kg/+2kg) na primeira série de ${topProgressions[0].exerciseName} com 2 a 3s na descida.`
        : `Aim for +1 rep or small weight bump on ${topProgressions[0].exerciseName} top set with 2-3s eccentric control.`
      : isPt
      ? 'Executar a primeira série pesada com cadência de 2 a 3 segundos na descida e descanso adequado.'
      : 'Execute your first heavy working set with 2-3s eccentric tempo and proper rest.';

  return {
    athleteName: isPt ? 'Atleta FocusLift' : 'FocusLift Athlete',
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
    acwr: calculateLocalAcwr(workouts, language),
  };
}
