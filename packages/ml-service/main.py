from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
from dotenv import load_dotenv
import logging
import asyncio

from services.detection_service import DiseaseDetectionService, DetectionResult

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Leaf Disease Detection ML Service",
    description="Machine Learning service for leaf disease detection using U-Net",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detection service
detection_service = DiseaseDetectionService()

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str

class DetectionResponse(BaseModel):
    detection_id: str
    diseases: List[dict]
    confidence: float
    processing_time: float
    timestamp: str
    metadata: dict
    has_segmentation: bool

class BatchDetectionResponse(BaseModel):
    results: List[DetectionResponse]
    total_images: int
    successful_detections: int

@app.get("/health", response_model=HealthResponse)
async def health_check():
    from datetime import datetime
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat(),
        service="leaf-disease-detection-ml"
    )

@app.get("/")
async def root():
    return {"message": "Leaf Disease Detection ML Service"}

@app.post("/detect", response_model=DetectionResponse)
async def detect_disease(file: UploadFile = File(...)):
    """
    Detect disease in uploaded leaf image
    
    Args:
        file: Uploaded image file
        
    Returns:
        Detection result with disease information
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read file content
        image_data = await file.read()
        
        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        # Perform detection
        result = await detection_service.detect_disease(image_data)
        
        # Check for errors in result
        if "error" in result.metadata:
            raise HTTPException(status_code=422, detail=result.metadata["error"])
        
        return DetectionResponse(**result.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in detect endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/detect/batch", response_model=BatchDetectionResponse)
async def detect_diseases_batch(files: List[UploadFile] = File(...)):
    """
    Detect diseases in batch of uploaded leaf images
    
    Args:
        files: List of uploaded image files
        
    Returns:
        Batch detection results
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")
        
        if len(files) > 10:  # Limit batch size
            raise HTTPException(status_code=400, detail="Maximum 10 files allowed per batch")
        
        # Read all file contents
        image_data_list = []
        for file in files:
            if not file.content_type or not file.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"File {file.filename} must be an image")
            
            image_data = await file.read()
            if len(image_data) == 0:
                raise HTTPException(status_code=400, detail=f"File {file.filename} is empty")
            
            image_data_list.append(image_data)
        
        # Perform batch detection
        results = await detection_service.detect_diseases_batch(image_data_list)
        
        # Convert results to response format
        detection_responses = []
        successful_count = 0
        
        for result in results:
            detection_response = DetectionResponse(**result.to_dict())
            detection_responses.append(detection_response)
            
            if "error" not in result.metadata:
                successful_count += 1
        
        return BatchDetectionResponse(
            results=detection_responses,
            total_images=len(files),
            successful_detections=successful_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch detect endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/stats")
async def get_service_stats():
    """Get service statistics and configuration"""
    try:
        stats = detection_service.get_service_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting service stats: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/classes")
async def get_disease_classes():
    """Get list of supported disease classes"""
    try:
        classes = detection_service.model.get_disease_classes()
        return {"classes": classes}
    except Exception as e:
        logger.error(f"Error getting disease classes: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host=host, port=port)