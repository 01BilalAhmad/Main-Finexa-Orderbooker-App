// Powered by Finexa
// Shows pending RECOVERY alert for orderbooker (credits are only managed by admin on web)
import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { ApiService } from '@/services/api';

interface PendingRecoveryAlertProps {
  /** Filter by orderbooker ID to show only relevant pending recoveries */
  orderbookerId?: string;
}

export const PendingCreditAlert = memo(function PendingCreditAlert({
  orderbookerId,
}: PendingRecoveryAlertProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingRecoveries();
    // Refresh every 60 seconds
    const interval = setInterval(loadPendingRecoveries, 60000);
    return () => clearInterval(interval);
  }, [orderbookerId]);

  async function loadPendingRecoveries() {
    try {
      // Fetch pending recovery transactions for this orderbooker
      const params: Record<string, string | number> = {
        type: 'recovery',
        status: 'pending',
        limit: 500,
        page: 1,
      };
      if (orderbookerId) {
        params.orderbookerId = orderbookerId;
      }
      const res = await ApiService.getTransactions(params as any);
      setPendingCount(res.total);
      setTotalAmount(res.transactions.reduce((sum, t) => sum + t.amount, 0));
    } catch {
      // Not critical — fail silently
    } finally {
      setLoading(false);
    }
  }

  if (loading || pendingCount === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="pending-actions" size={16} color={Colors.secondary} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.bannerTitle}>
          {pendingCount} pending recovery {pendingCount === 1 ? 'approval' : 'approvals'} awaiting admin
        </Text>
        {totalAmount > 0 ? (
          <Text style={styles.bannerSub}>
            Total: Rs. {totalAmount.toLocaleString()} pending approval
          </Text>
        ) : null}
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{pendingCount}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FontSize.xs,
    color: '#92400E',
    fontWeight: FontWeight.semibold,
  },
  bannerSub: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});
