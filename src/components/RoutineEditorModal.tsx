import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type RoutineWithExercises,
  type CreateRoutineExerciseInput,
  createRoutine,
  updateRoutine,
} from '../database/db';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/LanguageContext';
import { COMMON_SUGGESTIONS, MUSCLE_GROUPS, type ExerciseSuggestionEntry } from '../utils/constants';
import { Image } from 'expo-image';


export interface RoutineEditorModalProps {
  visible: boolean;
  routine: RoutineWithExercises | null;
  onClose: () => void;
  onSave: (saved: RoutineWithExercises) => void;
}

const THEME_COLORS = [
  { label: 'Azul', value: '#38BDF8' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Âmbar', value: '#F59E0B' },
  { label: 'Roxo', value: '#A855F7' },
  { label: 'Rosa', value: '#F43F5E' },
  { label: 'Índigo', value: '#6366F1' },
];

// ── Sub-modal de Seleção em Lote ─────────────────────────────────────────────

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selected: ExerciseSuggestionEntry[]) => void;
  accentColor: string;
  alreadyAdded: Set<string>; // nomes já na ficha para feedback visual
}

const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  accentColor,
  alreadyAdded,
}) => {
  const { colors } = useTheme();
  const { t, tExercise, tMuscle, tEquipment } = useTranslation();
  const styles = makePickerStyles(colors);

  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reseta ao abrir
  useEffect(() => {
    if (visible) {
      setQuery('');
      setActiveGroup(null);
      setSelected(new Set());
    }
  }, [visible]);

  const filtered = useMemo<ExerciseSuggestionEntry[]>(() => {
    let list = COMMON_SUGGESTIONS;
    if (activeGroup) list = list.filter((ex) => ex.group === activeGroup);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((ex) => {
        const origName = ex.name.toLowerCase();
        const transName = tExercise(ex.name).toLowerCase();
        const origGroup = ex.group.toLowerCase();
        const transGroup = tMuscle(ex.group).toLowerCase();
        const origEq = (ex.equipment ?? '').toLowerCase();
        const transEq = tEquipment(ex.equipment ?? '').toLowerCase();
        return (
          origName.includes(q) ||
          transName.includes(q) ||
          origGroup.includes(q) ||
          transGroup.includes(q) ||
          origEq.includes(q) ||
          transEq.includes(q)
        );
      });
    }
    return list;
  }, [query, activeGroup, tExercise, tMuscle, tEquipment]);

  const toggle = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const picked = COMMON_SUGGESTIONS.filter((ex) => selected.has(ex.name));
    onConfirm(picked);
    onClose();
  };

  // Custom exercise
  const canAddCustom =
    query.trim().length > 2 &&
    !filtered.some((f) => f.name.toLowerCase() === query.trim().toLowerCase());

  const handleAddCustom = () => {
    const custom: ExerciseSuggestionEntry = {
      name: query.trim(),
      group: activeGroup ?? 'Personalizado',
    };
    onConfirm([custom]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerCancelBtn} activeOpacity={0.7}>
            <Text style={styles.headerCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('exercisePicker.title')}</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Barra de Busca */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('exercisePicker.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filtros de Grupo Muscular */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupFiltersContent}
          style={styles.groupFiltersScroll}
        >
          <TouchableOpacity
            style={[styles.groupChip, activeGroup === null && { backgroundColor: accentColor, borderColor: accentColor }]}
            onPress={() => setActiveGroup(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.groupChipText, activeGroup === null && { color: '#0A0D14' }]}>{t('exercisePicker.all')}</Text>
          </TouchableOpacity>
          {MUSCLE_GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.groupChip, activeGroup === g && { backgroundColor: accentColor, borderColor: accentColor }]}
              onPress={() => setActiveGroup((prev) => (prev === g ? null : g))}
              activeOpacity={0.75}
            >
              <Text style={[styles.groupChipText, activeGroup === g && { color: '#0A0D14' }]} numberOfLines={1}>
                {tMuscle(g)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Contagem de resultados e selecionados */}
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>{t('exercisePicker.exercisesFound', { count: filtered.length })}</Text>
          {selected.size > 0 && (
            <View style={[styles.selectedBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.selectedBadgeText}>{t('exercisePicker.selectedCount', { count: selected.size })}</Text>
            </View>
          )}
        </View>

        {/* Lista de Exercícios */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.name);
            const isInRoutine = alreadyAdded.has(item.name.toLowerCase());
            return (
              <TouchableOpacity
                style={[
                  styles.exerciseRow,
                  isSelected && { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}55` },
                ]}
                onPress={() => toggle(item.name)}
                activeOpacity={0.75}
              >
                {/* Thumbnail */}
                {item.mediaUrl ? (
                  <Image
                    source={{ uri: item.mediaUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.thumbFallback]}>
                    <Text style={styles.thumbIcon}>💪</Text>
                  </View>
                )}

                {/* Info */}
                <View style={styles.exInfo}>
                  <Text style={[styles.exName, isInRoutine && { color: colors.textMuted }]} numberOfLines={1}>
                    {tExercise(item.name)}
                    {isInRoutine ? ' ✓' : ''}
                  </Text>
                  <Text style={styles.exMeta}>
                    {tMuscle(item.group)}
                    {item.equipment ? ` · ${tEquipment(item.equipment)}` : ''}
                  </Text>
                </View>

                {/* Check */}
                <View style={[styles.checkCircle, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            canAddCustom ? (
              <TouchableOpacity
                style={[styles.customRow, { borderColor: `${accentColor}55` }]}
                onPress={handleAddCustom}
                activeOpacity={0.75}
              >
                <Text style={[styles.customRowText, { color: accentColor }]}>
                  {t('exercisePicker.addCustom', { name: query.trim() })}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {/* Botão de Confirmar Seleção */}
        {selected.size > 0 && (
          <View style={[styles.confirmBar, { paddingBottom: 16 }]}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: accentColor }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                {t('exercisePicker.addSelectedBtn', {
                  count: selected.size,
                  label: selected.size === 1 ? t('exercisePicker.exerciseLabelSingular') : t('exercisePicker.exerciseLabelPlural'),
                })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};


// ── Editor Principal da Ficha ────────────────────────────────────────────────

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  routine,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const { t, tExercise, tMuscle, tRoutine, tRoutineDesc } = useTranslation();
  const styles = makeStyles(colors);
  const isEditing = !!routine;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#38BDF8');
  const [exercises, setExercises] = useState<CreateRoutineExerciseInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  useEffect(() => {
    if (routine) {
      setName(tRoutine(routine.name));
      setDescription(routine.description ? tRoutineDesc(routine.description) : '');
      setColor(routine.color || '#38BDF8');
      setExercises(
        (routine.exercises || []).map((ex, idx) => ({
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
          target_sets: ex.target_sets,
          rest_timer_seconds: ex.rest_timer_seconds,
          order_index: idx,
        }))
      );
    } else {
      setName('');
      setDescription('');
      setColor('#38BDF8');
      setExercises([]);
    }
  }, [routine, visible, tRoutine, tRoutineDesc]);

  const alreadyAdded = useMemo(
    () => new Set(exercises.map((ex) => ex.exercise_name.toLowerCase())),
    [exercises]
  );

  const handlePickerConfirm = (picked: ExerciseSuggestionEntry[]) => {
    // Filtra duplicatas e adiciona com defaults inteligentes
    const newOnes = picked.filter((p) => !alreadyAdded.has(p.name.toLowerCase()));
    if (newOnes.length === 0) return;
    setExercises((prev) => [
      ...prev,
      ...newOnes.map((p, i) => ({
        exercise_name: p.name,
        muscle_group: p.group || null,
        target_sets: 3,
        rest_timer_seconds: 90,
        order_index: prev.length + i,
      })),
    ]);
  };

  const handleMoveExercise = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= exercises.length) return;
    const list = [...exercises];
    const item = list[fromIndex];
    list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    setExercises(list.map((ex, idx) => ({ ...ex, order_index: idx })));
  };

  const handleRemoveExercise = (index: number) => {
    const list = exercises.filter((_, idx) => idx !== index);
    setExercises(list.map((ex, idx) => ({ ...ex, order_index: idx })));
  };

  const handleAdjustSets = (index: number, delta: number) => {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx === index) {
          return { ...ex, target_sets: Math.max(1, Math.min(10, (ex.target_sets || 3) + delta)) };
        }
        return ex;
      })
    );
  };

  const handleAdjustRest = (index: number, seconds: number) => {
    setExercises((prev) =>
      prev.map((ex, idx) => (idx === index ? { ...ex, rest_timer_seconds: seconds } : ex))
    );
  };

  const handleSaveRoutine = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('routineEditor.nameRequired'), t('routineEditor.nameRequiredMsg'));
      return;
    }
    if (exercises.length === 0) {
      Alert.alert(t('routineEditor.emptyRoutine'), t('routineEditor.emptyRoutineMsg'));
      return;
    }
    setIsSaving(true);
    try {
      let result: RoutineWithExercises;
      const payload = {
        name: trimmedName,
        description: description.trim() || null,
        color,
        exercises: exercises.map((ex, idx) => ({ ...ex, order_index: idx })),
      };
      if (routine?.id) {
        result = await updateRoutine({ id: routine.id, ...payload });
      } else {
        result = await createRoutine(payload);
      }
      onSave(result);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      Alert.alert(t('common.error'), t('routineEditor.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {isEditing ? t('routineEditor.editTitle') : t('routineEditor.newTitle')}
            </Text>

            <TouchableOpacity
              onPress={handleSaveRoutine}
              disabled={isSaving}
              activeOpacity={0.8}
              style={[styles.saveBtn, { backgroundColor: color }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#0A0D14" />
              ) : (
                <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Dados da Ficha */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionLabel}>{t('routineEditor.routineData')}</Text>

              <TextInput
                style={styles.textInput}
                placeholder={t('routineEditor.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={[styles.textInput, styles.descInput]}
                placeholder={t('routineEditor.descPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>{t('routineEditor.themeColor')}</Text>
              <View style={styles.colorsRow}>
                {THEME_COLORS.map((c) => {
                  const isSelected = color === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.value },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setColor(c.value)}
                      activeOpacity={0.8}
                    >
                      {isSelected ? <Text style={styles.checkIcon}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Seção de Exercícios */}
            <View style={styles.cardSection}>
              <View style={styles.exerciseSectionHeader}>
                <View>
                  <Text style={styles.sectionLabel}>{t('routineEditor.plannedExercises')}</Text>
                  <Text style={styles.exerciseCountText}>
                    {exercises.length === 1
                      ? t('routineEditor.exercisesCountSingle')
                      : t('routineEditor.exercisesCount', { count: exercises.length })}
                  </Text>
                </View>

                {/* Botão de Seleção em Lote */}
                <TouchableOpacity
                  style={[styles.addExBtn, { borderColor: color }]}
                  onPress={() => setIsPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addExBtnText, { color }]}>{t('routineEditor.addBtn')}</Text>
                </TouchableOpacity>
              </View>

              {/* Estado vazio */}
              {exercises.length === 0 && (
                <TouchableOpacity
                  style={styles.emptyExercisesBlock}
                  onPress={() => setIsPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.emptyExIcon}>🏋️</Text>
                  <Text style={styles.emptyExTitle}>{t('routineEditor.emptyTitle')}</Text>
                  <Text style={styles.emptyExSub}>
                    {t('routineEditor.emptySub')}
                  </Text>
                  <View style={[styles.emptyExBtn, { backgroundColor: color }]}>
                    <Text style={styles.emptyExBtnText}>{t('routineEditor.searchExercises')}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Lista de exercícios adicionados */}
              {exercises.map((ex, index) => (
                <View key={`${ex.exercise_name}-${index}`} style={styles.exerciseRowCard}>
                  {/* Ordem */}
                  <View style={styles.orderControls}>
                    <TouchableOpacity
                      style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                      onPress={() => handleMoveExercise(index, 'up')}
                      disabled={index === 0}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.arrowText, index === 0 && styles.arrowTextDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <Text style={styles.orderNumber}>{index + 1}</Text>
                    <TouchableOpacity
                      style={[styles.arrowBtn, index === exercises.length - 1 && styles.arrowBtnDisabled]}
                      onPress={() => handleMoveExercise(index, 'down')}
                      disabled={index === exercises.length - 1}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.arrowText, index === exercises.length - 1 && styles.arrowTextDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Detalhes */}
                  <View style={styles.exerciseInfoCol}>
                    <Text style={styles.exerciseNameText} numberOfLines={1}>
                      {tExercise(ex.exercise_name)}
                    </Text>
                    {ex.muscle_group ? (
                      <Text style={styles.exerciseGroupText}>{tMuscle(ex.muscle_group)}</Text>
                    ) : null}

                    {/* Controles inline de séries e descanso */}
                    <View style={styles.exerciseConfigRow}>
                      {/* Stepper séries */}
                      <View style={styles.inlineStepper}>
                        <TouchableOpacity
                          style={styles.inlineStepBtn}
                          onPress={() => handleAdjustSets(index, -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.inlineStepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.inlineStepValue}>{t('routineEditor.setsCount', { count: ex.target_sets || 3 })}</Text>
                        <TouchableOpacity
                          style={styles.inlineStepBtn}
                          onPress={() => handleAdjustSets(index, 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.inlineStepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Chips de descanso */}
                      <View style={styles.inlineRestRow}>
                        {[60, 90, 120].map((s) => {
                          const isCurrent = (ex.rest_timer_seconds || 90) === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[
                                styles.inlineRestPill,
                                isCurrent && { backgroundColor: `${color}30`, borderColor: color },
                              ]}
                              onPress={() => handleAdjustRest(index, s)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.inlineRestPillText, isCurrent && { color, fontWeight: '800' }]}>
                                {s}s
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Remover */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveExercise(index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Botão de adicionar mais ao fundo da lista */}
              {exercises.length > 0 && (
                <TouchableOpacity
                  style={[styles.addMoreBtn, { borderColor: `${color}55` }]}
                  onPress={() => setIsPickerVisible(true)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.addMoreBtnText, { color }]}>{t('routineEditor.addBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sub-modal de seleção em lote */}
      <ExercisePickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onConfirm={handlePickerConfirm}
        accentColor={color}
        alreadyAdded={alreadyAdded}
      />
    </>
  );
};


// ── Estilos do Editor de Ficha ───────────────────────────────────────────────
function makeStyles(colors: any) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    cancelBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    cancelBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
    modalTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    saveBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
    saveBtnText: { color: '#0A0D14', fontSize: 14, fontWeight: '900' },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
    cardSection: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      padding: 16,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: 10,
    },
    descInput: { minHeight: 60, textAlignVertical: 'top' },
    colorsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    colorCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorCircleSelected: {
      borderWidth: 3,
      borderColor: '#FFFFFF',
      transform: [{ scale: 1.1 }],
    },
    checkIcon: { color: '#0A0D14', fontSize: 16, fontWeight: '900' },
    exerciseSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    exerciseCountText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    addExBtn: {
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    addExBtnText: { fontSize: 13, fontWeight: '800' },

    // Estado vazio
    emptyExercisesBlock: {
      paddingVertical: 28,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    emptyExIcon: { fontSize: 36 },
    emptyExTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    emptyExSub: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: 12,
    },
    emptyExBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    emptyExBtnText: { color: '#0A0D14', fontWeight: '900', fontSize: 14 },

    // Linha de exercício adicionado
    exerciseRowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 10,
      marginBottom: 8,
    },
    orderControls: {
      alignItems: 'center',
      gap: 2,
      marginRight: 10,
      width: 28,
    },
    arrowBtn: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 5,
      backgroundColor: colors.surface,
    },
    arrowBtnDisabled: { opacity: 0.3 },
    arrowText: { fontSize: 11, color: colors.textSecondary, fontWeight: '800' },
    arrowTextDisabled: { color: colors.textMuted },
    orderNumber: {
      fontSize: 12,
      fontWeight: '900',
      color: colors.textMuted,
    },
    exerciseInfoCol: { flex: 1 },
    exerciseNameText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    exerciseGroupText: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
      marginBottom: 6,
    },
    exerciseConfigRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    inlineStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
    },
    inlineStepBtn: {
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inlineStepBtnText: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    inlineStepValue: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary,
      paddingHorizontal: 6,
    },
    inlineRestRow: { flexDirection: 'row', gap: 4 },
    inlineRestPill: {
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    inlineRestPillText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    removeBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '900' },

    addMoreBtn: {
      marginTop: 4,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    addMoreBtnText: { fontSize: 13, fontWeight: '800' },
  });
}

// ── Estilos do Picker de Exercícios ─────────────────────────────────────────
function makePickerStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    headerCancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
    headerCancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    searchIcon: { fontSize: 16 },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
    },

    groupFiltersScroll: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    groupFiltersContent: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    groupChip: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceElevated,
    },
    groupChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    resultsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    resultsText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    selectedBadge: {
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    selectedBadgeText: { fontSize: 11, fontWeight: '900', color: '#0A0D14' },

    list: { flex: 1 },

    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      gap: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      marginHorizontal: 8,
      marginVertical: 2,
      borderRadius: 12,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      flexShrink: 0,
    },
    thumbFallback: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    thumbIcon: { fontSize: 20 },
    exInfo: { flex: 1 },
    exName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    exMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    checkMark: { fontSize: 12, fontWeight: '900', color: '#0A0D14' },

    customRow: {
      margin: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
    },
    customRowText: { fontSize: 13, fontWeight: '700' },

    confirmBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    confirmBtn: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    confirmBtnText: { fontSize: 15, fontWeight: '900', color: '#0A0D14' },
  });
}
