import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import { connectDatabase, disconnectDatabase } from '../lib/database.js'
import authRoutes from '../routes/auth.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Create test app
const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase()
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'integration-test'
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'integration-test'
        }
      }
    })
    await disconnectDatabase()
  })

  test('should register a new user successfully', async () => {
    const userData = {
      email: 'integration-test-register@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    }

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201)

    expect(response.body.message).toBe('User registered successfully')
    expect(response.body.user).toBeDefined()
    expect(response.body.user.email).toBe(userData.email)
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(response.body.token).toBeDefined()
  })

  test('should login with valid credentials', async () => {
    const userData = {
      email: 'integration-test-login@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    }

    // First register the user
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201)

    // Then login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(200)

    expect(loginResponse.body.message).toBe('Login successful')
    expect(loginResponse.body.user).toBeDefined()
    expect(loginResponse.body.user.email).toBe(userData.email)
    expect(loginResponse.body.token).toBeDefined()
  })

  test('should reject login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!'
      })
      .expect(401)

    expect(response.body.error).toBe('Invalid email or password')
  })

  test('should get user profile with valid token', async () => {
    const userData = {
      email: 'integration-test-profile@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    }

    // Register and get token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201)

    const token = registerResponse.body.token

    // Get profile
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(profileResponse.body.user).toBeDefined()
    expect(profileResponse.body.user.email).toBe(userData.email)
    expect(profileResponse.body.user).not.toHaveProperty('passwordHash')
  })

  test('should reject profile request without token', async () => {
    const response = await request(app)
      .get('/api/auth/profile')
      .expect(401)

    expect(response.body.error).toBe('Access token required')
  })
})