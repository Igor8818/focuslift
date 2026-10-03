import { Language } from './translations';

/**
 * Normaliza string para busca sem acentos e minúsculas.
 */
function normalizeKey(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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
  'Funcional': {
    pt: 'Funcional',
    en: 'Functional',
    es: 'Funcional',
    de: 'Funktionell',
    fr: 'Fonctionnel',
  },
  'Personalizado': {
    pt: 'Personalizado',
    en: 'Custom',
    es: 'Personalizado',
    de: 'Benutzerdefiniert',
    fr: 'Personnalisé',
  },
  'Histórico': {
    pt: 'Histórico',
    en: 'History',
    es: 'Historial',
    de: 'Verlauf',
    fr: 'Historique',
  },
};

/**
 * Mapeamento e tradução de equipamentos em 5 línguas.
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
  'Barra W': {
    pt: 'Barra W',
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
  'Peso do Corpo': {
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
  'Kettlebell': {
    pt: 'Kettlebell',
    en: 'Kettlebell',
    es: 'Pesa Rusa',
    de: 'Kugelhantel',
    fr: 'Kettlebell',
  },
  'Outro': {
    pt: 'Outro',
    en: 'Other',
    es: 'Otro',
    de: 'Sonstiges',
    fr: 'Autre',
  },
};

/**
 * Tradução de nomes de treinos clássicos / padrão.
 */
const ROUTINES_MAP: Record<string, Record<Language, string>> = {
  'Push A - Peito, Ombro e Tríceps': {
    pt: 'Push A - Peito, Ombro e Tríceps',
    en: 'Push A - Chest, Shoulders & Triceps',
    es: 'Push A - Pecho, Hombros y Tríceps',
    de: 'Push A - Brust, Schultern & Trizeps',
    fr: 'Push A - Poitrine, Épaules & Triceps',
  },
  'Pull B - Costas e Bíceps': {
    pt: 'Pull B - Costas e Bíceps',
    en: 'Pull B - Back & Biceps',
    es: 'Pull B - Espalda y Bíceps',
    de: 'Pull B - Rücken & Bizeps',
    fr: 'Pull B - Dos & Biceps',
  },
  'Legs C - Membros Inferiores': {
    pt: 'Legs C - Membros Inferiores',
    en: 'Legs C - Lower Body',
    es: 'Legs C - Tren Inferior',
    de: 'Legs C - Unterkörper',
    fr: 'Legs C - Membres Inférieurs',
  },
};

const ROUTINES_DESC_MAP: Record<string, Record<Language, string>> = {
  'Foco em peitoral, deltoide anterior/lateral e tríceps.': {
    pt: 'Foco em peitoral, deltoide anterior/lateral e tríceps.',
    en: 'Focus on chest, anterior/lateral deltoids and triceps.',
    es: 'Enfoque en pecho, deltoides anterior/lateral y tríceps.',
    de: 'Fokus auf Brust, vordere/seitliche Schultern und Trizeps.',
    fr: 'Accent sur la poitrine, les deltoïdes et les triceps.',
  },
  'Foco em dorsal, trapézio, deltoide posterior e bíceps.': {
    pt: 'Foco em dorsal, trapézio, deltoide posterior e bíceps.',
    en: 'Focus on lats, traps, rear delts and biceps.',
    es: 'Enfoque en dorsales, trapecios, deltoides posterior y bíceps.',
    de: 'Fokus auf Latissimus, Nacken, hintere Schultern und Bizeps.',
    fr: 'Accent sur le dos, les trapèzes, l’arrière d’épaules et les biceps.',
  },
  'Treino completo de quadríceps, posteriores, glúteos e panturrilhas.': {
    pt: 'Treino completo de quadríceps, posteriores, glúteos e panturrilhas.',
    en: 'Complete workout for quads, hamstrings, glutes and calves.',
    es: 'Entrenamiento completo de cuádriceps, isquios, glúteos y gemelos.',
    de: 'Komplettes Training für Quadrizeps, Beinbeuger, Gesäß und Waden.',
    fr: 'Entraînement complet des quadriceps, ischios, fessiers et mollets.',
  },
};

/**
 * Tradução COMPLETA dos 80 exercícios da base COMMON_SUGGESTIONS + variações.
 */
const EXERCISE_NAMES_MAP: Record<string, Record<Language, string>> = {
  // ── Peito ──
  'Supino Reto com Barra': {
    pt: 'Supino Reto com Barra',
    en: 'Barbell Bench Press',
    es: 'Press de Banca Plano con Barra',
    de: 'Bankdrücken (Langhantel)',
    fr: 'Développé Couché Barre',
  },
  'Supino Inclinado com Barra': {
    pt: 'Supino Inclinado com Barra',
    en: 'Incline Barbell Bench Press',
    es: 'Press Inclinado con Barra',
    de: 'Schrägbankdrücken (Langhantel)',
    fr: 'Développé Incliné Barre',
  },
  'Supino Declinado com Barra': {
    pt: 'Supino Declinado com Barra',
    en: 'Decline Barbell Bench Press',
    es: 'Press Declinado con Barra',
    de: 'Negativbankdrücken (Langhantel)',
    fr: 'Développé Décliné Barre',
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
  'Supino Declinado com Halteres': {
    pt: 'Supino Declinado com Halteres',
    en: 'Decline Dumbbell Press',
    es: 'Press Declinado con Mancuernas',
    de: 'Negativbankdrücken (Kurzhanteln)',
    fr: 'Développé Décliné Haltères',
  },
  'Crucifixo com Halteres': {
    pt: 'Crucifixo com Halteres',
    en: 'Dumbbell Flyes',
    es: 'Aperturas con Mancuernas',
    de: 'Fliegende (Kurzhanteln)',
    fr: 'Écarté avec Haltères',
  },
  'Crucifixo Inclinado com Halteres': {
    pt: 'Crucifixo Inclinado com Halteres',
    en: 'Incline Dumbbell Flyes',
    es: 'Aperturas Inclinadas con Mancuernas',
    de: 'Schräge Fliegende (Kurzhanteln)',
    fr: 'Écarté Incliné Haltères',
  },
  'Crucifixo na Polia': {
    pt: 'Crucifixo na Polia',
    en: 'Cable Flyes',
    es: 'Cruces en Polea',
    de: 'Kabelzug Fliegende',
    fr: 'Écarté à la Poulie',
  },
  'Crossover na Polia': {
    pt: 'Crossover na Polia',
    en: 'Cable Crossover',
    es: 'Cruce de Poleas',
    de: 'Cable Cross (Kabelzug)',
    fr: 'Crossover Poulie Vis-à-Vis',
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
    es: 'Contractor de Pecho (Peck Deck)',
    de: 'Butterfly Maschine',
    fr: 'Pec Deck (Papillon)',
  },
  'Press no Smith (Peito)': {
    pt: 'Press no Smith (Peito)',
    en: 'Smith Machine Bench Press',
    es: 'Press de Banca en Smith',
    de: 'Multipresse Bankdrücken',
    fr: 'Développé Couché Smith Machine',
  },
  'Flexão de Braço': {
    pt: 'Flexão de Braço',
    en: 'Push-ups',
    es: 'Flexiones de Pecho',
    de: 'Liegestütze',
    fr: 'Pompes',
  },
  'Flexão Diamante': {
    pt: 'Flexão Diamante',
    en: 'Diamond Push-ups',
    es: 'Flexiones Diamante',
    de: 'Diamant-Liegestütze',
    fr: 'Pompes Diamant',
  },

  // ── Costas ──
  'Puxada Alta Aberta': {
    pt: 'Puxada Alta Aberta',
    en: 'Wide-Grip Lat Pulldown',
    es: 'Jalón al Pecho Agarre Ancho',
    de: 'Latzug breiter Griff',
    fr: 'Tirage Vertical Prise Large',
  },
  'Puxada Alta Fechada': {
    pt: 'Puxada Alta Fechada',
    en: 'Close-Grip Lat Pulldown',
    es: 'Jalón al Pecho Agarre Estrecho',
    de: 'Latzug enger Griff',
    fr: 'Tirage Vertical Prise Serrée',
  },
  'Puxada Triangular': {
    pt: 'Puxada Triangular',
    en: 'V-Bar Lat Pulldown',
    es: 'Jalón al Pecho con Agarre V',
    de: 'Latzug mit V-Griff',
    fr: 'Tirage Poitrine Prise Triangle',
  },
  'Puxada Unilateral': {
    pt: 'Puxada Unilateral',
    en: 'Single-Arm Lat Pulldown',
    es: 'Jalón Unilateral en Polea',
    de: 'Einarmiger Latzug',
    fr: 'Tirage Vertical Unilatéral',
  },
  'Remada Curvada com Barra': {
    pt: 'Remada Curvada com Barra',
    en: 'Barbell Bent-Over Row',
    es: 'Remo con Barra Inclinado',
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
  'Remada Sentada na Polia': {
    pt: 'Remada Sentada na Polia',
    en: 'Seated Cable Row',
    es: 'Remo Sentado en Polea',
    de: 'Kabelrudern sitzend',
    fr: 'Rowing Assis à la Poulie',
  },
  'Remada Alta com Barra': {
    pt: 'Remada Alta com Barra',
    en: 'Upright Barbell Row',
    es: 'Remo al Mentón con Barra',
    de: 'Aufrechtes Rudern (Langhantel)',
    fr: 'Tirage Menton Barre',
  },
  'Pullover com Halter': {
    pt: 'Pullover com Halter',
    en: 'Dumbbell Pullover',
    es: 'Pullover con Mancuerna',
    de: 'Kurzhantel-Pullover',
    fr: 'Pull-over avec Haltère',
  },
  'Pullover na Polia': {
    pt: 'Pullover na Polia',
    en: 'Straight-Arm Cable Pulldown',
    es: 'Pullover en Polea Alta',
    de: 'Kabel-Pullover mit gestreckten Armen',
    fr: 'Pull-over à la Poulie Haute',
  },
  'Barra Fixa (Pegada Aberta)': {
    pt: 'Barra Fixa (Pegada Aberta)',
    en: 'Wide-Grip Pull-ups',
    es: 'Dominadas Pronas (Agarre Ancho)',
    de: 'Klimmzüge (breiter Griff)',
    fr: 'Tractions Prise Large',
  },
  'Barra Fixa Supinada (Chin-up)': {
    pt: 'Barra Fixa Supinada (Chin-up)',
    en: 'Chin-ups',
    es: 'Dominadas Supinas (Chin-ups)',
    de: 'Klimmzüge (Untergriff)',
    fr: 'Tractions Prise Supination',
  },
  'Levantamento Terra': {
    pt: 'Levantamento Terra',
    en: 'Deadlift',
    es: 'Peso Muerto',
    de: 'Kreuzheben',
    fr: 'Soulevé de Terre',
  },
  'Remada no Smith': {
    pt: 'Remada no Smith',
    en: 'Smith Machine Row',
    es: 'Remo en Máquina Smith',
    de: 'Multipresse Rudern',
    fr: 'Rowing Smith Machine',
  },
  'Hiperextensão Lombar': {
    pt: 'Hiperextensão Lombar',
    en: 'Back Extensions',
    es: 'Hiperextensiones Lumbares',
    de: 'Rückenstrecken (Hyperextensions)',
    fr: 'Extensions Lombaires',
  },

  // ── Ombros ──
  'Desenvolvimento com Barra': {
    pt: 'Desenvolvimento com Barra',
    en: 'Overhead Barbell Press',
    es: 'Press Militar con Barra',
    de: 'Schulterdrücken (Langhantel)',
    fr: 'Développé Militaire Barre',
  },
  'Desenvolvimento com Halteres': {
    pt: 'Desenvolvimento com Halteres',
    en: 'Dumbbell Shoulder Press',
    es: 'Press de Hombros con Mancuernas',
    de: 'Schulterdrücken (Kurzhanteln)',
    fr: 'Développé Épaules Haltères',
  },
  'Desenvolvimento Arnold': {
    pt: 'Desenvolvimento Arnold',
    en: 'Arnold Press',
    es: 'Press Arnold',
    de: 'Arnold Press',
    fr: 'Développé Arnold',
  },
  'Desenvolvimento no Smith': {
    pt: 'Desenvolvimento no Smith',
    en: 'Smith Machine Shoulder Press',
    es: 'Press de Hombros en Smith',
    de: 'Multipresse Schulterdrücken',
    fr: 'Développé Épaules Smith Machine',
  },
  'Press Militar': {
    pt: 'Press Militar',
    en: 'Military Press',
    es: 'Press Militar',
    de: 'Militärpresse',
    fr: 'Développé Militaire',
  },
  'Elevação Lateral com Halteres': {
    pt: 'Elevação Lateral com Halteres',
    en: 'Lateral Raises',
    es: 'Elevaciones Laterales con Mancuernas',
    de: 'Seitheben (Kurzhanteln)',
    fr: 'Élévations Latérales Haltères',
  },
  'Elevação Lateral': {
    pt: 'Elevação Lateral',
    en: 'Lateral Raises',
    es: 'Elevaciones Laterales',
    de: 'Seitheben',
    fr: 'Élévations Latérales',
  },
  'Elevação Lateral na Polia': {
    pt: 'Elevação Lateral na Polia',
    en: 'Cable Lateral Raise',
    es: 'Elevación Lateral en Polea',
    de: 'Kabel-Seitheben',
    fr: 'Élévations Latérales Poulie',
  },
  'Elevação Lateral na Máquina': {
    pt: 'Elevação Lateral na Máquina',
    en: 'Machine Lateral Raise',
    es: 'Elevación Lateral en Máquina',
    de: 'Maschinen-Seitheben',
    fr: 'Élévations Latérales Machine',
  },
  'Elevação Frontal com Barra': {
    pt: 'Elevação Frontal com Barra',
    en: 'Front Barbell Raise',
    es: 'Elevación Frontal con Barra',
    de: 'Frontheben (Langhantel)',
    fr: 'Élévations Frontales Barre',
  },
  'Elevação Frontal com Halter': {
    pt: 'Elevação Frontal com Halter',
    en: 'Front Dumbbell Raise',
    es: 'Elevación Frontal con Mancuerna',
    de: 'Frontheben (Kurzhantel)',
    fr: 'Élévations Frontales Haltère',
  },
  'Encolhimento com Barra': {
    pt: 'Encolhimento com Barra',
    en: 'Barbell Shrugs',
    es: 'Encogimientos con Barra',
    de: 'Shrugs (Langhantel)',
    fr: 'Haussements d’Épaules Barre',
  },
  'Encolhimento com Halteres': {
    pt: 'Encolhimento com Halteres',
    en: 'Dumbbell Shrugs',
    es: 'Encogimientos con Mancuernas',
    de: 'Shrugs (Kurzhanteln)',
    fr: 'Haussements d’Épaules Haltères',
  },
  'Remada Alta para Ombros': {
    pt: 'Remada Alta para Ombros',
    en: 'Upright Row for Shoulders',
    es: 'Remo al Mentón para Hombros',
    de: 'Aufrechtes Rudern für Schultern',
    fr: 'Tirage Menton Épaules',
  },
  'Face Pull na Polia': {
    pt: 'Face Pull na Polia',
    en: 'Face Pulls',
    es: 'Face Pull en Polea',
    de: 'Face Pulls am Kabelzug',
    fr: 'Face Pull à la Poulie',
  },
  'Crucifixo Invertido': {
    pt: 'Crucifixo Invertido',
    en: 'Reverse Flyes',
    es: 'Pájaros / Aperturas Inversas',
    de: 'Revers Fliegende',
    fr: 'Oiseau / Écarté Inversé',
  },

  // ── Bíceps ──
  'Rosca Direta com Barra': {
    pt: 'Rosca Direta com Barra',
    en: 'Barbell Bicep Curl',
    es: 'Curl de Bíceps con Barra',
    de: 'Bizepscurls (Langhantel)',
    fr: 'Curl Biceps Barre',
  },
  'Rosca Direta com EZ': {
    pt: 'Rosca Direta com EZ',
    en: 'EZ Bar Curl',
    es: 'Curl con Barra Z',
    de: 'SZ-Bizepscurls',
    fr: 'Curl Barre EZ',
  },
  'Rosca Direta com Barra W': {
    pt: 'Rosca Direta com Barra W',
    en: 'EZ Bar Bicep Curl',
    es: 'Curl con Barra Z',
    de: 'SZ-Bizepscurls',
    fr: 'Curl Barre EZ',
  },
  'Rosca Alternada com Halteres': {
    pt: 'Rosca Alternada com Halteres',
    en: 'Alternating Dumbbell Curl',
    es: 'Curl Alterno con Mancuernas',
    de: 'Abwechselnde Kurzhantelcurls',
    fr: 'Curl Alterné avec Haltères',
  },
  'Rosca Martelo com Halteres': {
    pt: 'Rosca Martelo com Halteres',
    en: 'Hammer Curls',
    es: 'Curl Martillo con Mancuernas',
    de: 'Hammercurls',
    fr: 'Curl Marteau Haltères',
  },
  'Rosca Concentrada': {
    pt: 'Rosca Concentrada',
    en: 'Concentration Curls',
    es: 'Curl Concentrado',
    de: 'Konzentrationscurls',
    fr: 'Curl Concentré',
  },
  'Rosca Inclinada com Halteres': {
    pt: 'Rosca Inclinada com Halteres',
    en: 'Incline Dumbbell Curl',
    es: 'Curl Inclinado con Mancuernas',
    de: 'Schrägbank-Bizepscurls',
    fr: 'Curl Incliné avec Haltères',
  },
  'Rosca Scott com Barra EZ': {
    pt: 'Rosca Scott com Barra EZ',
    en: 'Preacher Curl (EZ Bar)',
    es: 'Curl Scott con Barra Z',
    de: 'Scott-Curls (SZ-Stange)',
    fr: 'Pupitre Larry Scott Barre EZ',
  },
  'Rosca na Polia Baixa': {
    pt: 'Rosca na Polia Baixa',
    en: 'Low Cable Curl',
    es: 'Curl en Polea Baja',
    de: 'Kabelzug-Bizepscurls',
    fr: 'Curl à la Poulie Basse',
  },
  'Rosca Simultânea com Halteres': {
    pt: 'Rosca Simultânea com Halteres',
    en: 'Simultaneous Dumbbell Curl',
    es: 'Curl Simultáneo con Mancuernas',
    de: 'Synchrone Kurzhantelcurls',
    fr: 'Curl Simultané Haltères',
  },
  'Rosca Spiderman (21s)': {
    pt: 'Rosca Spiderman (21s)',
    en: 'Spider Curls (21s)',
    es: 'Curl Araña (21s)',
    de: 'Spider Curls (21er)',
    fr: 'Spider Curl (21s)',
  },

  // ── Tríceps ──
  'Tríceps Corda na Polia': {
    pt: 'Tríceps Corda na Polia',
    en: 'Triceps Rope Pushdown',
    es: 'Extensión de Tríceps con Cuerda',
    de: 'Trizepsdrücken am Seil',
    fr: 'Extension Triceps Corde',
  },
  'Tríceps Barra na Polia': {
    pt: 'Tríceps Barra na Polia',
    en: 'Triceps Bar Pushdown',
    es: 'Extensión de Tríceps con Barra',
    de: 'Trizepsdrücken mit Stange',
    fr: 'Extension Triceps Barre',
  },
  'Tríceps Invertido na Polia': {
    pt: 'Tríceps Invertido na Polia',
    en: 'Reverse-Grip Triceps Pushdown',
    es: 'Extensión de Tríceps Agarre Invertido',
    de: 'Trizepsdrücken Untergriff',
    fr: 'Extension Triceps Prise Inversée',
  },
  'Tríceps Francês com Halter': {
    pt: 'Tríceps Francês com Halter',
    en: 'Overhead Dumbbell Triceps Extension',
    es: 'Press Francés con Mancuerna',
    de: 'Überkopf-Trizepsstrecken (Kurzhantel)',
    fr: 'Extension Triceps Haltère Derrière Tête',
  },
  'Tríceps Francês com Barra EZ': {
    pt: 'Tríceps Francês com Barra EZ',
    en: 'Overhead EZ Bar Extension',
    es: 'Press Francés con Barra Z',
    de: 'Überkopf-Trizepsstrecken (SZ-Stange)',
    fr: 'Extension Triceps Barre EZ Derrière Tête',
  },
  'Tríceps Testa com Barra': {
    pt: 'Tríceps Testa com Barra',
    en: 'Skull Crushers',
    es: 'Press Francés Tumbado',
    de: 'French Press (Stirndrücken)',
    fr: 'Barre au Front (Skull Crusher)',
  },
  'Supino Fechado': {
    pt: 'Supino Fechado',
    en: 'Close-Grip Bench Press',
    es: 'Press de Banca Agarre Cerrado',
    de: 'Enges Bankdrücken',
    fr: 'Développé Couché Prise Serrée',
  },
  'Mergulho Tríceps no Banco': {
    pt: 'Mergulho Tríceps no Banco',
    en: 'Bench Dips',
    es: 'Fondos en Banco para Tríceps',
    de: 'Dips an der Bank',
    fr: 'Dips sur Banc',
  },
  'Tríceps Coice com Halter': {
    pt: 'Tríceps Coice com Halter',
    en: 'Triceps Kickback',
    es: 'Patada de Tríceps con Mancuerna',
    de: 'Trizeps-Kickbacks',
    fr: 'Kickback Triceps avec Haltère',
  },
  'Tríceps na Máquina': {
    pt: 'Tríceps na Máquina',
    en: 'Machine Triceps Dip',
    es: 'Extensión de Tríceps en Máquina',
    de: 'Trizeps-Maschine',
    fr: 'Triceps à la Machine',
  },

  // ── Pernas / Quadríceps ──
  'Agachamento Livre': {
    pt: 'Agachamento Livre',
    en: 'Barbell Back Squat',
    es: 'Sentadilla con Barra',
    de: 'Kniebeugen (Langhantel)',
    fr: 'Squat Arrière Barre',
  },
  'Agachamento Hack': {
    pt: 'Agachamento Hack',
    en: 'Hack Squat',
    es: 'Sentadilla Hack',
    de: 'Hackenschmidt-Kniebeuge',
    fr: 'Hack Squat',
  },
  'Agachamento no Smith': {
    pt: 'Agachamento no Smith',
    en: 'Smith Machine Squat',
    es: 'Sentadilla en Máquina Smith',
    de: 'Kniebeugen an der Multipresse',
    fr: 'Squat Smith Machine',
  },
  'Agachamento Frontal': {
    pt: 'Agachamento Frontal',
    en: 'Front Squat',
    es: 'Sentadilla Frontal',
    de: 'Frontkniebeugen',
    fr: 'Squat Avant Barre',
  },
  'Leg Press 45°': {
    pt: 'Leg Press 45°',
    en: 'Leg Press 45°',
    es: 'Prensa 45°',
    de: 'Beinpresse 45°',
    fr: 'Presse à Cuisses 45°',
  },
  'Leg Press Horizontal': {
    pt: 'Leg Press Horizontal',
    en: 'Horizontal Leg Press',
    es: 'Prensa Horizontal',
    de: 'Horizontale Beinpresse',
    fr: 'Presse à Cuisses Horizontale',
  },
  'Cadeira Extensora': {
    pt: 'Cadeira Extensora',
    en: 'Leg Extension',
    es: 'Extensión de Cuádriceps',
    de: 'Beinstrecker',
    fr: 'Leg Extension',
  },
  'Afundo com Halteres': {
    pt: 'Afundo com Halteres',
    en: 'Dumbbell Lunges',
    es: 'Zancadas con Mancuernas',
    de: 'Ausfallschritte (Kurzhanteln)',
    fr: 'Fentes avec Haltères',
  },
  'Afundo com Barra': {
    pt: 'Afundo com Barra',
    en: 'Barbell Lunges',
    es: 'Zancadas con Barra',
    de: 'Ausfallschritte (Langhantel)',
    fr: 'Fentes avec Barre',
  },
  'Búlgaro com Halteres': {
    pt: 'Búlgaro com Halteres',
    en: 'Bulgarian Split Squat',
    es: 'Sentadilla Búlgara con Mancuernas',
    de: 'Bulgarische Kniebeugen',
    fr: 'Fentes Bulgares avec Haltères',
  },
  'Agachamento Goblet': {
    pt: 'Agachamento Goblet',
    en: 'Goblet Squat',
    es: 'Sentadilla Goblet',
    de: 'Goblet Squats',
    fr: 'Goblet Squat',
  },
  'Hack Machine': {
    pt: 'Hack Machine',
    en: 'Hack Machine',
    es: 'Máquina Hack',
    de: 'Hackenschmidt-Maschine',
    fr: 'Hack Machine',
  },

  // ── Pernas / Posterior ──
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
  'Stiff com Halteres': {
    pt: 'Stiff com Halteres',
    en: 'Dumbbell Romanian Deadlift',
    es: 'Peso Muerto Rumano con Mancuernas',
    de: 'Rumänisches Kreuzheben (Kurzhanteln)',
    fr: 'Soulevé de Terre Roumain Haltères',
  },
  'Levantamento Terra Romeno': {
    pt: 'Levantamento Terra Romeno',
    en: 'Romanian Deadlift (RDL)',
    es: 'Peso Muerto Rumano con Barra',
    de: 'Rumänisches Kreuzheben',
    fr: 'Soulevé de Terre Roumain',
  },
  'Curl Deitado na Polia': {
    pt: 'Curl Deitado na Polia',
    en: 'Cable Leg Curl',
    es: 'Curl Femoral en Polea',
    de: 'Beinbeuger am Kabelzug',
    fr: 'Leg Curl à la Poulie',
  },
  'Good Morning': {
    pt: 'Good Morning',
    en: 'Good Morning',
    es: 'Buenos Días con Barra',
    de: 'Good Mornings',
    fr: 'Good Morning Barre',
  },

  // ── Glúteos ──
  'Hip Thrust com Barra': {
    pt: 'Hip Thrust com Barra',
    en: 'Barbell Hip Thrust',
    es: 'Hip Thrust con Barra',
    de: 'Hip Thrust (Langhantel)',
    fr: 'Hip Thrust à la Barre',
  },
  'Hip Thrust com Halteres': {
    pt: 'Hip Thrust com Halteres',
    en: 'Dumbbell Hip Thrust',
    es: 'Hip Thrust con Mancuerna',
    de: 'Hip Thrust (Kurzhantel)',
    fr: 'Hip Thrust avec Haltère',
  },
  'Elevação Pélvica no Solo': {
    pt: 'Elevação Pélvica no Solo',
    en: 'Glute Bridge',
    es: 'Puente de Glúteos en Suelo',
    de: 'Beckenheben (Glute Bridge)',
    fr: 'Pont Fessier au Sol',
  },
  'Abdução de Quadril na Polia': {
    pt: 'Abdução de Quadril na Polia',
    en: 'Cable Hip Abduction',
    es: 'Abducción de Cadera en Polea',
    de: 'Hüftabduktion am Kabelzug',
    fr: 'Abduction de Hanche à la Poulie',
  },
  'Abdução de Quadril na Máquina': {
    pt: 'Abdução de Quadril na Máquina',
    en: 'Machine Hip Abduction',
    es: 'Abducción de Cadera en Máquina',
    de: 'Hüftabduktion an der Maschine',
    fr: 'Abduction à la Machine',
  },
  'Kickback na Polia': {
    pt: 'Kickback na Polia',
    en: 'Cable Glute Kickback',
    es: 'Patada de Glúteo en Polea',
    de: 'Glute Kickbacks am Kabelzug',
    fr: 'Kickback Fessier à la Poulie',
  },
  'Agachamento Sumô': {
    pt: 'Agachamento Sumô',
    en: 'Sumo Squat',
    es: 'Sentadilla Sumo',
    de: 'Sumo-Kniebeuge',
    fr: 'Squat Sumo',
  },
  'Agachamento Sumô com Barra': {
    pt: 'Agachamento Sumô com Barra',
    en: 'Barbell Sumo Squat',
    es: 'Sentadilla Sumo con Barra',
    de: 'Sumo-Kniebeuge mit Langhantel',
    fr: 'Squat Sumo Barre',
  },
  'Donkey Kick': {
    pt: 'Donkey Kick',
    en: 'Donkey Kicks',
    es: 'Patada de Burro (Donkey Kick)',
    de: 'Donkey Kicks',
    fr: 'Donkey Kicks Fessiers',
  },

  // ── Panturrilhas ──
  'Panturrilha em Pé na Máquina': {
    pt: 'Panturrilha em Pé na Máquina',
    en: 'Standing Calf Raise',
    es: 'Elevación de Gemelos de Pie en Máquina',
    de: 'Wadenheben stehend (Maschine)',
    fr: 'Mollets Debout Machine',
  },
  'Panturrilha em Pé': {
    pt: 'Panturrilha em Pé',
    en: 'Standing Calf Raise',
    es: 'Elevación de Gemelos de Pie',
    de: 'Wadenheben stehend',
    fr: 'Mollets Debout',
  },
  'Panturrilha Sentado na Máquina': {
    pt: 'Panturrilha Sentado na Máquina',
    en: 'Seated Calf Raise',
    es: 'Elevación de Gemelos Sentado',
    de: 'Wadenheben sitzend',
    fr: 'Mollets Assis Machine',
  },
  'Panturrilha no Leg Press': {
    pt: 'Panturrilha no Leg Press',
    en: 'Calf Press on Leg Press',
    es: 'Gemelos en Prensa',
    de: 'Wadenheben an der Beinpresse',
    fr: 'Mollets à la Presse',
  },
  'Panturrilha com Halter (unilateral)': {
    pt: 'Panturrilha com Halter (unilateral)',
    en: 'Single-Leg Dumbbell Calf Raise',
    es: 'Elevación de Gemelos con Mancuerna Unilateral',
    de: 'Einbeiniges Wadenheben mit Kurzhantel',
    fr: 'Mollets Unilatéral avec Haltère',
  },
  'Panturrilha no Smith': {
    pt: 'Panturrilha no Smith',
    en: 'Smith Machine Calf Raise',
    es: 'Gemelos en Máquina Smith',
    de: 'Wadenheben an der Multipresse',
    fr: 'Mollets Smith Machine',
  },

  // ── Abdômen ──
  'Abdominal Crunch': {
    pt: 'Abdominal Crunch',
    en: 'Ab Crunch',
    es: 'Crunch Abdominal',
    de: 'Bauch-Crunches',
    fr: 'Crunch Abdominal',
  },
  'Abdominal na Polia': {
    pt: 'Abdominal na Polia',
    en: 'Cable Crunch',
    es: 'Crunch en Polea Alta',
    de: 'Kabel-Crunches',
    fr: 'Crunch à la Poulie Haute',
  },
  'Elevação de Pernas': {
    pt: 'Elevação de Pernas',
    en: 'Hanging Leg Raise',
    es: 'Elevación de Piernas Colgado',
    de: 'Beinheben hängend',
    fr: 'Relevé de Jambes Suspendu',
  },
  'Prancha (Plank)': {
    pt: 'Prancha (Plank)',
    en: 'Plank',
    es: 'Plancha Abdominal',
    de: 'Unterarmstütz (Plank)',
    fr: 'Gainage Planche',
  },
  'Russian Twist': {
    pt: 'Russian Twist',
    en: 'Russian Twist',
    es: 'Giro Ruso (Russian Twist)',
    de: 'Russian Twist',
    fr: 'Russian Twist',
  },
  'Abdominal Oblíquo': {
    pt: 'Abdominal Oblíquo',
    en: 'Oblique Crunch',
    es: 'Crunch para Oblicuos',
    de: 'Seitliche Crunches (Schräg)',
    fr: 'Crunch Oblique',
  },
  'Roda Abdominal (Ab Wheel)': {
    pt: 'Roda Abdominal (Ab Wheel)',
    en: 'Ab Wheel Rollout',
    es: 'Rueda Abdominal (Ab Wheel)',
    de: 'Ab Roller Rollout',
    fr: 'Roue Abdominale (Ab Wheel)',
  },
  'V-Sit': {
    pt: 'V-Sit',
    en: 'V-Up / V-Sit',
    es: 'V-Ups Abdominales',
    de: 'V-Ups',
    fr: 'V-Ups Abdominaux',
  },
  'Dead Bug': {
    pt: 'Dead Bug',
    en: 'Dead Bug',
    es: 'Dead Bug Abdominal',
    de: 'Dead Bug',
    fr: 'Dead Bug',
  },
  'Mountain Climber': {
    pt: 'Mountain Climber',
    en: 'Mountain Climbers',
    es: 'Escaladores (Mountain Climbers)',
    de: 'Mountain Climbers',
    fr: 'Mountain Climbers',
  },

  // ── Cardio / Funcional ──
  'Burpee': {
    pt: 'Burpee',
    en: 'Burpees',
    es: 'Burpees',
    de: 'Burpees',
    fr: 'Burpees',
  },
  'Kettlebell Swing': {
    pt: 'Kettlebell Swing',
    en: 'Kettlebell Swings',
    es: 'Swings con Kettlebell',
    de: 'Kettlebell Swings',
    fr: 'Kettlebell Swings',
  },
  'Clean com Barra': {
    pt: 'Clean com Barra',
    en: 'Barbell Power Clean',
    es: 'Cargada con Barra (Power Clean)',
    de: 'Power Clean (Langhantel)',
    fr: 'Power Clean Barre',
  },
  'Jumping Jack': {
    pt: 'Jumping Jack',
    en: 'Jumping Jacks',
    es: 'Saltos de Tijera (Jumping Jacks)',
    de: 'Hampelmänner (Jumping Jacks)',
    fr: 'Jumping Jacks',
  },
  'Pular Corda': {
    pt: 'Pular Corda',
    en: 'Jump Rope',
    es: 'Salto a la Comba',
    de: 'Seilspringen',
    fr: 'Saut à la Corde',
  },
};

/**
 * Índice reverso / multilíngue para garantir tradução bidirecional.
 * Mapeia o nome normalizado em QUALQUER uma das 5 línguas para a entrada correta.
 */
const NORMALIZED_EXERCISE_INDEX = new Map<string, Record<Language, string>>();

for (const [, langMap] of Object.entries(EXERCISE_NAMES_MAP)) {
  for (const lang of ['pt', 'en', 'es', 'de', 'fr'] as Language[]) {
    const val = langMap[lang];
    if (val) {
      NORMALIZED_EXERCISE_INDEX.set(normalizeKey(val), langMap);
    }
  }
}

const NORMALIZED_MUSCLE_INDEX = new Map<string, Record<Language, string>>();

for (const [, langMap] of Object.entries(MUSCLE_MAP)) {
  for (const lang of ['pt', 'en', 'es', 'de', 'fr'] as Language[]) {
    const val = langMap[lang];
    if (val) {
      NORMALIZED_MUSCLE_INDEX.set(normalizeKey(val), langMap);
    }
  }
}

const NORMALIZED_EQUIPMENT_INDEX = new Map<string, Record<Language, string>>();

for (const [, langMap] of Object.entries(EQUIPMENT_MAP)) {
  for (const lang of ['pt', 'en', 'es', 'de', 'fr'] as Language[]) {
    const val = langMap[lang];
    if (val) {
      NORMALIZED_EQUIPMENT_INDEX.set(normalizeKey(val), langMap);
    }
  }
}

/**
 * Traduz o grupo muscular (suporta compostos como "Pernas / Quadríceps").
 */
export function translateMuscleGroup(rawGroup: string, lang: Language): string {
  if (!rawGroup) return rawGroup;

  // Se houver barra (ex: "Pernas / Quadríceps", "Ombros / Trapézio")
  if (rawGroup.includes('/')) {
    const parts = rawGroup.split('/').map((p) => p.trim());
    return parts
      .map((part) => {
        const norm = normalizeKey(part);
        const match = NORMALIZED_MUSCLE_INDEX.get(norm);
        return match ? match[lang] : part;
      })
      .join(' / ');
  }

  const norm = normalizeKey(rawGroup);
  const match = NORMALIZED_MUSCLE_INDEX.get(norm);
  return match ? match[lang] : rawGroup;
}

/**
 * Traduz o nome do exercício em qualquer direção (pt <-> en <-> es <-> de <-> fr).
 */
export function translateExerciseName(rawName: string, lang: Language): string {
  if (!rawName) return rawName;

  const norm = normalizeKey(rawName);
  const match = NORMALIZED_EXERCISE_INDEX.get(norm);
  if (match) {
    return match[lang] || match.en || rawName;
  }

  return rawName;
}

/**
 * Traduz o tipo de equipamento.
 */
export function translateEquipment(rawEquipment: string, lang: Language): string {
  if (!rawEquipment) return rawEquipment;

  const norm = normalizeKey(rawEquipment);
  const match = NORMALIZED_EQUIPMENT_INDEX.get(norm);
  if (match) {
    return match[lang] || match.en || rawEquipment;
  }

  return rawEquipment;
}

/**
 * Traduz nomes de rotinas/fichas padrão.
 */
export function translateRoutineName(rawName: string, lang: Language): string {
  if (!rawName) return rawName;
  const match = ROUTINES_MAP[rawName];
  if (match && match[lang]) return match[lang];
  return rawName;
}

/**
 * Traduz descrições de rotinas/fichas padrão.
 */
export function translateRoutineDescription(rawDesc: string, lang: Language): string {
  if (!rawDesc) return rawDesc;
  const match = ROUTINES_DESC_MAP[rawDesc];
  if (match && match[lang]) return match[lang];
  return rawDesc;
}
