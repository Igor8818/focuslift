import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    multiRemove: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  constantTimeEqual,
  generateSalt,
  hashPasswordWithSalt,
  sha256Hex,
  verifyPasswordHash,
} from '../cryptoHash';
import { sanitizeBackendUrl } from '../../services/springApiService';
import { findTodayRoutineIndex, isCardioExercise } from '../weekdayRoutine';
import { parseDietText } from '../dietTextParser';
import { estimateMealProteinG } from '../dietProteinEstimator';
import { parseWorkoutText } from '../workoutTextParser';

describe('Segurança: Crypto Hash, URL Sanitization e Fluxo de Treino/Dieta', () => {
  it('sha256Hex deve bater exatamente com os vetores oficiais FIPS 180-4', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
    const utf8Digest = sha256Hex('FocusLift_çãõ🔐');
    expect(utf8Digest).toMatch(/^[0-9a-f]{64}$/);
    expect(utf8Digest).toBe(sha256Hex('FocusLift_çãõ🔐'));
    expect(utf8Digest).not.toBe(sha256Hex('FocusLift_cao'));
  });

  it('hashPasswordWithSalt + verifyPasswordHash devem validar a senha correta e rejeitar incorreta', () => {
    const salt = generateSalt(16);
    expect(salt.length).toBeGreaterThanOrEqual(16);

    const hash = hashPasswordWithSalt('MinhaSenhaForte123', salt);
    expect(verifyPasswordHash('MinhaSenhaForte123', salt, hash)).toBe(true);
    expect(verifyPasswordHash('SenhaErrada123', salt, hash)).toBe(false);
    expect(verifyPasswordHash('MinhaSenhaForte123', 'outro_salt_12345', hash)).toBe(false);
    expect(constantTimeEqual('abcd1234', 'abcd1234')).toBe(true);
    expect(constantTimeEqual('abcd1234', 'abcd1235')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('sanitizeBackendUrl deve aceitar HTTPS e HTTP local/LAN, e bloquear URLs inseguras', () => {
    expect(sanitizeBackendUrl('https://focuslift-api.onrender.com/')).toBe('https://focuslift-api.onrender.com');
    expect(sanitizeBackendUrl('http://10.0.2.2:8080/')).toBe('http://10.0.2.2:8080');
    expect(sanitizeBackendUrl('http://localhost:8080')).toBe('http://localhost:8080');
    expect(sanitizeBackendUrl('http://192.168.1.50:8080')).toBe('http://192.168.1.50:8080');

    expect(() => sanitizeBackendUrl('')).toThrow();
    expect(() => sanitizeBackendUrl('javascript:alert(1)')).toThrow();
    expect(() => sanitizeBackendUrl('file:///etc/passwd')).toThrow();
    expect(() => sanitizeBackendUrl('http://api.meu-dominio-publico.com')).toThrow();
  });

  it('findTodayRoutineIndex e isCardioExercise devem identificar o treino do dia e exercícios aeróbicos', () => {
    const routines = [
      { name: 'SEGUNDA-FEIRA: Push (Peito, Ombro e Tríceps)' },
      { name: 'TERÇA-FEIRA: Pull (Costas, Posterior de Ombro e Bíceps)' },
      { name: 'QUARTA-FEIRA: Pernas e Core' },
      { name: 'QUINTA-FEIRA: Descanso (Cardio)' },
      { name: 'SEXTA-FEIRA: Upper Body' },
      { name: 'SÁBADO: Ombros, Braços, Core e Cardio' },
      { name: 'DOMINGO: Cardio Livre' },
    ];

    expect(findTodayRoutineIndex(routines, new Date(2026, 10, 16))).toBe(0); // Seg
    expect(findTodayRoutineIndex(routines, new Date(2026, 10, 19))).toBe(3); // Qui
    expect(findTodayRoutineIndex(routines, new Date(2026, 10, 20))).toBe(4); // Sex
    expect(findTodayRoutineIndex(routines, new Date(2026, 10, 22))).toBe(6); // Dom
    expect(findTodayRoutineIndex([{ name: 'Full Body A' }], new Date(2026, 10, 20))).toBe(-1);

    expect(isCardioExercise('Caminhada inclinada', 'Cardio')).toBe(true);
    expect(isCardioExercise('Cardio', null)).toBe(true);
    expect(isCardioExercise('Supino Inclinado com Halteres', 'Peito')).toBe(false);
  });

  it('parseWorkoutText deve preservar warmupSets quando houver séries preparatórias', () => {
    const parsed = parseWorkoutText(`
SEGUNDA-FEIRA: Push (Peito, Ombro e Tríceps)
- Supino Inclinado com Halteres | 2 prep + 2x 6-8
- Cadeira Extensora | 2x 12-15 (dropset na última)
- Cardio: 20-25 min caminhada inclinada
    `);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].exercises[0].targetSets).toBe(4);
    expect(parsed[0].exercises[0].warmupSets).toBe(2);
    expect(parsed[0].exercises[0].targetReps).toBe('6-8');
    expect(parsed[0].exercises[1].notes).toContain('dropset');
    expect(parsed[0].exercises[2].targetReps).toBe('20-25 min');
  });

  it('estimateMealProteinG deve estimar corretamente a proteína das refeições da dieta Cutting', () => {
    const plan = parseDietText(`
PLANO ALIMENTAR - CUTTING
Meta Seg a Sex: ~2.200 kcal | ~180g Prot
Água: 4 litros/dia

09:00 - CAFÉ DA MANHÃ
- 3 ovos inteiros (mexidos ou cozidos)
- 100g cuscuz cozido (ou 2 fatias de pão de forma / 1 pão francês)
- Café preto

12:00 - PRÉ-TREINO
- 40g Whey Concentrado 70%
- 250ml leite desnatado
- 40g aveia em flocos
- 1 banana média (80g)

15:30 - ALMOÇO
Base fixa:
- 200g arroz cozido
- 150g feijão cozido
Proteína (escolher 1 opção):
- 140-150g peito de frango

22:00 - CEIA
- 30g Whey Concentrado 70%
- 170g iogurte natural desnatado
- 30g leite em pó desnatado
    `);

    const cafe = estimateMealProteinG(plan.meals[0]);
    const pre = estimateMealProteinG(plan.meals[1]);
    const almoco = estimateMealProteinG(plan.meals[2]);
    const ceia = estimateMealProteinG(plan.meals[3]);

    expect(cafe).toBeGreaterThanOrEqual(18);
    expect(cafe).toBeLessThanOrEqual(24);
    expect(pre).toBeGreaterThanOrEqual(36);
    expect(pre).toBeLessThanOrEqual(48);
    expect(almoco).toBeGreaterThanOrEqual(45);
    expect(almoco).toBeLessThanOrEqual(60);
    expect(ceia).toBeGreaterThanOrEqual(34);
    expect(ceia).toBeLessThanOrEqual(44);
  });
});
