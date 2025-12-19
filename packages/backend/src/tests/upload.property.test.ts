import { describe, test, expect } from '@jest/globals'
import * as fc from 'fast-check'
import request from 'supertest'
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create a test app with file upload endpoint
const createTestApp = () => {
  const app = express()
  
  // Configure multer for file uploads
  const storage = multer.memoryStorage()
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'))
      }
    }
  })

  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    res.json({
      message: 'File uploaded successfully',
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    })
  })

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
      }
    }
    if (err.message.includes('Invalid file type')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}

describe('Feature: leaf-disease-detection, Property 1: File validation rejects invalid inputs', () => {
  test('should reject files with invalid formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('text/plain'),
          fc.constant('application/pdf'),
          fc.constant('video/mp4'),
          fc.constant('audio/mp3'),
          fc.constant('application/json'),
          fc.constant('text/html')
        ),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (invalidMimeType, filename) => {
          const app = createTestApp()
          
          // Create a small buffer to simulate file content
          const fileBuffer = Buffer.from('fake file content')
          
          const response = await request(app)
            .post('/api/upload')
            .attach('image', fileBuffer, {
              filename: `${filename}.txt`,
              contentType: invalidMimeType
            })
          
          // Should reject invalid file types
          expect(response.status).toBe(400)
          expect(response.body.error).toContain('Invalid file type')
        }
      ),
      { numRuns: 50 }
    )
  })

  test('should reject files exceeding size limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 11 * 1024 * 1024, max: 20 * 1024 * 1024 }), // Files larger than 10MB
        fc.oneof(
          fc.constant('image/jpeg'),
          fc.constant('image/png'),
          fc.constant('image/webp')
        ),
        async (fileSize, validMimeType) => {
          const app = createTestApp()
          
          // Create a large buffer to simulate oversized file
          const largeBuffer = Buffer.alloc(fileSize, 'x')
          
          const response = await request(app)
            .post('/api/upload')
            .attach('image', largeBuffer, {
              filename: 'large-image.jpg',
              contentType: validMimeType
            })
          
          // Should reject oversized files
          expect(response.status).toBe(400)
          expect(response.body.error).toContain('File too large')
        }
      ),
      { numRuns: 20 } // Fewer runs due to large file generation
    )
  })

  test('should accept valid image files within size limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('image/jpeg'),
          fc.constant('image/jpg'),
          fc.constant('image/png'),
          fc.constant('image/webp')
        ),
        fc.integer({ min: 1024, max: 5 * 1024 * 1024 }), // 1KB to 5MB
        fc.string({ minLength: 1, maxLength: 50 }),
        async (validMimeType, fileSize, filename) => {
          const app = createTestApp()
          
          // Create a buffer within size limits
          const validBuffer = Buffer.alloc(fileSize, 'x')
          
          const response = await request(app)
            .post('/api/upload')
            .attach('image', validBuffer, {
              filename: `${filename}.jpg`,
              contentType: validMimeType
            })
          
          // Should accept valid files
          expect(response.status).toBe(200)
          expect(response.body.message).toBe('File uploaded successfully')
          expect(response.body.mimetype).toBe(validMimeType)
          expect(response.body.size).toBe(fileSize)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('should return appropriate error messages for missing files', async () => {
    const app = createTestApp()
    
    const response = await request(app)
      .post('/api/upload')
      .send({}) // No file attached
    
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('No file uploaded')
  })
})