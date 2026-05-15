// Powered by Finexa
// Recovery Receipt — White card with dark header, matching the approved mockup design.
// After capturing as image, it's saved to gallery and shared to shopkeeper via WhatsApp.
// Receipt image persists so it can be re-sent later.
// Urdu statement is preserved at the bottom.
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { formatPKR } from '@/utils/format';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface RecoveryReceiptProps {
  visible: boolean;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  shopPhone: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
  onClose: () => void;
}

/** Format phone number to international format (923001234567) */
function formatPhoneIntl(phone: string): string {
  let p = phone.trim().replace(/[^0-9]/g, '');
  if (p.startsWith('+')) p = p.substring(1);
  if (p.startsWith('0')) p = p.substring(1);
  if (!p.startsWith('92')) p = '92' + p;
  return p.replace(/[^0-9]/g, '');
}

export function RecoveryReceipt({
  visible,
  shopName,
  shopAddress,
  shopOwnerName,
  shopPhone,
  openingBalance,
  recoveryAmount,
  remainingBalance,
  companyName,
  orderbookerName,
  distributorPhone,
  onClose,
}: RecoveryReceiptProps) {
  const receiptRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedImageUri, setSavedImageUri] = useState<string | null>(null);
  const [imageSavedToGallery, setImageSavedToGallery] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIsCapturing(false);
      setSavedImageUri(null);
      setImageSavedToGallery(false);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible]);

  const today = new Date().toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeNow = new Date().toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  /**
   * Capture receipt as image and save to gallery.
   * Returns the gallery URI if successful.
   */
  const captureAndSaveToGallery = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;

    // Wait for UI to fully render
    await new Promise(r => setTimeout(r, 800));

    // Step 1: Capture receipt as image
    let imageUri: string;
    try {
      imageUri = await captureRef(receiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
    } catch (captureErr) {
      console.error('[RecoveryReceipt] captureRef failed:', captureErr);
      throw new Error('Failed to capture receipt image');
    }

    if (!imageUri) {
      throw new Error('Image capture returned empty URI');
    }

    console.log('[RecoveryReceipt] Image captured at:', imageUri);

    // Ensure URI has file:// prefix for MediaLibrary
    const normalizedUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;

    // Step 2: Save image to device Gallery
    let savedAssetUri: string | null = null;
    try {
      // Request permissions — try with full access first, fallback to writeOnly
      let permResult = await MediaLibrary.requestPermissionsAsync(false); // false = full access
      console.log('[RecoveryReceipt] MediaLibrary permission status (full):', permResult.status);
      
      // If full access denied, try writeOnly (Android 13+)
      if (permResult.status !== 'granted') {
        permResult = await MediaLibrary.requestPermissionsAsync(true); // true = writeOnly
        console.log('[RecoveryReceipt] MediaLibrary permission status (writeOnly):', permResult.status);
      }

      if (permResult.status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(normalizedUri);
        // Create album for easy access
        try {
          await MediaLibrary.createAlbumAsync('AlFalah Receipts', asset, false);
        } catch {
          try {
            const album = await MediaLibrary.getAlbumAsync('AlFalah Receipts');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          } catch {}
        }
        savedAssetUri = asset.uri;
        setImageSavedToGallery(true);
        console.log('[RecoveryReceipt] Image saved to gallery:', asset.uri);
      } else if (permResult.status === 'limited') {
        // Limited access - try to save anyway
        try {
          const asset = await MediaLibrary.createAssetAsync(normalizedUri);
          savedAssetUri = asset.uri;
          setImageSavedToGallery(true);
          console.log('[RecoveryReceipt] Image saved with limited access:', asset.uri);
        } catch (limitedErr) {
          console.warn('[RecoveryReceipt] Could not save even with limited access:', limitedErr);
        }
      } else {
        console.warn('[RecoveryReceipt] MediaLibrary permission denied, status:', permResult.status);
        Alert.alert(
          'Gallery Permission Needed',
          'Please allow gallery access to save receipt images. You can still send via WhatsApp.',
          [{ text: 'OK' }]
        );
      }
    } catch (galleryErr: any) {
      console.warn('[RecoveryReceipt] Could not save to gallery:', galleryErr?.message || galleryErr);
    }

    return savedAssetUri || imageUri;
  };

  /**
   * First-time send: capture image, save to gallery, open WhatsApp
   */
  const handleShareImage = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      // Open WhatsApp chat directly to shopkeeper's number
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);

          if (imageSavedToGallery) {
            Alert.alert(
              'Receipt Ready!',
              `Receipt saved in Gallery (AlFalah Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select receipt → Send`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Receipt Ready',
              `WhatsApp chat opened for ${shopName}.\n\nAttach the receipt image from your Gallery to send it.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp to send receipt.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Share failed:', error);
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Re-send: recapture receipt image, save to gallery, open WhatsApp
   */
  const handleResend = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const uri = await captureAndSaveToGallery();
      if (uri) {
        setSavedImageUri(uri);
      }

      // Open WhatsApp chat directly to shopkeeper's number
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        const whatsappUrl = `https://wa.me/${phone}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          Alert.alert(
            'Receipt Re-saved!',
            `New receipt image saved in Gallery (AlFalah Receipts)!\n\nWhatsApp chat opened for ${shopName}.\n\nTap attachment → Gallery → Select latest receipt → Send`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('WhatsApp Not Available', 'Please install WhatsApp.');
        }
      } else {
        Alert.alert('No Phone Number', 'This shop has no phone number for WhatsApp.');
      }
    } catch (error: any) {
      console.error('[RecoveryReceipt] Resend failed:', error);
      // Fallback: just open WhatsApp without new image
      if (shopPhone) {
        const phone = formatPhoneIntl(shopPhone);
        Alert.alert(
          'Image Error',
          'Receipt image dobara save nahi hua. WhatsApp chat kholen?',
          [
            { text: 'WhatsApp Kholo', onPress: () => Linking.openURL(`https://wa.me/${phone}`) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } finally {
      setIsCapturing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdropFade, { opacity }]} />
      </Pressable>

      <View style={styles.center}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }], opacity }]}>
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <MaterialIcons name="close" size={20} color="#64748B" />
          </Pressable>

          {/* RECEIPT — White background card matching mockup */}
          <View ref={receiptRef} collapsable={false} style={styles.receipt}>
            {/* ── 1. Dark Header: AL-FALAH TRADERS ── */}
            <View style={styles.receiptHeader}>
              <MaterialIcons name="account-balance" size={22} color="#FFFFFF" />
              <Text style={styles.receiptBizName}>{companyName || 'AL-FALAH TRADERS'}</Text>
              <Text style={styles.receiptBizSub}>Distributor &middot; Credit System</Text>
              {distributorPhone ? (
                <View style={styles.receiptBizContact}>
                  <MaterialIcons name="call" size={11} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.receiptBizPhone}>{distributorPhone}</Text>
                </View>
              ) : null}
            </View>

            {/* ── 2. Recovery Badge ── */}
            <View style={styles.badgeRow}>
              <View style={styles.recoveryBadge}>
                <MaterialIcons name="arrow-upward" size={11} color="#10B981" />
                <Text style={styles.recoveryBadgeText}>Recovery Receipt</Text>
              </View>
            </View>

            {/* ── 3. Body ── */}
            <View style={styles.receiptBody}>
              {/* TX ID & Date */}
              <View style={styles.receiptMeta}>
                <Text style={styles.receiptTxId}>TXN: #REC-{Date.now().toString().slice(-10)}</Text>
                <Text style={styles.receiptDate}>{today}, {timeNow}</Text>
              </View>

              {/* Shop Info — "Received From" */}
              <View style={styles.receiptShopSection}>
                <Text style={styles.shopLabel}>RECEIVED FROM</Text>
                <Text style={styles.shopName}>{shopName}</Text>
                <View style={styles.shopDetailsGrid}>
                  {shopOwnerName ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Owner</Text>
                      <Text style={styles.detailValue}>{shopOwnerName}</Text>
                    </View>
                  ) : null}
                  {shopPhone ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{shopPhone}</Text>
                    </View>
                  ) : null}
                  {shopAddress ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Area</Text>
                      <Text style={styles.detailValue}>{shopAddress}</Text>
                    </View>
                  ) : null}
                  {orderbookerName ? (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Collected By</Text>
                      <Text style={styles.detailValue}>{orderbookerName}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Amount — Large display */}
              <View style={styles.receiptAmountSection}>
                <Text style={styles.amountLabel}>AMOUNT RECEIVED</Text>
                <Text style={styles.amountValue}>{formatPKR(recoveryAmount)}</Text>
              </View>

              {/* Balance Summary */}
              <View style={styles.receiptBalance}>
                <View style={styles.balRow}>
                  <Text style={styles.balRowLabel}>Previous Balance</Text>
                  <Text style={styles.balRowValue}>{formatPKR(openingBalance)}</Text>
                </View>
                <View style={styles.balRow}>
                  <Text style={styles.balRowLabel}>Amount Recovered</Text>
                  <Text style={[styles.balRowValue, { color: '#10B981' }]}>
                    - {formatPKR(recoveryAmount)}
                  </Text>
                </View>
                <View style={[styles.balRow, styles.balRowTotal]}>
                  <Text style={styles.balRowTotalLabel}>Remaining Balance</Text>
                  <Text style={[styles.balRowTotalValue, { color: remainingBalance > 0 ? '#EF4444' : '#10B981' }]}>
                    {formatPKR(remainingBalance)}
                  </Text>
                </View>
              </View>

              {/* Thank You */}
              <View style={styles.receiptThankYou}>
                <MaterialIcons name="verified" size={14} color="#10B981" />
                <Text style={styles.receiptThankText}>Thank you for your payment!</Text>
              </View>
            </View>

            {/* ── 4. Footer: Finexa ── */}
            <View style={styles.receiptFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.footerBrand}>Finexa</Text>
                <Text style={styles.footerSub}>Powered by Finexa Credit System</Text>
              </View>
              <View style={styles.footerQr}>
                <MaterialIcons name="qr-code-2" size={28} color="#94A3B8" />
              </View>
            </View>

            {/* ── 5. Urdu Hidayat (MUST PRESERVE) ── */}
            <View style={styles.receiptHidayat}>
              <Text style={styles.receiptHidayatText}>
                اگر آپ کو کسی بھی قسم کا کوئی فرق محسوس ہوتا ہے بیلنس میں تو اوپر دیے گئے نمبر پر لازمی رابطہ کریں شکریہ
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsRow}>
            {/* WhatsApp button */}
            <Pressable
              style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.85 }]}
              onPress={handleShareImage}
              disabled={isCapturing}
            >
              <MaterialIcons name="chat" size={18} color="#10B981" />
              <Text style={styles.waBtnText}>WhatsApp</Text>
            </Pressable>

            {/* Save / Share button */}
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                isCapturing && styles.shareBtnDisabled,
                pressed && !isCapturing && { opacity: 0.85 },
              ]}
              onPress={savedImageUri ? handleResend : handleShareImage}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name={savedImageUri ? 'save' : 'share'} size={18} color="#FFFFFF" />
              )}
              <Text style={styles.shareBtnText}>
                {isCapturing ? 'Saving...' : savedImageUri ? 'Save Again' : 'Share Receipt'}
              </Text>
            </Pressable>
          </View>

          {/* Resend link */}
          {savedImageUri ? (
            <Pressable
              style={({ pressed }) => [styles.resendRow, pressed && { opacity: 0.7 }]}
              onPress={handleResend}
              disabled={isCapturing}
            >
              <MaterialIcons name="refresh" size={14} color="#94A3B8" />
              <Text style={styles.resendText}>Re-send Receipt</Text>
            </Pressable>
          ) : null}

          {/* Gallery saved indicator */}
          {imageSavedToGallery ? (
            <View style={styles.savedIndicator}>
              <MaterialIcons name="check-circle" size={14} color="#10B981" />
              <Text style={styles.savedText}>Receipt saved in Gallery (AlFalah Receipts)</Text>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 1,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 400,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  // ===== RECEIPT — White card matching mockup =====
  receipt: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Shadow.xl,
  },

  // Dark header — AL-FALAH TRADERS
  receiptHeader: {
    backgroundColor: '#1E293B',
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  receiptBizName: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  receiptBizSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },
  receiptBizContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  receiptBizPhone: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FontWeight.medium,
  },

  // Recovery badge
  badgeRow: {
    alignItems: 'center',
    marginTop: -12,
    position: 'relative',
    zIndex: 2,
  },
  recoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  recoveryBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#10B981',
  },

  // Receipt body
  receiptBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },

  // TX ID & Date
  receiptMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  receiptTxId: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: FontWeight.medium,
  },
  receiptDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: FontWeight.semibold,
  },

  // Shop section — "Received From"
  receiptShopSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  shopLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shopName: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: '#1E293B',
    marginTop: 3,
  },
  shopDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  detailItem: {
    width: '48%',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    color: '#475569',
    marginTop: 1,
  },

  // Amount section — large display
  receiptAmountSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 4,
  },

  // Balance summary
  receiptBalance: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  balRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  balRowLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  balRowValue: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    color: '#475569',
  },
  balRowTotal: {
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  balRowTotalLabel: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: '#1E293B',
  },
  balRowTotalValue: {
    fontSize: 14,
    fontWeight: '800',
  },

  // Thank you
  receiptThankYou: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  receiptThankText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: FontWeight.semibold,
  },

  // Footer: Finexa
  receiptFooter: {
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  footerLeft: {},
  footerBrand: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: '#4F46E5',
  },
  footerSub: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  footerQr: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Urdu Hidayat — MUST PRESERVE
  receiptHidayat: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  receiptHidayatText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ===== ACTION BUTTONS =====
  buttonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  // WhatsApp button — green outline style
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  waBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: '#10B981',
  },
  // Share/Save button — primary indigo
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 13,
    ...Shadow.md,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  // Resend row
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  resendText: {
    fontSize: 12,
    fontWeight: FontWeight.semibold,
    color: '#94A3B8',
  },
  // Gallery saved indicator
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  savedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: FontWeight.medium,
  },
});
