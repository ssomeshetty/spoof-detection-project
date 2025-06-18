from django.contrib import admin
from .models import DetectionResult

@admin.register(DetectionResult)
class DetectionResultAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'confidence', 'is_real', 'status', 'timestamp')
    list_filter = ('is_real', 'status', 'timestamp')
    search_fields = ('user_id', 'status')
    ordering = ('-timestamp',)
