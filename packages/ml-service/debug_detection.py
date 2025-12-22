#!/usr/bin/env python3

import traceback

print("Starting debug...")

try:
    print("Importing numpy...")
    import numpy as np
    print("Numpy imported successfully")
except Exception as e:
    print("Error importing numpy:")
    traceback.print_exc()

try:
    print("Importing typing...")
    from typing import List, Dict, Any, Tuple, Union
    print("Typing imported successfully")
except Exception as e:
    print("Error importing typing:")
    traceback.print_exc()

try:
    print("Importing logging...")
    import logging
    print("Logging imported successfully")
except Exception as e:
    print("Error importing logging:")
    traceback.print_exc()

try:
    print("Importing datetime...")
    from datetime import datetime
    print("Datetime imported successfully")
except Exception as e:
    print("Error importing datetime:")
    traceback.print_exc()

try:
    print("Importing asyncio...")
    import asyncio
    print("Asyncio imported successfully")
except Exception as e:
    print("Error importing asyncio:")
    traceback.print_exc()

try:
    print("Importing ThreadPoolExecutor...")
    from concurrent.futures import ThreadPoolExecutor
    print("ThreadPoolExecutor imported successfully")
except Exception as e:
    print("Error importing ThreadPoolExecutor:")
    traceback.print_exc()

try:
    print("Importing uuid...")
    import uuid
    print("UUID imported successfully")
except Exception as e:
    print("Error importing uuid:")
    traceback.print_exc()

try:
    print("Importing UNetModel...")
    from models.unet import UNetModel
    print("UNetModel imported successfully")
except Exception as e:
    print("Error importing UNetModel:")
    traceback.print_exc()

try:
    print("Importing ImageProcessor...")
    from preprocessing.image_processor import ImageProcessor
    print("ImageProcessor imported successfully")
except Exception as e:
    print("Error importing ImageProcessor:")
    traceback.print_exc()

print("Setting up logger...")
logger = logging.getLogger(__name__)

print("Defining DetectionResult class...")

class DetectionResult:
    """Represents a disease detection result"""
    
    def __init__(self, 
                 detection_id: str,
                 diseases: List[Dict[str, Any]],
                 confidence: float,
                 segmentation_mask: np.ndarray = None,
                 processing_time: float = 0.0,
                 metadata: Dict[str, Any] = None):
        self.detection_id = detection_id
        self.diseases = diseases
        self.confidence = confidence
        self.segmentation_mask = segmentation_mask
        self.processing_time = processing_time
        self.metadata = metadata or {}
        self.timestamp = datetime.now().isoformat()

print("DetectionResult class defined successfully")

print("Defining DiseaseDetectionService class...")

class DiseaseDetectionService:
    """Main service for disease detection operations"""
    
    def __init__(self, model_weights_path: str = None):
        """
        Initialize detection service
        
        Args:
            model_weights_path: Path to pre-trained model weights
        """
        print("Initializing DiseaseDetectionService...")
        self.model = UNetModel()
        self.image_processor = ImageProcessor()
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        # Load model weights if provided
        if model_weights_path:
            try:
                self.model.load_weights(model_weights_path)
            except Exception as e:
                logger.warning(f"Could not load model weights: {e}")
        
        # Disease confidence threshold
        self.confidence_threshold = 0.7
        self.low_confidence_threshold = 0.7  # Flag results below this threshold
        
        logger.info("Disease detection service initialized")

print("DiseaseDetectionService class defined successfully")

print("Testing class instantiation...")
try:
    service = DiseaseDetectionService()
    print("DiseaseDetectionService instantiated successfully")
except Exception as e:
    print("Error instantiating DiseaseDetectionService:")
    traceback.print_exc()

print("Debug complete!")