/**
 * notificationService.ts
 *
 * Serviço centralizado para gerenciar notificações locais do FocusLift.
 * Responsável por:
 *  - Solicitar permissões ao usuário (iOS e Android 13+)
 *  - Criar o canal Android de alta prioridade para o timer de descanso
 *  - Agendar notificações de fim de descanso com som e alerta
 *  - Cancelar notificações pendentes (pular descanso / reagendar)
 *
 * COMPATIBILIDADE:
 *  - SDK 53+ removeu notificações push remotas do Expo Go.
 *  - Este serviço detecta o ambiente e faz graceful degradation: o timer e
 *    a vibração continuam funcionando normalmente; apenas a notificação
 *    local é desabilitada ao rodar no Expo Go.
 *  - Em development build ou produção, tudo funciona normalmente.
 */

import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// ─── Detecção de Ambiente ───────────────────────────────────────────────────────

/**
 * Retorna true quando o app está rodando dentro do Expo Go (storeClient).
 * Nesse ambiente, expo-notifications não suporta notificações locais no Android (SDK 53+).
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

/** ID do canal Android para notificações de descanso. */
export const REST_TIMER_CHANNEL_ID = 'focuslift-rest-timer';

// Armazena o identifier da última notificação agendada em memória.
// Como só existe uma sessão de treino ativa por vez, uma variável em módulo é suficiente.
let _scheduledNotificationId: string | null = null;

// ─── Configuração do Handler de Foreground ─────────────────────────────────────

/**
 * Define como as notificações devem ser exibidas quando o app está em foreground.
 * Em foreground, exibimos o banner + toca o som para que o usuário perceba
 * mesmo sem sair da tela de treino.
 *
 * Executado apenas fora do Expo Go para evitar crash no SDK 53+.
 */
try {
  if (!isExpoGo()) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  // Silencioso — app funciona sem notificações no Expo Go
}

// ─── Configuração do Canal Android ────────────────────────────────────────────

/**
 * Cria (ou atualiza) o canal de notificação no Android com prioridade máxima.
 * Deve ser chamado uma vez antes de qualquer agendamento.
 * No iOS ou Expo Go, esta função é um no-op.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || isExpoGo()) return;

  try {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: 'Timer de Descanso',
      description: 'Alertas de fim de descanso durante a sessão de treino',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 100, 250],
      lightColor: '#7C3AED',
      enableLights: true,
      enableVibrate: true,
      showBadge: false,
    });
  } catch (err) {
    // Canal não é crítico — falha silenciosa para não bloquear a sessão
    console.warn('[notificationService] Falha ao criar canal Android:', err);
  }
}

// ─── Permissões ────────────────────────────────────────────────────────────────

/**
 * Solicita permissão de notificação ao usuário.
 *
 * @returns `true` se a permissão foi concedida, `false` caso contrário.
 *          O app funciona normalmente em ambos os casos (graceful degradation).
 *          No Expo Go (SDK 53+), retorna false sem tentar para evitar crash.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  // Expo Go não suporta notificações locais no Android desde o SDK 53
  if (isExpoGo()) {
    console.info('[notificationService] Expo Go detectado — notificações desabilitadas. Use um Development Build para notificações.');
    return false;
  }

  try {
    await setupNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync({
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
 * Cancela qualquer notificação de descanso previamente agendada antes de criar a nova.
 *
 * No Expo Go, retorna null silenciosamente (o timer visual e a vibração ainda funcionam).
 *
 * @param exerciseName - Nome do exercício para exibir no corpo da notificação.
 * @param secondsFromNow - Quantos segundos até o disparo (deve ser > 0).
 * @returns O identifier da notificação agendada, ou `null` em caso de falha/Expo Go.
 */
export async function scheduleRestNotification(
  exerciseName: string,
  secondsFromNow: number,
): Promise<string | null> {
  if (secondsFromNow <= 0 || isExpoGo()) return null;

  await cancelRestNotification();

  try {
    const title = '💪 Hora de Voltar!';
    const body = exerciseName
      ? `Descanso do ${exerciseName} concluído. Próxima série te espera!`
      : 'Seu descanso acabou. Vamos para a próxima série!';

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: 'rest-timer' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
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
 * Deve ser chamado ao:
 *  - Usuário pressionar "Pular"
 *  - Ajustar o tempo (+30s / -15s) — cancela e a chamada de reagendamento recria
 *  - Componente ser desmontado (unmount da sessão de treino)
 */
export async function cancelRestNotification(): Promise<void> {
  if (!_scheduledNotificationId || isExpoGo()) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(_scheduledNotificationId);
  } catch (err) {
    // Ignora — pode acontecer se a notificação já disparou ou foi descartada
    console.warn('[notificationService] Falha ao cancelar notificação:', err);
  } finally {
    _scheduledNotificationId = null;
  }
}

/**
 * Retorna o identifier da notificação de descanso atualmente agendada.
 * Útil para debugging e testes.
 */
export function getScheduledNotificationId(): string | null {
  return _scheduledNotificationId;
}
