/**
 * dietProteinEstimator.ts
 *
 * Estimativa determinística de proteína (em gramas) por refeição de um plano
 * alimentar importado em texto, somando itens base e a opção proteica selecionada.
 */

import type { ParsedDietMeal } from './dietTextParser';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseQtyAverage(raw: string): number {
  const rangeMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|a)\s*(\d+(?:[.,]\d+)?)/i);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1].replace(',', '.'));
    const b = parseFloat(rangeMatch[2].replace(',', '.'));
    return (a + b) / 2;
  }
  const singleMatch = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (singleMatch) {
    return parseFloat(singleMatch[1].replace(',', '.'));
  }
  return 0;
}

/**
 * Estima gramas de proteína de um único segmento alimentar (sem "ou").
 */
function estimateSegmentProteinG(segment: string): number {
  const norm = normalize(segment);
  if (!norm) return 0;

  let protein = 0;

  // Ovos inteiros ou claras (ex: "3 ovos", "2 ovos inteiros", "4 ovos")
  const ovosMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*ovos?\b/);
  if (ovosMatch) {
    const eggCount = parseQtyAverage(ovosMatch[1]);
    protein += eggCount * 6;
  }

  // Claras de ovo extras ("2 claras")
  const clarasMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*claras?\b/);
  if (clarasMatch) {
    protein += parseQtyAverage(clarasMatch[1]) * 3.6;
  }

  // Whey protein ("40g Whey Concentrado 70%", "30g Whey")
  const wheyMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^,;]*?\bwhey\b|\bwhey\b[^,;]*?(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b/);
  if (wheyMatch) {
    const grams = parseQtyAverage(wheyMatch[1] || wheyMatch[2] || '0');
    const pctMatch = norm.match(/\b(\d{2})\s*%/);
    const ratio = pctMatch ? Math.min(0.95, Math.max(0.5, parseInt(pctMatch[1], 10) / 100)) : 0.75;
    protein += grams * ratio;
  }

  // Leite em pó desnatado ("30g leite em po desnatado") — verificar ANTES de leite líquido!
  const milkPowderMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^,;]*leite\s+em\s+po/);
  if (milkPowderMatch) {
    const grams = parseQtyAverage(milkPowderMatch[1]);
    protein += grams * 0.35;
  } else {
    // Leite líquido desnatado/integral ("250ml leite desnatado")
    const milkMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*ml\b[^,;]*\bleite\b/);
    if (milkMatch) {
      const ml = parseQtyAverage(milkMatch[1]);
      protein += ml * 0.032;
    }
  }

  // Iogurte natural ("170g iogurte natural desnatado")
  const yogurtMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^,;]*iogurte/);
  if (yogurtMatch) {
    protein += parseQtyAverage(yogurtMatch[1]) * 0.045;
  }

  // Carnes / aves / peixes (frango, peito, sobrecoxa, carne, patinho, coxao, musculo, lombo, bisteca, acem, pernil, peixe, tilapia, atum)
  const meatRegex =
    /(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?\b(peito de frango|sobrecoxa|coxa|frango desfiado|frango|carne bovina|carne suina|carne moida|carne assada|carne|patinho|coxao|musculo|lombo|bisteca|acem|pernil|file de peixe|peixe|tilapia|salmao|atum)\b/;
  const meatMatch = norm.match(meatRegex);
  if (meatMatch) {
    protein += parseQtyAverage(meatMatch[1]) * 0.28;
  }

  // Queijo minas ("30g queijo minas")
  const cheeseMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?queijo\b/);
  if (cheeseMatch) {
    protein += parseQtyAverage(cheeseMatch[1]) * 0.17;
  }

  // Requeijão light ("20g requeijao light")
  const requeijaoMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?requeijao\b/);
  if (requeijaoMatch) {
    protein += parseQtyAverage(requeijaoMatch[1]) * 0.10;
  }

  // Aveia ("40g aveia")
  const oatsMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?aveia\b/);
  if (oatsMatch) {
    protein += parseQtyAverage(oatsMatch[1]) * 0.14;
  }

  // Feijão ("150g feijao cozido")
  const beansMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?feijao\b/);
  if (beansMatch) {
    protein += parseQtyAverage(beansMatch[1]) * 0.05;
  }

  // Arroz / Cuscuz ("200g arroz", "100g cuscuz")
  const carbMatch = norm.match(/(\d+(?:\s*(?:-|–|a)\s*\d+)?)\s*g\b[^+;]*?\b(arroz|cuscuz)\b/);
  if (carbMatch) {
    protein += parseQtyAverage(carbMatch[1]) * 0.025;
  }

  return protein;
}

/**
 * Estima proteína total (em g) de uma linha de refeição, considerando apenas
 * a opção principal antes de separadores de variação `(ou ...)`.
 */
function estimateLineProteinG(line: string): number {
  if (!line || !line.trim()) return 0;

  // Remove alternativas secundárias dentro de parênteses com "(ou ...)" para não somar duas vezes
  const withoutAltParen = line.replace(/\(\s*ou\s+[^)]+\)/gi, '');
  // Se o texto tem "+", soma cada subparte (ex.: "100-120g peito de frango + 20g requeijão light")
  const parts = withoutAltParen.split(/\s*\+\s*/);
  let total = 0;
  for (const part of parts) {
    // Se ainda houver " / " ou " ou " entre opções equivalentes fora de parênteses, usa a primeira
    const primaryChoice = part.split(/\s+\bou\b\s+/i)[0] || part;
    total += estimateSegmentProteinG(primaryChoice);
  }
  return total;
}

/**
 * Calcula a proteína estimada (em gramas inteiras) de uma refeição da dieta,
 * somando `baseItems` e a opção selecionada (ou 1ª opção) de cada `optionGroup`.
 */
export function estimateMealProteinG(
  meal: ParsedDietMeal,
  selectedOptions?: Record<number, string>
): number {
  if (!meal || meal.isWorkoutSlot) return 0;

  let total = 0;

  for (const item of meal.baseItems || []) {
    total += estimateLineProteinG(item);
  }

  (meal.optionGroups || []).forEach((group, gIdx) => {
    const chosen = selectedOptions?.[gIdx] || group.options?.[0];
    if (chosen) {
      total += estimateLineProteinG(chosen);
    }
  });

  return Math.max(0, Math.round(total));
}
