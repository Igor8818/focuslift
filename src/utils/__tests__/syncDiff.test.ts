import { describe, it, expect } from 'vitest';
import { hashDoc, filterChangedOperations, stableStringify } from '../syncDiff';

describe('syncDiff', () => {
  it('ignora syncedAt e a ordem das chaves no hash', () => {
    const a = { userId: 'u', title: 'Treino A', syncedAt: '2026-01-01T00:00:00Z' };
    const b = { syncedAt: '2030-12-31T00:00:00Z', title: 'Treino A', userId: 'u' };
    expect(hashDoc(a)).toBe(hashDoc(b));
  });

  it('muda o hash quando o conteúdo muda (inclusive em objetos aninhados)', () => {
    const a = { exercises: [{ sets: [{ weight: 80, reps: 5 }] }] };
    const b = { exercises: [{ sets: [{ weight: 82.5, reps: 5 }] }] };
    expect(hashDoc(a)).not.toBe(hashDoc(b));
  });

  it('stableStringify trata null e undefined de forma consistente', () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('filterChangedOperations retorna só o que mudou', () => {
    const ops = [
      { path: 'users/u/workouts/1', data: { title: 'A', syncedAt: 'x' } },
      { path: 'users/u/workouts/2', data: { title: 'B', syncedAt: 'x' } },
    ];
    const previous = { 'users/u/workouts/1': hashDoc(ops[0].data) };
    const changed = filterChangedOperations(ops, previous);
    expect(changed.map((o) => o.path)).toEqual(['users/u/workouts/2']);
  });

  it('force retorna todas as operações', () => {
    const ops = [{ path: 'p', data: { a: 1 } }];
    expect(filterChangedOperations(ops, { p: hashDoc({ a: 1 }) }, true)).toHaveLength(1);
  });
});
