import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

export interface RestTimerBarProps {
  secondsLeft: number;
  totalSeconds: number;
  exerciseName?: string;
  isActive: boolean;
  isFinished?: boolean;
  onAddSeconds: (seconds: number) => void;
  onSkip: () => void;
  bottomOffset?: number;
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
  bottomOffset,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const computedBottom = bottomOffset ?? (56 + Math.max(insets.bottom, 10) + 10);
  const styles = makeStyles(colors, computedBottom);

  const shouldRender = isActive || isFinished || secondsLeft > 0;
  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animação suave e fluida de entrada e saída (Spring + Fade)
  useEffect(() => {
    if (shouldRender) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 5,
          speed: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 80,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shouldRender, slideAnim, opacityAnim]);

  // Animação de pulso quando o tempo termina
  const finishedState = isFinished || (secondsLeft === 0 && isActive);
  useEffect(() => {
    if (finishedState) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 6 }
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [finishedState, pulseAnim]);

  if (!shouldRender) {
    return null;
  }

  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;

  const handlePressAdd = (seconds: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onAddSeconds(seconds);
  };

  const handlePressSkip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onSkip();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        finishedState && styles.containerFinished,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Barra de progresso integrada no topo da cápsula */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress * 100}%` },
            finishedState && { backgroundColor: colors.success },
          ]}
        />
      </View>

      <View style={styles.contentRow}>
        {/* Lado Esquerdo: Tempo & Exercício */}
        <View style={styles.timeInfo}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusDot, finishedState && { backgroundColor: colors.success }]} />
            <Text style={[styles.timerBadge, finishedState && { color: colors.success }]}>
              {finishedState ? 'TEMPO ESGOTADO' : 'DESCANSO'}
            </Text>
          </View>

          <Animated.Text
            style={[
              styles.timeText,
              finishedState && styles.timeTextFinished,
              { transform: [{ scale: finishedState ? pulseAnim : 1 }] },
            ]}
          >
            {finishedState ? 'Pronto! 💪' : formatTimerSeconds(secondsLeft)}
          </Animated.Text>

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
                onPress={() => handlePressAdd(30)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>+30s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handlePressAdd(-15)}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustBtnText}>-15s</Text>
              </TouchableOpacity>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.skipBtn, finishedState && styles.finishBtn]}
            onPress={handlePressSkip}
            activeOpacity={0.8}
          >
            <Text style={[styles.skipBtnText, finishedState && styles.finishBtnText]}>
              {finishedState ? 'Continuar' : 'Pular'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

function makeStyles(colors: any, bottomOffset: number) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: bottomOffset,
      left: 12,
      right: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingTop: 8,
      paddingBottom: 10,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 16,
      zIndex: 9999,
      overflow: 'hidden',
    },
    containerFinished: {
      borderColor: colors.success,
      backgroundColor: colors.surface,
    },
    progressBarTrack: {
      height: 3.5,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 2,
      marginBottom: 8,
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
      marginRight: 10,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 2,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    timerBadge: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.6,
    },
    timeText: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    timeTextFinished: {
      color: colors.success,
      fontSize: 20,
    },
    exerciseNameText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
      fontWeight: '500',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    adjustBtn: {
      paddingVertical: 7,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceBorder,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    adjustBtnText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    skipBtn: {
      paddingVertical: 8,
      paddingHorizontal: 13,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    skipBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    finishBtn: {
      backgroundColor: colors.success,
      borderColor: colors.success,
      paddingVertical: 9,
      paddingHorizontal: 15,
    },
    finishBtnText: {
      color: colors.onPrimary,
      fontWeight: '900',
      fontSize: 13,
    },
  });
}
