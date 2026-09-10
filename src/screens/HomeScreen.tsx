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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type WorkoutWithDetails,
  type DailyHabits,
  type RoutineWithExercises,
  getOrCreateDailyHabits,
  upsertDailyHabits,
  getRecentWorkouts,
  seedDefaultRoutinesIfEmpty,
  getRoutines,
  deleteRoutine,
} from '../database/db';
import { Colors } from '../theme/colors';
import { HabitsCompactBar } from '../components/HabitsCompactBar';
import { RoutineCard } from '../components/RoutineCard';
import { RoutineEditorModal } from '../components/RoutineEditorModal';
import { WorkoutCard } from '../components/WorkoutCard';
import { FAB } from '../components/FAB';

export interface HomeScreenProps {
  onStartNewWorkout?: () => void;
  onStartRoutine?: (routine: RoutineWithExercises) => void;
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
  onStartRoutine,
  onSelectWorkout,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutWithDetails[]>([]);
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);

  // Estado para modal de criação/edição de rotinas
  const [isRoutineModalVisible, setIsRoutineModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithExercises | null>(null);

  const todayStr = getTodayIsoString();

  /**
   * Carrega hábitos do dia, lista de fichas (semeando se necessário) e treinos recentes.
   */
  const loadData = useCallback(async () => {
    try {
      // 1. Garante que as rotinas padrão (Push, Pull, Legs) existam no primeiro acesso
      await seedDefaultRoutinesIfEmpty();

      // 2. Busca hábitos, treinos recentes e fichas em paralelo
      const [habits, workouts, routineList] = await Promise.all([
        getOrCreateDailyHabits(todayStr),
        getRecentWorkouts(10),
        getRoutines(),
      ]);

      setDailyHabits(habits);
      setRecentWorkouts(workouts);
      setRoutines(routineList);
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
  const handleToggleHabit = async (
    habitKey: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done'
  ) => {
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
      setDailyHabits(previousHabits);
    }
  };

  /**
   * Atualiza consumo de água em ml com persistência
   */
  const handleUpdateWater = async (amountMl: number) => {
    if (!dailyHabits) return;
    const previous = { ...dailyHabits };
    const waterTarget = dailyHabits.water_target_ml || 3000;
    const isDone = amountMl >= waterTarget ? 1 : 0;

    setDailyHabits({
      ...dailyHabits,
      water_current_ml: amountMl,
      water_done: isDone,
    });

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        water_current_ml: amountMl,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error('Erro ao atualizar água:', error);
      setDailyHabits(previous);
    }
  };

  /**
   * Atualiza consumo de proteína em gramas com persistência
   */
  const handleUpdateProtein = async (amountG: number) => {
    if (!dailyHabits) return;
    const previous = { ...dailyHabits };
    const proteinTarget = dailyHabits.protein_target_g || 160;
    const isDone = amountG >= proteinTarget ? 1 : 0;

    setDailyHabits({
      ...dailyHabits,
      protein_current_g: amountG,
      protein_done: isDone,
    });

    try {
      const saved = await upsertDailyHabits({
        date: todayStr,
        protein_current_g: amountG,
      });
      setDailyHabits(saved);
    } catch (error) {
      console.error('Erro ao atualizar proteína:', error);
      setDailyHabits(previous);
    }
  };

  // Funções de Gestão de Fichas (CRUD)
  const handleOpenCreateRoutine = () => {
    setEditingRoutine(null);
    setIsRoutineModalVisible(true);
  };

  const handleOpenEditRoutine = (routine: RoutineWithExercises) => {
    setEditingRoutine(routine);
    setIsRoutineModalVisible(true);
  };

  const handleDeleteRoutine = async (routine: RoutineWithExercises) => {
    try {
      await deleteRoutine(routine.id);
      setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
    } catch (error) {
      console.error('Erro ao excluir rotina:', error);
      Alert.alert('Erro', 'Não foi possível excluir a ficha.');
    }
  };

  const handleRoutineSaved = (saved: RoutineWithExercises) => {
    setRoutines((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      if (exists) {
        return prev.map((r) => (r.id === saved.id ? saved : r));
      }
      return [...prev, saved];
    });
  };

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
            HEADER DA TELA: BRANDING & STREAK
            ================================================================= */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              FOCUS<Text style={styles.brandHighlight}>LIFT</Text>
            </Text>
            <Text style={styles.headerDate}>{getTodayHeaderTitle()}</Text>
          </View>

          {/* Badge de Streak de Fogo */}
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>
              {dailyHabits ? dailyHabits.streak_count : 0}
            </Text>
            <Text style={styles.streakLabel}>DIAS</Text>
          </View>
        </View>

        {/* =================================================================
            1. SEÇÃO SUPERIOR COMPACTA: HÁBITOS DIÁRIOS (HORIZONTAL BAR)
            ================================================================= */}
        <HabitsCompactBar
          habits={dailyHabits}
          onToggleHabit={handleToggleHabit}
          onUpdateWater={handleUpdateWater}
          onUpdateProtein={handleUpdateProtein}
        />

        {/* =================================================================
            2. DESTAQUE CENTRAL: CARROSSEL DE MINHAS FICHAS (SPLITS)
            ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.sectionTitle}>Minhas Fichas</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{routines.length}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.createRoutineHeaderBtn}
              onPress={handleOpenCreateRoutine}
              activeOpacity={0.75}
            >
              <Text style={styles.createRoutineHeaderBtnText}>+ Nova Ficha</Text>
            </TouchableOpacity>
          </View>

          {/* Carrossel Horizontal com padding confortável */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carouselScrollView}
            contentContainerStyle={styles.carouselContent}
          >
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onStartRoutine={(r) => {
                  if (onStartRoutine) {
                    onStartRoutine(r);
                  } else if (onStartNewWorkout) {
                    onStartNewWorkout();
                  }
                }}
                onEdit={handleOpenEditRoutine}
                onDelete={handleDeleteRoutine}
              />
            ))}

            {/* Card Final Fixo: + Nova Ficha */}
            <TouchableOpacity
              style={styles.newRoutineCard}
              onPress={handleOpenCreateRoutine}
              activeOpacity={0.8}
            >
              <View style={styles.newRoutineIconCircle}>
                <Text style={styles.newRoutinePlusIcon}>+</Text>
              </View>
              <Text style={styles.newRoutineTitle}>Nova Ficha</Text>
              <Text style={styles.newRoutineSubtitle}>
                Criar ficha de treino personalizada com seus próprios exercícios
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* =================================================================
            3. SEÇÃO INFERIOR: TREINOS RECENTES
            ================================================================= */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.sectionTitle}>Treinos Recentes</Text>
              {recentWorkouts.length > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{recentWorkouts.length}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {recentWorkouts.length === 0 ? (
            /* Estado vazio amigável */
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🏋️‍♂️</Text>
              </View>
              <Text style={styles.emptyTitle}>Nenhum treino registrado ainda</Text>
              <Text style={styles.emptyDescription}>
                Escolha uma das fichas acima ou inicie um treino livre para registrar cargas e séries.
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
            /* Lista de Treinos Anteriores */
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
          BOTÃO DE AÇÃO RÁPIDA (FAB)
          ================================================================= */}
      <FAB
        label="Treino Livre"
        onPress={() => onStartNewWorkout?.()}
      />

      {/* =================================================================
          MODAL DE CRIAÇÃO / EDIÇÃO DE ROTINAS
          ================================================================= */}
      <RoutineEditorModal
        visible={isRoutineModalVisible}
        routine={editingRoutine}
        onClose={() => setIsRoutineModalVisible(false)}
        onSave={handleRoutineSaved}
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
    paddingTop: 12,
    paddingBottom: 100, // Espaço para não cobrir o FAB
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.streak,
    shadowColor: Colors.streak,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  streakFire: {
    fontSize: 16,
    marginRight: 5,
  },
  streakCount: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginRight: 4,
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.streak,
    letterSpacing: 0.5,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  carouselScrollView: {
    marginHorizontal: -20, // Sangria para preencher a tela inteira
  },
  carouselContent: {
    paddingHorizontal: 20, // Padding confortável para início e fim da rolagem
    gap: 14,
  },
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '800',
  },
  createRoutineHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  createRoutineHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  newRoutineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    borderStyle: 'dashed',
    width: 240,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newRoutineIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  newRoutinePlusIcon: {
    fontSize: 26,
    color: Colors.primary,
    fontWeight: '900',
    lineHeight: 28,
  },
  newRoutineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  newRoutineSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
});
