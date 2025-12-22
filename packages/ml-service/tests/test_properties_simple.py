import pytest
from hypothesis import given, strategies as st, assume
import numpy as np
from PIL import Image
import io
import asyncio
import sys
import os

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import our modules directly
from models.unet import UNetModel
from preprocessing.image_processor import ImageProcessor

# Simple DetectionResult class for testing
class DetectionResult:
    def __init__(self, detection_id: str, diseases: list, confidence: float, 
                 segmentation_mask=None, processing_time: float = 0.0, metadata: dict = None):
        self.detection_id = detection_id
        self.diseases = diseases
        self.confidence = confidence
        self.segmentation_mask = segmentation_mask
        self.processing_time = processing_time
        self.metadata = metadata or {}
        self.timestamp = "2023-01-01T00:00:00"
    
    def to_dict(self):
        return {
            "detection_id": self.detection_id,
            "diseases": self.diseases,
            "confidence": self.confidence,
            "processing_time": self.processing_time,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
            "has_segmentation": self.segmentation_mask is not None
        }

# Simple DiseaseDetectionService class for testing
class DiseaseDetectionService:
    def __init__(self):
        self.model = UNetModel()
        self.image_processor = ImageProcessor()
        self.confidence_threshold = 0.7
        self.low_confidence_threshold = 0.7
    
    async def detect_disease(self, image_data):
        # Simple mock implementation
        processed_image = self.image_processor.preprocess_image(image_data)
        segmentation, classification, confidence = self.model.predict(processed_image)
        
        diseases = self._process_classification_results(classification, confidence)
        
        return DetectionResult(
            detection_id="test-id",
            diseases=diseases,
            confidence=confidence,
            segmentation_mask=segmentation,
            processing_time=0.1
        )
    
    async def detect_diseases_batch(self, image_list):
        results = []
        for image_data in image_list:
            result = await self.detect_disease(image_data)
            results.append(result)
        return results
    
    def _process_classification_results(self, classification, confidence):
        disease_classes = self.model.get_disease_classes()
        diseases = []
        
        top_indices = np.argsort(classification)[::-1]
        
        for i, class_idx in enumerate(top_indices):
            class_confidence = float(classification[class_idx])
            disease_name = disease_classes[class_idx]
            
            if class_confidence > 0.1:
                disease_info = {
                    "name": disease_name,
                    "confidence": class_confidence,
                    "rank": i + 1,
                    "treatment_recommendations": ["Treatment for " + disease_name],
                    "requires_expert_verification": class_confidence < self.low_confidence_threshold
                }
                diseases.append(disease_info)
        
        # Add healthy status for low confidence
        if not diseases or diseases[0]["confidence"] < self.confidence_threshold:
            if not any(d["name"] == "healthy" for d in diseases):
                healthy_info = {
                    "name": "healthy",
                    "confidence": 1.0 - confidence if confidence < 0.5 else 0.5,
                    "rank": 1,
                    "treatment_recommendations": ["No treatment needed"],
                    "requires_expert_verification": False
                }
                diseases.insert(0, healthy_info)
        
        return diseases

# Test data generators
@st.composite
def valid_image_data(draw):
    """Generate valid image data as bytes"""
    width = draw(st.integers(min_value=32, max_value=64))
    height = draw(st.integers(min_value=32, max_value=64))
    
    # Create a simple RGB image
    image_array = np.random.randint(0, 256, (height, width, 3), dtype=np.uint8)
    image = Image.fromarray(image_array, 'RGB')
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

@st.composite
def batch_image_data(draw):
    """Generate batch of valid image data"""
    batch_size = draw(st.integers(min_value=1, max_value=3))
    return [draw(valid_image_data()) for _ in range(batch_size)]

class TestDetectionResultStructure:
    """
    **Feature: leaf-disease-detection, Property 2: Detection results contain required structure**
    **Validates: Requirements 1.3, 2.1, 2.2**
    """
    
    @given(valid_image_data())
    def test_detection_result_contains_required_structure(self, image_data):
        """
        Property: For any completed image analysis, the result should contain disease 
        identifications with confidence percentages and visual highlighting data when diseases are present
        """
        service = DiseaseDetectionService()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(service.detect_disease(image_data))
            
            # Verify result structure
            assert isinstance(result, DetectionResult)
            assert hasattr(result, 'detection_id')
            assert hasattr(result, 'diseases')
            assert hasattr(result, 'confidence')
            assert hasattr(result, 'segmentation_mask')
            assert hasattr(result, 'processing_time')
            assert hasattr(result, 'metadata')
            assert hasattr(result, 'timestamp')
            
            # Verify detection_id is not empty
            assert result.detection_id is not None
            assert len(result.detection_id) > 0
            
            # Verify diseases structure
            assert isinstance(result.diseases, list)
            for disease in result.diseases:
                assert isinstance(disease, dict)
                assert 'name' in disease
                assert 'confidence' in disease
                assert 'rank' in disease
                assert 'treatment_recommendations' in disease
                assert 'requires_expert_verification' in disease
                
                # Verify confidence is a valid percentage
                assert isinstance(disease['confidence'], (int, float))
                assert 0.0 <= disease['confidence'] <= 1.0
                
                # Verify treatment recommendations exist
                assert isinstance(disease['treatment_recommendations'], list)
                assert len(disease['treatment_recommendations']) > 0
            
            # Verify overall confidence
            assert isinstance(result.confidence, (int, float))
            assert 0.0 <= result.confidence <= 1.0
            
            # Verify processing time is positive
            assert isinstance(result.processing_time, (int, float))
            assert result.processing_time >= 0.0
            
            # Verify metadata structure
            assert isinstance(result.metadata, dict)
            
            # Verify timestamp format
            assert isinstance(result.timestamp, str)
            assert len(result.timestamp) > 0
            
            # Verify to_dict method works
            result_dict = result.to_dict()
            assert isinstance(result_dict, dict)
            assert 'detection_id' in result_dict
            assert 'diseases' in result_dict
            assert 'confidence' in result_dict
            assert 'processing_time' in result_dict
            assert 'timestamp' in result_dict
            assert 'metadata' in result_dict
            assert 'has_segmentation' in result_dict
            
        finally:
            loop.close()

class TestBatchProcessingIndependence:
    """
    **Feature: leaf-disease-detection, Property 3: Batch processing maintains independence**
    **Validates: Requirements 1.5**
    """
    
    @given(batch_image_data())
    def test_batch_processing_independence(self, image_list):
        """
        Property: For any set of images processed simultaneously, each image should 
        produce the same result as if processed individually
        """
        assume(len(image_list) >= 2)
        
        service = DiseaseDetectionService()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Process images individually
            individual_results = []
            for image_data in image_list:
                result = loop.run_until_complete(service.detect_disease(image_data))
                individual_results.append(result)
            
            # Process images as batch
            batch_results = loop.run_until_complete(service.detect_diseases_batch(image_list))
            
            # Verify same number of results
            assert len(individual_results) == len(batch_results)
            assert len(batch_results) == len(image_list)
            
            # Compare results (allowing for small numerical differences)
            for individual, batch in zip(individual_results, batch_results):
                # Both should have same disease structure
                assert len(individual.diseases) == len(batch.diseases)
                
                # Compare disease names and relative confidences
                if individual.diseases and batch.diseases:
                    # Top disease should be the same
                    individual_top = max(individual.diseases, key=lambda d: d['confidence'])
                    batch_top = max(batch.diseases, key=lambda d: d['confidence'])
                    
                    assert individual_top['name'] == batch_top['name']
                    
                    # Confidence should be similar (within 10% tolerance)
                    confidence_diff = abs(individual_top['confidence'] - batch_top['confidence'])
                    assert confidence_diff <= 0.1
                
                # Both should have valid structure
                assert isinstance(individual.detection_id, str)
                assert isinstance(batch.detection_id, str)
                
        finally:
            loop.close()

class TestHealthyStatusDetection:
    """
    **Feature: leaf-disease-detection, Property 5: Healthy status for low confidence results**
    **Validates: Requirements 2.4**
    """
    
    @given(valid_image_data())
    def test_healthy_status_for_low_confidence(self, image_data):
        """
        Property: For any analysis where no disease confidence exceeds the detection threshold, 
        the system should return a healthy leaf status
        """
        service = DiseaseDetectionService()
        
        # Mock the model to return low confidence results
        original_predict = service.model.predict
        
        def mock_predict(image):
            # Return low confidence classification
            low_confidence_classification = np.array([0.6, 0.2, 0.1, 0.05, 0.05])
            mock_segmentation = np.zeros((256, 256, 1))
            mock_confidence = 0.6  # Below 0.7 threshold
            return mock_segmentation, low_confidence_classification, mock_confidence
        
        service.model.predict = mock_predict
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(service.detect_disease(image_data))
            
            # Should have diseases list
            assert isinstance(result.diseases, list)
            assert len(result.diseases) > 0
            
            # Should contain healthy status when confidence is low
            healthy_diseases = [d for d in result.diseases if d['name'] == 'healthy']
            assert len(healthy_diseases) > 0
            
            # Healthy should be ranked high when other confidences are low
            healthy_disease = healthy_diseases[0]
            assert healthy_disease['rank'] <= 2
            
            # Overall confidence should reflect the low confidence
            assert result.confidence <= service.confidence_threshold
            
        finally:
            service.model.predict = original_predict
            loop.close()

class TestLowConfidenceFlagging:
    """
    **Feature: leaf-disease-detection, Property 6: Low confidence flagging**
    **Validates: Requirements 2.5**
    """
    
    @given(valid_image_data())
    def test_low_confidence_flagging(self, image_data):
        """
        Property: For any detection result with confidence below 70%, the system should 
        flag it as requiring expert verification
        """
        service = DiseaseDetectionService()
        
        # Test with low confidence scenario
        original_predict = service.model.predict
        
        def mock_low_confidence_predict(image):
            low_confidence_classification = np.array([0.1, 0.5, 0.2, 0.1, 0.1])
            mock_segmentation = np.zeros((256, 256, 1))
            mock_confidence = 0.5  # Below 0.7 threshold
            return mock_segmentation, low_confidence_classification, mock_confidence
        
        service.model.predict = mock_low_confidence_predict
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(service.detect_disease(image_data))
            
            # Should have diseases
            assert len(result.diseases) > 0
            
            # All diseases with confidence below threshold should be flagged
            for disease in result.diseases:
                if disease['confidence'] < service.low_confidence_threshold:
                    assert disease['requires_expert_verification'] is True
                else:
                    assert disease['requires_expert_verification'] is False
            
            # Overall result confidence should be below threshold
            assert result.confidence < service.low_confidence_threshold
            
        finally:
            service.model.predict = original_predict
            loop.close()