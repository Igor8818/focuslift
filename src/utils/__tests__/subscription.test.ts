import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  PLANS,
  type SubscriptionPlan,
} from '../../contexts/SubscriptionContext';

describe('Sistema de Monetização e Assinaturas (FocusLift PRO)', () => {
  it('deve definir o limite gratuito padrão de fichas como 3', () => {
    expect(FREE_ROUTINE_LIMIT).toBe(3);
  });

  it('deve disponibilizar os 3 planos principais: anual, mensal e vitalício', () => {
    expect(PLANS).toHaveLength(3);
    const planIds = PLANS.map((p) => p.id);
    expect(planIds).toContain('annual');
    expect(planIds).toContain('monthly');
    expect(planIds).toContain('lifetime');
  });

  it('deve destacar o plano anual com 50% de desconto e economia mensal', () => {
    const annual = PLANS.find((p) => p.id === 'annual');
    expect(annual).toBeDefined();
    expect(annual?.popular).toBe(true);
    expect(annual?.savings).toBe('50% OFF');
    expect(annual?.priceFormatted).toBe('R$ 89,90');
    expect(annual?.monthlyEquivalent).toContain('R$ 7,49');
  });

  it('deve validar permissão de criação de rotinas para usuários Free e Pro', () => {
    const checkCanCreate = (isPro: boolean, currentCount: number) => {
      if (isPro) return true;
      return currentCount < FREE_ROUTINE_LIMIT;
    };

    // Usuário Free
    expect(checkCanCreate(false, 0)).toBe(true);
    expect(checkCanCreate(false, 1)).toBe(true);
    expect(checkCanCreate(false, 2)).toBe(true);
    expect(checkCanCreate(false, 3)).toBe(false); // Limite atingido!
    expect(checkCanCreate(false, 5)).toBe(false);

    // Usuário PRO
    expect(checkCanCreate(true, 0)).toBe(true);
    expect(checkCanCreate(true, 3)).toBe(true);
    expect(checkCanCreate(true, 10)).toBe(true);
    expect(checkCanCreate(true, 99)).toBe(true);
  });

  it('deve calcular corretamente a quantidade restante de fichas gratuitas', () => {
    const getRemaining = (isPro: boolean, currentCount: number) => {
      if (isPro) return Infinity;
      return Math.max(0, FREE_ROUTINE_LIMIT - currentCount);
    };

    expect(getRemaining(false, 0)).toBe(3);
    expect(getRemaining(false, 1)).toBe(2);
    expect(getRemaining(false, 2)).toBe(1);
    expect(getRemaining(false, 3)).toBe(0);
    expect(getRemaining(false, 4)).toBe(0);

    expect(getRemaining(true, 0)).toBe(Infinity);
    expect(getRemaining(true, 5)).toBe(Infinity);
  });
});
