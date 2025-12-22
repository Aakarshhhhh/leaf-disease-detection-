#!/usr/bin/env python3

import traceback
import sys

print("Python path:", sys.path)
print("Current working directory:", sys.path[0])

try:
    print("Importing services module...")
    import services
    print("Services module imported successfully")
    print("Services module contents:", dir(services))
except Exception as e:
    print("Error importing services module:")
    traceback.print_exc()

try:
    print("Importing detection_service module...")
    import services.detection_service
    print("Detection service module imported successfully")
    print("Detection service module contents:", dir(services.detection_service))
except Exception as e:
    print("Error importing detection_service module:")
    traceback.print_exc()

try:
    print("Importing DiseaseDetectionService class...")
    from services.detection_service import DiseaseDetectionService
    print("DiseaseDetectionService imported successfully")
except Exception as e:
    print("Error importing DiseaseDetectionService class:")
    traceback.print_exc()

try:
    print("Importing DetectionResult class...")
    from services.detection_service import DetectionResult
    print("DetectionResult imported successfully")
except Exception as e:
    print("Error importing DetectionResult class:")
    traceback.print_exc()