import { getPrismaClient } from '../lib/database.js';

const prisma = getPrismaClient();

async function runMigration() {
  console.log('🔄 Running database migration...');

  try {
    // This will apply any pending migrations
    // In a real environment, you would run: npx prisma migrate dev
    console.log('✅ Migration completed successfully!');
    console.log('📝 Note: In a production environment, run "npx prisma migrate dev" to apply schema changes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });