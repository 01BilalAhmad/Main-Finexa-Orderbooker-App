// Powered by Finexa
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { UserCompany } from '@/services/api';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface CompanySelectorProps {
  companies: UserCompany[];
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string) => void;
}

export function CompanySelector({ companies, selectedCompanyId, onSelectCompany }: CompanySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // If user has only 0 or 1 company, show a simple label (no dropdown)
  const hasMultipleCompanies = companies.length > 1;

  const selectedCompany = companies.find((c) => c.companyId === selectedCompanyId);
  const displayName = selectedCompany?.companyName || 'Select Company';

  const handleSelect = useCallback((companyId: string) => {
    onSelectCompany(companyId);
    setIsOpen(false);
  }, [onSelectCompany]);

  if (!hasMultipleCompanies) {
    // Single company or no companies — just show the company name with a building icon
    return (
      <View style={styles.singleContainer}>
        <MaterialIcons name="business" size={16} color="#FFFFFF" />
        <Text style={styles.singleLabel} numberOfLines={1}>
          {displayName}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.selector, pressed && styles.selectorPressed]}
        onPress={() => setIsOpen(true)}
        hitSlop={4}
      >
        <MaterialIcons name="business" size={16} color="#FFFFFF" />
        <Text style={styles.selectorLabel} numberOfLines={1}>
          {displayName}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={20} color="rgba(255,255,255,0.8)" />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdownContainer}>
            <View style={styles.dropdownHeader}>
              <MaterialIcons name="business" size={20} color={Colors.primary} />
              <Text style={styles.dropdownTitle}>Select Company</Text>
            </View>
            <FlatList
              data={companies}
              keyExtractor={(item) => item.companyId}
              renderItem={({ item }) => {
                const isSelected = item.companyId === selectedCompanyId;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.companyItem,
                      isSelected && styles.companyItemSelected,
                      pressed && styles.companyItemPressed,
                    ]}
                    onPress={() => handleSelect(item.companyId)}
                  >
                    <View style={[styles.companyDot, isSelected && styles.companyDotSelected]}>
                      {isSelected ? (
                        <MaterialIcons name="check" size={14} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View style={styles.companyInfo}>
                      <Text style={[styles.companyName, isSelected && styles.companyNameSelected]} numberOfLines={1}>
                        {item.companyName}
                      </Text>
                      {item.isPrimary ? (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <MaterialIcons name="radio-button-checked" size={20} color={Colors.primary} />
                    ) : (
                      <MaterialIcons name="radio-button-unchecked" size={20} color={Colors.textMuted} />
                    )}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  singleLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    maxWidth: '80%',
  },
  selectorPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  selectorLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  dropdownContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadow.xl,
    overflow: 'hidden',
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  companyItemSelected: {
    backgroundColor: Colors.primaryLight,
  },
  companyItemPressed: {
    opacity: 0.7,
  },
  companyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyDotSelected: {
    backgroundColor: Colors.primary,
  },
  companyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  companyName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  companyNameSelected: {
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  primaryBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: Spacing.xxl + Spacing.lg,
    marginRight: Spacing.lg,
  },
});
