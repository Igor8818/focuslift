/** Base pré-cadastrada de exercícios clássicos de academia.
 * Usada para autocomplete no ExerciseSearchInput.
 * Organizada por grupo muscular para facilitar filtragem futura.
 */
export interface ExerciseSuggestionEntry {
  name: string;
  group: string;
  /** URL de imagem/GIF demonstrando a execução do exercício (opcional).
   *  Exibida como thumbnail no autocomplete e em modal de detalhes.
   *  Após o primeiro carregamento online, fica cacheada em disco pelo expo-image. */
  mediaUrl?: string;
}

export const COMMON_SUGGESTIONS: ExerciseSuggestionEntry[] = [
  // ── Peito ──────────────────────────────────────────────────────────────────
  {
    name: 'Supino Reto com Barra',
    group: 'Peito',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Benchpress_arni.jpg/320px-Benchpress_arni.jpg',
  },
  {
    name: 'Supino Inclinado com Barra',
    group: 'Peito',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Incline-bench-press.gif/200px-Incline-bench-press.gif',
  },
  { name: 'Supino Declinado com Barra', group: 'Peito' },
  { name: 'Supino Reto com Halteres', group: 'Peito' },
  { name: 'Supino Inclinado com Halteres', group: 'Peito' },
  {
    name: 'Crucifixo com Halteres',
    group: 'Peito',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Dumbbell-fly.gif/200px-Dumbbell-fly.gif',
  },
  { name: 'Crucifixo na Polia', group: 'Peito' },
  { name: 'Crossover na Polia', group: 'Peito' },
  {
    name: 'Mergulho (Paralelas)',
    group: 'Peito',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Dip-1.gif/200px-Dip-1.gif',
  },
  { name: 'Peck Deck (Voador)', group: 'Peito' },

  // ── Costas ─────────────────────────────────────────────────────────────────
  {
    name: 'Puxada Alta Aberta',
    group: 'Costas',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Lat-pulldown.gif/200px-Lat-pulldown.gif',
  },
  { name: 'Puxada Alta Fechada', group: 'Costas' },
  {
    name: 'Remada Curvada com Barra',
    group: 'Costas',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Bent-over-row.gif/200px-Bent-over-row.gif',
  },
  {
    name: 'Remada Unilateral com Halter',
    group: 'Costas',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Dumbbell-row.gif/200px-Dumbbell-row.gif',
  },
  { name: 'Remada Sentada na Polia', group: 'Costas' },
  { name: 'Remada Alta com Barra', group: 'Costas' },
  { name: 'Pullover com Halter', group: 'Costas' },
  {
    name: 'Barra Fixa (Pegada Aberta)',
    group: 'Costas',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Pull-up.gif/200px-Pull-up.gif',
  },
  {
    name: 'Levantamento Terra',
    group: 'Costas',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Deadlift.gif/200px-Deadlift.gif',
  },
  { name: 'Serrote com Halter', group: 'Costas' },

  // ── Ombros ─────────────────────────────────────────────────────────────────
  {
    name: 'Desenvolvimento com Barra',
    group: 'Ombros',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Overhead-press.gif/200px-Overhead-press.gif',
  },
  {
    name: 'Desenvolvimento com Halteres',
    group: 'Ombros',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Dumbbell-shoulder-press.gif/200px-Dumbbell-shoulder-press.gif',
  },
  { name: 'Desenvolvimento Arnold', group: 'Ombros' },
  {
    name: 'Elevação Lateral com Halteres',
    group: 'Ombros',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Lateral-raise.gif/200px-Lateral-raise.gif',
  },
  { name: 'Elevação Lateral na Polia', group: 'Ombros' },
  { name: 'Elevação Frontal com Barra', group: 'Ombros' },
  { name: 'Elevação Frontal com Halter', group: 'Ombros' },
  { name: 'Encolhimento com Barra', group: 'Ombros / Trapézio' },
  { name: 'Encolhimento com Halteres', group: 'Ombros / Trapézio' },
  { name: 'Remada Alta para Ombros', group: 'Ombros' },

  // ── Bíceps ─────────────────────────────────────────────────────────────────
  {
    name: 'Rosca Direta com Barra',
    group: 'Bíceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Barbell-curl.gif/200px-Barbell-curl.gif',
  },
  { name: 'Rosca Direta com EZ', group: 'Bíceps' },
  {
    name: 'Rosca Alternada com Halteres',
    group: 'Bíceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Dumbbell-curl.gif/200px-Dumbbell-curl.gif',
  },
  {
    name: 'Rosca Martelo com Halteres',
    group: 'Bíceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Hammer-curl.gif/200px-Hammer-curl.gif',
  },
  { name: 'Rosca Concentrada', group: 'Bíceps' },
  { name: 'Rosca Inclinada com Halteres', group: 'Bíceps' },
  { name: 'Rosca Scott com Barra EZ', group: 'Bíceps' },
  { name: 'Rosca na Polia Baixa', group: 'Bíceps' },

  // ── Tríceps ────────────────────────────────────────────────────────────────
  {
    name: 'Tríceps Corda na Polia',
    group: 'Tríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Triceps-pushdown.gif/200px-Triceps-pushdown.gif',
  },
  { name: 'Tríceps Barra na Polia', group: 'Tríceps' },
  {
    name: 'Tríceps Francês com Halter',
    group: 'Tríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Overhead-tricep-extension.gif/200px-Overhead-tricep-extension.gif',
  },
  { name: 'Tríceps Francês com Barra EZ', group: 'Tríceps' },
  { name: 'Tríceps Testa com Barra', group: 'Tríceps' },
  { name: 'Supino Fechado', group: 'Tríceps' },
  { name: 'Mergulho Tríceps no Banco', group: 'Tríceps' },
  { name: 'Tríceps Coice com Halter', group: 'Tríceps' },

  // ── Pernas — Quadríceps ────────────────────────────────────────────────────
  {
    name: 'Agachamento Livre',
    group: 'Pernas / Quadríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Squat.gif/200px-Squat.gif',
  },
  { name: 'Agachamento Hack', group: 'Pernas / Quadríceps' },
  {
    name: 'Leg Press 45°',
    group: 'Pernas / Quadríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Leg-press.gif/200px-Leg-press.gif',
  },
  { name: 'Leg Press Horizontal', group: 'Pernas / Quadríceps' },
  {
    name: 'Cadeira Extensora',
    group: 'Pernas / Quadríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Leg-extension.gif/200px-Leg-extension.gif',
  },
  {
    name: 'Afundo com Halteres',
    group: 'Pernas / Quadríceps',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Dumbbell-lunge.gif/200px-Dumbbell-lunge.gif',
  },
  { name: 'Búlgaro com Halteres', group: 'Pernas / Quadríceps' },
  { name: 'Agachamento Goblet', group: 'Pernas / Quadríceps' },
  { name: 'Avanço com Barra', group: 'Pernas / Quadríceps' },

  // ── Pernas — Posterior ─────────────────────────────────────────────────────
  {
    name: 'Mesa Flexora',
    group: 'Pernas / Posterior',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Lying-leg-curl.gif/200px-Lying-leg-curl.gif',
  },
  {
    name: 'Cadeira Flexora',
    group: 'Pernas / Posterior',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Seated-leg-curl.gif/200px-Seated-leg-curl.gif',
  },
  {
    name: 'Stiff com Barra',
    group: 'Pernas / Posterior',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Stiff-leg-deadlift.gif/200px-Stiff-leg-deadlift.gif',
  },
  { name: 'Stiff com Halteres', group: 'Pernas / Posterior' },
  { name: 'Levantamento Terra Romeno', group: 'Pernas / Posterior' },
  { name: 'Curl Deitado na Polia', group: 'Pernas / Posterior' },

  // ── Glúteos ────────────────────────────────────────────────────────────────
  {
    name: 'Hip Thrust com Barra',
    group: 'Glúteos',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Hip-thrust.gif/200px-Hip-thrust.gif',
  },
  { name: 'Elevação Pélvica no Solo', group: 'Glúteos' },
  { name: 'Abdução de Quadril na Polia', group: 'Glúteos' },
  { name: 'Kickback na Polia', group: 'Glúteos' },
  { name: 'Agachamento Sumô', group: 'Glúteos / Pernas' },

  // ── Panturrilhas ───────────────────────────────────────────────────────────
  { name: 'Panturrilha em Pé na Máquina', group: 'Panturrilhas' },
  { name: 'Panturrilha Sentado na Máquina', group: 'Panturrilhas' },
  { name: 'Panturrilha no Leg Press', group: 'Panturrilhas' },
  { name: 'Panturrilha com Halter (unilateral)', group: 'Panturrilhas' },

  // ── Abdômen ────────────────────────────────────────────────────────────────
  {
    name: 'Abdominal Crunch',
    group: 'Abdômen',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Crunch.gif/200px-Crunch.gif',
  },
  { name: 'Abdominal na Polia', group: 'Abdômen' },
  {
    name: 'Elevação de Pernas',
    group: 'Abdômen',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Hanging-leg-raise.gif/200px-Hanging-leg-raise.gif',
  },
  {
    name: 'Prancha (Plank)',
    group: 'Abdômen',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Plank.gif/200px-Plank.gif',
  },
  { name: 'Russian Twist', group: 'Abdômen' },
  { name: 'Abdominal Oblíquo', group: 'Abdômen' },
];
