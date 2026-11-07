import { describe, it, expect } from 'vitest';
import {
  calculate1RMBrzycki,
  calculate1RMEpley,
  calculate1RMLander,
  calculate1RM,
  getPercentageTable,
  type OneRepMaxResult,
} from '../oneRepMax';

describe('Cálculo de 1RM (One Rep Max)', () => {
  describe('Caso base: 1 repetição', () => {
    it('deve retornar exatamente a carga levantada para 1 repetição em todas as fórmulas', () => {
      const weight = 120;
      expect(calculate1RMBrzycki(weight, 1)).toBe(120);
      expect(calculate1RMEpley(weight, 1)).toBe(120);
      expect(calculate1RMLander(weight, 1)).toBe(120);

      const combined = calculate1RM(weight, 1) as OneRepMaxResult;
      expect(combined.brzycki).toBe(120);
      expect(combined.epley).toBe(120);
      expect(combined.lander).toBe(120);
      expect(combined.average).toBe(120);
    });
  });

  describe('Fórmula de Brzycki', () => {
    it('deve calcular corretamente para 100kg e 5 repetições (112.5kg)', () => {
      // 100 * (36 / (37 - 5)) = 100 * (36 / 32) = 112.5
      expect(calculate1RMBrzycki(100, 5)).toBe(112.5);
    });

    it('deve calcular corretamente para 80kg e 10 repetições (~106.67kg)', () => {
      // 80 * (36 / 27) = 106.666... -> 106.67
      expect(calculate1RMBrzycki(80, 10)).toBe(106.67);
    });

    it('deve disparar erro para repetições iguais ou maiores que 37', () => {
      expect(() => calculate1RMBrzycki(100, 37)).toThrow(
        'A fórmula de Brzycki só é válida para repetições menores que 37.'
      );
    });
  });

  describe('Fórmula de Epley', () => {
    it('deve calcular corretamente para 100kg e 5 repetições (~116.67kg)', () => {
      // 100 * (1 + 5/30) = 116.666... -> 116.67
      expect(calculate1RMEpley(100, 5)).toBe(116.67);
    });

    it('deve calcular corretamente para 80kg e 10 repetições (~106.67kg)', () => {
      // 80 * (1 + 10/30) = 106.666... -> 106.67
      expect(calculate1RMEpley(80, 10)).toBe(106.67);
    });
  });

  describe('Fórmula de Lander', () => {
    it('deve calcular corretamente para 100kg e 5 repetições (~113.71kg)', () => {
      // 10000 / (101.3 - 2.67123 * 5) = 10000 / 87.94385 = 113.708... -> 113.71
      expect(calculate1RMLander(100, 5)).toBe(113.71);
    });

    it('deve calcular corretamente para 80kg e 10 repetições (~107.26kg)', () => {
      // 8000 / (101.3 - 26.7123) = 8000 / 74.5877 = 107.256... -> 107.26
      expect(calculate1RMLander(80, 10)).toBe(107.26);
    });
  });

  describe('Função calculate1RM genérica', () => {
    it('deve calcular com fórmula específica quando solicitada', () => {
      expect(calculate1RM(100, 5, 'brzycki')).toBe(112.5);
      expect(calculate1RM(100, 5, 'epley')).toBe(116.67);
      expect(calculate1RM(100, 5, 'lander')).toBe(113.71);
    });

    it('deve retornar todas as fórmulas e a média quando nenhuma fórmula for informada', () => {
      const result = calculate1RM(100, 5) as OneRepMaxResult;
      expect(result).toHaveProperty('brzycki', 112.5);
      expect(result).toHaveProperty('epley', 116.67);
      expect(result).toHaveProperty('lander', 113.71);
      // Média: (112.5 + 116.67 + 113.71) / 3 = 114.293... -> 114.29
      expect(result.average).toBe(114.29);
    });
  });

  describe('Validações de entrada', () => {
    it('deve rejeitar carga menor ou igual a zero', () => {
      expect(() => calculate1RMBrzycki(0, 5)).toThrow('Peso inválido');
      expect(() => calculate1RMEpley(-10, 5)).toThrow('Peso inválido');
      expect(() => calculate1RMLander(NaN, 5)).toThrow('Peso inválido');
    });

    it('deve rejeitar repetições menores ou iguais a zero', () => {
      expect(() => calculate1RMBrzycki(100, 0)).toThrow('Repetições inválidas');
      expect(() => calculate1RMEpley(100, -2)).toThrow('Repetições inválidas');
    });

    it('deve rejeitar repetições que não sejam números inteiros', () => {
      expect(() => calculate1RMBrzycki(100, 5.5)).toThrow('Repetições inválidas');
    });
  });
});

describe('Tabela de Porcentagens de Carga', () => {
  it('deve gerar 11 entradas de 100% a 50% em passos de 5%', () => {
    const table = getPercentageTable(100);

    expect(table).toHaveLength(11);
    expect(table[0]).toEqual({ percentage: 100, weight: 100 });
    expect(table[table.length - 1]).toEqual({ percentage: 50, weight: 50 });

    const expectedPercentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
    const actualPercentages = table.map((entry) => entry.percentage);
    expect(actualPercentages).toEqual(expectedPercentages);
  });

  it('deve calcular pesos proporcionais corretos para uma carga arbitrária de 1RM', () => {
    const table = getPercentageTable(140);
    // 140 * 0.90 = 126
    const ninetyPercent = table.find((e) => e.percentage === 90);
    expect(ninetyPercent?.weight).toBe(126);

    // 140 * 0.75 = 105
    const seventyFivePercent = table.find((e) => e.percentage === 75);
    expect(seventyFivePercent?.weight).toBe(105);
  });

  it('deve suportar arredondamento para o incremento mais próximo (ex: 2.5kg)', () => {
    // 1RM = 103kg
    // 90% = 92.7kg -> com roundToNearest 2.5 deve ser 92.5
    // 85% = 87.55kg -> com roundToNearest 2.5 deve ser 87.5
    const table = getPercentageTable(103, { roundToNearest: 2.5 });

    const ninety = table.find((e) => e.percentage === 90);
    expect(ninety?.weight).toBe(92.5);

    const eightyFive = table.find((e) => e.percentage === 85);
    expect(eightyFive?.weight).toBe(87.5);
  });

  it('deve incluir repetições sugeridas quando habilitado', () => {
    const table = getPercentageTable(100, { includeSuggestedReps: true });

    const hundred = table.find((e) => e.percentage === 100);
    expect(hundred?.suggestedReps).toBe(1);

    const eighty = table.find((e) => e.percentage === 80);
    expect(eighty?.suggestedReps).toBe(8);

    const fifty = table.find((e) => e.percentage === 50);
    expect(fifty?.suggestedReps).toBe(30);
  });

  it('deve rejeitar 1RM inválido na tabela', () => {
    expect(() => getPercentageTable(0)).toThrow('Carga de 1RM inválida');
    expect(() => getPercentageTable(-50)).toThrow('Carga de 1RM inválida');
  });
});
