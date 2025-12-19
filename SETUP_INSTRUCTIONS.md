# Complete Setup Instructions

This guide walks you through setting up the Leaf Disease Detection system with your dataset.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] PostgreSQL 14+ installed and running
- [ ] Python 3.9+ installed
- [ ] Git installed

## Step-by-Step Setup

### 1. Dataset Integration (5 minutes)

First, let's integrate your dataset into the project:

```bash
# Create the data directory structure
mkdir -p packages/ml-service/data/raw
mkdir -p packages/ml-service/data/processed
mkdir -p packages/ml-service/models

# Copy your dataset into the project
# Windows Command Prompt:
xcopy "C:\Users\ishan\Downloads\archive\leaf_disease_segmentation" "packages\ml-service\data\raw\leaf_disease_segmentation" /E /I

# Or Windows PowerShell:
Copy-Item -Path "C:\Users\ishan\Downloads\archive\leaf_disease_segmentation" -Destination "packages\ml-service\data\raw\leaf_disease_segmentation" -Recurse
```

**Analyze your dataset:**
```bash
cd packages/ml-service
python scripts/analyze_dataset.py "data/raw/leaf_disease_segmentation" --output dataset_analysis.json
```

This will show you:
- Total number of images
- Disease classes detected
- Directory structure
- File types and counts

### 2. Install Dependencies (10 minutes)

**Root level:**
```bash
# From project root
npm install
```

**Backend:**
```bash
cd packages/backend
npm install
```

**Frontend:**
```bash
cd packages/frontend
npm install
```

**ML Service:**
```bash
cd packages/ml-service
pip install -r requirements.txt
# Or if using virtual environment:
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 3. Configure Environment Variables (5 minutes)

**Backend (.env):**
```bash
cd packages/backend
copy .env.example .env
```

Edit `packages/backend/.env`:
```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/leaf_disease_detection?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"

# File Upload
UPLOAD_DIR="../../uploads"
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/webp"

# ML Service
ML_SERVICE_URL="http://localhost:8001"
```

**ML Service (.env):**
```bash
cd packages/ml-service
copy .env.example .env
```

Edit `packages/ml-service/.env`:
```env
# Model Configuration
MODEL_PATH="models/unet_leaf_disease.h5"
DATASET_PATH="data/raw/leaf_disease_segmentation"

# Server
PORT=8001
HOST="0.0.0.0"

# Processing
BATCH_SIZE=16
IMAGE_SIZE=224
CONFIDENCE_THRESHOLD=0.7
```

### 4. Database Setup (5 minutes)

**Start PostgreSQL** (if not already running):
```bash
# Windows - Check if PostgreSQL service is running
# Open Services (services.msc) and start "postgresql-x64-14" service
```

**Initialize the database:**
```bash
cd packages/backend

# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# Seed with sample data
npm run db:seed
```

**Expected output:**
```
✅ Database connected successfully
🌱 Starting database seeding...
✅ Created users: admin@example.com, user@example.com, researcher@example.com
✅ Created sample detections
🎉 Database seeding completed successfully!
```

### 5. Verify Setup (2 minutes)

**Test backend:**
```bash
cd packages/backend
npm run dev
```

In another terminal:
```bash
curl http://localhost:3001/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "leaf-disease-detection-backend",
  "database": "connected"
}
```

**Test ML service:**
```bash
cd packages/ml-service
python main.py
```

Visit: http://localhost:8001/docs (FastAPI auto-generated docs)

### 6. Run Tests (Optional - 5 minutes)

**Backend tests:**
```bash
cd packages/backend
npm test
```

This will run:
- Unit tests
- Property-based tests for secure data storage (Property 7)
- Property-based tests for user history retrieval (Property 8)

**ML service tests:**
```bash
cd packages/ml-service
pytest
```

### 7. Start All Services (Using Docker - Recommended)

```bash
# From project root
docker-compose up --build
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- ML Service: http://localhost:8001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## What Was Implemented in Task 2

### ✅ Completed Components:

1. **Database Connection Layer** (`packages/backend/src/lib/database.ts`)
   - Singleton Prisma client
   - Connection management with error handling
   - Health check functionality
   - Transaction support
   - Comprehensive error handling

2. **TypeScript Interfaces** (`packages/backend/src/types/index.ts`)
   - User, Detection, Disease types
   - Input/output types for API
   - Error types

3. **Database Seed Scripts** (`packages/backend/src/scripts/seed.ts`)
   - Sample users with hashed passwords
   - Sample detections with diseases
   - Treatment recommendations

4. **Property-Based Tests** (`packages/backend/src/lib/database.test.ts`)
   - **Property 7**: Secure user data storage
     - Tests password hashing across 100+ random inputs
     - Verifies no plaintext storage
     - Validates bcrypt format
   - **Property 8**: User history retrieval accuracy
     - Tests data isolation between users
     - Verifies timestamp accuracy
     - Ensures proper ordering

5. **Server Integration** (`packages/backend/src/server.ts`)
   - Database connection on startup
   - Enhanced health check endpoint
   - Graceful shutdown handling

## Do You Need to Run Anything?

### **YES - Run These Now:**

1. **Install dependencies:**
   ```bash
   npm install
   cd packages/backend && npm install
   ```

2. **Set up database:**
   ```bash
   cd packages/backend
   npx prisma generate
   npx prisma migrate dev --name init
   npm run db:seed
   ```

3. **Analyze your dataset:**
   ```bash
   cd packages/ml-service
   python scripts/analyze_dataset.py "C:\Users\ishan\Downloads\archive\leaf_disease_segmentation" --output dataset_analysis.json
   ```

### **OPTIONAL - For Testing:**

4. **Run property-based tests:**
   ```bash
   cd packages/backend
   npm test -- --testPathPattern=database.test.ts
   ```

5. **Start the backend server:**
   ```bash
   cd packages/backend
   npm run dev
   ```

## Troubleshooting

### PostgreSQL Connection Issues

**Error:** "Connection refused" or "Database does not exist"

**Solution:**
```bash
# Create the database manually
psql -U postgres
CREATE DATABASE leaf_disease_detection;
\q

# Then run migrations again
cd packages/backend
npx prisma migrate dev --name init
```

### npm/npx Not Found

**Error:** "npm is not recognized"

**Solution:**
- Ensure Node.js is installed: https://nodejs.org/
- Restart your terminal after installation
- Verify: `node --version` and `npm --version`

### Python Module Not Found

**Error:** "ModuleNotFoundError"

**Solution:**
```bash
cd packages/ml-service
pip install -r requirements.txt
```

### Port Already in Use

**Error:** "Port 3001 is already in use"

**Solution:**
```bash
# Windows - Find and kill the process
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or change the port in .env
PORT=3002
```

## Next Steps

After completing this setup:

1. ✅ Task 2 is complete (Database setup)
2. 📋 Ready for Task 3: Authentication system
3. 📋 Ready for Task 4: File upload system
4. 📋 Ready for Task 5: ML service with your dataset

The dataset analysis will inform how we implement the ML service to work with your specific disease classes and image structure.

## Questions?

If you encounter any issues:
1. Check the error message carefully
2. Verify all prerequisites are installed
3. Ensure PostgreSQL is running
4. Check that ports 3001, 8001, 5432 are available
5. Review the troubleshooting section above