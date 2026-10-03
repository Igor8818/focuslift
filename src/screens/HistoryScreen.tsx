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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  type WorkoutWithDetails,
  type MonthlyStats,
  getRecentWorkouts,
  getMonthlyStats,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { WorkoutCard } from '../components/WorkoutCard';
import { calculateWorkoutTotalVolume } from '../components/WorkoutCard';
import * as Haptics from 'expo-haptics';

// ─── Helpers de data ──────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayIso(): string {
  return toIsoDate(new Date());
}

function getLocalizedMonthName(year: number, month: number, lang = 'pt'): string {
  const d = new Date(year, month, 1);
  const locale =
    lang === 'en'
      ? 'en-US'
      : lang === 'es'
      ? 'es-ES'
      : lang === 'de'
      ? 'de-DE'
      : lang === 'fr'
      ? 'fr-FR'
      : 'pt-BR';
  const name = d.toLocaleDateString(locale, { month: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getLocalizedWeekdays(lang = 'pt'): string[] {
  const locale =
    lang === 'en'
      ? 'en-US'
      : lang === 'es'
      ? 'es-ES'
      : lang === 'de'
      ? 'de-DE'
      : lang === 'fr'
      ? 'fr-FR'
      : 'pt-BR';
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(2026, 2, 1 + offset);
    return d.toLocaleDateString(locale, { weekday: 'short' });
  });
}

/** Retorna array com todas as datas (YYYY-MM-DD) do mês indicado */
function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(toIsoDate(new Date(d)));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Retorna o dia da semana (0=Dom) do 1º dia do mês */
function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Calcula streak atual de treinos consecutivos até hoje */
function calculateCurrentStreak(workoutDates: Set<string>): number {
  let streak = 0;
  const today = new Date();
  let cursor = new Date(today);

  // Se não treinou hoje, começa verificando ontem
  if (!workoutDates.has(toIsoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (workoutDates.has(toIsoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Calcula streak máximo de todos os tempos */
function calculateMaxStreak(workoutDates: Set<string>): number {
  if (workoutDates.size === 0) return 0;
  const sorted = Array.from(workoutDates).sort();
  let max = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00');
    const curr = new Date(sorted[i] + 'T12:00:00');
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 1;
    }
  }
  return max;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type DayStatus = 'workout' | 'rest' | 'today' | 'future' | 'empty';

interface DayMeta {
  date: string;
  status: DayStatus;
  workoutTitle?: string;
}

// ─── Componente: Contador animado ────────────────────────────────────────────
const AnimatedCounter: React.FC<{ value: number; color: string; size?: number }> = ({
  value, color, size = 28
}) => {
  const animVal = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.spring(animVal, {
      toValue: 1,
      tension: 120,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [value]);

  return (
    <Animated.Text
      style={{
        fontSize: size,
        fontWeight: '900',
        color,
        transform: [{ scale: animVal }],
        letterSpacing: -1,
      }}
    >
      {value}
    </Animated.Text>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { t, language, formatWeight, unit, tExercise, tMuscle, tRoutine } = useTranslation();
  const styles = makeStyles(colors, isDark);

  const today = getTodayIso();
  const todayDate = new Date();

  // Mês exibido atualmente
  const [displayYear, setDisplayYear] = useState(todayDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(todayDate.getMonth());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estatísticas mensais
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    workoutCount: 0,
    totalVolumeKg: 0,
    totalSets: 0,
  });

  // Mapas de data → info
  const [workoutByDate, setWorkoutByDate] = useState<Map<string, WorkoutWithDetails>>(new Map());
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());

  // Volumes por data (para heatmap de intensidade)
  const [volumeByDate, setVolumeByDate] = useState<Map<string, number>>(new Map());

  // Treino selecionado para preview
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Lista de treinos recentes (para scroll abaixo)
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutWithDetails[]>([]);

  // Streak calculado localmente
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [workouts, mStats] = await Promise.all([
        getRecentWorkouts(200),
        getMonthlyStats(displayYear, displayMonth),
      ]);
      setMonthlyStats(mStats);
      const byDate = new Map<string, WorkoutWithDetails>();
      const dates = new Set<string>();
      const volByDate = new Map<string, number>();

      for (const w of workouts) {
        byDate.set(w.date, w);
        dates.add(w.date);
        volByDate.set(w.date, calculateWorkoutTotalVolume(w));
      }
      setWorkoutByDate(byDate);
      setWorkoutDates(dates);
      setVolumeByDate(volByDate);
      setRecentWorkouts(workouts.slice(0, 30));

      // Calcula streaks
      setCurrentStreak(calculateCurrentStreak(dates));
      setMaxStreak(calculateMaxStreak(dates));
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [displayYear, displayMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const handleRepeatWorkout = (workout: WorkoutWithDetails) => {
    setModalVisible(false);
    navigation.navigate('WorkoutSession', {
      initialTitle: workout.title,
      initialExercises: workout.exercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscle_group || undefined,
        restTimerSeconds: e.rest_timer_seconds || 90,
      })),
    });
  };

  // ── Calendário ──────────────────────────────────────────────────────────────

  const days = getDaysInMonth(displayYear, displayMonth);
  const firstWeekday = getFirstDayOfWeek(displayYear, displayMonth);

  // Células: padding inicial + dias do mês
  const calendarCells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...days,
  ];

  const getDayStatus = (date: string | null): DayStatus => {
    if (!date) return 'empty';
    if (date > today) return 'future';
    if (date === today) return workoutDates.has(date) ? 'workout' : 'today';
    return workoutDates.has(date) ? 'workout' : 'rest';
  };

  // Intensidade do heatmap: calcula quartis para coloração gradativa
  const allVolumes = Array.from(volumeByDate.values()).filter(v => v > 0);
  const maxVolume = allVolumes.length > 0 ? Math.max(...allVolumes) : 1;

  const getHeatmapOpacity = (date: string | null): number => {
    if (!date || !volumeByDate.has(date)) return 0;
    const vol = volumeByDate.get(date) || 0;
    // Escala logarítmica para não suprimir treinos leves
    return 0.2 + (Math.log(vol + 1) / Math.log(maxVolume + 1)) * 0.8;
  };

  const handleDayPress = (date: string | null) => {
    if (!date || date > today) return;
    const workout = workoutByDate.get(date);
    if (workout) {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      setSelectedWorkout(workout);
      setModalVisible(true);
    }
  };

  const prevMonth = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  };

  const nextMonth = () => {
    const now = new Date();
    if (displayYear > now.getFullYear() || (displayYear === now.getFullYear() && displayMonth >= now.getMonth())) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  };

  const isNextDisabled = (() => {
    const now = new Date();
    return displayYear > now.getFullYear() || (displayYear === now.getFullYear() && displayMonth >= now.getMonth());
  })();

  // Estatísticas do mês
  const monthWorkoutDays = days.filter(d => d <= today && workoutDates.has(d)).length;
  const monthPastDays = days.filter(d => d <= today).length;
  const consistencyPct = monthPastDays > 0 ? Math.round((monthWorkoutDays / monthPastDays) * 100) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>{t('history.title')}</Text>
          <Text style={styles.screenSubtitle}>{t('history.subtitle')}</Text>
        </View>

        {/* ── Streak Banner ── */}
        {currentStreak > 0 && (
          <View style={styles.streakBanner}>
            <View style={styles.streakLeft}>
              <Text style={styles.streakFire}>🔥</Text>
              <View>
                <Text style={styles.streakTitle}>{t('habits.streakDays', { days: currentStreak })}</Text>
              </View>
            </View>
            <View style={styles.streakRight}>
              <Text style={styles.streakMaxLabel}>{t('history.bestStreak')}</Text>
              <Text style={styles.streakMax}>🏆 {maxStreak}</Text>
            </View>
          </View>
        )}

        {/* ── Stat Cards ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: `${colors.success}60` }]}>
            <AnimatedCounter value={monthWorkoutDays} color={colors.success} size={24} />
            <Text style={styles.statLabel}>{t('history.totalWorkouts')}</Text>
            <Text style={styles.statSublabel}>{getLocalizedMonthName(displayYear, displayMonth, language).substring(0, 3)}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: `${colors.primary}60` }]}>
            <AnimatedCounter
              value={Math.round(monthlyStats.totalVolumeKg / 1000 * 10) / 10}
              color={colors.primary}
              size={24}
            />
            <Text style={styles.statLabel}>{unit === 'lbs' ? 'k lbs' : 't'}</Text>
            <Text style={styles.statSublabel}>{t('common.volume')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: `${colors.streak}60` }]}>
            <AnimatedCounter value={consistencyPct} color={colors.streak} size={24} />
            <Text style={styles.statLabel}>%</Text>
            <Text style={styles.statSublabel}>{t('history.daysTrained')}</Text>
          </View>
        </View>

        {/* ── Card do Calendário com Heatmap ── */}
        <View style={styles.calendarCard}>
          {/* Navegação de mês */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
              <Text style={styles.monthNavBtnText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.monthLabelContainer}>
              <Text style={styles.monthLabel}>
                {getLocalizedMonthName(displayYear, displayMonth, language)}
              </Text>
              <Text style={styles.yearLabel}>{displayYear}</Text>
            </View>
            <TouchableOpacity
              onPress={nextMonth}
              style={[styles.monthNavBtn, isNextDisabled && styles.monthNavBtnDisabled]}
              disabled={isNextDisabled}
              activeOpacity={0.7}
            >
              <Text style={[styles.monthNavBtnText, isNextDisabled && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Cabeçalho dos dias da semana */}
          <View style={styles.weekdayHeaderRow}>
            {getLocalizedWeekdays(language).map((d, idx) => (
              <Text key={idx} style={styles.weekdayHeaderText}>{d}</Text>
            ))}
          </View>

          {/* Grid de dias com heatmap de intensidade */}
          <View style={styles.daysGrid}>
            {calendarCells.map((date, idx) => {
              const status = getDayStatus(date);
              const dayNum = date ? parseInt(date.split('-')[2], 10) : null;
              const hasWorkout = date ? workoutDates.has(date) : false;
              const heatOpacity = hasWorkout ? getHeatmapOpacity(date) : 0;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayCell,
                    status === 'today' && styles.dayCellToday,
                    status === 'future' && styles.dayCellFuture,
                    status === 'empty' && styles.dayCellEmpty,
                  ]}
                  onPress={() => handleDayPress(date)}
                  activeOpacity={hasWorkout ? 0.7 : 1}
                  disabled={!date || status === 'future' || status === 'empty'}
                >
                  {/* Camada de heatmap (intensidade do treino) */}
                  {hasWorkout && (
                    <View
                      style={[
                        styles.heatmapLayer,
                        {
                          backgroundColor: colors.success,
                          opacity: heatOpacity,
                        },
                      ]}
                    />
                  )}

                  {/* Borda especial para "hoje" */}
                  {status === 'today' && (
                    <View style={[styles.heatmapLayer, { backgroundColor: `${colors.primary}20` }]} />
                  )}

                  {dayNum !== null ? (
                    <>
                      <Text style={[
                        styles.dayText,
                        status === 'workout' && styles.dayTextWorkout,
                        status === 'today' && styles.dayTextToday,
                        status === 'future' && styles.dayTextFuture,
                        status === 'rest' && styles.dayTextRest,
                      ]}>
                        {dayNum}
                      </Text>
                      {/* Indicador ponto */}
                      {status === 'workout' && <View style={styles.workoutDot} />}
                      {status === 'today' && <View style={styles.todayDot} />}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legenda com escala de intensidade */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>{t('common.today')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.heatmapLegendRow}>
                {[0.2, 0.45, 0.7, 0.95].map((op, i) => (
                  <View
                    key={i}
                    style={[styles.heatmapLegendCell, { backgroundColor: colors.success, opacity: op }]}
                  />
                ))}
              </View>
              <Text style={styles.legendText}>{t('history.monthlyVolume')}</Text>
            </View>
          </View>
        </View>

        {/* ── Lista recente de treinos ── */}
        {recentWorkouts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('history.title')}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{recentWorkouts.length}</Text>
              </View>
            </View>
            {recentWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onPress={(w) => { setSelectedWorkout(w); setModalVisible(true); }}
              />
            ))}
          </>
        )}

        {recentWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
            <Text style={styles.emptyDesc}>{t('history.emptySub')}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Modal de detalhe do treino ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />

            {selectedWorkout && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{tRoutine(selectedWorkout.title)}</Text>
                    <Text style={styles.modalDate}>
                      {new Date(selectedWorkout.date + 'T12:00:00').toLocaleDateString(
                        language === 'en'
                          ? 'en-US'
                          : language === 'es'
                          ? 'es-ES'
                          : language === 'de'
                          ? 'de-DE'
                          : language === 'fr'
                          ? 'fr-FR'
                          : 'pt-BR',
                        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Resumo rápido */}
                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>{selectedWorkout.exercises.length}</Text>
                    <Text style={styles.modalStatLabel}>{t('history.cardExercises')}</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>
                      {selectedWorkout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
                    </Text>
                    <Text style={styles.modalStatLabel}>{t('history.cardSets')}</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                      {formatWeight(Math.round(selectedWorkout.exercises.reduce((acc, ex) =>
                        acc + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0
                      )))}
                    </Text>
                    <Text style={styles.modalStatLabel}>{t('history.cardVolume')}</Text>
                  </View>
                </View>

                {/* Lista de exercícios */}
                <ScrollView style={styles.modalExerciseList} showsVerticalScrollIndicator={false}>
                  {selectedWorkout.exercises.map((ex) => (
                    <View key={ex.id} style={styles.modalExerciseItem}>
                      <View style={styles.modalExerciseHeader}>
                        <Text style={styles.modalExerciseName}>{tExercise(ex.name)}</Text>
                        {ex.muscle_group ? (
                          <Text style={styles.modalExerciseMuscle}>{tMuscle(ex.muscle_group)}</Text>
                        ) : null}
                      </View>
                      <View style={styles.modalSetsRow}>
                        {ex.sets.map((set, si) => (
                          <View key={set.id} style={styles.modalSetChip}>
                            <Text style={styles.modalSetNum}>{si + 1}</Text>
                            <Text style={styles.modalSetInfo}>{formatWeight(set.weight)} × {set.reps}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Botão Repetir Treino */}
                <TouchableOpacity
                  style={styles.repeatWorkoutBtn}
                  onPress={() => handleRepeatWorkout(selectedWorkout)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.repeatWorkoutBtnText}>⚡ {t('history.repeatWorkout')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

    // ── Header ──
    header: { marginBottom: 16, marginTop: 8 },
    screenTitle: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
    screenSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3, fontWeight: '500' },

    // ── Streak Banner ──
    streakBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: `${colors.streak}12`,
      borderWidth: 1.5,
      borderColor: `${colors.streak}40`,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    streakLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    streakFire: { fontSize: 32 },
    streakTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.streak,
    },
    streakSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    streakRight: {
      alignItems: 'center',
      paddingLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: `${colors.streak}30`,
    },
    streakMaxLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    streakMax: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.streak,
      marginTop: 2,
    },

    // ── Stats ──
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      padding: 12,
      alignItems: 'center',
      gap: 2,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    statSublabel: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textMuted,
      opacity: 0.7,
    },

    // ── Calendário ──
    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      marginBottom: 20,
    },
    monthNavRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    monthNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    monthNavBtnDisabled: { opacity: 0.3 },
    monthNavBtnText: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 },
    monthLabelContainer: {
      alignItems: 'center',
      gap: 1,
    },
    monthLabel: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
    yearLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

    weekdayHeaderRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    weekdayHeaderText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.3,
    },

    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
      marginBottom: 2,
      overflow: 'hidden',
      position: 'relative',
    },
    dayCellEmpty: {},
    dayCellFuture: { opacity: 0.2 },
    dayCellToday: {
      borderWidth: 2,
      borderColor: colors.primary,
    },

    // Camada de heatmap sobreposta
    heatmapLayer: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: 8,
    },

    dayText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      zIndex: 1,
    },
    dayTextWorkout: { color: '#fff', fontWeight: '900' },
    dayTextToday: { color: colors.primary, fontWeight: '900' },
    dayTextFuture: { color: colors.textMuted },
    dayTextRest: { color: colors.textMuted },

    workoutDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.7)',
      marginTop: 1,
      zIndex: 1,
    },
    todayDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 1,
      zIndex: 1,
    },

    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
    heatmapLegendRow: {
      flexDirection: 'row',
      gap: 2,
      alignItems: 'center',
    },
    heatmapLegendCell: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },

    // ── Lista ──
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    sectionBadge: {
      backgroundColor: colors.primaryLight,
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
    },
    sectionBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },

    // ── Empty ──
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    emptyDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },

    // ── Modal ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 20,
      paddingBottom: 36,
      maxHeight: '85%',
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.surfaceBorder,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    modalDate: { fontSize: 12, color: colors.textMuted, marginTop: 3, textTransform: 'capitalize' },
    modalCloseBtn: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1, borderColor: colors.surfaceBorder,
      justifyContent: 'center', alignItems: 'center',
    },
    modalCloseBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },

    modalStats: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    modalStatItem: { flex: 1, alignItems: 'center' },
    modalStatValue: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    modalStatLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
    modalStatDivider: { width: 1, backgroundColor: colors.surfaceBorder, marginVertical: 4 },

    modalExerciseList: { maxHeight: 320 },
    modalExerciseItem: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    modalExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    modalExerciseName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, flex: 1 },
    modalExerciseMuscle: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    modalSetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    modalSetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    modalSetNum: { fontSize: 10, fontWeight: '900', color: colors.primary },
    modalSetInfo: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    repeatWorkoutBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    repeatWorkoutBtnText: {
      color: isDark ? '#0A0D14' : '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
