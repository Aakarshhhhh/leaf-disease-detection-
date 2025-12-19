# Docker Setup Guide - Complete Installation

This guide will help you set up the entire Leaf Disease Detection system using Docker.

## Why Docker?

✅ **No need to install Node.js, PostgreSQL, Python, or Redis manually**  
✅ **Everything runs in isolated containers**  
✅ **Consistent environment across all systems**  
✅ **Easy to start, stop, and reset**

---

## Step 1: Install Docker Desktop (10 minutes)

### Download Docker Desktop

1. **Go to:** https://www.docker.com/products/docker-desktop/
2. **Click:** "Download for Windows"
3. **Run the installer:** `Docker Desktop Installer.exe`

### Installation Steps

1. **Run the installer** and follow the wizard
2. **Enable WSL 2** if prompted (recommended)
3. **Restart your computer** when installation completes
4. **Start Docker Desktop** from the Start menu
5. **Wait for Docker to start** (you'll see a whale icon in the system tray)

### Verify Docker Installation

Open PowerShell and run:

```powershell
docker --version
docker-compose --version
```

You should see:
```
Docker version 24.0.x
Docker Compose version v2.x.x
```

---

## Step 2: Copy Your Dataset (2 minutes)

Copy your leaf disease dataset into the project:

```powershell
# Create the data directory
New-Item -Path "packages\ml-service\data\raw" -ItemType Directory -Force

# Copy your dataset
Copy-Item -Path "C:\Users\ishan\Downloads\archive\leaf_disease_segmentation" -Destination "packages\ml-service\data\raw\leaf_disease_segmentation" -Recurse
```

**Verify the copy:**
```powershell
dir packages\ml-service\data\raw\leaf_disease_segmentation
```

You should see your dataset files.

---

## Step 3: Start All Services (5 minutes)

From your project root directory:

```powershell
# Build and start all services
docker-compose up --build
```

**What this does:**
- 🐘 Starts PostgreSQL database
- 🔴 Starts Redis cache
- 🖥️ Builds and starts Backend API
- 🤖 Builds and starts ML Service
- 🌐 Builds and starts Frontend

**First time:** This will take 5-10 minutes to download images and build containers.

**You'll see logs from all services.** Wait until you see:
```
leaf-detection-backend    | Backend server running on port 3001
leaf-detection-ml         | Uvicorn running on http://0.0.0.0:8001
leaf-detection-frontend   | ready - started server on 0.0.0.0:3000
```

---

## Step 4: Access Your Application

Once all services are running:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main web application |
| **Backend API** | http://localhost:3001 | REST API |
| **ML Service** | http://localhost:8001 | Machine learning API |
| **ML Docs** | http://localhost:8001/docs | Interactive API docs |

### Test the Backend

Open a **new PowerShell window** and run:

```powershell
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

---

## Step 5: Initialize Database (First Time Only)

The database needs to be initialized with the schema and seed data.

### Option A: Using Docker Exec (Recommended)

```powershell
# Run Prisma migrations
docker exec -it leaf-detection-backend npx prisma migrate deploy

# Generate Prisma client
docker exec -it leaf-detection-backend npx prisma generate

# Seed the database
docker exec -it leaf-detection-backend npm run db:seed
```

### Option B: Access Container Shell

```powershell
# Enter the backend container
docker exec -it leaf-detection-backend sh

# Inside the container, run:
npx prisma migrate deploy
npx prisma generate
npm run db:seed
exit
```

**Expected output:**
```
✅ Database connected successfully
🌱 Starting database seeding...
✅ Created users: admin@example.com, user@example.com, researcher@example.com
✅ Created sample detections
🎉 Database seeding completed successfully!
```

---

## Step 6: Analyze Your Dataset

Analyze your leaf disease dataset:

```powershell
# Enter the ML service container
docker exec -it leaf-detection-ml python scripts/analyze_dataset.py /app/data/raw/leaf_disease_segmentation --output /app/data/dataset_analysis.json
```

This will show:
- Total images in your dataset
- Disease classes detected
- Directory structure
- File types and counts

---

## Common Docker Commands

### Start Services (After First Setup)

```powershell
# Start in foreground (see logs)
docker-compose up

# Start in background (detached mode)
docker-compose up -d
```

### Stop Services

```powershell
# Stop all services
docker-compose down

# Stop and remove volumes (reset everything)
docker-compose down -v
```

### View Logs

```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs ml-service

# Follow logs (live)
docker-compose logs -f backend
```

### Restart a Service

```powershell
# Restart backend
docker-compose restart backend

# Rebuild and restart
docker-compose up --build backend
```

### Check Running Containers

```powershell
docker ps
```

### Access Container Shell

```powershell
# Backend
docker exec -it leaf-detection-backend sh

# ML Service
docker exec -it leaf-detection-ml bash

# Database
docker exec -it leaf-detection-postgres psql -U postgres -d leaf_disease_detection
```

---

## Testing the Implementation

### Test Property-Based Tests

```powershell
# Run backend tests
docker exec -it leaf-detection-backend npm test

# Run specific test file
docker exec -it leaf-detection-backend npm test -- --testPathPattern=database.test.ts
```

This will run:
- ✅ **Property 7**: Secure user data storage tests
- ✅ **Property 8**: User history retrieval accuracy tests

### Test ML Service

```powershell
# Run ML service tests
docker exec -it leaf-detection-ml pytest
```

---

## Troubleshooting

### Docker Desktop Not Starting

**Issue:** Docker Desktop shows "Starting..." forever

**Solution:**
1. Open Task Manager
2. End all Docker processes
3. Restart Docker Desktop
4. If still failing, restart your computer

### Port Already in Use

**Issue:** `Error: bind: address already in use`

**Solution:**
```powershell
# Find what's using the port (e.g., 3001)
netstat -ano | findstr :3001

# Kill the process
taskkill /PID <PID> /F

# Or change the port in docker-compose.yml
```

### Container Fails to Start

**Issue:** Container exits immediately

**Solution:**
```powershell
# Check logs
docker-compose logs backend

# Rebuild the container
docker-compose up --build backend
```

### Database Connection Failed

**Issue:** Backend can't connect to database

**Solution:**
```powershell
# Check if PostgreSQL is running
docker ps | findstr postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres
```

### Out of Disk Space

**Issue:** Docker runs out of space

**Solution:**
```powershell
# Clean up unused containers and images
docker system prune -a

# Remove all volumes (WARNING: deletes data)
docker volume prune
```

---

## Development Workflow

### Making Code Changes

1. **Edit your code** in your IDE
2. **Restart the service:**
   ```powershell
   docker-compose restart backend
   ```
3. **Or rebuild if you changed dependencies:**
   ```powershell
   docker-compose up --build backend
   ```

### Hot Reload (Development Mode)

For faster development, you can mount your code as a volume:

Edit `docker-compose.yml` and add under backend:
```yaml
volumes:
  - ./packages/backend/src:/app/src
```

Then restart:
```powershell
docker-compose up backend
```

---

## What's Already Implemented

✅ **Task 2 Complete:**
- Database connection with Prisma
- TypeScript interfaces for all models
- Property-based tests for security and data isolation
- Database seed scripts
- Server integration with health checks

✅ **Docker Configuration:**
- Multi-service setup
- Database persistence
- Volume mounts for uploads and models
- Health checks for all services

---

## Next Steps

After Docker is running:

1. ✅ **Verify all services are healthy**
2. ✅ **Initialize the database**
3. ✅ **Analyze your dataset**
4. 📋 **Continue with Task 3**: Authentication system
5. 📋 **Continue with Task 4**: File upload system
6. 📋 **Continue with Task 5**: ML service integration

---

## Quick Reference

```powershell
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Run tests
docker exec -it leaf-detection-backend npm test

# Access database
docker exec -it leaf-detection-postgres psql -U postgres -d leaf_disease_detection

# Clean up everything
docker-compose down -v
docker system prune -a
```

---

## Summary

**Installation Steps:**
1. Install Docker Desktop
2. Copy your dataset
3. Run `docker-compose up --build`
4. Initialize database
5. Access http://localhost:3000

**That's it!** No need to install Node.js, PostgreSQL, Python, or any other dependencies manually.

Everything runs in Docker containers and is ready to use! 🚀