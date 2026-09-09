import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {
  type WorkoutWithDetails,
  type DailyHabits,
  getOrCreateDailyHabits,
  upsertDailyHabits,
  getRecentWorkouts,
} from '../database/db';
import { Colors } from '../theme/colors';
import { HabitCheckbox } from '../components/HabitCheckbox';
import { WorkoutCard } from '../components/WorkoutCard';
import { FAB } from '../components/FAB';

export interface HomeScreenProps {
  onStartNewWorkout?: () => void;
  onSelectWorkout?: (workout: WorkoutWithDetails) => void;
}

/**
 * Retorna a data local de hoje no formato YYYY-MM-DD compatível com o banco de dados.
 */
function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data de hoje formatada em português (ex.: "Quarta-feira, 9 de Setembro").
 */
function getTodayHeaderTitle(): string {
  const d = new Date();
  const formatted = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartNewWorkout,
  onSelectWorkout,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutWithDetails[]>([]);

  const todayStr = getTodayIsoString();

  /**
   * Carrega hábitos do dia e lista de treinos recentes a partir do banco de dados SQLite.
   */
  const loadData = useCallback(async () => {
    try {
      const [habits, workouts] = await Promise.all([
        getOrCreateDailyHabits(todayStr),
        getRecentWorkouts(10),
      ]);
      setDailyHabits(habits);
      setRecentWorkouts(workouts);
    } catch (error) {
      console.error('Erro ao carregar dados da HomeScreen:', error);
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

  /**
   * Alterna o estado de um hábito do dia com atualização otimista imediata
   * e persistência assíncrona no SQLite.
   */
  const handleToggleHabit = async (habitKey: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done') => {
    if (!dailyHabits) return;

    const previousHabits = { ...dailyHabits };
    const currentVal = dailyHabits[habitKey];
    const newVal = currentVal ? 0 : 1;

    // Atualização otimista no estado local
    const updatedLocal = {
      ...dailyHabits,
      [habitKey]: newVal,
    };
    setDailyHabits(updatedLocal);

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        [habitKey]: newVal,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error(`Erro ao atualizar o hábito ${habitKey}:`, error);
      // Reverter para o estado anterior em caso de erro
      setDailyHabits(previousHabits);
    }
  };

  // Cálculo de progresso dos hábitos
  const habitsList = dailyHabits
    ? [
        {
          key: 'protein_done' as const,
          label: 'Meta de Proteína',
          sublabel: 'Bateu a meta de macronutrientes hoje',
          icon: '🍗',
          color: Colors.protein,
          checked: !!dailyHabits.protein_done,
        },
        {
          key: 'water_done' as const,
          label: 'Hidratação (Água)',
          sublabel: 'Consumiu a quantidade de água recomendada',
          icon: '💧',
          color: Colors.water,
          checked: !!dailyHabits.water_done,
        },
        {
          key: 'workout_done' as const,
          label: 'Treino Realizado',
          sublabel: 'Treino do dia concluído com disciplina',
          icon: '🏋️',
          color: Colors.workout,
          checked: !!dailyHabits.workout_done,
        },
        {
          key: 'meals_done' as const,
          label: 'Refeições Planejadas',
          sublabel: 'Seguiu o plano nutricional diário',
          icon: '🥗',
          color: Colors.meals,
          checked: !!dailyHabits.meals_done,
        },
      ]
    : [];

  const completedHabitsCount = habitsList.filter((h) => h.checked).length;
  const totalHabitsCount = habitsList.length;
  const progressPercent = totalHabitsCount > 0 ? (completedHabitsCount / totalHabitsCount) * 100 : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando FocusLift...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* =================================================================
            HEADER DA TELA
            ================================================================= */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              FOCUS<Text style={styles.brandHighlight}>LIFT</Text>
            </Text>
            <Text style={styles.headerDate}>{getTodayHeaderTitle()}</Text>
          </View>

          {/* Badge de Streak de Alto Contraste */}
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>
              {dailyHabits ? dailyHabits.streak_count : 0}
            </Text>
            <Text style={styles.streakLabel}>DIAS</Text>
          </View>
        </View>

        {/* =================================================================
            1. SEÇÃO SUPERIOR: HÁBITOS DIÁRIOS
            ================================================================= */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Hábitos de Hoje</Text>
              <Text style={styles.sectionSubtitle}>
                {completedHabitsCount} de {totalHabitsCount} concluídos
              </Text>
            </View>

            <View style={styles.progressPercentBadge}>
              <Text style={styles.progressPercentText}>
                {Math.round(progressPercent)}%
              </Text>
            </View>
          </View>

          {/* Barra de Progresso Visual */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
                progressPercent === 100 && { backgroundColor: Colors.success },
              ]}
            />
          </View>

          {/* Lista de Hábitos */}
          <View style={styles.habitsListContainer}>
            {habitsList.map((habit) => (
              <HabitCheckbox
                key={habit.key}
                label={habit.label}
                sublabel={habit.sublabel}
                icon={habit.icon}
                accentColor={habit.color}
                checked={habit.checked}
                onToggle={() => handleToggleHabit(habit.key)}
              />
            ))}
          </View>
        </View>

        {/* =================================================================
            2. SEÇÃO CENTRAL: TREINOS RECENTES
            ================================================================= */}
        <View style={styles.workoutsSection}>
          <View style={styles.workoutsHeaderRow}>
            <Text style={styles.sectionTitle}>Treinos Recentes</Text>
            {recentWorkouts.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{recentWorkouts.length}</Text>
              </View>
            ) : null}
          </View>

          {recentWorkouts.length === 0 ? (
            /* Estado vazio amigável */
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🏋️‍♂️</Text>
              </View>
              <Text style={styles.emptyTitle}>Nenhum treino registrado ainda</Text>
              <Text style={styles.emptyDescription}>
                Comece sua jornada hoje! Registre seu treino para acompanhar
                exercícios, séries e progressão de carga.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={onStartNewWorkout}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyButtonText}>Começar Primeiro Treino</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Lista de Cards de Treinos */
            recentWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onPress={onSelectWorkout}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* =================================================================
          3. BOTÃO DE AÇÃO RÁPIDA (FAB)
          ================================================================= */}
      <FAB
        label="Novo Treino"
        onPress={() => onStartNewWorkout?.()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100, // Espaço para não sobrepor o FAB
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  brandHighlight: {
    color: Colors.primary,
  },
  headerDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.streak,
    shadowColor: Colors.streak,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  streakFire: {
    fontSize: 18,
    marginRight: 6,
  },
  streakCount: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginRight: 4,
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.streak,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressPercentBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  habitsListContainer: {
    marginTop: 4,
  },
  workoutsSection: {
    marginTop: 4,
  },
  workoutsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  countBadge: {
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 28,
    alignItems: 'center',
    marginTop: 6,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyIcon: {
    fontSize: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '800',
  },
});
