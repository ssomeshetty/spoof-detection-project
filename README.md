# Spoof Detection Project — Chrome Extension Development

This repository contains the **Chrome extension** and Django backend server for real-time face presentation attack detection (PAD) during virtual meetings. The system captures video frames from browser-based video conferencing apps (like Google Meet, Zoom Web) and performs live spoof detection using a TensorFlow.js model served by the Django backend.

> **Note:** This repo contains only the Chrome extension and backend inference pipeline, **not the ML model training**.

---

## Project Overview

- **Chrome Extension** captures webcam video frames (1 FPS) from video elements.
- Frames are sent to a Django REST API backend for inference.
- The backend returns liveness verdicts (`Real` or `Spoof`) which are displayed live in the browser UI overlay.
- The solution provides real-time, low-latency spoof detection directly in the browser with no extra hardware.

---
