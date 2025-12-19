import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { 
  upload, 
  processImage, 
  createThumbnail, 
  extractFileMetadata,
  ensureUploadDirectories 
} from '../services/uploadService.js'
import { authenticateToken } from '../middleware/auth.js'
import { prisma } from '../lib/database.js'

const router = express.Router()

// File upload endpoint
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const userId = req.user!.id
    const detectionId = req.detectionId || req.file.filename.split('.')[0]
    
    // Extract file metadata
    const metadata = extractFileMetadata(req.file, userId, detectionId)
    
    // Create processed and thumbnail versions
    const userDir = path.join('uploads', userId)
    const processedPath = path.join(userDir, 'processed', `${detectionId}_result.jpg`)
    const thumbnailPath = path.join(userDir, 'thumbnails', `${detectionId}_thumb.jpg`)
    
    await processImage(req.file.path, processedPath)
    await createThumbnail(req.file.path, thumbnailPath)
    
    // Store detection record in database
    const detection = await prisma.detection.create({
      data: {
        userId,
        imageUrl: `/uploads/${userId}/original/${path.basename(req.file.path)}`,
        originalFilename: metadata.originalName,
        processingStatus: 'pending'
      }
    })

    res.json({
      message: 'File uploaded successfully',
      detectionId: detection.id,
      filename: metadata.originalName,
      mimetype: metadata.mimetype,
      size: metadata.size,
      imageUrl: detection.imageUrl,
      thumbnailUrl: `/uploads/${userId}/thumbnails/${detectionId}_thumb.jpg`,
      status: 'pending'
    })

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to process upload' })
  }
})

// Get upload status
router.get('/status/:detectionId', authenticateToken, async (req, res) => {
  try {
    const { detectionId } = req.params
    const userId = req.user!.id

    const detection = await prisma.detection.findFirst({
      where: {
        id: detectionId,
        userId
      },
      include: {
        diseases: true
      }
    })

    if (!detection) {
      return res.status(404).json({ error: 'Detection not found' })
    }

    res.json({
      id: detection.id,
      status: detection.processingStatus,
      imageUrl: detection.imageUrl,
      confidence: detection.confidenceScore,
      diseases: detection.diseases,
      processedAt: detection.processedAt,
      createdAt: detection.createdAt
    })

  } catch (error) {
    console.error('Status check error:', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

// Serve uploaded files
router.get('/files/:userId/:folder/:filename', (req, res) => {
  try {
    const { userId, folder, filename } = req.params
    const allowedFolders = ['original', 'processed', 'thumbnails']
    
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' })
    }

    const filePath = path.join('uploads', userId, folder, filename)
    
    // Check if file exists and serve it
    res.sendFile(path.resolve(filePath), (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found' })
      }
    })

  } catch (error) {
    console.error('File serve error:', error)
    res.status(500).json({ error: 'Failed to serve file' })
  }
})

export default router