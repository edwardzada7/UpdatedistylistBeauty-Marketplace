# Supabase Database Integration

## Overview
This application integrates with **Supabase PostgreSQL** database, providing full CRUD operations for managing users, stylists, and wallets.

## Architecture
```
Frontend (React) → Backend (FastAPI) → Supabase (PostgreSQL)
```

## Features Implemented

### ✅ Backend API (FastAPI)
- **Full CRUD Operations** for 3 tables:
  - **Users**: Manage user accounts with auth_id, email, name, phone
  - **Stylists**: Manage stylist profiles linked to users via auth_id
  - **Wallets**: Manage user wallet balances linked to users via auth_id

### ✅ API Endpoints

#### Connection Test
- `GET /api/test-connection` - Test database connectivity

#### Users
- `POST /api/users` - Create a new user
- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get specific user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

#### Stylists
- `POST /api/stylists` - Create a new stylist
- `GET /api/stylists` - Get all stylists
- `GET /api/stylists/{id}` - Get specific stylist
- `PUT /api/stylists/{id}` - Update stylist
- `DELETE /api/stylists/{id}` - Delete stylist

#### Wallets
- `POST /api/wallets` - Create a new wallet
- `GET /api/wallets` - Get all wallets
- `GET /api/wallets/{id}` - Get specific wallet
- `PUT /api/wallets/{id}` - Update wallet
- `DELETE /api/wallets/{id}` - Delete wallet

### ✅ Frontend UI (React + shadcn/ui)
- **Settings → Integrations → Database** navigation flow
- Connection status monitoring
- Three tabs for managing data:
  - **Users Tab**: Create, view, edit, delete users
  - **Stylists Tab**: Create, view, edit, delete stylists
  - **Wallets Tab**: Create, view, edit, delete wallets
- Real-time toast notifications for all operations
- Responsive design with Tailwind CSS

## Database Schema

### Users Table
```sql
- id: UUID (Primary Key)
- auth_id: TEXT (Unique, indexed)
- email: TEXT (Unique, indexed)
- name: TEXT
- phone: TEXT (optional)
- created_at: TIMESTAMP
```

### Stylists Table
```sql
- id: UUID (Primary Key)
- auth_id: TEXT (Unique, linked to users, indexed)
- name: TEXT
- specialty: TEXT
- bio: TEXT (optional)
- hourly_rate: NUMERIC(10, 2) (optional)
- created_at: TIMESTAMP
```

### Wallets Table
```sql
- id: UUID (Primary Key)
- auth_id: TEXT (Unique, linked to users, indexed)
- balance: NUMERIC(10, 2) (default: 0.0)
- currency: TEXT (default: 'USD')
- created_at: TIMESTAMP
```

## Configuration

### Backend Environment Variables (`/app/backend/.env`)
```env
SUPABASE_URL="https://gvmomyoeokauuixsydiu.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
CORS_ORIGINS="*"
```

### Frontend Environment Variables (`/app/frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://stylist-finder-8.preview.emergentagent.com
```

## Setup Instructions

### 1. Database Setup (Already Complete!)
The tables have been created in your Supabase database. If you need to recreate them:

```bash
# View the SQL setup script
cat /app/backend/setup_supabase.sql

# Or run the Python setup script
python /app/backend/setup_tables.py
```

Alternatively, go to your Supabase Dashboard:
1. Navigate to SQL Editor: https://supabase.com/dashboard/project/gvmomyoeokauuixsydiu/sql/new
2. Copy SQL from `/app/backend/setup_supabase.sql`
3. Click "Run" to execute

### 2. Backend Setup
```bash
# Dependencies are already installed
pip install supabase psycopg2-binary

# Backend runs automatically via supervisor
sudo supervisorctl status backend
```

### 3. Frontend Setup
```bash
# Frontend runs automatically via supervisor
sudo supervisorctl status frontend
```

## Usage Guide

### Access the Application
1. Go to your application homepage
2. Click on **"Settings"** button in the navigation
3. Navigate to **"Integrations"**
4. Click on **"Database"** integration

### Managing Users
1. Go to the **Users** tab
2. Click **"Create User"** to add a new user
   - Required: auth_id, email, name
   - Optional: phone
3. Use edit/delete icons for existing users

### Managing Stylists
1. Go to the **Stylists** tab
2. Click **"Create Stylist"** to add a stylist profile
   - Required: auth_id (must match existing user), name, specialty
   - Optional: bio, hourly_rate
3. Stylists are linked to users via auth_id

### Managing Wallets
1. Go to the **Wallets** tab
2. Click **"Create Wallet"** to add a wallet
   - Required: auth_id (must match existing user)
   - Optional: initial balance, currency (USD/EUR/GBP/CAD)
3. Each user can have one wallet

## Testing the Integration

### Test Connection
```bash
curl -X GET "http://localhost:8001/api/test-connection"
```

### Create a User
```bash
curl -X POST "http://localhost:8001/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "auth_id": "test-user-001",
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+1234567890"
  }'
```

### Get All Users
```bash
curl -X GET "http://localhost:8001/api/users"
```

### Create a Stylist
```bash
curl -X POST "http://localhost:8001/api/stylists" \
  -H "Content-Type: application/json" \
  -d '{
    "auth_id": "test-user-001",
    "name": "John Doe",
    "specialty": "Hair Styling",
    "bio": "Professional hair stylist with 10 years experience",
    "hourly_rate": 50.00
  }'
```

### Create a Wallet
```bash
curl -X POST "http://localhost:8001/api/wallets" \
  -H "Content-Type: application/json" \
  -d '{
    "auth_id": "test-user-001",
    "balance": 100.00,
    "currency": "USD"
  }'
```

## File Structure

```
/app
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── setup_supabase.sql     # SQL schema for Supabase
│   ├── setup_tables.py        # Python script to create tables
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend configuration
│
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React app with routing
│   │   ├── pages/
│   │   │   ├── HomePage.jsx           # Landing page
│   │   │   ├── SettingsPage.jsx      # Settings page
│   │   │   ├── IntegrationsPage.jsx  # Integrations page
│   │   │   └── DatabasePage.jsx      # Database management page
│   │   └── components/
│   │       └── database/
│   │           ├── UsersTab.jsx       # Users CRUD interface
│   │           ├── StylistsTab.jsx    # Stylists CRUD interface
│   │           └── WalletsTab.jsx     # Wallets CRUD interface
│   └── .env                   # Frontend configuration
```

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Supabase Python Client**: Official Supabase client library
- **Pydantic**: Data validation and serialization
- **psycopg2-binary**: PostgreSQL adapter

### Frontend
- **React 19**: UI library
- **React Router**: Client-side routing
- **shadcn/ui**: UI component library based on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client for API requests
- **Sonner**: Toast notifications
- **Lucide React**: Icon library

## API Response Examples

### Success Response (User Creation)
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "auth_id": "test-user-001",
  "email": "john@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "created_at": "2025-01-20T10:30:00Z"
}
```

### Error Response
```json
{
  "detail": "User with this auth_id already exists"
}
```

## Security Features

1. **Service Role Key**: Backend uses Supabase service role key for full database access
2. **CORS Configuration**: Configured for secure cross-origin requests
3. **Input Validation**: Pydantic models validate all API inputs
4. **Unique Constraints**: auth_id and email fields have unique constraints
5. **Foreign Key Relationships**: Stylists and wallets are linked to users via auth_id

## Future Enhancements (Phase 2-3)

- [ ] Add bookings table
- [ ] Add chat functionality
- [ ] Add services table
- [ ] Add orders and products tables
- [ ] Implement Row Level Security (RLS) policies
- [ ] Add authentication with JWT tokens
- [ ] Implement transaction history for wallets
- [ ] Add search and filtering capabilities
- [ ] Implement pagination for large datasets

## Troubleshooting

### Backend won't start
```bash
# Check backend logs
tail -n 50 /var/log/supervisor/backend.err.log

# Restart backend
sudo supervisorctl restart backend
```

### Frontend issues
```bash
# Check frontend logs
tail -n 50 /var/log/supervisor/frontend.err.log

# Restart frontend
sudo supervisorctl restart frontend
```

### Database connection errors
1. Verify Supabase credentials in `/app/backend/.env`
2. Check if tables exist in Supabase dashboard
3. Test connection: `curl http://localhost:8001/api/test-connection`

### "Table does not exist" errors
Run the setup script to create tables:
```bash
python /app/backend/setup_tables.py
```

## Support

For issues or questions:
1. Check the application logs
2. Verify environment variables
3. Test API endpoints using curl
4. Check Supabase dashboard for database status

## Credits

Built with ❤️ using Emergent AI Platform
- Supabase: https://supabase.com
- FastAPI: https://fastapi.tiangolo.com
- React: https://react.dev
- shadcn/ui: https://ui.shadcn.com
