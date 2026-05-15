// Powered by Finexa
// Ledger Screen — Modern redesign with gradient header, glassmorphism cards,
// improved transaction rows, and consistent indigo theme throughout.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useShops } from '@/hooks/useShops';
import { ApiService, LedgerResponse, Shop, Transaction } from '@/services/api';
import { getShopDisplayBalance } from '@/components/ui/ShopCard';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { formatPKR, formatDateTime } from '@/utils/format';
import { downloadLedgerPdf } from '@/utils/generateLedgerPdf';
import { CompanySelector } from '@/components/ui/CompanySelector';

// ── Summary Card Component ──
function SummaryCard({
  label,
  value,
  color,
  bg,
  icon,
  borderColor,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: string;
  borderColor: string;
}) {
  return (
    <View style={[summaryStyles.wrap, { backgroundColor: bg, borderLeftColor: borderColor }]}>
      <View style={summaryStyles.top}>
        <View style={[summaryStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <MaterialIcons name={icon as any} size={16} color={color} />
        </View>
        <Text style={[summaryStyles.value, { color }]}>{value}</Text>
      </View>
      <Text style={summaryStyles.label}>{label}</Text>
    </View>
  );
}
const summaryStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderLeftWidth: 3,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: FontWeight.semibold,
  },
});

// ── Transaction Row Component ──
function TxnRow({ item }: { item: Transaction }) {
  const isCredit = item.type === 'credit';
  return (
    <View style={txnStyles.row}>
      {/* Type indicator icon */}
      <View style={[txnStyles.typeIcon, { backgroundColor: isCredit ? '#FEF3C7' : '#EEF2FF' }]}>
        <MaterialIcons
          name={isCredit ? 'add-circle' : 'remove-circle'}
          size={20}
          color={isCredit ? Colors.secondary : '#4F46E5'}
        />
      </View>

      <View style={txnStyles.body}>
        <View style={txnStyles.topRow}>
          <View style={txnStyles.badges}>
            <View style={[txnStyles.typeBadge, { backgroundColor: isCredit ? '#FEF3C7' : '#EEF2FF' }]}>
              <Text style={[txnStyles.typeBadgeText, { color: isCredit ? '#92400E' : '#4F46E5' }]}>
                {isCredit ? 'CREDIT' : 'RECOVERY'}
              </Text>
            </View>
            {item.status === 'pending' ? (
              <View style={txnStyles.pendingBadge}>
                <View style={txnStyles.pendingDot} />
                <Text style={txnStyles.pendingText}>Pending</Text>
              </View>
            ) : item.status === 'rejected' ? (
              <View style={txnStyles.rejectedBadge}>
                <Text style={txnStyles.rejectedText}>Rejected</Text>
              </View>
            ) : null}
          </View>
          <Text style={[txnStyles.amount, { color: isCredit ? Colors.secondary : '#4F46E5' }]}>
            {isCredit ? '+' : '-'}{formatPKR(item.amount)}
          </Text>
        </View>

        <Text style={txnStyles.date}>{formatDateTime(item.createdAt)}</Text>
        {item.description ? <Text style={txnStyles.desc} numberOfLines={1}>{item.description}</Text> : null}

        <View style={txnStyles.balanceRow}>
          <Text style={txnStyles.balanceLabel}>Balance:</Text>
          <Text style={txnStyles.balancePrev}>{formatPKR(item.previousBalance)}</Text>
          <MaterialIcons name="arrow-forward" size={10} color={Colors.textMuted} />
          <Text style={txnStyles.balanceNew}>{formatPKR(item.newBalance)}</Text>
          {item.creator ? (
            <Text style={txnStyles.creator} numberOfLines={1}>
              · {item.creator.name}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
const txnStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typeIcon: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, padding: Spacing.sm },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: {
    borderRadius: Radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.secondary },
  pendingText: { fontSize: 10, color: '#92400E', fontWeight: FontWeight.semibold },
  rejectedBadge: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rejectedText: { fontSize: 10, color: Colors.danger, fontWeight: FontWeight.semibold },
  amount: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  desc: { fontSize: FontSize.sm, color: Colors.text, marginBottom: 3 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  balanceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  balancePrev: { fontSize: FontSize.xs, color: Colors.textMuted },
  balanceNew: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  creator: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },
});

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const { user, distributorPhone, selectedCompanyId, companies, setSelectedCompanyId } = useAuth();
  const { allShops, isLoadingAll, loadAllShops } = useShops();

  const [showShopPicker, setShowShopPicker] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Load shops filtered by selected company
  useEffect(() => {
    if (user) loadAllShops(user.id, selectedCompanyId || undefined);
  }, [user, selectedCompanyId]);

  async function loadLedger(shop: Shop) {
    setSelectedShop(shop);
    setShowShopPicker(false);
    setIsLoadingLedger(true);
    try {
      const data = await ApiService.getLedger(shop.id, selectedCompanyId || undefined);
      setLedger(data);
    } catch {
      setLedger(null);
    } finally {
      setIsLoadingLedger(false);
    }
  }

  async function handleDownloadPdf() {
    if (!ledger) return;
    setIsGeneratingPdf(true);
    try {
      await downloadLedgerPdf(ledger, selectedCompanyId ? companies.find((c) => c.companyId === selectedCompanyId)?.companyName : user?.companyName, distributorPhone || undefined);
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const filteredShops = shopSearch.trim()
    ? allShops.filter(
        (s) => {
          try {
            return (s.name || '').toLowerCase().includes(shopSearch.toLowerCase()) ||
              (s.area || '').toLowerCase().includes(shopSearch.toLowerCase()) ||
              (s.ownerName || '').toLowerCase().includes(shopSearch.toLowerCase());
          } catch {
            return false;
          }
        }
      )
    : allShops;

  const reversedTxns = ledger ? [...ledger.transactions].reverse() : [];

  const balanceColor =
    (ledger?.summary.currentBalance ?? 0) > 0 ? Colors.danger : '#4F46E5';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Gradient header ── */}
      <LinearGradient
        colors={['#4F46E5', '#6366F1', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="menu-book" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Shop Ledger</Text>
            <Text style={styles.headerSub}>
              {selectedCompanyId
                ? companies.find((c) => c.companyId === selectedCompanyId)?.companyName || 'Full account statement'
                : 'Full account statement'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {companies.length > 0 ? (
            <CompanySelector
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              onSelectCompany={setSelectedCompanyId}
            />
          ) : null}
          {ledger && (
            <Pressable
              style={({ pressed }) => [styles.headerPdfBtn, pressed && { opacity: 0.8 }]}
              onPress={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="picture-as-pdf" size={20} color="rgba(255,255,255,0.95)" />
              )}
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* ── Shop selector — pill shape ── */}
      <Pressable
        style={({ pressed }) => [styles.shopSelector, pressed && { opacity: 0.85 }]}
        onPress={() => setShowShopPicker(true)}
      >
        <View style={styles.shopSelectorIcon}>
          <MaterialIcons name="store" size={18} color="#4F46E5" />
        </View>
        <Text
          style={[styles.shopSelectorText, !selectedShop && styles.shopSelectorPlaceholder]}
          numberOfLines={1}
        >
          {selectedShop ? selectedShop.name : 'Select a shop to view ledger...'}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={22} color={Colors.textSecondary} />
      </Pressable>

      {/* ── Content ── */}
      {!selectedShop ? (
        <View style={styles.emptyContainer}>
          <LinearGradient colors={['#EEF2FF', '#F8FAFC']} style={styles.emptyGrad}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="menu-book" size={48} color="#4F46E5" />
            </View>
            <Text style={styles.emptyTitle}>Select a Shop</Text>
            <Text style={styles.emptySubtitle}>
              Choose a shop from the list to view its full account statement
            </Text>
          </LinearGradient>
        </View>
      ) : isLoadingLedger ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading ledger...</Text>
        </View>
      ) : ledger ? (
        <FlatList
          data={reversedTxns}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Shop info card */}
              <View style={styles.shopInfoCard}>
                <View style={styles.shopInfoLeft}>
                  <View style={styles.shopInitials}>
                    <Text style={styles.shopInitialsText}>
                      {ledger.shop.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopInfoName}>{ledger.shop.name}</Text>
                    <Text style={styles.shopInfoOwner}>{ledger.shop.ownerName}</Text>
                    <View style={styles.shopInfoMeta}>
                      <MaterialIcons name="location-on" size={13} color={Colors.textMuted} />
                      <Text style={styles.shopInfoMetaText}>{ledger.shop.area}</Text>
                      {ledger.shop.phone ? (
                        <>
                          <Text style={styles.shopInfoDot}>·</Text>
                          <MaterialIcons name="call" size={13} color={Colors.textMuted} />
                          <Text style={styles.shopInfoMetaText}>{ledger.shop.phone}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              {/* Summary cards with left border accent */}
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="Total Credit"
                  value={
                    ledger.summary.totalCredit >= 1000000
                      ? `${(ledger.summary.totalCredit / 1000000).toFixed(1)}M`
                      : ledger.summary.totalCredit >= 1000
                      ? `${(ledger.summary.totalCredit / 1000).toFixed(0)}K`
                      : formatPKR(ledger.summary.totalCredit)
                  }
                  color={Colors.secondary}
                  bg={Colors.secondaryLight}
                  icon="credit-card"
                  borderColor={Colors.secondary}
                />
                <SummaryCard
                  label="Total Recovery"
                  value={
                    ledger.summary.totalRecovery >= 1000000
                      ? `${(ledger.summary.totalRecovery / 1000000).toFixed(1)}M`
                      : ledger.summary.totalRecovery >= 1000
                      ? `${(ledger.summary.totalRecovery / 1000).toFixed(0)}K`
                      : formatPKR(ledger.summary.totalRecovery)
                  }
                  color="#4F46E5"
                  bg="#EEF2FF"
                  icon="trending-up"
                  borderColor="#4F46E5"
                />
                <SummaryCard
                  label="Balance"
                  value={
                    ledger.summary.currentBalance >= 1000000
                      ? `${(ledger.summary.currentBalance / 1000000).toFixed(1)}M`
                      : ledger.summary.currentBalance >= 1000
                      ? `${(ledger.summary.currentBalance / 1000).toFixed(0)}K`
                      : formatPKR(ledger.summary.currentBalance)
                  }
                  color={balanceColor}
                  bg={
                    ledger.summary.currentBalance > 0 ? Colors.dangerLight : '#EEF2FF'
                  }
                  icon="account-balance-wallet"
                  borderColor={balanceColor}
                />
              </View>

              {/* Prominent PDF Download Button — Indigo gradient */}
              <Pressable
                style={({ pressed }) => [styles.pdfDownloadCard, pressed && styles.pdfDownloadCardPressed]}
                onPress={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                <LinearGradient
                  colors={['#4F46E5', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.pdfGradient}
                >
                  <View style={styles.pdfIconWrap}>
                    {isGeneratingPdf ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="picture-as-pdf" size={24} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.pdfTextWrap}>
                    <Text style={styles.pdfTitle}>
                      {isGeneratingPdf ? 'Generating PDF...' : 'Download Ledger PDF'}
                    </Text>
                    <Text style={styles.pdfSubtitle}>
                      {isGeneratingPdf
                        ? 'Please wait...'
                        : `Full statement of ${ledger.shop.name}`}
                    </Text>
                  </View>
                  <MaterialIcons name="download" size={22} color="rgba(255,255,255,0.8)" />
                </LinearGradient>
              </Pressable>

              {/* Transaction header */}
              <View style={styles.txnHeader}>
                <View style={styles.txnHeaderIcon}>
                  <MaterialIcons name="receipt-long" size={16} color="#4F46E5" />
                </View>
                <Text style={styles.txnHeaderTitle}>
                  Transactions
                </Text>
                <View style={styles.txnCountBadge}>
                  <Text style={styles.txnCountText}>{ledger.summary.totalTransactions}</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyTxn}>
              <MaterialIcons name="receipt-long" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTxnText}>No transactions found</Text>
            </View>
          }
          renderItem={({ item }) => <TxnRow item={item} />}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Could not load ledger</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => selectedShop && loadLedger(selectedShop)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── Shop picker modal ── */}
      <Modal
        visible={showShopPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShopPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowShopPicker(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <View style={styles.pickerHeaderIcon}>
              <MaterialIcons name="store" size={18} color="#4F46E5" />
            </View>
            <Text style={styles.pickerTitle}>Select Shop</Text>
            <Pressable onPress={() => setShowShopPicker(false)} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.pickerSearch}>
            <MaterialIcons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.pickerSearchInput}
              value={shopSearch}
              onChangeText={setShopSearch}
              placeholder="Search shops..."
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>
          {isLoadingAll ? (
            <ActivityIndicator color="#4F46E5" style={{ marginVertical: Spacing.md }} />
          ) : (
            <FlatList
              data={filteredShops}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.shopPickerItem,
                    item.id === selectedShop?.id && styles.shopPickerItemActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => loadLedger(item)}
                >
                  <View style={styles.shopPickerLeft}>
                    <View style={styles.shopPickerAvatar}>
                      <Text style={styles.shopPickerAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopPickerName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.shopPickerArea}>{item.area}</Text>
                    </View>
                  </View>
                  <View style={styles.shopPickerRight}>
                    <Text style={[styles.shopPickerBalance, { color: getShopDisplayBalance(item, selectedCompanyId || user?.companyId).balance > 0 ? Colors.danger : '#4F46E5' }]}>
                      {formatPKR(getShopDisplayBalance(item, selectedCompanyId || user?.companyId).balance)}
                    </Text>
                    {item.id === selectedShop?.id ? (
                      <MaterialIcons name="check-circle" size={16} color="#4F46E5" />
                    ) : null}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No shops found</Text>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerPdfBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // ── Shop selector ──
  shopSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    marginTop: -Spacing.sm,
    borderRadius: 30,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    ...Shadow.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  shopSelectorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  shopSelectorText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  shopSelectorPlaceholder: { color: Colors.textMuted, fontWeight: FontWeight.regular },

  // ── List content ──
  listContent: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xxl },
  
  // ── Shop info card ──
  shopInfoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  shopInfoLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  shopInitials: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  shopInitialsText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#4F46E5' },
  shopInfoName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  shopInfoOwner: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1, marginBottom: 4 },
  shopInfoMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  shopInfoMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  shopInfoDot: { color: Colors.textMuted, marginHorizontal: 2 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },

  // ── PDF Download Card ──
  pdfDownloadCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  pdfDownloadCardPressed: { opacity: 0.9 },
  pdfGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pdfIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTextWrap: {
    flex: 1,
  },
  pdfTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  pdfSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  // ── Transaction header ──
  txnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  txnHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnHeaderTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  txnCountBadge: {
    backgroundColor: '#4F46E5',
    borderRadius: Radius.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  txnCountText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#FFFFFF' },

  // ── Empty states ──
  emptyContainer: {
    flex: 1,
    margin: Spacing.md,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  emptyGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: FontSize.base, color: Colors.textSecondary },
  retryBtn: {
    marginTop: Spacing.md,
    backgroundColor: '#4F46E5',
    borderRadius: 30,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryBtnText: { color: Colors.textInverse, fontWeight: FontWeight.semibold },
  emptyTxn: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTxnText: { fontSize: FontSize.base, color: Colors.textMuted },

  // ── Shop Picker Modal ──
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    maxHeight: '75%',
    ...Shadow.lg,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pickerHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, flex: 1 },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 30,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerSearchInput: { flex: 1, fontSize: FontSize.base, color: Colors.text, paddingVertical: 4 },
  shopPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    borderRadius: Radius.sm,
  },
  shopPickerItemActive: { backgroundColor: '#EEF2FF' },
  shopPickerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.md, gap: Spacing.sm },
  shopPickerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  shopPickerAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#4F46E5',
  },
  shopPickerName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 2 },
  shopPickerArea: { fontSize: FontSize.sm, color: Colors.textSecondary },
  shopPickerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shopPickerBalance: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  pickerEmpty: { textAlign: 'center', fontSize: FontSize.base, color: Colors.textMuted, paddingVertical: Spacing.xl },
});
