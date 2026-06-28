# iStylist API - Quick Reference Card

## 🌐 Production URLs

```
BASE:    https://mongo-supabase-api.emergent.host
API:     https://mongo-supabase-api.emergent.host/api
DOCS:    https://mongo-supabase-api.emergent.host/docs
REDOC:   https://mongo-supabase-api.emergent.host/redoc
OPENAPI: https://mongo-supabase-api.emergent.host/openapi.json
```

## 🔑 Configuration

```javascript
// Mobile App Config
const CONFIG = {
  API_URL: 'https://mongo-supabase-api.emergent.host/api',
  FLW_PUBLIC_KEY: 'FLWPUBK-d41cdd72dafe974d3410ef0383881b22-X',
  TIMEOUT: 30000,
};
```

## 🔐 Authentication

```javascript
// Headers for authenticated requests
{
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}

// Admin endpoints also need
{
  'X-ADMIN-KEY': 'istylist_admin_secret_key_2026'
}
```

## 📋 Essential Endpoints (Quick Copy-Paste)

### Auth & Users
```
POST   /api/users                    # Signup
GET    /api/users/by-auth/{auth_id}  # Get user profile
PUT    /api/users/{user_id}          # Update profile
POST   /api/users/delete-account     # Delete account
```

### Providers
```
POST   /api/providers/register               # Become provider
GET    /api/providers/with-services          # Browse providers
GET    /api/providers/{id}/full-profile      # Provider details
GET    /api/providers/{id}/available-slots   # Available times
```

### Services
```
GET    /api/catalog/services          # All services
GET    /api/provider-services/{id}    # Provider's services
```

### Bookings
```
POST   /api/bookings                         # Create booking
GET    /api/bookings                         # My bookings
GET    /api/bookings/{id}                    # Booking details
PUT    /api/bookings/{id}                    # Update status
POST   /api/bookings/{id}/pay-with-wallet    # Pay with wallet
GET    /api/bookings/{id}/chat               # Chat messages
POST   /api/bookings/{id}/chat               # Send message
```

### Wallet & Payments
```
GET    /api/wallet/me                        # My wallet
POST   /api/payments/flutterwave/initialize  # Initialize payment
GET    /api/payments/flutterwave/verify      # Verify payment
GET    /api/wallet/transactions              # Transaction history
POST   /api/withdrawals/request              # Request withdrawal
```

### Reviews
```
POST   /api/reviews                   # Write review
GET    /api/reviews/me                # My reviews
GET    /api/providers/{id}/reviews    # Provider reviews
```

### Social Feed
```
GET    /api/feed/posts                    # Get feed
POST   /api/feed/posts                    # Create post
POST   /api/feed/posts/{id}/like          # Like post
DELETE /api/feed/posts/{id}/like          # Unlike post
```

### Notifications
```
GET    /api/notifications/me              # My notifications
GET    /api/notifications/unread-count    # Unread count
POST   /api/notifications/mark-read       # Mark as read
```

### Support & Legal
```
POST   /api/support/tickets    # Submit ticket
GET    /api/legal/privacy      # Privacy policy
GET    /api/legal/terms        # Terms of service
POST   /api/reports            # Report abuse
```

## 📱 Sample API Calls (Copy-Paste Ready)

### JavaScript/React Native

```javascript
// Get providers
const providers = await fetch(
  'https://mongo-supabase-api.emergent.host/api/providers/with-services'
).then(r => r.json());

// Create booking (authenticated)
const booking = await fetch(
  'https://mongo-supabase-api.emergent.host/api/bookings',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider_id: 'uuid-here',
      service_id: 1,
      scheduled_at: '2025-07-20T10:00:00Z',
      notes: 'Optional notes',
    }),
  }
).then(r => r.json());

// Get wallet balance
const wallet = await fetch(
  'https://mongo-supabase-api.emergent.host/api/wallet/me',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
).then(r => r.json());
```

### cURL

```bash
# Get providers
curl https://mongo-supabase-api.emergent.host/api/providers/with-services

# Create booking
curl -X POST https://mongo-supabase-api.emergent.host/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "uuid-here",
    "service_id": 1,
    "scheduled_at": "2025-07-20T10:00:00Z"
  }'

# Get wallet
curl https://mongo-supabase-api.emergent.host/api/wallet/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 Common Workflows

### 1. User Signup → Browse → Book Flow
```
1. POST /api/users (signup)
2. GET /api/providers/with-services (browse)
3. GET /api/providers/{id}/full-profile (details)
4. GET /api/providers/{id}/available-slots (check times)
5. POST /api/bookings (create booking)
6. POST /api/payments/flutterwave/initialize (pay)
7. GET /api/bookings/{id} (confirm)
```

### 2. Provider Onboarding Flow
```
1. POST /api/users (signup as customer first)
2. POST /api/providers/register (upgrade to provider)
3. POST /api/provider-services (add services)
4. POST /api/providers/{id}/availability (set hours)
5. POST /api/feed/posts (showcase work)
```

### 3. Wallet Top-up Flow
```
1. GET /api/wallet/me (check balance)
2. POST /api/payments/flutterwave/initialize (get payment link)
3. Open payment_link in webview/browser
4. User completes payment
5. Webhook → /api/webhooks/flutterwave (auto-processed)
6. GET /api/wallet/me (confirm new balance)
```

### 4. Booking Completion Flow
```
1. PUT /api/bookings/{id} (status: completed)
2. POST /api/reviews (customer reviews provider)
3. Escrow auto-releases after 24h
4. Provider requests withdrawal
5. Admin approves
6. Provider receives payout
```

## 📊 Response Codes

```
200 OK              - Success
201 Created         - Resource created
400 Bad Request     - Invalid input
401 Unauthorized    - Missing/invalid auth
403 Forbidden       - No permission
404 Not Found       - Resource doesn't exist
422 Validation      - Invalid data format
500 Server Error    - Backend issue
```

## 🔧 Postman Collection

Import OpenAPI spec to Postman:
```
https://mongo-supabase-api.emergent.host/openapi.json
```

Steps:
1. Open Postman
2. File → Import
3. Paste URL above
4. Click Import
5. All 125 endpoints ready to use!

## 📞 Quick Links

- **Interactive Docs:** https://mongo-supabase-api.emergent.host/docs
- **API Health:** https://mongo-supabase-api.emergent.host/api/health
- **Frontend:** https://mongo-supabase-api.emergent.host

---

**Total Endpoints:** 125  
**Authentication:** JWT Bearer  
**Payment Provider:** Flutterwave  
**Database:** Supabase PostgreSQL

**Ready to integrate! 🚀**
