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

---

## Backlog / Future Tasks

### P0 (High Priority)
- [ ] **FIX: Bookings FK Constraint** - `bookings.provider_id` (UUID) references `users.id` (INT) incorrectly. Fix in Supabase to reference `users.auth_id`
- [ ] Run Phase 1.9 database migration

### P1 (Medium Priority)
- [ ] Real-time chat/messaging
- [ ] Payment gateway integration (Stripe)
- [ ] Reviews & ratings system

### P2 (Low Priority)
- [ ] Push notifications
- [ ] Calendar integration
- [ ] Advanced analytics dashboard

---

## File Structure

```
/app/
├── backend/
│   ├── server.py                 # Main FastAPI app (with availability endpoints)
│   ├── service_catalog.py        # Service definitions
│   ├── tests/
│   │   ├── test_availability.py
│   │   └── test_availability_phase2.py  # Phase 2.1 tests
│   └── migrations/
│       └── phase19_privacy_identity.sql
└── frontend/
    └── src/
        ├── screens/
        │   ├── ProfileScreen.jsx              # User profile (with Phase 1.9 fields)
        │   ├── ProviderProfileScreen.jsx      # Public provider + date/time slot selection
        │   ├── ProviderAvailabilityScreen.jsx # Provider schedule management (Phase 2.1)
        │   ├── ProviderServicesScreen.jsx     # Service management
        │   ├── ProvidersListScreen.jsx        # Provider list (no email)
        │   └── StylistDashboard.jsx           # Provider dashboard (with Availability card)
        ├── services/
        │   └── api.js                         # API client (with availability methods)
        └── contexts/
            └── AuthContext.jsx                # Auth state management
```

---

## Last Updated
- **Date**: January 16, 2026
- **Phase**: 2.2 - Booking Services Fix
- **Status**: Complete - 29/29 backend tests passing
