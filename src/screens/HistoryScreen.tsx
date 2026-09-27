import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type WorkoutWithDetails,
  getRecentWorkouts,
  getDailyHabits,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { WorkoutCard } from '../components/WorkoutCard';

// ─── Helpers de data ───────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayIso(): string {
  return toIsoDate(new Date());
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DayStatus = 'workout' | 'rest' | 'today' | 'future' | 'empty';

interface DayMeta {
  date: string;
  status: DayStatus;
  workoutTitle?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const HistoryScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const today = getTodayIso();
  const todayDate = new Date();

  // Mês exibido atualmente
  const [displayYear, setDisplayYear] = useState(todayDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(todayDate.getMonth());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mapas de data → info
  const [workoutByDate, setWorkoutByDate] = useState<Map<string, WorkoutWithDetails>>(new Map());
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());

  // Treino selecionado para preview
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Lista de treinos recentes (para scroll abaixo)
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutWithDetails[]>([]);

  const loadData = useCallback(async () => {
    try {
      const workouts = await getRecentWorkouts(200);
      const byDate = new Map<string, WorkoutWithDetails>();
      const dates = new Set<string>();
      for (const w of workouts) {
        byDate.set(w.date, w);
        dates.add(w.date);
      }
      setWorkoutByDate(byDate);
      setWorkoutDates(dates);
      setRecentWorkouts(workouts.slice(0, 30));
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

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

  const handleDayPress = (date: string | null) => {
    if (!date || date > today) return;
    const workout = workoutByDate.get(date);
    if (workout) {
      setSelectedWorkout(workout);
      setModalVisible(true);
    }
  };

  const prevMonth = () => {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  };

  const nextMonth = () => {
    const now = new Date();
    if (displayYear > now.getFullYear() || (displayYear === now.getFullYear() && displayMonth >= now.getMonth())) return;
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
  const monthRestDays = monthPastDays - monthWorkoutDays;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando Calendário...</Text>
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
          <Text style={styles.screenTitle}>Histórico</Text>
          <Text style={styles.screenSubtitle}>Seus treinos e dias de descanso</Text>
        </View>

        {/* ── Card do Calendário ── */}
        <View style={styles.calendarCard}>
          {/* Navegação de mês */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} activeOpacity={0.7}>
              <Text style={styles.monthNavBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[displayMonth]} {displayYear}
            </Text>
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
            {WEEKDAY_SHORT.map(d => (
              <Text key={d} style={styles.weekdayHeaderText}>{d}</Text>
            ))}
          </View>

          {/* Grid de dias */}
          <View style={styles.daysGrid}>
            {calendarCells.map((date, idx) => {
              const status = getDayStatus(date);
              const dayNum = date ? parseInt(date.split('-')[2], 10) : null;
              const hasWorkout = date ? workoutDates.has(date) : false;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayCell,
                    status === 'workout' && styles.dayCellWorkout,
                    status === 'today' && styles.dayCellToday,
                    status === 'rest' && styles.dayCellRest,
                    status === 'future' && styles.dayCellFuture,
                    status === 'empty' && styles.dayCellEmpty,
                  ]}
                  onPress={() => handleDayPress(date)}
                  activeOpacity={hasWorkout ? 0.75 : 1}
                  disabled={!date || status === 'future' || status === 'empty'}
                >
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
                      {status === 'workout' && <View style={styles.workoutDot} />}
                      {status === 'rest' && <View style={styles.restDot} />}
                      {status === 'today' && <View style={styles.todayDot} />}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legenda */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Treino</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.surfaceBorder }]} />
              <Text style={styles.legendText}>Descanso</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Hoje</Text>
            </View>
          </View>
        </View>

        {/* ── Stats do mês ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{monthWorkoutDays}</Text>
            <Text style={styles.statLabel}>treinos</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.statValue, { color: colors.textSecondary }]}>{monthRestDays}</Text>
            <Text style={styles.statLabel}>descanso</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.streak }]}>
            <Text style={[styles.statValue, { color: colors.streak }]}>
              {monthPastDays > 0 ? Math.round((monthWorkoutDays / monthPastDays) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>consistência</Text>
          </View>
        </View>

        {/* ── Lista recente de treinos ── */}
        {recentWorkouts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Treinos Recentes</Text>
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
            <Text style={styles.emptyTitle}>Nenhum treino ainda</Text>
            <Text style={styles.emptyDesc}>Complete um treino para vê-lo aqui no calendário.</Text>
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
                    <Text style={styles.modalTitle}>{selectedWorkout.title}</Text>
                    <Text style={styles.modalDate}>
                      {new Date(selectedWorkout.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
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
                    <Text style={styles.modalStatLabel}>exercícios</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatValue}>
                      {selectedWorkout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
                    </Text>
                    <Text style={styles.modalStatLabel}>séries</Text>
                  </View>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStatItem}>
                    <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                      {Math.round(selectedWorkout.exercises.reduce((acc, ex) =>
                        acc + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0
                      )).toLocaleString('pt-BR')} kg
                    </Text>
                    <Text style={styles.modalStatLabel}>volume</Text>
                  </View>
                </View>

                {/* Lista de exercícios */}
                <ScrollView style={styles.modalExerciseList} showsVerticalScrollIndicator={false}>
                  {selectedWorkout.exercises.map((ex) => (
                    <View key={ex.id} style={styles.modalExerciseItem}>
                      <View style={styles.modalExerciseHeader}>
                        <Text style={styles.modalExerciseName}>{ex.name}</Text>
                        {ex.muscle_group ? (
                          <Text style={styles.modalExerciseMuscle}>{ex.muscle_group}</Text>
                        ) : null}
                      </View>
                      <View style={styles.modalSetsRow}>
                        {ex.sets.map((set, si) => (
                          <View key={set.id} style={styles.modalSetChip}>
                            <Text style={styles.modalSetNum}>{si + 1}</Text>
                            <Text style={styles.modalSetInfo}>{set.weight}kg × {set.reps}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
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

    // ── Calendário ──
    calendarCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
      marginBottom: 14,
    },
    monthNavRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
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
    monthLabel: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },

    weekdayHeaderRow: {
      flexDirection: 'row',
      marginBottom: 8,
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
      borderRadius: 10,
      marginBottom: 3,
    },
    dayCellEmpty: {},
    dayCellFuture: { opacity: 0.25 },
    dayCellWorkout: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(5,150,105,0.12)',
      borderWidth: 1.5,
      borderColor: colors.success,
    },
    dayCellToday: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(2,132,199,0.1)',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    dayCellRest: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    },

    dayText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    dayTextWorkout: { color: colors.success, fontWeight: '900' },
    dayTextToday: { color: colors.primary, fontWeight: '900' },
    dayTextFuture: { color: colors.textMuted },
    dayTextRest: { color: colors.textMuted },

    workoutDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: colors.success,
      marginTop: 2,
    },
    restDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: colors.surfaceBorder,
      marginTop: 2,
    },
    todayDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 2,
    },

    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

    // ── Stats ──
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.success,
      padding: 14,
      alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '900', color: colors.success },
    statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },

    // ── Lista ──
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 12,
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
  });
}
