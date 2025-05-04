// QR Scanner Controller - Handles camera and QR code scanning functionality

// Global variables related to camera/scanner
let codeReader;
let selectedDeviceId;
let currentStream;
let scanActive = false;
let torchTrack = null;
let wasUsingTorch = false; // Track if torch was on before switching
let isFrontCamera = false; // Track current camera type

// Initialize the scanner functionality
function initScanner(onScanCallback) {
    // Initialize ZXing code reader
    codeReader = new ZXing.BrowserMultiFormatReader();
    
    // Setup camera control buttons
    const switchCameraBtn = document.getElementById('switch-camera');
    const toggleFlashBtn = document.getElementById('toggle-flash');
    
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', switchCamera);
    }
    
    if (toggleFlashBtn) {
        toggleFlashBtn.addEventListener('click', toggleFlash);
    }

    // Check flash availability early
    checkFlashAvailability();
    
    // Check camera availability early
    checkCameraAvailability();
}

// Initialize and start the camera scanner
async function startScanner() {
    if (scanActive) return;
    
    try {
        scanActive = true;
        const videoElement = document.getElementById('scanner-preview');
        const toggleFlashBtn = document.getElementById('toggle-flash');
        
        // Get available video devices
        const videoDevices = await codeReader.listVideoInputDevices();
        
        if (videoDevices.length === 0) {
            window.showStatus('No camera found', 'error');
            scanActive = false;
            return;
        }
        
        // Use the selected device or default to the first one
        selectedDeviceId = selectedDeviceId || videoDevices[0].deviceId;
        
        // Check if this is a back camera
        const currentDevice = videoDevices.find(device => device.deviceId === selectedDeviceId);
        const isBackCam = isBackCamera(currentDevice);
        isFrontCamera = !isBackCam;
        
        // Start scanning with the selected device
        currentStream = await codeReader.decodeFromVideoDevice(
            selectedDeviceId, 
            'scanner-preview', 
            (result, error) => {
                if (result) {
                    // Process the scanned result through the app
                    window.processQrCode(result.text);
                }
            }
        );
        
        // Now check if torch/flash is available on the current camera
        if (toggleFlashBtn && currentStream) {
            const track = currentStream.getVideoTracks()[0];
            
            if (track && track.getCapabilities && track.getCapabilities().torch) {
                // Flash is available, enable the button
                toggleFlashBtn.disabled = false;
                toggleFlashBtn.style.display = 'flex';
                toggleFlashBtn.title = 'Toggle flash';
                
                // If we're on back camera and torch was previously on, turn it back on
                if (isBackCam && wasUsingTorch && window.isSwitchingCameras) {
                    try {
                        console.log("Restoring torch state");
                        
                        // Request new stream specifically for torch control
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            video: { facingMode: "environment" } 
                        });
                        torchTrack = stream.getVideoTracks()[0];
                        
                        // Apply torch constraint
                        await torchTrack.applyConstraints({ advanced: [{ torch: true }] });
                        console.log("Flashlight restored");
                        
                        // Update UI
                        toggleFlashBtn.classList.add('active');
                        toggleFlashBtn.querySelector('i').className = 'fas fa-lightbulb';
                        
                        // Reset the flag now that we've restored the state
                        wasUsingTorch = false;
                    } catch (error) {
                        console.error("Error restoring torch:", error);
                    }
                }
            } else {
                // Flash not available on this device/browser
                toggleFlashBtn.style.display = 'none';
                console.log('Flash capability not available on this device/browser');
            }
        }
        
        window.showStatus('Ready to scan QR code.', 'info');
    } catch (err) {
        window.showStatus(`Camera error: ${err.message}`, 'error');
        scanActive = false;
    }
}

// Stop the scanner
function stopScanner() {
    if (codeReader && scanActive) {
        codeReader.reset();
        scanActive = false;
        if (currentStream) {
            const tracks = currentStream.getVideoTracks();
            tracks.forEach(track => track.stop());
            currentStream = null;
        }
        
        // Only release torch resources if switching to front camera or
        // completely stopping the scanner (not just switching cameras)
        if (torchTrack && (isFrontCamera || !window.isSwitchingCameras)) {
            torchTrack.stop();
            wasUsingTorch = true; // Remember torch was on
            torchTrack = null;
            
            // Reset UI state
            const toggleFlashBtn = document.getElementById('toggle-flash');
            if (toggleFlashBtn) {
                toggleFlashBtn.classList.remove('active');
                toggleFlashBtn.querySelector('i').className = 'fas fa-bolt';
            }
        }
    }
}

// Switch between available cameras
async function switchCamera() {
    if (!scanActive) return;
    
    try {
        // Get available video devices
        const videoDevices = await codeReader.listVideoInputDevices();
        
        if (videoDevices.length <= 1) {
            window.showStatus('Only one camera available', 'info');
            const switchCameraBtn = document.getElementById('switch-camera');
            if (switchCameraBtn) {
                switchCameraBtn.style.display = 'none';
            }
            return;
        }
        
        // Find the index of the current device
        const currentIndex = videoDevices.findIndex(device => device.deviceId === selectedDeviceId);
        
        // Get current camera info
        const currentDevice = videoDevices[currentIndex];
        const currentIsBack = isBackCamera(currentDevice);
        
        // Select the next device (or go back to the first one)
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        selectedDeviceId = videoDevices[nextIndex].deviceId;
        
        // Get next camera type
        const nextDevice = videoDevices[nextIndex];
        const nextIsBack = isBackCamera(nextDevice);
        
        // Set flag to indicate if we're switching to front camera
        isFrontCamera = !nextIsBack;
        
        // Set a flag to indicate we're switching cameras (not stopping)
        window.isSwitchingCameras = true;
        
        // Restart scanner with new device
        stopScanner();
        startScanner();
        
        // Clear the switching flag
        window.isSwitchingCameras = false;
        
        // Show more descriptive message
        const cameraLabel = videoDevices[nextIndex].label || `Camera ${nextIndex + 1}`;
        window.showStatus(`Switched to ${cameraLabel}`, 'info');
    } catch (err) {
        window.isSwitchingCameras = false;
        window.showStatus(`Error switching camera: ${err.message}`, 'error');
    }
}

// Function to check if device likely has a flash/torch
async function checkFlashAvailability() {
    const toggleFlashBtn = document.getElementById('toggle-flash');
    if (!toggleFlashBtn) return;

    // First, hide the button by default
    toggleFlashBtn.style.display = 'none';

    try {
        // Check if running on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // On mobile, assume flash might be available and show the button
            toggleFlashBtn.style.display = 'flex';
            toggleFlashBtn.disabled = false;
            toggleFlashBtn.title = 'Toggle flash';
            console.log('Mobile device detected, showing flash button');
        } else {
            // On desktop, likely no flash - keep button hidden
            toggleFlashBtn.style.display = 'none';
            console.log('Flash button hidden - device appears to be desktop/laptop');
        }
    } catch (err) {
        console.error('Error checking flash capability:', err);
        // Hide flash button on error
        toggleFlashBtn.style.display = 'none';
    }
}

// Function to check camera availability and manage camera controls
async function checkCameraAvailability() {
    const switchCameraBtn = document.getElementById('switch-camera');
    if (!switchCameraBtn) return;

    try {
        // Hide the button by default
        switchCameraBtn.style.display = 'none';
        
        // Get available video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Only show the switch button if more than one camera is available
        if (videoDevices.length > 1) {
            switchCameraBtn.style.display = 'flex';
            switchCameraBtn.title = `Switch between ${videoDevices.length} cameras`;
        } else {
            // Hide the button if only one camera
            console.log('Only one camera detected, hiding switch camera button');
        }
    } catch (err) {
        console.error('Error checking camera availability:', err);
    }
}

// Toggle the device's torch/flash if available
async function toggleFlash() {
    const toggleFlashBtn = document.getElementById('toggle-flash');
    
    // If the torch is already on, turn it off
    if (torchTrack) {
        try {
            torchTrack.stop();
            torchTrack = null;
            console.log("Flashlight OFF");
            
            // Update UI
            if (toggleFlashBtn) {
                toggleFlashBtn.classList.remove('active');
                toggleFlashBtn.querySelector('i').className = 'fas fa-bolt';
            }
            window.showStatus('Flash off', 'info');
        } catch (error) {
            console.error("Error turning off torch:", error);
            window.showStatus('Error turning off flash', 'error');
        }
        return;
    }
    
    // Otherwise, turn the torch on
    try {
        // Request new stream specifically for torch control
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        torchTrack = stream.getVideoTracks()[0];
        
        // Apply torch constraint
        await torchTrack.applyConstraints({ advanced: [{ torch: true }] });
        console.log("Flashlight ON");
        
        // Update UI
        if (toggleFlashBtn) {
            toggleFlashBtn.classList.add('active');
            toggleFlashBtn.querySelector('i').className = 'fas fa-lightbulb';
        }
        window.showStatus('Flash on', 'info');
    } catch (error) {
        console.error("Error accessing torch:", error);
        window.showStatus('Torch not supported or permission denied', 'error');
    }
}

// Helper function to detect if a camera is likely the back camera
function isBackCamera(device) {
    if (!device || !device.label) return false;
    
    const label = device.label.toLowerCase();
    return label.includes('back') || 
           label.includes('rear') || 
           label.includes('environment') || 
           (label.includes('0') && !label.includes('front'));
}

// Export functions to be used from app.js
window.QrScanner = {
    initScanner,
    startScanner,
    stopScanner,
    isActive: () => scanActive
};