# Time Tracker API

NestJS backend for the Time Tracker application.

## Setup

### Prerequisites

- **PostgreSQL** database (local or cloud)
  - Local: Install PostgreSQL and create a database
  - Cloud options: [Supabase](https://supabase.com), [Railway](https://railway.app), [Neon](https://neon.tech), or [ElephantSQL](https://www.elephantsql.com/)

### Installation Steps

1. **Create a `.env` file** in the `backend` directory:

```env
# Database - Update with your PostgreSQL connection string
# Format: postgresql://username:password@host:port/database_name
# Example for local: postgresql://postgres:postgres@localhost:5432/time_tracker
# Example for Supabase: postgresql://user:pass@db.xxx.supabase.co:5432/postgres
DATABASE_URL=postgresql://user:password@localhost:5432/time_tracker

# JWT Configuration - Generate a strong random secret (min 32 characters)
# You can generate one with: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=3600s

# Admin User (created automatically on first startup)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_TIMEZONE=Africa/Johannesburg

# Server
PORT=3000
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm run start:dev
```

### Database Setup Options

#### Option 1: Local PostgreSQL
1. Install PostgreSQL from https://www.postgresql.org/download/
2. Create a database:
   ```sql
   CREATE DATABASE time_tracker;
   ```
3. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/time_tracker
   ```

#### Option 2: Cloud Database (Recommended for quick setup)
1. Sign up for a free PostgreSQL service (Supabase, Railway, Neon, etc.)
2. Copy the connection string
3. Update `DATABASE_URL` in `.env` with the provided connection string

**Note:** The database schema will be automatically created on first startup (synchronize: true in development).

## Authentication

**Note:** There is no public sign-up endpoint. User creation is restricted to ADMIN users only.

### First Time Setup

1. The admin user is automatically created on first startup from the `.env` file values (`ADMIN_EMAIL` and `ADMIN_PASSWORD`).

2. Login with the admin credentials:
   - POST `/api/auth/login`
   - Body: `{ "email": "admin@example.com", "password": "admin123" }`

3. Use the returned JWT token to access protected endpoints.

4. Create additional users via:
   - POST `/api/users` (requires ADMIN role)
   - Body: `{ "email": "...", "password": "...", "fullName": "...", "campaignId": "..." }`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/api/docs

## User Roles

- **ADMIN**: Full access, can create users and campaigns
- **MANAGER**: Can view reports and approve leave for their campaign
- **EMPLOYEE**: Can clock in/out and request leave
