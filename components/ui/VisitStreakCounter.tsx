// Finexa Orderbooker
import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { StorageService, VisitStreak } from '@/services/storage';

interface VisitStreakCounterProps {
  orderbookerId: string;
  visitedCount?: number;
}

function getMotivationalMessage(streak: number): string {
  if (streak === 0) return 'Start your streak today!';
  if (streak === 1) return 'Great start — keep it going!';
  if (streak <= 3) return 'Building momentum!';
  if (streak <= 5) return 'On fire — nice consistency!';
  if (streak <= 7) return 'One full week — amazing!';
  if (streak <= 14) return 'Two weeks strong — unstoppable!';
  if (streak <= 30) return 'Legendary dedication!';
  return 'Superhuman consistency!';
}

export const VisitStreakCounter = memo(function VisitStreakCounter({
  orderbookerId,
  visitedCount = 0,
}: VisitStreakCounterProps) {
  const [streak, setStreak] = useState<VisitStreak | null>(null);

  useEffect(() => {
    loadStreak();
  }, [orderbookerId]);

  // Update streak when visitedCount changes (shops visited today)
  useEffect(() => {
    if (visitedCount > 0 && orderbookerId) {
      StorageService.updateVisitStreak(orderbookerId, true).then(setStreak);
    }
  }, [orderbookerId, visitedCount > 0]);

  async function loadStreak() {
    try {
      // Check/update streak on mount
      const updated = await StorageService.updateVisitStreak(
        orderbookerId,
        visitedCount > 0
      );
      setStreak(updated);
    } catch {
      // Not critical
    }
  }

  if (!streak) return null;

  const message = getMotivationalMessage(streak.currentStreak);

  return (
    <View style={styles.container}>
      <View style={styles.streakRow}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <View style={styles.streakInfo}>
          <View style={styles.streakTopRow}>
            <Text style={styles.streakCount}>{streak.currentStreak}</Text>
            <Text style={styles.streakLabel}>day streak!</Text>
          </View>
          <Text style={styles.motivationalText}>{message}</Text>
        </View>
        {streak.longestStreak > streak.currentStreak && streak.longestStreak > 0 ? (
          <View style={styles.recordBadge}>
            <MaterialIcons name="emoji-events" size={12} color={Colors.secondary} />
            <Text style={styles.recordText}>Best: {streak.longestStreak}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fireEmoji: {
    fontSize: FontSize.xxl,
  },
  streakInfo: {
    flex: 1,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  streakCount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  streakLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FontWeight.semibold,
  },
  motivationalText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  recordText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FDE68A',
  },
});
