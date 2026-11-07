/** Base pré-cadastrada de exercícios clássicos de academia.
 * Usada para autocomplete e seleção em lote no RoutineEditorModal.
 *
 * Imagens servidas via jsDelivr CDN (free-exercise-db, domínio público):
 *   https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{slug}/0.jpg
 *
 * Slugs verificados diretamente contra o repositório oficial yuhonas/free-exercise-db.
 */
export interface ExerciseSuggestionEntry {
  name: string;
  group: string;
  equipment?: string;
  mediaUrl?: string;
}

const CDN = (slug: string) =>
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${slug}/0.jpg`;

export const COMMON_SUGGESTIONS: ExerciseSuggestionEntry[] = [
  // ── Peito ─────────────────────────────────────────────────────────────────
  { name: 'Supino Reto com Barra',               group: 'Peito',                    equipment: 'Barra',          mediaUrl: CDN('Barbell_Bench_Press_-_Medium_Grip') },
  { name: 'Supino Inclinado com Barra',          group: 'Peito',                    equipment: 'Barra',          mediaUrl: CDN('Barbell_Incline_Bench_Press_-_Medium_Grip') },
  { name: 'Supino Declinado com Barra',          group: 'Peito',                    equipment: 'Barra',          mediaUrl: CDN('Decline_Barbell_Bench_Press') },
  { name: 'Supino Reto com Halteres',            group: 'Peito',                    equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Bench_Press') },
  { name: 'Supino Inclinado com Halteres',       group: 'Peito',                    equipment: 'Halteres',       mediaUrl: CDN('Incline_Dumbbell_Press') },
  { name: 'Supino Declinado com Halteres',       group: 'Peito',                    equipment: 'Halteres',       mediaUrl: CDN('Decline_Dumbbell_Bench_Press') },
  { name: 'Crucifixo com Halteres',              group: 'Peito',                    equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Flyes') },
  { name: 'Crucifixo Inclinado com Halteres',    group: 'Peito',                    equipment: 'Halteres',       mediaUrl: CDN('Incline_Dumbbell_Flyes') },
  { name: 'Crucifixo na Polia',                  group: 'Peito',                    equipment: 'Polia',          mediaUrl: CDN('Cable_Crossover') },
  { name: 'Crossover na Polia',                  group: 'Peito',                    equipment: 'Polia',          mediaUrl: CDN('Cable_Crossover') },
  { name: 'Mergulho (Paralelas)',                group: 'Peito',                    equipment: 'Peso Corpo',     mediaUrl: CDN('Dips_-_Chest_Version') },
  { name: 'Peck Deck (Voador)',                  group: 'Peito',                    equipment: 'Máquina',        mediaUrl: CDN('Butterfly') },
  { name: 'Press no Smith (Peito)',              group: 'Peito',                    equipment: 'Smith',          mediaUrl: CDN('Smith_Machine_Bench_Press') },
  { name: 'Flexão de Braço',                     group: 'Peito',                    equipment: 'Peso Corpo',     mediaUrl: CDN('Pushups') },
  { name: 'Flexão Diamante',                     group: 'Peito',                    equipment: 'Peso Corpo',     mediaUrl: CDN('Push-Ups_-_Close_Triceps_Position') },
  // ── Costas ────────────────────────────────────────────────────────────────
  { name: 'Puxada Alta Aberta',                  group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('Wide-Grip_Lat_Pulldown') },
  { name: 'Puxada Alta Fechada',                 group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('Close-Grip_Front_Lat_Pulldown') },
  { name: 'Puxada Triangular',                   group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('V-Bar_Pulldown') },
  { name: 'Puxada Unilateral',                   group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('One_Arm_Lat_Pulldown') },
  { name: 'Remada Curvada com Barra',            group: 'Costas',                   equipment: 'Barra',          mediaUrl: CDN('Bent_Over_Barbell_Row') },
  { name: 'Remada Unilateral com Halter',        group: 'Costas',                   equipment: 'Halteres',       mediaUrl: CDN('One-Arm_Dumbbell_Row') },
  { name: 'Remada Sentada na Polia',             group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('Seated_Cable_Rows') },
  { name: 'Remada Alta com Barra',               group: 'Costas',                   equipment: 'Barra',          mediaUrl: CDN('Upright_Barbell_Row') },
  { name: 'Pullover com Halter',                 group: 'Costas',                   equipment: 'Halteres',       mediaUrl: CDN('Straight-Arm_Dumbbell_Pullover') },
  { name: 'Pullover na Polia',                   group: 'Costas',                   equipment: 'Polia',          mediaUrl: CDN('Straight-Arm_Pulldown') },
  { name: 'Barra Fixa (Pegada Aberta)',          group: 'Costas',                   equipment: 'Peso Corpo',     mediaUrl: CDN('Pullups') },
  { name: 'Barra Fixa Supinada (Chin-up)',       group: 'Costas',                   equipment: 'Peso Corpo',     mediaUrl: CDN('Chin-Up') },
  { name: 'Levantamento Terra',                  group: 'Costas',                   equipment: 'Barra',          mediaUrl: CDN('Barbell_Deadlift') },
  { name: 'Remada no Smith',                     group: 'Costas',                   equipment: 'Smith',          mediaUrl: CDN('Smith_Machine_Bent_Over_Row') },
  { name: 'Hiperextensão Lombar',                group: 'Costas',                   equipment: 'Máquina',        mediaUrl: CDN('Hyperextensions_Back_Extensions') },
  // ── Ombros ────────────────────────────────────────────────────────────────
  { name: 'Desenvolvimento com Barra',           group: 'Ombros',                   equipment: 'Barra',          mediaUrl: CDN('Standing_Military_Press') },
  { name: 'Desenvolvimento com Halteres',        group: 'Ombros',                   equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Shoulder_Press') },
  { name: 'Desenvolvimento Arnold',              group: 'Ombros',                   equipment: 'Halteres',       mediaUrl: CDN('Arnold_Dumbbell_Press') },
  { name: 'Desenvolvimento no Smith',            group: 'Ombros',                   equipment: 'Smith',          mediaUrl: CDN('Smith_Machine_Overhead_Shoulder_Press') },
  { name: 'Press Militar',                       group: 'Ombros',                   equipment: 'Barra',          mediaUrl: CDN('Standing_Military_Press') },
  { name: 'Elevação Lateral com Halteres',       group: 'Ombros',                   equipment: 'Halteres',       mediaUrl: CDN('Side_Lateral_Raise') },
  { name: 'Elevação Lateral na Polia',           group: 'Ombros',                   equipment: 'Polia',          mediaUrl: CDN('Cable_Seated_Lateral_Raise') },
  { name: 'Elevação Lateral na Máquina',         group: 'Ombros',                   equipment: 'Máquina',        mediaUrl: CDN('Side_Lateral_Raise') },
  { name: 'Elevação Frontal com Barra',          group: 'Ombros',                   equipment: 'Barra',          mediaUrl: CDN('Standing_Front_Barbell_Raise_Over_Head') },
  { name: 'Elevação Frontal com Halter',         group: 'Ombros',                   equipment: 'Halteres',       mediaUrl: CDN('Front_Dumbbell_Raise') },
  // ── Ombros / Trapézio ─────────────────────────────────────────────────────
  { name: 'Encolhimento com Barra',              group: 'Ombros / Trapézio',        equipment: 'Barra',          mediaUrl: CDN('Barbell_Shrug') },
  { name: 'Encolhimento com Halteres',           group: 'Ombros / Trapézio',        equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Shrug') },
  // ── Ombros ────────────────────────────────────────────────────────────────
  { name: 'Remada Alta para Ombros',             group: 'Ombros',                   equipment: 'Barra',          mediaUrl: CDN('Upright_Barbell_Row') },
  { name: 'Face Pull na Polia',                  group: 'Ombros',                   equipment: 'Polia',          mediaUrl: CDN('Face_Pull') },
  // ── Bíceps ────────────────────────────────────────────────────────────────
  { name: 'Rosca Direta com Barra',              group: 'Bíceps',                   equipment: 'Barra',          mediaUrl: CDN('Barbell_Curl') },
  { name: 'Rosca Direta com EZ',                 group: 'Bíceps',                   equipment: 'Barra EZ',       mediaUrl: CDN('EZ-Bar_Curl') },
  { name: 'Rosca Alternada com Halteres',        group: 'Bíceps',                   equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Alternate_Bicep_Curl') },
  { name: 'Rosca Martelo com Halteres',          group: 'Bíceps',                   equipment: 'Halteres',       mediaUrl: CDN('Hammer_Curls') },
  { name: 'Rosca Concentrada',                   group: 'Bíceps',                   equipment: 'Halteres',       mediaUrl: CDN('Concentration_Curls') },
  { name: 'Rosca Inclinada com Halteres',        group: 'Bíceps',                   equipment: 'Halteres',       mediaUrl: CDN('Incline_Dumbbell_Curl') },
  { name: 'Rosca Scott com Barra EZ',            group: 'Bíceps',                   equipment: 'Barra EZ',       mediaUrl: CDN('Preacher_Curl') },
  { name: 'Rosca na Polia Baixa',                group: 'Bíceps',                   equipment: 'Polia',          mediaUrl: CDN('Cable_Preacher_Curl') },
  { name: 'Rosca Simultânea com Halteres',       group: 'Bíceps',                   equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Bicep_Curl') },
  { name: 'Rosca Spiderman (21s)',               group: 'Bíceps',                   equipment: 'Barra',          mediaUrl: CDN('Spider_Curl') },
  // ── Tríceps ───────────────────────────────────────────────────────────────
  { name: 'Tríceps Corda na Polia',              group: 'Tríceps',                  equipment: 'Polia',          mediaUrl: CDN('Triceps_Pushdown_-_Rope_Attachment') },
  { name: 'Tríceps Barra na Polia',              group: 'Tríceps',                  equipment: 'Polia',          mediaUrl: CDN('Triceps_Pushdown') },
  { name: 'Tríceps Invertido na Polia',          group: 'Tríceps',                  equipment: 'Polia',          mediaUrl: CDN('Reverse_Grip_Triceps_Pushdown') },
  { name: 'Tríceps Francês com Halter',          group: 'Tríceps',                  equipment: 'Halteres',       mediaUrl: CDN('Standing_Dumbbell_Triceps_Extension') },
  { name: 'Tríceps Francês com Barra EZ',        group: 'Tríceps',                  equipment: 'Barra EZ',       mediaUrl: CDN('EZ-Bar_Skullcrusher') },
  { name: 'Tríceps Testa com Barra',             group: 'Tríceps',                  equipment: 'Barra',          mediaUrl: CDN('Lying_Triceps_Press') },
  { name: 'Supino Fechado',                      group: 'Tríceps',                  equipment: 'Barra',          mediaUrl: CDN('Close-Grip_Barbell_Bench_Press') },
  { name: 'Mergulho Tríceps no Banco',           group: 'Tríceps',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Bench_Dips') },
  { name: 'Tríceps Coice com Halter',            group: 'Tríceps',                  equipment: 'Halteres',       mediaUrl: CDN('Tricep_Dumbbell_Kickback') },
  { name: 'Tríceps na Máquina',                  group: 'Tríceps',                  equipment: 'Máquina',        mediaUrl: CDN('Dip_Machine') },
  // ── Pernas / Quadríceps ───────────────────────────────────────────────────
  { name: 'Agachamento Livre',                   group: 'Pernas / Quadríceps',      equipment: 'Barra',          mediaUrl: CDN('Barbell_Squat') },
  { name: 'Agachamento Hack',                    group: 'Pernas / Quadríceps',      equipment: 'Barra',          mediaUrl: CDN('Barbell_Hack_Squat') },
  { name: 'Agachamento no Smith',                group: 'Pernas / Quadríceps',      equipment: 'Smith',          mediaUrl: CDN('Smith_Machine_Squat') },
  { name: 'Agachamento Frontal',                 group: 'Pernas / Quadríceps',      equipment: 'Barra',          mediaUrl: CDN('Front_Barbell_Squat') },
  { name: 'Leg Press 45°',                       group: 'Pernas / Quadríceps',      equipment: 'Máquina',        mediaUrl: CDN('Leg_Press') },
  { name: 'Leg Press Horizontal',                group: 'Pernas / Quadríceps',      equipment: 'Máquina',        mediaUrl: CDN('Leg_Press') },
  { name: 'Cadeira Extensora',                   group: 'Pernas / Quadríceps',      equipment: 'Máquina',        mediaUrl: CDN('Leg_Extensions') },
  { name: 'Afundo com Halteres',                 group: 'Pernas / Quadríceps',      equipment: 'Halteres',       mediaUrl: CDN('Dumbbell_Lunges') },
  { name: 'Afundo com Barra',                    group: 'Pernas / Quadríceps',      equipment: 'Barra',          mediaUrl: CDN('Barbell_Lunge') },
  { name: 'Búlgaro com Halteres',                group: 'Pernas / Quadríceps',      equipment: 'Halteres',       mediaUrl: CDN('Split_Squat_with_Dumbbells') },
  { name: 'Agachamento Goblet',                  group: 'Pernas / Quadríceps',      equipment: 'Halteres',       mediaUrl: CDN('Goblet_Squat') },
  { name: 'Hack Machine',                        group: 'Pernas / Quadríceps',      equipment: 'Máquina',        mediaUrl: CDN('Barbell_Hack_Squat') },
  // ── Pernas / Posterior ────────────────────────────────────────────────────
  { name: 'Mesa Flexora',                        group: 'Pernas / Posterior',       equipment: 'Máquina',        mediaUrl: CDN('Lying_Leg_Curls') },
  { name: 'Cadeira Flexora',                     group: 'Pernas / Posterior',       equipment: 'Máquina',        mediaUrl: CDN('Seated_Leg_Curl') },
  { name: 'Stiff com Barra',                     group: 'Pernas / Posterior',       equipment: 'Barra',          mediaUrl: CDN('Stiff-Legged_Barbell_Deadlift') },
  { name: 'Stiff com Halteres',                  group: 'Pernas / Posterior',       equipment: 'Halteres',       mediaUrl: CDN('Stiff-Legged_Dumbbell_Deadlift') },
  { name: 'Levantamento Terra Romeno',           group: 'Pernas / Posterior',       equipment: 'Barra',          mediaUrl: CDN('Romanian_Deadlift') },
  { name: 'Curl Deitado na Polia',               group: 'Pernas / Posterior',       equipment: 'Polia',          mediaUrl: CDN('Lying_Leg_Curls') },
  { name: 'Good Morning',                        group: 'Pernas / Posterior',       equipment: 'Barra',          mediaUrl: CDN('Good_Morning') },
  // ── Glúteos ───────────────────────────────────────────────────────────────
  { name: 'Hip Thrust com Barra',                group: 'Glúteos',                  equipment: 'Barra',          mediaUrl: CDN('Barbell_Hip_Thrust') },
  { name: 'Hip Thrust com Halteres',             group: 'Glúteos',                  equipment: 'Halteres',       mediaUrl: CDN('Barbell_Hip_Thrust') },
  { name: 'Elevação Pélvica no Solo',            group: 'Glúteos',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Butt_Lift_Bridge') },
  { name: 'Abdução de Quadril na Polia',         group: 'Glúteos',                  equipment: 'Polia',          mediaUrl: CDN('Cable_Hip_Adduction') },
  { name: 'Abdução de Quadril na Máquina',       group: 'Glúteos',                  equipment: 'Máquina',        mediaUrl: CDN('Thigh_Abductor') },
  { name: 'Kickback na Polia',                   group: 'Glúteos',                  equipment: 'Polia',          mediaUrl: CDN('One-Legged_Cable_Kickback') },
  // ── Glúteos / Pernas ──────────────────────────────────────────────────────
  { name: 'Agachamento Sumô',                    group: 'Glúteos / Pernas',         equipment: 'Halteres',       mediaUrl: CDN('Kettlebell_Sumo_High_Pull') },
  { name: 'Agachamento Sumô com Barra',          group: 'Glúteos / Pernas',         equipment: 'Barra',          mediaUrl: CDN('Sumo_Deadlift') },
  // ── Glúteos ───────────────────────────────────────────────────────────────
  { name: 'Donkey Kick',                         group: 'Glúteos',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Glute_Kickback') },
  // ── Panturrilhas ──────────────────────────────────────────────────────────
  { name: 'Panturrilha em Pé na Máquina',        group: 'Panturrilhas',             equipment: 'Máquina',        mediaUrl: CDN('Standing_Calf_Raises') },
  { name: 'Panturrilha Sentado na Máquina',      group: 'Panturrilhas',             equipment: 'Máquina',        mediaUrl: CDN('Seated_Calf_Raise') },
  { name: 'Panturrilha no Leg Press',            group: 'Panturrilhas',             equipment: 'Máquina',        mediaUrl: CDN('Calf_Press_On_The_Leg_Press_Machine') },
  { name: 'Panturrilha com Halter (unilateral)', group: 'Panturrilhas',             equipment: 'Halteres',       mediaUrl: CDN('Standing_Dumbbell_Calf_Raise') },
  { name: 'Panturrilha no Smith',                group: 'Panturrilhas',             equipment: 'Smith',          mediaUrl: CDN('Smith_Machine_Calf_Raise') },
  // ── Abdômen ───────────────────────────────────────────────────────────────
  { name: 'Abdominal Crunch',                    group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Crunches') },
  { name: 'Abdominal na Polia',                  group: 'Abdômen',                  equipment: 'Polia',          mediaUrl: CDN('Cable_Crunch') },
  { name: 'Elevação de Pernas',                  group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Hanging_Leg_Raise') },
  { name: 'Prancha (Plank)',                     group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Plank') },
  { name: 'Russian Twist',                       group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Russian_Twist') },
  { name: 'Abdominal Oblíquo',                   group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Cross-Body_Crunch') },
  { name: 'Roda Abdominal (Ab Wheel)',           group: 'Abdômen',                  equipment: 'Acessório',      mediaUrl: CDN('Ab_Roller') },
  { name: 'V-Sit',                               group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Jackknife_Sit-Up') },
  { name: 'Dead Bug',                            group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Dead_Bug') },
  { name: 'Mountain Climber',                    group: 'Abdômen',                  equipment: 'Peso Corpo',     mediaUrl: CDN('Mountain_Climbers') },
  // ── Cardio / Funcional ────────────────────────────────────────────────────
  { name: 'Burpee',                              group: 'Cardio / Funcional',       equipment: 'Peso Corpo',     mediaUrl: CDN('Freehand_Jump_Squat') },
  { name: 'Kettlebell Swing',                    group: 'Cardio / Funcional',       equipment: 'Kettlebell',     mediaUrl: CDN('One-Arm_Kettlebell_Swings') },
  { name: 'Clean com Barra',                     group: 'Cardio / Funcional',       equipment: 'Barra',          mediaUrl: CDN('Power_Clean') },
  { name: 'Jumping Jack',                        group: 'Cardio / Funcional',       equipment: 'Peso Corpo',     mediaUrl: CDN('Star_Jump') },
  { name: 'Pular Corda',                         group: 'Cardio / Funcional',       equipment: 'Acessório',      mediaUrl: CDN('Rope_Jumping') },
];

/** Todos os grupos musculares únicos disponíveis (para filtros de UI) */
export const MUSCLE_GROUPS: string[] = [
  ...new Set(COMMON_SUGGESTIONS.map((ex) => ex.group)),
].sort();

/** Todos os equipamentos únicos disponíveis (para filtros futuros) */
export const EQUIPMENT_TYPES: string[] = [
  ...new Set(COMMON_SUGGESTIONS.map((ex) => ex.equipment ?? 'Outro').filter(Boolean)),
].sort();
