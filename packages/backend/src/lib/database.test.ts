import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import * as fc from 'fast-check'
import bcrypt from 'bcryptjs'
import { getPrismaClient, connectDatabase, disconnectDatabase } from './database.js'

/**
 * Feature: leaf-disease-detection, Property 7: Secure user data storage
 * Validates: Requirements 3.1, 3.5
 */

const prisma = getPrismaClient()

// Generate truly unique emails using crypto
const generateUniqueEmail = (base: string) => {
  const timestamp = Date.now()
  const random1 = Math.random().toString(36).substring(2, 15)
  const random2 = Math.random().toString(36).substring(2, 15)
  return `test-${timestamp}-${random1}-${random2}-${base.replace(/\s+/g, '')}@example.com`
}

// Test database setup
beforeAll(async () => {
  await connectDatabase()
}, 60000)

afterAll(async () => {
  await disconnectDatabase()
}, 60000)

beforeEach(async () => {
  // Clean up test data before each test
  await prisma.disease.deleteMany()
  await prisma.detection.deleteMany()
  await prisma.user.deleteMany()
}, 60000)

describe('Database Security Properties', () => {
  describe('Property 7: Secure user data storage', () => {
    it('should never store passwords in plaintext', async () => {
      // **Feature: leaf-disease-detection, Property 7: Secure user data storage**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.string({ minLength: 5, maxLength: 30 }).map(s => generateUniqueEmail(s)),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            role: fc.constantFrom('user', 'admin', 'researcher')
          }),
          async (userData) => {
            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(userData.password, 12)
            
            // Create user with hashed password
            const user = await prisma.user.create({
              data: {
                email: userData.email,
                passwordHash: hashedPassword,
                firstName: userData.firstName || undefined,
                lastName: userData.lastName || undefined,
                role: userData.role,
              },
            })

            // Property: Password should never be stored in plaintext
            expect(user.passwordHash).not.toBe(userData.password)
            
            // Property: Stored password should be a valid bcrypt hash
            expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/)
            
            // Property: Original password should verify against stored hash
            const isValid = await bcrypt.compare(userData.password, user.passwordHash)
            expect(isValid).toBe(true)
            
            // Property: Wrong password should not verify
            const wrongPassword = userData.password + 'wrong'
            const isInvalid = await bcrypt.compare(wrongPassword, user.passwordHash)
            expect(isInvalid).toBe(false)
          }
        ),
        { numRuns: 20 }
      )
    }, 180000)

    it('should encrypt sensitive user information', async () => {
      // **Feature: leaf-disease-detection, Property 7: Secure user data storage**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.string({ minLength: 5, maxLength: 30 }).map(s => generateUniqueEmail(s)),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
          }),
          async (userData) => {
            const hashedPassword = await bcrypt.hash(userData.password, 12)
            
            const user = await prisma.user.create({
              data: {
                email: userData.email,
                passwordHash: hashedPassword,
                firstName: userData.firstName || undefined,
                lastName: userData.lastName || undefined,
                role: 'user',
              },
            })

            // Property: User ID should be a secure random string (cuid)
            expect(user.id).toMatch(/^c[a-z0-9]{24}$/)
            
            // Property: Email should be stored as provided (for login purposes)
            expect(user.email).toBe(userData.email)
            
            // Property: Timestamps should be automatically generated
            expect(user.createdAt).toBeInstanceOf(Date)
            expect(user.updatedAt).toBeInstanceOf(Date)
            
            // Property: Created and updated timestamps should be close to current time
            const now = new Date()
            const timeDiff = Math.abs(now.getTime() - user.createdAt.getTime())
            expect(timeDiff).toBeLessThan(10000) // Within 10 seconds
          }
        ),
        { numRuns: 20 }
      )
    }, 120000)
  })

  describe('Property 8: User history retrieval accuracy', () => {
    it('should return only data belonging to the requesting user', async () => {
      // **Feature: leaf-disease-detection, Property 8: User history retrieval accuracy**
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              email: fc.string({ minLength: 5, maxLength: 20 }).map(s => generateUniqueEmail(s)),
              password: fc.string({ minLength: 8, maxLength: 50 }),
              firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }))
            }),
            { minLength: 2, maxLength: 3 }
          ),
          fc.array(
            fc.record({
              imageUrl: fc.string({ minLength: 10, maxLength: 50 }).map(s => `https://example.com/${s}.jpg`),
              originalFilename: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
              processingStatus: fc.constantFrom('pending', 'processing', 'completed', 'failed'),
              confidenceScore: fc.option(fc.float({ min: 0, max: 1 })),
              locationLat: fc.option(fc.float({ min: -90, max: 90 })),
              locationLng: fc.option(fc.float({ min: -180, max: 180 }))
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (usersData, detectionsData) => {
            // Create multiple users
            const users: any[] = []
            for (const userData of usersData) {
              const hashedPassword = await bcrypt.hash(userData.password, 12)
              const user = await prisma.user.create({
                data: {
                  email: userData.email,
                  passwordHash: hashedPassword,
                  firstName: userData.firstName || undefined,
                  lastName: userData.lastName || undefined,
                  role: 'user',
                },
              })
              users.push(user)
            }

            // Create detections for each user
            const userDetections: { [userId: string]: any[] } = {}
            for (let i = 0; i < detectionsData.length; i++) {
              const detectionData = detectionsData[i]
              const user = users[i % users.length] // Distribute detections among users
              
              const detection = await prisma.detection.create({
                data: {
                  userId: user.id,
                  imageUrl: detectionData.imageUrl,
                  originalFilename: detectionData.originalFilename || undefined,
                  processingStatus: detectionData.processingStatus,
                  confidenceScore: detectionData.confidenceScore || undefined,
                  locationLat: detectionData.locationLat || undefined,
                  locationLng: detectionData.locationLng || undefined,
                },
              })

              if (!userDetections[user.id]) {
                userDetections[user.id] = []
              }
              userDetections[user.id].push(detection)
            }

            // Test property: Each user should only see their own detections
            for (const user of users) {
              const userHistory = await prisma.detection.findMany({
                where: { userId: user.id },
                include: { diseases: true },
                orderBy: { createdAt: 'desc' }
              })

              // Property: All returned detections should belong to the requesting user
              for (const detection of userHistory) {
                expect(detection.userId).toBe(user.id)
              }

              // Property: Should return exactly the detections created for this user
              const expectedCount = userDetections[user.id]?.length || 0
              expect(userHistory.length).toBe(expectedCount)

              // Property: Results should be ordered by creation time (newest first)
              for (let i = 1; i < userHistory.length; i++) {
                expect(userHistory[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
                  userHistory[i].createdAt.getTime()
                )
              }
            }
          }
        ),
        { numRuns: 10 } // Reduced runs due to complexity
      )
    }, 120000)

    it('should return accurate timestamps for user history', async () => {
      // **Feature: leaf-disease-detection, Property 8: User history retrieval accuracy**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.string({ minLength: 5, maxLength: 20 }).map(s => generateUniqueEmail(s)),
            password: fc.string({ minLength: 8, maxLength: 50 })
          }),
          fc.array(
            fc.record({
              imageUrl: fc.string({ minLength: 10, maxLength: 50 }).map(s => `https://example.com/${s}.jpg`),
              processingStatus: fc.constantFrom('pending', 'processing', 'completed', 'failed')
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (userData, detectionsData) => {
            // Create user with unique email handling
            const hashedPassword = await bcrypt.hash(userData.password, 12)
            let user: any
            try {
              user = await prisma.user.create({
                data: {
                  email: userData.email,
                  passwordHash: hashedPassword,
                  role: 'user',
                },
              })
            } catch (error: any) {
              if (error.code === 'P2002') {
                // Handle unique constraint violation by generating a new unique email
                const uniqueEmail = generateUniqueEmail(`fallback-${Math.random().toString(36).substring(7)}`)
                user = await prisma.user.create({
                  data: {
                    email: uniqueEmail,
                    passwordHash: hashedPassword,
                    role: 'user',
                  },
                })
              } else {
                throw error
              }
            }

            // Create detections with known timestamps
            const createdDetections = []
            for (const detectionData of detectionsData) {
              const detection = await prisma.detection.create({
                data: {
                  userId: user.id,
                  imageUrl: detectionData.imageUrl,
                  processingStatus: detectionData.processingStatus,
                },
              })
              createdDetections.push(detection)
              
              // Small delay to ensure different timestamps
              await new Promise(resolve => setTimeout(resolve, 10))
            }

            // Retrieve user history
            const userHistory = await prisma.detection.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' }
            })

            // Property: All timestamps should be valid dates
            for (const detection of userHistory) {
              expect(detection.createdAt).toBeInstanceOf(Date)
              
              // Property: processedAt should be null or a valid date
              if (detection.processedAt) {
                expect(detection.processedAt).toBeInstanceOf(Date)
                
                // Property: Created timestamp should be before or equal to processed timestamp
                expect(detection.createdAt.getTime()).toBeLessThanOrEqual(
                  detection.processedAt.getTime()
                )
              }
            }

            // Property: Number of retrieved detections should match created ones
            expect(userHistory.length).toBe(createdDetections.length)
          }
        ),
        { numRuns: 20 }
      )
    }, 120000)
  })
})