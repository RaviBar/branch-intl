# Railway/Render Deployment Configuration

## Environment Variables for Production

Set these environment variables in your deployment platform:

```env
# Database Configuration (Railway/Render will provide DATABASE_URL)
DATABASE_URL=postgresql://username:password@host:port/database

# Server Configuration
PORT=5000
NODE_ENV=production

# Frontend URL (update with your deployed frontend URL)
FRONTEND_URL=https://your-frontend-app.vercel.app
```

## Build Commands

### Railway
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`

### Render
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`

## Database Setup

1. Create a PostgreSQL database in your deployment platform
2. Get the DATABASE_URL from your platform
3. Update your environment variables
4. Deploy your application
5. Run the CSV import script on your production database

## CSV Import on Production

After deployment, you can import the CSV data by:

1. Connecting to your production database
2. Running the import script with the production DATABASE_URL
3. Or using a database migration tool

## Frontend Deployment (Vercel)

1. Connect your GitHub repository to Vercel
2. Set the following in Vite config:
   ```javascript
   export default defineConfig({
     plugins: [react()],
     server: {
       port: 5173,
       proxy: {
         '/api': {
           target: 'https://your-backend-app.railway.app', // or render URL
           changeOrigin: true,
         },
       },
     },
   })
   ```
3. Deploy!

## Health Check

Your deployed backend should respond to:
- `GET /api/health` - Returns server status

## Troubleshooting Production

1. **CORS Issues**: Ensure FRONTEND_URL matches your deployed frontend
2. **Database Connection**: Verify DATABASE_URL is correct
3. **Port Issues**: Most platforms use PORT environment variable automatically
4. **Build Failures**: Check that all dependencies are in package.json

