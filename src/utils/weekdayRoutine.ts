/**
 * weekdayRoutine.ts
 *
 * Helpers puros para detectar exercícios de cardio e localizar automaticamente
 * a ficha correspondente ao dia da semana atual.
 */

const WEEKDAY_PATTERNS: Record<number, RegExp> = {
  0: /\b(domingo|dom|sunday)\b/i,
  1: /\b(segunda(?:-feira)?|seg|monday)\b/i,
  2: /\b(terca(?:-feira)?|ter|tuesday)\b/i,
  3: /\b(quarta(?:-feira)?|qua|wednesday)\b/i,
  4: /\b(quinta(?:-feira)?|qui|thursday)\b/i,
  5: /\b(sexta(?:-feira)?|sex|friday)\b/i,
  6: /\b(sabado|sab|saturday)\b/i,
};

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Retorna `true` quando o exercício é aeróbico/cardio (para ativar o bloco
 * com cronômetro e minutos na sessão de treino).
 */
export function isCardioExercise(name: string, muscleGroup?: string | null): boolean {
  const cleanGroup = stripAccents(muscleGroup || '');
  if (cleanGroup && /\b(cardio|aerob|aerobio|aerobico)\b/i.test(cleanGroup)) {
    return true;
  }

  const cleanName = stripAccents(name || '');
  return /\b(cardio|caminhada|corrida|trote|esteira|bicicleta|bike|ergometrica|eliptico|transport|corda|pular corda|escada|natacao|remador|ergometro|futebol|hiit|polichinelo)\b/i.test(
    cleanName
  );
}

/**
 * Localiza o índice da ficha que corresponde ao dia da semana de `date`.
 * Retorna `-1` caso nenhuma ficha contenha o dia da semana no nome.
 */
export function findTodayRoutineIndex(
  routines: Array<{ name: string }>,
  date: Date = new Date()
): number {
  if (!Array.isArray(routines) || routines.length === 0) return -1;
  const pattern = WEEKDAY_PATTERNS[date.getDay()];
  if (!pattern) return -1;

  return routines.findIndex((r) => pattern.test(stripAccents(r.name || '')));
}
