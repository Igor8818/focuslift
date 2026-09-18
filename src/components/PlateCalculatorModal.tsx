/**
 * PlateCalculatorModal.tsx
 *
 * Calculadora visual de anilhas para o FocusLift.
 *
 * Recebe o peso total desejado e o peso da barra (padrão 20 kg) e calcula
 * a combinação ideal de anilhas padrão para cada lado.
 * Exibe um diagrama visual da barra com as anilhas empilhadas por lado.
 *
 * Suporta Dark/Light mode via useTheme().
 */

import React, { useState, useMemo } from 'react';
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
  2.5:  '#FFFFFF', // Branco
  1.25: '#A855F7', // Roxo
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
 * Usa algoritmo greedy (maior para menor), já que as anilhas são valores fixos.
 *
 * @param targetWeight - Peso total desejado em kg.
 * @param barWeight    - Peso da barra em kg (padrão: 20).
 * @returns Anilhas por lado + peso real montado + resto não coberto.
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
      // Arredonda para evitar floating-point drift
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

// ─── Sub-componente: Diagrama da Barra ─────────────────────────────────────────

interface BarDiagramProps {
  platesPerSide: PlateWeight[];
  colors: ReturnType<typeof useTheme>['colors'];
}

/**
 * Renderiza o diagrama visual horizontal da barra com as anilhas empilhadas.
 * Cada lado espelha o outro conforme a montagem real de uma barra olímpica.
 */
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

  // Lado direito: mesmo arranjo (espelho)
  const rightSide = [...platesPerSide].reverse();
  const barHeight = 16;
  const barColor = colors.textSecondary;

  return (
    <View style={diagramStyles.diagramWrapper}>
      {/* Collar esquerdo */}
      <View style={[diagramStyles.collar, { backgroundColor: barColor }]} />

      {/* Anilhas lado ESQUERDO (da mais leve à mais pesada = mais próxima do centro) */}
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

      {/* Anilhas lado DIREITO (da mais pesada à mais leve = mais afastada do centro) */}
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

/**
 * Exibe um resumo agrupado das anilhas: ex. "2× 20 kg  1× 5 kg"
 */
function PlateLegend({ platesPerSide, colors, isDark }: PlateLegendProps) {
  // Agrupa contagens
  const groups = useMemo(() => {
    const map = new Map<PlateWeight, number>();
    for (const plate of platesPerSide) {
      map.set(plate, (map.get(plate) ?? 0) + 1);
    }
    // Retorna na ordem de STANDARD_PLATES para consistência visual
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

// ─── Componente Principal ──────────────────────────────────────────────────────

/** Pesos de barra padrão disponíveis para seleção rápida. */
const BAR_WEIGHT_OPTIONS = [15, 20] as const;

export function PlateCalculatorModal({
  visible,
  onClose,
  initialWeight = '',
}: PlateCalculatorModalProps) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const [targetWeightStr, setTargetWeightStr] = useState(initialWeight);
  const [barWeight, setBarWeight] = useState<15 | 20>(20);

  // Recalcula sempre que os inputs mudarem
  const result = useMemo<PlateResult | null>(() => {
    const target = parseFloat(targetWeightStr.replace(',', '.'));
    if (isNaN(target) || target <= 0) return null;
    return calculatePlates(target, barWeight);
  }, [targetWeightStr, barWeight]);

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
                Distribuição para cada lado da barra
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Inputs ── */}
            <View style={styles.inputsSection}>
              {/* Peso Total Desejado */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PESO TOTAL DESEJADO (kg)</Text>
                <TextInput
                  style={styles.weightInput}
                  value={targetWeightStr}
                  onChangeText={setTargetWeightStr}
                  placeholder="Ex.: 100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              {/* Seletor de Peso da Barra */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PESO DA BARRA</Text>
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
            </View>

            {/* ── Resultado ── */}
            {result ? (
              <View style={styles.resultSection}>
                {/* Badge de peso montado */}
                <View style={styles.achievedBadge}>
                  <Text style={styles.achievedLabel}>PESO MONTADO</Text>
                  <Text style={styles.achievedValue}>
                    {result.achievedTotal} kg
                  </Text>
                  {result.remainder > 0.001 && (
                    <Text style={styles.remainderText}>
                      ⚠️ Não foi possível atingir exatamente{' '}
                      {parseFloat(targetWeightStr.replace(',', '.'))} kg
                      com as anilhas padrão. Resta {result.remainder} kg por lado.
                    </Text>
                  )}
                </View>

                {/* Diagrama visual da barra */}
                <View style={styles.diagramCard}>
                  <BarDiagram
                    platesPerSide={result.platesPerSide}
                    colors={colors}
                  />
                </View>

                {/* Legenda detalhada */}
                <PlateLegend
                  platesPerSide={result.platesPerSide}
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
      paddingTop: 0,
      paddingHorizontal: 0,
      paddingBottom: 0,
      maxHeight: '92%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
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
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },

    // ── Inputs ──
    inputsSection: {
      gap: 16,
      marginBottom: 20,
    },
    inputGroup: {
      gap: 8,
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
    barOptionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    barChip: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
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

    // ── Resultado ──
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
      marginTop: 4,
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
