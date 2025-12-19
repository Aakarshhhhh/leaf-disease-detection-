/**
 * Property-based tests for authentication security
 * Feature: leaf-disease-detection, Property 7: Secure user data storage
 * Validates: Requirements 3.1, 3.5
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import fc from 'fast-check'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AuthService } from '../services/authService.js'
import { generateToken } from '../middleware/auth.js'
import { connectDatabase, disconnectDatabase } from '../lib/database.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Simple test data generators for performance
const simpleEmailArbitrary = fc.integer({ min: 1000, max: 9999 }).map(n => `test${n}@example.com`)
const simplePasswordArbitrary = fc.integer({ min: 100, max: 999 }).map(n => `Test123!${n}`)
const simpleNameArbitrary = fc.integer({ min: 1, max: 100 }).map(n => `Name${n}`)

describe('Authentication Security Properties', () => {
  beforeAll(async () => {
    await connectDatabase()
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test'
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test'
        }
      }
    })
    await disconnectDatabase()
  })

  test('Property 7: Secure user data storage - passwords are never stored in plaintext', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        simpleNameArbitrary,
        async (email, password, firstName) => {
          const testUserData = {
            email,
            password,
            firstName,
            role: 'user'
          }

          try {
            // Register user
            const result = await AuthService.registerUser(testUserData)
            
            // Verify password is not stored in plaintext
            const userInDb = await prisma.user.findUnique({
              where: { email: testUserData.email }
            })
            
            expect(userInDb).toBeTruthy()
            expect(userInDb!.passwordHash).not.toBe(testUserData.password)
            expect(userInDb!.passwordHash).not.toContain(testUserData.password)
            
            // Verify password is properly hashed (bcrypt format)
            expect(userInDb!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/)
            
            // Verify the hash can be verified with bcrypt
            const isValidHash = await bcrypt.compare(testUserData.password, userInDb!.passwordHash)
            expect(isValidHash).toBe(true)
            
            // Verify returned user object doesn't contain password hash
            expect(result.user).not.toHaveProperty('passwordHash')
            expect(result.user).not.toHaveProperty('password')
            
            // Clean up
            await prisma.user.delete({ where: { id: userInDb!.id } })
            
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

  test('Property 7: JWT tokens contain correct user information and are properly signed', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        async (email, password) => {
          const testUserData = {
            email,
            password,
            role: 'user'
          }

          try {
            // Register user
            const result = await AuthService.registerUser(testUserData)
            
            // Verify JWT token structure and content
            const jwtSecret = process.env.JWT_SECRET!
            const decoded = jwt.verify(result.token, jwtSecret) as any
            
            // Verify token contains correct user information
            expect(decoded.userId).toBe(result.user.id)
            expect(decoded.email).toBe(result.user.email)
            expect(decoded.role).toBe(result.user.role)
            
            // Verify token doesn't contain sensitive information
            expect(decoded).not.toHaveProperty('password')
            expect(decoded).not.toHaveProperty('passwordHash')
            
            // Verify token has expiration
            expect(decoded.exp).toBeDefined()
            expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
            
            // Clean up
            await prisma.user.delete({ where: { id: result.user.id } })
            
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

  test('Property 7: Password verification works correctly for all valid passwords', async () => {
    await fc.assert(
      fc.asyncProperty(simplePasswordArbitrary, async (password) => {
        // Hash the password
        const hashedPassword = await AuthService.hashPassword(password)
        
        // Verify the password hash is not the original password
        expect(hashedPassword).not.toBe(password)
        expect(hashedPassword).not.toContain(password)
        
        // Verify the password can be verified correctly
        const isValid = await AuthService.verifyPassword(password, hashedPassword)
        expect(isValid).toBe(true)
        
        // Verify wrong passwords are rejected
        const wrongPassword = password + 'wrong'
        const isWrongValid = await AuthService.verifyPassword(wrongPassword, hashedPassword)
        expect(isWrongValid).toBe(false)
      }),
      { numRuns: 5 }
    )
  }, 60000)

  test('Property 7: User data retrieval never exposes password hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        simpleEmailArbitrary,
        simplePasswordArbitrary,
        async (email, password) => {
          const testUserData = {
            email,
            password,
            role: 'user'
          }

          try {
            // Register user
            const result = await AuthService.registerUser(testUserData)
            
            // Retrieve user by ID
            const retrievedUser = await AuthService.getUserById(result.user.id)
            
            expect(retrievedUser).toBeTruthy()
            expect(retrievedUser).not.toHaveProperty('passwordHash')
            expect(retrievedUser).not.toHaveProperty('password')
            
            // Verify all other fields are present
            expect(retrievedUser!.id).toBe(result.user.id)
            expect(retrievedUser!.email).toBe(result.user.email)
            expect(retrievedUser!.role).toBe(result.user.role)
            
            // Clean up
            await prisma.user.delete({ where: { id: result.user.id } })
            
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
})