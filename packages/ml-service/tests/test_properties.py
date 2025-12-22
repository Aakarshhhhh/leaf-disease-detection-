import pytest
from hypothesis import given, strategies as st, assume
import numpy as np
from PIL import Image
import io
import asyncio
from unittest.mock import patch, MagicMock

from services.detection_service import DiseaseDetectionService, DetectionResult
from models.unet import UNetModel
from preprocessing.image_processor import ImageProcessor

# Test data generators
@st.composite
def valid_image_data(draw):
    """Generate valid image data as bytes"""
    # Create a simple RGB image
    width = draw(st.integers(min_value=64, max_value=512))
    height = draw(st.integers(min_value=64, max_value=512))
    
    # Generate random RGB values
    image_array = draw(st.lists(
        st.integers(min_value=0, max_value=255),
        min_size=width * height * 3,
        max_size=width * height * 3
    ))
    
    # Convert to PIL Image and then to bytes
    image_array = np.array(image_array, dtype=np.uint8).reshape((height, width, 3))
    image = Image.fromarray(image_array, 'RGB')
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

@st.composite
def batch_image_data(draw):
    """Generate batch of valid image data"""
    batch_size = draw(st.integers(min_value=1, max_value=5))
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
        # Create detection service
        service = DiseaseDetectionService()
        
        # Run detection synchronously for testing
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
        assume(len(image_list) >= 2)  # Need at least 2 images for meaningful test
        
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
            
            # Compare results (allowing for small numerical differences due to batch processing)
            for individual, batch in zip(individual_results, batch_results):
                # Both should have same disease structure
                assert len(individual.diseases) == len(batch.diseases)
                
                # Compare disease names and relative confidences
                if individual.diseases and batch.diseases:
                    # Top disease should be the same
                    individual_top = max(individual.diseases, key=lambda d: d['confidence'])
                    batch_top = max(batch.diseases, key=lambda d: d['confidence'])
                    
                    assert individual_top['name'] == batch_top['name']
                    
                    # Confidence should be similar (within 10% tolerance for batch processing differences)
                    confidence_diff = abs(individual_top['confidence'] - batch_top['confidence'])
                    assert confidence_diff <= 0.1
                
                # Both should have valid structure
                assert isinstance(individual.detection_id, str)
                assert isinstance(batch.detection_id, str)
                assert individual.detection_id != batch.detection_id  # Should have different IDs
                
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
        with patch.object(service.model, 'predict') as mock_predict:
            # Create low confidence classification (all diseases below threshold)
            low_confidence_classification = np.array([0.6, 0.2, 0.1, 0.05, 0.05])  # healthy=0.6, others low
            mock_segmentation = np.zeros((256, 256, 1))
            mock_confidence = 0.6  # Below 0.7 threshold
            
            mock_predict.return_value = (mock_segmentation, low_confidence_classification, mock_confidence)
            
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
                assert healthy_disease['rank'] <= 2  # Should be top 2
                
                # Overall confidence should reflect the low confidence
                assert result.confidence <= service.confidence_threshold
                
            finally:
                loop.close()

class TestTreatmentRecommendations:
    """
    **Feature: leaf-disease-detection, Property 4: Treatment recommendations accompany disease detection**
    **Validates: Requirements 2.3**
    """
    
    @given(valid_image_data())
    def test_treatment_recommendations_accompany_disease_detection(self, image_data):
        """
        Property: For any disease identification result, the system should provide 
        corresponding treatment recommendations
        """
        service = DiseaseDetectionService()
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(service.detect_disease(image_data))
            
            # Verify result has diseases
            assert isinstance(result.diseases, list)
            assert len(result.diseases) > 0
            
            # Every disease should have treatment recommendations
            for disease in result.diseases:
                assert 'treatment_recommendations' in disease
                assert isinstance(disease['treatment_recommendations'], list)
                assert len(disease['treatment_recommendations']) > 0
                
                # Each treatment recommendation should be a non-empty string
                for treatment in disease['treatment_recommendations']:
                    assert isinstance(treatment, str)
                    assert len(treatment.strip()) > 0
                
                # Verify disease has required fields for treatment context
                assert 'name' in disease
                assert 'confidence' in disease
                assert isinstance(disease['name'], str)
                assert len(disease['name']) > 0
            
            # Test specific disease scenarios with mocked results
            
        finally:
            loop.close()
    
    @given(st.sampled_from(['healthy', 'bacterial_blight', 'leaf_spot', 'rust', 'powdery_mildew', 'unknown_disease']))
    def test_treatment_recommendations_for_specific_diseases(self, disease_name):
        """
        Property: For any identified disease type, appropriate treatment recommendations 
        should be provided based on the disease characteristics
        """
        service = DiseaseDetectionService()
        
        # Get treatment recommendations directly
        treatments = service._get_treatment_recommendations(disease_name)
        
        # Verify treatments structure
        assert isinstance(treatments, list)
        assert len(treatments) > 0
        
        # Each treatment should be a meaningful string
        for treatment in treatments:
            assert isinstance(treatment, str)
            assert len(treatment.strip()) > 0
            assert len(treatment) > 10  # Should be descriptive, not just single words
        
        # Verify disease-specific treatment logic
        if disease_name == 'healthy':
            # Healthy plants should have maintenance recommendations
            assert any('no treatment' in t.lower() or 'regular care' in t.lower() for t in treatments)
        elif disease_name in ['bacterial_blight', 'leaf_spot', 'rust', 'powdery_mildew']:
            # Known diseases should have specific treatments
            assert len(treatments) >= 3  # Should have multiple treatment steps
            # Should contain actionable advice
            treatment_text = ' '.join(treatments).lower()
            assert any(keyword in treatment_text for keyword in ['remove', 'apply', 'spray', 'improve', 'avoid'])
        else:
            # Unknown diseases should have consultation recommendations
            assert any('consult' in t.lower() or 'professional' in t.lower() for t in treatments)

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
        with patch.object(service.model, 'predict') as mock_predict:
            # Create classification with low confidence
            low_confidence_classification = np.array([0.1, 0.5, 0.2, 0.1, 0.1])  # bacterial_blight=0.5 (below 0.7)
            mock_segmentation = np.zeros((256, 256, 1))
            mock_confidence = 0.5  # Below 0.7 threshold
            
            mock_predict.return_value = (mock_segmentation, low_confidence_classification, mock_confidence)
            
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
                loop.close()
        
        # Test with high confidence scenario
        with patch.object(service.model, 'predict') as mock_predict:
            # Create classification with high confidence
            high_confidence_classification = np.array([0.05, 0.85, 0.05, 0.025, 0.025])  # bacterial_blight=0.85
            mock_segmentation = np.zeros((256, 256, 1))
            mock_confidence = 0.85  # Above 0.7 threshold
            
            mock_predict.return_value = (mock_segmentation, high_confidence_classification, mock_confidence)
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                result = loop.run_until_complete(service.detect_disease(image_data))
                
                # Should have diseases
                assert len(result.diseases) > 0
                
                # High confidence diseases should not be flagged
                top_disease = max(result.diseases, key=lambda d: d['confidence'])
                if top_disease['confidence'] >= service.low_confidence_threshold:
                    assert top_disease['requires_expert_verification'] is False
                
            finally:
                loop.close()

# Example property-based test setup for ML service
class TestPropertyExamples:
    
    @given(st.text())
    def test_string_length_property(self, text):
        """Property: string length is always non-negative"""
        assert len(text) >= 0
    
    @given(st.lists(st.integers()))
    def test_list_reverse_property(self, lst):
        """Property: reversing a list twice gives the original list"""
        reversed_once = list(reversed(lst))
        reversed_twice = list(reversed(reversed_once))
        assert reversed_twice == lst
    
    @given(st.integers(min_value=0, max_value=100))
    def test_percentage_bounds(self, percentage):
        """Property: percentage values should be within valid bounds"""
        assert 0 <= percentage <= 100