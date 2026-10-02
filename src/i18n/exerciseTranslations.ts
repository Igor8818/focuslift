import { Language } from './translations';

/**
 * Mapeamento e tradução de grupos musculares em 5 línguas.
 */
const MUSCLE_MAP: Record<string, Record<Language, string>> = {
  'Peito': {
    pt: 'Peito',
    en: 'Chest',
    es: 'Pecho',
    de: 'Brust',
    fr: 'Poitrine',
  },
  'Costas': {
    pt: 'Costas',
    en: 'Back',
    es: 'Espalda',
    de: 'Rücken',
    fr: 'Dos',
  },
  'Ombros': {
    pt: 'Ombros',
    en: 'Shoulders',
    es: 'Hombros',
    de: 'Schultern',
    fr: 'Épaules',
  },
  'Bíceps': {
    pt: 'Bíceps',
    en: 'Biceps',
    es: 'Bíceps',
    de: 'Bizeps',
    fr: 'Biceps',
  },
  'Tríceps': {
    pt: 'Tríceps',
    en: 'Triceps',
    es: 'Tríceps',
    de: 'Trizeps',
    fr: 'Triceps',
  },
  'Pernas': {
    pt: 'Pernas',
    en: 'Legs',
    es: 'Piernas',
    de: 'Beine',
    fr: 'Jambes',
  },
  'Quadríceps': {
    pt: 'Quadríceps',
    en: 'Quads',
    es: 'Cuádriceps',
    de: 'Quadrizeps',
    fr: 'Quadriceps',
  },
  'Posterior': {
    pt: 'Posterior',
    en: 'Hamstrings',
    es: 'Isquios',
    de: 'Beinbeuger',
    fr: 'Ischios',
  },
  'Glúteos': {
    pt: 'Glúteos',
    en: 'Glutes',
    es: 'Glúteos',
    de: 'Gesäß',
    fr: 'Fessiers',
  },
  'Panturrilhas': {
    pt: 'Panturrilhas',
    en: 'Calves',
    es: 'Gemelos',
    de: 'Waden',
    fr: 'Mollets',
  },
  'Panturrilha': {
    pt: 'Panturrilha',
    en: 'Calf',
    es: 'Gemelo',
    de: 'Wade',
    fr: 'Mollet',
  },
  'Abdômen': {
    pt: 'Abdômen',
    en: 'Abs',
    es: 'Abdomen',
    de: 'Bauch',
    fr: 'Abdos',
  },
  'Antebraço': {
    pt: 'Antebraço',
    en: 'Forearms',
    es: 'Antebrazo',
    de: 'Unterarme',
    fr: 'Avant-bras',
  },
  'Trapézio': {
    pt: 'Trapézio',
    en: 'Traps',
    es: 'Trapecio',
    de: 'Nacken',
    fr: 'Trapèzes',
  },
  'Lombar': {
    pt: 'Lombar',
    en: 'Lower Back',
    es: 'Lumbar',
    de: 'Unterer Rücken',
    fr: 'Bas du dos',
  },
  'Cardio': {
    pt: 'Cardio',
    en: 'Cardio',
    es: 'Cardio',
    de: 'Ausdauer',
    fr: 'Cardio',
  },
};

/**
 * Mapeamento e tradução de equipamentos.
 */
const EQUIPMENT_MAP: Record<string, Record<Language, string>> = {
  'Barra': {
    pt: 'Barra',
    en: 'Barbell',
    es: 'Barra',
    de: 'Langhantel',
    fr: 'Barre',
  },
  'Barra EZ': {
    pt: 'Barra EZ',
    en: 'EZ Bar',
    es: 'Barra Z',
    de: 'SZ-Stange',
    fr: 'Barre EZ',
  },
  'Halteres': {
    pt: 'Halteres',
    en: 'Dumbbells',
    es: 'Mancuernas',
    de: 'Kurzhanteln',
    fr: 'Haltères',
  },
  'Polia': {
    pt: 'Polia',
    en: 'Cable',
    es: 'Polea',
    de: 'Kabelzug',
    fr: 'Poulie',
  },
  'Máquina': {
    pt: 'Máquina',
    en: 'Machine',
    es: 'Máquina',
    de: 'Maschine',
    fr: 'Machine',
  },
  'Smith': {
    pt: 'Smith',
    en: 'Smith Machine',
    es: 'Máquina Smith',
    de: 'Multipresse',
    fr: 'Cadre Guidé',
  },
  'Peso Corpo': {
    pt: 'Peso do Corpo',
    en: 'Bodyweight',
    es: 'Peso Corporal',
    de: 'Körpergewicht',
    fr: 'Poids du Corps',
  },
  'Acessório': {
    pt: 'Acessório',
    en: 'Accessory',
    es: 'Accesorio',
    de: 'Zubehör',
    fr: 'Accessoire',
  },
};

/**
 * Tradução de nomes comuns de exercícios.
 */
const EXERCISE_NAMES_MAP: Record<string, Record<Language, string>> = {
  'Supino Reto com Barra': {
    pt: 'Supino Reto com Barra',
    en: 'Barbell Bench Press',
    es: 'Press de Banca Plano',
    de: 'Bankdrücken (Langhantel)',
    fr: 'Développé Couché Barre',
  },
  'Supino Inclinado com Barra': {
    pt: 'Supino Inclinado com Barra',
    en: 'Incline Barbell Bench Press',
    es: 'Press de Banca Inclinado',
    de: 'Schrägbankdrücken (Langhantel)',
    fr: 'Développé Incliné Barre',
  },
  'Supino Reto com Halteres': {
    pt: 'Supino Reto com Halteres',
    en: 'Dumbbell Bench Press',
    es: 'Press con Mancuernas',
    de: 'Bankdrücken (Kurzhanteln)',
    fr: 'Développé Couché Haltères',
  },
  'Supino Inclinado com Halteres': {
    pt: 'Supino Inclinado com Halteres',
    en: 'Incline Dumbbell Press',
    es: 'Press Inclinado con Mancuernas',
    de: 'Schrägbankdrücken (Kurzhanteln)',
    fr: 'Développé Incliné Haltères',
  },
  'Crucifixo com Halteres': {
    pt: 'Crucifixo com Halteres',
    en: 'Dumbbell Flyes',
    es: 'Aperturas con Mancuernas',
    de: 'Fliegende (Kurzhanteln)',
    fr: 'Écarté avec Haltères',
  },
  'Mergulho (Paralelas)': {
    pt: 'Mergulho (Paralelas)',
    en: 'Chest Dips',
    es: 'Fondos en Paralelas',
    de: 'Dips (Barren)',
    fr: 'Dips aux Barres Parallèles',
  },
  'Peck Deck (Voador)': {
    pt: 'Peck Deck (Voador)',
    en: 'Pec Deck Machine',
    es: 'Contractor de Pecho',
    de: 'Butterfly Maschine',
    fr: 'Pec Deck (Papillon)',
  },
  'Flexão de Braço': {
    pt: 'Flexão de Braço',
    en: 'Push-ups',
    es: 'Flexiones de Pecho',
    de: 'Liegestütze',
    fr: 'Pompes',
  },
  'Levantamento Terra': {
    pt: 'Levantamento Terra',
    en: 'Deadlift',
    es: 'Peso Muerto',
    de: 'Kreuzheben',
    fr: 'Soulevé de Terre',
  },
  'Barra Fixa (Pegada Aberta)': {
    pt: 'Barra Fixa (Pegada Aberta)',
    en: 'Pull-ups',
    es: 'Dominadas',
    de: 'Klimmzüge (breiter Griff)',
    fr: 'Tractions Prise Large',
  },
  'Barra Fixa Supinada (Chin-up)': {
    pt: 'Barra Fixa Supinada (Chin-up)',
    en: 'Chin-ups',
    es: 'Dominadas Supinas',
    de: 'Klimmzüge (Untergriff)',
    fr: 'Tractions Prise Supination',
  },
  'Puxada Alta Aberta': {
    pt: 'Puxada Alta Aberta',
    en: 'Lat Pulldown',
    es: 'Jalón al Pecho',
    de: 'Latzug zur Brust',
    fr: 'Tirage Vertical Poitrine',
  },
  'Remada Curvada com Barra': {
    pt: 'Remada Curvada com Barra',
    en: 'Barbell Bent-Over Row',
    es: 'Remo con Barra',
    de: 'Vorgebeugtes Rudern (Langhantel)',
    fr: 'Rowing Barre Buste Penché',
  },
  'Remada Unilateral com Halter': {
    pt: 'Remada Unilateral com Halter',
    en: 'Single-Arm Dumbbell Row',
    es: 'Remo con Mancuerna Unilateral',
    de: 'Einarmiges Kurzhantelrudern',
    fr: 'Rowing Haltère Unilatéral',
  },
  'Desenvolvimento com Halteres': {
    pt: 'Desenvolvimento com Halteres',
    en: 'Dumbbell Shoulder Press',
    es: 'Press Militar con Mancuernas',
    de: 'Schulterdrücken (Kurzhanteln)',
    fr: 'Développé Épaules Haltères',
  },
  'Desenvolvimento com Barra': {
    pt: 'Desenvolvimento com Barra',
    en: 'Overhead Press (OHP)',
    es: 'Press Militar con Barra',
    de: 'Militärpresse (Langhantel)',
    fr: 'Développé Militaire Barre',
  },
  'Elevação Lateral com Halteres': {
    pt: 'Elevação Lateral com Halteres',
    en: 'Lateral Raises',
    es: 'Elevaciones Laterales',
    de: 'Seitheben (Kurzhanteln)',
    fr: 'Élévations Latérales Haltères',
  },
  'Rosca Direta com Barra': {
    pt: 'Rosca Direta com Barra',
    en: 'Barbell Bicep Curl',
    es: 'Curl de Bíceps con Barra',
    de: 'Bizepscurls (Langhantel)',
    fr: 'Curl Biceps Barre',
  },
  'Rosca Martelo com Halteres': {
    pt: 'Rosca Martelo com Halteres',
    en: 'Hammer Curls',
    es: 'Curl Martillo',
    de: 'Hammercurls',
    fr: 'Curl Marteau',
  },
  'Tríceps Corda na Polia': {
    pt: 'Tríceps Corda na Polia',
    en: 'Triceps Rope Pushdown',
    es: 'Extensión de Tríceps en Polea (Cuerda)',
    de: 'Trizepsdrücken am Kabel (Seil)',
    fr: 'Extension Triceps Corde',
  },
  'Tríceps Testa com Barra': {
    pt: 'Tríceps Testa com Barra',
    en: 'Skull Crushers',
    es: 'Press Francés / Rompecráneos',
    de: 'French Press (Stirndrücken)',
    fr: 'Barre au Front',
  },
  'Agachamento Livre': {
    pt: 'Agachamento Livre',
    en: 'Barbell Back Squat',
    es: 'Sentadilla con Barra',
    de: 'Kniebeugen (Langhantel)',
    fr: 'Squat Arrière Barre',
  },
  'Leg Press 45°': {
    pt: 'Leg Press 45°',
    en: 'Leg Press 45°',
    es: 'Prensa 45°',
    de: 'Beinpresse 45°',
    fr: 'Presse à Cuisses 45°',
  },
  'Cadeira Extensora': {
    pt: 'Cadeira Extensora',
    en: 'Leg Extension',
    es: 'Extensión de Cuádriceps',
    de: 'Beinstrecker',
    fr: 'Leg Extension',
  },
  'Mesa Flexora': {
    pt: 'Mesa Flexora',
    en: 'Lying Leg Curl',
    es: 'Curl Femoral Tumbado',
    de: 'Beinbeuger liegend',
    fr: 'Leg Curl Allongé',
  },
  'Cadeira Flexora': {
    pt: 'Cadeira Flexora',
    en: 'Seated Leg Curl',
    es: 'Curl Femoral Sentado',
    de: 'Beinbeuger sitzend',
    fr: 'Leg Curl Assis',
  },
  'Stiff com Barra': {
    pt: 'Stiff com Barra',
    en: 'Stiff-Leg Deadlift',
    es: 'Peso Muerto Rumano / Stiff',
    de: 'Gestrecktes Kreuzheben',
    fr: 'Soulevé de Terre Jambes Tendues',
  },
  'Hip Thrust com Barra': {
    pt: 'Hip Thrust com Barra',
    en: 'Barbell Hip Thrust',
    es: 'Hip Thrust con Barra',
    de: 'Hip Thrust (Langhantel)',
    fr: 'Hip Thrust à la Barre',
  },
  'Panturrilha em Pé na Máquina': {
    pt: 'Panturrilha em Pé na Máquina',
    en: 'Standing Calf Raise',
    es: 'Elevación de Talones de Pie',
    de: 'Wadenheben stehend',
    fr: 'Mollets Debout Machine',
  },
  'Abdominal Crunch': {
    pt: 'Abdominal Crunch',
    en: 'Ab Crunch',
    es: 'Crunch Abdominal',
    de: 'Crunches',
    fr: 'Crunch Abdominal',
  },
  'Prancha (Plank)': {
    pt: 'Prancha (Plank)',
    en: 'Plank',
    es: 'Plancha Abdominal',
    de: 'Unterarmstütz (Plank)',
    fr: 'Gainage (Planche)',
  },
};

/**
 * Traduz o grupo muscular (suporta compostos como "Pernas / Quadríceps").
 */
export function translateMuscleGroup(rawGroup: string, lang: Language): string {
  if (lang === 'pt' || !rawGroup) return rawGroup;

  // Se houver barra (ex: "Pernas / Quadríceps", "Ombros / Trapézio")
  if (rawGroup.includes('/')) {
    const parts = rawGroup.split('/').map((p) => p.trim());
    return parts
      .map((part) => MUSCLE_MAP[part]?.[lang] ?? part)
      .join(' / ');
  }

  return MUSCLE_MAP[rawGroup]?.[lang] ?? rawGroup;
}

/**
 * Traduz o nome do exercício se estiver no banco comum.
 */
export function translateExerciseName(rawName: string, lang: Language): string {
  if (lang === 'pt' || !rawName) return rawName;
  return EXERCISE_NAMES_MAP[rawName]?.[lang] ?? rawName;
}

/**
 * Traduz o tipo de equipamento.
 */
export function translateEquipment(rawEquipment: string, lang: Language): string {
  if (lang === 'pt' || !rawEquipment) return rawEquipment;
  return EQUIPMENT_MAP[rawEquipment]?.[lang] ?? rawEquipment;
}
