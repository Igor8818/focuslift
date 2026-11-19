import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  checkBackendHealth,
  fetchAiCoachAnalysis,
  syncLocalWorkoutsToSpringBackend,
  sendAiCoachQuestion,
  getLocalAiCoachChatFallback,
  getBackendBaseUrl,
  setBackendBaseUrl,
  type AiCoachAnalysis,
  type AiCoachChatResponse,
  type ChatMessagePayload,
} from '../services/springApiService';
import {
  getAllWorkoutsWithDetails,
  getRoutines,
  createRoutine,
  getLatestBodyweight,
  getDailyHabitsSince,
} from '../database/db';
import { daysAgoLocalIso } from '../utils/date';
import { analyzeLocalWorkoutsProgress } from '../utils/progressionCalculator';

const CHAT_HISTORY_STORAGE_KEY = '@focuslift_ai_coach_chat_history_v2';

interface AiCoachModalProps {
  visible: boolean;
  onClose: () => void;
  initialExerciseName?: string;
}

interface QuickPromptChip {
  id: string;
  label: string;
  prompt: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface SuggestedRoutinePlan {
  name: string;
  description: string;
  color: string;
  exercises: Array<{
    exercise_name: string;
    muscle_group: string;
    target_sets: number;
    rest_timer_seconds: number;
  }>;
}

interface ChatHistoryItem {
  q: string;
  a: string;
  takeaways?: string[];
  suggestedRoutine?: SuggestedRoutinePlan;
  routineSaved?: boolean;
}

function getQuickPromptChips(isPt: boolean, initialExercise?: string): QuickPromptChip[] {
  const focusName = initialExercise || (isPt ? 'meu exercício principal' : 'my main lift');
  if (isPt) {
    return [
      {
        id: 'gerar_ficha',
        label: 'Montar Ficha com IA',
        prompt: 'Monte uma ficha de treino hipertrofia otimizada para mim e pronta para salvar no app.',
        icon: 'barbell-outline',
      },
      {
        id: 'substituir',
        label: 'Substituir Exercício',
        prompt: `A máquina de ${focusName} está ocupada hoje. Quais substitutos biomecânicos usar com carga equivalente?`,
        icon: 'swap-horizontal-outline',
      },
      {
        id: 'destravar',
        label: 'Quebrar Platô Atual',
        prompt: 'Analise meus dados e me diga como destravar carga e superar o platô atual nos exercícios principais.',
        icon: 'trending-up-outline',
      },
      {
        id: 'aquecimento',
        label: 'Calcular Aquecimento',
        prompt: 'Calcule minhas séries de aquecimento com base na minha carga real atual sem queimar as séries válidas.',
        icon: 'flame-outline',
      },
      {
        id: 'deload',
        label: 'Planejar Deload',
        prompt: 'Com base no meu volume e fadiga ACWR, quando e como devo planejar um deload?',
        icon: 'refresh-outline',
      },
      {
        id: 'falha',
        label: 'RPE vs Falha Total',
        prompt: 'Devo ir até a falha concêntrica em todas as séries ou manter RPE entre 8 e 9?',
        icon: 'shield-outline',
      },
    ];
  }

  return [
    {
      id: 'gerar_ficha',
      label: 'Build AI Routine',
      prompt: 'Build an optimized hypertrophy workout routine ready to save directly into my app.',
      icon: 'barbell-outline',
    },
    {
      id: 'substituir',
      label: 'Swap Exercise',
      prompt: `The machine for ${focusName} is occupied right now. What are the best biomechanical swaps with equivalent load?`,
      icon: 'swap-horizontal-outline',
    },
    {
      id: 'destravar',
      label: 'Break Plateau',
      prompt: 'Analyze my history and tell me how to break through plateaus on my main lifts.',
      icon: 'trending-up-outline',
    },
    {
      id: 'aquecimento',
      label: 'Warm-up Calculator',
      prompt: 'Calculate exact warm-up sets from my current working load without fatiguing my top sets.',
      icon: 'flame-outline',
    },
    {
      id: 'deload',
      label: 'Plan Deload',
      prompt: 'Based on my volume and ACWR fatigue score, when and how should I plan a deload?',
      icon: 'refresh-outline',
    },
    {
      id: 'falha',
      label: 'RPE vs Failure',
      prompt: 'Should I train to concentric failure on every set or stick to RPE 8-9?',
      icon: 'shield-outline',
    },
  ];
}

function suggestRoutineFromPrompt(question: string, isPt: boolean): SuggestedRoutinePlan | undefined {
  const lower = question.toLowerCase();
  const wantsRoutine =
    lower.includes('ficha') ||
    lower.includes('montar treino') ||
    lower.includes('criar treino') ||
    lower.includes('gerar treino') ||
    lower.includes('routine') ||
    lower.includes('build an optimized') ||
    lower.includes('workout plan') ||
    lower.includes('push') ||
    lower.includes('pull') ||
    lower.includes('legs') ||
    lower.includes('upper') ||
    lower.includes('lower') ||
    lower.includes('full body') ||
    lower.includes('divisão') ||
    lower.includes('divisao') ||
    lower.includes('express');

  if (!wantsRoutine) return undefined;

  if (lower.includes('pull') || lower.includes('costas') || lower.includes('back') || lower.includes('bíceps') || lower.includes('biceps')) {
    return {
      name: isPt ? 'Pull A — Costas & Bíceps (IA)' : 'Pull A — Back & Biceps (AI)',
      description: isPt
        ? 'Ficha gerada pelo AI Coach com foco em dorsal, densidade e controle excêntrico.'
        : 'AI Coach routine focusing on lats, upper-back thickness, and controlled eccentrics.',
      color: '#8B5CF6',
      exercises: [
        { exercise_name: 'Puxada Frontal (Pulldown)', muscle_group: 'Costas', target_sets: 4, rest_timer_seconds: 120 },
        { exercise_name: 'Remada Curvada com Barra', muscle_group: 'Costas', target_sets: 3, rest_timer_seconds: 150 },
        { exercise_name: 'Remada Baixa no Triângulo', muscle_group: 'Costas', target_sets: 3, rest_timer_seconds: 90 },
        { exercise_name: 'Face Pull na Polia', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 60 },
        { exercise_name: 'Rosca Direta com Barra W', muscle_group: 'Bíceps', target_sets: 3, rest_timer_seconds: 75 },
      ],
    };
  }

  if (lower.includes('leg') || lower.includes('perna') || lower.includes('lower') || lower.includes('inferior')) {
    return {
      name: isPt ? 'Lower A — Pernas Completo (IA)' : 'Lower A — Complete Legs (AI)',
      description: isPt
        ? 'Ficha gerada pelo AI Coach equilibrando quadríceps, posteriores e panturrilha.'
        : 'AI Coach routine balancing quads, hamstrings, glutes, and calves.',
      color: '#10B981',
      exercises: [
        { exercise_name: 'Agachamento Livre', muscle_group: 'Pernas', target_sets: 4, rest_timer_seconds: 180 },
        { exercise_name: 'Stiff com Barra', muscle_group: 'Posteriores', target_sets: 3, rest_timer_seconds: 150 },
        { exercise_name: 'Leg Press 45°', muscle_group: 'Pernas', target_sets: 3, rest_timer_seconds: 120 },
        { exercise_name: 'Cadeira Extensora', muscle_group: 'Pernas', target_sets: 3, rest_timer_seconds: 75 },
        { exercise_name: 'Panturrilha em Pé', muscle_group: 'Panturrilhas', target_sets: 4, rest_timer_seconds: 60 },
      ],
    };
  }

  if (lower.includes('full body') || lower.includes('corpo inteiro')) {
    return {
      name: isPt ? 'Full Body Força & Hipertrofia (IA)' : 'Full Body Strength & Hypertrophy (AI)',
      description: isPt
        ? 'Treino completo de alta eficiência gerado pelo AI Coach para 3x na semana.'
        : 'High-efficiency full-body split built by AI Coach for 3x/week.',
      color: '#F59E0B',
      exercises: [
        { exercise_name: 'Agachamento Livre', muscle_group: 'Pernas', target_sets: 3, rest_timer_seconds: 150 },
        { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: 3, rest_timer_seconds: 150 },
        { exercise_name: 'Puxada Frontal (Pulldown)', muscle_group: 'Costas', target_sets: 3, rest_timer_seconds: 120 },
        { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 90 },
        { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 60 },
      ],
    };
  }

  if (lower.includes('35') || lower.includes('rápid') || lower.includes('rapid') || lower.includes('express') || lower.includes('fast')) {
    return {
      name: isPt ? 'Upper Express 35min (IA)' : 'Upper Express 35min (AI)',
      description: isPt
        ? 'Treino enxuto de alta densidade gerado pelo AI Coach para dias com pouco tempo.'
        : 'Time-efficient upper body routine for busy gym days.',
      color: '#22D3EE',
      exercises: [
        { exercise_name: 'Supino Inclinado com Halteres', muscle_group: 'Peito', target_sets: 3, rest_timer_seconds: 90 },
        { exercise_name: 'Remada Baixa no Triângulo', muscle_group: 'Costas', target_sets: 3, rest_timer_seconds: 90 },
        { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 60 },
        { exercise_name: 'Tríceps Corda na Polia', muscle_group: 'Tríceps', target_sets: 2, rest_timer_seconds: 60 },
      ],
    };
  }

  return {
    name: isPt ? 'Push A — Peito, Ombros & Tríceps (IA)' : 'Push A — Chest, Shoulders & Triceps (AI)',
    description: isPt
      ? 'Ficha de hipertrofia gerada pelo AI Coach com compostos pesados e isoladores.'
      : 'Hypertrophy routine generated by AI Coach pairing heavy compounds and isolation work.',
    color: '#8B5CF6',
    exercises: [
      { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: 4, rest_timer_seconds: 150 },
      { exercise_name: 'Supino Inclinado com Halteres', muscle_group: 'Peito', target_sets: 3, rest_timer_seconds: 120 },
      { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 120 },
      { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 4, rest_timer_seconds: 60 },
      { exercise_name: 'Tríceps Corda na Polia', muscle_group: 'Tríceps', target_sets: 3, rest_timer_seconds: 60 },
    ],
  };
}

function getSmartFallbackAnswer(
  q: string,
  language: string,
  formatWeight: (kg: number) => string,
  tExercise: (name: string) => string,
  localAnalysis?: AiCoachAnalysis | null,
  suggestedRoutine?: SuggestedRoutinePlan,
  focusExercise?: string
): { answer: string; takeaways: string[] } {
  const isPt = language === 'pt';
  const lower = q.toLowerCase();
  const topExercise = localAnalysis?.topProgressions?.[0];
  const topPlateau = localAnalysis?.detectedPlateaus?.[0];
  const acwr = localAnalysis?.acwr;

  if (suggestedRoutine) {
    if (!isPt) {
      return {
        answer:
          `I built "${suggestedRoutine.name}" with ${suggestedRoutine.exercises.length} exercises balancing main compounds (${tExercise(suggestedRoutine.exercises[0].exercise_name)}) and accessory finishers.\n\n` +
          'Tap "Save Routine to My App" below to add it directly to your Workout tab with calibrated rest timers.',
        takeaways: [
          `${suggestedRoutine.exercises.length} exercises ready with preset rest timers`,
          'Aim for RPE 8-9 on working sets with 2-3s eccentric control',
          'Tap "Save Routine to My App" to store it directly on your device',
        ],
      };
    }

    return {
      answer:
        `Montei a ficha "${suggestedRoutine.name}" com ${suggestedRoutine.exercises.length} exercícios equilibrando compostos principais (${suggestedRoutine.exercises[0].exercise_name}) e isoladores de acabamento.\n\n` +
        'Clique no botão "Salvar Ficha no Meu App" abaixo para adicioná-la direto à sua aba Treino e já começar com tempos de descanso configurados.',
      takeaways: [
        `${suggestedRoutine.exercises.length} exercícios prontos com descanso calibrado`,
        'Mantenha RPE 8-9 nas séries válidas com 2-3s na descida excêntrica',
        'Toque em "Salvar Ficha no Meu App" para gravar direto no seu celular',
      ],
    };
  }

  if (lower.includes('substitu') || lower.includes('ocupad') || lower.includes('trocar') || lower.includes('swap') || lower.includes('occupied')) {
    const rawTarget = focusExercise || topExercise?.exerciseName;
    const refName = rawTarget ? tExercise(rawTarget) : '';
    if (!isPt) {
      const targetText = refName ? ` for ${refName}` : '';
      return {
        answer:
          `If your station is occupied right now${targetText}, switch without losing the biomechanical stimulus:\n` +
          '• Barbell / Machine Bench → Dumbbell Press (~80% total weight split across hands) or Weighted Dips.\n' +
          '• Lat Pulldown / Machine Row → Assisted Pull-Ups or Barbell / Single-Arm Dumbbell Rows.\n' +
          '• Leg Press → Bulgarian Split Squats or Hack / Barbell Back Squat.',
        takeaways: [
          'Start around ~80% equivalent weight when moving from barbell/machine to dumbbells',
          'Keep the exact target rep range and RPE 8-9 from your plan',
          'Preserve rest periods: 2-3min compounds, 60-90s isolation',
        ],
      };
    }

    const ptTarget = refName ? ` para ${refName}` : '';
    return {
      answer:
        `Se a máquina ou banco estiver ocupado hoje${ptTarget}, troque sem perder o padrão biomecânico:\n` +
        '• Supino barra/máquina → Supino com Halteres (~80% da carga total dividida) ou Paralelas.\n' +
        '• Puxada/Remada máquina → Barra Fixa assistida ou Remada Curvada/Serrote.\n' +
        '• Leg Press → Agachamento Búlgaro ou Hack/Agachamento Livre.',
      takeaways: [
        'Use ~80% da carga equivalente na primeira série ao trocar barra por halteres',
        'Mantenha a mesma faixa de repetições e RPE 8-9 da ficha original',
        'Preserve o descanso: 2-3min nos compostos e 60-90s nos isoladores',
      ],
    };
  }

  if (lower.includes('aqueciment') || lower.includes('queimar') || lower.includes('warm-up') || lower.includes('warmup') || lower.includes('warm up')) {
    if (topExercise && topExercise.currentTopWeight > 0) {
      const w = topExercise.currentTopWeight;
      const w50 = Math.max(2, Math.round((w * 0.5) / 2) * 2);
      const w70 = Math.max(2, Math.round((w * 0.7) / 2) * 2);
      const w85 = Math.max(2, Math.round((w * 0.85) / 2) * 2);
      const exLabel = tExercise(topExercise.exerciseName);

      if (!isPt) {
        return {
          answer:
            `Based on your current working set on ${exLabel} (${formatWeight(w)} × ${topExercise.currentTopReps} reps), ramp up without fatigue:\n` +
            `1) ${formatWeight(w50)} × 5 reps (50%)  •  2) ${formatWeight(w70)} × 3 reps (70%)  •  3) ${formatWeight(w85)} × 1 rep (85%).\n\n` +
            `Rest 2 minutes after priming and hit your working set at ${formatWeight(w)} fresh.`,
          takeaways: [
            `Exact ramp for ${formatWeight(w)}: ${formatWeight(w50)} × 5 → ${formatWeight(w70)} × 3 → ${formatWeight(w85)} × 1`,
            'Zero failure during warm-up: save glycogen for working sets',
            'Rest 2 minutes before starting your first heavy set',
          ],
        };
      }

      return {
        answer:
          `Com base na sua carga real em ${exLabel} (${formatWeight(w)} × ${topExercise.currentTopReps} reps), faça uma aproximação sem fadiga:\n` +
          `1) ${formatWeight(w50)} × 5 reps (50%)  •  2) ${formatWeight(w70)} × 3 reps (70%)  •  3) ${formatWeight(w85)} × 1 rep (85%).\n\n` +
          `Descanse 2 minutos após a ativação e inicie sua série válida em ${formatWeight(w)} com força neural máxima.`,
        takeaways: [
          `Progressão exata para ${formatWeight(w)}: ${formatWeight(w50)} × 5 → ${formatWeight(w70)} × 3 → ${formatWeight(w85)} × 1`,
          'Zero falha no aquecimento: preserve glicogênio para as séries válidas',
          'Descanse 2 minutos antes da primeira série principal',
        ],
      };
    }

    if (!isPt) {
      return {
        answer:
          'Perform 2-3 short ramp-up sets without fatigue: 50% load × 5 reps, 70% × 3 reps, and 85% × 1 neural primer rep. Rest 2 minutes and start your top set.',
        takeaways: [
          'Progressive ramp (50% × 5, 70% × 3, 85% × 1)',
          'Zero failure: prime your nervous system without burning out',
          'Rest 2 minutes before your first heavy working set',
        ],
      };
    }

    return {
      answer:
        'Faça 2 a 3 séries curtas de aproximação sem fadiga: 50% da carga para 5 reps, 70% para 3 reps e 85% para 1 repetição de ativação. Descanse 2 minutos e inicie sua série principal com força total.',
      takeaways: [
        'Aproximação progressiva (50% × 5, 70% × 3, 85% × 1)',
        'Zero fadiga: as séries servem apenas para ativar o sistema nervoso',
        'Descanse 2 minutos antes da primeira série pesada de trabalho',
      ],
    };
  }

  if (lower.includes('deload') || lower.includes('recupera') || lower.includes('acwr') || lower.includes('fadig') || lower.includes('fatigue')) {
    if (!isPt) {
      const acwrPrefix =
        acwr && acwr.riskLevel !== 'INSUFFICIENT_DATA'
          ? `Your current ACWR score is ${acwr.ratio.toFixed(2)} (${acwr.riskLevel}). `
          : '';
      return {
        answer:
          `${acwrPrefix}If ACWR rises above 1.5 or you stall for 3 consecutive sessions, schedule a simple 1-week deload: keep weights challenging, but trim 1 working set per exercise (or cut ~20% weekly volume).\n\n` +
          'This clears joint and CNS fatigue without losing muscle or strength.',
        takeaways: [
          acwr && acwr.riskLevel !== 'INSUFFICIENT_DATA'
            ? `ACWR ${acwr.ratio.toFixed(2)} — ${acwr.recommendation}`
            : 'Drop 1 working set per lift for 5-7 days',
          'Keep bar weight steady to preserve strength adaptations',
          'Prioritize 2-3min rests and strict form',
        ],
      };
    }

    const acwrPrefix =
      acwr && acwr.riskLevel !== 'INSUFFICIENT_DATA'
        ? `Seu índice ACWR atual está em ${acwr.ratio.toFixed(2)} (${acwr.riskLevel === 'DANGER_ZONE' ? 'Zona de Perigo' : acwr.riskLevel === 'OPTIMAL' ? 'Sweet Spot Ótimo' : acwr.riskLevel}). `
        : '';
    return {
      answer:
        `${acwrPrefix}Se o ACWR passar de 1.5 ou você estagnar por 3 sessões seguidas, aplique um deload simples de 1 semana: mantenha os pesos principais, mas corte 1 série por exercício (ou reduza 20% do volume semanal).\n\n` +
        'Isso dissipa fadiga articular e do sistema nervoso sem perda de massa muscular.',
      takeaways: [
        acwr && acwr.riskLevel !== 'INSUFFICIENT_DATA' ? `ACWR atual: ${acwr.ratio.toFixed(2)} — ${acwr.recommendation}` : 'Reduza 1 série por exercício durante 5 a 7 dias',
        'Mantenha os pesos para preservar o estímulo de força',
        'Priorize 2 a 3 minutos de descanso e qualidade técnica',
      ],
    };
  }

  if (lower.includes('platô') || lower.includes('plato') || lower.includes('destrav') || lower.includes('plateau') || lower.includes('break')) {
    if (topPlateau) {
      const platName = tExercise(topPlateau.exerciseName);
      if (!isPt) {
        return {
          answer:
            `Plateau detected on ${platName}: ${topPlateau.consecutiveStagnantSessions} stalled sessions at ${formatWeight(topPlateau.currentWeight)} × ${topPlateau.currentReps} reps (avg RPE ${topPlateau.averageRpe}).\n\n` +
            'Target +1 rep on set 1 or apply a 5-10% micro-reset focusing on 2-3s eccentric control.',
          takeaways: [
            `Priority target: ${platName} (${formatWeight(topPlateau.currentWeight)} × ${topPlateau.currentReps})`,
            'Chase +1 rep on set 1 or a small micro-load bump',
            'Keep 2-3s eccentric tempo and 2-3min rest',
          ],
        };
      }
      return {
        answer:
          `Detectei platô em ${platName}: ${topPlateau.consecutiveStagnantSessions} sessões estagnadas em ${formatWeight(topPlateau.currentWeight)} × ${topPlateau.currentReps} reps (RPE médio ${topPlateau.averageRpe}).\n\n` +
          `Recomendação imediata: ${topPlateau.suggestedAction}`,
        takeaways: [
          `Alvo prioritário: ${platName} (${formatWeight(topPlateau.currentWeight)} × ${topPlateau.currentReps})`,
          'Tente +1 repetição na 1ª série ou micro-carga de +1kg a +2kg',
          'Cadência controlada de 2-3s na descida e 2-3min de descanso',
        ],
      };
    }

    if (topExercise) {
      const topName = tExercise(topExercise.exerciseName);
      if (!isPt) {
        return {
          answer:
            `No critical plateaus detected! Your standout lift is ${topName} with est. 1RM of ${formatWeight(topExercise.current1Rm)} (${formatWeight(topExercise.currentTopWeight)} × ${topExercise.currentTopReps} reps).\n\n` +
            'Keep progressing smoothly by chasing +1 rep on set 1 or adding a small micro-load while holding a controlled 2-3s eccentric.',
          takeaways: [
            `Top progression: ${topName} (est. 1RM ~${formatWeight(topExercise.current1Rm)})`,
            'Simple overload: +1 rep or small weight increment each block',
            'Rest 2-3min on compounds, 60-90s on isolation',
          ],
        };
      }
      return {
        answer:
          `Sem platôs críticos ativos! Seu destaque atual é ${topName} com 1RM estimado de ${formatWeight(topExercise.current1Rm)} (${formatWeight(topExercise.currentTopWeight)} × ${topExercise.currentTopReps} reps).\n\n` +
          'Para continuar progredindo sem estagnar, busque +1 repetição na primeira série ou adicione micro-carga mantendo 2 a 3 segundos na descida excêntrica.',
        takeaways: [
          `Exercício de destaque: ${topName} (1RM ~${formatWeight(topExercise.current1Rm)})`,
          'Sobrecarga simples: +1 repetição ou micro-carga progressiva',
          'Descanso: 2-3min para compostos e 60-90s para isoladores',
        ],
      };
    }
  }

  if (lower.includes('falha') || lower.includes('rpe') || lower.includes('rir') || lower.includes('failure')) {
    if (!isPt) {
      return {
        answer:
          'Avoid going to concentric failure on every set so recovery keeps pace. Stick to RPE 8-9 (1-2 reps in reserve) on most sets, saving true failure only for the last set of safe isolation movements.',
        takeaways: [
          'Keep working sets at RPE 8-9 (1-2 reps in reserve)',
          'Reserve true failure for the final set of isolation exercises',
          'Stop 1-2 reps shy on heavy squats/bench/deadlifts for joint safety',
        ],
      };
    }
    return {
      answer:
        'Evite ir até a falha concêntrica em todas as séries para não sobrecarregar a recuperação. Mantenha RPE entre 8 e 9 (parando com 1 a 2 repetições na reserva), reservando a falha somente para a última série de isoladores.',
      takeaways: [
        'Séries de trabalho em RPE 8-9 (1 a 2 reps na reserva)',
        'Guarde a falha total apenas para a última série de isoladores',
        'Em compostos pesados, pare antes da falha para segurança técnica',
      ],
    };
  }

  const standardFallback = getLocalAiCoachChatFallback(
    focusExercise || topExercise?.exerciseName,
    language
  );
  return {
    answer: standardFallback.answer,
    takeaways: standardFallback.keyTakeaways,
  };
}

function getAcwrBadgeMeta(riskLevel: string, colors: any, isPt: boolean) {
  switch (riskLevel) {
    case 'OPTIMAL':
      return { label: isPt ? 'Sweet Spot Ótimo' : 'Optimal Sweet Spot', color: colors.success, bg: colors.successLight };
    case 'OVERREACHING':
      return { label: isPt ? 'Sobrecarga Alta' : 'Overreaching', color: colors.streak, bg: colors.streakLight };
    case 'DANGER_ZONE':
      return { label: isPt ? 'Zona de Perigo' : 'Danger Zone', color: colors.danger, bg: colors.dangerLight };
    case 'UNDER_TRAINING':
      return { label: isPt ? 'Sub-estímulo' : 'Under-training', color: colors.water, bg: colors.waterLight };
    default:
      return { label: isPt ? 'Coletando Dados' : 'Collecting Data', color: colors.textSecondary, bg: colors.surfaceElevated };
  }
}

export const AiCoachModal: React.FC<AiCoachModalProps> = ({
  visible,
  onClose,
  initialExerciseName,
}) => {
  const { colors, isDark } = useTheme();
  const { language, unit, formatWeight, tExercise } = useTranslation();
  const {
    isPro,
    freeAiUsesRemaining,
    canUseAiCoach,
    consumeFreeAiUse,
    openPaywall,
  } = useSubscription();

  const isPt = language === 'pt';
  const styles = makeStyles(colors, isDark);
  const scrollViewRef = useRef<ScrollView>(null);
  const isDevMode = typeof __DEV__ !== 'undefined' && __DEV__;
  const quickChips = getQuickPromptChips(isPt, initialExerciseName);

  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');

  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AiCoachAnalysis | null>(null);

  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState<boolean>(false);
  const [savingRoutineIdx, setSavingRoutineIdx] = useState<number | null>(null);

  const disclaimerText = isPt
    ? 'Orientação informativa baseada em cálculos matemáticos de volume e 1RM. Não substitui avaliação médica ou de profissional de Educação Física.'
    : 'Informational guidance based on volume & 1RM math. Does not replace medical or certified trainer advice.';

  useEffect(() => {
    AsyncStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setChatHistory(parsed);
          }
        }
      })
      .catch(() => {})
      .finally(() => setHistoryHydrated(true));
  }, []);

  useEffect(() => {
    if (!historyHydrated) return;
    AsyncStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatHistory.slice(-20))).catch(() => {});
  }, [chatHistory, historyHydrated]);

  useEffect(() => {
    if (visible) {
      getBackendBaseUrl().then((url) => {
        setBackendUrl(url);
        setUrlInput(url);
        checkBackendHealth().then((status) => setBackendOnline(status.online));
      });
    }
  }, [visible]);

  useEffect(() => {
    if (activeTab === 'chat' && (chatHistory.length > 0 || chatLoading)) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatHistory, chatLoading, activeTab]);

  const handleOpenPaywallFromModal = () => {
    onClose();
    setTimeout(() => openPaywall('ai_coach'), 250);
  };

  const handleTestConnection = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const res = await checkBackendHealth();
    setBackendOnline(res.online);
    Alert.alert(
      res.online ? (isPt ? 'Conexão Estabelecida' : 'Connected') : (isPt ? 'Servidor Inacessível' : 'Server Unreachable'),
      res.online
        ? isPt
          ? 'A API Spring Boot + PostgreSQL está online e pronta para processar análises!'
          : 'Spring Boot + PostgreSQL API is online!'
        : `Could not reach ${backendUrl}.`
    );
  };

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    await setBackendBaseUrl(urlInput.trim());
    setBackendUrl(urlInput.trim());
    setShowConfig(false);
    const res = await checkBackendHealth();
    setBackendOnline(res.online);
  };

  const handleClearChat = () => {
    Alert.alert(
      isPt ? 'Limpar Conversa' : 'Clear Conversation',
      isPt
        ? 'Deseja apagar o histórico de mensagens com o AI Coach?'
        : 'Clear your saved AI Coach chat messages?',
      [
        { text: isPt ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: isPt ? 'Limpar' : 'Clear',
          style: 'destructive',
          onPress: async () => {
            setChatHistory([]);
            await AsyncStorage.removeItem(CHAT_HISTORY_STORAGE_KEY).catch(() => {});
          },
        },
      ]
    );
  };

  const handleSaveSuggestedRoutine = async (idx: number, plan: SuggestedRoutinePlan) => {
    if (savingRoutineIdx !== null) return;
    setSavingRoutineIdx(idx);
    try {
      await createRoutine({
        name: plan.name,
        description: plan.description,
        color: plan.color,
        exercises: plan.exercises.map((ex, orderIdx) => ({
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
          target_sets: ex.target_sets,
          rest_timer_seconds: ex.rest_timer_seconds,
          order_index: orderIdx,
        })),
      });

      setChatHistory((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, routineSaved: true } : item))
      );

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      Alert.alert(
        isPt ? 'Ficha Salva!' : 'Routine Saved!',
        isPt
          ? `"${plan.name}" foi adicionada à sua aba Treino com ${plan.exercises.length} exercícios prontos.`
          : `"${plan.name}" was added to your Workout tab with ${plan.exercises.length} exercises.`
      );
    } catch (err: any) {
      Alert.alert(isPt ? 'Erro ao Salvar' : 'Save Error', err?.message || 'Could not save routine.');
    } finally {
      setSavingRoutineIdx(null);
    }
  };

  const buildAthleteContextAndLocalAnalysis = async () => {
    const [workouts, routines, latestBw, recentHabits] = await Promise.all([
      getAllWorkoutsWithDetails(),
      getRoutines(),
      getLatestBodyweight(),
      getDailyHabitsSince(daysAgoLocalIso(7)),
    ]);

    const localAnalysis = analyzeLocalWorkoutsProgress(workouts, language, unit);
    const routineSummary =
      routines.length > 0
        ? routines.slice(0, 4).map((r) => `${r.name} (${r.exercises.length} ex)`).join(', ')
        : 'None';
    const bwText = latestBw ? formatWeight(latestBw.weight_kg) : 'Not logged';
    const streak = recentHabits.length > 0 ? recentHabits[0].streak_count : 0;
    const avgProtein =
      recentHabits.length > 0
        ? Math.round(recentHabits.reduce((s, h) => s + (h.protein_current_g || 0), 0) / recentHabits.length)
        : 0;
    const acwrText = localAnalysis.acwr
      ? `${localAnalysis.acwr.ratio} (${localAnalysis.acwr.riskLevel})`
      : 'N/A';

    const athleteContext = `Routines: [${routineSummary}] | Bodyweight: ${bwText} | Streak: ${streak}d | Avg Protein: ${avgProtein}g | ACWR: ${acwrText}`;
    return { localAnalysis, athleteContext, workouts };
  };

  const handleRunAnalysis = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setLoadingAnalysis(true);
    try {
      const localWorkouts = await getAllWorkoutsWithDetails();
      if (localWorkouts.length === 0) {
        Alert.alert(
          isPt ? 'Sem Treinos' : 'No Workouts Yet',
          isPt
            ? 'Você ainda não concluiu nenhum treino para o AI Coach analisar.'
            : 'Log at least one workout so the AI Coach can analyze your progression.'
        );
        setLoadingAnalysis(false);
        return;
      }
      if (backendOnline) {
        await syncLocalWorkoutsToSpringBackend(localWorkouts);
      }
      const data = await fetchAiCoachAnalysis(language, unit);
      setAnalysis(data);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (err: any) {
      try {
        const localWorkouts = await getAllWorkoutsWithDetails();
        const localAnalysis = analyzeLocalWorkoutsProgress(localWorkouts, language, unit);
        setAnalysis(localAnalysis);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } catch {
        Alert.alert(isPt ? 'Erro na Análise' : 'Analysis Error', err?.message || 'Analysis failed.');
      }
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSendQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? chatQuestion).trim();
    if (!q || chatLoading) return;

    if (!canUseAiCoach) {
      handleOpenPaywallFromModal();
      return;
    }

    setChatQuestion('');
    setChatLoading(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const suggestedRoutine = suggestRoutineFromPrompt(q, isPt);
    let localCtx: Awaited<ReturnType<typeof buildAthleteContextAndLocalAnalysis>> | null = null;

    try {
      localCtx = await buildAthleteContextAndLocalAnalysis();

      const historyPayload: ChatMessagePayload[] = chatHistory
        .slice(-3)
        .flatMap((h) => [
          { role: 'user' as const, text: h.q },
          { role: 'coach' as const, text: h.a },
        ]);

      const exerciseContext =
        initialExerciseName || localCtx.localAnalysis.topProgressions?.[0]?.exerciseName;

      const res: AiCoachChatResponse = await sendAiCoachQuestion(
        q,
        exerciseContext,
        historyPayload,
        localCtx.athleteContext,
        language,
        unit
      );

      await consumeFreeAiUse();
      setChatHistory((prev) => [
        ...prev,
        {
          q,
          a: res.answer,
          takeaways: res.keyTakeaways,
          suggestedRoutine,
        },
      ]);
    } catch {
      const fallback = getSmartFallbackAnswer(
        q,
        language,
        formatWeight,
        tExercise,
        localCtx?.localAnalysis,
        suggestedRoutine,
        initialExerciseName
      );
      await consumeFreeAiUse();
      setChatHistory((prev) => [
        ...prev,
        {
          q,
          a: fallback.answer,
          takeaways: fallback.takeaways,
          suggestedRoutine,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChipPress = (prompt: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    handleSendQuestion(prompt);
  };

  const acwrBadge = analysis?.acwr ? getAcwrBadgeMeta(analysis.acwr.riskLevel, colors, isPt) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Compacto de Produto */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="sparkles" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>AI Coach</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {initialExerciseName
                  ? `${tExercise(initialExerciseName)}`
                  : isPt
                  ? 'Consultoria 360° & motor preditivo'
                  : '360° coaching & predictive load engine'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {!isPro && (
              <TouchableOpacity
                onPress={handleOpenPaywallFromModal}
                style={styles.trialPill}
                activeOpacity={0.8}
              >
                <Text style={styles.trialPillText}>
                  {isPt ? `${freeAiUsesRemaining} grátis` : `${freeAiUsesRemaining} free`}
                </Text>
              </TouchableOpacity>
            )}

            {isDevMode ? (
              <TouchableOpacity
                onPress={() => setShowConfig((prev) => !prev)}
                style={styles.statusPill}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: backendOnline ? colors.success : '#F59E0B' },
                  ]}
                />
                <Text style={styles.statusPillText}>{backendOnline ? 'Cloud' : 'Local'}</Text>
                <Ionicons name="options-outline" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: backendOnline ? colors.success : colors.primary },
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {backendOnline ? (isPt ? 'IA Online' : 'AI Online') : (isPt ? 'Local' : 'Local')}
                </Text>
              </View>
            )}

            {activeTab === 'chat' && chatHistory.length > 0 && (
              <TouchableOpacity
                onPress={handleClearChat}
                style={styles.closeBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Barra retrátil de configuração do servidor (apenas DEV) */}
        {isDevMode && showConfig && (
          <View style={styles.configDrawer}>
            <Text style={styles.configDrawerTitle}>Configuração da API Spring Boot</Text>
            <View style={styles.configInputRow}>
              <TextInput
                style={styles.configInput}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://sua-api.onrender.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={handleSaveUrl} style={styles.configSaveBtn} activeOpacity={0.8}>
                <Text style={styles.configSaveBtnText}>Salvar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTestConnection} style={styles.configTestBtn} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Segmented Control de Abas */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('chat');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={16}
              color={activeTab === 'chat' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
              {isPt ? 'Assistente' : 'Assistant'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'analysis' && styles.tabItemActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('analysis');
              if (!analysis) {
                handleRunAnalysis();
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'analysis' ? 'analytics' : 'analytics-outline'}
              size={16}
              color={activeTab === 'analysis' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'analysis' && styles.tabTextActive]}>
              {isPt ? 'Diagnóstico 1RM' : '1RM Diagnostics'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo da Aba 1: Chat Nativo em Tela Cheia */}
        {activeTab === 'chat' ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {chatHistory.length === 0 ? (
                <View style={styles.emptyChatContainer}>
                  <View style={styles.emptyChatIconCircle}>
                    <Ionicons name="sparkles-outline" size={30} color={colors.primary} />
                  </View>
                  <Text style={styles.emptyChatTitle}>
                    {isPt ? 'Como posso otimizar seu treino hoje?' : 'How can I optimize your workout today?'}
                  </Text>
                  <Text style={styles.emptyChatSub}>
                    {isPt
                      ? 'Monte fichas em 1 toque, substitua máquinas ocupadas ou calcule aquecimentos com suas cargas reais.'
                      : 'Build routines in 1 tap, swap busy stations, or calculate warm-ups from your actual lifts.'}
                  </Text>

                  <View style={styles.emptyGridContainer}>
                    {quickChips.map((chip) => (
                      <TouchableOpacity
                        key={chip.id}
                        style={styles.emptyGridCard}
                        onPress={() => handleChipPress(chip.prompt)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={chip.icon} size={18} color={colors.primary} style={{ marginBottom: 4 }} />
                        <Text style={styles.emptyGridCardText}>{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                chatHistory.map((item, idx) => (
                  <View key={idx} style={styles.bubbleRow}>
                    {/* Mensagem do Usuário */}
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{item.q}</Text>
                    </View>

                    {/* Resposta do Coach */}
                    <View style={styles.aiBubble}>
                      <View style={styles.aiBubbleHeader}>
                        <Ionicons name="sparkles" size={13} color={colors.primary} />
                        <Text style={styles.aiBubbleAuthor}>FocusLift Coach</Text>
                      </View>
                      <Text style={styles.aiBubbleText}>{item.a}</Text>

                      {item.suggestedRoutine && (
                        <View style={styles.routineCardBox}>
                          <View style={styles.routineCardHeader}>
                            <Ionicons name="barbell-outline" size={15} color={colors.primary} />
                            <Text style={styles.routineCardTitle}>{item.suggestedRoutine.name}</Text>
                          </View>
                          <View style={styles.routineExerciseList}>
                            {item.suggestedRoutine.exercises.map((ex, eIdx) => (
                              <Text key={eIdx} style={styles.routineExerciseLine}>
                                • {tExercise(ex.exercise_name)} — {ex.target_sets} {isPt ? 'séries' : 'sets'} ({ex.rest_timer_seconds}s)
                              </Text>
                            ))}
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.saveRoutineBtn,
                              item.routineSaved && styles.saveRoutineBtnSaved,
                            ]}
                            onPress={() => !item.routineSaved && handleSaveSuggestedRoutine(idx, item.suggestedRoutine!)}
                            disabled={item.routineSaved || savingRoutineIdx === idx}
                            activeOpacity={0.85}
                          >
                            {savingRoutineIdx === idx ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons
                                  name={item.routineSaved ? 'checkmark-circle' : 'add-circle-outline'}
                                  size={16}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.saveRoutineBtnText}>
                                  {item.routineSaved
                                    ? isPt ? 'Ficha Salva!' : 'Routine Saved!'
                                    : isPt ? 'Salvar Ficha no Meu App' : 'Save Routine to My App'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {item.takeaways && item.takeaways.length > 0 && (
                        <View style={styles.takeawaysBox}>
                          {item.takeaways.map((t, tIdx) => (
                            <View key={tIdx} style={styles.takeawayRow}>
                              <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginTop: 2 }} />
                              <Text style={styles.takeawayText}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}

              {chatLoading && (
                <View style={styles.aiLoadingBubble}>
                  <View style={styles.aiBubbleHeader}>
                    <Ionicons name="sparkles" size={13} color={colors.primary} />
                    <Text style={styles.aiBubbleAuthor}>FocusLift Coach</Text>
                  </View>
                  <View style={styles.loadingInnerRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingInnerText}>
                      {isPt ? 'Analisando histórico, ACWR e biomecânica...' : 'Analyzing history, ACWR & biomechanics...'}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.disclaimerText}>{disclaimerText}</Text>
            </ScrollView>

            {/* Chips Rápidos Horizontais (quando já há mensagens) */}
            {chatHistory.length > 0 && (
              <View style={styles.horizontalChipsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChipsScroll}>
                  {quickChips.map((chip) => (
                    <TouchableOpacity
                      key={chip.id}
                      style={styles.chipPill}
                      onPress={() => handleChipPress(chip.prompt)}
                      disabled={chatLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={chip.icon} size={13} color={colors.textSecondary} />
                      <Text style={styles.chipPillText}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Rodapé Fixo de Input */}
            <View style={styles.chatFooter}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.chatInput}
                  value={chatQuestion}
                  onChangeText={setChatQuestion}
                  placeholder={
                    isPt
                      ? 'Peça uma ficha, troca de exercício ou carga...'
                      : 'Ask for a routine, exercise swap, or load tip...'
                  }
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={400}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!chatQuestion.trim() || chatLoading) && styles.sendBtnDisabled]}
                  onPress={() => handleSendQuestion()}
                  disabled={!chatQuestion.trim() || chatLoading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* Conteúdo da Aba 2: Dashboard Analítico */
          <ScrollView style={styles.analysisScroll} contentContainerStyle={styles.analysisScrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={handleRunAnalysis}
              disabled={loadingAnalysis}
              activeOpacity={0.85}
            >
              {loadingAnalysis ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>
                    {analysis
                      ? isPt ? 'Atualizar Diagnóstico' : 'Refresh Diagnostics'
                      : isPt ? 'Gerar Diagnóstico da Minha Evolução' : 'Generate Progress Diagnostics'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {analysis && (
              <View style={styles.analysisResults}>
                {/* Card Volume Semanal */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
                      <Text style={styles.metricCardTitle}>
                        {isPt ? 'Volume Semanal (Tonnage)' : 'Weekly Volume (Tonnage)'}
                      </Text>
                    </View>
                    <View style={styles.deltaBadge}>
                      <Text style={[styles.deltaBadgeText, { color: analysis.volumeDeltaPercent >= 3 ? colors.success : colors.textPrimary }]}>
                        {analysis.volumeDeltaPercent > 0 ? '+' : ''}{analysis.volumeDeltaPercent}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.volumeNumbersRow}>
                    <View style={styles.volumeBox}>
                      <Text style={styles.volumeBoxLabel}>{isPt ? 'Semana Atual' : 'This Week'}</Text>
                      <Text style={styles.volumeBoxValue}>{formatWeight(analysis.currentWeekVolumeKg)}</Text>
                    </View>
                    <View style={styles.volumeBoxDivider} />
                    <View style={styles.volumeBox}>
                      <Text style={styles.volumeBoxLabel}>{isPt ? 'Semana Anterior' : 'Last Week'}</Text>
                      <Text style={styles.volumeBoxValue}>{formatWeight(analysis.previousWeekVolumeKg)}</Text>
                    </View>
                  </View>
                </View>

                {/* Card Índice de Fadiga & Risco de Lesão (ACWR) */}
                {analysis.acwr && acwrBadge && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={styles.metricTitleGroup}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={acwrBadge.color} />
                        <Text style={styles.metricCardTitle}>
                          {isPt ? 'Índice de Fadiga & Lesão (ACWR)' : 'Fatigue & Injury Ratio (ACWR)'}
                        </Text>
                      </View>
                      <View style={[styles.deltaBadge, { backgroundColor: acwrBadge.bg, borderColor: acwrBadge.color }]}>
                        <Text style={[styles.deltaBadgeText, { color: acwrBadge.color }]}>
                          {acwrBadge.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.volumeNumbersRow}>
                      <View style={styles.volumeBox}>
                        <Text style={styles.volumeBoxLabel}>{isPt ? 'Carga Aguda (7d)' : 'Acute (7d)'}</Text>
                        <Text style={styles.volumeBoxValue}>{formatWeight(analysis.acwr.acuteVolumeKg)}</Text>
                      </View>
                      <View style={styles.volumeBoxDivider} />
                      <View style={styles.volumeBox}>
                        <Text style={styles.volumeBoxLabel}>{isPt ? 'Média Crônica (28d)' : 'Chronic Avg (28d)'}</Text>
                        <Text style={styles.volumeBoxValue}>{formatWeight(analysis.acwr.chronicWeeklyVolumeKg)}</Text>
                      </View>
                      <View style={styles.volumeBoxDivider} />
                      <View style={styles.volumeBox}>
                        <Text style={styles.volumeBoxLabel}>ACWR</Text>
                        <Text style={[styles.volumeBoxValue, { color: acwrBadge.color }]}>
                          {analysis.acwr.riskLevel === 'INSUFFICIENT_DATA' ? '—' : analysis.acwr.ratio.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.acwrInterpretation}>{analysis.acwr.interpretation}</Text>
                    <View style={styles.plateauActionBox}>
                      <Text style={styles.plateauActionLabel}>
                        {isPt ? 'Conduta Recomendada:' : 'Recommended Action:'}
                      </Text>
                      <Text style={styles.plateauActionText}>{analysis.acwr.recommendation}</Text>
                    </View>
                  </View>
                )}

                {/* Card Top Progressões */}
                {analysis.topProgressions && analysis.topProgressions.length > 0 && (
                  <View style={styles.metricCard}>
                    <View style={styles.metricCardHeader}>
                      <View style={styles.metricTitleGroup}>
                        <Ionicons name="trophy-outline" size={16} color={colors.streak} />
                        <Text style={styles.metricCardTitle}>
                          {isPt ? 'Evoluções de Força (1RM Brzycki)' : 'Strength Gains (Brzycki 1RM)'}
                        </Text>
                      </View>
                    </View>
                    {analysis.topProgressions.map((p, idx) => (
                      <View key={p.exerciseName || idx} style={styles.progressionItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.progressionExerciseName} numberOfLines={1}>
                            {tExercise(p.exerciseName)}
                          </Text>
                          <Text style={styles.progressionSetDetail}>
                            {isPt ? 'Melhor série:' : 'Top set:'} {formatWeight(p.currentTopWeight)} × {p.currentTopReps} reps
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.progression1RMText}>1RM ~{formatWeight(p.current1Rm)}</Text>
                          {p.delta1RmKg > 0 && (
                            <Text style={styles.progressionDeltaText}>
                              +{formatWeight(p.delta1RmKg)} (+{p.delta1RmPercent}%)
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Card Platôs */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons
                        name={analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? colors.danger : colors.success}
                      />
                      <Text style={styles.metricCardTitle}>
                        {isPt ? 'Detecção de Platôs' : 'Plateau Detection'}
                      </Text>
                    </View>
                  </View>
                  {analysis.detectedPlateaus && analysis.detectedPlateaus.length > 0 ? (
                    analysis.detectedPlateaus.map((plat, idx) => (
                      <View key={plat.exerciseName || idx} style={styles.plateauBox}>
                        <Text style={styles.plateauExerciseTitle}>
                          {tExercise(plat.exerciseName)} {plat.routineTitle ? `(${plat.routineTitle})` : ''}
                        </Text>
                        <Text style={styles.plateauDesc}>
                          {isPt
                            ? `Estagnado há ${plat.consecutiveStagnantSessions} sessões em ${formatWeight(plat.currentWeight)} × ${plat.currentReps} reps (RPE médio ${plat.averageRpe})`
                            : `Stalled for ${plat.consecutiveStagnantSessions} sessions at ${formatWeight(plat.currentWeight)} × ${plat.currentReps} reps (avg RPE ${plat.averageRpe})`}
                        </Text>
                        <View style={styles.plateauActionBox}>
                          <Text style={styles.plateauActionLabel}>
                            {isPt ? 'Ação Recomendada:' : 'Recommended Action:'}
                          </Text>
                          <Text style={styles.plateauActionText}>{plat.suggestedAction}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.cleanStatusBox}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.cleanStatusText}>
                        {isPt
                          ? 'Nenhum platô detectado. Suas cargas continuam progredindo de forma consistente.'
                          : 'No plateaus detected. Your lifts are progressing steadily.'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Parecer do Coach */}
                <View style={[styles.metricCard, styles.aiSummaryCard]}>
                  <View style={styles.metricCardHeader}>
                    <View style={styles.metricTitleGroup}>
                      <Ionicons name="compass-outline" size={16} color={colors.primary} />
                      <Text style={[styles.metricCardTitle, { color: colors.primary }]}>
                        {isPt ? 'Parecer Tático' : 'Tactical Insights'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.aiSummaryBody}>{analysis.aiSummary}</Text>

                  {analysis.nextSessionFocus ? (
                    <View style={styles.focusBanner}>
                      <Text style={styles.focusBannerLabel}>
                        {isPt ? 'FOCO DA PRÓXIMA SESSÃO' : 'NEXT SESSION FOCUS'}
                      </Text>
                      <Text style={styles.focusBannerText}>{analysis.nextSessionFocus}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.disclaimerText}>{disclaimerText}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    headerIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trialPill: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    trialPillText: {
      fontSize: 10.5,
      fontWeight: '800',
      color: colors.primary,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 14,
      gap: 5,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    configDrawer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    configDrawerTitle: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    configInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    configInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 12,
      color: colors.textPrimary,
    },
    configSaveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    configSaveBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    configTestBtn: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      width: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 12,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    chatScroll: {
      flex: 1,
    },
    chatScrollContent: {
      padding: 16,
      paddingBottom: 24,
      gap: 12,
    },
    emptyChatContainer: {
      alignItems: 'center',
      paddingTop: 22,
      paddingHorizontal: 8,
    },
    emptyChatIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    emptyChatTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    emptyChatSub: {
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 22,
    },
    emptyGridContainer: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    emptyGridCard: {
      width: '48%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      padding: 12,
    },
    emptyGridCardText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 16,
    },
    bubbleRow: {
      gap: 10,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      maxWidth: '85%',
    },
    userBubbleText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
      lineHeight: 18,
    },
    aiBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      maxWidth: '94%',
      gap: 8,
    },
    aiBubbleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    aiBubbleAuthor: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    aiBubbleText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    routineCardBox: {
      marginTop: 4,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.35)' : 'rgba(109, 40, 217, 0.25)',
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    routineCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    routineCardTitle: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    routineExerciseList: {
      gap: 3,
    },
    routineExerciseLine: {
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    saveRoutineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      marginTop: 2,
    },
    saveRoutineBtnSaved: {
      backgroundColor: colors.success,
    },
    saveRoutineBtnText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '800',
    },
    takeawaysBox: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      gap: 6,
    },
    takeawayRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    takeawayText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    aiLoadingBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 12,
      borderRadius: 14,
      gap: 6,
    },
    loadingInnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    loadingInnerText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    horizontalChipsContainer: {
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    horizontalChipsScroll: {
      paddingHorizontal: 12,
      gap: 8,
    },
    chipPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    chipPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chatFooter: {
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 22,
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 4,
    },
    chatInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      maxHeight: 80,
      paddingVertical: 4,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.35,
    },
    analysisScroll: {
      flex: 1,
    },
    analysisScrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    actionBtnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    actionBtnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 13.5,
      fontWeight: '800',
    },
    analysisResults: {
      gap: 14,
    },
    metricCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    aiSummaryCard: {
      borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(109, 40, 217, 0.3)',
    },
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metricTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    metricCardTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    deltaBadge: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    deltaBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    volumeNumbersRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
    },
    volumeBox: {
      flex: 1,
      alignItems: 'center',
    },
    volumeBoxLabel: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    volumeBoxValue: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    volumeBoxDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.surfaceBorder,
    },
    acwrInterpretation: {
      fontSize: 11.5,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    progressionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    progressionExerciseName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    progressionSetDetail: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    progression1RMText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    progressionDeltaText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.success,
    },
    plateauBox: {
      backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(225, 29, 72, 0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : 'rgba(225, 29, 72, 0.18)',
      borderRadius: 12,
      padding: 12,
      gap: 5,
    },
    plateauExerciseTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.danger,
    },
    plateauDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15,
    },
    plateauActionBox: {
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    plateauActionLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    plateauActionText: {
      fontSize: 11,
      color: colors.textPrimary,
      lineHeight: 15,
    },
    cleanStatusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 150, 105, 0.05)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.18)',
      borderRadius: 10,
      padding: 10,
    },
    cleanStatusText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.success,
      lineHeight: 16,
      fontWeight: '600',
    },
    aiSummaryBody: {
      fontSize: 12.5,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    focusBanner: {
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(109, 40, 217, 0.08)',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: 10,
      borderRadius: 8,
      gap: 2,
    },
    focusBannerLabel: {
      fontSize: 9.5,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    focusBannerText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    disclaimerText: {
      fontSize: 10.5,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 14,
      marginTop: 6,
      paddingHorizontal: 8,
    },
  });
}
