from django.db import models

# Create your models here.
from django.db import models

class DetectionResult(models.Model):
    user_id = models.CharField(max_length=100)  # Can be a UUID or Meet participant ID
    confidence = models.FloatField()
    is_real = models.BooleanField()
    status = models.CharField(max_length=20)
    timestamp = models.DateTimeField(auto_now_add=True)

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "confidence": self.confidence,
            "is_real": self.is_real,
            "status": self.status,
            "timestamp": self.timestamp.isoformat()
        }
