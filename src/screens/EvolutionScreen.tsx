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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getExerciseEvolution,
  getWeeklyVolumeByMuscleGroup,
  getDistinctExercises,
  getRoutines,
  getRoutineVolumeEvolution,
  getBodyweightLogs,
  getAllPersonalRecords,
  getLifetimeStats,
  type BodyweightLog,
  type EvolutionChartData,
  type WeeklyVolumeData,
  type RoutineWithExercises,
  type RoutineVolumeData,
  type AnalyticsPeriod,
  type PersonalRecordItem,
  type LifetimeStats,
} from '../database/db';
import { calculate1RMEpley, getPercentageTable } from '../utils/oneRepMax';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import * as Haptics from 'expo-haptics';

const PERIOD_LABELS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
];

// ─── Componente: Barra vertical animada (Gráfico de Exercício) ───────────────
interface AnimatedBarProps {
  data: any;
  index: number;
  maxValue: number;
  color: string;
  dimColor: string;
}

const AnimatedBar: React.FC<AnimatedBarProps> = ({ data, index, maxValue, color, dimColor }) => {
  const anim1RM = useRef(new Animated.Value(0)).current;
  const animWeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(anim1RM, {
        toValue: Math.max(10, (data.estimated1RM / maxValue) * 100),
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(animWeight, {
        toValue: Math.max(5, (data.maxWeight / maxValue) * 100),
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [data, maxValue]);

  const height1RM = anim1RM.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const heightW = animWeight.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2, fontWeight: '700' }}>
        {data.maxWeight > 0 ? `${data.maxWeight}` : ''}
      </Text>
      <View style={{ flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 1, minHeight: 80 }}>
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%' }}>
          <Animated.View style={{ width: '100%', height: height1RM, backgroundColor: dimColor, borderRadius: 3 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%' }}>
          <Animated.View style={{ width: '100%', height: heightW, backgroundColor: color, borderRadius: 3 }} />
        </View>
      </View>
      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontWeight: '600' }} numberOfLines={1}>
        {data.date.split('-').slice(1).join('/')}
      </Text>
    </View>
  );
};

// ─── Componente: Linha de volume por músculo animada ─────────────────────────
interface AnimatedVolumeRowProps {
  vol: any;
  index: number;
  maxSets: number;
  color: string;
  tMuscle?: (m: string) => string;
  setsLabel?: string;
}

const AnimatedVolumeRow: React.FC<AnimatedVolumeRowProps> = ({ vol, index, maxSets, color, tMuscle, setsLabel }) => {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: Math.max(8, (vol.setsCount / maxSets) * 100),
      duration: 550,
      delay: index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [vol, maxSets]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const intensity = Math.min(1, vol.setsCount / maxSets);
  const barColor = intensity > 0.7 ? color : intensity > 0.4 ? `${color}CC` : `${color}80`;

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.9)' }} numberOfLines={1}>
          {tMuscle ? tMuscle(vol.muscleGroup) : vol.muscleGroup}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color }}>
          {vol.setsCount} {setsLabel || 'séries'}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width: widthInterpolated, backgroundColor: barColor, borderRadius: 4 }} />
      </View>
    </View>
  );
};


export const EvolutionScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t, language, unit, formatWeight, tMuscle, tExercise } = useTranslation();
  const styles = makeStyles(colors, isDark);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs principais da tela de Evolução
  const [activeTab, setActiveTab] = useState<'records' | 'charts' | 'calculator' | 'weight'>('records');

  // Período para gráficos
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');

  // Dados globais da carreira
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    totalWorkouts: 0,
    totalVolumeKg: 0,
    totalSets: 0,
    totalReps: 0,
  });

  // Hall de Recordes Pessoais (PRs)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecordItem[]>([]);
  const [prSearch, setPrSearch] = useState('');

  // Gráficos de Exercício
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [evolutionData, setEvolutionData] = useState<EvolutionChartData[]>([]);
  const [volumeData, setVolumeData] = useState<WeeklyVolumeData[]>([]);

  // Fichas
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineWithExercises | null>(null);
  const [routineVolumeData, setRoutineVolumeData] = useState<RoutineVolumeData[]>([]);

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isRoutinePickerVisible, setIsRoutinePickerVisible] = useState(false);
  const [bodyweightData, setBodyweightData] = useState<BodyweightLog[]>([]);

  // Estado da Calculadora de 1RM
  const [calcWeight, setCalcWeight] = useState('80');
  const [calcReps, setCalcReps] = useState('6');

  const loadData = useCallback(async (currentPeriod: AnalyticsPeriod = period) => {
    try {
      // 1. Carrega Estatísticas Globais e PRs
      const [stats, prs, distinctExercises, volData, fetchedRoutines, bwLogs] = await Promise.all([
        getLifetimeStats(),
        getAllPersonalRecords(),
        getDistinctExercises(),
        getWeeklyVolumeByMuscleGroup(currentPeriod),
        getRoutines(),
        getBodyweightLogs(currentPeriod === 'week' ? 7 : currentPeriod === 'month' ? 30 : 0),
      ]);

      setLifetimeStats(stats);
      setPersonalRecords(prs);
      setExercises(distinctExercises);
      setVolumeData(volData);
      setRoutines(fetchedRoutines);
      setBodyweightData(bwLogs);

      // Exercício selecionado
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

      // Ficha selecionada
      if (fetchedRoutines.length > 0) {
        const routineToLoad =
          selectedRoutine && fetchedRoutines.some((r) => r.id === selectedRoutine.id)
            ? selectedRoutine
            : fetchedRoutines[0];
        setSelectedRoutine(routineToLoad);
        const rVolData = await getRoutineVolumeEvolution(routineToLoad.id, currentPeriod);
        setRoutineVolumeData(rVolData);
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
  }, [period, loadData]);

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

  // Cálculo interativo da calculadora 1RM
  const parsedWeight = parseFloat(calcWeight.replace(',', '.')) || 0;
  const parsedReps = parseInt(calcReps, 10) || 1;
  const calculated1RM = parsedWeight > 0 && parsedReps > 0 ? calculate1RMEpley(parsedWeight, parsedReps) : 0;
  const percentageTable = calculated1RM > 0 ? getPercentageTable(calculated1RM, { includeSuggestedReps: true }) : [];

  // Filtragem de PRs por busca
  const filteredPRs = personalRecords.filter((pr) => {
    const q = prSearch.toLowerCase().trim();
    if (!q) return true;
    const translatedName = tExercise(pr.exerciseName).toLowerCase();
    const translatedMuscle = pr.muscleGroup ? tMuscle(pr.muscleGroup).toLowerCase() : '';
    return (
      pr.exerciseName.toLowerCase().includes(q) ||
      translatedName.includes(q) ||
      (pr.muscleGroup && pr.muscleGroup.toLowerCase().includes(q)) ||
      translatedMuscle.includes(q)
    );
  });

  // Métricas do gráfico de linha/barra
  const maxWeightInChart = Math.max(...evolutionData.map((d) => d.estimated1RM), 10);
  const maxSetsInVolume = Math.max(...volumeData.map((d) => d.setsCount), 1);
  const maxTonnageInRoutine = Math.max(...routineVolumeData.map((r) => r.totalTonnage), 1);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando Recordes & Métricas...</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>{t('evolution.title')}</Text>
          <Text style={styles.screenSubtitle}>{t('evolution.trophyRoom')}</Text>
        </View>

        {/* ─── BANNER DE CONQUISTAS DA CARREIRA (LIFETIME STATS) ─── */}
        <View style={styles.lifetimeBanner}>
          <View style={styles.lifetimeCol}>
            <Text style={styles.lifetimeValue}>{lifetimeStats.totalWorkouts}</Text>
            <Text style={styles.lifetimeLabel}>{t('history.totalWorkouts')}</Text>
          </View>
          <View style={styles.lifetimeDivider} />
          <View style={styles.lifetimeCol}>
            <Text style={[styles.lifetimeValue, { color: colors.primary }]}>
              {formatWeight(lifetimeStats.totalVolumeKg)}
            </Text>
            <Text style={styles.lifetimeLabel}>{t('common.volume')}</Text>
          </View>
          <View style={styles.lifetimeDivider} />
          <View style={styles.lifetimeCol}>
            <Text style={styles.lifetimeValue}>{personalRecords.length}</Text>
            <Text style={styles.lifetimeLabel}>{t('evolution.personalRecords')}</Text>
          </View>
        </View>

        {/* ─── SELETOR DE ABAS PRINCIPAIS ─── */}
        <View style={styles.tabsBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'records' && styles.tabBtnActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('records');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'records' && styles.tabBtnTextActive]}>
              🏆 {t('evolution.personalRecords')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'calculator' && styles.tabBtnActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('calculator');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'calculator' && styles.tabBtnTextActive]}>
              🧮 {t('evolution.oneRepMaxCalc')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'charts' && styles.tabBtnActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('charts');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'charts' && styles.tabBtnTextActive]}>
              📈 {t('evolution.title')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'weight' && styles.tabBtnActive]}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setActiveTab('weight');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'weight' && styles.tabBtnTextActive]}>
              ⚖️ {t('profile.bodyweight')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════
            ABA 1: RECORDES PESSOAIS (PRs / HALL DA FAMA)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'records' && (
          <View style={styles.tabContent}>
            {personalRecords.length > 0 && (
              <TextInput
                style={styles.searchBar}
                placeholder="Buscar recorde por exercício ou músculo..."
                placeholderTextColor={colors.textMuted}
                value={prSearch}
                onChangeText={setPrSearch}
                clearButtonMode="while-editing"
              />
            )}

            {filteredPRs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🏆</Text>
                <Text style={styles.emptyTitle}>
                  {personalRecords.length === 0 ? 'Nenhum Recorde Ainda' : 'Nenhum Exercício Encontrado'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {personalRecords.length === 0
                    ? 'Ao concluir suas séries no treino, o FocusLift calcula automaticamente suas cargas máximas e recordes pessoais aqui!'
                    : 'Tente outro termo na busca acima.'}
                </Text>
              </View>
            ) : (
              filteredPRs.map((pr, index) => {
                // Configuração de estilo por posição (ouro / prata / bronze / resto)
                const tierConfig = index === 0
                  ? { medal: '🥇', accent: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', rankLabel: '#1' }
                  : index === 1
                  ? { medal: '🥈', accent: '#94A3B8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)', rankLabel: '#2' }
                  : index === 2
                  ? { medal: '🥉', accent: '#CD7F32', bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.35)', rankLabel: '#3' }
                  : { medal: '⚡', accent: colors.primary, bg: colors.primaryLight, border: `${colors.primary}30`, rankLabel: `#${index + 1}` };

                // Barra de 1RM como percentual do maior PR
                const topPR1RM = filteredPRs[0]?.estimated1RM || 1;
                const barRatio = Math.min(1, pr.estimated1RM / topPR1RM);

                return (
                  <View
                    key={pr.exerciseName}
                    style={[styles.prCard, { backgroundColor: tierConfig.bg, borderColor: tierConfig.border }]}
                  >
                    {/* Barra lateral colorida */}
                    <View style={[styles.prAccentBar, { backgroundColor: tierConfig.accent }]} />

                    <View style={styles.prCardInner}>
                      {/* Header: posição + nome + carga */}
                      <View style={styles.prHeaderRow}>
                        <View style={[styles.prMedalBox, { backgroundColor: `${tierConfig.accent}20` }]}>
                          <Text style={styles.prMedalText}>{tierConfig.medal}</Text>
                        </View>
                        <View style={styles.prExerciseInfo}>
                          <Text style={styles.prExerciseName} numberOfLines={1}>
                            {tExercise(pr.exerciseName)}
                          </Text>
                          {pr.muscleGroup ? (
                            <Text style={styles.prMuscleTag}>{tMuscle(pr.muscleGroup)}</Text>
                          ) : null}
                        </View>
                        <View style={styles.prWeightBox}>
                          <Text style={[styles.prWeightNumber, { color: tierConfig.accent }]}>
                            {formatWeight(pr.maxWeight)}
                          </Text>
                          <Text style={styles.prRepsSub}>
                            {pr.repsAtMaxWeight} {pr.repsAtMaxWeight === 1 ? 'rep' : 'reps'}
                          </Text>
                        </View>
                      </View>

                      {/* Barra de 1RM relativo */}
                      <View style={styles.pr1RMBarRow}>
                        <Text style={[styles.pr1RMLabel, { color: tierConfig.accent }]}>
                          1RM ~{formatWeight(pr.estimated1RM)}
                        </Text>
                        <View style={styles.pr1RMBarTrack}>
                          <View style={[styles.pr1RMBarFill, { width: `${barRatio * 100}%`, backgroundColor: tierConfig.accent }]} />
                        </View>
                        {pr.date ? (
                          <Text style={styles.prDateText}>
                            {pr.date.split('-').slice(1).reverse().join('/')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ABA 2: CALCULADORA DE 1RM & REPETIÇÕES MÁXIMAS
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'calculator' && (
          <View style={styles.tabContent}>
            <View style={styles.calcCard}>
              <Text style={styles.calcTitle}>Calculadora de 1RM</Text>
              <Text style={styles.calcSubtitle}>
                Descubra sua força máxima teórica e planeje as cargas para cada faixa de repetições.
              </Text>

              {/* Inputs de Carga e Repetições */}
              <View style={styles.calcInputsRow}>
                {/* Input Peso */}
                <View style={styles.calcInputCol}>
                  <Text style={styles.calcInputLabel}>Carga (kg)</Text>
                  <View style={styles.calcInputBox}>
                    <TextInput
                      style={styles.calcTextInput}
                      keyboardType="numeric"
                      value={calcWeight}
                      onChangeText={setCalcWeight}
                    />
                    <View style={styles.calcStepperCol}>
                      <TouchableOpacity
                        style={styles.calcMiniBtn}
                        onPress={() => setCalcWeight(String(Math.max(1, (parseFloat(calcWeight) || 0) + 2.5)))}
                      >
                        <Text style={styles.calcMiniBtnText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.calcMiniBtn}
                        onPress={() => setCalcWeight(String(Math.max(1, (parseFloat(calcWeight) || 0) - 2.5)))}
                      >
                        <Text style={styles.calcMiniBtnText}>−</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Input Repetições */}
                <View style={styles.calcInputCol}>
                  <Text style={styles.calcInputLabel}>Repetições Feitas</Text>
                  <View style={styles.calcInputBox}>
                    <TextInput
                      style={styles.calcTextInput}
                      keyboardType="numeric"
                      value={calcReps}
                      onChangeText={setCalcReps}
                    />
                    <View style={styles.calcStepperCol}>
                      <TouchableOpacity
                        style={styles.calcMiniBtn}
                        onPress={() => setCalcReps(String(Math.min(30, (parseInt(calcReps, 10) || 0) + 1)))}
                      >
                        <Text style={styles.calcMiniBtnText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.calcMiniBtn}
                        onPress={() => setCalcReps(String(Math.max(1, (parseInt(calcReps, 10) || 0) - 1)))}
                      >
                        <Text style={styles.calcMiniBtnText}>−</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Destaque do 1RM */}
              <View style={styles.calcResultHero}>
                <Text style={styles.calcHeroLabel}>SUA 1RM ESTIMADA (100%):</Text>
                <Text style={styles.calcHeroValue}>
                  {calculated1RM} <Text style={styles.calcHeroUnit}>kg</Text>
                </Text>
                <Text style={styles.calcHeroFormula}>Baseado na fórmula de Epley (amplamente validada)</Text>
              </View>

              {/* Tabela de Porcentagens de Carga */}
              <Text style={styles.tableHeaderTitle}>📊 Tabela de Cargas por Faixa de Trabalho</Text>
              <View style={styles.percentageTable}>
                {percentageTable.map((item) => (
                  <View key={item.percentage} style={styles.percentageRow}>
                    <View style={styles.percentageBadge}>
                      <Text style={styles.percentageBadgeText}>{item.percentage}%</Text>
                    </View>
                    <Text style={styles.percentageWeight}>{item.weight} kg</Text>
                    <Text style={styles.percentageReps}>
                      {item.suggestedReps ? `~${item.suggestedReps} reps` : ''}
                    </Text>
                    <Text style={styles.percentageGoal}>
                      {item.percentage >= 90
                        ? 'Força Pura'
                        : item.percentage >= 80
                        ? 'Hipertrofia'
                        : item.percentage >= 70
                        ? 'Volume'
                        : 'Aquecimento'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ABA 3: GRÁFICOS DE EVOLUÇÃO
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'charts' && (
          <View style={styles.tabContent}>
            {/* Filtro de Período */}
            <View style={styles.periodFilterRow}>
              {PERIOD_LABELS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
                  onPress={() => setPeriod(p.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.periodBtnText, period === p.value && styles.periodBtnTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Carga Máxima / 1RM do Exercício */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Progressão de Carga por Exercício</Text>

              {exercises.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>Sem histórico ainda</Text>
                  <Text style={styles.emptyDesc}>Complete um treino para ver sua progressão de carga aqui.</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.exerciseSelector}
                  onPress={() => setIsPickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.exerciseSelectorText}>
                    {selectedExercise ? tExercise(selectedExercise) : t('evolution.selectExercise')}
                  </Text>
                  <Text style={styles.exerciseSelectorIcon}>▼</Text>
                </TouchableOpacity>
              )}

              <View style={styles.chartCard}>
                {evolutionData.length === 0 ? (
                  <View style={styles.emptyChartState}>
                    <Text style={styles.emptyChartIcon}>📈</Text>
                    <Text style={styles.emptyText}>Sem dados suficientes para este exercício.</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.chartContainer}>
                      {evolutionData.map((data, index) => (
                        <AnimatedBar
                          key={index}
                          data={data}
                          index={index}
                          maxValue={maxWeightInChart}
                          color={colors.primary}
                          dimColor={`${colors.primary}35`}
                        />
                      ))}
                    </View>
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                        <Text style={styles.legendText}>Carga Real (kg)</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: `${colors.primary}35` }]} />
                        <Text style={styles.legendText}>1RM Estimado</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Volume por Grupo Muscular */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Volume por Grupo Muscular</Text>
              <Text style={styles.sectionSubtitle}>Séries realizadas no período selecionado</Text>

              <View style={styles.volumeCard}>
                {volumeData.length === 0 ? (
                  <View style={styles.emptyChartState}>
                    <Text style={styles.emptyChartIcon}>💪</Text>
                    <Text style={styles.emptyText}>Nenhum volume registrado no período.</Text>
                  </View>
                ) : (
                  volumeData.map((vol, index) => (
                    <AnimatedVolumeRow
                      key={index}
                      vol={vol}
                      index={index}
                      maxSets={maxSetsInVolume}
                      color={colors.primary}
                      tMuscle={tMuscle}
                      setsLabel={t('common.sets')}
                    />
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════
            ABA 4: PESO CORPORAL
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'weight' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>⚖️ Tendência de Peso Corporal</Text>
              <Text style={styles.sectionSubtitle}>
                Acompanhe as oscilações de peso ao longo das semanas
              </Text>

              {bodyweightData.length < 2 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>⚖️</Text>
                  <Text style={styles.emptyTitle}>Sem histórico suficiente</Text>
                  <Text style={styles.emptyDesc}>
                    Registre seu peso corporal na aba Perfil por pelo menos 2 dias para visualizar o gráfico.
                  </Text>
                </View>
              ) : (() => {
                const weights = bodyweightData.map((d) => d.weight_kg);
                const minW = Math.min(...weights);
                const maxW = Math.max(...weights);
                const rangeW = maxW - minW || 1;

                return (
                  <View style={styles.bwChartCard}>
                    <Text style={styles.bwChartAxisLabel}>PESO CORPORAL (kg)</Text>
                    <View style={styles.bwDotsContainer}>
                      {bodyweightData.map((entry, idx) => {
                        const leftPct = bodyweightData.length > 1 ? (idx / (bodyweightData.length - 1)) * 100 : 50;
                        const topPct = 100 - ((entry.weight_kg - minW) / rangeW) * 75 - 12;
                        return (
                          <View key={entry.id} style={[styles.bwDot, { left: `${leftPct}%`, top: `${topPct}%` }]}>
                            <Text style={styles.bwDotLabel}>{entry.weight_kg}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.bwXAxisRow}>
                      {bodyweightData
                        .filter((_, i) => i === 0 || i === bodyweightData.length - 1 || i % Math.ceil(bodyweightData.length / 4) === 0)
                        .map((entry) => (
                          <Text key={entry.id} style={styles.bwXLabel}>
                            {entry.date.slice(5)}
                          </Text>
                        ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL SELETOR DE EXERCÍCIO ─── */}
      <Modal visible={isPickerVisible} transparent animationType="slide" onRequestClose={() => setIsPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('evolution.chooseExercise')}</Text>
              <TouchableOpacity onPress={() => setIsPickerVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {exercises.map((ex) => (
                <TouchableOpacity
                  key={ex}
                  style={[styles.pickerItem, ex === selectedExercise && styles.pickerItemActive]}
                  onPress={() => handleSelectExercise(ex)}
                >
                  <Text style={[styles.pickerItemText, ex === selectedExercise && styles.pickerItemTextActive]}>
                    {tExercise(ex)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Componentes AnimatedBar e AnimatedVolumeRow movidos para antes do EvolutionScreen.

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    screenTitle: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    screenSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // ── Lifetime Banner ──
    lifetimeBanner: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lifetimeCol: {
      flex: 1,
      alignItems: 'center',
    },
    lifetimeValue: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    lifetimeUnit: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    lifetimeLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    lifetimeDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.surfaceBorder,
    },

    // ── Tabs Bar ──
    tabsBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
    },
    tabBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: isDark ? '#0A0D14' : '#FFFFFF',
      fontWeight: '800',
    },

    tabContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },

    // ── Search Bar ──
    searchBar: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 12,
    },

    // ── PR Cards ──
    prCard: {
      borderRadius: 14,
      borderWidth: 1.5,
      marginBottom: 10,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    prAccentBar: {
      width: 4,
      borderTopLeftRadius: 14,
      borderBottomLeftRadius: 14,
    },
    prCardInner: {
      flex: 1,
      padding: 14,
    },
    prHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    prMedalBox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prMedalText: {
      fontSize: 18,
    },
    prExerciseInfo: {
      flex: 1,
    },
    prExerciseName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    prMuscleTag: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
      marginTop: 2,
    },
    prWeightBox: {
      alignItems: 'flex-end',
    },
    prWeightNumber: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    prWeightUnit: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    prRepsSub: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pr1RMBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    pr1RMLabel: {
      fontSize: 11,
      fontWeight: '800',
      minWidth: 90,
    },
    pr1RMBarTrack: {
      flex: 1,
      height: 5,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    pr1RMBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    prDateText: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
      minWidth: 38,
      textAlign: 'right',
    },

    // ── 1RM Calculator ──
    calcCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    calcTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    calcSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
      marginBottom: 16,
    },
    calcInputsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    calcInputCol: {
      flex: 1,
    },
    calcInputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    calcInputBox: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
      alignItems: 'center',
    },
    calcTextInput: {
      flex: 1,
      fontSize: 20,
      fontWeight: '900',
      color: colors.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlign: 'center',
    },
    calcStepperCol: {
      borderLeftWidth: 1,
      borderLeftColor: colors.surfaceBorder,
    },
    calcMiniBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    calcMiniBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    calcResultHero: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(2,132,199,0.08)',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.primary,
      padding: 16,
      alignItems: 'center',
      marginBottom: 20,
    },
    calcHeroLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    calcHeroValue: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.textPrimary,
      marginVertical: 4,
    },
    calcHeroUnit: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    calcHeroFormula: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    tableHeaderTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    percentageTable: {
      gap: 6,
    },
    percentageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    percentageBadge: {
      width: 46,
      paddingVertical: 3,
      backgroundColor: colors.surfaceBorder,
      borderRadius: 6,
      alignItems: 'center',
    },
    percentageBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    percentageWeight: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      flex: 1,
      marginLeft: 12,
    },
    percentageReps: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      width: 70,
    },
    percentageGoal: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },

    // ── Charts Section ──
    periodFilterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    periodBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    periodBtnTextActive: {
      color: isDark ? '#0A0D14' : '#FFF',
    },
    sectionBlock: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    exerciseSelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 12,
    },
    exerciseSelectorText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    exerciseSelectorIcon: {
      color: colors.primary,
      fontSize: 11,
    },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    chartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 140,
      gap: 8,
      paddingTop: 16,
    },
    chartCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barValueLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    barContainer: {
      width: '100%',
      height: '75%',
      justifyContent: 'flex-end',
      position: 'relative',
    },
    bar1RM: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(56, 189, 248, 0.3)',
      borderRadius: 4,
    },
    barWeight: {
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    chartLabel: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 6,
    },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceBorder,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendColor: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },
    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },

    // ── Volume Card ──
    volumeCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 10,
    },
    volumeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    volumeLabelContainer: {
      width: 70,
    },
    volumeMuscle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    volumeWeek: {
      fontSize: 10,
      color: colors.textMuted,
    },
    volumeBarTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.surfaceBorder,
      borderRadius: 4,
      overflow: 'hidden',
    },
    volumeBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    volumeCount: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      width: 50,
      textAlign: 'right',
    },

    // ── Bodyweight Chart Card ──
    bwChartCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    bwChartAxisLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      marginBottom: 10,
      letterSpacing: 0.5,
    },
    bwDotsContainer: {
      height: 120,
      position: 'relative',
      marginHorizontal: 14,
    },
    bwDot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
      marginLeft: -5,
      marginTop: -5,
      alignItems: 'center',
    },
    bwDotLabel: {
      position: 'absolute',
      top: -16,
      fontSize: 9,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    bwXAxisRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceBorder,
    },
    bwXLabel: {
      fontSize: 10,
      color: colors.textMuted,
    },

    // ── Empty States ──
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    emptyIcon: {
      fontSize: 32,
      marginBottom: 10,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    emptyDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyChartState: {
      padding: 24,
      alignItems: 'center',
    },
    emptyChartIcon: {
      fontSize: 24,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // ── Modals ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalCloseText: {
      fontSize: 18,
      color: colors.textMuted,
      fontWeight: '700',
      padding: 4,
    },
    pickerList: {
      maxHeight: 350,
    },
    pickerItem: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    pickerItemActive: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      paddingHorizontal: 8,
    },
    pickerItemText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    pickerItemTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
  });
}
