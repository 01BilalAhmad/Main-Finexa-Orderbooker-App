# Company Selector Feature Implementation

## Task ID: company-selector-001

## Summary
Implemented the Company Selector feature in the Finexa-Orderbooker-App, enabling users who belong to multiple companies to switch between them from the Route screen.

## Files Modified

### 1. `services/api.ts`
- Added `UserCompany` interface (id, companyId, companyName, isPrimary)
- Added `Company` interface (id, name, distributorPhone)
- Updated `User` interface with `companies?: UserCompany[]` field
- Updated `RecoverySummaryResponse` with optional `companyBreakdown` field
- Updated `getShops` to accept optional `companyId` parameter
- Added `getUserCompanies(userId)` API method
- Added `fetchCompanies(userId)` API method

### 2. `services/storage.ts`
- Added `SELECTED_COMPANY_ID` storage key
- Added `saveSelectedCompanyId(companyId: string | null)` method
- Added `getSelectedCompanyId()` method

### 3. `contexts/AuthContext.tsx`
- Added `companies: UserCompany[]` state
- Added `selectedCompanyId: string | null` state
- Added `setSelectedCompanyId` function
- Added `fetchUserCompanies(userId)` to fetch companies from API
- On login/session restore: loads companies from user object and API
- Persists selectedCompanyId in AsyncStorage
- When selectedCompanyId changes, updates distributor phone
- Defaults to primary company or first company if no saved selection
- Falls back to `user.companyId` for backward compatibility

### 4. `components/ui/CompanySelector.tsx` (NEW)
- Modal-based dropdown component
- Shows building icon + company name
- If only 1 company: shows label without dropdown arrow
- If multiple companies: shows dropdown arrow, opens modal picker
- Highlights selected company with blue accent
- Shows "Primary" badge for primary company
- Uses existing app theme (Colors, Spacing, etc.)

### 5. `contexts/ShopsContext.tsx`
- Updated `loadTodayShops` signature: added optional `companyId` parameter
- Updated `loadAllShops` signature: added optional `companyId` parameter
- Updated `triggerFullSync` signature: added optional `companyId` parameter
- Updated `fetchShopsForUser` to pass `companyId` to API
- All changes backward compatible (companyId is optional)

### 6. `app/(tabs)/index.tsx`
- Import CompanySelector component
- Destructure `companies`, `selectedCompanyId`, `setSelectedCompanyId` from useAuth
- Add CompanySelector in hero card header (both All Routes and Normal modes)
- Use `selectedCompanyId` instead of `user?.companyId` throughout:
  - Shop balance calculations (totalOutstanding)
  - ShopCard companyId prop
  - RecoveryBottomSheet companyId prop
  - ShopDetailModal companyId prop
  - submitRecovery companyId prop
  - Notification companyName uses selectedCompanyName
  - openingBalance uses getShopDisplayBalance with selectedCompanyId
- Add `selectedCompanyId` to useEffect dependencies for loading shops
- Add `selectedCompanyName` computed value for notification payloads
- Re-fetch shops when selectedCompanyId changes

### 7. `app/(tabs)/profile.tsx`
- Destructure `companies`, `selectedCompanyId` from useAuth
- Show selected company name in profile info section

### 8. `app/(tabs)/ledger.tsx`
- Destructure `selectedCompanyId`, `companies` from useAuth
- Use selectedCompanyId for balance display in shop picker
- Use selected company name for PDF generation

### 9. `services/offlineSync.ts`
- Updated offline recovery sync to prefer selectedCompanyId from storage
- Falls back to user.companyId for backward compatibility

## Backward Compatibility
- All new parameters are optional
- If user has no `companies` array, behavior is exactly the same as before
- `selectedCompanyId` defaults to `user.companyId` if not explicitly set
- Single company users see no dropdown arrow

## TypeScript Verification
- All new code compiles cleanly (no new TS errors introduced)
- Pre-existing TS errors in other files remain unchanged
