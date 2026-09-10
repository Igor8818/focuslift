import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type WorkoutWithDetails, getRecentWorkouts } from '../database/db';
import { Colors } from '../theme/colors';
import { WorkoutCard } from '../components/WorkoutCard';

export interface HistoryScreenProps {
  onSelectWorkout?: (workout: WorkoutWithDetails) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onSelectWorkout }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutWithDetails[]>([]);

  const loadData = useCallback(async () => {
    try {
      const workouts = await getRecentWorkouts(50);
      setRecentWorkouts(workouts);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Carregando Histórico...</Text>
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
          <Text style={styles.screenTitle}>Histórico</Text>
        </View>

        <View style={styles.sectionBlock}>
          {recentWorkouts.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>📅</Text>
              </View>
              <Text style={styles.emptyTitle}>Nenhum treino no histórico</Text>
              <Text style={styles.emptyDescription}>
                Termine um treino para ver seu histórico aqui.
              </Text>
            </View>
          ) : (
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
  sectionBlock: {
    marginBottom: 24,
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
});
