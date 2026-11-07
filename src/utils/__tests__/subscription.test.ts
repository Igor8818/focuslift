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
} from '../../contexts/SubscriptionContext';

describe('Sistema de Preferências e Acesso Ilimitado', () => {
  it('deve definir o limite de rotinas como ilimitado', () => {
    expect(FREE_ROUTINE_LIMIT).toBe(Infinity);
  });

  it('deve permitir criação ilimitada de rotinas em qualquer contagem', () => {
    const checkCanCreate = (currentCount: number) => {
      return currentCount < FREE_ROUTINE_LIMIT;
    };

    expect(checkCanCreate(0)).toBe(true);
    expect(checkCanCreate(3)).toBe(true);
    expect(checkCanCreate(10)).toBe(true);
    expect(checkCanCreate(100)).toBe(true);
  });

  it('deve retornar quantidade restante infinita de rotinas', () => {
    const getRemaining = (currentCount: number) => {
      return FREE_ROUTINE_LIMIT - currentCount;
    };

    expect(getRemaining(0)).toBe(Infinity);
    expect(getRemaining(10)).toBe(Infinity);
  });
});
