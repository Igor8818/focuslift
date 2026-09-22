/**
 * PlateCalculatorModal.tsx
 *
 * Calculadora visual de anilhas para o FocusLift.
 *
 * MODOS:
 *  - "Por Lado" (padrão): contadores +/- para cada anilha; total calculado automaticamente.
 *  - "Peso Total": digita o peso total e calcula a distribuição ideal de anilhas.
 *
 * Suporta Dark/Light mode via useTheme().
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface PlateCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Peso inicial sugerido (geralmente o peso digitado na série mais recente). */
  initialWeight?: string;
}

// Anilhas padrão em kg (por lado), do maior para o menor
const STANDARD_PLATES = [20, 15, 10, 5, 2.5, 1.25] as const;
type PlateWeight = (typeof STANDARD_PLATES)[number];

// Cor visual de cada anilha (paleta de academia real)
const PLATE_COLORS: Record<PlateWeight, string> = {
  20:   '#EF4444', // Vermelho
  15:   '#F59E0B', // Amarelo
  10:   '#3B82F6', // Azul
  5:    '#10B981', // Verde
  2.5:  '#E5E7EB', // Branco/Cinza claro
  1.25: '#A855F7', // Roxo
};

// Cor do texto sobre a anilha (contraste)
const PLATE_TEXT_COLORS: Record<PlateWeight, string> = {
  20:   '#FFFFFF',
  15:   '#1A1A1A',
  10:   '#FFFFFF',
  5:    '#FFFFFF',
  2.5:  '#1A1A1A',
  1.25: '#FFFFFF',
};

// Espessura visual proporcional de cada anilha no diagrama
const PLATE_THICKNESS: Record<PlateWeight, number> = {
  20:   28,
  15:   22,
  10:   18,
  5:    14,
  2.5:  10,
  1.25: 7,
};

// Altura visual proporcional de cada anilha no diagrama
const PLATE_HEIGHT: Record<PlateWeight, number> = {
  20:   64,
  15:   56,
  10:   48,
  5:    40,
  2.5:  32,
  1.25: 26,
};

// Contagem inicial de anilhas (zerado)
type PlateCountMap = Record<PlateWeight, number>;
const EMPTY_PLATE_COUNT: PlateCountMap = {
  20: 0, 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0,
};

interface PlateResult {
  /** Anilhas por lado (já calculadas, da mais pesada para a mais leve). */
  platesPerSide: PlateWeight[];
  /** Peso real total montado (pode diferir do desejado por limitação das anilhas). */
  achievedTotal: number;
  /** Quanto do peso desejado não pôde ser coberto com as anilhas disponíveis. */
  remainder: number;
}

// ─── Lógica da Calculadora ─────────────────────────────────────────────────────

/**
 * Calcula a combinação de anilhas padrão para atingir `targetWeight`.
 * Usa algoritmo greedy (maior para menor).
 */
function calculatePlates(targetWeight: number, barWeight: number): PlateResult {
  const weightPerSide = (targetWeight - barWeight) / 2;

  if (weightPerSide <= 0) {
    return { platesPerSide: [], achievedTotal: barWeight, remainder: 0 };
  }

  const platesPerSide: PlateWeight[] = [];
  let remaining = weightPerSide;

  for (const plate of STANDARD_PLATES) {
    while (remaining >= plate - 0.001) {
      platesPerSide.push(plate);
      remaining -= plate;
      remaining = Math.round(remaining * 1000) / 1000;
    }
  }

  const achievedPerSide = weightPerSide - remaining;
  const achievedTotal = Math.round((barWeight + achievedPerSide * 2) * 1000) / 1000;

  return {
    platesPerSide,
    achievedTotal,
    remainder: Math.round(remaining * 1000) / 1000,
  };
}

/**
 * Converte um mapa de contagens de anilhas para um array expandido
 * (ex: {20: 2, 10: 1} → [20, 20, 10]), do maior para o menor.
 */
function plateCountToArray(counts: PlateCountMap): PlateWeight[] {
  const result: PlateWeight[] = [];
  for (const plate of STANDARD_PLATES) {
    for (let i = 0; i < counts[plate]; i++) {
      result.push(plate);
    }
  }
  return result;
}

/**
 * Calcula o peso total a partir do mapa de contagens por lado + barra.
 */
function calcTotalFromCounts(counts: PlateCountMap, barWeight: number): number {
  let perSide = 0;
  for (const plate of STANDARD_PLATES) {
    perSide += counts[plate] * plate;
  }
  return Math.round((barWeight + perSide * 2) * 1000) / 1000;
}

// ─── Sub-componente: Diagrama da Barra ─────────────────────────────────────────

interface BarDiagramProps {
  platesPerSide: PlateWeight[];
  colors: ReturnType<typeof useTheme>['colors'];
}

function BarDiagram({ platesPerSide, colors }: BarDiagramProps) {
  if (platesPerSide.length === 0) {
    return (
      <View style={diagramStyles.emptyRow}>
        <Text style={[diagramStyles.emptyText, { color: colors.textMuted }]}>
          Apenas a barra (sem anilhas)
        </Text>
      </View>
    );
  }

  const rightSide = [...platesPerSide].reverse();
  const barHeight = 16;
  const barColor = colors.textSecondary;

  return (
    <View style={diagramStyles.diagramWrapper}>
      {/* Collar esquerdo */}
      <View style={[diagramStyles.collar, { backgroundColor: barColor }]} />

      {/* Anilhas lado ESQUERDO */}
      <View style={diagramStyles.platesRow}>
        {[...platesPerSide].reverse().map((plate, i) => (
          <View
            key={`L-${i}`}
            style={[
              diagramStyles.plate,
              {
                width: PLATE_THICKNESS[plate],
                height: PLATE_HEIGHT[plate],
                backgroundColor: PLATE_COLORS[plate],
                borderRadius: 3,
              },
            ]}
          />
        ))}
      </View>

      {/* Barra central */}
      <View
        style={[
          diagramStyles.barCenter,
          { height: barHeight, backgroundColor: barColor },
        ]}
      />

      {/* Anilhas lado DIREITO */}
      <View style={diagramStyles.platesRow}>
        {rightSide.map((plate, i) => (
          <View
            key={`R-${i}`}
            style={[
              diagramStyles.plate,
              {
                width: PLATE_THICKNESS[plate],
                height: PLATE_HEIGHT[plate],
                backgroundColor: PLATE_COLORS[plate],
                borderRadius: 3,
              },
            ]}
          />
        ))}
      </View>

      {/* Collar direito */}
      <View style={[diagramStyles.collar, { backgroundColor: barColor }]} />
    </View>
  );
}

const diagramStyles = StyleSheet.create({
  diagramWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 100,
  },
  collar: {
    width: 8,
    height: 24,
    borderRadius: 3,
  },
  platesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  plate: {
    // Largura/altura dinâmicas via style prop
  },
  barCenter: {
    width: 80,
    borderRadius: 4,
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

// ─── Sub-componente: Legenda de Anilhas ────────────────────────────────────────

interface PlateLegendProps {
  platesPerSide: PlateWeight[];
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function PlateLegend({ platesPerSide, colors, isDark }: PlateLegendProps) {
  const groups = useMemo(() => {
    const map = new Map<PlateWeight, number>();
    for (const plate of platesPerSide) {
      map.set(plate, (map.get(plate) ?? 0) + 1);
    }
    return STANDARD_PLATES.filter((p) => map.has(p)).map((p) => ({
      plate: p,
      count: map.get(p)!,
    }));
  }, [platesPerSide]);

  if (groups.length === 0) return null;

  return (
    <View style={legendStyles.container}>
      <Text style={[legendStyles.title, { color: colors.textMuted }]}>
        POR LADO DA BARRA
      </Text>
      <View style={legendStyles.grid}>
        {groups.map(({ plate, count }) => (
          <View
            key={plate}
            style={[
              legendStyles.chip,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.05)',
                borderColor: PLATE_COLORS[plate as PlateWeight],
              },
            ]}
          >
            <View
              style={[
                legendStyles.colorDot,
                { backgroundColor: PLATE_COLORS[plate as PlateWeight] },
              ]}
            />
            <Text style={[legendStyles.chipText, { color: colors.textPrimary }]}>
              {count}× {plate} kg
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Sub-componente: Modo Por Lado ─────────────────────────────────────────────

interface PerSideModeProps {
  plateCounts: PlateCountMap;
  barWeight: 15 | 20;
  onIncrement: (plate: PlateWeight) => void;
  onDecrement: (plate: PlateWeight) => void;
  onReset: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function PerSideMode({
  plateCounts,
  barWeight,
  onIncrement,
  onDecrement,
  onReset,
  colors,
  isDark,
}: PerSideModeProps) {
  const totalWeight = calcTotalFromCounts(plateCounts, barWeight);
  const platesArray = plateCountToArray(plateCounts);
  const hasPlates = platesArray.length > 0;

  return (
    <View>
      {/* Badge de total */}
      <View style={[perSideStyles.totalBadge, {
        backgroundColor: isDark ? 'rgba(56,189,248,0.08)' : 'rgba(2,132,199,0.07)',
        borderColor: colors.primary,
      }]}>
        <Text style={[perSideStyles.totalLabel, { color: colors.primary }]}>PESO TOTAL MONTADO</Text>
        <Text style={[perSideStyles.totalValue, { color: colors.textPrimary }]}>
          {totalWeight} kg
        </Text>
        <Text style={[perSideStyles.totalSub, { color: colors.textMuted }]}>
          Barra {barWeight} kg + {((totalWeight - barWeight) / 2).toFixed(2).replace(/\.?0+$/, '')} kg por lado
        </Text>
      </View>

      {/* Diagrama visual */}
      <View style={[perSideStyles.diagramCard, {
        backgroundColor: colors.surfaceElevated,
        borderColor: colors.surfaceBorder,
      }]}>
        <BarDiagram platesPerSide={platesArray} colors={colors} />
      </View>

      {/* Contadores por anilha */}
      <Text style={[perSideStyles.sectionTitle, { color: colors.textMuted }]}>
        ANILHAS POR LADO
      </Text>

      <View style={perSideStyles.platesGrid}>
        {STANDARD_PLATES.map((plate) => {
          const count = plateCounts[plate];
          const color = PLATE_COLORS[plate];
          const textColor = PLATE_TEXT_COLORS[plate];
          return (
            <View
              key={plate}
              style={[perSideStyles.plateRow, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: count > 0 ? color : colors.surfaceBorder,
                borderWidth: count > 0 ? 1.5 : 1,
              }]}
            >
              {/* Indicador colorido da anilha */}
              <View style={[perSideStyles.plateSwatch, { backgroundColor: color }]}>
                <Text style={[perSideStyles.plateSwatchText, { color: textColor }]}>
                  {plate}
                </Text>
              </View>

              <Text style={[perSideStyles.plateLabel, { color: colors.textSecondary }]}>
                {plate} kg
              </Text>

              {/* Controles */}
              <View style={perSideStyles.counterControls}>
                <TouchableOpacity
                  style={[perSideStyles.counterBtn, {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.surfaceBorder,
                  }]}
                  onPress={() => onDecrement(plate)}
                  disabled={count === 0}
                  activeOpacity={0.7}
                >
                  <Text style={[perSideStyles.counterBtnText, {
                    color: count === 0 ? colors.textMuted : colors.textPrimary,
                  }]}>−</Text>
                </TouchableOpacity>

                <View style={[perSideStyles.counterDisplay, {
                  backgroundColor: count > 0 ? color : 'transparent',
                }]}>
                  <Text style={[perSideStyles.counterValue, {
                    color: count > 0 ? textColor : colors.textMuted,
                    fontWeight: count > 0 ? '900' : '400',
                  }]}>
                    {count}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[perSideStyles.counterBtn, {
                    backgroundColor: color,
                    borderColor: color,
                  }]}
                  onPress={() => onIncrement(plate)}
                  activeOpacity={0.7}
                >
                  <Text style={[perSideStyles.counterBtnText, { color: textColor }]}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Subtotal desta anilha por lado */}
              {count > 0 && (
                <Text style={[perSideStyles.plateSubtotal, { color: color }]}>
                  {(count * plate).toFixed(2).replace(/\.?0+$/, '')} kg
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Botão de Reset */}
      {hasPlates && (
        <TouchableOpacity
          style={[perSideStyles.resetBtn, {
            borderColor: colors.surfaceBorder,
            backgroundColor: colors.surfaceElevated,
          }]}
          onPress={onReset}
          activeOpacity={0.7}
        >
          <Text style={[perSideStyles.resetBtnText, { color: colors.textMuted }]}>
            ↺ Zerar Anilhas
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const perSideStyles = StyleSheet.create({
  totalBadge: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
  },
  totalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  diagramCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
    textAlign: 'center',
  },
  platesGrid: {
    gap: 8,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  plateSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateSwatchText: {
    fontSize: 11,
    fontWeight: '900',
  },
  plateLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  counterDisplay: {
    width: 36,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  plateSubtotal: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  resetBtn: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Componente Principal ──────────────────────────────────────────────────────

type CalcMode = 'perSide' | 'total';

/** Pesos de barra padrão disponíveis para seleção rápida. */
const BAR_WEIGHT_OPTIONS = [15, 20] as const;

export function PlateCalculatorModal({
  visible,
  onClose,
  initialWeight = '',
}: PlateCalculatorModalProps) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const [mode, setMode] = useState<CalcMode>('perSide');
  const [barWeight, setBarWeight] = useState<15 | 20>(20);

  // Modo "Por Lado"
  const [plateCounts, setPlateCounts] = useState<PlateCountMap>({ ...EMPTY_PLATE_COUNT });

  // Modo "Peso Total"
  const [targetWeightStr, setTargetWeightStr] = useState(initialWeight);

  // Recalcula o resultado do modo total sempre que os inputs mudarem
  const totalModeResult = useMemo<PlateResult | null>(() => {
    const target = parseFloat(targetWeightStr.replace(',', '.'));
    if (isNaN(target) || target <= 0) return null;
    return calculatePlates(target, barWeight);
  }, [targetWeightStr, barWeight]);

  const handleIncrement = useCallback((plate: PlateWeight) => {
    setPlateCounts((prev) => ({ ...prev, [plate]: prev[plate] + 1 }));
  }, []);

  const handleDecrement = useCallback((plate: PlateWeight) => {
    setPlateCounts((prev) => ({ ...prev, [plate]: Math.max(0, prev[plate] - 1) }));
  }, []);

  const handleReset = useCallback(() => {
    setPlateCounts({ ...EMPTY_PLATE_COUNT });
  }, []);

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* ── Cabeçalho ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>🏋️ Calculadora de Anilhas</Text>
              <Text style={styles.headerSubtitle}>
                {mode === 'perSide'
                  ? 'Adicione anilhas por lado — total calculado automaticamente'
                  : 'Distribuição para cada lado da barra'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Seletor de Peso da Barra ── */}
          <View style={styles.barSection}>
            <Text style={styles.barLabel}>PESO DA BARRA</Text>
            <View style={styles.barOptionsRow}>
              {BAR_WEIGHT_OPTIONS.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[
                    styles.barChip,
                    barWeight === w && styles.barChipActive,
                  ]}
                  onPress={() => setBarWeight(w)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.barChipText,
                      barWeight === w && styles.barChipTextActive,
                    ]}
                  >
                    {w} kg{w === 20 ? '  (Olímpica)' : '  (Feminina)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Toggle de Modo ── */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'perSide' && styles.modeBtnActive]}
              onPress={() => setMode('perSide')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeBtnText, mode === 'perSide' && styles.modeBtnTextActive]}>
                ⚖️ Por Lado
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'total' && styles.modeBtnActive]}
              onPress={() => setMode('total')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeBtnText, mode === 'total' && styles.modeBtnTextActive]}>
                🎯 Peso Total
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'perSide' ? (
              /* ── Modo Por Lado ── */
              <PerSideMode
                plateCounts={plateCounts}
                barWeight={barWeight}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onReset={handleReset}
                colors={colors}
                isDark={isDark}
              />
            ) : (
              /* ── Modo Peso Total (original) ── */
              <View>
                {/* Input de Peso Total */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PESO TOTAL DESEJADO (kg)</Text>
                  <TextInput
                    style={styles.weightInput}
                    value={targetWeightStr}
                    onChangeText={setTargetWeightStr}
                    placeholder="Ex.: 100"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    autoFocus={mode === 'total'}
                  />
                </View>

                {/* Resultado */}
                {totalModeResult ? (
                  <View style={styles.resultSection}>
                    <View style={styles.achievedBadge}>
                      <Text style={styles.achievedLabel}>PESO MONTADO</Text>
                      <Text style={styles.achievedValue}>
                        {totalModeResult.achievedTotal} kg
                      </Text>
                      {totalModeResult.remainder > 0.001 && (
                        <Text style={styles.remainderText}>
                          ⚠️ Não foi possível atingir exatamente{' '}
                          {parseFloat(targetWeightStr.replace(',', '.'))} kg
                          com as anilhas padrão. Resta {totalModeResult.remainder} kg por lado.
                        </Text>
                      )}
                    </View>

                    <View style={styles.diagramCard}>
                      <BarDiagram
                        platesPerSide={totalModeResult.platesPerSide}
                        colors={colors}
                      />
                    </View>

                    <PlateLegend
                      platesPerSide={totalModeResult.platesPerSide}
                      colors={colors}
                      isDark={isDark}
                    />
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateEmoji}>🏋️</Text>
                    <Text style={styles.emptyStateText}>
                      Digite o peso total acima para ver{'\n'}a montagem da barra
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Legenda de Cores ── */}
            <View style={styles.colorKeySection}>
              <Text style={styles.colorKeyTitle}>LEGENDA DE CORES</Text>
              <View style={styles.colorKeyGrid}>
                {STANDARD_PLATES.map((p) => (
                  <View key={p} style={styles.colorKeyItem}>
                    <View
                      style={[
                        styles.colorKeySwatch,
                        { backgroundColor: PLATE_COLORS[p] },
                      ]}
                    />
                    <Text style={[styles.colorKeyLabel, { color: colors.textSecondary }]}>
                      {p} kg
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* ── Botão Fechar ── */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 2,
      borderTopColor: colors.primary,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.surfaceBorder,
      maxHeight: '94%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      maxWidth: 240,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    closeBtnText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },

    // ── Seletor de Barra ──
    barSection: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    barLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.textMuted,
      marginBottom: 8,
    },
    barOptionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    barChip: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
    },
    barChipActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(56, 189, 248, 0.12)'
        : 'rgba(2, 132, 199, 0.1)',
    },
    barChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    barChipTextActive: {
      color: colors.primary,
    },

    // ── Toggle de Modo ──
    modeToggle: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginVertical: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 3,
      gap: 3,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: 'center',
    },
    modeBtnActive: {
      backgroundColor: colors.primary,
    },
    modeBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
    },
    modeBtnTextActive: {
      color: isDark ? '#0A0D14' : '#FFFFFF',
    },

    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
    },

    // ── Modo Total: Inputs ──
    inputGroup: {
      gap: 8,
      marginBottom: 20,
      marginTop: 12,
    },
    inputLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    weightInput: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: '900',
      paddingVertical: 14,
      paddingHorizontal: 18,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },

    // ── Modo Total: Resultado ──
    resultSection: {
      gap: 16,
      marginBottom: 20,
    },
    achievedBadge: {
      backgroundColor: isDark
        ? 'rgba(56, 189, 248, 0.08)'
        : 'rgba(2, 132, 199, 0.07)',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      padding: 16,
      alignItems: 'center',
    },
    achievedLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.primary,
      marginBottom: 4,
    },
    achievedValue: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    remainderText: {
      marginTop: 8,
      fontSize: 12,
      color: colors.streak,
      textAlign: 'center',
      lineHeight: 18,
    },
    diagramCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
    },

    // ── Empty State ──
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 10,
    },
    emptyStateEmoji: {
      fontSize: 40,
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },

    // ── Legenda de Cores ──
    colorKeySection: {
      marginTop: 16,
      marginBottom: 16,
    },
    colorKeyTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 10,
    },
    colorKeyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
    },
    colorKeyItem: {
      alignItems: 'center',
      gap: 4,
    },
    colorKeySwatch: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    colorKeyLabel: {
      fontSize: 11,
      fontWeight: '700',
    },

    // ── Botão Fechar ──
    doneBtn: {
      margin: 20,
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    doneBtnText: {
      color: isDark ? '#0A0D14' : '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });
}
