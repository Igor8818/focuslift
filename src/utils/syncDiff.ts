/**
 * syncDiff.ts
 *
 * Utilitários puros (sem Firebase/AsyncStorage) para o sync incremental.
 * Cada documento é identificado por um path e por um hash do seu conteúdo
 * (ignorando campos voláteis como `syncedAt`). Só documentos cujo hash mudou
 * desde o último sync bem-sucedido são reenviados ao Firestore.
 */

/** Campos que mudam a cada execução e não devem influenciar o hash. */
const VOLATILE_FIELDS = new Set(['syncedAt']);

/** Serialização JSON estável (ordena as chaves) ignorando campos voláteis. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => !VOLATILE_FIELDS.has(k) && obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Hash FNV-1a de 32 bits em hexadecimal (suficiente para detecção de mudança). */
export function hashDoc(data: Record<string, unknown>): string {
  const str = stableStringify(data);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type HashMap = Record<string, string>;

export interface SyncOperation {
  /** Path completo do documento, ex.: `users/uid/workouts/12`. */
  path: string;
  data: Record<string, unknown>;
}

/**
 * Retorna apenas as operações cujo conteúdo mudou em relação ao mapa de hashes
 * anterior. Com `force = true`, retorna todas (sync completo manual).
 */
export function filterChangedOperations<T extends SyncOperation>(
  operations: T[],
  previousHashes: HashMap,
  force = false
): T[] {
  if (force) return operations;
  return operations.filter((op) => previousHashes[op.path] !== hashDoc(op.data));
}
