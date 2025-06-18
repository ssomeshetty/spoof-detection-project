let isDetecting = false;
let participantsData = [];
let refreshInterval;

document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleDetection');
    const clearBtn = document.getElementById('clearResults');
    const saveBtn = document.getElementById('saveSettings');
    const refreshBtn = document.getElementById('refreshParticipants');
    const statusDiv = document.getElementById('status');
    const backendUrlInput = document.getElementById('backendUrl');
    const lastResultDiv = document.getElementById('lastResult');
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                }
            });
            
            // Start auto-refresh when participants tab is active
            if (targetTab === 'participants') {
                startParticipantsRefresh();
                loadParticipants();
            } else {
                stopParticipantsRefresh();
            }
        });
    });
    
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
        
        // Clear participants data
        participantsData = [];
        updateParticipantsList();
        updateStats();
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
    
    // Refresh participants
    refreshBtn.addEventListener('click', function() {
        loadParticipants();
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
    
    // Participants management functions
    function loadParticipants() {
        const backendUrl = backendUrlInput.value;
        
        fetch(`${backendUrl}/results/`)
            .then(response => response.json())
            .then(data => {
                participantsData = data;
                updateParticipantsList();
                updateStats();
                updateLastUpdated();
            })
            .catch(error => {
                console.error('Error loading participants:', error);
                document.getElementById('participantsList').innerHTML = 
                    '<div class="no-participants">Error loading participants data</div>';
            });
    }
    
    function updateParticipantsList() {
        const participantsList = document.getElementById('participantsList');
        
        if (participantsData.length === 0) {
            participantsList.innerHTML = '<div class="no-participants">No participants detected yet</div>';
            return;
        }
        
        // Group by user_id and get latest result for each user
        const latestResults = {};
        participantsData.forEach(result => {
            const userId = result.user_id;
            if (!latestResults[userId] || new Date(result.timestamp) > new Date(latestResults[userId].timestamp)) {
                latestResults[userId] = result;
            }
        });
        
        const participantsHtml = Object.values(latestResults)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(participant => {
                const statusClass = participant.is_real ? 'real' : 'fake';
                const statusText = participant.is_real ? 'Real' : 'Fake/Spoof';
                const confidence = (participant.confidence * 100).toFixed(1);
                const timestamp = new Date(participant.timestamp).toLocaleTimeString();
                
                return `
                    <div class="participant-item">
                        <div class="participant-status ${statusClass}"></div>
                        <div class="participant-info">
                            <div class="participant-id">User: ${participant.user_id.substring(0, 8)}...</div>
                            <div class="participant-details">${statusText} • Last seen: ${timestamp}</div>
                        </div>
                        <div class="participant-confidence" style="color: ${participant.is_real ? '#28a745' : '#dc3545'}">
                            ${confidence}%
                        </div>
                    </div>
                `;
            }).join('');
        
        participantsList.innerHTML = participantsHtml;
    }
    
    function updateStats() {
        const totalCount = document.getElementById('totalCount');
        const realCount = document.getElementById('realCount');
        const fakeCount = document.getElementById('fakeCount');
        
        // Get unique users and their latest status
        const latestResults = {};
        participantsData.forEach(result => {
            const userId = result.user_id;
            if (!latestResults[userId] || new Date(result.timestamp) > new Date(latestResults[userId].timestamp)) {
                latestResults[userId] = result;
            }
        });
        
        const uniqueParticipants = Object.values(latestResults);
        const realParticipants = uniqueParticipants.filter(p => p.is_real);
        const fakeParticipants = uniqueParticipants.filter(p => !p.is_real);
        
        totalCount.textContent = uniqueParticipants.length;
        realCount.textContent = realParticipants.length;
        fakeCount.textContent = fakeParticipants.length;
    }
    
    function updateLastUpdated() {
        const lastUpdated = document.getElementById('lastUpdated');
        lastUpdated.textContent = new Date().toLocaleTimeString();
    }
    
    function startParticipantsRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            if (document.getElementById('participants-tab').classList.contains('active')) {
                loadParticipants();
            }
        }, 5000); // Refresh every 5 seconds
    }
    
    function stopParticipantsRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }
    
    // Clean up on popup close
    window.addEventListener('beforeunload', () => {
        stopParticipantsRefresh();
    });
});