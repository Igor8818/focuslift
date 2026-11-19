import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { BrandLogo } from '../components/BrandLogo';
import { createRoutine, getRoutines, type CreateRoutineInput } from '../database/db';

export interface OnboardingScreenProps {
  onComplete: () => Promise<void> | void;
  onOpenAuth: () => void;
}

type GoalKey = 'hypertrophy' | 'strength' | 'conditioning';
type SplitKey = 'fullbody' | 'upperlower' | 'ppl';

function buildStarterRoutine(goal: GoalKey, split: SplitKey, isPt: boolean): CreateRoutineInput {
  const goalLabel =
    goal === 'hypertrophy'
      ? isPt ? 'Hipertrofia' : 'Hypertrophy'
      : goal === 'strength'
      ? isPt ? 'Força Pura' : 'Strength'
      : isPt ? 'Condicionamento' : 'Conditioning';

  const restCompound = goal === 'strength' ? 180 : goal === 'hypertrophy' ? 120 : 75;
  const targetSets = goal === 'conditioning' ? 3 : 4;

  if (split === 'fullbody') {
    return {
      name: isPt ? `Full Body • ${goalLabel}` : `Full Body • ${goalLabel}`,
      description: isPt
        ? 'Ficha inicial 3x/semana equilibrando força e hipertrofia.'
        : 'Starter 3x/week routine balancing full-body strength & hypertrophy.',
      color: '#8B5CF6',
      exercises: [
        { exercise_name: 'Agachamento Livre', muscle_group: 'Pernas', target_sets: targetSets, rest_timer_seconds: restCompound, order_index: 0 },
        { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: targetSets, rest_timer_seconds: restCompound, order_index: 1 },
        { exercise_name: 'Puxada Frontal (Pulldown)', muscle_group: 'Costas', target_sets: 3, rest_timer_seconds: 90, order_index: 2 },
        { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 90, order_index: 3 },
      ],
    };
  }

  if (split === 'upperlower') {
    return {
      name: isPt ? `Upper A • ${goalLabel}` : `Upper A • ${goalLabel}`,
      description: isPt
        ? 'Ficha inicial de superiores para divisão Upper / Lower (4x/semana).'
        : 'Starter Upper Body session for a 4x/week Upper/Lower split.',
      color: '#10B981',
      exercises: [
        { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: targetSets, rest_timer_seconds: restCompound, order_index: 0 },
        { exercise_name: 'Remada Curvada com Barra', muscle_group: 'Costas', target_sets: targetSets, rest_timer_seconds: restCompound, order_index: 1 },
        { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 90, order_index: 2 },
        { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 60, order_index: 3 },
        { exercise_name: 'Tríceps Corda na Polia', muscle_group: 'Tríceps', target_sets: 3, rest_timer_seconds: 60, order_index: 4 },
      ],
    };
  }

  return {
    name: isPt ? `Push A • ${goalLabel}` : `Push A • ${goalLabel}`,
    description: isPt
      ? 'Ficha inicial Push (Peito, Ombros e Tríceps) para divisão 5x+/semana.'
      : 'Starter Push session (Chest, Shoulders & Triceps) for a 5x+/week split.',
    color: '#8B5CF6',
    exercises: [
      { exercise_name: 'Supino Reto com Barra', muscle_group: 'Peito', target_sets: targetSets, rest_timer_seconds: restCompound, order_index: 0 },
      { exercise_name: 'Supino Inclinado com Halteres', muscle_group: 'Peito', target_sets: 3, rest_timer_seconds: 120, order_index: 1 },
      { exercise_name: 'Desenvolvimento com Halteres', muscle_group: 'Ombros', target_sets: 3, rest_timer_seconds: 90, order_index: 2 },
      { exercise_name: 'Elevação Lateral', muscle_group: 'Ombros', target_sets: 4, rest_timer_seconds: 60, order_index: 3 },
      { exercise_name: 'Tríceps Corda na Polia', muscle_group: 'Tríceps', target_sets: 3, rest_timer_seconds: 60, order_index: 4 },
    ],
  };
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, onOpenAuth }) => {
  const { colors, isDark } = useTheme();
  const { language } = useTranslation();
  const isPt = language === 'pt';
  const styles = makeStyles(colors, isDark);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<GoalKey>('hypertrophy');
  const [split, setSplit] = useState<SplitKey>('ppl');
  const [saving, setSaving] = useState(false);

  const goalOptions: Array<{ key: GoalKey; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }> = [
    {
      key: 'hypertrophy',
      title: isPt ? 'Ganhar Massa Muscular' : 'Build Muscle (Hypertrophy)',
      desc: isPt ? 'Foco em volume semanal, tensão mecânica e progressão de 8–12 reps.' : 'Focus on progressive volume and hypertrophy in the 8–12 rep range.',
      icon: 'barbell-outline',
    },
    {
      key: 'strength',
      title: isPt ? 'Aumentar Força Máxima' : 'Maximize Strength',
      desc: isPt ? 'Rastreamento de 1RM (Brzycki), cargas pesadas e descanso longo.' : 'Track estimated 1RM (Brzycki), heavier sets, and optimal rest timers.',
      icon: 'trophy-outline',
    },
    {
      key: 'conditioning',
      title: isPt ? 'Condicionamento & Consistência' : 'Conditioning & Consistency',
      desc: isPt ? 'Treinos dinâmicos + controle de metas diárias de água, proteína e streak.' : 'Efficient workouts paired with daily hydration, protein, and habit streaks.',
      icon: 'flash-outline',
    },
  ];

  const splitOptions: Array<{ key: SplitKey; title: string; desc: string }> = [
    {
      key: 'fullbody',
      title: isPt ? '3x por semana • Full Body' : '3 days / week • Full Body',
      desc: isPt ? 'Treina o corpo todo em sessões objetivas e eficientes.' : 'Hit all major muscle groups in focused, time-efficient sessions.',
    },
    {
      key: 'upperlower',
      title: isPt ? '4x por semana • Upper / Lower' : '4 days / week • Upper / Lower',
      desc: isPt ? 'Equilíbrio ideal entre frequência muscular e recuperação.' : 'Optimal balance between frequency and recovery.',
    },
    {
      key: 'ppl',
      title: isPt ? '5x+ por semana • Push / Pull / Legs' : '5+ days / week • Push / Pull / Legs',
      desc: isPt ? 'Maior volume especializado por grupo muscular.' : 'Higher specialized training volume per muscle group.',
    },
  ];

  const starterPreview = buildStarterRoutine(goal, split, isPt);

  const handleFinishOnboarding = async () => {
    setSaving(true);
    try {
      const existing = await getRoutines();
      if (existing.length === 0) {
        await createRoutine(starterPreview);
      }
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      await onComplete();
    } catch {
      await onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.topHeader}>
        <BrandLogo variant="inline" />
        <View style={styles.stepIndicatorRow}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                s < step && styles.stepDotDone,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepEyebrow}>{isPt ? 'PASSO 1 DE 3' : 'STEP 1 OF 3'}</Text>
            <Text style={styles.stepTitle}>
              {isPt ? 'Qual é o seu objetivo principal?' : 'What is your primary goal?'}
            </Text>
            <Text style={styles.stepSub}>
              {isPt
                ? 'Vamos configurar o motor de progressão e montar sua primeira ficha pronta.'
                : 'We will calibrate your progression engine and create your starter routine.'}
            </Text>

            <View style={styles.optionsList}>
              {goalOptions.map((opt) => {
                const selected = goal === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      setGoal(opt.key);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.optionIconBox, selected && styles.optionIconBoxSelected]}>
                      <Ionicons name={opt.icon} size={20} color={selected ? '#FFFFFF' : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{opt.title}</Text>
                      <Text style={styles.optionDesc}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepEyebrow}>{isPt ? 'PASSO 2 DE 3' : 'STEP 2 OF 3'}</Text>
            <Text style={styles.stepTitle}>
              {isPt ? 'Quantos dias pretende treinar?' : 'How many days per week?'}
            </Text>
            <Text style={styles.stepSub}>
              {isPt
                ? 'Escolha a divisão inicial ideal para a sua rotina na academia.'
                : 'Pick the training split that fits your weekly schedule.'}
            </Text>

            <View style={styles.optionsList}>
              {splitOptions.map((opt) => {
                const selected = split === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      setSplit(opt.key);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{opt.title}</Text>
                      <Text style={styles.optionDesc}>{opt.desc}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepEyebrow}>{isPt ? 'PASSO 3 DE 3' : 'STEP 3 OF 3'}</Text>
            <Text style={styles.stepTitle}>
              {isPt ? 'Tudo pronto para seu 1º treino!' : 'Your starter workout is ready!'}
            </Text>
            <Text style={styles.stepSub}>
              {isPt
                ? 'Sem cadastro obrigatório para começar. Seus treinos ficam salvos offline no aparelho.'
                : 'No sign-up required to start. Workouts save fast & offline directly on your device.'}
            </Text>

            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.previewTitle}>{starterPreview.name}</Text>
              </View>
              <Text style={styles.previewDesc}>{starterPreview.description}</Text>

              <View style={styles.previewExercises}>
                {(starterPreview.exercises || []).map((ex, idx) => (
                  <View key={idx} style={styles.previewExRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.previewExText}>
                      {ex.exercise_name} • {ex.target_sets}× ({ex.rest_timer_seconds}s)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step < 3 ? (
          <View style={styles.footerRow}>
            {step > 1 ? (
              <TouchableOpacity
                style={styles.backStepBtn}
                onPress={() => setStep((s) => (s === 2 ? 1 : 2))}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => setStep((s) => (s === 1 ? 2 : 3))}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{isPt ? 'Continuar' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleFinishOnboarding}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="barbell-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>
                    {isPt ? 'Criar Ficha e Começar Grátis' : 'Create Routine & Start Free'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.authLinkBtn} onPress={onOpenAuth} activeOpacity={0.75}>
              <Text style={styles.authLinkText}>
                {isPt ? 'Já tenho conta (Entrar)' : 'I already have an account (Sign In)'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
    },
    stepIndicatorRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceBorder,
    },
    stepDotActive: {
      width: 22,
      backgroundColor: colors.primary,
    },
    stepDotDone: {
      backgroundColor: colors.success,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
    },
    stepBlock: {
      gap: 10,
    },
    stepEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.9,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    stepSub: {
      fontSize: 13.5,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    optionsList: {
      gap: 12,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      padding: 16,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.10)' : 'rgba(109, 40, 217, 0.06)',
    },
    optionIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconBoxSelected: {
      backgroundColor: colors.primary,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    optionDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
      lineHeight: 17,
    },
    previewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 18,
      padding: 16,
      gap: 10,
      marginTop: 6,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    previewDesc: {
      fontSize: 12.5,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    previewExercises: {
      gap: 6,
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    previewExRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    previewExText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    footerRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    backStepBtn: {
      width: 50,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryBtnText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    authLinkBtn: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    authLinkText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
  });
}
