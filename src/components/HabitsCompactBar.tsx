import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { type DailyHabits } from '../database/db';
import { Colors } from '../theme/colors';

export interface HabitsCompactBarProps {
  habits: DailyHabits | null;
  onToggleHabit: (key: 'protein_done' | 'water_done' | 'workout_done' | 'meals_done') => void;
  onUpdateWater?: (newAmountMl: number) => void;
  onUpdateProtein?: (newAmountG: number) => void;
}

export const HabitsCompactBar: React.FC<HabitsCompactBarProps> = ({
  habits,
  onToggleHabit,
  onUpdateWater,
  onUpdateProtein,
}) => {
  // Modais de Metas Quantitativas
  const [activeModal, setActiveModal] = useState<'water' | 'protein' | null>(null);
  const [customInputVal, setCustomInputVal] = useState('');

  const waterCurrent = habits?.water_current_ml ?? 0;
  const waterTarget = habits?.water_target_ml || 3000;
  const waterRatio = Math.min(1, waterCurrent / waterTarget);
  const isWaterDone = !!(habits?.water_done || waterCurrent >= waterTarget);

  const proteinCurrent = habits?.protein_current_g ?? 0;
  const proteinTarget = habits?.protein_target_g || 160;
  const proteinRatio = Math.min(1, proteinCurrent / proteinTarget);
  const isProteinDone = !!(habits?.protein_done || proteinCurrent >= proteinTarget);

  const isWorkoutDone = !!habits?.workout_done;
  const isMealsDone = !!habits?.meals_done;

  // Cálculo da porcentagem global ponderada
  const overallProgressRatio = (waterRatio + proteinRatio + (isWorkoutDone ? 1 : 0) + (isMealsDone ? 1 : 0)) / 4;
  const overallProgressPercent = Math.round(overallProgressRatio * 100);

  const completedCount = (isWaterDone ? 1 : 0) + (isProteinDone ? 1 : 0) + (isWorkoutDone ? 1 : 0) + (isMealsDone ? 1 : 0);

  // Manipulação de Água
  const handleAddWater = (deltaMl: number) => {
    const updated = Math.max(0, waterCurrent + deltaMl);
    onUpdateWater?.(updated);
  };

  const handleSetCustomWater = () => {
    const num = parseInt(customInputVal.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      handleAddWater(num);
      setCustomInputVal('');
    }
  };

  // Manipulação de Proteína
  const handleAddProtein = (deltaG: number) => {
    const updated = Math.max(0, proteinCurrent + deltaG);
    onUpdateProtein?.(updated);
  };

  const handleSetCustomProtein = () => {
    const num = parseFloat(customInputVal.replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      handleAddProtein(num);
      setCustomInputVal('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho Minimalista com Progresso Real */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>HÁBITOS DO DIA</Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {completedCount}/4 • {overallProgressPercent}%
          </Text>
        </View>
      </View>

      {/* 4 Chips de Hábitos em Linha Horizontal */}
      <View style={styles.chipsRow}>
        {/* 1. Proteína com Meta Numérica */}
        <TouchableOpacity
          style={[
            styles.chip,
            isProteinDone && {
              borderColor: Colors.protein,
              backgroundColor: `${Colors.protein}15`,
            },
          ]}
          onPress={() => {
            setCustomInputVal('');
            setActiveModal('protein');
          }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Ajustar consumo de proteína"
        >
          <View style={styles.iconContainer}>
            <Text style={styles.chipIcon}>🍗</Text>
            {isProteinDone ? (
              <View style={[styles.checkIndicator, { backgroundColor: Colors.protein }]}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.chipLabel, isProteinDone && styles.chipLabelActive]} numberOfLines={1}>
            Proteína
          </Text>
          <Text style={styles.chipSubtitle} numberOfLines={1}>
            {proteinCurrent > 0 ? `${Math.round(proteinCurrent)}g` : `${proteinTarget}g`}
          </Text>
        </TouchableOpacity>

        {/* 2. Água com Meta Numérica */}
        <TouchableOpacity
          style={[
            styles.chip,
            isWaterDone && {
              borderColor: Colors.water,
              backgroundColor: `${Colors.water}15`,
            },
          ]}
          onPress={() => {
            setCustomInputVal('');
            setActiveModal('water');
          }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Ajustar consumo de água"
        >
          <View style={styles.iconContainer}>
            <Text style={styles.chipIcon}>💧</Text>
            {isWaterDone ? (
              <View style={[styles.checkIndicator, { backgroundColor: Colors.water }]}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.chipLabel, isWaterDone && styles.chipLabelActive]} numberOfLines={1}>
            Água
          </Text>
          <Text style={styles.chipSubtitle} numberOfLines={1}>
            {waterCurrent > 0 ? `${(waterCurrent / 1000).toFixed(1)}L` : `${(waterTarget / 1000).toFixed(1)}L`}
          </Text>
        </TouchableOpacity>

        {/* 3. Treino (Check-in direto) */}
        <TouchableOpacity
          style={[
            styles.chip,
            isWorkoutDone && {
              borderColor: Colors.workout,
              backgroundColor: `${Colors.workout}15`,
            },
          ]}
          onPress={() => onToggleHabit('workout_done')}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isWorkoutDone }}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.chipIcon}>🏋️</Text>
            {isWorkoutDone ? (
              <View style={[styles.checkIndicator, { backgroundColor: Colors.workout }]}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.chipLabel, isWorkoutDone && styles.chipLabelActive]} numberOfLines={1}>
            Treino
          </Text>
          <Text style={styles.chipSubtitle} numberOfLines={1}>
            {isWorkoutDone ? 'Feito' : 'Pendente'}
          </Text>
        </TouchableOpacity>

        {/* 4. Refeições (Check-in direto) */}
        <TouchableOpacity
          style={[
            styles.chip,
            isMealsDone && {
              borderColor: Colors.meals,
              backgroundColor: `${Colors.meals}15`,
            },
          ]}
          onPress={() => onToggleHabit('meals_done')}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isMealsDone }}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.chipIcon}>🥗</Text>
            {isMealsDone ? (
              <View style={[styles.checkIndicator, { backgroundColor: Colors.meals }]}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.chipLabel, isMealsDone && styles.chipLabelActive]} numberOfLines={1}>
            Refeições
          </Text>
          <Text style={styles.chipSubtitle} numberOfLines={1}>
            {isMealsDone ? 'Feito' : 'Pendente'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* =================================================================
          MODAL DE CONTROLE DE ÁGUA
          ================================================================= */}
      <Modal
        visible={activeModal === 'water'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Text style={styles.modalIcon}>💧</Text>
                <Text style={styles.modalTitle}>Hidratação do Dia</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Barra de Progresso */}
            <View style={styles.modalProgressContainer}>
              <View style={styles.modalProgressTrack}>
                <View
                  style={[
                    styles.modalProgressFill,
                    { width: `${waterRatio * 100}%`, backgroundColor: Colors.water },
                  ]}
                />
              </View>
              <View style={styles.modalValuesRow}>
                <Text style={styles.modalCurrentValue}>{waterCurrent} ml</Text>
                <Text style={styles.modalTargetValue}>Meta: {waterTarget} ml</Text>
              </View>
            </View>

            {/* Ações Rápidas de Incremento */}
            <Text style={styles.modalQuickLabel}>ADICIONAR RÁPIDO</Text>
            <View style={styles.quickButtonsGrid}>
              {[
                { label: '+250 ml', delta: 250 },
                { label: '+500 ml', delta: 500 },
                { label: '+1000 ml', delta: 1000 },
              ].map((btn) => (
                <TouchableOpacity
                  key={btn.label}
                  style={[styles.quickBtn, { borderColor: Colors.water }]}
                  onPress={() => handleAddWater(btn.delta)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickBtnText, { color: Colors.water }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input Manual Customizado */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Ex.: 300 ml"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={customInputVal}
                onChangeText={setCustomInputVal}
              />
              <TouchableOpacity
                style={[styles.customAddBtn, { backgroundColor: Colors.water }]}
                onPress={handleSetCustomWater}
                activeOpacity={0.8}
              >
                <Text style={styles.customAddBtnText}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Resetar e Fechar */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => onUpdateWater?.(0)}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Zerar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: Colors.water }]}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeModalBtnText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================================
          MODAL DE CONTROLE DE PROTEÍNA
          ================================================================= */}
      <Modal
        visible={activeModal === 'protein'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Text style={styles.modalIcon}>🍗</Text>
                <Text style={styles.modalTitle}>Proteína Diária</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Barra de Progresso */}
            <View style={styles.modalProgressContainer}>
              <View style={styles.modalProgressTrack}>
                <View
                  style={[
                    styles.modalProgressFill,
                    { width: `${proteinRatio * 100}%`, backgroundColor: Colors.protein },
                  ]}
                />
              </View>
              <View style={styles.modalValuesRow}>
                <Text style={styles.modalCurrentValue}>{Math.round(proteinCurrent)} g</Text>
                <Text style={styles.modalTargetValue}>Meta: {proteinTarget} g</Text>
              </View>
            </View>

            {/* Ações Rápidas de Incremento */}
            <Text style={styles.modalQuickLabel}>ADICIONAR PORÇÃO</Text>
            <View style={styles.quickButtonsGrid}>
              {[
                { label: '+20 g', delta: 20 },
                { label: '+30 g', delta: 30 },
                { label: '+40 g', delta: 40 },
              ].map((btn) => (
                <TouchableOpacity
                  key={btn.label}
                  style={[styles.quickBtn, { borderColor: Colors.protein }]}
                  onPress={() => handleAddProtein(btn.delta)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickBtnText, { color: Colors.protein }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input Manual Customizado */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Ex.: 25 g"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={customInputVal}
                onChangeText={setCustomInputVal}
              />
              <TouchableOpacity
                style={[styles.customAddBtn, { backgroundColor: Colors.protein }]}
                onPress={handleSetCustomProtein}
                activeOpacity={0.8}
              >
                <Text style={styles.customAddBtnText}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Resetar e Fechar */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => onUpdateProtein?.(0)}
                activeOpacity={0.7}
              >
                <Text style={styles.resetBtnText}>Zerar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: Colors.protein }]}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeModalBtnText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  progressBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  chipIcon: {
    fontSize: 20,
  },
  checkIndicator: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#0A0D14',
    fontSize: 9,
    fontWeight: '900',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chipLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  chipSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    width: '100%',
    maxWidth: 360,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIcon: {
    fontSize: 22,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalProgressContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
    marginBottom: 16,
  },
  modalProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCurrentValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  modalTargetValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalQuickLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  quickButtonsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  customInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customAddBtn: {
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAddBtnText: {
    color: '#0A0D14',
    fontSize: 13,
    fontWeight: '900',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  closeModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#0A0D14',
    fontSize: 14,
    fontWeight: '900',
  },
});
