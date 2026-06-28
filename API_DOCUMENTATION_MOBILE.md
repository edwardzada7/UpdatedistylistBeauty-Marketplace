# iStylist API Documentation - Mobile App Integration

## 🌐 Production Backend

**Base URL:** `https://mongo-supabase-api.emergent.host`  
**API Base:** `https://mongo-supabase-api.emergent.host/api`

---

## 📚 Interactive Documentation

### Swagger UI (Recommended for Testing)
```
https://mongo-supabase-api.emergent.host/docs
```
- **Interactive:** Test all endpoints directly
- **Authentication:** Built-in JWT token input
- **Schemas:** See request/response models
- **Examples:** Sample requests/responses

### ReDoc (Recommended for Reading)
```
https://mongo-supabase-api.emergent.host/redoc
```
- **Clean UI:** Better readability
- **Mobile-friendly:** Works on mobile browsers
- **Searchable:** Quick endpoint lookup

### OpenAPI Specification
```
https://mongo-supabase-api.emergent.host/openapi.json
```
- **Import to:** Postman, Insomnia, Swagger Editor
- **Code Generation:** Use for SDK generation
- **Contract:** API specification for testing

---

## 🔐 Authentication

### JWT Bearer Token
All authenticated endpoints require:

```http
Authorization: Bearer <jwt_token>
```

### Get JWT Token
**Endpoint:** `POST /api/users` (signup) or login endpoint  
**Response includes:** `token` field

**Example:**
```javascript
// Store token after login/signup
const token = response.data.token;

// Use in subsequent requests
fetch('https://mongo-supabase-api.emergent.host/api/bookings', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### Admin Endpoints
Admin endpoints require `X-ADMIN-KEY` header:

```http
X-ADMIN-KEY: istylist_admin_secret_key_2026
```

---

## 📋 API Endpoints (125 Total)

### 🔵 Authentication & Users (9 endpoints)

#### User Management
```
POST   /api/users                          # Create user (signup)
GET    /api/users                          # List all users
GET    /api/users/{user_id}                # Get user by ID
GET    /api/users/by-auth/{auth_id}        # Get user by auth_id
PUT    /api/users/{user_id}                # Update user
DELETE /api/users/{user_id}                # Delete user
POST   /api/users/delete-account           # Soft delete own account
```

---

### 🟢 Providers (Stylists) (12 endpoints)

#### Provider Registration & Profiles
```
POST   /api/providers/register                     # Register as provider
POST   /api/stylists                               # Legacy: Create stylist
GET    /api/stylists                               # Legacy: List stylists
GET    /api/stylists/{user_id}                     # Legacy: Get stylist
PUT    /api/stylists/{user_id}                     # Legacy: Update stylist
DELETE /api/stylists/{user_id}                     # Legacy: Delete stylist
GET    /api/stylists/by-user/{user_id}             # Get stylist by user
GET    /api/providers/with-services                # Get providers with services
GET    /api/providers/{provider_id}/full-profile   # Get full provider profile
GET    /api/providers/metrics                      # Provider metrics
GET    /api/providers/dashboard-metrics            # Dashboard stats
GET    /api/providers/{provider_auth_id}/reviews   # Get provider reviews
```

---

### 🟡 Services (15 endpoints)

#### Service Catalog
```
GET    /api/catalog/categories                 # Get all service categories
GET    /api/catalog/categories/{category_id}   # Get category details
GET    /api/catalog/services                   # Get all services
GET    /api/catalog/services/{service_id}      # Get service details
GET    /api/catalog/sub-services               # Get sub-services
GET    /api/catalog/sub-services/{service_id}  # Get service sub-services
```

#### Provider Services
```
POST   /api/provider-services                          # Add service to provider
GET    /api/provider-services/{provider_id}            # Get provider's services
PUT    /api/provider-services/{service_id}             # Update provider service
DELETE /api/provider-services/{service_id}             # Remove provider service
POST   /api/provider-services/toggle/{provider_id}    # Enable/disable service
POST   /api/init-provider-services-table              # Admin: Init table
```

---

### 🔴 Bookings (15 endpoints)

#### Booking Management
```
POST   /api/bookings                               # Create booking
GET    /api/bookings                               # Get user's bookings
GET    /api/bookings/{booking_id}                  # Get booking details
PUT    /api/bookings/{booking_id}                  # Update booking status
POST   /api/bookings/{booking_id}/pay-with-wallet  # Pay with wallet
```

#### Booking Chat
```
GET    /api/bookings/{booking_id}/chat              # Get chat messages
POST   /api/bookings/{booking_id}/chat              # Send message
POST   /api/bookings/{booking_id}/chat/mark-read    # Mark messages as read
GET    /api/chat/unread-count                       # Get unread count
```

#### No-Show Management
```
POST   /api/bookings/{booking_id}/no-show/report    # Report no-show
POST   /api/bookings/{booking_id}/no-show/confirm   # Confirm no-show
POST   /api/bookings/{booking_id}/no-show/dispute   # Open dispute
```

---

### 💰 Payments & Wallet (17 endpoints)

#### Wallet Management
```
GET    /api/wallets                        # List all wallets (admin)
POST   /api/wallets                        # Create wallet
GET    /api/wallets/{wallet_id}            # Get wallet by ID
GET    /api/wallets/by-auth/{auth_id}      # Get wallet by auth_id
PUT    /api/wallets/{wallet_id}            # Update wallet
DELETE /api/wallets/{wallet_id}            # Delete wallet
GET    /api/wallet/me                      # Get my wallet
GET    /api/wallet/me/computed             # Get computed wallet balance
GET    /api/wallet/transactions            # Get my transactions
POST   /api/wallets/{wallet_id}/topup      # Top-up wallet
```

#### Payment Processing
```
POST   /api/payments/flutterwave/initialize    # Initialize Flutterwave payment
GET    /api/payments/flutterwave/verify        # Verify Flutterwave payment
POST   /api/payments/paystack/initialize       # Legacy: Initialize Paystack
GET    /api/payments/paystack/verify           # Legacy: Verify Paystack
POST   /api/webhooks/flutterwave              # Flutterwave webhook (system)
POST   /api/webhooks/paystack                 # Paystack webhook (system)
```

---

### 💸 Withdrawals (4 endpoints)

```
POST   /api/withdrawals/request            # Request withdrawal
GET    /api/withdrawals/me                 # Get my withdrawal requests
GET    /api/admin/withdrawals              # Admin: List all withdrawals
PUT    /api/admin/withdrawals/{id}         # Admin: Approve/reject withdrawal
```

---

### ⭐ Reviews (5 endpoints)

```
POST   /api/reviews                         # Create review
GET    /api/reviews/me                      # Get my reviews
GET    /api/reviews/by-booking/{id}         # Get review for booking
POST   /api/reviews/{review_id}/reply       # Provider reply to review
```

---

### 📅 Availability (7 endpoints)

#### Provider Availability
```
GET    /api/providers/{provider_id}/availability         # Get availability
POST   /api/providers/{provider_id}/availability         # Set availability
GET    /api/providers/{provider_id}/available-slots      # Get available slots
POST   /api/providers/{provider_id}/rules                # Create availability rule
POST   /api/providers/{provider_id}/exceptions           # Create exception
```

#### Staff Availability
```
GET    /api/staff/{staff_id}/available-slots    # Get staff available slots
PUT    /api/staff/{staff_id}/availability       # Update staff availability
```

---

### 👥 Staff Management (7 endpoints)

```
POST   /api/staff                          # Add staff member
GET    /api/staff/me                       # Get my staff profile
GET    /api/staff/{staff_id}               # Get staff details
PUT    /api/staff/{staff_id}               # Update staff
DELETE /api/staff/{staff_id}               # Remove staff
GET    /api/providers/{id}/staff           # Get provider's staff
PUT    /api/staff/{staff_id}/services      # Update staff services
```

---

### 📱 Social Feed (7 endpoints)

```
POST   /api/feed/posts                     # Create post
GET    /api/feed/posts                     # Get feed posts (paginated)
GET    /api/feed/posts/{post_id}           # Get post details
PUT    /api/feed/posts/{post_id}           # Update post
DELETE /api/feed/posts/{post_id}           # Delete post
POST   /api/feed/posts/{post_id}/like      # Like post
DELETE /api/feed/posts/{post_id}/like      # Unlike post
GET    /api/feed/posts/by-provider/{id}    # Get provider's posts
```

---

### 🔔 Notifications (4 endpoints)

```
GET    /api/notifications/me               # Get my notifications
GET    /api/notifications/unread-count     # Get unread count
POST   /api/notifications/mark-read        # Mark notification as read
```

---

### 📄 Legal & Support (6 endpoints)

#### Legal Pages
```
GET    /api/legal                          # List all legal pages
GET    /api/legal/{slug}                   # Get legal page (privacy, terms, etc.)
PUT    /api/admin/legal/{slug}             # Admin: Update legal page
```

#### Support
```
POST   /api/support/tickets                # Submit support ticket
GET    /api/admin/support/tickets          # Admin: List tickets
PUT    /api/admin/support/tickets/{id}     # Admin: Update ticket
```

---

### 🚨 Reports & Safety (4 endpoints)

```
POST   /api/reports                        # Submit report
GET    /api/admin/reports                  # Admin: List reports
PUT    /api/admin/reports/{report_id}      # Admin: Update report status
```

---

### ©️ Copyright (3 endpoints)

```
POST   /api/copyright/report                   # Submit copyright complaint
GET    /api/admin/copyright/complaints         # Admin: List complaints
PUT    /api/admin/copyright/complaints/{id}    # Admin: Update complaint
```

---

### 🛠️ Admin Dashboard (13 endpoints)

```
GET    /api/admin/stats                        # Dashboard statistics
GET    /api/admin/recent-bookings              # Recent bookings
GET    /api/admin/recent-payments              # Recent payments
GET    /api/admin/reported-no-shows            # No-show cases
GET    /api/admin/no-show/cases                # Dispute cases
POST   /api/admin/no-show/resolve              # Resolve dispute
POST   /api/admin/no-show/run                  # Run no-show scheduler
GET    /api/admin/providers                    # List providers
GET    /api/admin/users/deleted                # List deleted users
GET    /api/admin/platform-earnings            # Platform revenue
GET    /api/admin/settings/financial           # Financial settings
PUT    /api/admin/settings/financial           # Update financial settings
GET    /api/settings/withdrawal-fee            # Get withdrawal fee
```

---

### 🏥 Health & Utility (5 endpoints)

```
GET    /api/                               # API info
GET    /api/health                         # Health check
GET    /api/test-connection                # Test DB connection
GET    /api/debug/env                      # Debug environment (dev only)
POST   /api/admin/booking-reminders/run    # Admin: Run reminder scheduler
```

---

## 🔑 Environment Variables for Mobile App

### Required in Mobile App Config

```javascript
const API_CONFIG = {
  BASE_URL: 'https://mongo-supabase-api.emergent.host',
  API_BASE: 'https://mongo-supabase-api.emergent.host/api',
  
  // Flutterwave
  FLW_PUBLIC_KEY: 'FLWPUBK-d41cdd72dafe974d3410ef0383881b22-X',
  
  // Optional
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
};
```

---

## 📱 Mobile App Integration Guide

### 1. Setup API Client

#### React Native / Expo Example

```javascript
import axios from 'axios';

const API = axios.create({
  baseURL: 'https://mongo-supabase-api.emergent.host/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
API.interceptors.request.use((config) => {
  const token = getStoredToken(); // Your token storage method
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      handleLogout();
    }
    return Promise.reject(error);
  }
);

export default API;
```

---

### 2. Authentication Flow

```javascript
// Signup
const signup = async (email, password, name, phone) => {
  const response = await API.post('/users', {
    email,
    password,
    name,
    phone,
    user_type: 'customer', // or 'provider'
  });
  
  const { token, auth_id } = response.data;
  await storeToken(token);
  await storeAuthId(auth_id);
  
  return response.data;
};

// Login (use Supabase client or custom endpoint)
const login = async (email, password) => {
  // Use Supabase auth client
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  await storeToken(data.session.access_token);
  await storeAuthId(data.user.id);
  
  return data;
};
```

---

### 3. Common API Calls

#### Get Providers
```javascript
const getProviders = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await API.get(`/providers/with-services?${params}`);
  return response.data;
};
```

#### Create Booking
```javascript
const createBooking = async (bookingData) => {
  const response = await API.post('/bookings', bookingData);
  return response.data;
};
```

#### Get Wallet Balance
```javascript
const getWalletBalance = async () => {
  const response = await API.get('/wallet/me');
  return response.data;
};
```

#### Top-up Wallet (Flutterwave)
```javascript
const initializeTopup = async (amount) => {
  const response = await API.post('/payments/flutterwave/initialize', {
    amount,
    currency: 'NGN',
    payment_type: 'topup',
  });
  
  // Response includes: payment_link, tx_ref
  return response.data;
};
```

---

### 4. Pagination

Most list endpoints support pagination:

```javascript
const getBookings = async (page = 0, limit = 20) => {
  const response = await API.get(`/bookings?offset=${page * limit}&limit=${limit}`);
  return response.data;
};
```

---

### 5. File Upload (Profile Photos, KYC)

```javascript
const uploadProfilePhoto = async (imageUri) => {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'profile.jpg',
  });
  
  const response = await API.post('/users/upload-photo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data.photo_url;
};
```

---

## 🧪 Testing

### Test Endpoints (Swagger UI)
1. Go to: https://mongo-supabase-api.emergent.host/docs
2. Click "Authorize" button
3. Enter your JWT token
4. Test any endpoint interactively

### Test with cURL
```bash
# Health check
curl https://mongo-supabase-api.emergent.host/api/health

# Get providers (no auth required)
curl https://mongo-supabase-api.emergent.host/api/providers/with-services

# Get my bookings (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mongo-supabase-api.emergent.host/api/bookings
```

---

## 🔒 Security Notes

1. **HTTPS Only:** All requests must use HTTPS
2. **JWT Expiry:** Tokens expire after 7 days, refresh as needed
3. **Rate Limiting:** Not currently enforced, but recommended for future
4. **Sensitive Data:** Never log JWT tokens or API keys
5. **Webhook Security:** Verify webhook signatures (Flutterwave)

---

## 🐛 Common Issues & Solutions

### 401 Unauthorized
- **Cause:** Invalid or expired JWT token
- **Solution:** Re-authenticate user, get new token

### 404 Not Found
- **Cause:** Wrong endpoint or resource doesn't exist
- **Solution:** Check endpoint spelling, verify resource ID

### 422 Unprocessable Entity
- **Cause:** Invalid request body
- **Solution:** Check required fields, data types in Swagger docs

### 500 Internal Server Error
- **Cause:** Server error
- **Solution:** Check backend logs, report to team

---

## 📞 Support

**API Issues:** Check Swagger docs first: https://mongo-supabase-api.emergent.host/docs  
**Backend Logs:** Available via Emergent dashboard  
**Database Issues:** Supabase dashboard

---

## 🔄 API Versioning

**Current Version:** v1 (no version prefix)  
**Breaking Changes:** Will be communicated via email/Slack  
**Deprecation:** 30-day notice before endpoint removal

---

## 📊 Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success",
  "status": 200
}
```

### Error Response
```json
{
  "detail": "Error message",
  "status": 400
}
```

### Paginated Response
```json
{
  "items": [ ... ],
  "count": 50,
  "offset": 0,
  "limit": 20,
  "total": 250
}
```

---

**API Documentation Complete**
**Total Endpoints: 125**
**Ready for Mobile Integration! 📱**
