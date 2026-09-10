/** Base pré-cadastrada de exercícios clássicos de academia.
 * Usada para autocomplete no ExerciseSearchInput.
 * Organizada por grupo muscular para facilitar filtragem futura.
 */
export const COMMON_SUGGESTIONS: { name: string; group: string }[] = [
  // ── Peito ──────────────────────────────────────────────────────────────────
  { name: 'Supino Reto com Barra', group: 'Peito' },
  { name: 'Supino Inclinado com Barra', group: 'Peito' },
  { name: 'Supino Declinado com Barra', group: 'Peito' },
  { name: 'Supino Reto com Halteres', group: 'Peito' },
  { name: 'Supino Inclinado com Halteres', group: 'Peito' },
  { name: 'Crucifixo com Halteres', group: 'Peito' },
  { name: 'Crucifixo na Polia', group: 'Peito' },
  { name: 'Crossover na Polia', group: 'Peito' },
  { name: 'Mergulho (Paralelas)', group: 'Peito' },
  { name: 'Peck Deck (Voador)', group: 'Peito' },

  // ── Costas ─────────────────────────────────────────────────────────────────
  { name: 'Puxada Alta Aberta', group: 'Costas' },
  { name: 'Puxada Alta Fechada', group: 'Costas' },
  { name: 'Remada Curvada com Barra', group: 'Costas' },
  { name: 'Remada Unilateral com Halter', group: 'Costas' },
  { name: 'Remada Sentada na Polia', group: 'Costas' },
  { name: 'Remada Alta com Barra', group: 'Costas' },
  { name: 'Pullover com Halter', group: 'Costas' },
  { name: 'Barra Fixa (Pegada Aberta)', group: 'Costas' },
  { name: 'Levantamento Terra', group: 'Costas' },
  { name: 'Serrote com Halter', group: 'Costas' },

  // ── Ombros ─────────────────────────────────────────────────────────────────
  { name: 'Desenvolvimento com Barra', group: 'Ombros' },
  { name: 'Desenvolvimento com Halteres', group: 'Ombros' },
  { name: 'Desenvolvimento Arnold', group: 'Ombros' },
  { name: 'Elevação Lateral com Halteres', group: 'Ombros' },
  { name: 'Elevação Lateral na Polia', group: 'Ombros' },
  { name: 'Elevação Frontal com Barra', group: 'Ombros' },
  { name: 'Elevação Frontal com Halter', group: 'Ombros' },
  { name: 'Encolhimento com Barra', group: 'Ombros / Trapézio' },
  { name: 'Encolhimento com Halteres', group: 'Ombros / Trapézio' },
  { name: 'Remada Alta para Ombros', group: 'Ombros' },

  // ── Bíceps ─────────────────────────────────────────────────────────────────
  { name: 'Rosca Direta com Barra', group: 'Bíceps' },
  { name: 'Rosca Direta com EZ', group: 'Bíceps' },
  { name: 'Rosca Alternada com Halteres', group: 'Bíceps' },
  { name: 'Rosca Martelo com Halteres', group: 'Bíceps' },
  { name: 'Rosca Concentrada', group: 'Bíceps' },
  { name: 'Rosca Inclinada com Halteres', group: 'Bíceps' },
  { name: 'Rosca Scott com Barra EZ', group: 'Bíceps' },
  { name: 'Rosca na Polia Baixa', group: 'Bíceps' },

  // ── Tríceps ────────────────────────────────────────────────────────────────
  { name: 'Tríceps Corda na Polia', group: 'Tríceps' },
  { name: 'Tríceps Barra na Polia', group: 'Tríceps' },
  { name: 'Tríceps Francês com Halter', group: 'Tríceps' },
  { name: 'Tríceps Francês com Barra EZ', group: 'Tríceps' },
  { name: 'Tríceps Testa com Barra', group: 'Tríceps' },
  { name: 'Supino Fechado', group: 'Tríceps' },
  { name: 'Mergulho Tríceps no Banco', group: 'Tríceps' },
  { name: 'Tríceps Coice com Halter', group: 'Tríceps' },

  // ── Pernas — Quadríceps ────────────────────────────────────────────────────
  { name: 'Agachamento Livre', group: 'Pernas / Quadríceps' },
  { name: 'Agachamento Hack', group: 'Pernas / Quadríceps' },
  { name: 'Leg Press 45°', group: 'Pernas / Quadríceps' },
  { name: 'Leg Press Horizontal', group: 'Pernas / Quadríceps' },
  { name: 'Cadeira Extensora', group: 'Pernas / Quadríceps' },
  { name: 'Afundo com Halteres', group: 'Pernas / Quadríceps' },
  { name: 'Búlgaro com Halteres', group: 'Pernas / Quadríceps' },
  { name: 'Agachamento Goblet', group: 'Pernas / Quadríceps' },
  { name: 'Avanço com Barra', group: 'Pernas / Quadríceps' },

  // ── Pernas — Posterior ─────────────────────────────────────────────────────
  { name: 'Mesa Flexora', group: 'Pernas / Posterior' },
  { name: 'Cadeira Flexora', group: 'Pernas / Posterior' },
  { name: 'Stiff com Barra', group: 'Pernas / Posterior' },
  { name: 'Stiff com Halteres', group: 'Pernas / Posterior' },
  { name: 'Levantamento Terra Romeno', group: 'Pernas / Posterior' },
  { name: 'Curl Deitado na Polia', group: 'Pernas / Posterior' },

  // ── Glúteos ────────────────────────────────────────────────────────────────
  { name: 'Hip Thrust com Barra', group: 'Glúteos' },
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
  { name: 'Abdominal Crunch', group: 'Abdômen' },
  { name: 'Abdominal na Polia', group: 'Abdômen' },
  { name: 'Elevação de Pernas', group: 'Abdômen' },
  { name: 'Prancha (Plank)', group: 'Abdômen' },
  { name: 'Russian Twist', group: 'Abdômen' },
  { name: 'Abdominal Oblíquo', group: 'Abdômen' },
];
