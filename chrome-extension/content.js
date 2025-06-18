let detectionInterval;
let isDetectionActive = false;
let backendUrl = 'http://127.0.0.1:8000/api';
let participantTracker = new Map(); // Track participants by video element

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.action) {
        case 'startDetection':
            startDetection(request.backendUrl);
            break;
        case 'stopDetection':
            stopDetection();
            break;
        case 'clearResults':
            clearResults();
            break;
        case 'getParticipants':
            sendResponse({participants: Array.from(participantTracker.values())});
            break;
    }
    return false;
});

function startDetection(url) {
    if (url) backendUrl = url;
    isDetectionActive = true;

    if (detectionInterval) clearInterval(detectionInterval);
    detectionInterval = setInterval(captureAndAnalyze, 3000);

    showDetectionIndicator();
}

function stopDetection() {
    isDetectionActive = false;
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    hideDetectionIndicator();
}

function clearResults() {
    document.querySelectorAll('.spoof-detection-indicator, .spoof-result-indicator, .participant-badge')
        .forEach(el => el.remove());
    participantTracker.clear();
}

function captureAndAnalyze() {
    if (!isDetectionActive) return;

    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            // Generate a unique identifier for this video element
            const videoId = generateVideoId(video, index);
            captureVideoFrame(video, index, videoId);
        }
    });
}

function generateVideoId(video, index) {
    // Try to find a unique identifier for the video
    const parentElement = video.closest('[data-participant-id]') || 
                         video.closest('[data-sender-id]') || 
                         video.closest('.participant-video') ||
                         video.parentElement;
    
    // Use various methods to identify the participant
    const participantId = parentElement?.getAttribute('data-participant-id') ||
                         parentElement?.getAttribute('data-sender-id') ||
                         parentElement?.getAttribute('aria-label') ||
                         `video-${index}`;
    
    return participantId;
}

function captureVideoFrame(video, videoIndex, videoId) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        analyzeFrame(imageData, videoIndex, videoId);
    } catch (error) {
        console.error('Error capturing video frame:', error);
    }
}

async function analyzeFrame(imageData, videoIndex, videoId) {
    try {
        chrome.storage.sync.get(['userId'], async (data) => {
            const userId = data.userId;
            const participantId = `${userId}-${videoId}`;

            const response = await fetch(`${backendUrl}/detect/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    image: imageData, 
                    user_id: participantId 
                })
            });

            const result = await response.json();
            result.videoId = videoId;
            result.participantId = participantId;

            // Update participant tracker
            participantTracker.set(videoId, {
                id: participantId,
                videoId: videoId,
                videoIndex: videoIndex,
                isReal: result.is_real,
                confidence: result.confidence,
                status: result.status,
                lastUpdate: new Date().toISOString()
            });

            if (chrome?.runtime?.id) {
                chrome.runtime.sendMessage({
                    action: 'detectionResult',
                    result: result,
                    videoIndex: videoIndex,
                    participantId: participantId
                });
            }

            showResultIndicator(result, videoIndex);
            showParticipantBadge(result, videoIndex);
        });
    } catch (error) {
        console.error('Error analyzing frame:', error);
        if (chrome?.runtime?.id) {
            chrome.runtime.sendMessage({
                action: 'detectionResult',
                result: { error: 'Connection failed' }
            });
        }
    }
}

function showDetectionIndicator() {
    const existing = document.getElementById('spoof-detection-active');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'spoof-detection-active';
    indicator.textContent = '🔍 Spoof Detection Active';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #007bff;
        color: white;
        padding: 8px 12px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(indicator);
}

function hideDetectionIndicator() {
    const indicator = document.getElementById('spoof-detection-active');
    if (indicator) indicator.remove();
}

function showResultIndicator(result, videoIndex) {
    const existing = document.querySelectorAll('.spoof-result-indicator');
    existing.forEach(el => el.remove());

    if (result.error) return;

    const indicator = document.createElement('div');
    indicator.className = 'spoof-result-indicator';
    indicator.textContent = result.is_real ? '✅ Real Person' : '❌ Fake/Spoof Detected';

    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${result.is_real ? '#28a745' : '#dc3545'};
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        animation: fadeInOut 3s ease-in-out;
    `;

    document.body.appendChild(indicator);

    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove();
        }
    }, 3000);
}

function showParticipantBadge(result, videoIndex) {
    if (result.error) return;

    const videos = document.querySelectorAll('video');
    const targetVideo = videos[videoIndex];
    
    if (!targetVideo) return;

    // Remove existing badge for this video
    const existingBadge = targetVideo.parentElement.querySelector('.participant-badge');
    if (existingBadge) existingBadge.remove();

    // Create new badge
    const badge = document.createElement('div');
    badge.className = 'participant-badge';
    badge.textContent = result.is_real ? '✅' : '❌';
    
    const confidence = (result.confidence * 100).toFixed(0);
    badge.title = `${result.is_real ? 'Real Person' : 'Fake/Spoof'} (${confidence}%)`;

    badge.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: ${result.is_real ? '#28a745' : '#dc3545'};
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
    `;

    // Make sure the parent container has relative positioning
    const parentContainer = targetVideo.parentElement;
    if (parentContainer) {
        const originalPosition = getComputedStyle(parentContainer).position;
        if (originalPosition === 'static') {
            parentContainer.style.position = 'relative';
        }
        parentContainer.appendChild(badge);
    }
}

// Periodically fetch all results to update the extension
setInterval(async () => {
    if (!isDetectionActive) return;
    
    try {
        const response = await fetch(`${backendUrl}/results/`);
        const results = await response.json();

        // Send results to background script for popup to access
        if (chrome?.runtime?.id) {
            chrome.runtime.sendMessage({
                action: 'allParticipants',
                participants: results
            });
        }

        // Update badges based on latest results
        const latestResults = {};
        results.forEach(result => {
            const key = result.user_id;
            if (!latestResults[key] || new Date(result.timestamp) > new Date(latestResults[key].timestamp)) {
                latestResults[key] = result;
            }
        });

        // Log for debugging
        Object.values(latestResults).forEach(result => {
            console.log(`[${result.user_id}] ➜ ${result.status} (${(result.confidence * 100).toFixed(1)}%)`);
        });

    } catch (error) {
        console.error('Error fetching results:', error);
    }
}, 5000);

// Add fade animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(20px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

// Enhanced cleanup on tab unload
window.addEventListener('beforeunload', () => {
    stopDetection();
    participantTracker.clear();
});

// Observe for new video elements being added (for dynamic content)
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
                videos.forEach((video, index) => {
                    if (isDetectionActive && video.videoWidth > 0 && video.videoHeight > 0) {
                        const videoId = generateVideoId(video, index);
                        console.log('New video detected:', videoId);
                        // Add a small delay to ensure video is fully loaded
                        setTimeout(() => {
                            captureVideoFrame(video, index, videoId);
                        }, 1000);
                    }
                });
                
                // Check if the node itself is a video
                if (node.tagName === 'VIDEO' && isDetectionActive) {
                    const video = node;
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                        const allVideos = document.querySelectorAll('video');
                        const videoIndex = Array.from(allVideos).indexOf(video);
                        const videoId = generateVideoId(video, videoIndex);
                        console.log('New video element detected:', videoId);
                        setTimeout(() => {
                            captureVideoFrame(video, videoIndex, videoId);
                        }, 1000);
                    }
                }
            }
        });
    });
});

// Start observing DOM changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Handle video load events for better detection
document.addEventListener('loadstart', (event) => {
    if (event.target.tagName === 'VIDEO' && isDetectionActive) {
        const video = event.target;
        video.addEventListener('loadedmetadata', () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                const allVideos = document.querySelectorAll('video');
                const videoIndex = Array.from(allVideos).indexOf(video);
                const videoId = generateVideoId(video, videoIndex);
                console.log('Video metadata loaded:', videoId);
                setTimeout(() => {
                    captureVideoFrame(video, videoIndex, videoId);
                }, 500);
            }
        });
    }
}, true);

// Handle tab visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Tab is hidden, pause detection to save resources
        if (isDetectionActive && detectionInterval) {
            clearInterval(detectionInterval);
            console.log('Detection paused - tab hidden');
        }
    } else {
        // Tab is visible, resume detection
        if (isDetectionActive && !detectionInterval) {
            detectionInterval = setInterval(captureAndAnalyze, 3000);
            console.log('Detection resumed - tab visible');
        }
    }
});

// Initialize detection state from storage
chrome.storage.sync.get(['detectionActive'], (data) => {
    if (data.detectionActive) {
        startDetection();
    }
});

// Utility function to check if video is actually playing
function isVideoPlaying(video) {
    return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}

// Enhanced capture function that only processes playing videos
function captureAndAnalyzeEnhanced() {
    if (!isDetectionActive) return;

    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
        if (video.videoWidth > 0 && video.videoHeight > 0 && isVideoPlaying(video)) {
            const videoId = generateVideoId(video, index);
            captureVideoFrame(video, index, videoId);
        }
    });
}

// Error handling for network issues
function handleNetworkError(error) {
    console.error('Network error:', error);
    
    // Show temporary error indicator
    const errorIndicator = document.createElement('div');
    errorIndicator.className = 'spoof-error-indicator';
    errorIndicator.textContent = '⚠️ Detection Error - Check Connection';
    errorIndicator.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        background: #ff6b35;
        color: white;
        padding: 8px 12px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(errorIndicator);
    
    setTimeout(() => {
        if (errorIndicator.parentNode) {
            errorIndicator.remove();
        }
    }, 5000);
}

// Debounce function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced version of capture function
const debouncedCapture = debounce(captureAndAnalyzeEnhanced, 1000);

// Performance monitoring
let performanceMetrics = {
    captureCount: 0,
    errorCount: 0,
    startTime: Date.now()
};

function logPerformanceMetrics() {
    const runtime = (Date.now() - performanceMetrics.startTime) / 1000;
    console.log(`Performance: ${performanceMetrics.captureCount} captures, ${performanceMetrics.errorCount} errors in ${runtime}s`);
}

// Log performance every 30 seconds
setInterval(logPerformanceMetrics, 30000);

console.log('Spoof Detection Content Script Loaded Successfully');