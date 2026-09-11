import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface HabitCheckboxProps {
  label: string;
  icon: string;
  checked: boolean;
  onToggle: () => void;
  accentColor?: string;
  sublabel?: string;
}

export const HabitCheckbox: React.FC<HabitCheckboxProps> = ({
  label,
  icon,
  checked,
  onToggle,
  accentColor,
  sublabel,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const activeAccentColor = accentColor || colors.success;
  return (
    <TouchableOpacity
      style={[
        styles.container,
        checked && {
          borderColor: activeAccentColor,
          backgroundColor: colors.surfaceElevated,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${label}: ${checked ? 'concluído' : 'pendente'}`}
    >
      <View style={styles.contentLeft}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: checked ? `${activeAccentColor}25` : colors.surfaceBorder },
          ]}
        >
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.label,
              checked && styles.labelChecked,
            ]}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text style={styles.sublabel}>{sublabel}</Text>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.checkbox,
          checked && {
            backgroundColor: activeAccentColor,
            borderColor: activeAccentColor,
          },
        ]}
      >
        {checked ? (
          <Text style={styles.checkIcon}>✓</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    marginBottom: 10,
  },
  contentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelChecked: {
    color: colors.textPrimary,
  },
  sublabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginLeft: 12,
  },
  checkIcon: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
  },
});
}

