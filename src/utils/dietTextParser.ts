/**
 * dietTextParser.ts
 *
 * Parser inteligente e sanitizado para planos alimentares colados em texto livre
 * (WhatsApp, nutricionista, ChatGPT ou notas).
 * Suporta metas Seg–Sex / Sáb–Dom, hidratação diária, refeições com horário,
 * bases fixas, grupos de opções selecionáveis (ex.: proteína do almoço/jantar)
 * e seção de regras rápidas.
 */

import { sanitizeField, isMaliciousOrGarbageLine } from './workoutTextParser';

export interface DietMacros {
  kcal?: number;
  kcalLabel?: string;
  proteinG?: number;
  proteinLabel?: string;
  carbsG?: number;
  carbsLabel?: string;
  fatG?: number;
  fatLabel?: string;
  note?: string;
}

export interface DietOptionGroup {
  label: string;
  options: string[];
}

export interface ParsedDietMeal {
  id: string;
  time?: string;
  title: string;
  subtitle?: string;
  isWorkoutSlot?: boolean;
  baseItems: string[];
  optionGroups: DietOptionGroup[];
  notes: string[];
}

export interface ParsedDietPlan {
  title: string;
  weekdayTargets: DietMacros;
  weekendTargets?: DietMacros;
  waterTargetMl: number;
  waterLabel?: string;
  meals: ParsedDietMeal[];
  rules: string[];
}

export const MAX_DIET_TEXT_LENGTH = 50_000;
export const MAX_DIET_MEALS = 15;
export const MAX_ITEMS_PER_MEAL = 30;

function slugifyId(prefix: string, idx: number, text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return `${prefix}_${idx}_${slug || 'item'}`;
}

function parseNumberBR(raw: string): number {
  const cleaned = raw.trim();
  // "2.200" ou "2,200" (separador de milhar)
  if (/^\d{1,2}[.,]\d{3}$/.test(cleaned)) {
    return parseInt(cleaned.replace(/[.,]/g, ''), 10);
  }
  return parseFloat(cleaned.replace(',', '.'));
}

/**
 * Extrai calorias, proteína, carboidrato, gordura e nota de uma linha de metas.
 * Ex: "Meta Seg a Sex: ~2.200 kcal | ~175-180g Prot | ~228g Carb | ~65g Gord (já contando preparo)"
 */
export function parseMacroLine(line: string): DietMacros {
  const macros: DietMacros = {};

  const noteMatch = line.match(/\(([^)]+)\)\s*$/);
  if (noteMatch) {
    macros.note = sanitizeField(noteMatch[1], 140);
  }

  // Kcal: "~2.200 kcal" ou "2200kcal"
  const kcalMatch = line.match(/(~?\s*\d+(?:[.,]\d{3})?)\s*kcal\b/i);
  if (kcalMatch) {
    const num = parseNumberBR(kcalMatch[1].replace(/~/g, ''));
    if (!isNaN(num) && num > 0) {
      macros.kcal = Math.round(num);
      macros.kcalLabel = `${kcalMatch[1].replace(/\s+/g, '')} kcal`;
    }
  }

  // Proteína: "~175-180g Prot" ou "Prot: 180g"
  const protBefore = line.match(/(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\s*(?:de\s+)?prot(?:e[ií]nas?)?\b/i);
  const protAfter = line.match(/prot(?:e[ií]nas?)?\s*[:=]?\s*(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\b/i);
  const protRaw = protBefore?.[1] || protAfter?.[1];
  if (protRaw) {
    const nums = protRaw.match(/\d+/g);
    if (nums && nums.length > 0) {
      macros.proteinG = parseInt(nums[nums.length - 1], 10);
      macros.proteinLabel = `${protRaw.replace(/\s+/g, '')}g`;
    }
  }

  // Carboidratos: "~228g Carb" ou "Carb: 228g"
  const carbBefore = line.match(/(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\s*(?:de\s+)?carb(?:o(?:idratos?|s)?)?\b/i);
  const carbAfter = line.match(/carb(?:o(?:idratos?|s)?)?\s*[:=]?\s*(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\b/i);
  const carbRaw = carbBefore?.[1] || carbAfter?.[1];
  if (carbRaw) {
    const nums = carbRaw.match(/\d+/g);
    if (nums && nums.length > 0) {
      macros.carbsG = parseInt(nums[nums.length - 1], 10);
      macros.carbsLabel = `${carbRaw.replace(/\s+/g, '')}g`;
    }
  }

  // Gordura: "~65g Gord" ou "Gord: 65g" ou "65g Fat"
  const fatBefore = line.match(/(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\s*(?:de\s+)?(?:gord(?:uras?)?|lip[ií]dios?|fat)\b/i);
  const fatAfter = line.match(/(?:gord(?:uras?)?|lip[ií]dios?|fat)\s*[:=]?\s*(~?\s*\d+(?:\s*[-–a]\s*\d+)?)\s*g?\b/i);
  const fatRaw = fatBefore?.[1] || fatAfter?.[1];
  if (fatRaw) {
    const nums = fatRaw.match(/\d+/g);
    if (nums && nums.length > 0) {
      macros.fatG = parseInt(nums[nums.length - 1], 10);
      macros.fatLabel = `${fatRaw.replace(/\s+/g, '')}g`;
    }
  }

  return macros;
}

/**
 * Extrai meta diária de água em mL de uma linha como "Água: 4 litros/dia" ou "Água: 3500ml".
 */
export function parseWaterTarget(line: string): { ml: number; label: string } | null {
  if (!/(?:[áa]gua|hidrata[cç][aã]o|water)/i.test(line)) return null;

  const literMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:litros?|l\b)/i);
  if (literMatch) {
    const liters = parseFloat(literMatch[1].replace(',', '.'));
    if (!isNaN(liters) && liters >= 0.5 && liters <= 12) {
      const colonIdx = line.indexOf(':');
      const label = colonIdx !== -1 ? sanitizeField(line.slice(colonIdx + 1), 40) : `${liters}L/dia`;
      return { ml: Math.round(liters * 1000), label };
    }
  }

  const mlMatch = line.match(/(\d{3,5})\s*ml\b/i);
  if (mlMatch) {
    const ml = parseInt(mlMatch[1], 10);
    if (!isNaN(ml) && ml >= 500 && ml <= 12000) {
      const colonIdx = line.indexOf(':');
      const label = colonIdx !== -1 ? sanitizeField(line.slice(colonIdx + 1), 40) : `${ml}ml/dia`;
      return { ml, label };
    }
  }

  return null;
}

/**
 * Detecta se a linha inicia uma nova refeição (com ou sem horário).
 */
function detectMealHeader(rawLine: string): {
  time?: string;
  title: string;
  subtitle?: string;
  isWorkoutSlot?: boolean;
} | null {
  // Limpa markdown leve e emojis no início (preservando dígitos de horário)
  const trimmed = rawLine
    .replace(/^\[[^\]]+\]\s*(?:[^:]+:\s*)?/, '')
    .replace(/[\*_~#`]/g, '')
    .replace(/^[^\w\d\u00C0-\u017F]+/g, '')
    .trim();

  if (!trimmed || trimmed.length < 3) return null;

  // Ignora linhas que começam com marcador de item ou quantidade alimentar ("- 3 ovos", "100g arroz")
  if (/^[-•]\s/.test(rawLine.trim())) return null;
  if (/^\d+\s*(?:g|kg|ml|l|un|ovos?|fatias?|colher)/i.test(trimmed)) return null;

  let time: string | undefined;
  let rest = trimmed;

  // Padrão 1: Horário no início ("09:00 - CAFÉ DA MANHÃ", "15h30 - ALMOÇO", "22h: CEIA")
  const timedMatch = trimmed.match(/^(\d{1,2}[:h]\d{2}|\d{1,2}h)\s*[-–:|]\s*(.+)$/i);
  if (timedMatch) {
    const rawTime = timedMatch[1].toLowerCase().replace('h', ':');
    time = rawTime.endsWith(':') ? `${rawTime}00` : rawTime;
    if (time.length === 4 && time[1] === ':') time = `0${time}`;
    rest = timedMatch[2].trim();
  } else {
    // Padrão 2: Sem horário — títulos conhecidos de refeição (normalizado sem acentos p/ \b seguro)
    const asciiTrimmed = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const untimedMealRegex =
      /^(?:refeicao\s*\d+|cafe\s+da\s+manha|desjejum|lanche(?:\s+da\s+(?:manha|tarde|noite))?|colacao|pre[\s-]?treino|pos[\s-]?treino|almoco|jantar|ceia|breakfast|lunch|dinner|snack\s*\d*|meal\s*\d+)\b/i;
    if (!untimedMealRegex.test(asciiTrimmed)) {
      return null;
    }
    // Se tiver dois pontos seguido de alimentos na mesma linha longa, não é só cabeçalho se parecer item
    rest = trimmed.replace(/:\s*$/, '').trim();
  }

  // Extrai subtítulo entre parênteses no final: "ALMOÇO (PÓS-TREINO)" -> title: "ALMOÇO", subtitle: "PÓS-TREINO"
  let title = rest;
  let subtitle: string | undefined;
  const subMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (subMatch) {
    title = subMatch[1].trim();
    subtitle = subMatch[2].trim();
  }

  const normTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const isWorkoutSlot =
    /^treino\b/.test(normTitle) && !/pre[\s-]?treino|pos[\s-]?treino/.test(normTitle);

  return {
    time,
    title: sanitizeField(title, 60),
    subtitle: subtitle ? sanitizeField(subtitle, 60) : undefined,
    isWorkoutSlot,
  };
}

/**
 * Faz o parsing completo de um texto de plano alimentar em estrutura interativa.
 */
export function parseDietText(rawInput: string): ParsedDietPlan {
  if (!rawInput || !rawInput.trim()) {
    return {
      title: 'Plano Alimentar',
      weekdayTargets: {},
      waterTargetMl: 3000,
      meals: [],
      rules: [],
    };
  }

  const text =
    rawInput.length > MAX_DIET_TEXT_LENGTH
      ? rawInput.slice(0, MAX_DIET_TEXT_LENGTH)
      : rawInput;

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let title = 'Plano Alimentar';
  let titleDetected = false;
  let weekdayTargets: DietMacros = {};
  let weekendTargets: DietMacros | undefined;
  let waterTargetMl = 3000;
  let waterLabel: string | undefined;
  const meals: ParsedDietMeal[] = [];
  const rules: string[] = [];

  let currentMeal: ParsedDietMeal | null = null;
  let activeOptionGroup: DietOptionGroup | null = null;
  let inRulesSection = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];

    if (isMaliciousOrGarbageLine(rawLine)) {
      continue;
    }

    const cleanNoMd = rawLine.replace(/[\*_~#`]/g, '').trim();
    if (!cleanNoMd) continue;

    // 1. Detecta seção de Regras Rápidas / Observações Gerais
    if (
      /^(?:regras?\s*r[aá]pidas?|observa[cç][oõ]es?\s*(?:gerais|importantes)?|dicas?\s*(?:r[aá]pidas|gerais)?|diretrizes|notas?\s*gerais|quick\s*rules)\s*:?$/i.test(
        cleanNoMd
      )
    ) {
      inRulesSection = true;
      currentMeal = null;
      activeOptionGroup = null;
      continue;
    }

    if (inRulesSection) {
      const ruleText = sanitizeField(rawLine.replace(/^[-•*\d.\)\s]+/, ''), 260);
      if (ruleText.length >= 3) {
        rules.push(ruleText);
      }
      continue;
    }

    // 2. Antes da primeira refeição: título do plano, metas e água
    if (!currentMeal) {
      // Título principal do plano (ex.: "PLANO ALIMENTAR - CUTTING")
      if (
        !titleDetected &&
        /^(?:plano\s+alimentar|dieta|card[aá]pio|protocolo\s+alimentar|cutting|bulking|manuten[cç][aã]o|meal\s+plan|diet\s+plan)\b/i.test(
          cleanNoMd
        )
      ) {
        title = sanitizeField(cleanNoMd, 80);
        titleDetected = true;
        continue;
      }

      // Meta de água diária
      if (/^[•\-\*\s]*(?:[áa]gua|hidrata[cç][aã]o|water)\s*:/i.test(cleanNoMd)) {
        const parsedWater = parseWaterTarget(cleanNoMd);
        if (parsedWater) {
          waterTargetMl = parsedWater.ml;
          waterLabel = parsedWater.label;
          continue;
        }
      }

      // Linhas de Meta (Seg–Sex / Sáb–Dom / Geral)
      const isMetaLine =
        /^(?:meta|objetivo|alvo|macros?|calorias?|target)\b/i.test(cleanNoMd) ||
        (/\bkcal\b/i.test(cleanNoMd) && /\b(?:prot|carb|gord|fat)\b/i.test(cleanNoMd));
      if (isMetaLine) {
        const parsedMacros = parseMacroLine(cleanNoMd);
        const isWeekend = /(?:s[aá]b|dom|fim\s+de\s+semana|weekend|\bfds\b)/i.test(cleanNoMd);
        if (isWeekend) {
          weekendTargets = parsedMacros;
        } else {
          weekdayTargets = { ...weekdayTargets, ...parsedMacros };
        }
        continue;
      }
    }

    // 3. Detecta cabeçalho de refeição (ex.: "09:00 - CAFÉ DA MANHÃ", "15:30 - ALMOÇO (PÓS-TREINO)")
    const mealHeader = detectMealHeader(rawLine);
    if (mealHeader) {
      if (meals.length >= MAX_DIET_MEALS) {
        break;
      }
      const mealId = slugifyId('meal', meals.length, `${mealHeader.time || ''}_${mealHeader.title}`);
      currentMeal = {
        id: mealId,
        time: mealHeader.time,
        title: mealHeader.title,
        subtitle: mealHeader.subtitle,
        isWorkoutSlot: mealHeader.isWorkoutSlot,
        baseItems: [],
        optionGroups: [],
        notes: [],
      };
      activeOptionGroup = null;
      meals.push(currentMeal);
      continue;
    }

    // Se ainda não há refeição aberta, ignora linhas soltas antes do primeiro cabeçalho
    if (!currentMeal) {
      continue;
    }

    // 4. Notas/variações iniciadas com asterisco (ex.: "*Opção p/ variar: 2 ovos + 40g frango...")
    if (/^\*[^*]/.test(rawLine) || /^\*(?:op[cç][aã]o|obs|dica|nota)/i.test(rawLine)) {
      const noteText = sanitizeField(rawLine.replace(/^\*+\s*/, ''), 240);
      if (noteText.length >= 3) {
        currentMeal.notes.push(noteText);
      }
      continue;
    }

    // 5. Subcabeçalhos dentro de uma refeição (terminam com ":" e não são bullets)
    const isBullet = /^[-•]\s+/.test(rawLine);
    if (!isBullet && /:\s*$/.test(cleanNoMd)) {
      const subHeader = sanitizeField(cleanNoMd.replace(/:\s*$/, ''), 90);
      const isBaseHeader = /^base\b/i.test(subHeader);
      const isOptionHeader =
        !isBaseHeader &&
        /(?:prote[ií]na|op[cç][aã]o|op[cç][oõ]es|escolher|carboidrato|varia[cç]|acompanhamento|gordura|fruta|plano)/i.test(
          subHeader
        );

      if (isOptionHeader) {
        const group: DietOptionGroup = {
          label: subHeader,
          options: [],
        };
        currentMeal.optionGroups.push(group);
        activeOptionGroup = group;
      } else {
        // Ex.: "Base fixa:" ou "Base fixa (escolher 1 carboidrato):"
        activeOptionGroup = null;
        const baseHint = subHeader.match(/\(([^)]+)\)/);
        if (baseHint && baseHint[1].length > 2) {
          currentMeal.notes.push(sanitizeField(`Base: ${baseHint[1]}`, 140));
        }
      }
      continue;
    }

    // 6. Item de alimento / opção dentro da refeição atual
    const cleanedItem = sanitizeField(rawLine.replace(/^[-•]\s+/, ''), 240);
    if (!cleanedItem || cleanedItem.length < 2) continue;

    const totalCount =
      currentMeal.baseItems.length +
      currentMeal.optionGroups.reduce((acc, g) => acc + g.options.length, 0);
    if (totalCount >= MAX_ITEMS_PER_MEAL) continue;

    if (activeOptionGroup) {
      activeOptionGroup.options.push(cleanedItem);
    } else {
      currentMeal.baseItems.push(cleanedItem);
    }
  }

  return {
    title,
    weekdayTargets,
    weekendTargets,
    waterTargetMl,
    waterLabel,
    meals,
    rules,
  };
}
