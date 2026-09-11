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
  getRoutines,
  getRoutineVolumeEvolution,
  type EvolutionChartData,
  type WeeklyVolumeData,
  type RoutineWithExercises,
  type RoutineVolumeData,
  type AnalyticsPeriod,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';

const PERIOD_LABELS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

export const EvolutionScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [period, setPeriod] = useState<AnalyticsPeriod>('all');

  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const [evolutionData, setEvolutionData] = useState<EvolutionChartData[]>([]);
  const [volumeData, setVolumeData] = useState<WeeklyVolumeData[]>([]);

  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineWithExercises | null>(null);
  const [routineVolumeData, setRoutineVolumeData] = useState<RoutineVolumeData[]>([]);

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isRoutinePickerVisible, setIsRoutinePickerVisible] = useState(false);

  const loadData = useCallback(async (currentPeriod: AnalyticsPeriod = period) => {
    try {
      const distinctExercises = await getDistinctExercises();
      setExercises(distinctExercises);

      const volData = await getWeeklyVolumeByMuscleGroup(currentPeriod);
      setVolumeData(volData);

      if (distinctExercises.length === 0) {
        setSelectedExercise(null);
        setEvolutionData([]);
      } else {
        const exerciseToLoad =
          selectedExercise && distinctExercises.includes(selectedExercise)
            ? selectedExercise
            : distinctExercises[0];

        if (exerciseToLoad !== selectedExercise) {
          setSelectedExercise(exerciseToLoad);
        }

        const evoData = await getExerciseEvolution(exerciseToLoad, currentPeriod);
        setEvolutionData(evoData);
      }

      // Rotinas
      const fetchedRoutines = await getRoutines();
      setRoutines(fetchedRoutines);

      let routineToLoad = selectedRoutine;
      if (fetchedRoutines.length > 0) {
        if (!selectedRoutine || !fetchedRoutines.some(r => r.id === selectedRoutine.id)) {
          routineToLoad = fetchedRoutines[0];
          setSelectedRoutine(routineToLoad);
        }
        if (routineToLoad) {
          const rVolData = await getRoutineVolumeEvolution(routineToLoad.id, currentPeriod);
          setRoutineVolumeData(rVolData);
        }
      } else {
        setSelectedRoutine(null);
        setRoutineVolumeData([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de evolução:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, selectedExercise, selectedRoutine]);

  useEffect(() => {
    loadData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(period);
  }, [loadData, period]);

  const handleSelectExercise = async (exercise: string) => {
    setSelectedExercise(exercise);
    setIsPickerVisible(false);
    setLoading(true);
    const evoData = await getExerciseEvolution(exercise, period);
    setEvolutionData(evoData);
    setLoading(false);
  };

  const handleSelectRoutine = async (routine: RoutineWithExercises) => {
    setSelectedRoutine(routine);
    setIsRoutinePickerVisible(false);
    setLoading(true);
    const rVolData = await getRoutineVolumeEvolution(routine.id, period);
    setRoutineVolumeData(rVolData);
    setLoading(false);
  };

  // Cálculo de escala — evita gráfico uniforme quando todos os valores são iguais
  const rawMax1RM = evolutionData.length > 0
    ? Math.max(...evolutionData.map(d => d.estimated1RM))
    : 100;
  const rawMinWeight = evolutionData.length > 0
    ? Math.min(...evolutionData.map(d => d.maxWeight))
    : 0;

  // Se min === max (dados uniformes), aumenta a escala para 20% acima para não ficar tudo 100%
  const isUniformChart = rawMax1RM === rawMinWeight && evolutionData.length > 0;
  const maxWeightInChart = isUniformChart ? rawMax1RM * 1.25 : rawMax1RM;

  const maxSetsInVolume = volumeData.length > 0
    ? Math.max(...volumeData.map(d => d.setsCount))
    : 10;

  const maxTonnageInRoutine = routineVolumeData.length > 0
    ? Math.max(...routineVolumeData.map(d => d.totalTonnage))
    : 1000;
  const minTonnageInRoutine = routineVolumeData.length > 0
    ? Math.min(...routineVolumeData.map(d => d.totalTonnage))
    : 0;
  const isUniformRoutine = maxTonnageInRoutine === minTonnageInRoutine && routineVolumeData.length > 0;
  const effectiveMaxTonnage = isUniformRoutine ? maxTonnageInRoutine * 1.25 : maxTonnageInRoutine;

  if (loading && evolutionData.length === 0 && routineVolumeData.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.primary} />
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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Evolução</Text>
        </View>

        {/* Filtro de Período */}
        <View style={styles.periodFilterRow}>
          {PERIOD_LABELS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.periodBtn,
                period === p.value && styles.periodBtnActive,
              ]}
              onPress={() => setPeriod(p.value)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.periodBtnText,
                period === p.value && styles.periodBtnTextActive,
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Carga Máxima / 1RM */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Progressão de Carga</Text>

          {exercises.length === 0 ? (
            <View style={styles.emptyExerciseState}>
              <Text style={styles.emptyExerciseIcon}>📊</Text>
              <Text style={styles.emptyExerciseTitle}>Sem histórico ainda</Text>
              <Text style={styles.emptyExerciseDesc}>
                Complete um treino para ver sua progressão de carga aqui.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.exerciseSelector}
              onPress={() => setIsPickerVisible(true)}
            >
              <Text style={styles.exerciseSelectorText}>
                {selectedExercise || 'Selecione um exercício'}
              </Text>
              <Text style={styles.exerciseSelectorIcon}>▼</Text>
            </TouchableOpacity>
          )}

          <View style={styles.chartCard}>
            {evolutionData.length === 0 ? (
              <View style={styles.emptyChartState}>
                <Text style={styles.emptyChartIcon}>📈</Text>
                <Text style={styles.emptyText}>
                  {period !== 'all'
                    ? `Nenhum dado nos últimos ${period === 'week' ? '7' : '30'} dias. Experimente "Tudo".`
                    : 'Sem dados suficientes para este exercício.'}
                </Text>
              </View>
            ) : (
              <>
                {isUniformChart && (
                  <Text style={styles.uniformChartNote}>
                    💡 Mínimo 3 sessões com variação de carga para ver tendência clara.
                  </Text>
                )}
                <View style={styles.chartContainer}>
                  {evolutionData.map((data, index) => {
                    const heightPercent = Math.max(10, (data.estimated1RM / maxWeightInChart) * 100);
                    const weightPercent = Math.max(5, (data.maxWeight / maxWeightInChart) * 100);
                    return (
                      <View key={index} style={styles.chartCol}>
                        {/* Label de valor acima da barra */}
                        <Text style={styles.barValueLabel}>
                          {data.maxWeight > 0 ? `${data.maxWeight}` : ''}
                        </Text>
                        <View style={styles.barContainer}>
                          {/* Barra de 1RM (fundo) */}
                          <View style={[styles.bar1RM, { height: `${heightPercent}%` }]} />
                          {/* Barra de Carga Real (frente) */}
                          <View style={[styles.barWeight, { height: `${weightPercent}%` }]} />
                        </View>
                        <Text style={styles.chartLabel} numberOfLines={1}>
                          {data.date.split('-').slice(1).join('/')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                    <Text style={styles.legendText}>Carga Real (kg)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: 'rgba(56, 189, 248, 0.3)' }]} />
                    <Text style={styles.legendText}>Est. 1RM</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Progresso por Ficha */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Progresso por Ficha</Text>
          <Text style={styles.sectionSubtitle}>Volume total (Carga × Reps) por semana</Text>

          {routines.length === 0 ? (
            <View style={styles.emptyExerciseState}>
              <Text style={styles.emptyExerciseIcon}>📋</Text>
              <Text style={styles.emptyExerciseTitle}>Nenhuma ficha criada</Text>
              <Text style={styles.emptyExerciseDesc}>
                Crie uma ficha de treino para acompanhar seu volume semanal.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.exerciseSelector}
              onPress={() => setIsRoutinePickerVisible(true)}
            >
              <Text style={styles.exerciseSelectorText}>
                {selectedRoutine ? selectedRoutine.name : 'Selecione uma ficha'}
              </Text>
              <Text style={styles.exerciseSelectorIcon}>▼</Text>
            </TouchableOpacity>
          )}

          <View style={styles.volumeCard}>
            {routineVolumeData.length === 0 ? (
              <View style={styles.emptyChartState}>
                <Text style={styles.emptyChartIcon}>📉</Text>
                <Text style={styles.emptyText}>
                  {period !== 'all'
                    ? `Sem treinos nos últimos ${period === 'week' ? '7' : '30'} dias para esta ficha.`
                    : 'Sem histórico para esta ficha. Complete um treino para ver dados aqui.'}
                </Text>
              </View>
            ) : (
              <>
                {isUniformRoutine && (
                  <Text style={styles.uniformChartNote}>
                    💡 Dados de apenas uma semana. Continue treinando para ver a evolução.
                  </Text>
                )}
                {routineVolumeData.map((vol, index) => {
                  const widthPercent = Math.max(8, (vol.totalTonnage / effectiveMaxTonnage) * 100);
                  return (
                    <View key={index} style={styles.volumeRow}>
                      <View style={styles.volumeLabelContainer}>
                        <Text style={styles.volumeMuscle} numberOfLines={1}>{vol.week}</Text>
                        <Text style={styles.volumeWeek}>{vol.totalSets} séries</Text>
                      </View>
                      <View style={styles.volumeBarTrack}>
                        <View style={[styles.volumeBarFill, { width: `${widthPercent}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={styles.volumeCount}>{(vol.totalTonnage).toFixed(0)} kg</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>

        {/* Volume Semanal por Grupo Muscular */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Volume por Grupo Muscular</Text>
          <Text style={styles.sectionSubtitle}>Séries realizadas no período selecionado</Text>

          <View style={styles.volumeCard}>
            {volumeData.length === 0 ? (
              <View style={styles.emptyChartState}>
                <Text style={styles.emptyChartIcon}>💪</Text>
                <Text style={styles.emptyText}>
                  {period !== 'all'
                    ? `Nenhum volume registrado nos últimos ${period === 'week' ? '7' : '30'} dias.`
                    : 'Nenhum volume registrado. Complete um treino para ver.'}
                </Text>
              </View>
            ) : (
              volumeData.map((vol, index) => {
                const widthPercent = Math.max(8, (vol.setsCount / maxSetsInVolume) * 100);
                return (
                  <View key={index} style={styles.volumeRow}>
                    <View style={styles.volumeLabelContainer}>
                      <Text style={styles.volumeMuscle} numberOfLines={1}>{vol.muscleGroup}</Text>
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

      {/* Modal Seletor de Ficha */}
      <Modal
        visible={isRoutinePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRoutinePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione a Ficha</Text>
            <ScrollView style={styles.modalScroll}>
              {routines.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.modalItem}
                  onPress={() => handleSelectRoutine(r)}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedRoutine?.id === r.id && styles.modalItemTextSelected
                  ]}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsRoutinePickerVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  centerContainer: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
    marginTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  // Filtro de Período
  periodFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  periodBtnTextActive: {
    color: '#0A0D14',
  },
  sectionBlock: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 12,
  },
  exerciseSelectorText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  exerciseSelectorIcon: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  // Gráfico de barras
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyChartState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyChartIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  uniformChartNote: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 8,
    paddingBottom: 20,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
    position: 'absolute',
    top: 0,
  },
  barContainer: {
    width: '100%',
    height: '85%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar1RM: {
    width: '60%',
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  barWeight: {
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    bottom: 0,
  },
  chartLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    marginTop: 4,
    position: 'absolute',
    bottom: 0,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
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
    color: colors.textSecondary,
    fontSize: 12,
  },
  // Gráficos de Volume (barras horizontais)
  volumeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 14,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeLabelContainer: {
    width: 78,
  },
  volumeMuscle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  volumeWeek: {
    color: colors.textMuted,
    fontSize: 10,
  },
  volumeBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 5,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  volumeCount: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    width: 52,
    textAlign: 'right',
  },
  // Estado vazio com exercício mas sem dados
  emptyExerciseState: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyExerciseIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyExerciseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyExerciseDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modais
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    color: colors.textPrimary,
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
    borderBottomColor: colors.surfaceBorder,
  },
  modalItemText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalCloseBtn: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
}
