// TypeScript interfaces for the application

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface Disease {
  id: string;
  detectionId: string;
  diseaseName: string;
  confidence: number;
  affectedRegions?: BoundingBox[];
  treatmentRecommendations: string[];
}

export interface DetectionResult {
  id: string;
  userId: string;
  imageUrl: string;
  originalFilename?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  confidenceScore?: number;
  locationLat?: number;
  locationLng?: number;
  createdAt: Date;
  processedAt?: Date;
  diseases: Disease[];
  location?: GeoLocation;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface CreateDetectionInput {
  userId: string;
  imageUrl: string;
  originalFilename?: string;
  locationLat?: number;
  locationLng?: number;
}

export interface CreateDiseaseInput {
  detectionId: string;
  diseaseName: string;
  confidence: number;
  affectedRegions?: BoundingBox[];
  treatmentRecommendations: string[];
}

export class DatabaseError extends Error {
  code?: string;
  constraint?: string;
  
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}