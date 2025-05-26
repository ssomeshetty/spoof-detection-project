import os
import io
import base64
import numpy as np
import cv2
from PIL import Image
import tensorflow as tf
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import logging

logger = logging.getLogger(__name__)

class SpoofDetector:
    def __init__(self):
        self.model = None
        self.load_model()
    
    def load_model(self):
        try:
            model_path = os.path.join(settings.BASE_DIR, 'detector_api', 'ml_models', 'model.keras')
            self.model = tf.keras.models.load_model(model_path)
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self.model = None
    
    def preprocess_image(self, image_data):
        """
        Preprocess the image for model prediction
        Adjust this based on your model's input requirements
        """
        try:
            # Decode base64 image
            image_data = image_data.split(',')[1]  # Remove data:image/jpeg;base64, part
            image_bytes = base64.b64decode(image_data)
            
            # Convert to PIL Image
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            image_array = np.array(image)
            
            # Resize to model input size (adjust based on your model)
            # Common sizes are 224x224, 256x256, etc.
            target_size = (224, 224)  # Adjust based on your model
            image_resized = cv2.resize(image_array, target_size)
            
            # Normalize pixel values (adjust based on your model's training)
            image_normalized = image_resized.astype(np.float32) / 255.0
            
            # Add batch dimension
            image_batch = np.expand_dims(image_normalized, axis=0)
            
            return image_batch
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            return None
    
    def predict(self, image_data):
        if self.model is None:
            return {"error": "Model not loaded"}

        try:
            preprocessed_image = self.preprocess_image(image_data)
            if preprocessed_image is None:
                return {"error": "Image preprocessing failed"}

            prediction = self.model.predict(preprocessed_image)
            print("Raw prediction output:", prediction)  # Debug log

            # Ensure correct extraction
            if isinstance(prediction, (list, np.ndarray)) and len(prediction) > 0:
                confidence = float(prediction[0][0])  # Works for [[0.9987]]
                threshold = 0.5
                is_real = confidence < threshold

                return {
                    "is_real": is_real,
                    "confidence": confidence,
                    "status": "real" if is_real else "fake/spoof"
                    
                }
            else:
                return {"error": "Invalid prediction output format"}

        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            return {"error": f"Prediction failed: {str(e)}"}


# Initialize detector
detector = SpoofDetector()

@csrf_exempt
@require_http_methods(["POST"])
def detect_spoof(request):
    """
    API endpoint to detect if a person is real or fake/spoof
    """
    try:
        data = json.loads(request.body)
        image_data = data.get('image')
        
        if not image_data:
            return JsonResponse({'error': 'No image data provided'}, status=400)
        
        # Make prediction
        result = detector.predict(image_data)
        print("✅ Received frame from Chrome extension")
        result = detector.predict(image_data)
        print("🔍 API Response:", result)
        
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        logger.error(f"API error: {str(e)}")
        return JsonResponse({'error': 'Internal server error'}, status=500)

@require_http_methods(["GET"])
def health_check(request):
    """
    Health check endpoint
    """
    model_loaded = detector.model is not None
    return JsonResponse({
        'status': 'healthy' if model_loaded else 'unhealthy',
        'model_loaded': model_loaded
    })