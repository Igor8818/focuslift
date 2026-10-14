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
import { useTheme } from '../contexts/ThemeContext';

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
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
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
              borderColor: colors.protein,
              backgroundColor: `${colors.protein}15`,
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
              <View style={[styles.checkIndicator, { backgroundColor: colors.protein }]}>
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
              borderColor: colors.water,
              backgroundColor: `${colors.water}15`,
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
              <View style={[styles.checkIndicator, { backgroundColor: colors.water }]}>
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
              borderColor: colors.workout,
              backgroundColor: `${colors.workout}15`,
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
              <View style={[styles.checkIndicator, { backgroundColor: colors.workout }]}>
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
              borderColor: colors.meals,
              backgroundColor: `${colors.meals}15`,
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
              <View style={[styles.checkIndicator, { backgroundColor: colors.meals }]}>
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
                    { width: `${waterRatio * 100}%`, backgroundColor: colors.water },
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
                  style={[styles.quickBtn, { borderColor: colors.water }]}
                  onPress={() => handleAddWater(btn.delta)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickBtnText, { color: colors.water }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input Manual Customizado */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Ex.: 300 ml"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customInputVal}
                onChangeText={setCustomInputVal}
              />
              <TouchableOpacity
                style={[styles.customAddBtn, { backgroundColor: colors.water }]}
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
                style={[styles.closeModalBtn, { backgroundColor: colors.water }]}
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
                    { width: `${proteinRatio * 100}%`, backgroundColor: colors.protein },
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
                  style={[styles.quickBtn, { borderColor: colors.protein }]}
                  onPress={() => handleAddProtein(btn.delta)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickBtnText, { color: colors.protein }]}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input Manual Customizado */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Ex.: 25 g"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customInputVal}
                onChangeText={setCustomInputVal}
              />
              <TouchableOpacity
                style={[styles.customAddBtn, { backgroundColor: colors.protein }]}
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
                style={[styles.closeModalBtn, { backgroundColor: colors.protein }]}
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

function makeStyles(colors: any) {
  return StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
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
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  progressBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
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
    color: colors.onPrimary,
    fontSize: 9,
    fontWeight: '900',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chipLabelActive: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  chipSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
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
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
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
    color: colors.textPrimary,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalProgressContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
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
    color: colors.textPrimary,
  },
  modalTargetValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  modalQuickLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    color: colors.textPrimary,
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
    color: colors.onPrimary,
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
    color: colors.danger,
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
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
});
}

