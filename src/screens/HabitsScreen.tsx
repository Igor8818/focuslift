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
  getOrCreateDailyHabits,
  upsertDailyHabits,
} from '../database/db';
import { Colors } from '../theme/colors';
import { HabitsCompactBar } from '../components/HabitsCompactBar';
import { useAuth } from '../contexts/AuthContext';

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const HabitsScreen: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);

  const todayStr = getTodayIsoString();

  const loadData = useCallback(async () => {
    try {
      const habits = await getOrCreateDailyHabits(todayStr);
      setDailyHabits(habits);
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

  const handleToggleHabit = async (
    habitKey: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done'
  ) => {
    if (!dailyHabits) return;

    const previousHabits = { ...dailyHabits };
    const currentVal = dailyHabits[habitKey];
    const newVal = currentVal ? 0 : 1;

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

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando Hábitos...</Text>
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
          <Text style={styles.screenTitle}>Hábitos Diários</Text>
        </View>

        <HabitsCompactBar
          habits={dailyHabits}
          onToggleHabit={handleToggleHabit}
          onUpdateWater={handleUpdateWater}
          onUpdateProtein={handleUpdateProtein}
        />

      </ScrollView>
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
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
});
