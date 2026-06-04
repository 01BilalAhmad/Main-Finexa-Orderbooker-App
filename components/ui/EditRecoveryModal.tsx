// Powered by Finexa
// Edit Pending Recovery Modal — orderbooker can edit amount before admin approval
// Once approved, editing is NOT allowed
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { Transaction, ApiService } from '@/services/api';
import { formatPKR } from '@/utils/format';

export interface EditedRecoveryReceiptData {
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  shopPhone: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  transactionId: string;
}

interface EditRecoveryModalProps {
  visible: boolean;
  transaction: Transaction | null;
  userId: string;
  companyName?: string;
  orderbookerName?: string;
  shopPhone?: string;
  shopAddress?: string;
  shopOwnerName?: string;
  onClose: () => void;
  onUpdated: (receiptData?: EditedRecoveryReceiptData) => void;
}

export function EditRecoveryModal({
  visible,
  transaction,
  userId,
  companyName,
  orderbookerName,
  shopPhone,
  shopAddress,
  shopOwnerName,
  onClose,
  onUpdated,
}: EditRecoveryModalProps) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && transaction) {
      setAmount(transaction.amount.toString());
      setSaving(false);
    }
  }, [visible, transaction]);

  if (!transaction) return null;

  const handleSave = async () => {
    const newAmount = parseInt(amount, 10);
    if (!newAmount || newAmount < 100) {
      Alert.alert('Invalid Amount', 'Minimum recovery amount is Rs. 100');
      return;
    }
    if (newAmount > 500000) {
      Alert.alert('Invalid Amount', 'Maximum recovery amount is Rs. 500,000');
      return;
    }
    if (newAmount === transaction.amount) {
      Alert.alert('No Change', 'New amount is same as current amount.');
      return;
    }

    setSaving(true);
    try {
      const result = await ApiService.editPendingRecovery(transaction.id, {
        amount: newAmount,
        updatedBy: userId,
      });

      // Build receipt data with updated amount for regeneration
      const receiptData: EditedRecoveryReceiptData = {
        shopName: transaction.shop?.name || 'Shop',
        shopAddress: shopAddress,
        shopOwnerName: shopOwnerName,
        shopPhone: shopPhone || '',
        openingBalance: transaction.previousBalance,
        recoveryAmount: newAmount,
        remainingBalance: transaction.previousBalance - newAmount,
        transactionId: transaction.id,
      };

      Alert.alert(
        'Recovery Updated!',
        `Amount updated from ${formatPKR(transaction.amount)} to ${formatPKR(newAmount)}.\n\nReceipt will be regenerated with the new amount.`,
        [{ text: 'OK', onPress: () => { onUpdated(receiptData); onClose(); } }]
      );
    } catch (e: any) {
      Alert.alert('Edit Failed', e.message || 'Could not update recovery. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const difference = parseInt(amount || '0', 10) - transaction.amount;
  const differenceText = difference > 0
    ? `+ Rs. ${difference.toLocaleString()} more`
    : difference < 0
    ? `- Rs. ${Math.abs(difference).toLocaleString()} less`
    : 'No change';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="edit" size={24} color="#4F46E5" />
            </View>
            <Text style={styles.title}>Edit Pending Recovery</Text>
            <Text style={styles.subtitle}>
              {transaction.shop?.name || 'Shop'} — Pending Approval
            </Text>
          </View>

          {/* Current Amount */}
          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Current Amount</Text>
            <Text style={styles.currentValue}>{formatPKR(transaction.amount)}</Text>
          </View>

          {/* New Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>New Amount (Rs.)</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(text) => {
                  const numeric = text.replace(/[^0-9]/g, '');
                  setAmount(numeric);
                }}
                placeholder="Enter new amount"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                maxLength={7}
                autoFocus
              />
              {amount ? (
                <Pressable onPress={() => setAmount('')} hitSlop={8}>
                  <MaterialIcons name="cancel" size={18} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Difference Indicator */}
          {amount && parseInt(amount, 10) !== transaction.amount ? (
            <View style={[styles.diffRow, difference > 0 ? styles.diffMore : styles.diffLess]}>
              <MaterialIcons
                name={difference > 0 ? 'arrow-upward' : 'arrow-downward'}
                size={14}
                color={difference > 0 ? '#D97706' : '#059669'}
              />
              <Text style={[styles.diffText, { color: difference > 0 ? '#D97706' : '#059669' }]}>
                {differenceText} than original
              </Text>
            </View>
          ) : null}

          {/* Quick amount buttons */}
          <View style={styles.quickRow}>
            {[100, 500, 1000, 5000].map((val) => (
              <Pressable
                key={val}
                style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setAmount(val.toString())}
              >
                <Text style={styles.quickBtnText}>{val >= 1000 ? `${val / 1000}K` : val}</Text>
              </Pressable>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!amount || saving || parseInt(amount || '0', 10) === transaction.amount) && styles.saveBtnDisabled,
                pressed && !saving && { opacity: 0.85 },
              ]}
              onPress={handleSave}
              disabled={!amount || saving || parseInt(amount || '0', 10) === transaction.amount}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Update Recovery</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Note */}
          <Text style={styles.note}>
            You can only edit pending recoveries. Once approved by admin, editing is not allowed. Receipt will be regenerated with the updated amount.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...Shadow.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  currentLabel: {
    fontSize: FontSize.sm,
    color: '#92400E',
    fontWeight: FontWeight.medium,
  },
  currentValue: {
    fontSize: FontSize.lg,
    color: '#92400E',
    fontWeight: FontWeight.bold,
  },
  inputSection: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    paddingVertical: 4,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  diffMore: {
    backgroundColor: '#FEF3C7',
  },
  diffLess: {
    backgroundColor: '#D1FAE5',
  },
  diffText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    justifyContent: 'center',
  },
  quickBtn: {
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: '#4F46E5',
    ...Shadow.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  note: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
