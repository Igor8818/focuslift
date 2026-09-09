import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Colors } from '../theme/colors';

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
  accentColor = Colors.success,
  sublabel,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        checked && {
          borderColor: accentColor,
          backgroundColor: Colors.surfaceElevated,
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
            { backgroundColor: checked ? `${accentColor}25` : Colors.surfaceBorder },
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
            backgroundColor: accentColor,
            borderColor: accentColor,
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
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
    color: Colors.textPrimary,
  },
  labelChecked: {
    color: Colors.textPrimary,
  },
  sublabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.textMuted,
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
