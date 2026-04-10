import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../constants/theme';
import { getPillarById, PILLARS, Pillar } from '../constants/pillars';

interface PillarIconProps {
  pillarId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  selected?: boolean;
  style?: ViewStyle;
}

const SIZE_MAP = {
  sm: { container: 32, icon: 16, glow: 40 },
  md: { container: 44, icon: 22, glow: 56 },
  lg: { container: 60, icon: 28, glow: 76 },
  xl: { container: 80, icon: 36, glow: 100 },
};

export const PillarIcon: React.FC<PillarIconProps> = ({
  pillarId,
  size = 'md',
  selected = false,
  style,
}) => {
  const pillar = getPillarById(pillarId);
  const dimensions = SIZE_MAP[size];

  if (!pillar) {
    return (
      <View
        style={[
          styles.container,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
            backgroundColor: theme.colors.card,
          },
          style,
        ]}
      >
        <Text style={{ fontSize: dimensions.icon }}>❓</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {selected && (
        <View
          style={[
            styles.glow,
            {
              width: dimensions.glow,
              height: dimensions.glow,
              borderRadius: dimensions.glow / 2,
              backgroundColor: theme.colors.accent,
              top: -(dimensions.glow - dimensions.container) / 2,
              left: -(dimensions.glow - dimensions.container) / 2,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.container,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: theme.borderRadius.md,
            backgroundColor: selected ? theme.colors.accentMuted : pillar.accentColor,
            borderWidth: selected ? 1.5 : 1,
            borderColor: selected ? theme.colors.accent : `${pillar.color}40`,
          },
        ]}
      >
        <Text style={{ fontSize: dimensions.icon }}>{pillar.icon}</Text>
      </View>
    </View>
  );
};

interface PillarGridProps {
  selected?: string | null;
  onSelect: (pillarId: string) => void;
}

export const PillarGrid: React.FC<PillarGridProps> = ({ selected, onSelect }) => {
  return (
    <View style={styles.grid}>
      {PILLARS.map((pillar) => (
        <View key={pillar.id} style={styles.gridItem}>
          <View style={styles.pillarGridCell}>
            <PillarIcon
              pillarId={pillar.id}
              size="lg"
              selected={selected === pillar.id}
              style={styles.gridIcon}
            />
            <Text
              style={[
                styles.pillarLabel,
                selected === pillar.id && styles.pillarLabelSelected,
              ]}
              onPress={() => onSelect(pillar.id)}
            >
              {pillar.name}
            </Text>
          </View>
          <View
            style={[styles.pillarTouchTarget]}
            // pressable handled by onPress on Text and container wrapper
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    opacity: 0.15,
    zIndex: 0,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  gridItem: {
    width: '22%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarGridCell: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  gridIcon: {
    // handled by PillarIcon
  },
  pillarLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.ui,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
    letterSpacing: 0.5,
  },
  pillarLabelSelected: {
    color: theme.colors.accent,
  },
  pillarTouchTarget: {
    ...StyleSheet.absoluteFillObject,
  },
});
