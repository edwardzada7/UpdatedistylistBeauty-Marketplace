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

### Phase 1.9.2 - Gender Visibility Fix ✅
- Gender field now included in provider full-profile API
- Gender displayed on user-facing provider profile (when not null)
- "prefer_not_to_say" option hidden from public view
- Email and phone remain hidden (privacy preserved)

---

## Backlog / Future Tasks

### P0 (High Priority)
- [ ] Run Phase 1.9 database migration
- [ ] Booking system implementation
- [ ] Provider dashboard completion

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
│   ├── server.py                 # Main FastAPI app
│   ├── service_catalog.py        # Service definitions
│   └── migrations/
│       └── phase19_privacy_identity.sql
└── frontend/
    └── src/
        ├── screens/
        │   ├── ProfileScreen.jsx           # User profile (with Phase 1.9 fields)
        │   ├── ProviderProfileScreen.jsx   # Public provider profile (no email)
        │   ├── ProvidersListScreen.jsx     # Provider list (no email)
        │   └── StylistDashboard.jsx        # Provider dashboard
        ├── services/
        │   └── api.js                      # API client
        └── contexts/
            └── AuthContext.jsx             # Auth state management
```

---

## Last Updated
- **Date**: January 15, 2026
- **Phase**: 1.9.1 - Service UX Improvements
- **Status**: Complete - All tests passed
