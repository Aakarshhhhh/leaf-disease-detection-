import { describe, test, expect } from '@jest/globals'
import * as fc from 'fast-check'
import { validateFileType, validateFileSize, processImage, createThumbnail } from '../services/uploadService.js'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

describe('Feature: leaf-disease-detection, Property 1: File validation rejects invalid inputs', () => {
  test('should reject files with invalid MIME types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('text/plain'),
          fc.constant('application/pdf'),
          fc.constant('video/mp4'),
          fc.constant('audio/mp3'),
          fc.constant('application/json'),
          fc.constant('text/html'),
          fc.constant('image/gif'),
          fc.constant('image/bmp'),
          fc.constant('image/tiff')
        ),
        (invalidMimeType) => {
          // Should reject invalid file types
          const isValid = validateFileType(invalidMimeType)
          expect(isValid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('should accept valid image MIME types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('image/jpeg'),
          fc.constant('image/jpg'),
          fc.constant('image/png'),
          fc.constant('image/webp')
        ),
        (validMimeType) => {
          // Should accept valid file types
          const isValid = validateFileType(validMimeType)
          expect(isValid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('should reject files exceeding size limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10 * 1024 * 1024 + 1, max: 50 * 1024 * 1024 }), // Files larger than 10MB
        (fileSize) => {
          // Should reject oversized files
          const isValid = validateFileSize(fileSize)
          expect(isValid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('should accept files within size limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 * 1024 * 1024 }), // Files up to 10MB
        (fileSize) => {
          // Should accept files within size limit
          const isValid = validateFileSize(fileSize)
          expect(isValid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('should reject zero-byte files', () => {
    const isValid = validateFileSize(0)
    expect(isValid).toBe(false)
  })
})

describe('Feature: leaf-disease-detection, Property 17: Image compression quality preservation', () => {
  // Helper function to create a test image
  async function createTestImage(width: number, height: number, format: 'jpeg' | 'png' | 'webp'): Promise<Buffer> {
    return await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer()
  }

  // Helper function to get image metadata
  async function getImageMetadata(buffer: Buffer) {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: metadata.size || 0
    }
  }

  test('should preserve essential image characteristics during compression', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2000 }), // width
        fc.integer({ min: 100, max: 2000 }), // height
        fc.oneof(
          fc.constant('jpeg' as const),
          fc.constant('png' as const),
          fc.constant('webp' as const)
        ),
        async (width, height, format) => {
          // Create a test image
          const originalBuffer = await createTestImage(width, height, format)
          const originalMetadata = await getImageMetadata(originalBuffer)
          
          // Create temporary files for testing
          const tempDir = 'temp-test'
          await fs.mkdir(tempDir, { recursive: true })
          
          const inputPath = path.join(tempDir, `test-input-${Date.now()}.jpg`)
          const outputPath = path.join(tempDir, `test-output-${Date.now()}.jpg`)
          
          try {
            // Write original image to file
            await fs.writeFile(inputPath, originalBuffer)
            
            // Process the image (compress)
            await processImage(inputPath, outputPath)
            
            // Read the processed image
            const processedBuffer = await fs.readFile(outputPath)
            const processedMetadata = await getImageMetadata(processedBuffer)
            
            // Verify that essential characteristics are preserved
            // The processed image should maintain reasonable dimensions
            expect(processedMetadata.width).toBeGreaterThan(0)
            expect(processedMetadata.height).toBeGreaterThan(0)
            
            // For images larger than 1024x1024, they should be resized
            if (originalMetadata.width > 1024 || originalMetadata.height > 1024) {
              expect(Math.max(processedMetadata.width, processedMetadata.height)).toBeLessThanOrEqual(1024)
            } else {
              // For smaller images, dimensions should be preserved or reasonably close
              expect(processedMetadata.width).toBeLessThanOrEqual(originalMetadata.width)
              expect(processedMetadata.height).toBeLessThanOrEqual(originalMetadata.height)
            }
            
            // The processed image should be a valid JPEG
            expect(processedMetadata.format).toBe('jpeg')
            
            // The processed image should have reasonable file size (not empty, not excessively large)
            expect(processedMetadata.size).toBeGreaterThan(100) // At least 100 bytes
            
          } finally {
            // Clean up temporary files
            try {
              await fs.unlink(inputPath)
              await fs.unlink(outputPath)
              await fs.rmdir(tempDir)
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 20 } // Fewer runs due to file I/O operations
    )
  })

  test('should create valid thumbnails with correct dimensions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 300, max: 2000 }), // width
        fc.integer({ min: 300, max: 2000 }), // height
        async (width, height) => {
          // Create a test image
          const originalBuffer = await createTestImage(width, height, 'jpeg')
          
          // Create temporary files for testing
          const tempDir = 'temp-test-thumb'
          await fs.mkdir(tempDir, { recursive: true })
          
          const inputPath = path.join(tempDir, `test-input-${Date.now()}.jpg`)
          const thumbnailPath = path.join(tempDir, `test-thumb-${Date.now()}.jpg`)
          
          try {
            // Write original image to file
            await fs.writeFile(inputPath, originalBuffer)
            
            // Create thumbnail
            await createThumbnail(inputPath, thumbnailPath)
            
            // Read the thumbnail
            const thumbnailBuffer = await fs.readFile(thumbnailPath)
            const thumbnailMetadata = await getImageMetadata(thumbnailBuffer)
            
            // Verify thumbnail characteristics
            expect(thumbnailMetadata.width).toBe(200)
            expect(thumbnailMetadata.height).toBe(200)
            expect(thumbnailMetadata.format).toBe('jpeg')
            expect(thumbnailMetadata.size).toBeGreaterThan(100) // At least 100 bytes
            
          } finally {
            // Clean up temporary files
            try {
              await fs.unlink(inputPath)
              await fs.unlink(thumbnailPath)
              await fs.rmdir(tempDir)
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 } // Fewer runs due to file I/O operations
    )
  })

  test('should maintain image readability after compression', async () => {
    // Test that compressed images can still be read and processed
    const testSizes = [
      { width: 500, height: 500 },
      { width: 1500, height: 1000 },
      { width: 2000, height: 1500 }
    ]

    for (const size of testSizes) {
      const originalBuffer = await createTestImage(size.width, size.height, 'jpeg')
      
      const tempDir = 'temp-test-readable'
      await fs.mkdir(tempDir, { recursive: true })
      
      const inputPath = path.join(tempDir, `test-readable-${Date.now()}.jpg`)
      const outputPath = path.join(tempDir, `test-readable-out-${Date.now()}.jpg`)
      
      try {
        await fs.writeFile(inputPath, originalBuffer)
        await processImage(inputPath, outputPath)
        
        // Verify the processed image can be read by sharp
        const processedBuffer = await fs.readFile(outputPath)
        const metadata = await sharp(processedBuffer).metadata()
        
        expect(metadata.width).toBeGreaterThan(0)
        expect(metadata.height).toBeGreaterThan(0)
        expect(metadata.format).toBe('jpeg')
        
      } finally {
        try {
          await fs.unlink(inputPath)
          await fs.unlink(outputPath)
          await fs.rmdir(tempDir)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  })
})