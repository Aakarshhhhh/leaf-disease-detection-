"""
Image preprocessing pipeline for leaf disease detection
"""
import numpy as np
from PIL import Image, ImageEnhance
import io
from typing import Tuple, Union, Optional
import logging

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Image preprocessing pipeline for leaf images"""
    
    def __init__(self, target_size: Tuple[int, int] = (256, 256)):
        """
        Initialize image processor
        
        Args:
            target_size: Target image size (height, width)
        """
        self.target_size = target_size
    
    def preprocess_image(self, image_data: Union[bytes, np.ndarray, str]) -> np.ndarray:
        """
        Preprocess image for model input
        
        Args:
            image_data: Image data (bytes, numpy array, or file path)
            
        Returns:
            Preprocessed image array normalized to [0, 1]
        """
        try:
            # Load image based on input type
            if isinstance(image_data, bytes):
                image = self._load_from_bytes(image_data)
            elif isinstance(image_data, str):
                image = self._load_from_path(image_data)
            elif isinstance(image_data, np.ndarray):
                image = image_data.copy()
            else:
                raise ValueError(f"Unsupported image data type: {type(image_data)}")
            
            # Convert to PIL Image for processing
            if isinstance(image, np.ndarray):
                if image.dtype != np.uint8:
                    image = (image * 255).astype(np.uint8)
                pil_image = Image.fromarray(image)
            else:
                pil_image = image
            
            # Convert to RGB if needed
            if pil_image.mode == 'RGBA':
                pil_image = pil_image.convert('RGB')
            elif pil_image.mode == 'L':  # Grayscale
                pil_image = pil_image.convert('RGB')
            elif pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Resize image
            pil_image = pil_image.resize(self.target_size, Image.Resampling.LANCZOS)
            
            # Convert back to numpy array
            image = np.array(pil_image)
            
            # Normalize to [0, 1]
            image = image.astype(np.float32) / 255.0
            
            # Apply preprocessing enhancements
            image = self._enhance_image(image)
            
            return image
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise ValueError(f"Failed to preprocess image: {e}")
    
    def preprocess_batch(self, image_list: list) -> np.ndarray:
        """
        Preprocess batch of images
        
        Args:
            image_list: List of image data
            
        Returns:
            Batch of preprocessed images
        """
        processed_images = []
        
        for image_data in image_list:
            try:
                processed_image = self.preprocess_image(image_data)
                processed_images.append(processed_image)
            except Exception as e:
                logger.warning(f"Failed to process image in batch: {e}")
                # Skip failed images or add placeholder
                continue
        
        if not processed_images:
            raise ValueError("No images could be processed in batch")
        
        return np.array(processed_images)
    
    def _load_from_bytes(self, image_bytes: bytes) -> Image.Image:
        """Load image from bytes"""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            return image
        except Exception as e:
            logger.error(f"Failed to load image from bytes: {e}")
            raise
    
    def _load_from_path(self, image_path: str) -> Image.Image:
        """Load image from file path"""
        try:
            image = Image.open(image_path)
            return image
        except Exception as e:
            logger.error(f"Failed to load image from path {image_path}: {e}")
            raise
    
    def _enhance_image(self, image: np.ndarray) -> np.ndarray:
        """
        Apply image enhancements for better disease detection
        
        Args:
            image: Normalized image array [0, 1]
            
        Returns:
            Enhanced image array
        """
        # Convert to PIL for enhancement
        image_uint8 = (image * 255).astype(np.uint8)
        pil_image = Image.fromarray(image_uint8)
        
        # Apply contrast enhancement
        enhancer = ImageEnhance.Contrast(pil_image)
        pil_image = enhancer.enhance(1.2)  # Increase contrast by 20%
        
        # Apply sharpness enhancement
        enhancer = ImageEnhance.Sharpness(pil_image)
        pil_image = enhancer.enhance(1.1)  # Increase sharpness by 10%
        
        # Convert back to numpy array and normalize
        enhanced = np.array(pil_image).astype(np.float32) / 255.0
        
        return enhanced
    
    def validate_image(self, image_data: Union[bytes, np.ndarray, str]) -> bool:
        """
        Validate if image data is suitable for processing
        
        Args:
            image_data: Image data to validate
            
        Returns:
            True if image is valid, False otherwise
        """
        try:
            if isinstance(image_data, bytes):
                if len(image_data) == 0:
                    return False
                # Try to load and check basic properties
                image = Image.open(io.BytesIO(image_data))
                width, height = image.size
                
            elif isinstance(image_data, str):
                import os
                if not os.path.exists(image_data):
                    return False
                image = Image.open(image_data)
                width, height = image.size
                
            elif isinstance(image_data, np.ndarray):
                if image_data.size == 0:
                    return False
                height, width = image_data.shape[:2]
                
            else:
                return False
            
            # Check minimum dimensions
            if width < 32 or height < 32:
                return False
            
            # Check maximum dimensions (prevent memory issues)
            if width > 4096 or height > 4096:
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Image validation failed: {e}")
            return False
    
    def extract_metadata(self, image_data: Union[bytes, str]) -> dict:
        """
        Extract metadata from image
        
        Args:
            image_data: Image bytes or file path
            
        Returns:
            Dictionary with image metadata
        """
        metadata = {
            "width": None,
            "height": None,
            "channels": None,
            "format": None,
            "size_bytes": None
        }
        
        try:
            if isinstance(image_data, bytes):
                metadata["size_bytes"] = len(image_data)
                image = Image.open(io.BytesIO(image_data))
                metadata["width"], metadata["height"] = image.size
                metadata["format"] = image.format
                metadata["channels"] = len(image.getbands())
                
            elif isinstance(image_data, str):
                import os
                metadata["size_bytes"] = os.path.getsize(image_data)
                image = Image.open(image_data)
                metadata["width"], metadata["height"] = image.size
                metadata["format"] = image.format
                metadata["channels"] = len(image.getbands())
            
        except Exception as e:
            logger.warning(f"Failed to extract metadata: {e}")
        
        return metadata