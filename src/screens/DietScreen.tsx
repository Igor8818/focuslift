import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import {
  getActiveDietPlan,
  deleteActiveDietPlan,
  getDietMealLogsForDate,
  getDietMealLogsRange,
  toggleDietMealCompletion,
  saveDietMealSelectedOption,
  getOrCreateDailyHabits,
  upsertDailyHabits,
  type StoredDietPlan,
  type DietMealLog,
  type DailyHabits,
} from '../database/db';
import { ImportDietModal } from '../components/ImportDietModal';
import { todayLocalIso, toLocalIsoDate } from '../utils/date';
import { estimateMealProteinG } from '../utils/dietProteinEstimator';
import {
  areDietRemindersEnabled,
  cancelDietMealReminders,
  scheduleDietMealReminders,
} from '../services/notificationService';
import type { ParsedDietMeal } from '../utils/dietTextParser';

function isIsoWeekend(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

interface WeekDayCell {
  iso: string;
  label: string;
  dayNum: number;
  isWeekend: boolean;
  isToday: boolean;
}

const WEEKDAY_SHORT_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildCurrentWeekDays(todayIso: string): WeekDayCell[] {
  const [y, m, d] = todayIso.split('-').map(Number);
  const base = y && m && d ? new Date(y, m - 1, d) : new Date();
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);

  const days: WeekDayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const iso = toLocalIsoDate(cur);
    const dow = cur.getDay();
    days.push({
      iso,
      label: WEEKDAY_SHORT_LABELS[dow],
      dayNum: cur.getDate(),
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === todayIso,
    });
  }
  return days;
}

export const DietScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { language } = useTranslation();
  const isPt = language === 'pt';

  const todayIso = todayLocalIso();
  const weekDays = buildCurrentWeekDays(todayIso);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [storedPlan, setStoredPlan] = useState<StoredDietPlan | null>(null);
  const [mealLogs, setMealLogs] = useState<Record<string, DietMealLog>>({});
  const [weekLogs, setWeekLogs] = useState<Record<string, Record<string, DietMealLog>>>({});
  const [dailyHabits, setDailyHabits] = useState<DailyHabits | null>(null);
  const [dayMode, setDayMode] = useState<'weekday' | 'weekend'>(isIsoWeekend(todayIso) ? 'weekend' : 'weekday');
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  const weekStartIso = weekDays[0].iso;
  const weekEndIso = weekDays[6].iso;

  const loadData = useCallback(async (targetDate = selectedDate) => {
    try {
      const [plan, logs, weekRangeLogs, habits, remOn] = await Promise.all([
        getActiveDietPlan(),
        getDietMealLogsForDate(targetDate),
        getDietMealLogsRange(weekStartIso, weekEndIso),
        getOrCreateDailyHabits(targetDate),
        areDietRemindersEnabled(),
      ]);
      setStoredPlan(plan);
      setMealLogs(logs);
      setWeekLogs(weekRangeLogs);
      setDailyHabits(habits);
      setRemindersEnabled(remOn);
    } catch (error) {
      console.error('Erro ao carregar DietScreen:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, weekStartIso, weekEndIso]);

  useFocusEffect(
    useCallback(() => {
      loadData(selectedDate);
    }, [loadData, selectedDate])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const handleSelectWeekDay = (day: WeekDayCell) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedDate(day.iso);
    setDayMode(day.isWeekend ? 'weekend' : 'weekday');
  };

  const handleToggleReminders = async () => {
    if (!storedPlan) return;
    try {
      if (remindersEnabled) {
        await cancelDietMealReminders();
        setRemindersEnabled(false);
        Alert.alert('Lembretes Desativados', 'As notificações diárias de refeição foram desligadas.');
      } else {
        const count = await scheduleDietMealReminders(storedPlan.plan.meals);
        if (count > 0) {
          setRemindersEnabled(true);
          Alert.alert(
            'Lembretes Ativados',
            `${count} lembretes diários agendados nos horários das suas refeições.`
          );
        } else {
          Alert.alert(
            'Sem Horários ou Permissão',
            'Verifique se as notificações do FocusLift estão permitidas e se a dieta possui horários (ex: 09:00).'
          );
        }
      }
    } catch {
      Alert.alert('Aviso', 'Não foi possível configurar os lembretes neste aparelho.');
    }
  };

  const handleToggleMeal = async (meal: ParsedDietMeal) => {
    if (!storedPlan) return;
    const currentLog = mealLogs[meal.id];
    const currentDone = currentLog?.completed === true;
    const nextDone = !currentDone;
    const estimatedProtein = estimateMealProteinG(meal, currentLog?.selectedOptions);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const nextMealEntry: DietMealLog = {
      date: selectedDate,
      meal_id: meal.id,
      completed: nextDone,
      selectedOptions: currentLog?.selectedOptions ?? {},
    };

    setMealLogs((prev) => ({
      ...prev,
      [meal.id]: nextMealEntry,
    }));

    setWeekLogs((prev) => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [meal.id]: nextMealEntry,
      },
    }));

    const requiredIds = storedPlan.plan.meals
      .filter((m) => !m.isWorkoutSlot)
      .map((m) => m.id);

    try {
      await toggleDietMealCompletion(selectedDate, meal.id, nextDone, requiredIds);

      if (estimatedProtein > 0) {
        const targetProtein =
          storedPlan.plan.weekdayTargets?.proteinG || dailyHabits?.protein_target_g || 180;
        const baseProtein = dailyHabits?.protein_current_g || 0;
        const nextProtein = Math.max(
          0,
          Math.round(baseProtein + (nextDone ? estimatedProtein : -estimatedProtein))
        );
        const proteinDone = nextProtein >= targetProtein ? 1 : 0;

        setDailyHabits((prev) =>
          prev
            ? {
                ...prev,
                protein_current_g: nextProtein,
                protein_target_g: targetProtein,
                protein_done: proteinDone,
              }
            : prev
        );

        await upsertDailyHabits({
          date: selectedDate,
          protein_current_g: nextProtein,
          protein_target_g: targetProtein,
          protein_done: proteinDone,
        });
      }
    } catch (e) {
      console.error('Erro ao salvar status da refeição:', e);
    }
  };

  const handleSelectOption = async (mealId: string, groupIdx: number, optionText: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    try {
      const updatedSelected = await saveDietMealSelectedOption(selectedDate, mealId, groupIdx, optionText);
      setMealLogs((prev) => ({
        ...prev,
        [mealId]: {
          date: selectedDate,
          meal_id: mealId,
          completed: prev[mealId]?.completed ?? false,
          selectedOptions: updatedSelected,
        },
      }));
      // Recolhe automaticamente a lista de opções após escolher para deixar o card limpo
      if (updatedSelected[groupIdx]) {
        setExpandedOptions((prev) => ({ ...prev, [`${mealId}_${groupIdx}`]: false }));
      }
    } catch (e) {
      console.error('Erro ao salvar opção da refeição:', e);
    }
  };

  const handleAddWater = async (deltaMl: number) => {
    if (!dailyHabits) return;
    const targetMl = storedPlan?.plan.waterTargetMl || dailyHabits.water_target_ml || 3000;
    const nextMl = Math.max(0, (dailyHabits.water_current_ml || 0) + deltaMl);
    const done = nextMl >= targetMl ? 1 : 0;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setDailyHabits((prev) =>
      prev ? { ...prev, water_current_ml: nextMl, water_target_ml: targetMl, water_done: done } : prev
    );

    try {
      await upsertDailyHabits({
        date: selectedDate,
        water_current_ml: nextMl,
        water_target_ml: targetMl,
        water_done: done,
      });
    } catch (e) {
      console.error('Erro ao atualizar água:', e);
    }
  };

  const handleDeletePlan = () => {
    Alert.alert(
      isPt ? 'Excluir Plano Alimentar' : 'Delete Diet Plan',
      isPt
        ? 'Deseja remover o plano alimentar atual? Você pode colar um novo texto quando quiser.'
        : 'Remove current diet plan? You can paste a new plan anytime.',
      [
        { text: isPt ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: isPt ? 'Excluir' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cancelDietMealReminders();
            setRemindersEnabled(false);
            await deleteActiveDietPlan();
            setStoredPlan(null);
            setMealLogs({});
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const plan = storedPlan?.plan ?? null;
  const activeMacros =
    plan && dayMode === 'weekend' && plan.weekendTargets
      ? plan.weekendTargets
      : plan?.weekdayTargets;

  const trackableMeals = plan ? plan.meals.filter((m) => !m.isWorkoutSlot) : [];
  const completedCount = trackableMeals.filter((m) => mealLogs[m.id]?.completed).length;
  const mealsProgress = trackableMeals.length > 0 ? completedCount / trackableMeals.length : 0;

  const waterTargetMl = plan?.waterTargetMl || dailyHabits?.water_target_ml || 3000;
  const waterCurrentMl = dailyHabits?.water_current_ml || 0;
  const waterRatio = Math.min(1, waterTargetMl > 0 ? waterCurrentMl / waterTargetMl : 0);
  const proteinCurrentG = Math.round(dailyHabits?.protein_current_g || 0);
  const proteinTargetG = Math.round(plan?.weekdayTargets?.proteinG || dailyHabits?.protein_target_g || 180);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
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
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              {isPt ? 'Dieta' : 'Diet'}
            </Text>
            <Text style={[styles.screenSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {plan ? plan.title : isPt ? 'Importe seu plano alimentar por texto' : 'Paste your meal plan in text'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {plan && (
              <TouchableOpacity
                style={[
                  styles.reminderBtn,
                  {
                    backgroundColor: remindersEnabled ? colors.successLight : colors.surfaceElevated,
                    borderColor: remindersEnabled ? colors.success : colors.surfaceBorder,
                  },
                ]}
                onPress={handleToggleReminders}
                activeOpacity={0.8}
                accessibilityLabel="Lembretes de Refeição"
              >
                <Ionicons
                  name={remindersEnabled ? 'notifications' : 'notifications-outline'}
                  size={16}
                  color={remindersEnabled ? colors.success : colors.textSecondary}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.importHeaderBtn, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}55` }]}
              onPress={() => setIsImportModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={15} color={colors.primary} />
              <Text style={[styles.importHeaderBtnText, { color: colors.primary }]}>
                {plan ? (isPt ? 'Editar / Colar' : 'Edit / Paste') : isPt ? 'Colar Dieta' : 'Paste Diet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendário Semanal de Aderência (Seg a Dom) */}
        {plan && (
          <View style={[styles.weekStripCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            {weekDays.map((day) => {
              const dayLogs = weekLogs[day.iso] || {};
              const doneForDay = trackableMeals.filter((m) => dayLogs[m.id]?.completed).length;
              const isAllDone = trackableMeals.length > 0 && doneForDay >= trackableMeals.length;
              const isPartial = doneForDay > 0 && !isAllDone;
              const isSel = selectedDate === day.iso;

              return (
                <TouchableOpacity
                  key={day.iso}
                  style={[
                    styles.weekDayCell,
                    {
                      backgroundColor: isSel ? colors.primaryLight : colors.surfaceElevated,
                      borderColor: isSel ? colors.primary : day.isToday ? `${colors.primary}55` : colors.surfaceBorder,
                    },
                  ]}
                  onPress={() => handleSelectWeekDay(day)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.weekDayLabel,
                      { color: isSel ? colors.primary : colors.textMuted },
                    ]}
                  >
                    {day.label}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNum,
                      { color: isSel ? colors.primary : colors.textPrimary },
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                  <View
                    style={[
                      styles.weekDayDot,
                      {
                        backgroundColor: isAllDone
                          ? colors.success
                          : isPartial
                          ? colors.primary
                          : colors.surfaceBorder,
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Estado Vazio */}
        {!plan ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.mealsLight }]}>
              <Ionicons name="restaurant-outline" size={32} color={colors.meals} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {isPt ? 'Seu Plano Alimentar em 1 Toque' : 'Your Meal Plan in 1 Tap'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {isPt
                ? 'Cole o texto da sua dieta (WhatsApp, nutricionista ou ChatGPT). O FocusLift organiza horários, macros Seg–Sex / Sáb–Dom, opções de proteína selecionáveis, água e checklist diário.'
                : 'Paste your diet text from notes or your nutritionist. FocusLift structures meal times, macros, selectable protein options, water goal, and daily checkboxes.'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyCtaBtn, { backgroundColor: colors.primary }]}
              onPress={() => setIsImportModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>
                {isPt ? 'Colar Dieta em Texto' : 'Paste Diet Text'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Card de Metas + Toggle Seg–Sex / Sáb–Dom */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              {plan.weekendTargets && (
                <View style={[styles.segmentBar, { backgroundColor: colors.surfaceElevated }]}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      dayMode === 'weekday' && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setDayMode('weekday')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: dayMode === 'weekday' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Seg a Sex
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      dayMode === 'weekend' && { backgroundColor: colors.meals },
                    ]}
                    onPress={() => setDayMode('weekend')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: dayMode === 'weekend' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Sáb e Dom
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Grid de Macros */}
              <View style={styles.macroGrid}>
                <View style={[styles.macroBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.macroBoxLabel, { color: colors.textMuted }]}>CALORIAS</Text>
                  <Text style={[styles.macroBoxVal, { color: colors.meals }]}>
                    {activeMacros?.kcal ? `~${activeMacros.kcal}` : '—'}
                  </Text>
                  <Text style={[styles.macroBoxUnit, { color: colors.textMuted }]}>kcal</Text>
                </View>

                <View style={[styles.macroBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.macroBoxLabel, { color: colors.textMuted }]}>PROTEÍNA</Text>
                  <Text style={[styles.macroBoxVal, { color: colors.protein }]}>
                    {activeMacros?.proteinLabel?.replace(/^~/, '') || (activeMacros?.proteinG ? `${activeMacros.proteinG}g` : '—')}
                  </Text>
                  <Text style={[styles.macroBoxUnit, { color: colors.textMuted }]}>meta/dia</Text>
                </View>

                <View style={[styles.macroBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.macroBoxLabel, { color: colors.textMuted }]}>CARBO</Text>
                  <Text style={[styles.macroBoxVal, { color: colors.primary }]}>
                    {activeMacros?.carbsLabel?.replace(/^~/, '') || (dayMode === 'weekend' ? 'Flex' : '—')}
                  </Text>
                  <Text style={[styles.macroBoxUnit, { color: colors.textMuted }]}>meta/dia</Text>
                </View>

                <View style={[styles.macroBox, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.macroBoxLabel, { color: colors.textMuted }]}>GORDURA</Text>
                  <Text style={[styles.macroBoxVal, { color: colors.streak }]}>
                    {activeMacros?.fatLabel?.replace(/^~/, '') || (dayMode === 'weekend' ? 'Flex' : '—')}
                  </Text>
                  <Text style={[styles.macroBoxUnit, { color: colors.textMuted }]}>meta/dia</Text>
                </View>
              </View>

              {activeMacros?.note && (
                <Text style={[styles.macroNote, { color: colors.textSecondary }]}>
                  💡 {activeMacros.note}
                </Text>
              )}

              {/* Progresso de Refeições + Proteína + Água rápida */}
              <View style={[styles.progressBlock, { borderTopColor: colors.surfaceBorder }]}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>
                    {selectedDate === todayIso ? 'Refeições de hoje' : `Refeições (${selectedDate.split('-').reverse().slice(0, 2).join('/')})`}: {completedCount}/{trackableMeals.length}
                  </Text>
                  <Text
                    style={[
                      styles.progressPct,
                      { color: mealsProgress >= 1 ? colors.success : colors.primary },
                    ]}
                  >
                    {proteinCurrentG}g / {proteinTargetG}g prot
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(mealsProgress * 100)}%`,
                        backgroundColor: mealsProgress >= 1 ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>

                {/* Hidratação integrada */}
                <View style={styles.waterRow}>
                  <View style={styles.waterInfo}>
                    <Ionicons name="water" size={16} color={colors.water} />
                    <View>
                      <Text style={[styles.waterText, { color: colors.textPrimary }]}>
                        {(waterCurrentMl / 1000).toFixed(2)}L / {(waterTargetMl / 1000).toFixed(1)}L
                      </Text>
                      <Text style={[styles.waterSub, { color: colors.textMuted }]}>
                        {Math.round(waterRatio * 100)}% da meta diária
                      </Text>
                    </View>
                  </View>
                  <View style={styles.waterBtns}>
                    <TouchableOpacity
                      style={[styles.waterBtn, { backgroundColor: colors.waterLight }]}
                      onPress={() => handleAddWater(250)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.waterBtnText, { color: colors.water }]}>+250ml</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.waterBtn, { backgroundColor: colors.waterLight }]}
                      onPress={() => handleAddWater(500)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.waterBtnText, { color: colors.water }]}>+500ml</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Timeline de Refeições */}
            <View style={styles.mealsList}>
              {plan.meals.map((meal) => {
                const log = mealLogs[meal.id];
                const isDone = log?.completed === true;

                if (meal.isWorkoutSlot) {
                  return (
                    <View
                      key={meal.id}
                      style={[
                        styles.workoutSlotCard,
                        { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}45` },
                      ]}
                    >
                      <View style={styles.workoutSlotHeader}>
                        <Ionicons name="barbell" size={16} color={colors.primary} />
                        {meal.time && (
                          <Text style={[styles.workoutSlotTime, { color: colors.primary }]}>{meal.time}</Text>
                        )}
                        <Text style={[styles.workoutSlotTitle, { color: colors.textPrimary }]}>
                          {meal.title}
                        </Text>
                      </View>
                      {meal.baseItems.map((it, i) => (
                        <Text key={i} style={[styles.workoutSlotItem, { color: colors.textSecondary }]}>
                          💧 {it}
                        </Text>
                      ))}
                    </View>
                  );
                }

                const estProteinG = estimateMealProteinG(meal, log?.selectedOptions);

                return (
                  <View
                    key={meal.id}
                    style={[
                      styles.mealCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isDone ? `${colors.success}70` : colors.surfaceBorder,
                      },
                    ]}
                  >
                    {/* Cabeçalho da Refeição */}
                    <View style={styles.mealHeader}>
                      <View style={styles.mealHeaderLeft}>
                        {meal.time && (
                          <View
                            style={[
                              styles.timePill,
                              { backgroundColor: isDone ? colors.successLight : colors.mealsLight },
                            ]}
                          >
                            <Text
                              style={[
                                styles.timePillText,
                                { color: isDone ? colors.success : colors.meals },
                              ]}
                            >
                              {meal.time}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text
                              style={[
                                styles.mealTitle,
                                { color: colors.textPrimary },
                                isDone && { textDecorationLine: 'line-through', opacity: 0.72 },
                              ]}
                            >
                              {meal.title}
                            </Text>
                            {estProteinG > 0 && (
                              <Text style={[styles.mealProtTag, { color: colors.protein }]}>
                                ~{estProteinG}g prot
                              </Text>
                            )}
                          </View>
                          {meal.subtitle && (
                            <Text style={[styles.mealSubtitle, { color: colors.textMuted }]}>
                              {meal.subtitle}
                            </Text>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.checkPill,
                          isDone
                            ? { backgroundColor: colors.success, borderColor: colors.success }
                            : { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder },
                        ]}
                        onPress={() => handleToggleMeal(meal)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={isDone ? 'checkmark' : 'ellipse-outline'}
                          size={15}
                          color={isDone ? '#FFFFFF' : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.checkPillText,
                            { color: isDone ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          {isDone ? 'Feita' : 'Marcar'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Itens Base */}
                    {meal.baseItems.length > 0 && (
                      <View style={styles.baseItemsBlock}>
                        {meal.baseItems.map((item, idx) => (
                          <View key={idx} style={styles.bulletRow}>
                            <View style={[styles.bulletDot, { backgroundColor: colors.textMuted }]} />
                            <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Grupos de Opções Selecionáveis (ex.: Proteína do Almoço/Jantar) */}
                    {meal.optionGroups.map((group, gIdx) => {
                      const chosen = log?.selectedOptions?.[gIdx];
                      const expandKey = `${meal.id}_${gIdx}`;
                      const isExpanded = expandedOptions[expandKey] ?? !chosen;

                      return (
                        <View
                          key={gIdx}
                          style={[
                            styles.optionGroupBox,
                            { backgroundColor: colors.surfaceElevated, borderColor: colors.surfaceBorder },
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.optionGroupHeader}
                            onPress={() =>
                              setExpandedOptions((prev) => ({
                                ...prev,
                                [expandKey]: !isExpanded,
                              }))
                            }
                            activeOpacity={0.75}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.optionGroupLabel, { color: colors.meals }]}>
                                {group.label}
                              </Text>
                              {chosen && !isExpanded && (
                                <Text style={[styles.chosenSummary, { color: colors.success }]}>
                                  ✓ {chosen}
                                </Text>
                              )}
                            </View>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.textMuted}
                            />
                          </TouchableOpacity>

                          {isExpanded && (
                            <View style={styles.optionsList}>
                              {group.options.map((opt, oIdx) => {
                                const selected = chosen === opt;
                                return (
                                  <TouchableOpacity
                                    key={oIdx}
                                    style={[
                                      styles.optionRow,
                                      {
                                        backgroundColor: selected ? colors.successLight : colors.surface,
                                        borderColor: selected ? colors.success : colors.surfaceBorder,
                                      },
                                    ]}
                                    onPress={() => handleSelectOption(meal.id, gIdx, opt)}
                                    activeOpacity={0.75}
                                  >
                                    <Ionicons
                                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                                      size={16}
                                      color={selected ? colors.success : colors.textMuted}
                                    />
                                    <Text
                                      style={[
                                        styles.optionText,
                                        {
                                          color: selected ? colors.textPrimary : colors.textSecondary,
                                          fontWeight: selected ? '700' : '500',
                                        },
                                      ]}
                                    >
                                      {opt}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Notas / Variações */}
                    {meal.notes.length > 0 && (
                      <View style={[styles.notesBox, { backgroundColor: colors.streakLight }]}>
                        {meal.notes.map((n, nIdx) => (
                          <Text key={nIdx} style={[styles.noteText, { color: colors.streak }]}>
                            ★ {n}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Regras Rápidas */}
            {plan.rules.length > 0 && (
              <View style={[styles.rulesCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <View style={styles.rulesHeader}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                  <Text style={[styles.rulesTitle, { color: colors.textPrimary }]}>Regras Rápidas</Text>
                </View>
                {plan.rules.map((rule, idx) => (
                  <Text key={idx} style={[styles.ruleItem, { color: colors.textSecondary }]}>
                    • {rule}
                  </Text>
                ))}
              </View>
            )}

            {/* Ações no rodapé */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={[styles.bottomBtn, { borderColor: colors.surfaceBorder, backgroundColor: colors.surface }]}
                onPress={() => setIsImportModalVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="create-outline" size={15} color={colors.textPrimary} />
                <Text style={[styles.bottomBtnText, { color: colors.textPrimary }]}>Editar Texto da Dieta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bottomBtn, { borderColor: `${colors.danger}40`, backgroundColor: colors.dangerLight }]}
                onPress={handleDeletePlan}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={[styles.bottomBtnText, { color: colors.danger }]}>Remover</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <ImportDietModal
        visible={isImportModalVisible}
        initialRawText={storedPlan?.raw_text ?? ''}
        onClose={() => setIsImportModalVisible(false)}
        onSaved={(saved) => {
          setStoredPlan(saved);
          loadData();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 18, paddingBottom: 40, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  screenTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  screenSub: { fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  importHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  importHeaderBtnText: { fontSize: 12.5, fontWeight: '800' },
  reminderBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStripCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 5,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  weekDayLabel: { fontSize: 10, fontWeight: '800' },
  weekDayNum: { fontSize: 13, fontWeight: '900' },
  weekDayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 1 },
  mealProtTag: { fontSize: 11, fontWeight: '800' },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 18,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  segmentBar: {
    flexDirection: 'row',
    borderRadius: 11,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentText: { fontSize: 12.5, fontWeight: '800' },
  macroGrid: { flexDirection: 'row', gap: 8 },
  macroBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  macroBoxLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  macroBoxVal: { fontSize: 15, fontWeight: '900', marginTop: 3 },
  macroBoxUnit: { fontSize: 10, marginTop: 1 },
  macroNote: { fontSize: 12, lineHeight: 17 },
  progressBlock: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontWeight: '700' },
  progressPct: { fontSize: 13, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  waterInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waterText: { fontSize: 13.5, fontWeight: '800' },
  waterSub: { fontSize: 11 },
  waterBtns: { flexDirection: 'row', gap: 6 },
  waterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  waterBtnText: { fontSize: 12, fontWeight: '800' },
  mealsList: { gap: 12 },
  workoutSlotCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  workoutSlotHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  workoutSlotTime: { fontSize: 12.5, fontWeight: '900' },
  workoutSlotTitle: { fontSize: 13.5, fontWeight: '800' },
  workoutSlotItem: { fontSize: 12.5, marginLeft: 2 },
  mealCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  timePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  timePillText: { fontSize: 12.5, fontWeight: '900' },
  mealTitle: { fontSize: 15, fontWeight: '800' },
  mealSubtitle: { fontSize: 11.5, marginTop: 1 },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  checkPillText: { fontSize: 11.5, fontWeight: '800' },
  baseItemsBlock: { gap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  optionGroupBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  optionGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionGroupLabel: { fontSize: 12, fontWeight: '800' },
  chosenSummary: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  optionsList: { gap: 6 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  notesBox: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  noteText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  rulesCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rulesTitle: { fontSize: 14.5, fontWeight: '800' },
  ruleItem: { fontSize: 12.5, lineHeight: 18 },
  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bottomBtnText: { fontSize: 13, fontWeight: '700' },
});
