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
  type DailyHabits,
  type RoutineWithExercises,
  getOrCreateDailyHabits,
  seedDefaultRoutinesIfEmpty,
  getRoutines,
  deleteRoutine,
} from '../database/db';
import { Colors } from '../theme/colors';
import { RoutineCard } from '../components/RoutineCard';
import { RoutineEditorModal } from '../components/RoutineEditorModal';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;


export interface TrainingScreenProps {
  onStartNewWorkout?: () => void;
  onStartRoutine?: (routine: RoutineWithExercises) => void;
}

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayHeaderTitle(): string {
  const d = new Date();
  const formatted = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({
  onStartNewWorkout,
  onStartRoutine,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);

  const [isRoutineModalVisible, setIsRoutineModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineWithExercises | null>(null);

  const todayStr = getTodayIsoString();

  const loadData = useCallback(async () => {
    try {
      await seedDefaultRoutinesIfEmpty();
      const [habits, routineList] = await Promise.all([
        getOrCreateDailyHabits(todayStr),
        getRoutines(),
      ]);
      setDailyHabits(habits);
      setRoutines(routineList);
    } catch (error) {
      console.error('Erro ao carregar dados da TrainingScreen:', error);
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
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando Fichas...</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>
              FOCUS<Text style={styles.brandHighlight}>LIFT</Text>
            </Text>
            <Text style={styles.headerDate}>{getTodayHeaderTitle()}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.freeWorkoutBtn} 
              onPress={() => onStartNewWorkout?.()}
              activeOpacity={0.7}
              accessibilityLabel="Treino Livre"
            >
              <Text style={styles.freeWorkoutIcon}>+</Text>
            </TouchableOpacity>

            <View style={styles.streakBadge}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>
                {dailyHabits ? dailyHabits.streak_count : 0}
              </Text>
              <Text style={styles.streakLabel}>DIAS</Text>
            </View>
          </View>
        </View>

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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carouselScrollView}
            contentContainerStyle={styles.carouselContent}
            snapToInterval={CARD_WIDTH + 14} // width + gap
            decelerationRate="fast"
            snapToAlignment="start"
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
                Criar ficha personalizada com seus próprios exercícios
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

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
    paddingBottom: 100,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  freeWorkoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeWorkoutIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
    lineHeight: 22,
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
    marginTop: 8,
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
    marginHorizontal: -20,
  },
  carouselContent: {
    paddingHorizontal: 20,
    gap: 14,
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
    width: CARD_WIDTH,
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
