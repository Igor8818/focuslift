/**
 * date.ts
 *
 * Helpers de data no fuso horário LOCAL do aparelho.
 *
 * ⚠️ Nunca use `new Date().toISOString().split('T')[0]` para obter "hoje":
 * `toISOString()` converte para UTC, então no Brasil (GMT-3) qualquer treino
 * registrado depois das 21h seria salvo com a data de amanhã.
 */

/** Retorna a data no formato 'YYYY-MM-DD' usando o fuso horário local. */
export function toLocalIsoDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Data local de hoje ('YYYY-MM-DD'). */
export function todayLocalIso(): string {
  return toLocalIsoDate(new Date());
}

/** Data local de N dias atrás ('YYYY-MM-DD'). */
export function daysAgoLocalIso(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return toLocalIsoDate(d);
}
