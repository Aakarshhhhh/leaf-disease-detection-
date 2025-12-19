# Manual Testing Guide for Database Implementation

This guide provides step-by-step instructions for manually testing the database implementation and property-based tests.

## Prerequisites

Before testing, ensure you have:
1. PostgreSQL running locally
2. Node.js and npm installed
3. Environment variables configured in `.env`

## Setup Steps

### 1. Install Dependencies

```bash
cd packages/backend
npm install
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Run Database Migration

```bash
npx prisma migrate dev --name init
```

### 4. Seed Database (Optional)

```bash
npm run db:seed
```

## Manual Testing Procedures

### Test 1: Database Connection

**Objective**: Verify database connection and health check

**Steps**:
1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Test health endpoint:
   ```bash
   curl http://localhost:3001/api/health
   ```

**Expected Result**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "leaf-disease-detection-backend",
  "database": "connected"
}
```

### Test 2: Property 7 - Secure Data Storage

**Objective**: Verify passwords are never stored in plaintext and user data is secure

**Manual Test Steps**:

1. **Create a test script** (`test-security.js`):
```javascript
import { getPrismaClient } from './src/lib/database.js';
import bcrypt from 'bcryptjs';

const prisma = getPrismaClient();

async function testPasswordSecurity() {
  console.log('Testing password security...');
  
  const testPassword = 'testPassword123';
  const hashedPassword = await bcrypt.hash(testPassword, 12);
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    }
  });
  
  console.log('✅ User created with ID:', user.id);
  
  // Verify password is not stored in plaintext
  console.log('Original password:', testPassword);
  console.log('Stored hash:', user.passwordHash);
  console.log('Are they different?', testPassword !== user.passwordHash);
  
  // Verify hash format (bcrypt)
  const isBcryptHash = /^\$2[aby]\$\d{2}\$.{53}$/.test(user.passwordHash);
  console.log('Is valid bcrypt hash?', isBcryptHash);
  
  // Verify password verification works
  const isValid = await bcrypt.compare(testPassword, user.passwordHash);
  console.log('Password verification works?', isValid);
  
  // Verify wrong password fails
  const isInvalid = await bcrypt.compare('wrongPassword', user.passwordHash);
  console.log('Wrong password correctly rejected?', !isInvalid);
  
  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
  console.log('✅ Test completed successfully');
}

testPasswordSecurity().catch(console.error).finally(() => prisma.$disconnect());
```

2. **Run the test**:
```bash
node test-security.js
```

**Expected Output**:
```
Testing password security...
✅ User created with ID: c...
Original password: testPassword123
Stored hash: $2b$12$...
Are they different? true
Is valid bcrypt hash? true
Password verification works? true
Wrong password correctly rejected? true
✅ Test completed successfully
```

### Test 3: Property 8 - User History Retrieval Accuracy

**Objective**: Verify users only see their own detection history

**Manual Test Steps**:

1. **Create a test script** (`test-history.js`):
```javascript
import { getPrismaClient } from './src/lib/database.js';
import bcrypt from 'bcryptjs';

const prisma = getPrismaClient();

async function testHistoryAccuracy() {
  console.log('Testing user history retrieval accuracy...');
  
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  // Create two users
  const user1 = await prisma.user.create({
    data: {
      email: 'user1@example.com',
      passwordHash: hashedPassword,
      role: 'user'
    }
  });
  
  const user2 = await prisma.user.create({
    data: {
      email: 'user2@example.com',
      passwordHash: hashedPassword,
      role: 'user'
    }
  });
  
  console.log('✅ Created users:', user1.id, user2.id);
  
  // Create detections for each user
  const detection1 = await prisma.detection.create({
    data: {
      userId: user1.id,
      imageUrl: '/uploads/test1.jpg',
      processingStatus: 'completed'
    }
  });
  
  const detection2 = await prisma.detection.create({
    data: {
      userId: user2.id,
      imageUrl: '/uploads/test2.jpg',
      processingStatus: 'completed'
    }
  });
  
  const detection3 = await prisma.detection.create({
    data: {
      userId: user1.id,
      imageUrl: '/uploads/test3.jpg',
      processingStatus: 'pending'
    }
  });
  
  console.log('✅ Created detections');
  
  // Test: User 1 should only see their detections
  const user1History = await prisma.detection.findMany({
    where: { userId: user1.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('User 1 detections:', user1History.length);
  console.log('All belong to user 1?', user1History.every(d => d.userId === user1.id));
  
  // Test: User 2 should only see their detections
  const user2History = await prisma.detection.findMany({
    where: { userId: user2.id },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('User 2 detections:', user2History.length);
  console.log('All belong to user 2?', user2History.every(d => d.userId === user2.id));
  
  // Test: Timestamps are accurate
  console.log('Timestamps are valid dates?', 
    user1History.every(d => d.createdAt instanceof Date && d.updatedAt instanceof Date));
  
  // Test: Results are ordered by creation time (newest first)
  const isOrdered = user1History.length <= 1 || 
    user1History.every((d, i) => i === 0 || 
      user1History[i-1].createdAt >= d.createdAt);
  console.log('Results properly ordered?', isOrdered);
  
  // Cleanup
  await prisma.detection.deleteMany({
    where: { userId: { in: [user1.id, user2.id] } }
  });
  await prisma.user.deleteMany({
    where: { id: { in: [user1.id, user2.id] } }
  });
  
  console.log('✅ History test completed successfully');
}

testHistoryAccuracy().catch(console.error).finally(() => prisma.$disconnect());
```

2. **Run the test**:
```bash
node test-history.js
```

**Expected Output**:
```
Testing user history retrieval accuracy...
✅ Created users: c... c...
✅ Created detections
User 1 detections: 2
All belong to user 1? true
User 2 detections: 1
All belong to user 2? true
Timestamps are valid dates? true
Results properly ordered? true
✅ History test completed successfully
```

### Test 4: Database Error Handling

**Manual Test Steps**:

1. **Test duplicate email constraint**:
```javascript
// This should fail with proper error handling
try {
  await prisma.user.create({
    data: {
      email: 'duplicate@example.com',
      passwordHash: 'hash1'
    }
  });
  
  await prisma.user.create({
    data: {
      email: 'duplicate@example.com', // Same email
      passwordHash: 'hash2'
    }
  });
} catch (error) {
  console.log('Duplicate email properly rejected:', error.code === 'P2002');
}
```

2. **Test foreign key constraints**:
```javascript
// This should fail when trying to create detection for non-existent user
try {
  await prisma.detection.create({
    data: {
      userId: 'non-existent-id',
      imageUrl: '/test.jpg',
      processingStatus: 'pending'
    }
  });
} catch (error) {
  console.log('Foreign key constraint enforced:', error.code === 'P2003');
}
```

## Running Property-Based Tests

Once the environment is set up, run the comprehensive property-based tests:

```bash
npm test -- --testPathPattern=database.test.ts
```

The tests will automatically:
- Generate random user data and verify security properties
- Create multiple users and test data isolation
- Verify password hashing across 100+ iterations
- Test timestamp accuracy and ordering

## Verification Checklist

After running all tests, verify:

- [ ] Database connection works
- [ ] Health check returns "connected" status
- [ ] Passwords are never stored in plaintext
- [ ] Password hashing uses bcrypt with proper format
- [ ] Users only see their own detection history
- [ ] Timestamps are accurate and properly ordered
- [ ] Database constraints are enforced
- [ ] Error handling works correctly
- [ ] Transactions maintain data integrity

## Troubleshooting

### Common Issues

1. **Database connection fails**:
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **Migration errors**:
   - Run `npx prisma migrate reset` to start fresh
   - Check schema.prisma for syntax errors

3. **Test failures**:
   - Ensure database is clean before testing
   - Check for proper cleanup in test scripts
   - Verify all dependencies are installed

### Getting Help

If tests fail or behave unexpectedly:
1. Check the console output for specific error messages
2. Verify the database schema matches expectations
3. Ensure all environment variables are set correctly
4. Review the implementation in `src/lib/database.ts`

The property-based tests are designed to catch edge cases and ensure the implementation is robust across many different inputs and scenarios.