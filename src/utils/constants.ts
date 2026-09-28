/** Base pré-cadastrada de exercícios clássicos de academia.
 * Usada para autocomplete e seleção em lote no RoutineEditorModal.
 * Todas as mídias são URLs externas (CDN/Wikimedia) — cacheadas em disco
 * pelo expo-image após o primeiro carregamento, sem inflar o bundle.
 */
export interface ExerciseSuggestionEntry {
  name: string;
  group: string;
  equipment?: string;
  /** URL de imagem/GIF demonstrando a execução do exercício (opcional).
   *  Após o primeiro carregamento online, fica cacheada em disco pelo expo-image. */
  mediaUrl?: string;
}

export const COMMON_SUGGESTIONS: ExerciseSuggestionEntry[] = [
  // ── Peito ──────────────────────────────────────────────────────────────────
  {
    name: 'Supino Reto com Barra',
    group: 'Peito',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Benchpress_arni.jpg/320px-Benchpress_arni.jpg',
  },
  {
    name: 'Supino Inclinado com Barra',
    group: 'Peito',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Incline-bench-press.gif/200px-Incline-bench-press.gif',
  },
  { name: 'Supino Declinado com Barra', group: 'Peito', equipment: 'Barra' },
  { name: 'Supino Reto com Halteres', group: 'Peito', equipment: 'Halteres' },
  { name: 'Supino Inclinado com Halteres', group: 'Peito', equipment: 'Halteres' },
  { name: 'Supino Declinado com Halteres', group: 'Peito', equipment: 'Halteres' },
  {
    name: 'Crucifixo com Halteres',
    group: 'Peito',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Dumbbell-fly.gif/200px-Dumbbell-fly.gif',
  },
  { name: 'Crucifixo Inclinado com Halteres', group: 'Peito', equipment: 'Halteres' },
  { name: 'Crucifixo na Polia', group: 'Peito', equipment: 'Polia' },
  { name: 'Crossover na Polia', group: 'Peito', equipment: 'Polia' },
  {
    name: 'Mergulho (Paralelas)',
    group: 'Peito',
    equipment: 'Peso Corpo',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Dip-1.gif/200px-Dip-1.gif',
  },
  { name: 'Peck Deck (Voador)', group: 'Peito', equipment: 'Máquina' },
  { name: 'Press no Smith (Peito)', group: 'Peito', equipment: 'Smith' },
  { name: 'Flexão de Braço', group: 'Peito', equipment: 'Peso Corpo' },
  { name: 'Flexão Diamante', group: 'Peito', equipment: 'Peso Corpo' },

  // ── Costas ─────────────────────────────────────────────────────────────────
  {
    name: 'Puxada Alta Aberta',
    group: 'Costas',
    equipment: 'Polia',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Lat-pulldown.gif/200px-Lat-pulldown.gif',
  },
  { name: 'Puxada Alta Fechada', group: 'Costas', equipment: 'Polia' },
  { name: 'Puxada Triangular', group: 'Costas', equipment: 'Polia' },
  { name: 'Puxada Unilateral', group: 'Costas', equipment: 'Polia' },
  {
    name: 'Remada Curvada com Barra',
    group: 'Costas',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Bent-over-row.gif/200px-Bent-over-row.gif',
  },
  {
    name: 'Remada Unilateral com Halter',
    group: 'Costas',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Dumbbell-row.gif/200px-Dumbbell-row.gif',
  },
  { name: 'Remada Sentada na Polia', group: 'Costas', equipment: 'Polia' },
  { name: 'Remada Alta com Barra', group: 'Costas', equipment: 'Barra' },
  { name: 'Pullover com Halter', group: 'Costas', equipment: 'Halteres' },
  { name: 'Pullover na Polia', group: 'Costas', equipment: 'Polia' },
  {
    name: 'Barra Fixa (Pegada Aberta)',
    group: 'Costas',
    equipment: 'Peso Corpo',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Pull-up.gif/200px-Pull-up.gif',
  },
  { name: 'Barra Fixa Supinada (Chin-up)', group: 'Costas', equipment: 'Peso Corpo' },
  {
    name: 'Levantamento Terra',
    group: 'Costas',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Deadlift.gif/200px-Deadlift.gif',
  },
  { name: 'Remada no Smith', group: 'Costas', equipment: 'Smith' },
  { name: 'Hiperextensão Lombar', group: 'Costas', equipment: 'Máquina' },

  // ── Ombros ─────────────────────────────────────────────────────────────────
  {
    name: 'Desenvolvimento com Barra',
    group: 'Ombros',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Overhead-press.gif/200px-Overhead-press.gif',
  },
  {
    name: 'Desenvolvimento com Halteres',
    group: 'Ombros',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Dumbbell-shoulder-press.gif/200px-Dumbbell-shoulder-press.gif',
  },
  { name: 'Desenvolvimento Arnold', group: 'Ombros', equipment: 'Halteres' },
  { name: 'Desenvolvimento no Smith', group: 'Ombros', equipment: 'Smith' },
  { name: 'Press Militar', group: 'Ombros', equipment: 'Barra' },
  {
    name: 'Elevação Lateral com Halteres',
    group: 'Ombros',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Lateral-raise.gif/200px-Lateral-raise.gif',
  },
  { name: 'Elevação Lateral na Polia', group: 'Ombros', equipment: 'Polia' },
  { name: 'Elevação Lateral na Máquina', group: 'Ombros', equipment: 'Máquina' },
  { name: 'Elevação Frontal com Barra', group: 'Ombros', equipment: 'Barra' },
  { name: 'Elevação Frontal com Halter', group: 'Ombros', equipment: 'Halteres' },
  { name: 'Encolhimento com Barra', group: 'Ombros / Trapézio', equipment: 'Barra' },
  { name: 'Encolhimento com Halteres', group: 'Ombros / Trapézio', equipment: 'Halteres' },
  { name: 'Remada Alta para Ombros', group: 'Ombros', equipment: 'Barra' },
  { name: 'Face Pull na Polia', group: 'Ombros', equipment: 'Polia' },

  // ── Bíceps ─────────────────────────────────────────────────────────────────
  {
    name: 'Rosca Direta com Barra',
    group: 'Bíceps',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Barbell-curl.gif/200px-Barbell-curl.gif',
  },
  { name: 'Rosca Direta com EZ', group: 'Bíceps', equipment: 'Barra EZ' },
  {
    name: 'Rosca Alternada com Halteres',
    group: 'Bíceps',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Dumbbell-curl.gif/200px-Dumbbell-curl.gif',
  },
  {
    name: 'Rosca Martelo com Halteres',
    group: 'Bíceps',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Hammer-curl.gif/200px-Hammer-curl.gif',
  },
  { name: 'Rosca Concentrada', group: 'Bíceps', equipment: 'Halteres' },
  { name: 'Rosca Inclinada com Halteres', group: 'Bíceps', equipment: 'Halteres' },
  { name: 'Rosca Scott com Barra EZ', group: 'Bíceps', equipment: 'Barra EZ' },
  { name: 'Rosca na Polia Baixa', group: 'Bíceps', equipment: 'Polia' },
  { name: 'Rosca Simultânea com Halteres', group: 'Bíceps', equipment: 'Halteres' },
  { name: 'Rosca Spiderman (21s)', group: 'Bíceps', equipment: 'Barra' },

  // ── Tríceps ────────────────────────────────────────────────────────────────
  {
    name: 'Tríceps Corda na Polia',
    group: 'Tríceps',
    equipment: 'Polia',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Triceps-pushdown.gif/200px-Triceps-pushdown.gif',
  },
  { name: 'Tríceps Barra na Polia', group: 'Tríceps', equipment: 'Polia' },
  { name: 'Tríceps Invertido na Polia', group: 'Tríceps', equipment: 'Polia' },
  {
    name: 'Tríceps Francês com Halter',
    group: 'Tríceps',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Overhead-tricep-extension.gif/200px-Overhead-tricep-extension.gif',
  },
  { name: 'Tríceps Francês com Barra EZ', group: 'Tríceps', equipment: 'Barra EZ' },
  { name: 'Tríceps Testa com Barra', group: 'Tríceps', equipment: 'Barra' },
  { name: 'Supino Fechado', group: 'Tríceps', equipment: 'Barra' },
  { name: 'Mergulho Tríceps no Banco', group: 'Tríceps', equipment: 'Peso Corpo' },
  { name: 'Tríceps Coice com Halter', group: 'Tríceps', equipment: 'Halteres' },
  { name: 'Tríceps na Máquina', group: 'Tríceps', equipment: 'Máquina' },

  // ── Pernas — Quadríceps ────────────────────────────────────────────────────
  {
    name: 'Agachamento Livre',
    group: 'Pernas / Quadríceps',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Squat.gif/200px-Squat.gif',
  },
  { name: 'Agachamento Hack', group: 'Pernas / Quadríceps', equipment: 'Barra' },
  { name: 'Agachamento no Smith', group: 'Pernas / Quadríceps', equipment: 'Smith' },
  { name: 'Agachamento Frontal', group: 'Pernas / Quadríceps', equipment: 'Barra' },
  {
    name: 'Leg Press 45°',
    group: 'Pernas / Quadríceps',
    equipment: 'Máquina',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Leg-press.gif/200px-Leg-press.gif',
  },
  { name: 'Leg Press Horizontal', group: 'Pernas / Quadríceps', equipment: 'Máquina' },
  {
    name: 'Cadeira Extensora',
    group: 'Pernas / Quadríceps',
    equipment: 'Máquina',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Leg-extension.gif/200px-Leg-extension.gif',
  },
  {
    name: 'Afundo com Halteres',
    group: 'Pernas / Quadríceps',
    equipment: 'Halteres',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Dumbbell-lunge.gif/200px-Dumbbell-lunge.gif',
  },
  { name: 'Afundo com Barra', group: 'Pernas / Quadríceps', equipment: 'Barra' },
  { name: 'Búlgaro com Halteres', group: 'Pernas / Quadríceps', equipment: 'Halteres' },
  { name: 'Agachamento Goblet', group: 'Pernas / Quadríceps', equipment: 'Halteres' },
  { name: 'Hack Machine', group: 'Pernas / Quadríceps', equipment: 'Máquina' },

  // ── Pernas — Posterior ─────────────────────────────────────────────────────
  {
    name: 'Mesa Flexora',
    group: 'Pernas / Posterior',
    equipment: 'Máquina',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Lying-leg-curl.gif/200px-Lying-leg-curl.gif',
  },
  {
    name: 'Cadeira Flexora',
    group: 'Pernas / Posterior',
    equipment: 'Máquina',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Seated-leg-curl.gif/200px-Seated-leg-curl.gif',
  },
  {
    name: 'Stiff com Barra',
    group: 'Pernas / Posterior',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Stiff-leg-deadlift.gif/200px-Stiff-leg-deadlift.gif',
  },
  { name: 'Stiff com Halteres', group: 'Pernas / Posterior', equipment: 'Halteres' },
  { name: 'Levantamento Terra Romeno', group: 'Pernas / Posterior', equipment: 'Barra' },
  { name: 'Curl Deitado na Polia', group: 'Pernas / Posterior', equipment: 'Polia' },
  { name: 'Good Morning', group: 'Pernas / Posterior', equipment: 'Barra' },

  // ── Glúteos ────────────────────────────────────────────────────────────────
  {
    name: 'Hip Thrust com Barra',
    group: 'Glúteos',
    equipment: 'Barra',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Hip-thrust.gif/200px-Hip-thrust.gif',
  },
  { name: 'Hip Thrust com Halteres', group: 'Glúteos', equipment: 'Halteres' },
  { name: 'Elevação Pélvica no Solo', group: 'Glúteos', equipment: 'Peso Corpo' },
  { name: 'Abdução de Quadril na Polia', group: 'Glúteos', equipment: 'Polia' },
  { name: 'Abdução de Quadril na Máquina', group: 'Glúteos', equipment: 'Máquina' },
  { name: 'Kickback na Polia', group: 'Glúteos', equipment: 'Polia' },
  { name: 'Agachamento Sumô', group: 'Glúteos / Pernas', equipment: 'Halteres' },
  { name: 'Agachamento Sumô com Barra', group: 'Glúteos / Pernas', equipment: 'Barra' },
  { name: 'Donkey Kick', group: 'Glúteos', equipment: 'Peso Corpo' },

  // ── Panturrilhas ───────────────────────────────────────────────────────────
  { name: 'Panturrilha em Pé na Máquina', group: 'Panturrilhas', equipment: 'Máquina' },
  { name: 'Panturrilha Sentado na Máquina', group: 'Panturrilhas', equipment: 'Máquina' },
  { name: 'Panturrilha no Leg Press', group: 'Panturrilhas', equipment: 'Máquina' },
  { name: 'Panturrilha com Halter (unilateral)', group: 'Panturrilhas', equipment: 'Halteres' },
  { name: 'Panturrilha no Smith', group: 'Panturrilhas', equipment: 'Smith' },

  // ── Abdômen ────────────────────────────────────────────────────────────────
  {
    name: 'Abdominal Crunch',
    group: 'Abdômen',
    equipment: 'Peso Corpo',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Crunch.gif/200px-Crunch.gif',
  },
  { name: 'Abdominal na Polia', group: 'Abdômen', equipment: 'Polia' },
  {
    name: 'Elevação de Pernas',
    group: 'Abdômen',
    equipment: 'Peso Corpo',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Hanging-leg-raise.gif/200px-Hanging-leg-raise.gif',
  },
  {
    name: 'Prancha (Plank)',
    group: 'Abdômen',
    equipment: 'Peso Corpo',
    mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Plank.gif/200px-Plank.gif',
  },
  { name: 'Russian Twist', group: 'Abdômen', equipment: 'Peso Corpo' },
  { name: 'Abdominal Oblíquo', group: 'Abdômen', equipment: 'Peso Corpo' },
  { name: 'Roda Abdominal (Ab Wheel)', group: 'Abdômen', equipment: 'Acessório' },
  { name: 'V-Sit', group: 'Abdômen', equipment: 'Peso Corpo' },
  { name: 'Dead Bug', group: 'Abdômen', equipment: 'Peso Corpo' },
  { name: 'Mountain Climber', group: 'Abdômen', equipment: 'Peso Corpo' },

  // ── Cardio / Funcional ─────────────────────────────────────────────────────
  { name: 'Burpee', group: 'Cardio / Funcional', equipment: 'Peso Corpo' },
  { name: 'Kettlebell Swing', group: 'Cardio / Funcional', equipment: 'Kettlebell' },
  { name: 'Clean com Barra', group: 'Cardio / Funcional', equipment: 'Barra' },
  { name: 'Jumping Jack', group: 'Cardio / Funcional', equipment: 'Peso Corpo' },
  { name: 'Pular Corda', group: 'Cardio / Funcional', equipment: 'Acessório' },
];

/** Todos os grupos musculares únicos disponíveis (para filtros de UI) */
export const MUSCLE_GROUPS: string[] = [
  ...new Set(COMMON_SUGGESTIONS.map((ex) => ex.group)),
].sort();

/** Todos os equipamentos únicos disponíveis (para filtros futuros) */
export const EQUIPMENT_TYPES: string[] = [
  ...new Set(COMMON_SUGGESTIONS.map((ex) => ex.equipment ?? 'Outro').filter(Boolean)),
].sort();
