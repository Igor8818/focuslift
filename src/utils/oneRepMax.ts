/**
 * Módulo de estimativa de 1RM (Uma Repetição Máxima) e cálculo de porcentagens de carga.
 */

export type OneRepMaxFormula = 'brzycki' | 'epley' | 'lander';

export interface OneRepMaxResult {
  brzycki: number;
  epley: number;
  lander: number;
  average: number;
}

export interface PercentageTableEntry {
  percentage: number;
  weight: number;
  suggestedReps?: number;
}

export interface PercentageTableOptions {
  /**
   * Arredonda o peso para o número especificado de casas decimais (padrão: 1)
   */
  decimals?: number;
  /**
   * Arredonda para o incremento de peso mais próximo (ex: 0.5, 1, 2.5)
   */
  roundToNearest?: number;
  /**
   * Se verdadeiro, inclui estimativa aproximada de repetições suportadas
   */
  includeSuggestedReps?: boolean;
}

/**
 * Valida os valores de entrada de carga e repetições.
 */
function validateInputs(weight: number, reps: number): void {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`Peso inválido: ${weight}. O peso deve ser um número positivo maior que zero.`);
  }
  if (!Number.isInteger(reps) || reps <= 0) {
    throw new Error(`Repetições inválidas: ${reps}. O número de repetições deve ser um número inteiro maior que zero.`);
  }
}

/**
 * Arredonda um número para casas decimais ou múltiplo especificado.
 */
function roundWeight(val: number, decimals: number = 2, roundToNearest?: number): number {
  if (roundToNearest && roundToNearest > 0) {
    return Math.round(val / roundToNearest) * roundToNearest;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Estimativa de 1RM pela fórmula de Brzycki:
 * 1RM = weight * (36 / (37 - reps))
 * 
 * Aplicável para repetições entre 1 e 36.
 */
export function calculate1RMBrzycki(weight: number, reps: number): number {
  validateInputs(weight, reps);

  if (reps === 1) {
    return weight;
  }

  if (reps >= 37) {
    throw new Error('A fórmula de Brzycki só é válida para repetições menores que 37.');
  }

  const result = weight * (36 / (37 - reps));
  return roundWeight(result, 2);
}

/**
 * Estimativa de 1RM pela fórmula de Epley:
 * 1RM = weight * (1 + reps / 30)
 */
export function calculate1RMEpley(weight: number, reps: number): number {
  validateInputs(weight, reps);

  if (reps === 1) {
    return weight;
  }

  const result = weight * (1 + reps / 30);
  return roundWeight(result, 2);
}

/**
 * Estimativa de 1RM pela fórmula de Lander:
 * 1RM = (100 * weight) / (101.3 - 2.67123 * reps)
 */
export function calculate1RMLander(weight: number, reps: number): number {
  validateInputs(weight, reps);

  if (reps === 1) {
    return weight;
  }

  const denominator = 101.3 - 2.67123 * reps;
  if (denominator <= 0) {
    throw new Error('Número de repetições muito alto para a fórmula de Lander.');
  }

  const result = (100 * weight) / denominator;
  return roundWeight(result, 2);
}

/**
 * Calcula a estimativa de 1RM com suporte a fórmulas individuais ou retorno agregado
 * contendo os valores de Brzycki, Epley, Lander e a média entre eles.
 */
export function calculate1RM(
  weight: number,
  reps: number,
  formula?: OneRepMaxFormula
): number | OneRepMaxResult {
  if (formula === 'brzycki') {
    return calculate1RMBrzycki(weight, reps);
  }
  if (formula === 'epley') {
    return calculate1RMEpley(weight, reps);
  }
  if (formula === 'lander') {
    return calculate1RMLander(weight, reps);
  }

  const brzycki = calculate1RMBrzycki(weight, reps);
  const epley = calculate1RMEpley(weight, reps);
  const lander = calculate1RMLander(weight, reps);
  const average = roundWeight((brzycki + epley + lander) / 3, 2);

  return {
    brzycki,
    epley,
    lander,
    average,
  };
}

/**
 * Mapa aproximado de repetições estimadas por porcentagem de 1RM (baseado na tabela clássica de Bompa/NSCA).
 */
const SUGGESTED_REPS_MAP: Record<number, number> = {
  100: 1,
  95: 2,
  90: 4,
  85: 6,
  80: 8,
  75: 10,
  70: 12,
  65: 15,
  60: 20,
  55: 25,
  50: 30,
};

/**
 * Gera a tabela de porcentagens de carga estimada de 100% a 50% em passos de 5%.
 *
 * @param oneRepMax Valor da carga de 1RM
 * @param options Opções de arredondamento e inclusão de repetições estimadas
 * @returns Lista com as entradas de 100% até 50%
 */
export function getPercentageTable(
  oneRepMax: number,
  options?: PercentageTableOptions
): PercentageTableEntry[] {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) {
    throw new Error(`Carga de 1RM inválida: ${oneRepMax}. Deve ser um número positivo maior que zero.`);
  }

  const decimals = options?.decimals ?? 1;
  const roundToNearest = options?.roundToNearest;
  const includeSuggestedReps = options?.includeSuggestedReps ?? false;

  const table: PercentageTableEntry[] = [];

  // De 100% a 50% em passos de 5%
  for (let percentage = 100; percentage >= 50; percentage -= 5) {
    const rawWeight = oneRepMax * (percentage / 100);
    const weight = roundWeight(rawWeight, decimals, roundToNearest);

    const entry: PercentageTableEntry = {
      percentage,
      weight,
    };

    if (includeSuggestedReps) {
      entry.suggestedReps = SUGGESTED_REPS_MAP[percentage];
    }

    table.push(entry);
  }

  return table;
}
