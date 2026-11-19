import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

import {
  FREE_ROUTINE_LIMIT,
  FREE_AI_TRIAL_LIMIT,
  getLocalizedPlans,
} from '../../contexts/SubscriptionContext';

describe('Sistema Freemium / FocusLift PRO e Preços Globais', () => {
  it('deve definir os limites de plano gratuito em 3 fichas e 3 usos de IA', () => {
    expect(FREE_ROUTINE_LIMIT).toBe(3);
    expect(FREE_AI_TRIAL_LIMIT).toBe(3);
  });

  it('deve aplicar a trava de fichas apenas no plano gratuito', () => {
    const canCreate = (isPro: boolean, currentCount: number, additional = 1) => {
      if (isPro) return true;
      return currentCount + additional <= FREE_ROUTINE_LIMIT;
    };

    expect(canCreate(false, 0)).toBe(true);
    expect(canCreate(false, 2)).toBe(true);
    expect(canCreate(false, 3)).toBe(false);
    expect(canCreate(true, 3)).toBe(true);
    expect(canCreate(true, 50)).toBe(true);
  });

  it('deve retornar planos localizados corretos para Brasil (PT) e Global (EN)', () => {
    const ptPlans = getLocalizedPlans('pt');
    expect(ptPlans).toHaveLength(2);
    expect(ptPlans.find((p) => p.id === 'annual')?.priceFormatted).toBe('R$ 119,90/ano');
    expect(ptPlans.find((p) => p.id === 'monthly')?.priceFormatted).toBe('R$ 14,90/mês');

    const enPlans = getLocalizedPlans('en');
    expect(enPlans).toHaveLength(2);
    expect(enPlans.find((p) => p.id === 'annual')?.priceFormatted).toBe('$39.99/yr');
    expect(enPlans.find((p) => p.id === 'monthly')?.priceFormatted).toBe('$4.99/mo');
  });
});
