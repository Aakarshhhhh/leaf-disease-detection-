import request from 'supertest'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import diseaseRoutes from '../routes/diseases.js'
import { diseaseService } from '../services/diseaseService.js'

const app = express()
app.use(express.json())
app.use('/api/diseases', diseaseRoutes)

const prisma = new PrismaClient()

describe('Disease API Endpoints', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.disease.deleteMany()
    await prisma.detection.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('GET /api/diseases', () => {
    it('should return empty list when no diseases exist', async () => {
      const response = await request(app)
        .get('/api/diseases')
        .expect(200)

      expect(response.body).toHaveProperty('diseases')
      expect(response.body.diseases).toHaveLength(0)
      expect(response.body.total).toBe(0)
    })

    it('should return disease information when diseases exist', async () => {
      // Create test user and detection
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword',
          firstName: 'Test',
          lastName: 'User'
        }
      })

      const detection = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image.jpg',
          processingStatus: 'completed',
          confidenceScore: 0.85,
          processedAt: new Date()
        }
      })

      // Create test disease
      await diseaseService.createDisease({
        detectionId: detection.id,
        diseaseName: 'bacterial_blight',
        confidence: 0.85,
        treatmentRecommendations: ['Remove affected leaves', 'Apply copper fungicide']
      })

      const response = await request(app)
        .get('/api/diseases')
        .expect(200)

      expect(response.body.diseases).toHaveLength(1)
      expect(response.body.diseases[0]).toHaveProperty('name', 'bacterial_blight')
      expect(response.body.diseases[0]).toHaveProperty('averageConfidence', 0.85)
      expect(response.body.diseases[0]).toHaveProperty('detectionCount', 1)
      expect(response.body.diseases[0]).toHaveProperty('treatmentRecommendations')
      expect(response.body.diseases[0].treatmentRecommendations).toContain('Remove affected leaves')
    })
  })

  describe('GET /api/diseases/:name', () => {
    it('should return 404 for non-existent disease', async () => {
      const response = await request(app)
        .get('/api/diseases/nonexistent')
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Disease not found')
    })

    it('should return detailed disease information', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword'
        }
      })

      const detection = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image.jpg',
          processingStatus: 'completed',
          confidenceScore: 0.85,
          processedAt: new Date()
        }
      })

      await diseaseService.createDisease({
        detectionId: detection.id,
        diseaseName: 'leaf_spot',
        confidence: 0.75,
        treatmentRecommendations: ['Apply fungicide', 'Remove infected leaves']
      })

      const response = await request(app)
        .get('/api/diseases/leaf_spot')
        .expect(200)

      expect(response.body).toHaveProperty('name', 'leaf_spot')
      expect(response.body).toHaveProperty('description')
      expect(response.body).toHaveProperty('severity')
      expect(response.body).toHaveProperty('symptoms')
      expect(response.body).toHaveProperty('treatmentRecommendations')
      expect(response.body).toHaveProperty('prevention')
      expect(response.body).toHaveProperty('statistics')
      expect(response.body.statistics).toHaveProperty('totalDetections', 1)
      expect(response.body.statistics).toHaveProperty('averageConfidence', 0.75)
    })
  })

  describe('GET /api/diseases/:name/treatments', () => {
    it('should return 404 for non-existent disease', async () => {
      const response = await request(app)
        .get('/api/diseases/nonexistent/treatments')
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Disease not found')
    })

    it('should return treatment information for existing disease', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword'
        }
      })

      const detection = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image.jpg',
          processingStatus: 'completed',
          processedAt: new Date()
        }
      })

      await diseaseService.createDisease({
        detectionId: detection.id,
        diseaseName: 'rust',
        confidence: 0.80,
        treatmentRecommendations: ['Apply sulfur fungicide', 'Improve air circulation']
      })

      const response = await request(app)
        .get('/api/diseases/rust/treatments')
        .expect(200)

      expect(response.body).toHaveProperty('diseaseName', 'rust')
      expect(response.body).toHaveProperty('treatments')
      expect(response.body).toHaveProperty('confidence', 0.80)
      expect(response.body).toHaveProperty('additionalGuidance')
      expect(response.body).toHaveProperty('urgency')
      expect(response.body).toHaveProperty('estimatedCost')
      expect(response.body).toHaveProperty('timeToRecovery')
      expect(response.body.treatments).toContain('Apply sulfur fungicide')
    })
  })

  describe('DiseaseService', () => {
    it('should create disease with treatment recommendations', async () => {
      // Create test user and detection
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword'
        }
      })

      const detection = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image.jpg',
          processingStatus: 'pending'
        }
      })

      const disease = await diseaseService.createDisease({
        detectionId: detection.id,
        diseaseName: 'powdery_mildew',
        confidence: 0.72,
        treatmentRecommendations: ['Increase air circulation', 'Apply baking soda solution']
      })

      expect(disease).toHaveProperty('id')
      expect(disease).toHaveProperty('diseaseName', 'powdery_mildew')
      expect(disease).toHaveProperty('confidence', 0.72)
      expect(disease.treatmentRecommendations).toContain('Increase air circulation')
    })

    it('should get treatment recommendations for known diseases', async () => {
      const treatments = await diseaseService.getTreatmentRecommendations('bacterial_blight')
      
      expect(treatments).toBeInstanceOf(Array)
      expect(treatments.length).toBeGreaterThan(0)
      expect(treatments).toContain('Remove affected leaves immediately')
      expect(treatments).toContain('Apply copper-based bactericide')
    })

    it('should return default treatments for unknown diseases', async () => {
      const treatments = await diseaseService.getTreatmentRecommendations('unknown_disease')
      
      expect(treatments).toBeInstanceOf(Array)
      expect(treatments.length).toBeGreaterThan(0)
      expect(treatments).toContain('Consult with agricultural extension service')
    })

    it('should get disease statistics', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashedpassword'
        }
      })

      const detection1 = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image1.jpg',
          processingStatus: 'completed',
          processedAt: new Date()
        }
      })

      const detection2 = await prisma.detection.create({
        data: {
          userId: user.id,
          imageUrl: '/test/image2.jpg',
          processingStatus: 'completed',
          processedAt: new Date()
        }
      })

      await diseaseService.createDisease({
        detectionId: detection1.id,
        diseaseName: 'healthy',
        confidence: 0.90,
        treatmentRecommendations: ['No treatment needed']
      })

      await diseaseService.createDisease({
        detectionId: detection2.id,
        diseaseName: 'leaf_spot',
        confidence: 0.75,
        treatmentRecommendations: ['Apply fungicide']
      })

      const stats = await diseaseService.getDiseaseStatistics()

      expect(stats).toHaveProperty('totalDetections', 2)
      expect(stats).toHaveProperty('healthyDetections', 1)
      expect(stats).toHaveProperty('diseaseDetections', 1)
      expect(stats).toHaveProperty('diseaseTypes')
      expect(stats.diseaseTypes).toHaveLength(2)
    })
  })
})