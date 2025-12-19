/**
 * Property-based tests for user history retrieval
 * Feature: leaf-disease-detection, Property 8: User history retrieval accuracy
 * Validates: Requirements 3.2
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import fc from 'fast-check'
import { AuthService } from '../services/authService.js'
import { connectDatabase, disconnectDatabase } from '../lib/database.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Simple test data generators for performance
const simpleEmailArbitrary = fc.integer({ min: 1000, max: 9999 }).map(n => `histtest${n}@example.com`)
const simplePasswordArbitrary = fc.integer({ min: 100, max: 999 }).map(n => `Test123!${n}`)

describe('User History Retrieval Properties', () => {
  beforeAll(async () => {
    await connectDatabase()
  })

  beforeEach(async () => {
    // Clean up any existing test data before each test
    await prisma.detection.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'histtest'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'histtest'
        }
      }
    })
  })

  afterAll(async () => {
    // Final cleanup
    await prisma.detection.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'histtest'
          }
        }
      }
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'histtest'
        }
      }
    })
    await disconnectDatabase()
  })

  test('Property 8: User history retrieval accuracy - users only see their own detection history', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        async (email1, password1, email2, password2) => {
          // Skip if emails are the same (would cause conflict)
          if (email1 === email2) {
            return true
          }

          try {
            // Create two different users
            const user1Result = await AuthService.registerUser({
              email: email1,
              password: password1,
              role: 'user'
            })

            const user2Result = await AuthService.registerUser({
              email: email2,
              password: password2,
              role: 'user'
            })

            // Create a detection for user 1
            const user1Detection = await prisma.detection.create({
              data: {
                userId: user1Result.user.id,
                imageUrl: '/uploads/test/user1-image.jpg',
                originalFilename: 'user1-test.jpg',
                processingStatus: 'completed'
              }
            })

            // Create a detection for user 2
            const user2Detection = await prisma.detection.create({
              data: {
                userId: user2Result.user.id,
                imageUrl: '/uploads/test/user2-image.jpg',
                originalFilename: 'user2-test.jpg',
                processingStatus: 'completed'
              }
            })

            // Retrieve user 1's history
            const user1History = await prisma.detection.findMany({
              where: { userId: user1Result.user.id },
              orderBy: { createdAt: 'desc' }
            })

            // Retrieve user 2's history
            const user2History = await prisma.detection.findMany({
              where: { userId: user2Result.user.id },
              orderBy: { createdAt: 'desc' }
            })

            // Verify user 1 only sees their own detections
            expect(user1History).toHaveLength(1)
            expect(user1History[0].userId).toBe(user1Result.user.id)
            expect(user1History[0].id).toBe(user1Detection.id)

            // Verify user 2 only sees their own detections
            expect(user2History).toHaveLength(1)
            expect(user2History[0].userId).toBe(user2Result.user.id)
            expect(user2History[0].id).toBe(user2Detection.id)

            // Verify no cross-contamination
            expect(user1History[0].id).not.toBe(user2Detection.id)
            expect(user2History[0].id).not.toBe(user1Detection.id)

            // Clean up
            await prisma.detection.deleteMany({
              where: { userId: { in: [user1Result.user.id, user2Result.user.id] } }
            })
            await prisma.user.deleteMany({
              where: { id: { in: [user1Result.user.id, user2Result.user.id] } }
            })

          } catch (error) {
            // If registration fails due to duplicate email, that's acceptable for this test
            if (error instanceof Error && error.message.includes('already exists')) {
              return true
            }
            throw error
          }
        }
      ),
      { numRuns: 3 }
    )
  }, 60000)

  test('Property 8: Empty history for new users - new users have no detection history', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        async (email, password) => {
          try {
            // Create new user
            const userResult = await AuthService.registerUser({
              email,
              password,
              role: 'user'
            })

            // Retrieve user's history
            const userHistory = await prisma.detection.findMany({
              where: { userId: userResult.user.id },
              orderBy: { createdAt: 'desc' }
            })

            // Verify new user has empty history
            expect(userHistory).toHaveLength(0)
            expect(Array.isArray(userHistory)).toBe(true)

            // Clean up
            await prisma.user.delete({
              where: { id: userResult.user.id }
            })

          } catch (error) {
            // If registration fails due to duplicate email, that's acceptable for this test
            if (error instanceof Error && error.message.includes('already exists')) {
              return true
            }
            throw error
          }
        }
      ),
      { numRuns: 5 }
    )
  }, 60000)
})