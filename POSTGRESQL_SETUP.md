# PostgreSQL Setup Guide for CS Messaging Web App

## Option 1: Using Docker (Recommended - Easiest)

### 1. Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop/
- Install and start Docker Desktop

### 2. Run PostgreSQL Container
```bash
# Start PostgreSQL container
docker run --name cs-messaging-postgres \
  -e POSTGRES_DB=cs_messaging \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Check if container is running
docker ps
```

### 3. Update Environment Variables
Create a `.env` file in the `backend` directory:
```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cs_messaging
DB_USER=postgres
DB_PASSWORD=password
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Import CSV Data
```bash
cd backend
node db/importCSV.js ../GeneralistRails_Project_MessageData.csv
```

## Option 2: Local PostgreSQL Installation

### 1. Install PostgreSQL
- **Windows**: Download from https://www.postgresql.org/download/windows/
- **macOS**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql postgresql-contrib`

### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE cs_messaging;

# Create user (optional)
CREATE USER cs_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE cs_messaging TO cs_user;

# Exit
\q
```

### 3. Update Environment Variables
Same as Option 1, step 3.

### 4. Import CSV Data
Same as Option 1, step 4.

## Option 3: Cloud PostgreSQL (Railway/Render)

### 1. Create PostgreSQL Service
- **Railway**: Create new project → Add PostgreSQL service
- **Render**: Create new PostgreSQL database

### 2. Get Connection Details
Copy the connection string or individual values:
- Host
- Port
- Database name
- Username
- Password

### 3. Update Environment Variables
```env
DB_TYPE=postgres
DB_HOST=your-host.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your-password
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

### 4. Import CSV Data
Run the import script with the production database URL.

## Database Features

### Automatic Fallback
The application automatically falls back to SQLite if PostgreSQL is not available:
- If `DB_TYPE=postgres` but connection fails → Falls back to SQLite
- If `DB_TYPE=sqlite` → Uses SQLite directly

### Database Abstraction
The application uses a unified database interface that works with both:
- **PostgreSQL**: Full-featured, production-ready
- **SQLite**: Lightweight, easy setup

### Schema Compatibility
Both databases use the same schema with appropriate syntax differences:
- **PostgreSQL**: Uses `SERIAL`, `TIMESTAMP`, `VARCHAR`
- **SQLite**: Uses `AUTOINCREMENT`, `DATETIME`, `TEXT`

## Testing the Setup

### 1. Start the Application
```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm run dev
```

### 2. Verify Database Type
Check the console output:
- `PostgreSQL connected successfully` - Using PostgreSQL
- `SQLite connected successfully` - Using SQLite

### 3. Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Get messages
curl http://localhost:5000/api/messages

# Get agents
curl http://localhost:5000/api/agents
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure PostgreSQL is running
   - Check port 5432 is not blocked
   - Verify connection details

2. **Authentication Failed**
   - Check username/password
   - Ensure user has proper permissions

3. **Database Not Found**
   - Create the database first
   - Check database name spelling

4. **Permission Denied**
   - Grant proper permissions to user
   - Check database ownership

### Useful Commands

```bash
# Check PostgreSQL status
docker ps | grep postgres

# View PostgreSQL logs
docker logs cs-messaging-postgres

# Connect to database
psql -h localhost -p 5432 -U postgres -d cs_messaging

# List tables
\dt

# View data
SELECT * FROM customers LIMIT 5;
SELECT * FROM messages LIMIT 5;
```

## Performance Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Setup | Easy | Moderate |
| Performance | Good | Excellent |
| Concurrent Users | Limited | High |
| Production Ready | No | Yes |
| Cloud Deployment | Limited | Excellent |

## Recommendation

- **Development**: Use SQLite (default)
- **Production**: Use PostgreSQL
- **Testing**: Use Docker PostgreSQL
