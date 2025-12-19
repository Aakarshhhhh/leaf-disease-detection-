# Database Setup Guide

This guide explains how to set up and manage the PostgreSQL database for the Leaf Disease Detection backend.

## Prerequisites

- PostgreSQL 14+ installed and running
- Node.js 18+ and npm installed
- Environment variables configured (see `.env.example`)

## Initial Setup

### 1. Configure Environment Variables

Copy the `.env.example` file to `.env` and update the database connection string:

```bash
cp .env.example .env
```

Update the `DATABASE_URL` in `.env`:
```
DATABASE_URL="postgresql://username:password@localhost:5432/leaf_disease_detection?schema=public"
```

### 2. Generate Prisma Client

Generate the Prisma client based on the schema:

```bash
npm run db:generate
```

This creates the TypeScript types and client for database operations.

### 3. Run Database Migrations

Apply the database schema to your PostgreSQL database:

```bash
npm run db:migrate
```

This will:
- Create all tables defined in `prisma/schema.prisma`
- Set up relationships and constraints
- Create indexes for performance

### 4. Seed Initial Data (Optional)

Populate the database with sample data for development:

```bash
npm run db:seed
```

This creates:
- Sample users (admin, regular user, researcher)
- Sample detections with diseases
- Test data for development

## Database Schema

### Users Table
- Stores user accounts with encrypted passwords
- Supports roles: user, admin, researcher
- Includes timestamps for audit trail

### Detections Table
- Stores image analysis requests and results
- Links to users via foreign key
- Includes processing status and confidence scores
- Optional GPS coordinates for location tracking

### Diseases Table
- Stores identified diseases for each detection
- Includes confidence scores and affected regions
- Contains treatment recommendations

## Database Operations

### Connecting to the Database

The application uses a singleton pattern for the Prisma client:

```typescript
import { getPrismaClient, connectDatabase } from './lib/database.js';

// Initialize connection
await connectDatabase();

// Get client instance
const prisma = getPrismaClient();
```

### Error Handling

All database operations include comprehensive error handling:

```typescript
import { withDatabaseErrorHandling } from './lib/database.js';

const result = await withDatabaseErrorHandling(async () => {
  return await prisma.user.findUnique({ where: { id: userId } });
});
```

### Transactions

Use the transaction wrapper for atomic operations:

```typescript
import { executeTransaction } from './lib/database.js';

await executeTransaction(async (prisma) => {
  const user = await prisma.user.create({ data: userData });
  const detection = await prisma.detection.create({ 
    data: { ...detectionData, userId: user.id } 
  });
  return { user, detection };
});
```

## Security Features

### Password Hashing
- All passwords are hashed using bcrypt with 12 rounds
- Passwords are never stored in plaintext
- Password verification uses constant-time comparison

### Data Encryption
- Sensitive user data is encrypted at rest
- Database connections use SSL in production
- User IDs use secure random strings (cuid)

### Access Control
- User data is isolated by userId
- Role-based access control for admin features
- Foreign key constraints ensure data integrity

## Testing

### Property-Based Tests

The database implementation includes comprehensive property-based tests:

**Property 7: Secure user data storage**
- Verifies passwords are never stored in plaintext
- Ensures bcrypt hashing is applied correctly
- Tests password verification logic

**Property 8: User history retrieval accuracy**
- Verifies users only see their own data
- Tests timestamp accuracy
- Ensures proper data isolation

Run tests with:
```bash
npm test
```

## Maintenance

### Backup Database

```bash
pg_dump -U username -d leaf_disease_detection > backup.sql
```

### Restore Database

```bash
psql -U username -d leaf_disease_detection < backup.sql
```

### Reset Database (Development Only)

```bash
npx prisma migrate reset
```

This will:
- Drop the database
- Recreate it
- Apply all migrations
- Run seed scripts

## Troubleshooting

### Connection Issues

If you can't connect to the database:
1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env
3. Ensure database exists
4. Verify user permissions

### Migration Errors

If migrations fail:
1. Check for syntax errors in schema.prisma
2. Ensure database is accessible
3. Review migration history
4. Consider resetting in development

### Performance Issues

For slow queries:
1. Check database indexes
2. Review query patterns
3. Enable query logging
4. Consider connection pooling

## Production Considerations

### Environment Variables
- Use strong, unique passwords
- Enable SSL connections
- Set appropriate connection pool size

### Monitoring
- Enable query logging
- Monitor connection pool usage
- Track slow queries
- Set up alerts for errors

### Backups
- Schedule regular automated backups
- Test restore procedures
- Store backups securely off-site
- Maintain backup retention policy