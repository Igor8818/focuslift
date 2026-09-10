import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type RoutineWithExercises,
  type CreateRoutineExerciseInput,
  createRoutine,
  updateRoutine,
} from '../database/db';
import { Colors } from '../theme/colors';

export interface RoutineEditorModalProps {
  visible: boolean;
  routine: RoutineWithExercises | null; // null indica criação de nova ficha
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

import { COMMON_SUGGESTIONS } from '../utils/constants';

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  routine,
  onClose,
  onSave,
}) => {
  const isEditing = !!routine;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#38BDF8');
  const [exercises, setExercises] = useState<CreateRoutineExerciseInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Estado para adicionar exercício novo
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('');
  const [newExSets, setNewExSets] = useState(3);
  const [newExRest, setNewExRest] = useState(90);

  // Inicializa os campos ao abrir o modal
  useEffect(() => {
    if (routine) {
      setName(routine.name);
      setDescription(routine.description || '');
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
    setIsAddingExercise(false);
  }, [routine, visible]);

  // Reordenação de exercícios (mover para cima / baixo)
  const handleMoveExercise = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= exercises.length) return;

    const list = [...exercises];
    const item = list[fromIndex];
    list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);

    // Reatribui order_index
    setExercises(list.map((ex, idx) => ({ ...ex, order_index: idx })));
  };

  // Remoção de exercício
  const handleRemoveExercise = (index: number) => {
    const list = exercises.filter((_, idx) => idx !== index);
    setExercises(list.map((ex, idx) => ({ ...ex, order_index: idx })));
  };

  // Ajuste de séries alvo
  const handleAdjustSets = (index: number, delta: number) => {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx === index) {
          const updated = Math.max(1, Math.min(10, (ex.target_sets || 3) + delta));
          return { ...ex, target_sets: updated };
        }
        return ex;
      })
    );
  };

  // Ajuste de descanso padrão
  const handleAdjustRest = (index: number, seconds: number) => {
    setExercises((prev) =>
      prev.map((ex, idx) => {
        if (idx === index) {
          return { ...ex, rest_timer_seconds: seconds };
        }
        return ex;
      })
    );
  };

  // Confirmação de adição de exercício
  const handleConfirmAddExercise = (chosenName?: string, chosenGroup?: string) => {
    const finalName = (chosenName || newExName).trim();
    if (!finalName) {
      Alert.alert('Atenção', 'Informe o nome do exercício.');
      return;
    }

    const finalGroup = (chosenGroup !== undefined ? chosenGroup : newExGroup).trim() || null;

    setExercises((prev) => [
      ...prev,
      {
        exercise_name: finalName,
        muscle_group: finalGroup,
        target_sets: newExSets,
        rest_timer_seconds: newExRest,
        order_index: prev.length,
      },
    ]);

    setNewExName('');
    setNewExGroup('');
    setNewExSets(3);
    setNewExRest(90);
    setIsAddingExercise(false);
  };

  // Persistência da Ficha
  const handleSaveRoutine = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Nome Obrigatório', 'Por favor, defina um nome para a sua ficha.');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Ficha Vazia', 'Adicione pelo menos um exercício planejado para esta ficha.');
      return;
    }

    setIsSaving(true);
    try {
      let result: RoutineWithExercises;

      if (routine?.id) {
        result = await updateRoutine({
          id: routine.id,
          name: trimmedName,
          description: description.trim() || null,
          color,
          exercises: exercises.map((ex, idx) => ({
            ...ex,
            order_index: idx,
          })),
        });
      } else {
        result = await createRoutine({
          name: trimmedName,
          description: description.trim() || null,
          color,
          exercises: exercises.map((ex, idx) => ({
            ...ex,
            order_index: idx,
          })),
        });
      }

      onSave(result);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      Alert.alert('Erro', 'Não foi possível salvar a ficha. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Barra Superior de Ações */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>

          <Text style={styles.modalTitle}>
            {isEditing ? 'Editar Ficha' : 'Nova Ficha'}
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
              <Text style={styles.saveBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Dados Gerais da Ficha */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionLabel}>DADOS DA FICHA</Text>

            <TextInput
              style={styles.textInput}
              placeholder="Nome da ficha (ex.: Push A - Peito e Tríceps)"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.textInput, styles.descInput]}
              placeholder="Descrição ou foco (opcional)"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Seletor de Cor Temática */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>COR TEMÁTICA</Text>
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

          {/* Lista de Exercícios Planejados */}
          <View style={styles.cardSection}>
            <View style={styles.exerciseSectionHeader}>
              <View>
                <Text style={styles.sectionLabel}>EXERCÍCIOS PLANEJADOS</Text>
                <Text style={styles.exerciseCountText}>
                  {exercises.length} {exercises.length === 1 ? 'exercício' : 'exercícios'} adicionados
                </Text>
              </View>

              {!isAddingExercise ? (
                <TouchableOpacity
                  style={[styles.addExBtn, { borderColor: color }]}
                  onPress={() => setIsAddingExercise(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addExBtnText, { color }]}>+ Adicionar</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Sub-painel para adicionar novo exercício */}
            {isAddingExercise ? (
              <View style={styles.addExerciseCard}>
                <Text style={styles.addExTitle}>Novo Exercício na Ficha</Text>

                <TextInput
                  style={styles.textInput}
                  placeholder="Nome do exercício"
                  placeholderTextColor={Colors.textMuted}
                  value={newExName}
                  onChangeText={setNewExName}
                />

                <TextInput
                  style={styles.textInput}
                  placeholder="Grupo muscular (ex.: Peito, Pernas)"
                  placeholderTextColor={Colors.textMuted}
                  value={newExGroup}
                  onChangeText={setNewExGroup}
                />

                {/* Séries e Descanso */}
                <View style={styles.setsRestRow}>
                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>Séries Alvo</Text>
                    <View style={styles.stepperBtns}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setNewExSets((s) => Math.max(1, s - 1))}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{newExSets}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setNewExSets((s) => Math.min(10, s + 1))}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.stepperContainer}>
                    <Text style={styles.stepperLabel}>Descanso (s)</Text>
                    <View style={styles.restPillsRow}>
                      {[60, 90, 120].map((sec) => (
                        <TouchableOpacity
                          key={sec}
                          style={[
                            styles.restPill,
                            newExRest === sec && { backgroundColor: color },
                          ]}
                          onPress={() => setNewExRest(sec)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.restPillText,
                              newExRest === sec && { color: '#0A0D14', fontWeight: '900' },
                            ]}
                          >
                            {sec}s
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Sugestões Rápidas */}
                <Text style={styles.suggestionsTitle}>Sugestões Frequentes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
                  {COMMON_SUGGESTIONS.map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      style={styles.suggestionChip}
                      onPress={() => handleConfirmAddExercise(item.name, item.group)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionChipText}>{item.name}</Text>
                      <Text style={styles.suggestionChipGroup}>{item.group}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Botões do sub-painel */}
                <View style={styles.addExActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelAddBtn}
                    onPress={() => setIsAddingExercise(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelAddBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmAddBtn, { backgroundColor: color }]}
                    onPress={() => handleConfirmAddExercise()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmAddBtnText}>Adicionar à Ficha</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Listagem dos exercícios com reordenação */}
            {exercises.length === 0 && !isAddingExercise ? (
              <View style={styles.emptyExercisesBlock}>
                <Text style={styles.emptyExercisesText}>
                  Nenhum exercício configurado ainda. Toque em "+ Adicionar" acima para montar seu split.
                </Text>
              </View>
            ) : null}

            {exercises.map((ex, index) => (
              <View key={`${ex.exercise_name}-${index}`} style={styles.exerciseRowCard}>
                {/* Controles de Ordem */}
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
                    style={[
                      styles.arrowBtn,
                      index === exercises.length - 1 && styles.arrowBtnDisabled,
                    ]}
                    onPress={() => handleMoveExercise(index, 'down')}
                    disabled={index === exercises.length - 1}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.arrowText,
                        index === exercises.length - 1 && styles.arrowTextDisabled,
                      ]}
                    >
                      ▼
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Detalhes do Exercício */}
                <View style={styles.exerciseInfoCol}>
                  <Text style={styles.exerciseNameText} numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  {ex.muscle_group ? (
                    <Text style={styles.exerciseGroupText}>{ex.muscle_group}</Text>
                  ) : null}

                  {/* Configurações de Séries e Descanso */}
                  <View style={styles.exerciseConfigRow}>
                    {/* Stepper de Séries */}
                    <View style={styles.inlineStepper}>
                      <TouchableOpacity
                        style={styles.inlineStepBtn}
                        onPress={() => handleAdjustSets(index, -1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inlineStepBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.inlineStepValue}>{ex.target_sets || 3} séries</Text>
                      <TouchableOpacity
                        style={styles.inlineStepBtn}
                        onPress={() => handleAdjustSets(index, 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inlineStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Chips Rápidos de Descanso */}
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
                            <Text
                              style={[
                                styles.inlineRestPillText,
                                isCurrent && { color, fontWeight: '800' },
                              ]}
                            >
                              {s}s
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Botão Remover */}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveExercise(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '900',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  cardSection: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 10,
  },
  descInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
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
  checkIcon: {
    color: '#0A0D14',
    fontSize: 16,
    fontWeight: '900',
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  addExBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addExBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyExercisesBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyExercisesText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  addExerciseCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    marginBottom: 16,
  },
  addExTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  setsRestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  stepperContainer: {
    flex: 1,
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  stepperBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  stepBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  restPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  restPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  restPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  suggestionsScroll: {
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  suggestionChipGroup: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  addExActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  cancelAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  cancelAddBtnText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  confirmAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmAddBtnText: {
    fontSize: 12,
    color: '#0A0D14',
    fontWeight: '900',
  },
  exerciseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
    marginBottom: 8,
  },
  orderControls: {
    alignItems: 'center',
    marginRight: 10,
  },
  arrowBtn: {
    padding: 2,
  },
  arrowBtnDisabled: {
    opacity: 0.2,
  },
  arrowText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '800',
  },
  arrowTextDisabled: {
    color: Colors.textMuted,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginVertical: 1,
  },
  exerciseInfoCol: {
    flex: 1,
  },
  exerciseNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exerciseGroupText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  exerciseConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  inlineStepBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inlineStepBtnText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  inlineStepValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 4,
  },
  inlineRestRow: {
    flexDirection: 'row',
    gap: 3,
  },
  inlineRestPill: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  inlineRestPillText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  removeBtn: {
    padding: 8,
    marginLeft: 6,
  },
  removeBtnText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '800',
  },
});
