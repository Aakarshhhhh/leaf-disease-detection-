import { describe, it, expect } from '@jest/globals'
import request from 'supertest'
import express from 'express'

// Simple test to verify Jest setup
describe('Server Setup', () => {
  it('should create an express app', () => {
    const app = express()
    expect(app).toBeDefined()
  })

  it('should handle basic routing', async () => {
    const app = express()
    app.get('/test', (req, res) => {
      res.json({ message: 'test' })
    })

    const response = await request(app).get('/test')
    expect(response.status).toBe(200)
    expect(response.body.message).toBe('test')
  })
})