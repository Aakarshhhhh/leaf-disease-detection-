import { getPrismaClient } from '../lib/database.js';
import bcrypt from 'bcryptjs';

const prisma = getPrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
      },
    });

    const regularUser = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        email: 'user@example.com',
        passwordHash: hashedPassword,
        firstName: 'Regular',
        lastName: 'User',
        role: 'user',
      },
    });

    const researcherUser = await prisma.user.upsert({
      where: { email: 'researcher@example.com' },
      update: {},
      create: {
        email: 'researcher@example.com',
        passwordHash: hashedPassword,
        firstName: 'Research',
        lastName: 'Scientist',
        role: 'researcher',
      },
    });

    console.log('✅ Created users:', {
      admin: adminUser.email,
      user: regularUser.email,
      researcher: researcherUser.email,
    });

    // Create sample detections
    const sampleDetection1 = await prisma.detection.create({
      data: {
        userId: regularUser.id,
        imageUrl: '/uploads/sample-leaf-1.jpg',
        originalFilename: 'tomato-leaf-sample.jpg',
        processingStatus: 'completed',
        confidenceScore: 0.85,
        locationLat: 40.7128,
        locationLng: -74.0060,
        processedAt: new Date(),
        diseases: {
          create: [
            {
              diseaseName: 'Early Blight',
              confidence: 0.85,
              affectedRegions: [
                { x: 100, y: 150, width: 80, height: 60 },
                { x: 200, y: 250, width: 90, height: 70 }
              ],
              treatmentRecommendations: [
                'Apply copper-based fungicide',
                'Improve air circulation around plants',
                'Remove affected leaves immediately'
              ],
            },
          ],
        },
      },
    });

    const sampleDetection2 = await prisma.detection.create({
      data: {
        userId: regularUser.id,
        imageUrl: '/uploads/sample-leaf-2.jpg',
        originalFilename: 'healthy-leaf.jpg',
        processingStatus: 'completed',
        confidenceScore: 0.95,
        locationLat: 40.7589,
        locationLng: -73.9851,
        processedAt: new Date(),
        diseases: {
          create: [],
        },
      },
    });

    const sampleDetection3 = await prisma.detection.create({
      data: {
        userId: researcherUser.id,
        imageUrl: '/uploads/sample-leaf-3.jpg',
        originalFilename: 'powdery-mildew-sample.jpg',
        processingStatus: 'completed',
        confidenceScore: 0.72,
        locationLat: 34.0522,
        locationLng: -118.2437,
        processedAt: new Date(),
        diseases: {
          create: [
            {
              diseaseName: 'Powdery Mildew',
              confidence: 0.72,
              affectedRegions: [
                { x: 50, y: 75, width: 120, height: 100 }
              ],
              treatmentRecommendations: [
                'Apply sulfur-based fungicide',
                'Reduce humidity around plants',
                'Ensure proper spacing between plants'
              ],
            },
          ],
        },
      },
    });

    console.log('✅ Created sample detections:', {
      detection1: sampleDetection1.id,
      detection2: sampleDetection2.id,
      detection3: sampleDetection3.id,
    });

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });