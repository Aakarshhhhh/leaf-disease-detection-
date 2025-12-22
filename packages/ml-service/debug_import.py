#!/usr/bin/env python3

try:
    print("Importing numpy...")
    import numpy as np
    print("✓ numpy imported")
    
    print("Importing typing...")
    from typing import List, Dict, Any, Tuple, Union
    print("✓ typing imported")
    
    print("Importing logging...")
    import logging
    print("✓ logging imported")
    
    print("Importing datetime...")
    from datetime import datetime
    print("✓ datetime imported")
    
    print("Importing asyncio...")
    import asyncio
    print("✓ asyncio imported")
    
    print("Importing ThreadPoolExecutor...")
    from concurrent.futures import ThreadPoolExecutor
    print("✓ ThreadPoolExecutor imported")
    
    print("Importing uuid...")
    import uuid
    print("✓ uuid imported")
    
    print("Importing UNetModel...")
    from models.unet import UNetModel
    print("✓ UNetModel imported")
    
    print("Importing ImageProcessor...")
    from preprocessing.image_processor import ImageProcessor
    print("✓ ImageProcessor imported")
    
    print("All imports successful, now trying to import detection service...")
    
    # Try to import the detection service
    import services.detection_service as ds
    print(f"Detection service module imported, contents: {dir(ds)}")
    
    # Try to access the classes
    if hasattr(ds, 'DetectionResult'):
        print("✓ DetectionResult found")
    else:
        print("✗ DetectionResult not found")
        
    if hasattr(ds, 'DiseaseDetectionService'):
        print("✓ DiseaseDetectionService found")
    else:
        print("✗ DiseaseDetectionService not found")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()