/**
 * BrandLogo.tsx
 *
 * Logo oficial do FocusLift: ícone (haltere em gradiente violeta→fúcsia) + wordmark
 * "FOCUS" (leve) + "LIFT" (pesado, cor de marca). Substitui os textos soltos
 * `FOCUS<LIFT>` e o emoji 🏋️ que estavam espalhados pelo app.
 *
 * Variantes:
 *  - `hero`     → ícone grande acima do wordmark (Login, Splash)
 *  - `inline`   → ícone pequeno ao lado do wordmark (cabeçalhos de tela)
 *  - `wordmark` → somente texto (cartão "Sobre")
 */

import React from 'react';
import { View, Text, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type BrandLogoVariant = 'hero' | 'inline' | 'wordmark';

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  /** Tamanho base do ícone em px. Padrões: hero=96, inline=34. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ICON = require('../../assets/icon.png');

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'inline', size, style }) => {
  const { colors } = useTheme();

  const iconSize = size ?? (variant === 'hero' ? 96 : 34);
  const fontSize = variant === 'hero' ? 34 : variant === 'inline' ? Math.round(iconSize * 0.62) : 26;
  const radius = Math.round(iconSize * 0.24);

  const wordmark = (
    <Text
      style={[
        styles.wordmark,
        { fontSize, color: colors.textPrimary, letterSpacing: variant === 'hero' ? 4 : 2 },
      ]}
      accessibilityRole="header"
    >
      FOCUS<Text style={[styles.lift, { color: colors.primary }]}>LIFT</Text>
    </Text>
  );

  if (variant === 'wordmark') {
    return <View style={style}>{wordmark}</View>;
  }

  const icon = (
    <View
      style={[
        styles.iconWrap,
        {
          width: iconSize,
          height: iconSize,
          borderRadius: radius,
          shadowColor: colors.primary,
          shadowOpacity: variant === 'hero' ? 0.55 : 0.35,
          shadowRadius: variant === 'hero' ? 22 : 8,
          borderColor: colors.surfaceBorderHover,
        },
      ]}
    >
      <Image
        source={ICON}
        style={{ width: iconSize, height: iconSize, borderRadius: radius }}
        resizeMode="cover"
        accessibilityLabel="FocusLift"
      />
    </View>
  );

  if (variant === 'hero') {
    return (
      <View style={[styles.heroColumn, style]}>
        {icon}
        {wordmark}
      </View>
    );
  }

  return (
    <View style={[styles.inlineRow, style]}>
      {icon}
      {wordmark}
    </View>
  );
};

const styles = StyleSheet.create({
  heroColumn: {
    alignItems: 'center',
    gap: 16,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: '#0B0A12',
  },
  wordmark: {
    fontWeight: '300',
  },
  lift: {
    fontWeight: '900',
  },
});
