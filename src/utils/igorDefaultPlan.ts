/**
 * igorDefaultPlan.ts
 *
 * Dados padrão do atleta (conta local offline-first, plano alimentar Cutting e
 * divisão semanal completa de 7 dias) e rotina idempotente de inicialização no boot.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createRoutine,
  deleteRoutine,
  getActiveDietPlan,
  getRoutines,
  saveDietPlan,
  updateRoutine,
} from '../database/db';
import { parseDietText } from './dietTextParser';
import { parseWorkoutText } from './workoutTextParser';

export const IGOR_SEEDED_FLAG_KEY = '@focuslift_igor_seeded_v1';
const IGOR_ROUTINE_META_FLAG_KEY = '@focuslift_igor_routine_meta_v2';

const STORAGE_USER_KEY = '@focuslift_auth_user';
const STORAGE_LOCAL_ACCOUNTS_KEY = '@focuslift_local_accounts';
const STORAGE_SUBSCRIPTION_PLAN_KEY = '@focuslift_subscription_plan';
const STORAGE_OFFLINE_MODE_KEY = '@focuslift_offline_mode';
const STORAGE_ONBOARDING_DONE_KEY = '@focuslift_onboarding_done';

export const IGOR_DEFAULT_ACCOUNT = {
  uid: '1',
  id: 1,
  email: 'igor.senna2@hotmail.com',
  name: 'Igor Senna',
  role: 'PRO',
} as const;

export const IGOR_DEFAULT_DIET_TEXT = `PLANO ALIMENTAR - CUTTING
Meta Seg a Sex: ~2.200 kcal | ~175-180g Prot | ~228g Carb | ~65g Gord (já contando preparo)
Meta Sáb e Dom: ~2.750 kcal | ~185g Prot (manter refeições base + 1 refeição livre controlada)
Água: 4 litros/dia

09:00 - CAFÉ DA MANHÃ
- 3 ovos inteiros (mexidos ou cozidos)
- 100g cuscuz cozido (ou 2 fatias de pão de forma / 1 pão francês)
- Café preto (puro ou com adoçante)
*Opção p/ variar: 2 ovos + 40g frango desfiado (ou 30g queijo minas frescal)

12:00 - PRÉ-TREINO (1h30 antes do treino)
- 40g Whey Concentrado 70%
- 250ml leite desnatado
- 40g aveia em flocos
- 1 banana média (80g)

13:30 - TREINO + CARDIO
- 500ml a 1L de água durante o treino

15:30 - ALMOÇO (PÓS-TREINO)
Base fixa:
- 200g arroz cozido
- 150g feijão cozido
- Salada à vontade
Proteína (escolher 1 opção - peso pronto):
- 140-150g peito de frango (grelhado, desfiado ou ensopado)
- 140-150g carne bovina magra (patinho, coxão mole/duro, músculo, carne moída)
- 140g carne suína magra (lombo ou bisteca sem capa de gordura)
- 150g sobrecoxa/coxa de frango sem pele e sem osso
- 120g carne mais gorda (acém, pernil, carne assada -> reduzir arroz p/ 170g)
- Plano B (pouca carne): 80-100g de carne/frango + 2 ovos inteiros
- Plano C (sem carne): 4 ovos + 30g queijo minas (ou 5 ovos + 10g extra de Whey na ceia)

19:30 - JANTAR
Base fixa (escolher 1 carboidrato):
- 120g cuscuz cozido (ou 120g arroz / 180g batata cozida ou airfryer / 110g aipim / 2 fatias pão de forma + 1 fruta pequena)
- Legumes/salada à vontade
Proteína (escolher 1 opção - peso pronto):
- 100-120g peito de frango + 20g requeijão light
- 100-120g carne magra ou moída
- 110g lombo ou bisteca suína magra
- 110-120g sobrecoxa/coxa sem pele e sem osso
- Misto (resto do almoço): 60g frango/carne + 2 ovos inteiros
- Plano B (sem carne): 3 ovos inteiros + 20g requeijão light (ou 30g queijo minas)

22:00 - CEIA (MOUSSE PROTEICO)
- 30g Whey Concentrado 70% (*pode baixar p/ 20g se comeu carne magra no almoço e jantar)
- 170g iogurte natural desnatado
- 30g leite em pó desnatado

REGRAS RÁPIDAS
- Conversão: 1 ovo inteiro ≈ 20-25g de carne/frango pronto
- Preparo: escorrer excesso de caldo/óleo da panela e usar mínimo de óleo nos ovos
- Fim de semana: zero calorias líquidas (ir de água com gás/limão ou refri zero), não pular refeições proteicas antes de sair e manter apenas 1 refeição livre`;

export const IGOR_DEFAULT_WORKOUT_TEXT = `SEGUNDA-FEIRA: Push (Peito, Ombro e Tríceps)
- Crucifixo Máquina (Peck Deck) ou Crossover Polia Alta (de cima p/ baixo) | 2 prep + 2x 10-12
- Supino Inclinado com Halteres | 2 prep + 2x 6-8
- Supino Reto Articulado (Máquina) | 2x 8-10
- Desenvolvimento Sentado na Máquina (ou Halteres) | 2x 8-10
- Elevação Lateral com Halteres | 3x 12-15
- Tríceps Francês Unilateral na Polia (ou Halter) | 3x 10-12
- Cardio: 20-25 min caminhada inclinada (ou 10 min corda + 15 min caminhada)

TERÇA-FEIRA: Pull (Costas, Posterior de Ombro e Bíceps)
- Puxada Alta Pegada Neutra (ou Articulada) | 2 prep + 2x 8-10
- Remada Cavalinho (T-Bar) com Apoio no Peito | 2 prep + 2x 8-10
- Puxada Alta Unilateral na Polia | 2x 10-12
- Remada Baixa Unilateral na Polia (Pegada Neutra/Pronada) | 2x 10-12
- Peck Deck Inverso (Crucifixo Inverso na Máquina) | 3x 12-15
- Rosca Inclinada com Halteres (Banco 45°) | 3x 10-12
- Cardio: 20-25 min caminhada inclinada (ou 10 min corda + 15 min caminhada)

QUARTA-FEIRA: Pernas e Core
- Mesa Flexora | 2 prep + 2x 10-12
- Agachamento Hack (ou Smith) | 2 prep + 2x 6-8
- Stiff com Halteres | 2x 8-10
- Cadeira Extensora | 2x 12-15 (dropset na última)
- Panturrilha em Pé na Máquina / Smith | 3x 12-15 (pausa 2s no topo)
- Abdominal Supra na Polia (Crunch com Corda) | 3x 12-15
- Cardio: 15-20 min caminhada leve

QUINTA-FEIRA: Descanso (Cardio)
- Cardio: 45-50 min caminhada acelerada (ou futebol)

SEXTA-FEIRA: Upper Body (Estética, Costas e Peito Superior)
- Crucifixo Inclinado na Polia (polia baixa p/ cima) | 2 prep + 2x 10-12
- Puxada Alta Pronada (Barra Aberta) | 2 prep + 2x 8-10
- Remada na Máquina com Apoio no Peito (ou Remada Serrote) | 2x 8-10
- Supino Inclinado na Máquina (ou Convergente) | 2x 8-10
- Encolhimento com Halteres (ou Smith) | 3x 12-15
- Cardio: 20-25 min caminhada inclinada (ou 10 min corda + 15 min caminhada)

SÁBADO: Ombros, Braços, Core e Cardio
- Elevação Lateral na Polia (cabo por trás do corpo) | 4x 12-15
- Face Pull na Polia com Corda | 3x 12-15
- Rosca Scott (Máquina ou Barra W) | 2x 8-10
- Rosca Martelo com Halteres (ou Polia com Corda) | 2x 10-12
- Tríceps Testa na Polia com Corda | 2x 10-12
- Tríceps Pulley (Barra V ou Reta) | 2x 10-12
- Elevação de Pernas (Paralela ou Pendurado) | 3x 10-15
- Cardio: 45 min caminhada rápida/inclinada

DOMINGO: Cardio Livre
- Cardio: 45-50 min caminhada ao ar livre`;

const GENERIC_STARTER_NAMES = new Set([
  'push a - peito, ombro e tríceps',
  'pull b - costas e bíceps',
  'legs c - membros inferiores',
  'push (peito, ombro e tríceps)',
  'upper body a',
  'full body a',
]);

function isGenericStarterRoutine(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (GENERIC_STARTER_NAMES.has(normalized)) return true;
  return (
    normalized.startsWith('push a •') ||
    normalized.startsWith('upper a •') ||
    normalized.startsWith('full body •')
  );
}

/**
 * Executa uma única vez no primeiro boot: ativa modo offline/PRO, garante a conta
 * local do atleta, substitui fichas genéricas iniciais pela divisão de 7 dias e
 * carrega o Plano Alimentar Cutting caso ainda não exista dieta ativa.
 */
export async function ensureIgorProfileAndPlansSeeded(): Promise<void> {
  try {
    const alreadySeeded = await AsyncStorage.getItem(IGOR_SEEDED_FLAG_KEY);
    if (alreadySeeded !== 'true') {
      await AsyncStorage.multiSet([
        [STORAGE_ONBOARDING_DONE_KEY, 'true'],
        [STORAGE_OFFLINE_MODE_KEY, 'true'],
      ]);

      const currentPlan = await AsyncStorage.getItem(STORAGE_SUBSCRIPTION_PLAN_KEY);
      if (!currentPlan || currentPlan === 'free') {
        await AsyncStorage.setItem(STORAGE_SUBSCRIPTION_PLAN_KEY, 'annual');
      }

      const storedUserRaw = await AsyncStorage.getItem(STORAGE_USER_KEY);
      if (!storedUserRaw) {
        await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(IGOR_DEFAULT_ACCOUNT));
      }

      try {
        const accountsRaw = await AsyncStorage.getItem(STORAGE_LOCAL_ACCOUNTS_KEY);
        const accounts: Record<string, any> = accountsRaw ? JSON.parse(accountsRaw) : {};
        const emailKey = IGOR_DEFAULT_ACCOUNT.email.toLowerCase();
        if (!accounts[emailKey]) {
          accounts[emailKey] = {
            ...IGOR_DEFAULT_ACCOUNT,
            passwordHash: '',
            passwordSalt: '',
          };
          await AsyncStorage.setItem(STORAGE_LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
        } else if ('password' in accounts[emailKey] && !accounts[emailKey].password) {
          delete accounts[emailKey].password;
          accounts[emailKey].passwordHash = accounts[emailKey].passwordHash || '';
          accounts[emailKey].passwordSalt = accounts[emailKey].passwordSalt || '';
          await AsyncStorage.setItem(STORAGE_LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
        }
      } catch {
        // Não bloqueia boot se JSON de contas locais estiver corrompido
      }

      try {
        const existingRoutines = await getRoutines();
        const shouldSeedWorkouts =
          existingRoutines.length === 0 ||
          existingRoutines.every((r) => isGenericStarterRoutine(r.name));

        if (shouldSeedWorkouts) {
          for (const old of existingRoutines) {
            await deleteRoutine(old.id);
          }
          const parsedRoutines = parseWorkoutText(IGOR_DEFAULT_WORKOUT_TEXT);
          for (const routine of parsedRoutines) {
            if (routine.exercises.length === 0) continue;
            await createRoutine({
              name: routine.name,
              description: routine.description,
              color: routine.color,
              exercises: routine.exercises.map((ex, idx) => ({
                exercise_name: ex.name,
                muscle_group: ex.muscleGroup,
                target_sets: ex.targetSets,
                target_reps: ex.targetReps,
                warmup_sets: ex.warmupSets ?? 0,
                notes: ex.notes ?? null,
                rest_timer_seconds: ex.restTimerSeconds,
                order_index: idx,
              })),
            });
          }
          await AsyncStorage.setItem(IGOR_ROUTINE_META_FLAG_KEY, 'true');
        }
      } catch (e) {
        console.warn('Falha ao semear fichas padrão do Igor:', e);
      }

      try {
        const activeDiet = await getActiveDietPlan();
        if (!activeDiet) {
          const parsedDiet = parseDietText(IGOR_DEFAULT_DIET_TEXT);
          await saveDietPlan(parsedDiet, IGOR_DEFAULT_DIET_TEXT, true);
        }
      } catch (e) {
        console.warn('Falha ao semear dieta padrão do Igor:', e);
      }

      await AsyncStorage.setItem(IGOR_SEEDED_FLAG_KEY, 'true');
    }

    // Enriquece fichas já semeadas em v1 com target_reps, warmup_sets e notes sem apagar histórico
    const metaSynced = await AsyncStorage.getItem(IGOR_ROUTINE_META_FLAG_KEY);
    if (metaSynced !== 'true') {
      try {
        const currentRoutines = await getRoutines();
        const parsedDefaults = parseWorkoutText(IGOR_DEFAULT_WORKOUT_TEXT);
        for (const existing of currentRoutines) {
          const needsMeta = existing.exercises.some(
            (ex) => !ex.target_reps && !ex.notes && (ex.warmup_sets ?? 0) === 0
          );
          if (!needsMeta) continue;

          const matchedRoutine = parsedDefaults.find(
            (p) => p.name.trim().toLowerCase() === existing.name.trim().toLowerCase()
          );
          if (!matchedRoutine) continue;

          await updateRoutine({
            id: existing.id,
            exercises: existing.exercises.map((ex, idx) => {
              const parsedEx =
                matchedRoutine.exercises.find(
                  (pe) => pe.name.trim().toLowerCase() === ex.exercise_name.trim().toLowerCase()
                ) || matchedRoutine.exercises[idx];
              return {
                exercise_name: ex.exercise_name,
                muscle_group: ex.muscle_group,
                target_sets: ex.target_sets,
                target_reps: ex.target_reps ?? parsedEx?.targetReps ?? null,
                warmup_sets: ex.warmup_sets ?? parsedEx?.warmupSets ?? 0,
                notes: ex.notes ?? parsedEx?.notes ?? null,
                rest_timer_seconds: ex.rest_timer_seconds,
                order_index: ex.order_index ?? idx,
              };
            }),
          });
        }
        await AsyncStorage.setItem(IGOR_ROUTINE_META_FLAG_KEY, 'true');
      } catch (e) {
        console.warn('Falha ao atualizar metadados das fichas:', e);
      }
    }
  } catch (err) {
    console.warn('Erro ao inicializar dados padrão do FocusLift:', err);
  }
}
