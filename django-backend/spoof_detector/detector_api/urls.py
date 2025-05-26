from django.urls import path
from . import views

urlpatterns = [
    path('detect/', views.detect_spoof, name='detect_spoof'),
    path('health/', views.health_check, name='health_check'),
]