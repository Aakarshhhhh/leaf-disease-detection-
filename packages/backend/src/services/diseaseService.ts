import { PrismaClient } from '@prisma/client'
import { Disease, CreateDiseaseInput, BoundingBox } from '../types/index.js'

const prisma = new PrismaClient()

export class DiseaseService {
  /**
   * Create a new disease record
   */
  async createDisease(diseaseData: CreateDiseaseInput): Promise<Disease> {
    const disease = await prisma.disease.create({
      data: {
        detectionId: diseaseData.detectionId,
        diseaseName: diseaseData.diseaseName,
        confidence: diseaseData.confidence,
        affectedRegions: diseaseData.affectedRegions ? JSON.parse(JSON.stringify(diseaseData.affectedRegions)) : null,
        treatmentRecommendations: diseaseData.treatmentRecommendations
      }
    })

    return {
      id: disease.id,
      detectionId: disease.detectionId,
      diseaseName: disease.diseaseName,
      confidence: disease.confidence,
      affectedRegions: disease.affectedRegions ? (disease.affectedRegions as unknown as BoundingBox[]) : undefined,
      treatmentRecommendations: disease.treatmentRecommendations
    }
  }

  /**
   * Get all diseases for a specific detection
   */
  async getDiseasesByDetection(detectionId: string): Promise<Disease[]> {
    const diseases = await prisma.disease.findMany({
      where: { detectionId },
      orderBy: { confidence: 'desc' }
    })

    return diseases.map(disease => ({
      id: disease.id,
      detectionId: disease.detectionId,
      diseaseName: disease.diseaseName,
      confidence: disease.confidence,
      affectedRegions: disease.affectedRegions ? (disease.affectedRegions as unknown as BoundingBox[]) : undefined,
      treatmentRecommendations: disease.treatmentRecommendations
    }))
  }

  /**
   * Get disease statistics
   */
  async getDiseaseStatistics() {
    const totalDiseases = await prisma.disease.count()
    
    const diseasesByType = await prisma.disease.groupBy({
      by: ['diseaseName'],
      _count: {
        diseaseName: true
      },
      _avg: {
        confidence: true
      },
      orderBy: {
        _count: {
          diseaseName: 'desc'
        }
      }
    })

    const healthyCount = await prisma.disease.count({
      where: {
        diseaseName: {
          equals: 'healthy',
          mode: 'insensitive'
        }
      }
    })

    const diseaseCount = totalDiseases - healthyCount

    return {
      totalDetections: totalDiseases,
      healthyDetections: healthyCount,
      diseaseDetections: diseaseCount,
      diseaseTypes: diseasesByType.map(d => ({
        name: d.diseaseName,
        count: d._count.diseaseName,
        averageConfidence: d._avg.confidence
      }))
    }
  }

  /**
   * Get treatment recommendations for a disease
   */
  async getTreatmentRecommendations(diseaseName: string): Promise<string[]> {
    // Get the most recent treatment recommendations for this disease
    const latestDisease = await prisma.disease.findFirst({
      where: { 
        diseaseName: {
          equals: diseaseName,
          mode: 'insensitive'
        }
      },
      orderBy: { detection: { processedAt: 'desc' } },
      select: {
        treatmentRecommendations: true
      }
    })

    if (latestDisease) {
      return latestDisease.treatmentRecommendations
    }

    // Fallback to default recommendations
    return this.getDefaultTreatmentRecommendations(diseaseName)
  }

  /**
   * Get default treatment recommendations for known diseases
   */
  private getDefaultTreatmentRecommendations(diseaseName: string): string[] {
    const defaultTreatments: Record<string, string[]> = {
      'healthy': [
        'No treatment needed',
        'Continue regular plant care',
        'Monitor for early signs of disease'
      ],
      'bacterial_blight': [
        'Remove affected leaves immediately',
        'Apply copper-based bactericide',
        'Improve air circulation around plants',
        'Avoid overhead watering'
      ],
      'leaf_spot': [
        'Remove infected leaves and debris',
        'Apply fungicide spray',
        'Ensure proper plant spacing',
        'Water at soil level to avoid wetting leaves'
      ],
      'rust': [
        'Remove affected leaves',
        'Apply sulfur-based fungicide',
        'Improve air circulation',
        'Avoid watering in evening'
      ],
      'powdery_mildew': [
        'Increase air circulation',
        'Apply baking soda solution (1 tsp per quart water)',
        'Use fungicidal spray if severe',
        'Remove heavily infected leaves'
      ],
      'early_blight': [
        'Remove infected leaves and debris',
        'Apply copper or chlorothalonil fungicide',
        'Improve air circulation',
        'Avoid overhead watering',
        'Rotate crops next season'
      ],
      'late_blight': [
        'Remove and destroy infected plants immediately',
        'Apply copper-based fungicide preventively',
        'Improve air circulation',
        'Avoid overhead watering',
        'Consider resistant varieties for future planting'
      ]
    }

    return defaultTreatments[diseaseName.toLowerCase()] || [
      'Consult with agricultural extension service',
      'Consider professional plant pathologist consultation',
      'Monitor plant closely for changes',
      'Remove affected plant material',
      'Improve growing conditions'
    ]
  }

  /**
   * Update treatment recommendations for a disease
   */
  async updateTreatmentRecommendations(diseaseId: string, treatments: string[]): Promise<Disease> {
    const updatedDisease = await prisma.disease.update({
      where: { id: diseaseId },
      data: { treatmentRecommendations: treatments }
    })

    return {
      id: updatedDisease.id,
      detectionId: updatedDisease.detectionId,
      diseaseName: updatedDisease.diseaseName,
      confidence: updatedDisease.confidence,
      affectedRegions: updatedDisease.affectedRegions ? (updatedDisease.affectedRegions as unknown as BoundingBox[]) : undefined,
      treatmentRecommendations: updatedDisease.treatmentRecommendations
    }
  }

  /**
   * Search diseases by name or symptoms
   */
  async searchDiseases(query: string): Promise<any[]> {
    const diseases = await prisma.disease.findMany({
      where: {
        diseaseName: {
          contains: query,
          mode: 'insensitive'
        }
      },
      include: {
        detection: {
          select: {
            id: true,
            confidenceScore: true,
            processedAt: true
          }
        }
      },
      orderBy: {
        confidence: 'desc'
      },
      take: 20
    })

    // Group by disease name and get statistics
    const diseaseMap = new Map()
    
    diseases.forEach(disease => {
      const name = disease.diseaseName
      if (!diseaseMap.has(name)) {
        diseaseMap.set(name, {
          name: name,
          detections: [],
          averageConfidence: 0,
          treatmentRecommendations: disease.treatmentRecommendations
        })
      }
      
      diseaseMap.get(name).detections.push({
        id: disease.id,
        confidence: disease.confidence,
        processedAt: disease.detection.processedAt
      })
    })

    // Calculate averages and format results
    const results = Array.from(diseaseMap.values()).map(disease => {
      const confidences = disease.detections.map((d: any) => d.confidence)
      disease.averageConfidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
      disease.totalDetections = disease.detections.length
      
      return disease
    })

    return results.sort((a, b) => b.averageConfidence - a.averageConfidence)
  }

  /**
   * Get disease trends over time
   */
  async getDiseaseTrends(days: number = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const trends = await prisma.disease.findMany({
      where: {
        detection: {
          processedAt: {
            gte: startDate
          }
        }
      },
      include: {
        detection: {
          select: {
            processedAt: true
          }
        }
      },
      orderBy: {
        detection: {
          processedAt: 'asc'
        }
      }
    })

    // Group by date and disease type
    const trendMap = new Map()
    
    trends.forEach(disease => {
      const date = disease.detection.processedAt?.toISOString().split('T')[0]
      if (!date) return
      
      if (!trendMap.has(date)) {
        trendMap.set(date, {})
      }
      
      const dayData = trendMap.get(date)
      if (!dayData[disease.diseaseName]) {
        dayData[disease.diseaseName] = 0
      }
      dayData[disease.diseaseName]++
    })

    // Convert to array format
    const trendData = Array.from(trendMap.entries()).map(([date, diseases]) => ({
      date,
      diseases
    }))

    return {
      period: `${days} days`,
      data: trendData
    }
  }
}

export const diseaseService = new DiseaseService()