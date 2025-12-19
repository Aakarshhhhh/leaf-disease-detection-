# Setup Instructions

## Prerequisites Installation

Before running the project, ensure you have the following installed:

### 1. Node.js and npm
- Download and install Node.js 18+ from https://nodejs.org/
- This will also install npm

### 2. Python 3.9+
- Download from https://python.org/
- Ensure pip is included

### 3. PostgreSQL 15+
- Download from https://postgresql.org/
- Create a database named `leaf_disease_detection`

### 4. Redis 7+
- Download from https://redis.io/
- Or use Docker: `docker run -d -p 6379:6379 redis:7-alpine`

## Installation Steps

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Install Frontend Dependencies
```bash
cd packages/frontend
npm install
```

### 3. Install Backend Dependencies
```bash
cd packages/backend
npm install
```

### 4. Install ML Service Dependencies
```bash
cd packages/ml-service
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Install E2E Test Dependencies
```bash
cd packages/e2e
npm install
```

### 6. Set up Environment Variables
```bash
# Copy example environment files
cp packages/backend/.env.example packages/backend/.env
cp packages/ml-service/.env.example packages/ml-service/.env

# Edit the .env files with your database credentials and other settings
```

### 7. Set up Database
```bash
cd packages/backend
npm run db:generate
npm run db:migrate
```

### 8. Verify Installation
```bash
# Test frontend
cd packages/frontend
npm test

# Test backend
cd packages/backend
npm test

# Test ML service
cd packages/ml-service
pytest

# Test E2E (requires all services running)
cd packages/e2e
npm test
```

## Running the Application

### Development Mode
```bash
# From root directory
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001
- ML Service on http://localhost:8001

### Using Docker Compose
```bash
docker-compose up -d
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Tests
```bash
npm run test:frontend
npm run test:backend
npm run test:ml
npm run test:e2e
```

### Property-Based Testing
The project includes property-based testing setup:
- **Frontend/Backend**: Uses `fast-check` library
- **ML Service**: Uses `hypothesis` library
- Tests are configured to run 100+ iterations for statistical confidence

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 8001, 5432, 6379 are available
2. **Database connection**: Verify PostgreSQL is running and credentials are correct
3. **Python dependencies**: Ensure you're in the virtual environment when installing ML service dependencies
4. **Node version**: Use Node.js 18+ for compatibility

### Verification Commands

```bash
# Check Node.js version
node --version

# Check Python version
python --version

# Check PostgreSQL connection
psql -h localhost -U postgres -d leaf_disease_detection

# Check Redis connection
redis-cli ping
```