# iStylist - Beauty Marketplace App

## Product Requirements Document

### Overview
iStylist is a beauty services marketplace that connects customers with service providers (stylists, makeup artists, barbers, etc.). The platform enables customers to browse, compare, and book beauty services while allowing providers to manage their services, pricing, and bookings.

### Tech Stack
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

---

## Core Requirements

### User Types
1. **Customers** - Browse and book services
2. **Providers** (Stylists) - Offer and manage services

### Phase 1.9 - Privacy & Trust (CURRENT) ✅
Implemented privacy controls and trust features:

#### Email Privacy
- ✅ Email is read-only in profile edit forms (sourced from Supabase Auth)
- ✅ Email is NOT shown on public provider profiles
- ✅ Email is NOT shown in provider listing cards
- ✅ Email appears only in private account screens

#### Location Fields
- ✅ Country and City fields added to user profile
- ✅ Only City shown publicly on provider cards and profiles
- ✅ No street address, GPS, or maps

#### Gender Field
- ✅ Optional gender field (male, female, other, prefer_not_to_say)
- ✅ Not prominently displayed on public profiles
- ✅ Available for filtering/future use

#### Provider Type
- ✅ Provider can be "individual" or "business"
- ✅ Business type requires business_name
- ✅ Public profile shows business_name for business type
- ✅ Display name logic: business_name for business, personal name for individual

#### Profile Save Stability
- ✅ Backend uses graceful fallback for new DB columns
- ✅ Profile updates preserve existing data
- ⚠️ DB Migration Required: New columns need to be added to Supabase

---

## Database Schema

### Users Table
```sql
id, auth_id, name, email, phone, role, phone_verified, profile_completed
-- Phase 1.9 additions (migration required):
-- country, city, gender
```

### Stylists Table
```sql
user_id, hourly_rate, is_verified, is_premium, bio, location, rating
-- Phase 1.9 additions (migration required):
-- provider_type, business_name
```

### Services Table
```sql
id, stylist_id, name, category, price, duration
```

---

## API Endpoints

### Public Provider Endpoints
- `GET /api/providers/with-services` - List providers with active services
- `GET /api/providers/{id}/full-profile` - Get full provider profile for booking

**Privacy Note**: These endpoints NEVER return email addresses.

### User Management
- `GET /api/users/by-auth/{auth_id}` - Get user by auth ID
- `PUT /api/users/{user_id}` - Update user (email NOT editable)

### Provider Management
- `PUT /api/stylists/{user_id}` - Update provider profile
- `GET /api/provider-services/{provider_id}` - Get provider services

---

## Pending Database Migration

To enable Phase 1.9 features fully, run this SQL in Supabase:

```sql
-- Users table additions
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);

-- Stylists table additions
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'individual';
ALTER TABLE stylists ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
```

---

## What's Implemented

### Phase 1.0 - Foundation ✅
- Authentication (email/password)
- User registration with role selection
- Basic user and provider profiles

### Phase 1.3 - Service Management ✅
- Provider service catalog
- Service toggle (enable/disable)
- Price and duration settings

### Phase 1.4 - Provider Listing ✅
- Browse providers with active services
- Filter by category, service type
- Starting price display

### Phase 1.9 - Privacy & Trust ✅
- Email privacy controls
- Location fields (country/city)
- Gender field (optional)
- Provider type (individual/business)
- Profile save stability

### Phase 1.9.1 - Service UX Improvements ✅ (NEW)
- Service description support (optional per service)
- Back button on Provider Services screen
- Descriptions displayed to users on booking page
- No changes to pricing, duration, or toggle logic

### Phase 2.0 - Backend Availability System ✅
- Weekly availability schedule per provider (7 days)
- Exception dates (day off or custom hours)
- Booking rules (max sessions, min notice, slot step)
- Available slots generation with conflict checking
- Booking validation against available slots
- **Note**: Booking creation requires fixing foreign key constraint in Supabase

### Phase 2.1 - Frontend Availability & Booking UI ✅ (January 16, 2026)
- **Provider Availability Screen** (`/provider/availability`):
  - Weekly schedule toggles with time inputs for each day
  - Exception date management (day off or custom hours)
  - Booking rules configuration (slot step, min notice, max sessions)
  - Single "Save All Settings" button wiring to backend APIs
  - Back navigation to provider dashboard
- **User Date/Time Slot Selection** (ProviderProfileScreen):
  - Service selection step with checkboxes and total calculation
  - Date picker for booking date (30-day window)
  - Available time slots fetched from backend API
  - Slot selection with visual feedback
  - Booking notes (optional)
  - Confirm booking button submits with date/time
  - 409 conflict handling with user-friendly toast
- **Navigation**: Dashboard "Availability" card links to availability screen
- **Backend fix**: Updated rules endpoint to use `upsert` for DB compatibility

### Phase 2.2 - Booking Services Fix ✅ (January 16, 2026)
- **Bug Fixed**: POST /api/bookings now properly inserts into `booking_services` table
- **Changes**:
  - Validates selected `service_ids` against the `services` table
  - Fetches price and duration from provider's services
  - Inserts `booking_services` rows with: `booking_id`, `service_id`, `price`, `duration_minutes`
  - Attempts to populate `provider_service_id` if `provider_services` table exists with matching data
  - Gracefully handles FK constraint failures by retrying without `provider_service_id`
  - Fixed `time_to_minutes()` to handle HH:MM:SS format
  - Fixed duplicate route registration for available-slots endpoint
- **Tests Added**: `/app/backend/tests/test_booking_services.py` (7 tests)
- **All 29 backend tests passing**

### Phase 2.3 - Bookings Views & Status Management ✅ (January 16, 2026)
**Complete Booking Loop Implementation:**

- **Customer "My Bookings" Screen** (`/bookings`):
  - Upcoming tab (pending/confirmed bookings with future dates)
  - Past tab (completed/canceled/declined or past dates)
  - Each card shows: provider name, date, time, services, status badge, total amount
  - Click navigates to booking details
  - Added to BottomNavigation for customers

- **Provider "Bookings" Screen** (`/provider/bookings`):
  - Tabs: Pending, Confirmed, Completed, Canceled/Declined
  - Quick actions on pending cards: Confirm / Decline buttons
  - Click navigates to booking details
  - Dashboard booking cards now navigate here
  - Added to BottomNavigation for providers

- **Booking Details Screen** (`/bookings/:id`) - Shared:
  - Shows: Status, person info (provider/customer), date/time
  - Services list with names, prices, durations from booking_services
  - Totals: total_amount + total_duration
  - Actions based on role:
    - Customer: Cancel (pending/confirmed), Rebook CTA (future)
    - Provider: Confirm/Decline (pending), Complete (confirmed), Cancel

- **Backend API Enhancements**:
  - GET /api/bookings - New filters: role, auth_id, status, date_from, date_to
  - GET /api/bookings/{id} - Returns full details with computed fields
  - PUT /api/bookings/{id} - Status transitions with role-based validation
  - Computed fields: services[], total_amount, total_duration, provider_display_name, customer_display_name

- **Status Transition Rules**:
  - Provider: pending→confirmed/declined/canceled, confirmed→completed/canceled
  - Customer: pending→canceled, confirmed→canceled

- **Tests Added**: 
  - `/app/backend/tests/test_bookings_views.py` (13 tests)
  - `/app/backend/tests/test_bookings_phase22.py` (32 tests)
- **Backend Tests**: 97% pass rate (44/45 tests)

### Phase 2.4 - Booking Visibility Fix ✅ (January 16, 2026)
**Fixed: Customer "My Bookings" showing no bookings, Provider dashboard showing zero counts**

- **Root Cause**: Filtering by wrong ID fields (bigint customer_id instead of UUID customer_auth_id)

- **Backend Fixes**:
  - POST /api/bookings now sets `customer_auth_id` (UUID) in addition to `customer_id` (integer)
  - GET /api/bookings filters by `customer_auth_id` when role=customer
  - GET /api/bookings filters by `provider_id` (UUID) when role=provider
  - Added GET /api/providers/metrics?auth_id=UUID endpoint for dashboard counts
  - Added POST /api/migrate/backfill-customer-auth-ids for existing data

- **Frontend Fixes**:
  - ProviderProfileScreen.jsx passes `customer_auth_id` when creating bookings
  - StylistDashboard.jsx fetches real metrics via bookingsAPI.getProviderMetrics(authId)
  - CustomerBookingsScreen.jsx correctly uses auth_id for filtering

- **Tests Added**: `/app/backend/tests/test_booking_visibility_fix.py` (13 tests)
- **Backend Tests**: 100% pass rate (13/13)

- **UI Accessibility Fix** (January 17, 2026):
  - Removed `sm:hidden` from BottomNavigation to show on all screen sizes
  - Added `data-testid` attributes to navigation buttons for testability
  - Verified CustomerBookingsScreen route `/bookings` is reachable
  - Verified Bookings tab appears in bottom navigation for customers

- **Phase 2.2 - Paystack Payment Integration** (January 17, 2026):
  - ✅ Backend: `POST /api/payments/paystack/initialize` - Initialize payment for wallet top-up ONLY
  - ✅ Backend: `GET /api/payments/paystack/verify` - Verify transaction & update wallet balances (idempotent)
  - ✅ Backend: `POST /api/webhooks/paystack` - Handle `charge.success` events with signature verification
  - ✅ Backend: `GET /api/wallet/me` - Get wallet balances (available_balance, escrow_balance)
  - ✅ Backend: `GET /api/wallet/transactions` - Get transaction history
  - ✅ Backend: Escrow release on booking `completed`, refund on `canceled`
  - ✅ Backend: Added `pending_payment` status to valid booking statuses
  - ✅ Frontend: WalletScreen with real balances, top-up flow, transactions
  - ✅ Frontend: CustomerBookingsScreen shows `pending_payment` status with Pay from Wallet button
  - ✅ Frontend: BookingDetailsScreen shows Pay from Wallet button for pending_payment bookings
  - ✅ Frontend: ProviderProfileScreen creates booking with `pending_payment` status and wallet payment
  - ⚠️ **REQUIRES**: Run SQL migration `/app/backend/migrations/phase22_paystack_integration.sql`
  - ⚠️ **REQUIRES**: Configure real Paystack TEST keys in `.env` files (for wallet top-up)

- **Phase 2.2.1 - Wallet-Based Booking Payments** (January 19, 2026):
  - ✅ Backend: `POST /api/bookings/{id}/pay-with-wallet` - Pay for booking using wallet balance
  - ✅ Backend: Paystack now REJECTS `booking_escrow` purpose (only `wallet_topup` allowed)
  - ✅ Backend: Wallet payment: deducts from available_balance, adds to escrow_balance
  - ✅ Backend: 402 response when insufficient funds with `needed`, `available`, `shortfall`
  - ✅ Backend: Idempotency - no double-debit on repeated calls
  - ✅ Backend: Escrow release/refund with idempotency guards (checks wallet_transactions)
  - ✅ Frontend: ProviderProfileScreen - new `payment` step with wallet balance display
  - ✅ Frontend: "Pay from Wallet" button with Wallet icon (replaces "Pay Now")
  - ✅ Frontend: Insufficient funds shows "Top Up Wallet" button linking to wallet screen
  - ✅ **Testing**: 30/30 backend tests passed

- **Phase 2.2.2 - Wallet Transaction & Idempotency Fixes** (January 19, 2026):
  - ✅ **Transaction Logging**: Fixed to use proper DB constraint values (`type: 'credit'|'debit'`, `direction: 'credit'|'debit'`, `status: 'completed'`)
  - ✅ **auth_id Always Set**: All wallet_transactions now include both `user_auth_id` and `auth_id` fields
  - ✅ **Idempotency via Payments Table**: Uses `payments.reference` and `payments.processed` as source of truth
  - ✅ **Double-Processing Fixed**: Same Paystack reference or wallet payment cannot credit/debit twice
  - ✅ **Declined Status Refund**: Both `canceled` AND `declined` now trigger escrow refund to customer
  - ✅ **Performance Optimization**: Bookings list reduced from ~25s to ~0.4s (batched queries, no N+1)
  - ✅ **Testing**: 22/22 backend tests passed (test_wallet_payment.py + test_wallet_fixes.py)

- **Phase 2.2.3 - Escrow Refund Fix** (January 19, 2026):
  - ✅ **Refund Now Works**: Cancel/decline bookings now properly refund escrow → available_balance
  - ✅ **Robust Refund Detection**: Checks payment_status OR payment records OR escrow balance presence
  - ✅ **Amount Lookup Enhanced**: Tries booking_services → booking.total_amount → booking.service_price → payment records
  - ✅ **Idempotency**: Uses payments table reference to prevent double-refund/release
  - ✅ **Testing**: 55/55 backend tests passed (all wallet + escrow tests)

- **Phase A - Provider Withdrawal Requests** (March 1, 2026):
  - ✅ **Backend Endpoints**:
    - `POST /api/withdrawals/request` - Provider submits withdrawal request (validates balance, creates pending request)
    - `GET /api/withdrawals/me` - Provider views their withdrawal requests history
    - `PUT /api/admin/withdrawals/{id}` - Admin approves/rejects requests (protected by X-ADMIN-KEY)
  - ✅ **Withdrawal Flow**:
    - Provider requests withdrawal with bank details (amount, bank_name, account_name, account_number, note)
    - Balance is NOT deducted until admin approval
    - Creates wallet_transaction log with status='pending'
    - Admin can approve (deducts balance, status='approved') or reject (no balance change, status='rejected')
  - ✅ **Frontend Updates** (WalletScreen.jsx):
    - "Withdraw Funds" button for providers
    - Withdrawal request modal with bank details form
    - Withdrawal requests history list showing status badges
  - ✅ **Security**: Admin endpoint protected by ADMIN_DASH_KEY environment variable
  - ✅ **Validation**: Account number must be 10 digits, amount must be positive and <= available_balance
  - ✅ **Idempotency**: Cannot re-process already approved/rejected requests (409 Conflict)
  - ✅ **Testing**: 17/17 backend tests passed (test_withdrawals.py)

- **Phase A.1 - Admin Dashboard UI** (March 1, 2026):
  - ✅ **Backend Endpoint Added**:
    - `GET /api/admin/withdrawals` - List all withdrawals with status/pagination filters (protected by X-ADMIN-KEY)
  - ✅ **Admin Login Screen** (`/admin`):
    - Admin key input with validation
    - Stores key in sessionStorage on successful login
    - Auto-redirects to dashboard if already logged in
  - ✅ **Admin Withdrawals Dashboard** (`/admin/withdrawals`):
    - Tabs: Pending, Approved, Rejected, All
    - Table view (desktop) / Card view (mobile)
    - Search by ID, provider, bank name, account name
    - Approve button (one-click, deducts balance)
    - Reject button (opens modal requiring reason)
    - Logout button (clears session)
  - ✅ **Security Features**:
    - All requests require X-ADMIN-KEY header
    - 401 response clears session and redirects to login
    - BottomNavigation hidden on admin routes
  - ✅ **Testing**: UI manually tested, approve/reject working

- **Phase A.2 - Provider Dashboard Earnings UI** (March 1, 2026):
  - ✅ **Backend Endpoint Added**:
    - `GET /api/providers/dashboard-metrics` - Returns wallet balances, earnings summaries, pending withdrawals, and recent transactions
  - ✅ **Dashboard Metrics Response**:
    - `available_balance`, `escrow_balance`, `total_balance`
    - `total_earnings` (all-time from credit transactions)
    - `last_7_days_earnings`, `last_30_days_earnings`
    - `pending_withdrawals_total`
    - `recent_transactions` (last 10)
  - ✅ **StylistDashboard.jsx Updated**:
    - Wallet & Earnings card with balance breakdown (Available, Escrow, Total)
    - Earnings summary cards (All Time, 7 Days, 30 Days)
    - Pending withdrawals indicator
    - Withdraw and View All buttons
    - Recent Transactions list (last 5 on dashboard)
    - Refresh button for metrics
    - Loading and error states
  - ✅ **API Client Updated**: `providersAPI.getDashboardMetrics(authId)`
  - ✅ **Testing**: 23/23 backend tests passed (including 6 new dashboard metrics tests)
  - ✅ **Performance**: Single API call for all metrics, limited transactions to 10

---

## Backlog / Future Tasks

### P0 (High Priority)
- [x] ~~Payment gateway integration (Paystack for wallet top-up)~~ - **DONE**
- [x] ~~Wallet-based booking payments~~ - **DONE** (Phase 2.2.1)
- [x] ~~Provider withdrawal requests~~ - **DONE** (Phase A)
- [x] ~~Admin Panel UI for withdrawal approvals~~ - **DONE** (Phase A.1)
- [x] ~~Wallet/Earnings section on Stylist Dashboard~~ - **DONE** (Phase A.2)
- [ ] **REQUIRED**: Run Phase 2.2 database migration for full transaction logging:
  - `wallet_transactions.user_auth_id` column
  - `bookings.payment_status` and `bookings.payment_reference` columns

### P1 (Medium Priority)
- [ ] Notifications for booking status changes
- [ ] Reviews & ratings system

### P2 (Low Priority)
- [ ] Real-time chat/messaging
- [ ] Push notifications
- [ ] Calendar integration
- [ ] Advanced analytics dashboard

---

## Database Migrations Required

### Phase 2.2 - Paystack Integration (PENDING)
Run `/app/backend/migrations/phase22_paystack_integration.sql` in Supabase SQL Editor.

This creates/updates:
- `wallet_transactions` table with `user_auth_id` column
- `payments` table for tracking payment records
- `webhook_logs` table for audit trail
- Adds `escrow_balance` to `wallets` table
- Adds `payment_reference`, `payment_status` to `bookings` table

### Phase A - Withdrawal Requests (ALREADY DONE)
The `withdrawal_requests` table and RLS policies were already created by the user in Supabase.
Table columns: id, provider_auth_id, amount, currency, bank_name, account_name, account_number, status, note, created_at, updated_at

---

## File Structure

```
/app/
├── backend/
│   ├── server.py                 # Main FastAPI app (with Paystack, wallet, withdrawal, admin APIs)
│   ├── service_catalog.py        # Service definitions
│   ├── tests/
│   │   ├── test_availability.py
│   │   ├── test_availability_phase2.py  # Phase 2.1 tests
│   │   ├── test_booking_services.py     # Phase 2.2 tests
│   │   ├── test_bookings_views.py       # Phase 2.3 tests
│   │   ├── test_bookings_phase22.py     # Phase 2.3 extended tests
│   │   ├── test_paystack_payments.py    # Phase 2.2 Paystack tests (23 tests)
│   │   └── test_withdrawals.py          # Phase A withdrawal tests (17 tests)
│   └── migrations/
│       ├── phase19_privacy_identity.sql
│       └── phase22_paystack_integration.sql
└── frontend/
    └── src/
        ├── screens/
        │   ├── ProfileScreen.jsx              # User profile
        │   ├── ProviderProfileScreen.jsx      # Public provider + booking with payment
        │   ├── ProviderAvailabilityScreen.jsx # Provider schedule management
        │   ├── ProviderServicesScreen.jsx     # Service management
        │   ├── ProvidersListScreen.jsx        # Provider list
        │   ├── StylistDashboard.jsx           # Provider dashboard
        │   ├── CustomerBookingsScreen.jsx     # Customer bookings with Pay Now
        │   ├── ProviderBookingsScreen.jsx     # Provider bookings list
        │   ├── BookingDetailsScreen.jsx       # Booking details with Pay Now
        │   ├── WalletScreen.jsx               # Wallet with top-up (customer) and withdraw (provider)
        │   ├── AdminLoginScreen.jsx           # Admin login (Phase A.1)
        │   └── AdminWithdrawalsScreen.jsx     # Admin withdrawal dashboard (Phase A.1)
        ├── services/
        │   └── api.js                         # API client (with paymentsAPI, walletsAPI, withdrawalsAPI, providersAPI.getDashboardMetrics)
        ├── components/
        │   └── BottomNavigation.jsx           # Updated with Bookings tab, hidden on /admin/*
        └── contexts/
            └── AuthContext.jsx                # Auth state management
```

---

## Last Updated
- **Date**: March 1, 2026
- **Phase**: Phase A.2 - Provider Dashboard Earnings UI (Complete)
- **Status**: Backend 100% (23/23 tests passed), Frontend UI complete
- **Key Feature**: Provider Dashboard shows wallet balances, earnings summaries, pending withdrawals, and recent transactions
