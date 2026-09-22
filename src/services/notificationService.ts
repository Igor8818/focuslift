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

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

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
    const title = '💪 Hora de Voltar!';
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
