import { COMMON_SUGGESTIONS, type ExerciseSuggestionEntry } from './constants';

export interface ParsedExercise {
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  restTimerSeconds: number;
  notes?: string;
  mediaUrl?: string;
  equipment?: string;
  originalText: string;
}

export interface ParsedRoutine {
  name: string;
  description?: string;
  color: string;
  exercises: ParsedExercise[];
  isRestDay?: boolean;
}

export const MAX_RAW_TEXT_LENGTH = 50_000;
export const MAX_ROUTINES_COUNT = 20;
export const MAX_EXERCISES_PER_ROUTINE = 40;

const PALETTE = [
  '#38BDF8', // Azul
  '#10B981', // Verde
  '#F59E0B', // Âmbar
  '#A855F7', // Roxo
  '#F43F5E', // Rosa
  '#6366F1', // Índigo
];

/**
 * Sanitiza campos de texto para proteção contra injeções, caracteres nulos,
 * scripts e limites de tamanho de memória (DoS/Buffer).
 */
export function sanitizeField(str: string, maxLength = 100): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '') // remove bytes nulos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // remove caracteres de controle
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove blocos de script inteiros
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // remove blocos de estilo inteiros
    .replace(/<[^>]*>?/gm, '') // remove quaisquer outras tags HTML
    // Prevenção contra injeções de SQL cruas
    .replace(/(\b)(DROP|DELETE|TRUNCATE|ALTER|EXEC|UNION)\s+(TABLE|FROM|DATABASE|SELECT|INTO)\b/gi, '')
    // Remove aspas ou caracteres perigosos no início
    .replace(/^['";\-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Valida se uma linha é uma tentativa óbvia de prompt injection ou comando arbitrário
 * que não tem relação com exercícios físicos.
 */
export function isMaliciousOrGarbageLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  // Padrões de prompt injection clássicos
  if (/^(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+an?\s+ai|dan\s+mode|jailbreak|forget\s+all\s+rules)\b/i.test(lower)) {
    return true;
  }
  // Padrões de SQL injection clássicos isolados (incluindo quebra de aspas '; DROP...)
  if (/^[\s'"`;\-]*(?:drop\s+table|delete\s+from|truncate\s+table|union\s+select|insert\s+into|select\s+\*\s+from)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Remove acentos e caracteres especiais para comparação flexível.
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai tokens significativos (remove preposições e palavras vazias).
 */
function getTokens(text: string): string[] {
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'em', 'na', 'no', 'nas', 'nos',
    'para', 'por', 'ou', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas'
  ]);
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

/**
 * Encontra a melhor correspondência de exercício em COMMON_SUGGESTIONS.
 */
export function matchExerciseSuggestion(rawName: string): ExerciseSuggestionEntry | null {
  const cleanRaw = normalizeText(rawName);
  if (!cleanRaw) return null;

  // 1. Correspondência exata
  const exact = COMMON_SUGGESTIONS.find(
    (s) => normalizeText(s.name) === cleanRaw
  );
  if (exact) return exact;

  // 2. Substring direta (um contém o outro)
  const substring = COMMON_SUGGESTIONS.find(
    (s) => {
      const sNorm = normalizeText(s.name);
      return cleanRaw.includes(sNorm) || sNorm.includes(cleanRaw);
    }
  );
  if (substring) return substring;

  // 3. Similaridade por sobreposição de tokens significativos
  const rawTokens = getTokens(rawName);
  if (rawTokens.length === 0) return null;

  let bestMatch: ExerciseSuggestionEntry | null = null;
  let highestScore = 0;

  for (const suggestion of COMMON_SUGGESTIONS) {
    const sugTokens = getTokens(suggestion.name);
    let commonCount = 0;

    for (const t of rawTokens) {
      if (sugTokens.includes(t)) {
        commonCount++;
      }
    }

    if (commonCount > 0) {
      const score = commonCount / Math.max(rawTokens.length, sugTokens.length);
      // Prioridade se o primeiro termo (geralmente tipo de exercício: Supino, Puxada, Agachamento) bater
      const firstMatches = sugTokens[0] && rawTokens[0] && sugTokens[0] === rawTokens[0];
      const adjustedScore = firstMatches ? score + 0.3 : score;

      if (adjustedScore > highestScore && adjustedScore >= 0.35) {
        highestScore = adjustedScore;
        bestMatch = suggestion;
      }
    }
  }

  return bestMatch;
}

/**
 * Tenta inferir o grupo muscular a partir do nome ou contexto se não houver match direto.
 */
function inferMuscleGroup(name: string, fallbackGroup?: string): string {
  const norm = normalizeText(name);
  if (/peito|supino|crucifixo|crossover|paralela|flexao/i.test(norm)) return 'Peito';
  if (/costas|puxada|remada|pulldown|chin|dorsal|pullover|terra/i.test(norm)) return 'Costas';
  if (/ombro|deltoide|desenvolvimento|elevacao lateral|elevacao frontal|militar/i.test(norm)) return 'Ombros';
  if (/trapezio|encolhimento/i.test(norm)) return 'Ombros / Trapézio';
  if (/biceps|rosca|scott|martelo/i.test(norm)) return 'Bíceps';
  if (/triceps|frances|testa|corda|coice|mergulho/i.test(norm)) return 'Tríceps';
  if (/quadriceps|agachamento|leg press|extensora|afundo|bulgaro|hack/i.test(norm)) return 'Pernas / Quadríceps';
  if (/posterior|flexora|stiff|good morning/i.test(norm)) return 'Pernas / Posterior';
  if (/gluteo|hip thrust|pelvica|abducao|sumo|kickback/i.test(norm)) return 'Glúteos';
  if (/panturrilha|gemeos/i.test(norm)) return 'Panturrilhas';
  if (/abdomen|abdominal|crunch|prancha|plank|sit up/i.test(norm)) return 'Abdômen';
  if (/cardio|esteira|corrida|bike|bicicleta|caminhada|burpee|corda|hiit/i.test(norm)) return 'Cardio / Funcional';

  return fallbackGroup || 'Geral';
}

/**
 * Analisa uma linha com séries, repetições e notas.
 */
export function parseSetsRepsAndNotes(detailsStr: string): {
  targetSets: number;
  targetReps: string;
  notes?: string;
} {
  let targetSets = 3;
  let targetReps = '10-12';
  let notes: string | undefined = undefined;

  // Extrair observação separada por "—" ou "-" ou ";"
  const noteSeparatorMatch = detailsStr.match(/[—–]\s*(.+)$/);
  if (noteSeparatorMatch) {
    notes = noteSeparatorMatch[1].trim();
  }

  // 1. Detecta formato "X séries preparatórias/aquecimento + Y séries válidas"
  const prepPlusValid = detailsStr.match(/(\d+)\s*s[eé]ries?\s*(?:preparat[oó]rias?|aquecimento)?\s*\+\s*(\d+)\s*s[eé]ries?\s*(?:v[aá]lidas?)?/i);
  if (prepPlusValid) {
    const prep = parseInt(prepPlusValid[1], 10);
    const valid = parseInt(prepPlusValid[2], 10);
    targetSets = prep + valid;
    const prepNote = `${prep} prep + ${valid} válidas`;
    notes = notes ? `${prepNote} • ${notes}` : prepNote;
  } else {
    // 2. Detecta formato "X séries de Y repetições / reps"
    const seriesDeReps = detailsStr.match(/(\d+)\s*s[eé]ries?\s*(?:de|com)?\s*(\d+)(?:\s*(?:a|[-–])\s*(\d+))?(?:\s*(?:repeti[cç][oõ]es|reps?))?/i);
    if (seriesDeReps) {
      targetSets = parseInt(seriesDeReps[1], 10);
      if (seriesDeReps[2]) {
        targetReps = seriesDeReps[3] ? `${seriesDeReps[2]}-${seriesDeReps[3]}` : seriesDeReps[2];
      }
    } else {
      // 3. Detecta formato "X séries válidas" ou "X séries"
      const validOnly = detailsStr.match(/(\d+)\s*s[eé]ries?(?:\s*v[aá]lidas?)?/i);
      if (validOnly) {
        targetSets = parseInt(validOnly[1], 10);
      } else {
        // 4. Detecta formato clássico "4x10", "3 x 8 a 10", "4X12"
        const xFormat = detailsStr.match(/(\d+)\s*[xX]\s*([\d\s\-aAàÀ]+)/i);
        if (xFormat) {
          targetSets = parseInt(xFormat[1], 10);
          targetReps = xFormat[2].replace(/\s+/g, '').replace(/a/i, '-').trim();
        }
      }
    }
  }

  // 5. Extrair repetições dentro de parênteses "(6 a 8 reps)", "(8-10 reps)"
  const repsParen = detailsStr.match(/\(([^)]+)\)/);
  if (repsParen) {
    const inside = repsParen[1];
    const repsMatch = inside.match(/(\d+)(?:\s*(?:a|[-–])\s*(\d+))?\s*(?:reps?|repeti[cç][oõ]es)?/i);
    if (repsMatch && repsMatch[1]) {
      if (repsMatch[2]) {
        targetReps = `${repsMatch[1]}-${repsMatch[2]}`;
      } else {
        targetReps = repsMatch[1];
      }
    }

    // Observações extras dentro do parêntese (ex: "+ dropset na última", "pausa de 2s")
    const extraInParen = inside
      .replace(/(\d+)(?:\s*(?:a|[-–])\s*(\d+))?\s*(?:reps?|repeti[cç][oõ]es)?/i, '')
      .replace(/^\s*[,\+\-•]\s*/, '')
      .trim();
    if (extraInParen.length > 2) {
      notes = notes ? `${notes} (${extraInParen})` : extraInParen;
    }
  } else if (targetReps === '10-12') {
    // Reps sem parênteses: "10 a 12 reps"
    const repsDirect = detailsStr.match(/(\d+)(?:\s*(?:a|[-–])\s*(\d+))?\s*(?:reps?|repeti[cç][oõ]es)/i);
    if (repsDirect && repsDirect[1]) {
      if (repsDirect[2]) {
        targetReps = `${repsDirect[1]}-${repsDirect[2]}`;
      } else {
        targetReps = repsDirect[1];
      }
    }
  }

  // Se for cardio (ex: "45 minutos de caminhada", "30 min de esteira")
  const cardioTime = detailsStr.match(/(\d+)\s*(?:minutos?|mins?|min)\b/i);
  if (cardioTime) {
    targetSets = 1;
    targetReps = `${cardioTime[1]} min`;
  }

  return {
    targetSets: Math.min(Math.max(targetSets, 1), 10),
    targetReps: sanitizeField(targetReps, 30),
    notes: notes ? sanitizeField(notes, 200) : undefined,
  };
}

/**
 * Determina tempo de descanso recomendado baseado no exercício.
 */
function getRecommendedRestTime(exerciseName: string, sets: number): number {
  const norm = normalizeText(exerciseName);
  if (/agachamento|terra|supino|leg press|hack|stiff|remada curvada/i.test(norm)) {
    return 120;
  }
  if (/cardio|caminhada|esteira|bike/i.test(norm)) {
    return 0;
  }
  if (/elevacao lateral|panturrilha|rosca|triceps|crunch|abdomen/i.test(norm)) {
    return 60;
  }
  return 90;
}

/**
 * Limpa a linha de marcações de chat/markdown (timestamps, asteriscos, emojis iniciais, etc.)
 */
function cleanLineForHeader(line: string): string {
  // Remove carimbo de data/hora do WhatsApp: [15:40, 28/09/2026] Nome:
  let clean = line.replace(/^\[[^\]]+\]\s*(?:[^:]+:\s*)?/, '');
  // Remove markdown bold/italic/headers (*, _, ~, #, backticks)
  clean = clean.replace(/[\*_~#\`]/g, ' ');
  // Remove emojis e caracteres não alfanuméricos no início
  clean = clean.replace(/^[^\w\s\u00C0-\u017F]+/g, ' ');
  // Remove numerações iniciais (1., 1 -, 1), etc.)
  clean = clean.replace(/^(\d+[\.\-\)]\s*)+/, ' ');
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Detecta se uma linha é cabeçalho de rotina/dia.
 */
export function detectRoutineHeader(rawLine: string): string | null {
  const clean = cleanLineForHeader(rawLine);
  if (!clean || clean.length < 3) return null;

  // Se tiver indicação clara de séries e repetições, é um exercício, não um cabeçalho
  const hasSetsOrReps = /\d+\s*(?:s[eé]ries?|[xX]|reps?|minutos?|repeti)/i.test(clean);
  if (hasSetsOrReps) return null;

  // 1. Padrão dia da semana (Segunda, Terça, etc., com ou sem -feira)
  const dayRegex = /^(?:dia\s*\d+\s*[-:]?\s*)?(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira|\s*feira)?\b/i;
  // 2. Padrão divisão clássica (Treino A, Dia 1, Push, Pull, Legs, Upper, Lower, etc.)
  const splitRegex = /^(treino\s*[a-z\d]|dia\s*\d+|ficha\s*[a-z\d]|bloco\s*[a-z\d]|push\s*day|pull\s*day|legs?\s*day|upper\s*body|lower\s*body|full\s*body|push\b|pull\b|legs?\b|upper\b|lower\b)/i;
  // 3. Padrão agrupamentos musculares como título (ex: "Peito e Tríceps", "Costas e Bíceps")
  const muscleTitleRegex = /^(peito\s*e\s*tr[ií]ceps|costas\s*e\s*b[ií]ceps|pernas?\s*(?:completa)?|ombros?\s*e\s*bra[cç]os?|membros\s*superiores|membros\s*inferiores)\b/i;

  if (dayRegex.test(clean) || splitRegex.test(clean) || muscleTitleRegex.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Função principal que faz o parsing de texto de treino (1 ou múltiplos dias).
 */
export function parseWorkoutText(rawInputText: string): ParsedRoutine[] {
  if (!rawInputText || rawInputText.trim().length === 0) {
    return [];
  }

  // ── SEGURANÇA 1: Limite máximo de caracteres para evitar travamento/DoS ──
  const text = rawInputText.length > MAX_RAW_TEXT_LENGTH
    ? rawInputText.slice(0, MAX_RAW_TEXT_LENGTH)
    : rawInputText;

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const routines: ParsedRoutine[] = [];

  let currentRoutine: ParsedRoutine | null = null;
  let colorIndex = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];

    // ── SEGURANÇA 2: Ignorar linhas de injeção de prompt ou comandos maliciosos soltos ──
    if (isMaliciousOrGarbageLine(rawLine)) {
      continue;
    }

    // Verificar se é cabeçalho de rotina/dia
    const detectedHeader = detectRoutineHeader(rawLine);
    if (detectedHeader) {
      // ── SEGURANÇA 3: Limite máximo de rotinas criadas por texto ──
      if (routines.length >= MAX_ROUTINES_COUNT) {
        break;
      }

      // Separar dia e nome do treino (ex: "SEGUNDA-FEIRA: Push (Peito, Ombro e Tríceps)")
      let routineName = detectedHeader;
      const colonIdx = detectedHeader.indexOf(':');
      const dashIdx = detectedHeader.indexOf(' - ');

      if (colonIdx !== -1) {
        const dayPart = detectedHeader.substring(0, colonIdx).trim();
        const titlePart = detectedHeader.substring(colonIdx + 1).trim();
        routineName = titlePart.length > 0 ? `${dayPart}: ${titlePart}` : dayPart;
      } else if (dashIdx !== -1) {
        const dayPart = detectedHeader.substring(0, dashIdx).trim();
        const titlePart = detectedHeader.substring(dashIdx + 3).trim();
        routineName = titlePart.length > 0 ? `${dayPart}: ${titlePart}` : dayPart;
      }

      const isRest = /descanso|rest|off/i.test(detectedHeader);

      currentRoutine = {
        name: sanitizeField(routineName, 80),
        color: PALETTE[colorIndex % PALETTE.length],
        exercises: [],
        isRestDay: isRest,
      };
      colorIndex++;
      routines.push(currentRoutine);
      continue;
    }

    // Se ainda não temos rotina criada (ex: usuário colou só exercícios sem cabeçalho)
    if (!currentRoutine) {
      currentRoutine = {
        name: 'Minha Ficha',
        color: PALETTE[0],
        exercises: [],
      };
      colorIndex++;
      routines.push(currentRoutine);
    }

    // Limpar asteriscos de formatação da linha
    const line = rawLine.replace(/[\*_~#\`]/g, '').trim();

    // Verificar se é uma linha de Foco / Descrição / Subtítulo
    const isExplicitDescription = /^(?:foco|meta|objetivo|observa[cç][aã]o|obs|ajuste|varia[cç][aã]o|isolamento)\b/i.test(line);
    const hasSetsOrReps = /\d+\s*(?:s[eé]ries?|[xX]|reps?|minutos?|repeti)/i.test(line);
    const hasSeparator = line.includes(':') || line.includes(' - ');

    // Se for linha puramente descritiva (sem separador e sem séries/reps e sem match forte de exercício)
    if ((isExplicitDescription || (!hasSetsOrReps && !hasSeparator)) && !matchExerciseSuggestion(line)) {
      const sanitizedDesc = sanitizeField(line, 150);
      if (!currentRoutine.description) {
        currentRoutine.description = sanitizedDesc;
      } else {
        currentRoutine.description = sanitizeField(`${currentRoutine.description} • ${sanitizedDesc}`, 250);
      }
      continue;
    }

    // Se a linha for descanso total e a rotina estiver vazia
    if (/^(?:descanso total|off|rest day)/i.test(line)) {
      currentRoutine.isRestDay = true;
      currentRoutine.description = sanitizeField(line, 100);
      continue;
    }

    // ── SEGURANÇA 4: Limite máximo de exercícios por ficha ──
    if (currentRoutine.exercises.length >= MAX_EXERCISES_PER_ROUTINE) {
      continue;
    }

    // Verificar se é uma linha de exercício
    let exerciseName = '';
    let detailsPart = '';

    const colonMatch = line.indexOf(':');
    const dashMatch = line.indexOf(' - ');

    if (colonMatch !== -1) {
      exerciseName = line.substring(0, colonMatch).trim();
      detailsPart = line.substring(colonMatch + 1).trim();
    } else if (dashMatch !== -1) {
      exerciseName = line.substring(0, dashMatch).trim();
      detailsPart = line.substring(dashMatch + 3).trim();
    } else {
      // Se não tiver : ou - tenta ver se tem padrão NxN ou número
      const xMatch = line.match(/^(.+?)\s+(\d+\s*[xX]\s*.+)$/);
      if (xMatch) {
        exerciseName = xMatch[1].trim();
        detailsPart = xMatch[2].trim();
      } else {
        // Se a linha tem apenas o nome do exercício
        exerciseName = line;
        detailsPart = '3 séries (10-12 reps)';
      }
    }

    // Limpar marcadores de lista tipo "1.", "•", "-", etc.
    exerciseName = exerciseName.replace(/^[\d\.\-\•\*\s\)]+/, '').trim();

    if (!exerciseName || exerciseName.length < 3) {
      continue;
    }

    // Se for palavra reservada que não é exercício
    if (/^(foco|meta|objetivo|aquecimento|descanso)$/i.test(exerciseName)) {
      continue;
    }

    // Tentar match no banco de exercícios pré-cadastrados
    const matched = matchExerciseSuggestion(exerciseName);
    const { targetSets, targetReps, notes } = parseSetsRepsAndNotes(detailsPart);

    const rawFinalName = matched ? matched.name : exerciseName;
    const finalName = sanitizeField(rawFinalName, 80);
    const finalGroup = sanitizeField(matched ? matched.group : inferMuscleGroup(exerciseName, currentRoutine.name), 40);
    const mediaUrl = matched?.mediaUrl;
    const equipment = matched?.equipment;
    const restTimerSeconds = Math.min(Math.max(getRecommendedRestTime(finalName, targetSets), 0), 600);

    currentRoutine.exercises.push({
      name: finalName,
      muscleGroup: finalGroup,
      targetSets,
      targetReps,
      restTimerSeconds,
      notes,
      mediaUrl,
      equipment,
      originalText: sanitizeField(rawLine, 120),
    });
  }

  // Filtrar rotinas que não têm exercícios (a não ser que sejam marcadas como dia de descanso com nota)
  return routines.filter((r) => r.exercises.length > 0 || r.isRestDay);
}
