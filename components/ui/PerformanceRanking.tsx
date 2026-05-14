// Finexa Orderbooker
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { ApiService, RecoverySummaryOrderbooker } from '@/services/api';
import { formatPKR } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32']; // Gold, Silver, Bronze

export function PerformanceRanking() {
  const { user } = useAuth();
  const [bookers, setBookers] = useState<RecoverySummaryOrderbooker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRanking();
  }, []);

  async function loadRanking() {
    setLoading(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const res = await ApiService.getRecoverySummary(dateStr);
      // Sort by totalRecovery descending
      const sorted = [...res.orderbookers].sort((a, b) => b.totalRecovery - a.totalRecovery);
      setBookers(sorted);
    } catch {
      setBookers([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading ranking...</Text>
      </View>
    );
  }

  if (bookers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="leaderboard" size={18} color={Colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Today's Ranking</Text>
      </View>

      {bookers.map((booker, index) => {
        const isCurrentUser = user?.id === booker.orderbookerId;
        const medalColor = index < 3 ? MEDAL_COLORS[index] : null;

        return (
          <View
            key={booker.orderbookerId}
            style={[
              styles.rankRow,
              isCurrentUser && styles.rankRowHighlight,
              index === 0 && styles.rankRowFirst,
            ]}
          >
            {/* Rank number / medal */}
            <View style={[styles.rankBadge, medalColor && { backgroundColor: medalColor + '22' }]}>
              {medalColor ? (
                <MaterialIcons
                  name={index === 0 ? 'emoji-events' : index === 1 ? 'workspace-premium' : 'military-tech'}
                  size={18}
                  color={medalColor}
                />
              ) : (
                <Text style={styles.rankNumber}>{index + 1}</Text>
              )}
            </View>

            {/* Name & details */}
            <View style={styles.rankInfo}>
              <Text style={[styles.rankName, isCurrentUser && styles.rankNameSelf]}>
                {booker.orderbookerName}
                {isCurrentUser ? ' (You)' : ''}
              </Text>
              <Text style={styles.rankShops}>
                {booker.visitedShops}/{booker.totalShops} shops visited
              </Text>
            </View>

            {/* Recovery amount */}
            <View style={styles.rankAmountWrap}>
              <Text style={[styles.rankAmount, isCurrentUser && styles.rankAmountSelf]}>
                {formatPKR(booker.totalRecovery)}
              </Text>
              <Text style={styles.rankAmountLabel}>recovered</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  rankRowHighlight: {
    backgroundColor: Colors.primaryLight,
  },
  rankRowFirst: {
    // no special extra style needed; medal handles it
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rankNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  rankNameSelf: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.bold,
  },
  rankShops: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rankAmountWrap: {
    alignItems: 'flex-end',
  },
  rankAmount: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  rankAmountSelf: {
    color: Colors.primary,
  },
  rankAmountLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
