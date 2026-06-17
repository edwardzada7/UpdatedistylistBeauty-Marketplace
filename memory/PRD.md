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

- **Phase 2B - In-App Notifications** (March 1, 2026):
  - ✅ **Database**: Uses `notifications` table with columns: id, user_id, message, type, read, created_at, auth_id (uuid)
  - ✅ **Backend Endpoints Fixed**:
    - `GET /api/notifications/me?auth_id=<uuid>` - Queries by `auth_id` column (uuid), not user_id
    - `GET /api/notifications/unread-count?auth_id=<uuid>` - Returns `{count, unread}` 
    - `POST /api/notifications/mark-read` - Accepts `notification_ids` array or `mark_all: true`
  - ✅ **Notification Events Integrated**:
    - Booking: created, confirmed, declined, canceled, completed
    - Withdrawal: requested, approved, rejected
    - Wallet: topup_success
  - ✅ **Frontend Components**:
    - `NotificationsScreen.jsx` - Shows list with fallback title from type, handles missing title field
    - `NotificationBell.jsx` - Bell icon with unread badge count
  - ✅ **Bell Icon Added To**:
    - HomeScreen header
    - StylistDashboard header
    - ProfileScreen header
  - ✅ **Testing**: 17/17 notification tests passed
  - ✅ **Debug Logging**: Backend logs auth_id and result counts for troubleshooting

---

## Backlog / Future Tasks

### P0 (High Priority)
- [x] ~~Payment gateway integration (Paystack for wallet top-up)~~ - **DONE**
- [x] ~~Wallet-based booking payments~~ - **DONE** (Phase 2.2.1)
- [x] ~~Provider withdrawal requests~~ - **DONE** (Phase A)
- [x] ~~Admin Panel UI for withdrawal approvals~~ - **DONE** (Phase A.1)
- [x] ~~Wallet/Earnings section on Stylist Dashboard~~ - **DONE** (Phase A.2)
- [x] ~~In-App Notifications~~ - **DONE** (Phase 2B)
- [ ] **REQUIRED**: Run Phase 2.2 database migration for full transaction logging

### P1 (Medium Priority)
- [ ] Reviews & ratings system

### P2 (Low Priority)
- [ ] Real-time chat/messaging
- [ ] Push notifications
- [ ] Calendar integration
- [ ] Advanced analytics dashboard

---

## Database Migrations Required

### Phase 2B - In-App Notifications (REQUIRED)
Run `/app/backend/migrations/phase2B_notifications.sql` in Supabase SQL Editor.

This creates/updates:
- `notifications` table with recipient_auth_id, actor_auth_id, type, title, message, metadata, read, read_at
- Indexes for performance
- RLS policies for user isolation

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
│       ├── phase22_paystack_integration.sql
│       └── phase2B_notifications.sql         # Phase 2B notifications migration
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
        │   ├── AdminWithdrawalsScreen.jsx     # Admin withdrawal dashboard (Phase A.1)
        │   └── NotificationsScreen.jsx        # Notifications list (Phase 2B)
        ├── services/
        │   └── api.js                         # API client (with paymentsAPI, walletsAPI, withdrawalsAPI, notificationsAPI)
        ├── components/
        │   ├── BottomNavigation.jsx           # Updated with Bookings tab, hidden on /admin/*
        │   └── NotificationBell.jsx           # Bell icon with unread badge (Phase 2B)
        └── contexts/
            └── AuthContext.jsx                # Auth state management
```

---

## Last Updated
- **Date**: March 1, 2026
- **Phase**: Phase 3 - Reviews & Ratings (Complete)
- **Status**: Backend 100% (15 review tests passed), Frontend UI complete
- **Key Feature**: Customers can review completed bookings, providers can reply
- **Tested**: All review endpoints working, test review created in database

---

## Phase 3 - Reviews & Ratings

### Backend Endpoints
- `POST /api/reviews?auth_id=X` - Create review (customer only, completed bookings)
- `GET /api/providers/{provider_auth_id}/reviews` - Get provider reviews with aggregates
- `GET /api/reviews/me?auth_id=X&role=customer|provider` - Get my reviews
- `GET /api/reviews/by-booking/{booking_id}?auth_id=X` - Get review for specific booking
- `POST /api/reviews/{review_id}/reply?auth_id=X` - Provider reply to review

### Frontend Components
- `ProviderProfileScreen.jsx` - Reviews section with rating display
- `BookingDetailsScreen.jsx` - Leave review button, review modal, provider reply modal

### Database Schema (reviews table)
```sql
id, booking_id, reviewer_auth_id, provider_auth_id, rating (1-5), 
comment, provider_reply, created_at, replied_at
UNIQUE(booking_id, reviewer_auth_id)
```

---

## Bug Fixes

### Login Flow Crash (Fixed - March 1, 2026)
**Problem**: App crashed with "Failed to execute 'json' on 'Response': body stream already read" when users entered incorrect credentials.

**Root Cause**: The Supabase SDK internally reads the response body multiple times when authentication fails with 400 status, causing a JavaScript error that propagated to the UI.

**Solution**: Added defensive error handling in `authService.js` and `LoginScreen.jsx`:
- Detect "body stream already read" errors and convert to user-friendly message
- Show "Invalid login credentials" instead of technical error
- App stays on login page, no crash, loading state resets properly

**Files Modified**:
- `/app/frontend/src/services/authService.js` - Added body stream error detection in catch block
- `/app/frontend/src/screens/LoginScreen.jsx` - Added safer error message extraction


### No-Show Blank Page Crash (Fixed - Feb 16, 2026)
**Problem**: Tapping "Mark User No-Show" / "Provider Didn't Show" / "Dispute" on the booking details screen rendered a blank page — a launch-blocking bug for the dispute flow.

**Root Cause**: `BookingDetailsScreen.jsx` used `<Label>` inside the no-show report modal (line 1017) and the dispute modal (line 1111), but never imported the `Label` component. The moment a user opened either modal, React encountered an undefined component reference and crashed the entire subtree → blank page.

**Solution**: Added the missing import:
```js
import { Label } from "@/components/ui/label";
```

**Files Modified**:
- `/app/frontend/src/screens/BookingDetailsScreen.jsx` — added one-line `Label` import (additive, no refactor)

**Known Adjacent Bug (NOT fixed — out of audit scope)**:
- Line 188 of the same file calls `fetchBookingDetails()` after a successful wallet payment, but the function is named `fetchBooking`. This swallows successful payments into the catch block as errors. Recommend a 1-line rename in a follow-up audit credit.


### Launch-Blocking Audit — Pass 2 (Fixed - Feb 16, 2026)

**1. Wallet-Pay Success Handler — `fetchBookingDetails is not defined` (Fixed)**
- File: `/app/frontend/src/screens/BookingDetailsScreen.jsx` line 188
- After a successful wallet payment, code called `fetchBookingDetails()` — function doesn't exist (real name is `fetchBooking`). Successful payments were getting swallowed into the catch block as errors.
- Fix: renamed call to `fetchBooking()`.

**2. Booking Reminder Scheduler — Silently Dead Since May 29, 2026 (Fixed)** 🔴 CRITICAL
- Symptom: backend logs showed `[reminder_scheduler] failed to start: No module named 'tzlocal'` on every boot for ~3 weeks.
- Impact:
  - ❌ NO booking reminder notifications were ever sent (2h + 30m before appointments)
  - ❌ NO-show auto-finalization NEVER ran → disputed/no-show escrows could hang indefinitely without manual admin intervention
- Root cause: APScheduler 3.10.4 requires `tzlocal` to resolve the `timezone="Africa/Lagos"` argument; the package was missing from `requirements.txt`.
- Fix:
  - `pip install tzlocal==5.4`
  - `requirements.txt` regenerated via `pip freeze`
  - Verified `[scheduler] started - booking reminders + no-show finalization (every 5 min)` on restart
  - Manually triggered `/api/admin/booking-reminders/run` — returned `{"success":true,"stats":{"scanned":0,...}}`, confirming the job executes the Supabase query without errors.

**3. Provider Dashboard Available Balance Reads Wrong Column (Fixed)** 🔴 LAUNCH-BLOCKER
- File: `/app/backend/server.py` `/api/providers/dashboard-metrics` endpoint (line 3049)
- Bug: read `wallets.available_balance` with NO fallback, but every escrow-release write path in the codebase updates the legacy `wallets.balance` column. On any wallet row whose `available_balance` column is null, the provider dashboard showed **₦0** even when `/api/wallet/me` showed the correct balance.
- Fix: added 1-line fallback to `balance` column — same pattern already used in `/api/wallet/me/computed` (line ~2313).
```python
avail_raw = w.get("available_balance")
if avail_raw is None:
    avail_raw = w.get("balance")
result["available_balance"] = float(avail_raw or 0)
```

**4. Flutterwave Verification + Webhook Hash — AUDIT PASSED (No Changes)** ✅
- Initialize → Verify → Webhook flow inspected end-to-end (server.py lines 1530–1972).
- Verified safeguards:
  - ✅ HMAC constant-time signature compare on `verif-hash` header
  - ✅ Pre-call idempotency check on `payments` table (returns cached success if already processed)
  - ✅ Re-verifies via FLW `/transactions/verify_by_reference` from webhook handler — does NOT trust webhook payload
  - ✅ Currency check (NGN expected, others logged)
  - ✅ Amount mismatch protection (rejects > 0.01 NGN delta as 400)
  - ✅ Wallet credit failure raises 500 to prevent false-success state
  - ✅ Final `processed=True` gate set only after credit succeeds
- Empirically validated by user's live ₦100 top-up + webhook + wallet/history update prior to this audit.

**Files Modified in Pass 2**:
- `/app/frontend/src/screens/BookingDetailsScreen.jsx` (renamed call)
- `/app/backend/server.py` (added `balance` fallback in dashboard-metrics)
- `/app/backend/requirements.txt` (added `tzlocal==5.4`)
- No schema changes. No refactors. No feature additions.


### Vercel Deployment Blocker — ESLint Warnings-as-Errors (Fixed - Feb 17, 2026)

**Problem**: Vercel build failed at "Creating an optimized production build... Treating warnings as errors because process.env.CI = true. Failed to compile." Adding `CI=false` env var to Vercel did not resolve the issue (Vercel internally forces `CI=true`).

**Root Cause**: 10 `react-hooks/exhaustive-deps` lint warnings across 6 screen files. CRA's `build` script escalates all ESLint warnings to errors when `CI=true`, which Vercel sets unconditionally for every build.

**Fix (Option D — proper useCallback refactor)**: Wrapped each helper function (`fetchBooking`, `fetchExistingReview`, `fetchTopProviders`, `fetchFeedPreview`, `loadAvailability`, `fetchBookings`, `fetchProviderProfile`, `fetchProviderReviews`, `fetchPortfolioPosts`, `fetchProviders`, `applyFilters`) in `useCallback` with proper dependency arrays, then added each wrapped function to its triggering `useEffect`'s deps. Reordered declarations to avoid temporal dead zone (useCallback definitions now precede the useEffects that consume them).

**Special case — `ProvidersListScreen.fetchProviders`**: `sortBy` is read inside the function (for the legacy stylists API fallback only) but client-side sort already runs via `applyFilters` whenever `sortBy` changes. Including `sortBy` in fetchProviders' deps would trigger an unnecessary server round-trip on every sort click. Used `// eslint-disable-next-line react-hooks/exhaustive-deps` with a comment explaining the deliberate omission. This is the React-team-endorsed pattern for intentional dep exclusions.

**Cleanup bug fixed in the same pass**: Removed orphan `tailsScreen;` token at end of `BookingDetailsScreen.jsx` (leftover from a prior botched edit). This was causing a runtime `ReferenceError` after the refactor.

**Verification**:
- `CI=true yarn build` → `Compiled successfully.` (was previously `Failed to compile.`)
- Preview URL smoke-tested: login screen renders cleanly, zero console errors

**Files Modified**:
- `frontend/src/screens/BookingDetailsScreen.jsx`
- `frontend/src/screens/HomeScreen.jsx`
- `frontend/src/screens/ProviderAvailabilityScreen.jsx`
- `frontend/src/screens/ProviderBookingsScreen.jsx`
- `frontend/src/screens/ProviderProfileScreen.jsx`
- `frontend/src/screens/ProvidersListScreen.jsx`


### Lambda 503 MB Bundle Bloat — Fixed (Feb 17, 2026)

**Problem**: Vercel reported `Total bundle size (503.37 MB) exceeds Lambda ephemeral storage limit (500 MB)` when packaging the backend Python serverless function.

**Root Cause**: `/app/backend/requirements.txt` contained 144 packages, of which only **6** were actually imported by the backend code. The file had been regenerated via `pip freeze` against the Emergent dev-pod environment (which has the entire kitchen sink — pandas, litellm, mypy, boto3, stripe SDK, huggingface, etc., none of which iStylist uses).

**Fix**: Hand-curated `requirements.txt` to 13 essential packages → installed footprint reduced to ~139 MB (62 packages including transitives). Saved original as `requirements.txt.bloated.bak`.

**Curated list (13 lines)**:
- Web framework: `fastapi`, `starlette`, `uvicorn`, `python-multipart`, `email-validator`
- Validation: `pydantic`
- HTTP: `requests`, `httpx`
- DB/Auth: `supabase`
- Config: `python-dotenv`
- Scheduler: `APScheduler`, `pytz`, `tzlocal`

**Validation completed**:
- Fresh venv install → 62 packages, 139 MB total
- `from server import app` → 108 routes registered
- Live backend restart → scheduler started (booking reminders + no-show finalization)
- Endpoints verified: Flutterwave init/verify/webhook (422/400/401 — validation-error responses prove routes registered), wallet, transactions, bookings, staff, admin/booking-reminders — all responded correctly
- Litellm Emergent-only wheel URL removed.

**Files Modified**:
- `/app/backend/requirements.txt` (rewritten, 13 lines, ~139 MB installed footprint)
- `/app/backend/requirements.txt.bloated.bak` (original 144-line file preserved for rollback)
