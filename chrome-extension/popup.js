let isDetecting = false;

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleDetection');
    const clearBtn = document.getElementById('clearResults');
    const saveBtn = document.getElementById('saveSettings');
    const statusDiv = document.getElementById('status');
    const backendUrlInput = document.getElementById('backendUrl');
    const lastResultDiv = document.getElementById('lastResult');
    
    // Load saved settings
    chrome.storage.sync.get(['backendUrl', 'isDetecting'], function(result) {
        if (result.backendUrl) {
            backendUrlInput.value = result.backendUrl;
        }
        if (result.isDetecting) {
            isDetecting = result.isDetecting;
            updateUI();
        }
    });
    
    // Check if current tab is a video call site
    function isVideoCallSite(url) {
        if (!url) return false;
        const videoCallDomains = [
            'meet.google.com',
            'zoom.us',
            'teams.microsoft.com',
            'webex.com',
            'gotomeeting.com'
        ];
        return videoCallDomains.some(domain => url.includes(domain));
    }
    
    // Send message to content script with error handling
    function sendMessageToContentScript(message, callback) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                if (!isVideoCallSite(tabs[0].url)) {
                    statusDiv.className = 'status fake';
                    statusDiv.textContent = 'Please open a video call site (Google Meet, Zoom, etc.)';
                    return;
                }
                
                chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                    if (chrome.runtime.lastError) {
                        console.log('Content script not ready:', chrome.runtime.lastError.message);
                        statusDiv.className = 'status fake';
                        statusDiv.textContent = 'Content script not loaded. Please refresh the page.';
                    } else if (callback) {
                        callback(response);
                    }
                });
            }
        });
    }
    
    // Toggle detection
    toggleBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) return;
            
            if (!isVideoCallSite(tabs[0].url)) {
                statusDiv.className = 'status fake';
                statusDiv.textContent = 'Please open a video call site (Google Meet, Zoom, etc.)';
                return;
            }
            
            isDetecting = !isDetecting;
            chrome.storage.sync.set({isDetecting: isDetecting});
            
            const message = {
                action: isDetecting ? 'startDetection' : 'stopDetection',
                backendUrl: backendUrlInput.value
            };
            
            sendMessageToContentScript(message, function(response) {
                console.log('Content script response:', response);
            });
            
            updateUI();
        });
    });
    
    // Clear results
    clearBtn.addEventListener('click', function() {
        sendMessageToContentScript({action: 'clearResults'});
        statusDiv.className = 'status unknown';
        statusDiv.textContent = 'Detection Cleared';
        lastResultDiv.textContent = 'No recent detections';
    });
    
    // Save settings
    saveBtn.addEventListener('click', function() {
        chrome.storage.sync.set({
            backendUrl: backendUrlInput.value
        });
        statusDiv.className = 'status unknown';
        statusDiv.textContent = 'Settings saved!';
        setTimeout(() => {
            updateUI();
        }, 2000);
    });
    
    // Listen for detection results
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'detectionResult') {
            updateStatus(request.result);
        }
    });
    
    // Check current tab on popup open
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
            if (isVideoCallSite(tabs[0].url)) {
                statusDiv.className = 'status unknown';
                statusDiv.textContent = 'Ready to detect on ' + new URL(tabs[0].url).hostname;
            } else {
                statusDiv.className = 'status fake';
                statusDiv.textContent = 'Please open a video call site';
            }
        }
    });
    
    function updateUI() {
        toggleBtn.textContent = isDetecting ? 'Stop Detection' : 'Start Detection';
        if (isDetecting) {
            statusDiv.className = 'status unknown';
            statusDiv.textContent = 'Detection Active...';
        } else {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && isVideoCallSite(tabs[0].url)) {
                    statusDiv.className = 'status unknown';
                    statusDiv.textContent = 'Detection Inactive';
                } else {
                    statusDiv.className = 'status fake';
                    statusDiv.textContent = 'Please open a video call site';
                }
            });
        }
    }
    
    function updateStatus(result) {
        if (result.error) {
            statusDiv.className = 'status fake';
            statusDiv.textContent = 'Error: ' + result.error;
        } else {
            const isReal = result.is_real;
            const confidence = (result.confidence * 100).toFixed(1);
            
            statusDiv.className = isReal ? 'status real' : 'status fake';
            statusDiv.textContent = isReal ? 
                `Real Person (${confidence}%)` : 
                `Fake/Spoof Detected (${confidence}%)`;
            
            lastResultDiv.textContent = `Last check: ${new Date().toLocaleTimeString()} - ${result.status}`;
        }
    }
});