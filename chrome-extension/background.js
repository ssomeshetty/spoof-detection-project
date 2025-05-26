// background.js (Service Worker)
console.log('Background script loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Spoof Detection Extension installed');

    // Initialize default settings
    chrome.storage.sync.set({
        backendUrl: 'http://127.0.0.1:8000/api', // Use 127.0.0.1 for consistency
        isDetecting: false
    });
});

// Handle messages between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);

    if (request.action === 'detectionResult') {
        // Store detection results or perform additional processing
        console.log('Detection result:', request.result);
    }

    // No asynchronous response needed, so do NOT return true
    return true;
});

// Handle tab updates to restart detection if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if detection should be active on this tab
        chrome.storage.sync.get(['isDetecting'], (result) => {
            if (result.isDetecting && isVideoCallSite(tab.url)) {
                console.log('Video call site loaded, detection may need restart');
                // You can add code here to restart detection on tab if needed
            }
        });
    }
});

// Helper function to check if URL is a video call site
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
