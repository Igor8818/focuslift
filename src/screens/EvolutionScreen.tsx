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
  getExerciseEvolution,
  getWeeklyVolumeByMuscleGroup,
  getDistinctExercises,
  type EvolutionChartData,
  type WeeklyVolumeData,
} from '../database/db';
import { Colors } from '../theme/colors';

export const EvolutionScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  
  const [evolutionData, setEvolutionData] = useState<EvolutionChartData[]>([]);
  const [volumeData, setVolumeData] = useState<WeeklyVolumeData[]>([]);
  
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const distinctExercises = await getDistinctExercises();
      setExercises(distinctExercises);
      
      const volData = await getWeeklyVolumeByMuscleGroup();
      setVolumeData(volData);
      
      if (distinctExercises.length > 0 && !selectedExercise) {
        setSelectedExercise(distinctExercises[0]);
      }
      
      if (selectedExercise || distinctExercises.length > 0) {
        const evoData = await getExerciseEvolution(selectedExercise || distinctExercises[0]);
        setEvolutionData(evoData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de evolução:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExercise]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSelectExercise = (exercise: string) => {
    setSelectedExercise(exercise);
    setIsPickerVisible(false);
    setLoading(true); // force reload for new exercise
  };

  // Funções simples para achar min/max e desenhar barras
  const maxWeightInChart = evolutionData.length > 0 
    ? Math.max(...evolutionData.map(d => d.estimated1RM)) 
    : 100;
    
  const maxSetsInVolume = volumeData.length > 0
    ? Math.max(...volumeData.map(d => d.setsCount))
    : 10;

  if (loading && evolutionData.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Calculando Métricas...</Text>
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
          <Text style={styles.screenTitle}>Evolução</Text>
        </View>

        {/* Carga Máxima / 1RM */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Progressão de Carga</Text>
          
          <TouchableOpacity 
            style={styles.exerciseSelector}
            onPress={() => setIsPickerVisible(true)}
          >
            <Text style={styles.exerciseSelectorText}>
              {selectedExercise || 'Selecione um exercício'}
            </Text>
            <Text style={styles.exerciseSelectorIcon}>▼</Text>
          </TouchableOpacity>
          
          <View style={styles.chartCard}>
            {evolutionData.length === 0 ? (
              <Text style={styles.emptyText}>Sem dados suficientes para este exercício.</Text>
            ) : (
              <View style={styles.chartContainer}>
                {evolutionData.map((data, index) => {
                  const heightPercent = Math.max(10, (data.estimated1RM / maxWeightInChart) * 100);
                  const weightPercent = Math.max(5, (data.maxWeight / maxWeightInChart) * 100);
                  return (
                    <View key={index} style={styles.chartCol}>
                      <View style={styles.barContainer}>
                        {/* Barra de 1RM (Fundo) */}
                        <View style={[styles.bar1RM, { height: `${heightPercent}%` }]} />
                        {/* Barra de Carga Real (Frente) */}
                        <View style={[styles.barWeight, { height: `${weightPercent}%` }]} />
                      </View>
                      <Text style={styles.chartLabel} numberOfLines={1}>
                        {data.date.split('-').slice(1).join('/')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            {evolutionData.length > 0 && (
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>Carga Real</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: 'rgba(56, 189, 248, 0.3)' }]} />
                  <Text style={styles.legendText}>Est. 1RM</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Volume Semanal */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Volume Semanal</Text>
          
          <View style={styles.volumeCard}>
            {volumeData.length === 0 ? (
               <Text style={styles.emptyText}>Nenhum volume registrado.</Text>
            ) : (
              volumeData.map((vol, index) => {
                const widthPercent = Math.max(5, (vol.setsCount / maxSetsInVolume) * 100);
                return (
                  <View key={index} style={styles.volumeRow}>
                    <View style={styles.volumeLabelContainer}>
                      <Text style={styles.volumeMuscle}>{vol.muscleGroup}</Text>
                      <Text style={styles.volumeWeek}>{vol.week}</Text>
                    </View>
                    <View style={styles.volumeBarTrack}>
                      <View style={[styles.volumeBarFill, { width: `${widthPercent}%` }]} />
                    </View>
                    <Text style={styles.volumeCount}>{vol.setsCount} séries</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal Seletor de Exercício */}
      <Modal
        visible={isPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione o Exercício</Text>
            <ScrollView style={styles.modalScroll}>
              {exercises.map((ex) => (
                <TouchableOpacity
                  key={ex}
                  style={styles.modalItem}
                  onPress={() => handleSelectExercise(ex)}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedExercise === ex && styles.modalItemTextSelected
                  ]}>
                    {ex}
                  </Text>
                </TouchableOpacity>
              ))}
              {exercises.length === 0 && (
                <Text style={styles.emptyText}>Nenhum exercício registrado.</Text>
              )}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setIsPickerVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 16,
  },
  exerciseSelectorText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseSelectorIcon: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    gap: 12,
    paddingBottom: 24,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar1RM: {
    width: '60%',
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  barWeight: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  chartLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 8,
    position: 'absolute',
    bottom: 0,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  volumeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 16,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeLabelContainer: {
    width: 80,
  },
  volumeMuscle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  volumeWeek: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  volumeBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 6,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  volumeCount: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    width: 50,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalScroll: {
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  modalItemText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  modalItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalCloseBtn: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
