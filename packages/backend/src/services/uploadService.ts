import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import AWS from 'aws-sdk'

// File upload configuration
const UPLOAD_DIR = 'uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// AWS S3 configuration (optional)
const USE_S3 = process.env.USE_S3 === 'true'
const S3_BUCKET = process.env.S3_BUCKET_NAME
let s3: AWS.S3 | null = null

if (USE_S3 && S3_BUCKET) {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  })
  s3 = new AWS.S3()
}

// Ensure upload directories exist
export async function ensureUploadDirectories(userId: string): Promise<void> {
  const userDir = path.join(UPLOAD_DIR, userId)
  const originalDir = path.join(userDir, 'original')
  const processedDir = path.join(userDir, 'processed')
  const thumbnailDir = path.join(userDir, 'thumbnails')

  await fs.mkdir(originalDir, { recursive: true })
  await fs.mkdir(processedDir, { recursive: true })
  await fs.mkdir(thumbnailDir, { recursive: true })
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const userId = req.user?.id || 'anonymous'
      await ensureUploadDirectories(userId)
      const originalDir = path.join(UPLOAD_DIR, userId, 'original')
      cb(null, originalDir)
    } catch (error) {
      cb(error as Error, '')
    }
  },
  filename: (req, file, cb) => {
    const detectionId = uuidv4()
    const ext = path.extname(file.originalname)
    req.detectionId = detectionId // Store for later use
    cb(null, `${detectionId}${ext}`)
  }
})

// File filter function
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'))
  }
}

// Create multer instance
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter
})

// Image processing utilities
export async function processImage(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize(1024, 1024, { 
      fit: 'inside',
      withoutEnlargement: true 
    })
    .jpeg({ quality: 85 })
    .toFile(outputPath)
}

export async function createThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize(200, 200, { 
      fit: 'cover' 
    })
    .jpeg({ quality: 80 })
    .toFile(outputPath)
}

// File validation utilities
export function validateFileType(mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimetype)
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE
}

// File metadata extraction
export interface FileMetadata {
  originalName: string
  mimetype: string
  size: number
  detectionId: string
  userId: string
  uploadPath: string
}

export function extractFileMetadata(file: Express.Multer.File, userId: string, detectionId: string): FileMetadata {
  return {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    detectionId,
    userId,
    uploadPath: file.path
  }
}

// Upload file to S3 (if configured)
export async function uploadToS3(filePath: string, key: string, contentType: string): Promise<string> {
  if (!s3 || !S3_BUCKET) {
    throw new Error('S3 not configured')
  }

  const fileContent = await fs.readFile(filePath)
  
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    ACL: 'private' as const
  }

  const result = await s3.upload(params).promise()
  return result.Location
}

// Get signed URL for S3 file access
export async function getS3SignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!s3 || !S3_BUCKET) {
    throw new Error('S3 not configured')
  }

  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: expiresIn
  }

  return s3.getSignedUrl('getObject', params)
}

// Clean up uploaded files
export async function cleanupFiles(userId: string, detectionId: string): Promise<void> {
  try {
    if (USE_S3) {
      // Clean up S3 files
      if (s3 && S3_BUCKET) {
        const keys = [
          `${userId}/original/${detectionId}`,
          `${userId}/processed/${detectionId}_result.jpg`,
          `${userId}/thumbnails/${detectionId}_thumb.jpg`
        ]
        
        for (const key of keys) {
          try {
            await s3.deleteObject({ Bucket: S3_BUCKET, Key: key }).promise()
          } catch (error) {
            console.error(`Error deleting S3 object ${key}:`, error)
          }
        }
      }
    } else {
      // Clean up local files
      const userDir = path.join(UPLOAD_DIR, userId)
      const filesToDelete = [
        path.join(userDir, 'original', `${detectionId}.*`),
        path.join(userDir, 'processed', `${detectionId}_result.jpg`),
        path.join(userDir, 'thumbnails', `${detectionId}_thumb.jpg`)
      ]
      
      for (const filePath of filesToDelete) {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          // File might not exist, ignore error
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up files:', error)
  }
}