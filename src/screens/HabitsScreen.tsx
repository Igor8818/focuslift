import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type DailyHabits,
  type CustomHabit,
  getOrCreateDailyHabits,
  upsertDailyHabits,
  updateHabitTargets,
  getCustomHabitsWithStatus,
  createCustomHabit,
  deleteCustomHabit,
  toggleCustomHabitLog,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDisplay(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Porções rápidas de proteína
const PROTEIN_QUICK_PORTIONS = [
  { label: '🍗 Frango', grams: 30, desc: '100g peito' },
  { label: '🥚 Ovo', grams: 7, desc: '1 unidade' },
  { label: '🥛 Whey', grams: 25, desc: '1 scoop' },
  { label: '🐟 Atum', grams: 28, desc: '1 lata' },
  { label: '🥩 Carne', grams: 26, desc: '100g' },
  { label: '🫘 Feijão', grams: 8, desc: '100g cozido' },
];

// Opções rápidas de água
const WATER_QUICK_OPTIONS = [
  { label: '🥤 Copo', ml: 200 },
  { label: '🍶 Garrafa P', ml: 500 },
  { label: '🧴 Garrafa G', ml: 1000 },
];

// Sugestões de hábitos
const HABIT_SUGGESTIONS = [
  { emoji: '⚡', name: 'Creatina (5g)' },
  { emoji: '😴', name: '8h de Sono' },
  { emoji: '💊', name: 'Multivitamínico' },
  { emoji: '🏃', name: 'Cardio / 10k Passos' },
  { emoji: '🧘', name: 'Alongamento / Mobilidade' },
  { emoji: '🥗', name: 'Salada & Vegetais' },
];

// ─── Componente: Anel Circular de Progresso ─────────────────────────────────
// Técnica: dois semi-círculos rotacionados com overflow hidden (sem SVG)
interface CircularRingProps {
  ratio: number;          // 0.0 → 1.0
  color: string;
  trackColor: string;
  size: number;
  strokeWidth: number;
  children?: React.ReactNode;
}

const CircularRing: React.FC<CircularRingProps> = ({
  ratio,
  color,
  trackColor,
  size,
  strokeWidth,
  children,
}) => {
  const animatedRatio = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedRatio, {
      toValue: ratio,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  const half = size / 2;
  const clipRadius = half - strokeWidth / 2;

  // Usando Animated.interpolate para rotações dos semi-anéis
  const firstHalfRotation = animatedRatio.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: ['0deg', '180deg', '180deg', '180deg'],
    extrapolate: 'clamp',
  });

  const secondHalfRotation = animatedRatio.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {/* Track (fundo do anel) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />

      {/* Metade esquerda do anel (0–50%) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            overflow: 'hidden',
            transform: [{ rotate: firstHalfRotation }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: half,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: size,
                height: size,
                borderRadius: half,
                borderWidth: strokeWidth,
                borderColor: color,
              }}
            />
          </View>
        </Animated.View>
      </View>

      {/* Metade direita do anel (50–100%) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            overflow: 'hidden',
            transform: [{ rotate: secondHalfRotation }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: half,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: size,
                height: size,
                borderRadius: half,
                borderWidth: strokeWidth,
                borderColor: color,
              }}
            />
          </View>
        </Animated.View>
      </View>

      {/* Conteúdo central */}
      <View
        style={{
          position: 'absolute',
          top: strokeWidth,
          left: strokeWidth,
          right: strokeWidth,
          bottom: strokeWidth,
          borderRadius: (size - strokeWidth * 2) / 2,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
};

// ─── Componente: Barra de progresso animada ─────────────────────────────────
interface AnimatedBarProps {
  ratio: number;
  color: string;
  trackColor: string;
  height?: number;
}

const AnimatedBar: React.FC<AnimatedBarProps> = ({ ratio, color, trackColor, height = 10 }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: ratio,
      tension: 60,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={{
        height,
        backgroundColor: trackColor,
        borderRadius: height / 2,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width: widthInterpolation,
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
};

// ─── Componente: Toggle animado ──────────────────────────────────────────────
interface AnimatedToggleProps {
  done: boolean;
  color: string;
  onPress: () => void;
}

const AnimatedToggle: React.FC<AnimatedToggleProps> = ({ done, color, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: done ? 1 : 0,
      tension: 120,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [done]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.85, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    onPress();
  };

  const bgColor = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.05)', color],
  });

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.3, 1],
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: done ? color : 'rgba(255,255,255,0.15)',
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ scale: scaleAnim }],
          backgroundColor: bgColor as any,
        }}
      >
        <Animated.Text
          style={{
            fontSize: 18,
            fontWeight: '900',
            color: '#fff',
            transform: [{ scale: checkScale }],
          }}
        >
          ✓
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Tela Principal ──────────────────────────────────────────────────────────
export const HabitsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [habits, setHabits] = useState<DailyHabits | null>(null);

  // Hábitos personalizados
  const [customHabits, setCustomHabits] = useState<Array<CustomHabit & { done: number }>>([]);
  const [showCustomSection, setShowCustomSection] = useState(false);

  // Modal de novo hábito personalizado
  const [newHabitModal, setNewHabitModal] = useState(false);
  const [newHabitEmoji, setNewHabitEmoji] = useState('⭐');
  const [newHabitName, setNewHabitName] = useState('');

  // Modais fixos
  const [activeModal, setActiveModal] = useState<'protein' | 'water' | 'goals' | null>(null);
  const [customProteinInput, setCustomProteinInput] = useState('');
  const [customWaterInput, setCustomWaterInput] = useState('');

  // Modal de metas
  const [goalProteinInput, setGoalProteinInput] = useState('');
  const [goalWaterInput, setGoalWaterInput] = useState('');

  // Animação de celebração (100%)
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const celebrateScale = useRef(new Animated.Value(0.5)).current;
  const wasCelebrated = useRef(false);

  const todayStr = getTodayIsoString();

  const loadData = useCallback(async () => {
    try {
      const [data, custom] = await Promise.all([
        getOrCreateDailyHabits(todayStr),
        getCustomHabitsWithStatus(todayStr),
      ]);
      setHabits(data);
      setCustomHabits(custom);
      if (custom.length > 0) setShowCustomSection(true);
    } catch (error) {
      console.error('Erro ao carregar hábitos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Valores derivados
  const waterCurrent = habits?.water_current_ml ?? 0;
  const waterTarget = habits?.water_target_ml ?? 3000;
  const waterRatio = Math.min(1, waterCurrent / waterTarget);
  const isWaterDone = waterCurrent >= waterTarget || !!habits?.water_done;

  const proteinCurrent = habits?.protein_current_g ?? 0;
  const proteinTarget = habits?.protein_target_g ?? 160;
  const proteinRatio = Math.min(1, proteinCurrent / proteinTarget);
  const isProteinDone = proteinCurrent >= proteinTarget || !!habits?.protein_done;

  const isWorkoutDone = !!habits?.workout_done;
  const isMealsDone = !!habits?.meals_done;

  const completedCount =
    (isWaterDone ? 1 : 0) +
    (isProteinDone ? 1 : 0) +
    (isWorkoutDone ? 1 : 0) +
    (isMealsDone ? 1 : 0);
  const overallRatio = (waterRatio + proteinRatio + (isWorkoutDone ? 1 : 0) + (isMealsDone ? 1 : 0)) / 4;
  const overallPercent = Math.round(overallRatio * 100);

  // Dispara animação de celebração ao atingir 100%
  useEffect(() => {
    if (overallPercent === 100 && !wasCelebrated.current) {
      wasCelebrated.current = true;
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      Animated.parallel([
        Animated.spring(celebrateAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.spring(celebrateScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      ]).start();
    } else if (overallPercent < 100) {
      wasCelebrated.current = false;
      celebrateAnim.setValue(0);
      celebrateScale.setValue(0.5);
    }
  }, [overallPercent]);

  // Helpers de atualização
  const updateAndRefresh = async (patch: Partial<Parameters<typeof upsertDailyHabits>[0]>) => {
    if (!habits) return;
    try {
      const saved = await upsertDailyHabits({ date: todayStr, ...patch });
      setHabits(saved);
    } catch (e) {
      console.error('Erro ao salvar hábito:', e);
    }
  };

  const handleAddProtein = async (delta: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const newVal = Math.max(0, proteinCurrent + delta);
    await updateAndRefresh({ protein_current_g: newVal });
  };

  const handleSetCustomProtein = async () => {
    const num = parseFloat(customProteinInput.replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      await handleAddProtein(num);
      setCustomProteinInput('');
    }
  };

  const handleAddWater = async (delta: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const newVal = Math.max(0, waterCurrent + delta);
    await updateAndRefresh({ water_current_ml: newVal });
  };

  const handleSetCustomWater = async () => {
    const num = parseInt(customWaterInput.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      await handleAddWater(num);
      setCustomWaterInput('');
    }
  };

  const handleToggleWorkout = async () => {
    await updateAndRefresh({ workout_done: isWorkoutDone ? 0 : 1 });
  };

  const handleToggleMeals = async () => {
    await updateAndRefresh({ meals_done: isMealsDone ? 0 : 1 });
  };

  const handleSaveGoals = async () => {
    const newProtein = parseFloat(goalProteinInput.replace(',', '.'));
    const newWater = parseInt(goalWaterInput.replace(/\D/g, ''), 10);
    const patch: any = {};
    if (!isNaN(newProtein) && newProtein > 0) patch.protein_target_g = newProtein;
    if (!isNaN(newWater) && newWater > 0) patch.water_target_ml = newWater;
    if (Object.keys(patch).length > 0) {
      try {
        const saved = await updateHabitTargets({ date: todayStr, ...patch });
        setHabits(saved);
      } catch (e) {
        console.error('Erro ao salvar metas:', e);
      }
    }
    setActiveModal(null);
  };

  const openGoalsModal = () => {
    setGoalProteinInput(String(proteinTarget));
    setGoalWaterInput(String(waterTarget));
    setActiveModal('goals');
  };

  // Handlers de Hábitos Personalizados
  const handleToggleCustomHabit = async (habitId: number) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    const newDone = await toggleCustomHabitLog(habitId, todayStr);
    setCustomHabits((prev) =>
      prev.map((h) => (h.id === habitId ? { ...h, done: newDone } : h))
    );
  };

  const handleCreateCustomHabit = async () => {
    const name = newHabitName.trim();
    if (!name) return;
    try {
      const created = await createCustomHabit({ emoji: newHabitEmoji, name });
      setCustomHabits((prev) => [...prev, { ...created, done: 0 }]);
      setNewHabitModal(false);
      setNewHabitEmoji('⭐');
      setNewHabitName('');
      setShowCustomSection(true);
    } catch (e) {
      console.error('Erro ao criar hábito:', e);
    }
  };

  const handleDeleteCustomHabit = (habit: CustomHabit) => {
    Alert.alert(
      'Excluir Hábito',
      `Deseja excluir "${habit.emoji} ${habit.name}"? O histórico será removido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomHabit(habit.id);
            setCustomHabits((prev) => prev.filter((h) => h.id !== habit.id));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando Hábitos...</Text>
      </SafeAreaView>
    );
  }

  // Cor do anel geral baseada no progresso
  const overallRingColor =
    overallPercent === 100
      ? colors.success
      : overallPercent >= 50
      ? colors.primary
      : colors.streak;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.screenTitle}>Recuperação & Nutrição</Text>
            <Text style={styles.headerDate}>{getTodayDisplay()}</Text>
          </View>
          <TouchableOpacity
            style={styles.goalsBtn}
            onPress={openGoalsModal}
            activeOpacity={0.75}
            accessibilityLabel="Editar Metas"
          >
            <Text style={styles.goalsBtnIcon}>🎯</Text>
            <Text style={styles.goalsBtnText}>Metas</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero: Anel Central de Progresso ── */}
        <View style={styles.heroCard}>
          {/* Anel central grande */}
          <View style={styles.heroRingRow}>
            <CircularRing
              ratio={overallRatio}
              color={overallRingColor}
              trackColor={`${overallRingColor}20`}
              size={130}
              strokeWidth={12}
            >
              <View style={styles.heroRingCenter}>
                <Text style={[styles.heroPercent, { color: overallRingColor }]}>
                  {overallPercent}%
                </Text>
                <Text style={styles.heroPercentLabel}>do dia</Text>
              </View>
            </CircularRing>

            {/* Anéis secundários (proteína e água) à direita */}
            <View style={styles.heroSubRings}>
              {/* Proteína */}
              <View style={styles.heroSubRingItem}>
                <CircularRing
                  ratio={proteinRatio}
                  color={colors.protein}
                  trackColor={`${colors.protein}20`}
                  size={64}
                  strokeWidth={7}
                >
                  <Text style={{ fontSize: 18 }}>🍗</Text>
                </CircularRing>
                <View style={styles.heroSubRingLabel}>
                  <Text style={[styles.heroSubValue, { color: colors.protein }]}>
                    {Math.round(proteinCurrent)}g
                  </Text>
                  <Text style={styles.heroSubTarget}>/ {proteinTarget}g</Text>
                </View>
              </View>

              {/* Água */}
              <View style={styles.heroSubRingItem}>
                <CircularRing
                  ratio={waterRatio}
                  color={colors.water}
                  trackColor={`${colors.water}20`}
                  size={64}
                  strokeWidth={7}
                >
                  <Text style={{ fontSize: 18 }}>💧</Text>
                </CircularRing>
                <View style={styles.heroSubRingLabel}>
                  <Text style={[styles.heroSubValue, { color: colors.water }]}>
                    {(waterCurrent / 1000).toFixed(1)}L
                  </Text>
                  <Text style={styles.heroSubTarget}>/ {(waterTarget / 1000).toFixed(1)}L</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Badges de toggle rápido (treino e refeições) */}
          <View style={styles.heroBadgesRow}>
            <View style={[styles.heroBadge, isWorkoutDone && { borderColor: `${colors.workout}60`, backgroundColor: `${colors.workout}12` }]}>
              <Text style={styles.heroBadgeEmoji}>🏋️</Text>
              <Text style={[styles.heroBadgeName, isWorkoutDone && { color: colors.workout }]}>Treino</Text>
              {isWorkoutDone && <Text style={[styles.heroBadgeDone, { color: colors.workout }]}>✓</Text>}
            </View>
            <View style={[styles.heroBadge, isMealsDone && { borderColor: `${colors.meals}60`, backgroundColor: `${colors.meals}12` }]}>
              <Text style={styles.heroBadgeEmoji}>🥗</Text>
              <Text style={[styles.heroBadgeName, isMealsDone && { color: colors.meals }]}>Refeições</Text>
              {isMealsDone && <Text style={[styles.heroBadgeDone, { color: colors.meals }]}>✓</Text>}
            </View>
            {habits?.streak_count !== undefined && habits.streak_count > 0 && (
              <View style={[styles.heroBadge, { borderColor: `${colors.streak}60`, backgroundColor: `${colors.streak}12` }]}>
                <Text style={styles.heroBadgeEmoji}>🔥</Text>
                <Text style={[styles.heroBadgeName, { color: colors.streak }]}>{habits.streak_count} dias</Text>
                <Text style={[styles.heroBadgeDone, { color: colors.streak }]}>streak</Text>
              </View>
            )}
          </View>

          {/* Mensagem de parabéns ao completar tudo */}
          {overallPercent === 100 && (
            <Animated.View
              style={[
                styles.celebrationBanner,
                {
                  opacity: celebrateAnim,
                  transform: [{ scale: celebrateScale }],
                },
              ]}
            >
              <Text style={styles.celebrationText}>🎉 Dia perfeito! Todos os hábitos completos!</Text>
            </Animated.View>
          )}
        </View>

        {/* ── Card: Proteína ── */}
        <View style={[styles.habitCard, isProteinDone && { borderColor: `${colors.protein}50` }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardEmoji}>🍗</Text>
              <View>
                <Text style={styles.cardTitle}>Proteína</Text>
                <Text style={styles.cardTarget}>Meta: {proteinTarget}g/dia</Text>
              </View>
            </View>
            {isProteinDone && (
              <View style={[styles.doneBadge, { backgroundColor: `${colors.protein}18`, borderColor: `${colors.protein}50` }]}>
                <Text style={[styles.doneBadgeText, { color: colors.protein }]}>✓ Atingido</Text>
              </View>
            )}
          </View>

          {/* Barra de progresso animada */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressCurrent, { color: colors.protein }]}>
              {Math.round(proteinCurrent)}g
            </Text>
            <AnimatedBar
              ratio={proteinRatio}
              color={colors.protein}
              trackColor={colors.surfaceElevated}
              height={10}
            />
            <Text style={styles.progressTarget}>{proteinTarget}g</Text>
          </View>

          {/* Porções rápidas */}
          <Text style={styles.quickLabel}>ADICIONAR PORÇÃO RÁPIDA</Text>
          <View style={styles.portionsGrid}>
            {PROTEIN_QUICK_PORTIONS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[styles.portionBtn, { borderColor: `${colors.protein}30` }]}
                onPress={() => handleAddProtein(p.grams)}
                activeOpacity={0.7}
              >
                <Text style={styles.portionBtnLabel}>{p.label}</Text>
                <Text style={[styles.portionBtnGrams, { color: colors.protein }]}>+{p.grams}g</Text>
                <Text style={styles.portionBtnDesc}>{p.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ação manual + Resetar */}
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.addCustomBtn}
              onPress={() => { setCustomProteinInput(''); setActiveModal('protein'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.addCustomBtnText}>+ Valor personalizado</Text>
            </TouchableOpacity>
            {proteinCurrent > 0 && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => updateAndRefresh({ protein_current_g: 0 })}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Zerar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Card: Água ── */}
        <View style={[styles.habitCard, isWaterDone && { borderColor: `${colors.water}50` }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardEmoji}>💧</Text>
              <View>
                <Text style={styles.cardTitle}>Hidratação</Text>
                <Text style={styles.cardTarget}>Meta: {(waterTarget / 1000).toFixed(1)}L/dia</Text>
              </View>
            </View>
            {isWaterDone && (
              <View style={[styles.doneBadge, { backgroundColor: `${colors.water}18`, borderColor: `${colors.water}50` }]}>
                <Text style={[styles.doneBadgeText, { color: colors.water }]}>✓ Atingido</Text>
              </View>
            )}
          </View>

          {/* Barra de progresso animada */}
          <View style={styles.progressRow}>
            <Text style={[styles.progressCurrent, { color: colors.water }]}>
              {(waterCurrent / 1000).toFixed(1)}L
            </Text>
            <AnimatedBar
              ratio={waterRatio}
              color={colors.water}
              trackColor={colors.surfaceElevated}
              height={10}
            />
            <Text style={styles.progressTarget}>{(waterTarget / 1000).toFixed(1)}L</Text>
          </View>

          {/* Copos/garrafas rápidas */}
          <Text style={styles.quickLabel}>ADICIONAR RAPIDAMENTE</Text>
          <View style={styles.waterQuickRow}>
            {WATER_QUICK_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.waterQuickBtn, { borderColor: `${colors.water}40` }]}
                onPress={() => handleAddWater(opt.ml)}
                activeOpacity={0.75}
              >
                <Text style={styles.waterQuickEmoji}>{opt.label.split(' ')[0]}</Text>
                <Text style={[styles.waterQuickText, { color: colors.water }]}>
                  +{opt.ml >= 1000 ? `${opt.ml / 1000}L` : `${opt.ml}ml`}
                </Text>
                <Text style={styles.waterQuickDesc}>{opt.label.split(' ').slice(1).join(' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ação manual + Resetar */}
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.addCustomBtn}
              onPress={() => { setCustomWaterInput(''); setActiveModal('water'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.addCustomBtnText}>+ Valor personalizado</Text>
            </TouchableOpacity>
            {waterCurrent > 0 && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => updateAndRefresh({ water_current_ml: 0 })}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Zerar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Cards: Treino & Refeições lado a lado ── */}
        <View style={styles.toggleRow}>
          {/* Treino do Dia */}
          <TouchableOpacity
            style={[
              styles.toggleCard,
              isWorkoutDone && { borderColor: `${colors.workout}50`, backgroundColor: `${colors.workout}0A` },
            ]}
            onPress={handleToggleWorkout}
            activeOpacity={0.9}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isWorkoutDone }}
          >
            <View style={styles.toggleCardContent}>
              <Text style={styles.toggleCardEmoji}>🏋️</Text>
              <Text style={styles.toggleCardTitle}>Treino do Dia</Text>
              <Text style={[styles.toggleCardSub, isWorkoutDone && { color: colors.workout }]}>
                {isWorkoutDone ? 'Feito! 💪' : 'Toque para marcar'}
              </Text>
            </View>
            <AnimatedToggle
              done={isWorkoutDone}
              color={colors.workout}
              onPress={handleToggleWorkout}
            />
          </TouchableOpacity>

          {/* Refeições */}
          <TouchableOpacity
            style={[
              styles.toggleCard,
              isMealsDone && { borderColor: `${colors.meals}50`, backgroundColor: `${colors.meals}0A` },
            ]}
            onPress={handleToggleMeals}
            activeOpacity={0.9}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isMealsDone }}
          >
            <View style={styles.toggleCardContent}>
              <Text style={styles.toggleCardEmoji}>🥗</Text>
              <Text style={styles.toggleCardTitle}>Refeições</Text>
              <Text style={[styles.toggleCardSub, isMealsDone && { color: colors.meals }]}>
                {isMealsDone ? 'Em dia! 👍' : 'Toque para marcar'}
              </Text>
            </View>
            <AnimatedToggle
              done={isMealsDone}
              color={colors.meals}
              onPress={handleToggleMeals}
            />
          </TouchableOpacity>
        </View>

        {/* ── Streak info (se existir) ── */}
        {habits?.streak_count !== undefined && habits.streak_count > 0 && (
          <View style={styles.streakBanner}>
            <Text style={styles.streakBannerText}>🔥</Text>
            <View>
              <Text style={styles.streakBannerTitle}>{habits.streak_count} dias seguidos!</Text>
              <Text style={styles.streakBannerSub}>Continue assim. Consistência é tudo.</Text>
            </View>
          </View>
        )}

        {/* ── Seção: Hábitos Personalizados ── */}
        <View style={styles.customSection}>
          <TouchableOpacity
            style={styles.customSectionHeader}
            onPress={() => setShowCustomSection((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.customSectionTitleRow}>
              <Text style={styles.customSectionTitle}>✨ Hábitos Personalizados</Text>
              {customHabits.length > 0 && (
                <View style={styles.customCountBadge}>
                  <Text style={styles.customCountBadgeText}>
                    {customHabits.filter((h) => h.done).length}/{customHabits.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.customSectionChevron}>
              {showCustomSection ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showCustomSection && (
            <View style={styles.customContent}>
              {customHabits.map((habit) => (
                <TouchableOpacity
                  key={habit.id}
                  style={[
                    styles.customHabitCard,
                    habit.done === 1 && styles.customHabitCardDone,
                  ]}
                  onPress={() => handleToggleCustomHabit(habit.id)}
                  onLongPress={() => handleDeleteCustomHabit(habit)}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: habit.done === 1 }}
                >
                  <Text style={styles.customHabitEmoji}>{habit.emoji}</Text>
                  <Text style={[
                    styles.customHabitName,
                    habit.done === 1 && styles.customHabitNameDone,
                  ]}>
                    {habit.name}
                  </Text>
                  <View style={[
                    styles.customToggle,
                    habit.done === 1 && { backgroundColor: colors.success, borderColor: colors.success },
                  ]}>
                    <Text style={[styles.customToggleIcon, habit.done === 1 && styles.customToggleIconDone]}>
                      {habit.done === 1 ? '✓' : '○'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {customHabits.length > 0 && (
                <Text style={styles.customHintText}>
                  💡 Pressione e segure para excluir um hábito
                </Text>
              )}

              <TouchableOpacity
                style={styles.addCustomHabitBtn}
                onPress={() => setNewHabitModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addCustomHabitBtnIcon}>+</Text>
                <Text style={styles.addCustomHabitBtnText}>Adicionar Hábito</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Modal: Adicionar Proteína Personalizada ── */}
      <Modal
        visible={activeModal === 'protein'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>🍗 Adicionar Proteína</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCurrentLabel}>
              Atual: <Text style={{ color: colors.protein, fontWeight: '900' }}>{Math.round(proteinCurrent)}g</Text> / {proteinTarget}g
            </Text>
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="Quantidade em gramas"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customProteinInput}
                onChangeText={setCustomProteinInput}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.modalAddBtn, { backgroundColor: colors.protein }]}
                onPress={handleSetCustomProtein}
                activeOpacity={0.8}
              >
                <Text style={styles.modalAddBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Adicionar Água Personalizada ── */}
      <Modal
        visible={activeModal === 'water'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>💧 Adicionar Água</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCurrentLabel}>
              Atual: <Text style={{ color: colors.water, fontWeight: '900' }}>{waterCurrent}ml</Text> / {waterTarget}ml
            </Text>
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="Quantidade em ml"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customWaterInput}
                onChangeText={setCustomWaterInput}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.modalAddBtn, { backgroundColor: colors.water }]}
                onPress={handleSetCustomWater}
                activeOpacity={0.8}
              >
                <Text style={styles.modalAddBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Editar Metas ── */}
      <Modal
        visible={activeModal === 'goals'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.goalsModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.goalsModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>🎯 Editar Metas Diárias</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.goalsNote}>
              As metas são aplicadas ao dia de hoje e salvos localmente.
            </Text>

            <View style={styles.goalsField}>
              <Text style={styles.goalsFieldLabel}>🍗 Meta de Proteína (gramas/dia)</Text>
              <TextInput
                style={styles.goalsInput}
                value={goalProteinInput}
                onChangeText={setGoalProteinInput}
                keyboardType="numeric"
                placeholder="Ex: 160"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.goalsFieldHint}>
                Referência: ~1,6–2,2g por kg corporal para hipertrofia.
              </Text>
            </View>

            <View style={styles.goalsField}>
              <Text style={styles.goalsFieldLabel}>💧 Meta de Água (ml/dia)</Text>
              <TextInput
                style={styles.goalsInput}
                value={goalWaterInput}
                onChangeText={setGoalWaterInput}
                keyboardType="numeric"
                placeholder="Ex: 3000"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.goalsFieldHint}>
                Referência: ~35ml por kg corporal por dia.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.goalsSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveGoals}
              activeOpacity={0.85}
            >
              <Text style={styles.goalsSaveBtnText}>Salvar Metas</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Criar Hábito Personalizado ── */}
      <Modal
        visible={newHabitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNewHabitModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.goalsModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.goalsModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>✨ Novo Hábito</Text>
              <TouchableOpacity onPress={() => setNewHabitModal(false)} activeOpacity={0.7}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sugestões rápidas */}
            <Text style={styles.newHabitSuggestLabel}>SUGESTÕES</Text>
            <View style={styles.newHabitSuggestRow}>
              {HABIT_SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.name}
                  style={[
                    styles.newHabitSuggestChip,
                    newHabitName === s.name && newHabitEmoji === s.emoji && styles.newHabitSuggestChipActive,
                  ]}
                  onPress={() => { setNewHabitEmoji(s.emoji); setNewHabitName(s.name); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.newHabitSuggestChipText}>{s.emoji} {s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Campos manuais */}
            <Text style={styles.newHabitOrLabel}>— OU PERSONALIZE —</Text>

            <View style={styles.newHabitInputRow}>
              <TextInput
                style={styles.newHabitEmojiInput}
                value={newHabitEmoji}
                onChangeText={(t) => {
                  const chars = Array.from(t);
                  setNewHabitEmoji(chars.length > 0 ? chars[chars.length - 1] : '⭐');
                }}
                placeholder="⭐"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.newHabitNameInput}
                value={newHabitName}
                onChangeText={(t) => setNewHabitName(t.slice(0, 50))}
                placeholder="Nome do hábito (máx. 50 chars)"
                placeholderTextColor={colors.textMuted}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleCreateCustomHabit}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.goalsSaveBtn,
                { backgroundColor: newHabitName.trim() ? colors.primary : colors.surfaceBorder },
              ]}
              onPress={handleCreateCustomHabit}
              activeOpacity={0.85}
              disabled={!newHabitName.trim()}
            >
              <Text style={[
                styles.goalsSaveBtnText,
                { color: newHabitName.trim() ? '#0A0D14' : colors.textMuted },
              ]}>
                Criar Hábito
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    scrollView: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 48,
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
      marginTop: 8,
    },
    screenTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    headerDate: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    goalsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    goalsBtnIcon: { fontSize: 15 },
    goalsBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },

    // ── Hero Card ──
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 20,
      marginBottom: 16,
      alignItems: 'center',
    },
    heroRingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 24,
      marginBottom: 20,
    },
    heroRingCenter: {
      alignItems: 'center',
    },
    heroPercent: {
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1,
    },
    heroPercentLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroSubRings: {
      gap: 16,
    },
    heroSubRingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    heroSubRingLabel: {
      gap: 2,
    },
    heroSubValue: {
      fontSize: 15,
      fontWeight: '900',
    },
    heroSubTarget: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    heroBadgesRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    heroBadgeEmoji: { fontSize: 14 },
    heroBadgeName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    heroBadgeDone: {
      fontSize: 11,
      fontWeight: '800',
    },
    celebrationBanner: {
      marginTop: 16,
      backgroundColor: `${colors.success}18`,
      borderWidth: 1.5,
      borderColor: `${colors.success}50`,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      width: '100%',
    },
    celebrationText: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '800',
      color: colors.success,
    },

    // ── Cards de Hábito ──
    habitCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      marginBottom: 12,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    cardTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    cardEmoji: {
      fontSize: 26,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    cardTarget: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    doneBadge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    doneBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },

    // Barra de progresso
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 8,
    },
    progressCurrent: {
      fontSize: 13,
      fontWeight: '900',
      minWidth: 44,
    },
    progressTarget: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
      minWidth: 40,
      textAlign: 'right',
    },

    // Porções Rápidas de Proteína
    quickLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    portionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    portionBtn: {
      width: '30.5%',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    portionBtnLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    portionBtnGrams: {
      fontSize: 13,
      fontWeight: '900',
    },
    portionBtnDesc: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 1,
    },

    // Opções rápidas de Água
    waterQuickRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    waterQuickBtn: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1.5,
      paddingVertical: 10,
      alignItems: 'center',
    },
    waterQuickEmoji: {
      fontSize: 18,
      marginBottom: 2,
    },
    waterQuickText: {
      fontSize: 13,
      fontWeight: '900',
    },
    waterQuickDesc: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 1,
    },

    // Footer do card
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    addCustomBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    addCustomBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    resetBtn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    resetBtnText: {
      color: colors.danger || '#EF4444',
      fontSize: 12,
      fontWeight: '800',
    },

    // ── Toggle Row (Treino & Refeições) ──
    toggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    toggleCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    toggleCardContent: {
      flex: 1,
      gap: 2,
    },
    toggleCardEmoji: {
      fontSize: 22,
      marginBottom: 4,
    },
    toggleCardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    toggleCardSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },

    // ── Streak Banner ──
    streakBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: `${colors.streak}12`,
      borderWidth: 1.5,
      borderColor: `${colors.streak}40`,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    streakBannerText: {
      fontSize: 28,
    },
    streakBannerTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.streak,
    },
    streakBannerSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // ── Seção de Hábitos Personalizados ──
    customSection: {
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
    },
    customSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    customSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    customSectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    customCountBadge: {
      backgroundColor: `${colors.primary}20`,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
    },
    customCountBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    customSectionChevron: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
    },
    customContent: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      gap: 8,
    },
    customHabitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 8,
    },
    customHabitCardDone: {
      borderColor: `${colors.success || '#10B981'}50`,
      backgroundColor: `${colors.success || '#10B981'}10`,
    },
    customHabitEmoji: {
      fontSize: 22,
      marginRight: 12,
    },
    customHabitName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    customHabitNameDone: {
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    customToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    customToggleIcon: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '900',
    },
    customToggleIconDone: {
      color: '#0A0D14',
    },
    customHintText: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 4,
    },
    addCustomHabitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginTop: 4,
    },
    addCustomHabitBtnIcon: {
      fontSize: 18,
      color: colors.primary,
      fontWeight: '900',
      lineHeight: 20,
    },
    addCustomHabitBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },

    // ── Modais ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      width: '100%',
      maxWidth: 380,
      padding: 20,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalCloseIcon: {
      fontSize: 18,
      color: colors.textMuted,
      fontWeight: '700',
      padding: 4,
    },
    modalCurrentLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 14,
    },
    modalInputRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modalInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalAddBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalAddBtnText: {
      color: '#0A0D14',
      fontSize: 14,
      fontWeight: '900',
    },

    // Modal de Metas
    goalsModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    goalsModalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 24,
    },
    goalsNote: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 20,
      fontStyle: 'italic',
    },
    goalsField: {
      marginBottom: 18,
    },
    goalsFieldLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    goalsInput: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 4,
    },
    goalsFieldHint: {
      fontSize: 11,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    goalsSaveBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    goalsSaveBtnText: {
      color: '#0A0D14',
      fontSize: 16,
      fontWeight: '900',
    },

    // Modal de criar hábito
    newHabitSuggestLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    newHabitSuggestRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    newHabitSuggestChip: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
    },
    newHabitSuggestChipActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
    },
    newHabitSuggestChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    newHabitOrLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      textAlign: 'center',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    newHabitInputRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    newHabitEmojiInput: {
      width: 52,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 22,
      textAlign: 'center',
      paddingVertical: 10,
    },
    newHabitNameInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
  });
}
