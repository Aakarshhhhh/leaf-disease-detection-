import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

// File upload configuration
const UPLOAD_DIR = 'uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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
  return size <= MAX_FILE_SIZE
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

// Clean up uploaded files
export async function cleanupFiles(userId: string, detectionId: string): Promise<void> {
  try {
    const userDir = path.join(UPLOAD_DIR, userId)
    const originalFile = path.join(userDir, 'original', `${detectionId}.*`)
    const processedFile = path.join(userDir, 'processed', `${detectionId}_result.*`)
    const thumbnailFile = path.join(userDir, 'thumbnails', `${detectionId}_thumb.jpg`)

    // Note: In a real implementation, you'd use glob to find files with any extension
    // For now, we'll handle cleanup in the route handlers
  } catch (error) {
    console.error('Error cleaning up files:', error)
  }
}