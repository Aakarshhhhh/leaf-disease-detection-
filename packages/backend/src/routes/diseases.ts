import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * GET /api/diseases
 * Get list of all known diseases with their information
 */
router.get('/', async (req, res) => {
  try {
    // Get unique diseases from the database with their treatment recommendations
    const diseases = await prisma.disease.groupBy({
      by: ['diseaseName'],
      _avg: {
        confidence: true
      },
      _count: {
        diseaseName: true
      }
    })

    // Get detailed information for each disease
    const diseaseInfo = await Promise.all(
      diseases.map(async (disease) => {
        // Get the most recent treatment recommendations for this disease
        const latestDisease = await prisma.disease.findFirst({
          where: { diseaseName: disease.diseaseName },
          orderBy: { detection: { processedAt: 'desc' } },
          select: {
            treatmentRecommendations: true,
            diseaseName: true
          }
        })

        return {
          name: disease.diseaseName,
          averageConfidence: disease._avg.confidence,
          detectionCount: disease._count.diseaseName,
          treatmentRecommendations: latestDisease?.treatmentRecommendations || [],
          description: getDiseaseDescription(disease.diseaseName),
          severity: getDiseaseSeverity(disease.diseaseName),
          symptoms: getDiseaseSymptoms(disease.diseaseName),
          prevention: getDiseasePrevention(disease.diseaseName)
        }
      })
    )

    res.json({
      diseases: diseaseInfo,
      total: diseases.length
    })
  } catch (error) {
    console.error('Error fetching diseases:', error)
    res.status(500).json({ 
      error: 'Failed to fetch disease information',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/diseases/:name
 * Get detailed information about a specific disease
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params
    
    // Get all detections for this disease
    const diseaseDetections = await prisma.disease.findMany({
      where: { 
        diseaseName: {
          equals: name,
          mode: 'insensitive'
        }
      },
      include: {
        detection: {
          select: {
            id: true,
            confidenceScore: true,
            processedAt: true,
            locationLat: true,
            locationLng: true
          }
        }
      },
      orderBy: {
        detection: { processedAt: 'desc' }
      }
    })

    if (diseaseDetections.length === 0) {
      return res.status(404).json({ 
        error: 'Disease not found',
        message: `No detections found for disease: ${name}`
      })
    }

    // Calculate statistics
    const confidences = diseaseDetections.map(d => d.confidence)
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length
    const maxConfidence = Math.max(...confidences)
    const minConfidence = Math.min(...confidences)

    // Get the most recent treatment recommendations
    const latestDetection = diseaseDetections[0]

    const diseaseInfo = {
      name: name,
      description: getDiseaseDescription(name),
      severity: getDiseaseSeverity(name),
      symptoms: getDiseaseSymptoms(name),
      treatmentRecommendations: latestDetection.treatmentRecommendations,
      prevention: getDiseasePrevention(name),
      statistics: {
        totalDetections: diseaseDetections.length,
        averageConfidence: avgConfidence,
        maxConfidence: maxConfidence,
        minConfidence: minConfidence,
        firstDetected: diseaseDetections[diseaseDetections.length - 1]?.detection.processedAt,
        lastDetected: diseaseDetections[0]?.detection.processedAt
      },
      recentDetections: diseaseDetections.slice(0, 10).map(d => ({
        id: d.detection.id,
        confidence: d.confidence,
        processedAt: d.detection.processedAt,
        location: d.detection.locationLat && d.detection.locationLng ? {
          lat: d.detection.locationLat,
          lng: d.detection.locationLng
        } : null
      }))
    }

    res.json(diseaseInfo)
  } catch (error) {
    console.error('Error fetching disease details:', error)
    res.status(500).json({ 
      error: 'Failed to fetch disease details',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/diseases/:name/treatments
 * Get treatment recommendations for a specific disease
 */
router.get('/:name/treatments', async (req, res) => {
  try {
    const { name } = req.params
    
    // Get the most recent treatment recommendations for this disease
    const latestDisease = await prisma.disease.findFirst({
      where: { 
        diseaseName: {
          equals: name,
          mode: 'insensitive'
        }
      },
      orderBy: { detection: { processedAt: 'desc' } },
      select: {
        treatmentRecommendations: true,
        diseaseName: true,
        confidence: true
      }
    })

    if (!latestDisease) {
      return res.status(404).json({ 
        error: 'Disease not found',
        message: `No treatment information found for disease: ${name}`
      })
    }

    const treatmentInfo = {
      diseaseName: latestDisease.diseaseName,
      treatments: latestDisease.treatmentRecommendations,
      confidence: latestDisease.confidence,
      additionalGuidance: getAdditionalGuidance(name),
      urgency: getTreatmentUrgency(name),
      estimatedCost: getEstimatedTreatmentCost(name),
      timeToRecovery: getEstimatedRecoveryTime(name)
    }

    res.json(treatmentInfo)
  } catch (error) {
    console.error('Error fetching treatment information:', error)
    res.status(500).json({ 
      error: 'Failed to fetch treatment information',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/diseases/user/:userId/history
 * Get disease detection history for a specific user (requires authentication)
 */
router.get('/user/:userId/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 50, offset = 0, diseaseType } = req.query

    // Verify user can access this data (user can only access their own data unless admin)
    if (req.user?.id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own disease history'
      })
    }

    const whereClause: any = {
      detection: {
        userId: userId
      }
    }

    if (diseaseType) {
      whereClause.diseaseName = {
        equals: diseaseType as string,
        mode: 'insensitive'
      }
    }

    const diseases = await prisma.disease.findMany({
      where: whereClause,
      include: {
        detection: {
          select: {
            id: true,
            imageUrl: true,
            confidenceScore: true,
            processedAt: true,
            locationLat: true,
            locationLng: true
          }
        }
      },
      orderBy: {
        detection: { processedAt: 'desc' }
      },
      take: Number(limit),
      skip: Number(offset)
    })

    const formattedHistory = diseases.map(disease => ({
      id: disease.id,
      diseaseName: disease.diseaseName,
      confidence: disease.confidence,
      treatmentRecommendations: disease.treatmentRecommendations,
      affectedRegions: disease.affectedRegions,
      detection: {
        id: disease.detection.id,
        imageUrl: disease.detection.imageUrl,
        confidenceScore: disease.detection.confidenceScore,
        processedAt: disease.detection.processedAt,
        location: disease.detection.locationLat && disease.detection.locationLng ? {
          lat: disease.detection.locationLat,
          lng: disease.detection.locationLng
        } : null
      }
    }))

    res.json({
      history: formattedHistory,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: formattedHistory.length
      }
    })
  } catch (error) {
    console.error('Error fetching user disease history:', error)
    res.status(500).json({ 
      error: 'Failed to fetch disease history',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Helper functions for disease information
function getDiseaseDescription(diseaseName: string): string {
  const descriptions: Record<string, string> = {
    'healthy': 'No disease detected. The plant appears to be in good health.',
    'bacterial_blight': 'A bacterial infection that causes water-soaked lesions on leaves, often with yellow halos. Can spread rapidly in warm, humid conditions.',
    'leaf_spot': 'Fungal or bacterial infection causing circular or irregular spots on leaves. May lead to premature leaf drop if untreated.',
    'rust': 'Fungal disease characterized by orange, yellow, or reddish pustules on leaf surfaces. Thrives in humid conditions.',
    'powdery_mildew': 'Fungal disease appearing as white, powdery coating on leaves. Reduces photosynthesis and plant vigor.',
    'early_blight': 'Fungal disease causing dark, concentric ring spots on leaves. Common in warm, humid weather.',
    'late_blight': 'Serious fungal disease causing dark, water-soaked lesions. Can destroy entire crops if not controlled quickly.'
  }
  
  return descriptions[diseaseName.toLowerCase()] || 'Disease information not available. Consult with a plant pathologist for accurate diagnosis.'
}

function getDiseaseSeverity(diseaseName: string): 'low' | 'medium' | 'high' | 'critical' {
  const severities: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    'healthy': 'low',
    'bacterial_blight': 'high',
    'leaf_spot': 'medium',
    'rust': 'medium',
    'powdery_mildew': 'medium',
    'early_blight': 'high',
    'late_blight': 'critical'
  }
  
  return severities[diseaseName.toLowerCase()] || 'medium'
}

function getDiseaseSymptoms(diseaseName: string): string[] {
  const symptoms: Record<string, string[]> = {
    'healthy': ['Vibrant green color', 'No visible lesions', 'Normal growth pattern'],
    'bacterial_blight': [
      'Water-soaked lesions on leaves',
      'Yellow halos around spots',
      'Rapid spread in humid conditions',
      'Leaf wilting and browning'
    ],
    'leaf_spot': [
      'Circular or irregular spots on leaves',
      'Brown or black lesions',
      'Yellow margins around spots',
      'Premature leaf drop'
    ],
    'rust': [
      'Orange, yellow, or red pustules',
      'Powdery spore masses on leaf undersides',
      'Yellowing of affected areas',
      'Stunted growth'
    ],
    'powdery_mildew': [
      'White, powdery coating on leaves',
      'Distorted or curled leaves',
      'Reduced plant vigor',
      'Yellowing of infected areas'
    ]
  }
  
  return symptoms[diseaseName.toLowerCase()] || ['Symptoms vary - consult plant pathologist']
}

function getDiseasePrevention(diseaseName: string): string[] {
  const prevention: Record<string, string[]> = {
    'healthy': ['Maintain proper watering', 'Ensure good air circulation', 'Regular monitoring'],
    'bacterial_blight': [
      'Avoid overhead watering',
      'Improve air circulation',
      'Remove infected plant debris',
      'Use disease-free seeds'
    ],
    'leaf_spot': [
      'Water at soil level',
      'Ensure proper plant spacing',
      'Remove fallen leaves',
      'Rotate crops annually'
    ],
    'rust': [
      'Avoid evening watering',
      'Improve air circulation',
      'Remove infected leaves promptly',
      'Choose resistant varieties'
    ],
    'powdery_mildew': [
      'Increase air circulation',
      'Avoid overcrowding plants',
      'Water at soil level',
      'Choose resistant cultivars'
    ]
  }
  
  return prevention[diseaseName.toLowerCase()] || ['Follow general plant hygiene practices']
}

function getAdditionalGuidance(diseaseName: string): string[] {
  const guidance: Record<string, string[]> = {
    'healthy': ['Continue current care routine', 'Monitor regularly for early disease signs'],
    'bacterial_blight': [
      'Act quickly - bacterial diseases spread rapidly',
      'Disinfect tools between plants',
      'Consider copper-based treatments'
    ],
    'leaf_spot': [
      'Treatment is most effective when started early',
      'Combine chemical and cultural controls',
      'Monitor weather conditions'
    ],
    'rust': [
      'Remove infected material immediately',
      'Apply treatments preventively in humid weather',
      'Consider systemic fungicides for severe cases'
    ],
    'powdery_mildew': [
      'Baking soda solutions can be effective for mild cases',
      'Ensure plants receive adequate sunlight',
      'Avoid high nitrogen fertilizers'
    ]
  }
  
  return guidance[diseaseName.toLowerCase()] || ['Consult with local agricultural extension service']
}

function getTreatmentUrgency(diseaseName: string): 'low' | 'medium' | 'high' | 'immediate' {
  const urgency: Record<string, 'low' | 'medium' | 'high' | 'immediate'> = {
    'healthy': 'low',
    'bacterial_blight': 'immediate',
    'leaf_spot': 'medium',
    'rust': 'medium',
    'powdery_mildew': 'medium',
    'early_blight': 'high',
    'late_blight': 'immediate'
  }
  
  return urgency[diseaseName.toLowerCase()] || 'medium'
}

function getEstimatedTreatmentCost(diseaseName: string): string {
  const costs: Record<string, string> = {
    'healthy': '$0 - No treatment needed',
    'bacterial_blight': '$15-30 - Copper fungicide and cultural practices',
    'leaf_spot': '$10-25 - Fungicide spray and sanitation',
    'rust': '$12-28 - Sulfur-based fungicide',
    'powdery_mildew': '$8-20 - Baking soda solution or fungicide',
    'early_blight': '$20-40 - Fungicide program',
    'late_blight': '$25-50 - Intensive fungicide treatment'
  }
  
  return costs[diseaseName.toLowerCase()] || '$15-35 - Varies by treatment method'
}

function getEstimatedRecoveryTime(diseaseName: string): string {
  const recovery: Record<string, string> = {
    'healthy': 'N/A - Plant is healthy',
    'bacterial_blight': '2-4 weeks with proper treatment',
    'leaf_spot': '1-3 weeks with fungicide treatment',
    'rust': '2-3 weeks with proper management',
    'powdery_mildew': '1-2 weeks with treatment',
    'early_blight': '3-4 weeks with fungicide program',
    'late_blight': '4-6 weeks if caught early, may be fatal if advanced'
  }
  
  return recovery[diseaseName.toLowerCase()] || '2-4 weeks with appropriate treatment'
}

export default router