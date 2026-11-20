/**
 * notificationService.ts
 *
 * Serviço centralizado para gerenciar notificações locais do FocusLift.
 *
 * COMPATIBILIDADE COM EXPO GO (SDK 53+):
 *  O SDK 53 removeu notificações do Expo Go (Android). Qualquer `import` estático
 *  de 'expo-notifications' inicializa o módulo nativo e crasha o app.
 *  Solução: lazy `require()` dentro das funções — o módulo nativo nunca é
 *  carregado em Expo Go porque o código que o requer nunca é executado.
 *
 *  Em Development Build ou produção, tudo funciona normalmente.
 *  No Expo Go, o timer visual e a vibração continuam funcionando; apenas a
 *  notificação local em background é desabilitada silenciosamente.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { ParsedDietMeal } from '../utils/dietTextParser';

// ─── Detecção de Ambiente ───────────────────────────────────────────────────────

/**
 * `true` quando rodando dentro do Expo Go.
 * Avaliado uma vez ao carregar o módulo (síncrono, sem side effects nativos).
 */
const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Constantes ────────────────────────────────────────────────────────────────

/** ID do canal Android para notificações de descanso. */
export const REST_TIMER_CHANNEL_ID = 'focuslift-rest-timer';
export const DIET_REMINDER_CHANNEL_ID = 'focuslift-diet-reminders';
const STORAGE_DIET_REMINDER_IDS = '@focuslift_diet_reminder_ids';
export const STORAGE_DIET_REMINDERS_ENABLED = '@focuslift_diet_reminders_enabled';

// Armazena o identifier da última notificação agendada em memória.
let _scheduledNotificationId: string | null = null;

// ─── Helper: require lazy ──────────────────────────────────────────────────────

/**
 * Retorna o módulo expo-notifications carregado sob demanda.
 * Nunca é chamado em Expo Go, portanto o módulo nativo nunca é inicializado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function notif(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// ─── Setup do Handler de Foreground ─────────────────────────────────────────────

/**
 * Configura como notificações aparecem enquanto o app está em foreground.
 * Deve ser chamado uma vez no boot do app (ex: App.tsx), fora do Expo Go.
 */
export function setupForegroundNotificationHandler(): void {
  if (IS_EXPO_GO) return;
  try {
    notif().setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('[notificationService] Falha ao configurar handler de foreground:', err);
  }
}

// ─── Configuração do Canal Android ────────────────────────────────────────────

/**
 * Cria o canal de notificação no Android com prioridade máxima.
 * No-op no iOS ou Expo Go.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || IS_EXPO_GO) return;
  try {
    await notif().setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: 'Timer de Descanso',
      description: 'Alertas de fim de descanso durante a sessão de treino',
      importance: notif().AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 100, 250],
      lightColor: '#7C3AED',
      enableLights: true,
      enableVibrate: true,
      showBadge: false,
    });
  } catch (err) {
    console.warn('[notificationService] Falha ao criar canal Android:', err);
  }
}

// ─── Permissões ────────────────────────────────────────────────────────────────

/**
 * Solicita permissão de notificação ao usuário.
 * Retorna `false` silenciosamente no Expo Go (sem crash).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_EXPO_GO) {
    console.info(
      '[notificationService] Expo Go — notificações em background desabilitadas. ' +
      'Use um Development Build para ativá-las.',
    );
    return false;
  }

  try {
    await setupNotificationChannel();

    const { status: existingStatus } = await notif().getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await notif().requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
        allowCriticalAlerts: false,
      },
    });

    return status === 'granted';
  } catch (err) {
    console.warn('[notificationService] Falha ao solicitar permissões:', err);
    return false;
  }
}

// ─── Agendamento ───────────────────────────────────────────────────────────────

/**
 * Agenda uma notificação local para disparar após `secondsFromNow` segundos.
 * No Expo Go, retorna `null` silenciosamente.
 */
export async function scheduleRestNotification(
  exerciseName: string,
  secondsFromNow: number,
): Promise<string | null> {
  if (secondsFromNow <= 0 || IS_EXPO_GO) return null;

  await cancelRestNotification();

  try {
    const N = notif();
    const title = 'Hora de Voltar!';
    const body = exerciseName
      ? `Descanso do ${exerciseName} concluído. Próxima série te espera!`
      : 'Seu descanso acabou. Vamos para a próxima série!';

    const id = await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: N.AndroidNotificationPriority.MAX,
        data: { type: 'rest-timer' },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
      },
    });

    _scheduledNotificationId = id;
    return id;
  } catch (err) {
    console.warn('[notificationService] Falha ao agendar notificação:', err);
    return null;
  }
}

// ─── Cancelamento ──────────────────────────────────────────────────────────────

/**
 * Cancela a notificação de descanso pendente, se houver.
 * No-op no Expo Go.
 */
export async function cancelRestNotification(): Promise<void> {
  if (!_scheduledNotificationId || IS_EXPO_GO) return;

  try {
    await notif().cancelScheduledNotificationAsync(_scheduledNotificationId);
  } catch (err) {
    console.warn('[notificationService] Falha ao cancelar notificação:', err);
  } finally {
    _scheduledNotificationId = null;
  }
}

/**
 * Retorna o identifier da notificação de descanso atualmente agendada.
 */
export function getScheduledNotificationId(): string | null {
  return _scheduledNotificationId;
}

// ─── Lembretes Diários de Refeição ──────────────────────────────────────────

async function setupDietReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android' || IS_EXPO_GO) return;
  try {
    await notif().setNotificationChannelAsync(DIET_REMINDER_CHANNEL_ID, {
      name: 'Lembretes de Refeição',
      description: 'Alertas nos horários das refeições do seu plano alimentar',
      importance: notif().AndroidImportance.HIGH,
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: false,
    });
  } catch (err) {
    console.warn('[notificationService] Falha ao criar canal de dieta:', err);
  }
}

export async function areDietRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_DIET_REMINDERS_ENABLED)) === 'true';
  } catch {
    return false;
  }
}

export async function cancelDietMealReminders(): Promise<void> {
  try {
    if (!IS_EXPO_GO) {
      const rawIds = await AsyncStorage.getItem(STORAGE_DIET_REMINDER_IDS);
      if (rawIds) {
        const ids: string[] = JSON.parse(rawIds);
        for (const id of ids) {
          try {
            await notif().cancelScheduledNotificationAsync(id);
          } catch {}
        }
      }
    }
  } catch {}
  await AsyncStorage.multiRemove([STORAGE_DIET_REMINDER_IDS, STORAGE_DIET_REMINDERS_ENABLED]).catch(() => {});
}

export async function scheduleDietMealReminders(meals: ParsedDietMeal[]): Promise<number> {
  if (IS_EXPO_GO) return 0;

  const granted = await requestNotificationPermission();
  if (!granted) return 0;

  await setupDietReminderChannel();
  await cancelDietMealReminders();

  const N = notif();
  const scheduledIds: string[] = [];

  for (const meal of meals) {
    if (!meal.time || meal.isWorkoutSlot) continue;
    const match = meal.time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;

    try {
      const id = await N.scheduleNotificationAsync({
        content: {
          title: `${meal.time} • ${meal.title}`,
          body: 'Hora da refeição! Abra o FocusLift para marcar no seu plano alimentar.',
          sound: 'default',
          data: { type: 'diet-reminder', mealId: meal.id },
          ...(Platform.OS === 'android' ? { channelId: DIET_REMINDER_CHANNEL_ID } : {}),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      if (id) scheduledIds.push(id);
    } catch (err) {
      console.warn('[notificationService] Falha ao agendar refeição:', meal.time, err);
    }
  }

  await AsyncStorage.multiSet([
    [STORAGE_DIET_REMINDER_IDS, JSON.stringify(scheduledIds)],
    [STORAGE_DIET_REMINDERS_ENABLED, scheduledIds.length > 0 ? 'true' : 'false'],
  ]).catch(() => {});

  return scheduledIds.length;
}
