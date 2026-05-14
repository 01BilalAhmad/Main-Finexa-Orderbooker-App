// Finexa Orderbooker
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
}

export const Badge = memo(function Badge({
  label,
  color = Colors.textInverse,
  bgColor = Colors.primary,
  size = 'sm',
}: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.label, { color }, size === 'md' && styles.labelMd]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: FontSize.sm,
  },
});
