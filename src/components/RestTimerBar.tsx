import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface RestTimerBarProps {
  secondsLeft: number;
  totalSeconds: number;
  exerciseName?: string;
  isActive: boolean;
  isFinished?: boolean;
  onAddSeconds: (seconds: number) => void;
  onSkip: () => void;
}

/**
 * Formata segundos em MM:SS (ex.: 01:30)
 */
function formatTimerSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  secondsLeft,
  totalSeconds,
  exerciseName,
  isActive,
  isFinished = false,
  onAddSeconds,
  onSkip,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  if (!isActive && !isFinished && secondsLeft <= 0) {
    return null;
  }

  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const finishedState = isFinished || secondsLeft === 0;

  return (
    <View style={[styles.container, finishedState && styles.containerFinished]}>
      {/* Barra de progresso superior */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress * 100}%` },
            isFinished && { backgroundColor: colors.success },
          ]}
        />
      </View>

      <View style={styles.contentRow}>
        {/* Lado Esquerdo: Tempo & Exercício */}
        <View style={styles.timeInfo}>
          <Text style={styles.timerBadge}>⏱️ DESCANSO</Text>
          <Text style={[styles.timeText, finishedState && styles.timeTextFinished]}>
            {finishedState ? 'Pronto! 💪' : formatTimerSeconds(secondsLeft)}
          </Text>
          {exerciseName ? (
            <Text style={styles.exerciseNameText} numberOfLines={1}>
              {exerciseName}
            </Text>
          ) : null}
        </View>

        {/* Lado Direito: Ações Rápidas */}
        <View style={styles.actionsRow}>
          {!finishedState ? (
            <>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onAddSeconds(30)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+30s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => onAddSeconds(-15)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>-15s</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.skipBtn, finishedState && styles.finishBtn]}
            onPress={onSkip}
            activeOpacity={0.8}
          >
            <Text style={[styles.skipBtnText, finishedState && styles.finishBtnText]}>
              {finishedState ? 'Continuar' : 'Pular'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    paddingBottom: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  containerFinished: {
    borderTopColor: colors.success,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfo: {
    flex: 1,
  },
  timerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timeTextFinished: {
    color: colors.success,
    fontSize: 20,
  },
  exerciseNameText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: colors.surfaceBorder,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  adjustBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  skipBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  finishBtn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  finishBtnText: {
    color: '#0A0D14',
    fontWeight: '900',
  },
});
}

