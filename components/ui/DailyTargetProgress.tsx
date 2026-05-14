// Finexa Orderbooker
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR } from '@/utils/format';
import { StorageService, DailyTarget } from '@/services/storage';
import { useAuth } from '@/hooks/useAuth';

interface DailyTargetProgressProps {
  todayRecovery: number;
}

export function DailyTargetProgress({ todayRecovery }: DailyTargetProgressProps) {
  const { user } = useAuth();
  const [target, setTarget] = useState<number>(0);
  const [targetInput, setTargetInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTarget();
  }, [user]);

  async function loadTarget() {
    if (!user) return;
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const saved = await StorageService.getDailyTarget(user.id, month);
      if (saved) {
        setTarget(saved.target);
        setTargetInput(String(saved.target));
      }
    } catch { /* not critical */ }
  }

  async function handleSaveTarget() {
    if (!user) return;
    const val = parseInt(targetInput, 10);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const dailyTarget: DailyTarget = {
        orderbookerId: user.id,
        target: val,
        month,
      };
      await StorageService.saveDailyTarget(dailyTarget);
      setTarget(val);
      setShowInput(false);
    } catch { /* not critical */ }
    setSaving(false);
  }

  const progressPct = target > 0 ? Math.min((todayRecovery / target) * 100, 100) : 0;
  const remaining = Math.max(target - todayRecovery, 0);

  // Color coding: green if >= 50%, yellow if > 0% and < 50%, red if 0%
  let progressColor = Colors.danger;
  if (progressPct >= 50) {
    progressColor = Colors.primary;
  } else if (progressPct > 0) {
    progressColor = Colors.secondary;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="flag" size={16} color={Colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Daily Target</Text>
        {!showInput ? (
          <Pressable
            onPress={() => setShowInput(true)}
            style={styles.editBtn}
            hitSlop={8}
          >
            <MaterialIcons
              name={target > 0 ? 'edit' : 'add'}
              size={16}
              color={Colors.primary}
            />
          </Pressable>
        ) : null}
      </View>

      {showInput ? (
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>Rs.</Text>
            <TextInput
              style={styles.targetInput}
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="numeric"
              placeholder="Enter daily target"
              placeholderTextColor={Colors.textMuted}
              maxLength={8}
              autoFocus
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}
            onPress={handleSaveTarget}
            disabled={!targetInput.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
            )}
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => { setShowInput(false); setTargetInput(target > 0 ? String(target) : ''); }}
            hitSlop={8}
          >
            <MaterialIcons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {target > 0 ? (
        <>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>

          {/* Amounts */}
          <View style={styles.amountRow}>
            <View style={styles.amountItem}>
              <Text style={[styles.amountValue, { color: progressColor }]}>
                {formatPKR(todayRecovery)}
              </Text>
              <Text style={styles.amountLabel}>Recovered</Text>
            </View>
            <View style={styles.amountDivider}>
              <MaterialIcons name="arrow-forward" size={14} color={Colors.textMuted} />
            </View>
            <View style={styles.amountItem}>
              <Text style={styles.amountValue}>{formatPKR(target)}</Text>
              <Text style={styles.amountLabel}>Target</Text>
            </View>
            <View style={styles.amountDivider}>
              <MaterialIcons name="arrow-forward" size={14} color={Colors.textMuted} />
            </View>
            <View style={styles.amountItem}>
              <Text style={[styles.amountValue, { color: remaining > 0 ? Colors.secondary : Colors.primary }]}>
                {formatPKR(remaining)}
              </Text>
              <Text style={styles.amountLabel}>Remaining</Text>
            </View>
          </View>

          {/* Status text */}
          <Text style={[styles.statusText, { color: progressColor }]}>
            {progressPct >= 100
              ? 'Target achieved! Great job!'
              : progressPct >= 50
              ? `${progressPct.toFixed(0)}% — On track!`
              : progressPct > 0
              ? `${progressPct.toFixed(0)}% — Keep going!`
              : 'No recovery yet today'}
          </Text>
        </>
      ) : !showInput ? (
        <Pressable
          style={({ pressed }) => [styles.setTargetBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowInput(true)}
        >
          <MaterialIcons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.setTargetText}>Set a daily recovery target</Text>
        </Pressable>
      ) : null}
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
    marginBottom: Spacing.sm,
  },
  headerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    height: 40,
  },
  inputPrefix: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginRight: Spacing.xs,
  },
  targetInput: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    paddingVertical: 0,
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressTrack: {
    height: 10,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: 10,
    borderRadius: Radius.full,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountDivider: {
    paddingHorizontal: 2,
  },
  amountValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  amountLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  setTargetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
  },
  setTargetText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
});
