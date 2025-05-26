let detectionInterval;
let isDetectionActive = false;
let backendUrl = 'http://127.0.0.1:8000/api';

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
    document.querySelectorAll('.spoof-detection-indicator, .spoof-result-indicator')
        .forEach(el => el.remove());
}

function captureAndAnalyze() {
    if (!isDetectionActive) return;

    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            captureVideoFrame(video, index);
        }
    });
}

function captureVideoFrame(video, videoIndex) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        analyzeFrame(imageData, videoIndex);
    } catch (error) {
        console.error('Error capturing video frame:', error);
    }
}

async function analyzeFrame(imageData, videoIndex) {
    try {
        const response = await fetch(`${backendUrl}/detect/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        const result = await response.json();

        // Check if runtime and sendMessage are valid
        if (chrome?.runtime?.id) {
            chrome.runtime.sendMessage({
                action: 'detectionResult',
                result: result,
                videoIndex: videoIndex
            }, function(response) {
                // Optionally handle response or just ignore
            });
        }

        showResultIndicator(result, videoIndex);

    } catch (error) {
        console.error('Error analyzing frame:', error);
        try {
            if (chrome?.runtime?.id) {
                chrome.runtime.sendMessage({
                    action: 'detectionResult',
                    result: { error: 'Connection failed' }
                });
            }
        } catch (err) {
            console.warn('Extension context invalidated while sending error.');
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

// 🚨 Cleanup on tab unload (prevents interval leaks)
window.addEventListener('beforeunload', stopDetection);
