import { PrismaClient, Prisma } from '@prisma/client';
import { DatabaseError } from '../types/index.js';

// Global variable to store the Prisma client instance
let prisma: PrismaClient;

/**
 * Initialize and return a Prisma client instance
 * Uses singleton pattern to ensure only one instance exists
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });
  }
  return prisma;
}

/**
 * Connect to the database with error handling
 */
export async function connectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw new DatabaseError(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log('✅ Database disconnected successfully');
    }
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw new DatabaseError(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Handle database errors and convert them to application errors
 */
export function handleDatabaseError(error: any): DatabaseError {
  const dbError = new DatabaseError(error.message || 'Database operation failed');
  
  // Handle Prisma-specific errors
  if (error.code) {
    dbError.code = error.code;
    
    switch (error.code) {
      case 'P2002':
        dbError.message = 'A record with this information already exists';
        dbError.constraint = error.meta?.target;
        break;
      case 'P2025':
        dbError.message = 'Record not found';
        break;
      case 'P2003':
        dbError.message = 'Foreign key constraint failed';
        break;
      case 'P2014':
        dbError.message = 'Invalid ID provided';
        break;
      default:
        dbError.message = `Database error: ${error.message}`;
    }
  }
  
  return dbError;
}

/**
 * Execute database operations with automatic error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw handleDatabaseError(error);
  }
}

/**
 * Transaction wrapper with error handling
 */
export async function executeTransaction<T>(
  operations: (prisma: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const client = getPrismaClient();
  
  return withDatabaseErrorHandling(async () => {
    return await client.$transaction(async (tx) => {
      return await operations(tx);
    });
  });
}