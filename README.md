# Leaf Disease Detection System

A web-based leaf disease detection system that uses a U-Net deep learning model to analyze uploaded plant leaf images and identify potential diseases.

## Features

- 🌿 AI-powered leaf disease detection using U-Net model
- 📱 Mobile-responsive Progressive Web App (PWA)
- 👤 User authentication and profile management
- 📊 Detection history and analytics dashboard
- 📄 PDF export of detection results
- 🔄 Real-time processing status updates
- 📍 GPS location tracking for detections
- 🔒 Secure data storage and encryption

## Architecture

This is a monorepo containing:

- **Frontend**: React 18 + TypeScript + Material-UI
- **Backend**: Node.js + Express + PostgreSQL + Redis
- **ML Service**: Python + FastAPI + TensorFlow/Keras
- **E2E Tests**: Cypress

## Prerequisites

- Node.js 18+
- Python 3.9+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository
2. Copy environment files:
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   cp packages/ml-service/.env.example packages/ml-service/.env
   ```
3. Start all services:
   ```bash
   docker-compose up -d
   ```
4. Access the application at http://localhost:3000

### Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the database:
   ```bash
   # Start PostgreSQL and Redis
   # Update packages/backend/.env with your database URL
   cd packages/backend
   npm run db:migrate
   npm run db:seed
   ```

3. Set up Python environment:
   ```bash
   cd packages/ml-service
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Start all services:
   ```bash
   npm run dev
   ```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm run test:frontend
npm run test:backend
npm run test:ml

# Run E2E tests
npm run test:e2e
```

### Database Operations

```bash
cd packages/backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Fix linting issues
npm run lint:fix
```

## Project Structure

```
leaf-disease-detection/
├── packages/
│   ├── frontend/          # React frontend application
│   ├── backend/           # Node.js API server
│   ├── ml-service/        # Python ML service
│   └── e2e/              # End-to-end tests
├── docker-compose.yml     # Docker services configuration
└── package.json          # Root package configuration
```

## API Documentation

Once the backend is running, visit:
- API Documentation: http://localhost:3001/api/docs
- ML Service Documentation: http://localhost:8001/docs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.