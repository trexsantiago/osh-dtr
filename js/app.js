// Main Application Controller - Handles application-level functionality

// Global variables for application state
let currentEmployeeData = null;

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize database first
    try {
        await DB.init();
        console.log('Database initialized successfully');
        
        // Update pending counter on startup
        await updatePendingRecordsCounter();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        showStatus('Database initialization failed. Some features may not work properly.', 'error');
    }
    
    // Initialize QR scanner
    window.QrScanner.initScanner();
    
    // Network status detection
    setupNetworkStatusDetection();
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Set up form submission
    setupFormHandlers();
    
    // Start with scan tab active by default
    activateTab('scan-tab');

    // Check for pending records on startup and notify user
    try {
        const pendingCount = await DB.getPendingCount();
        if (pendingCount > 0) {
            // Only show after a short delay so user can see app has loaded
            setTimeout(() => {
                if (navigator.onLine) {
                    // Online - can sync now
                    const currentUser = firebase.auth().currentUser;
                    if (currentUser) {
                        showStatus(`You have ${pendingCount} pending record${pendingCount > 1 ? 's' : ''} waiting to sync. Go to History tab to sync them.`, 'info', true);
                    } else {
                        showStatus(`You have ${pendingCount} pending record${pendingCount > 1 ? 's' : ''} waiting to sync. Please sign in to upload to the server.`, 'info', true);
                    }
                } else {
                    // Offline - will sync later
                    showStatus(`You have ${pendingCount} pending record${pendingCount > 1 ? 's' : ''}. You can upload them in the History tab when online.`, 'info', true);
                }
            }, 1500);
        }
    } catch (err) {
        console.error('Error checking pending records on startup:', err);
    }
});

// Set up tab navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    // Add event listeners to tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-target');
            activateTab(targetTab);
        });
    });
}

// Set up form submission handlers
function setupFormHandlers() {
    // Add event listener to submit button
    const submitBtn = document.querySelector('#action-container .btn-primary');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAttendanceRecord);
    }
}

// Function to activate a tab and manage camera accordingly
function activateTab(tabId) {
    // Hide all tabs and remove active class
    const tabContents = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabContents.forEach(tab => tab.classList.remove('active'));
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show the selected tab and add active class to its button
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-target="${tabId}"]`).classList.add('active');
    
    // Handle camera based on active tab
    if (tabId === 'scan-tab') {
        // Start the scanner
        window.QrScanner.startScanner();
        
        // Hide employee section when switching to scan tab
        hideEmployeeSection();
    } else {
        window.QrScanner.stopScanner();
    }

    // After switching tabs, check if there's a persistent message to display
    if (window.persistentStatusMessage) {
        // Small delay to ensure the new tab is fully visible
        setTimeout(() => {
            window.showStatus(
                window.persistentStatusMessage.message, 
                window.persistentStatusMessage.type
            );
        }, 100);
    }

    // Update the counter when switching to the history tab
    if (tabId === 'history-tab') {
        updatePendingRecordsCounter().catch(error => {
            console.error('Error updating pending records counter:', error);
        });
    }
}

// Process the scanned QR code
window.processQrCode = function(qrData) {
    // Stop scanning temporarily to prevent multiple scans
    window.QrScanner.stopScanner();
    
    try {
        // Check if the scanned data is a Google Forms URL
        if (qrData.includes('docs.google.com/forms')) {
            // Extract the lastname and firstname from the URL
            const url = new URL(qrData);
            const params = new URLSearchParams(url.search);
            
            // Get the lastname and firstname parameters
            const lastname = params.get('entry.1575753690') || '';
            const firstname = params.get('entry.1621774329') || '';
            
            if (lastname && firstname) {
                // Show success message
                showStatus(`Successfully scanned: ${firstname} ${lastname}`, 'success');
                
                // Display the employee data in the integrated employee section
                displayEmployeeData(lastname, firstname);
                
                // Show the employee section and scroll to it
                showEmployeeSection();
            } else {
                showStatus('Invalid QR code format: Missing name parameters', 'error');
                // Restart scanner after error
                window.QrScanner.startScanner();
            }
        } else {
            showStatus('Invalid QR code: Not a Google Forms URL', 'error');
            // Restart scanner after error
            window.QrScanner.startScanner();
        }
    } catch (err) {
        showStatus(`Error processing QR code: ${err.message}`, 'error');
        // Restart scanner after error
        window.QrScanner.startScanner();
    }
};

// Updated function to show the employee section
function showEmployeeSection() {
    const employeeSection = document.getElementById('employee-section');
    
    if (employeeSection) {
        // Show the section
        employeeSection.classList.remove('hidden');
        employeeSection.classList.add('slide-in');
        
        // Scroll to the employee section
        setTimeout(() => {
            employeeSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
        
        // Use the unified time-based action selection
        selectActionBasedOnTime();
    }
}

// Display employee data in the employee tab
function displayEmployeeData(lastname, firstname) {
    // Get the employee details container
    const employeeDetails = document.querySelector('.employee-details');
    
    if (employeeDetails) {
        // Get current date and time
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = now.toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        // Update the employee info with a simplified layout
        employeeDetails.innerHTML = `
            <div class="employee-info">
                <h4>${firstname} ${lastname}</h4>
                <p>${formattedDate} at ${formattedTime}</p>
            </div>
        `;
        
        // Store employee data for later submission
        currentEmployeeData = {
            firstName: firstname,
            lastName: lastname,
            scanDate: formattedDate,
            scanTime: formattedTime,
            timestamp: now.toISOString()
        };
    }
}

// Function to suggest appropriate time action based on time of day
function suggestTimeAction(dateTime) {
    const hour = dateTime.getHours();
    let suggestedAction = null;
    
    // Simple logic to suggest the appropriate action
    if (hour >= 7 && hour < 9) {
        suggestedAction = 'time-in'; // Morning (7-9 AM) - Time In
    } else if (hour >= 12 && hour < 13) {
        suggestedAction = 'lunch-out'; // Noon (12-1 PM) - Lunch Out
    } else if (hour >= 13 && hour < 14) {
        suggestedAction = 'lunch-in'; // After lunch (1-2 PM) - Lunch In
    } else if (hour >= 17 && hour < 19) {
        suggestedAction = 'time-out'; // Evening (5-7 PM) - Time Out
    }
    
    // Pre-select the radio button if we have a suggestion
    if (suggestedAction) {
        const radioBtn = document.getElementById(suggestedAction);
        if (radioBtn) {
            radioBtn.checked = true;
        }
    }
}

// Modified submitAttendanceRecord function with adjusted notifications
async function submitAttendanceRecord() {
    // Check if we have employee data
    if (!currentEmployeeData) {
        showStatus('No employee data available. Please scan again.', 'error');
        return;
    }
    
    // Get the selected action
    const selectedAction = document.querySelector('input[name="time-action"]:checked');
    if (!selectedAction) {
        showStatus('Please select an action first', 'error');
        return;
    }
    
    // Get action details
    const actionType = selectedAction.value;
    const actionLabel = document.querySelector(`label[for="${selectedAction.id}"]`).getAttribute('title');
    
    // Create the record object for submission
    const record = {
        firstName: currentEmployeeData.firstName,
        lastName: currentEmployeeData.lastName,
        timestamp: currentEmployeeData.timestamp,
        action: actionType,
        actionLabel: actionLabel,
        syncStatus: 'pending' // All records start as pending
    };
    
    // Show initial loading state
    showStatus('Processing...', 'info');
    
    try {
        console.log('Saving record locally:', record);
        // First save record locally to IndexedDB (without requiring authentication)
        const savedRecord = await DB.saveRecord(record);
        console.log('Record saved locally:', savedRecord);

        // Update pending counter after saving a record
        await updatePendingRecordsCounter();
        
        // Check if we're online
        if (navigator.onLine) {
            // Only try to sync if authenticated
            const currentUser = firebase.auth().currentUser;
            
            if (currentUser) {
                try {
                    showStatus('Uploading to server...', 'info');
                    
                    // Try to sync with Google Sheets
                    console.log('Attempting to sync record:', savedRecord);
                    const syncResult = await SheetsAPI.submitAttendance(savedRecord);
                    console.log('Sync result:', syncResult);
                    
                    // Update sync status in local DB
                    await DB.updateSyncStatus(savedRecord.id, 'synced');
                    
                    // Only show a success message about successful sync
                    showStatus(`${actionLabel} recorded and uploaded successfully for ${record.firstName} ${record.lastName}`, 'success', true);
                } catch (syncError) {
                    console.error('Error syncing record:', syncError);
                    showStatus('Record saved locally but upload failed: ' + syncError.message, 'warning', true);
                }
            } else {
                // Online but not authenticated - directly show login modal without "saved locally" message
                // Just show login modal directly (with small delay so message is seen first)
                setTimeout(() => {
                    const loginModal = document.getElementById('login-modal');
                    if (loginModal) {
                        loginModal.classList.remove('hidden');
                        setTimeout(() => {
                            loginModal.classList.add('visible');
                        }, 10);
                    }
                }, 500);
                
                // Update status but don't mention local save
                showStatus(`${actionLabel} recorded for ${record.firstName} ${record.lastName}. Please sign in to upload.`, 'info');
            }
        } else {
            // Only mention local saving when we're offline
            showStatus(`${actionLabel} recorded for ${record.firstName} ${record.lastName}. Will upload when online.`, 'info');
        }
        
        // Reset after successful submission
        setTimeout(() => {
            hideEmployeeSection();
            resetScan();
        }, 2000);
        
        return savedRecord;
    } catch (error) {
        console.error('Error saving record:', error);
        showStatus(`Failed to save record: ${error.message}`, 'error');
        throw error;
    }
}

// Network status detection
function setupNetworkStatusDetection() {
    const networkStatus = document.getElementById('network-status');
    const networkIcon = networkStatus.querySelector('i');
    const networkText = networkStatus.querySelector('span');

    // Initial status check
    updateNetworkStatus();

    // Add event listeners for network status changes
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Add periodic check for more reliable detection
    setInterval(updateNetworkStatus, 5000);
    
    function enableOnlineFeatures() {
        // Enable buttons that require internet
        const onlineButtons = document.querySelectorAll('.requires-connection');
        onlineButtons.forEach(btn => btn.disabled = false);
    }

    function disableOnlineFeatures() {
        // Disable buttons that require internet
        const onlineButtons = document.querySelectorAll('.requires-connection');
        onlineButtons.forEach(btn => btn.disabled = true);
        
        // Show offline message if needed
        showStatus('You are currently offline. Some features may not work.', 'warning');
    }
}

// Simplified network status indicator - showing only network status, no pending info
async function updateNetworkStatus() {
  const networkStatus = document.getElementById('network-status');
  const networkText = networkStatus.querySelector('span');
  const networkIcon = networkStatus.querySelector('i');
  
  // Add transition effect when status changes
  const currentClass = networkStatus.className;
  
  // Check connection
  const isOnline = navigator.onLine;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  // Get effective connection speed if available
  let connectionSpeed = 'unknown';
  if (connection) {
    connectionSpeed = connection.effectiveType || 'unknown';
  }
  
  // Add status-changing class for animation
  networkStatus.classList.add('status-changing');
  
  // Remove any existing signal strength indicator
  const existingSignal = networkStatus.querySelector('.signal-strength');
  if (existingSignal) {
    networkStatus.removeChild(existingSignal);
  }
  
  try {
    if (!isOnline) {
      // Offline status - simple indicator with no pending info
      networkStatus.className = 'network-banner offline status-changing';
      networkIcon.className = 'fas fa-ban';
      networkText.textContent = 'Offline';
    } else if (connection && (connectionSpeed === 'slow-2g' || connectionSpeed === '2g')) {
      // Limited connectivity
      networkStatus.className = 'network-banner limited status-changing';
      networkIcon.className = 'fas fa-exclamation-triangle';
      networkText.textContent = 'Limited Connectivity';
      
      // Add signal strength indicator
      const signalStrength = document.createElement('div');
      signalStrength.className = 'signal-strength';
      networkStatus.appendChild(signalStrength);
    } else {
      // Online with good connection - simple indicator with no pending info
      networkStatus.className = 'network-banner online status-changing';
      networkIcon.className = 'fas fa-wifi';
      
      // Show connection quality if available
      if (connectionSpeed && connectionSpeed !== 'unknown') {
        if (connectionSpeed === '4g') {
          networkText.textContent = 'Online (Excellent)';
        } else if (connectionSpeed === '3g') {
          networkText.textContent = 'Online (Good)';
        } else {
          networkText.textContent = 'Online';
        }
      } else {
        networkText.textContent = 'Online';
      }
    }
    
    // Check for pending records and update UI (without showing in network banner)
    // This is necessary to show notifications in the message box
    try {
      const pendingCount = await DB.getPendingCount();
      
      // If coming back online, show notification about pending records in message box
      if (pendingCount > 0 && isOnline && currentClass.includes('offline')) {
        const currentUser = firebase.auth().currentUser;
        
        if (currentUser) {
          showStatus(`You have ${pendingCount} pending record${pendingCount > 1 ? 's' : ''}. Go to History tab to upload them.`, 'info', true);
        } else {
          showStatus(`You have ${pendingCount} pending record${pendingCount > 1 ? 's' : ''}. Sign in and visit the History tab to upload them.`, 'info', true);
        }
      }
      
      // Update badge in History tab (still needed)
      await updatePendingRecordsCounter();
    } catch(err) {
      console.error('Error getting pending count:', err);
    }
    
    // Update app behavior based on network status
    if (isOnline) {
      document.body.classList.remove('app-offline');
      
      // Enable buttons that require internet
      const onlineButtons = document.querySelectorAll('.requires-connection');
      onlineButtons.forEach(btn => btn.disabled = false);
    } else {
      document.body.classList.add('app-offline');
      
      // Disable buttons that require internet
      const onlineButtons = document.querySelectorAll('.requires-connection');
      onlineButtons.forEach(btn => btn.disabled = true);
      
      // Show offline message if needed
      showStatus('You are currently offline. Some features may not work.', 'warning');
    }
  } finally {
    // Remove animation class after transition
    setTimeout(() => {
      networkStatus.classList.remove('status-changing');
    }, 800);
  }
}

// Add this function to sync pending records
async function syncPendingRecords() {
    try {
        // Get all pending records
        const pendingRecords = await DB.getPendingRecords();
        
        if (pendingRecords.length === 0) {
            console.log('No pending records to sync');
            return;
        }
        
        console.log('Pending records found:', pendingRecords);
        showStatus(`Syncing ${pendingRecords.length} pending records...`, 'info');
        
        // Show animation on the sync button
        updateSyncButtonState(true);
        
        const results = await SheetsAPI.syncBatch(pendingRecords);
        console.log('Sync results:', results);
        
        // Update sync status for successful records
        const successful = results.filter(r => r.success);
        for (const result of successful) {
            await DB.updateSyncStatus(result.id, 'synced');
            console.log(`Record ${result.id} marked as synced`);
        }

        // Update pending counter after syncing
        await updatePendingRecordsCounter();
        
        // Add a small delay before removing animation to make it visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reset button state
        updateSyncButtonState(false);
        
        // Show status message
        if (successful.length > 0) {
            showStatus(`Successfully synced ${successful.length} of ${pendingRecords.length} records`, 'success');
        }
        
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            console.error('Failed syncs:', failed);
            showStatus(`Failed to sync ${failed.length} records. Will try again later.`, 'warning');
        }
    } catch (error) {
        console.error('Error in syncPendingRecords:', error);
        showStatus('Failed to sync pending records: ' + error.message, 'error');
        
        // Reset the button state even on error
        updateSyncButtonState(false);
    }
}

// Show status messages
window.showStatus = function(message, type = 'info', persistent = false) {
    const statusMessage = document.getElementById('status-message');
    
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = ''; // Clear all classes first
        statusMessage.classList.add(type); // Add the type class only once
        
        // Show the message (in case it was hidden)
        statusMessage.style.display = 'block';
        
        // Clear any existing timeout
        clearTimeout(window.statusTimeout);
        
        // For non-error messages that aren't persistent, hide after a few seconds
        if (type !== 'error' && !persistent) {
            window.statusTimeout = setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
        
        // Store the message for persistence across tabs if needed
        if (persistent) {
            window.persistentStatusMessage = {
                message: message,
                type: type
            };
            
            // For persistent messages, set a longer timeout
            window.statusTimeout = setTimeout(() => {
                statusMessage.style.display = 'none';
                window.persistentStatusMessage = null;
            }, 8000);
        }
    }
};

// Unified function for auto-selecting action based on time
function selectActionBasedOnTime() {
  const now = new Date();
  const hour = now.getHours(); // 24-hour format (0-23)
  
  // Get all action radio buttons
  const timeInBtn = document.getElementById('time-in');
  const lunchOutBtn = document.getElementById('lunch-out');
  const lunchInBtn = document.getElementById('lunch-in');
  const timeOutBtn = document.getElementById('time-out');
  const univActivityBtn = document.getElementById('univ-activity');
  
  // Default all to unchecked
  if (timeInBtn) timeInBtn.checked = false;
  if (lunchOutBtn) lunchOutBtn.checked = false;
  if (lunchInBtn) lunchInBtn.checked = false;
  if (timeOutBtn) timeOutBtn.checked = false;
  if (univActivityBtn) univActivityBtn.checked = false;
  
  // Select based on time of day
  let selectedAction = '';
  
  if (hour >= 7 && hour < 12) {
    // Morning (7:00 AM - 11:59 AM) - Typically Time In
    if (timeInBtn) {
      timeInBtn.checked = true;
      selectedAction = 'Time In';
    }
  } else if (hour >= 12 && hour < 13) {
    // Lunch time (12:00 PM - 12:59 PM) - Typically Lunch Out
    if (lunchOutBtn) {
      lunchOutBtn.checked = true;
      selectedAction = 'Lunch Out';
    }
  } else if (hour >= 13 && hour < 14) {
    // After lunch (1:00 PM - 1:59 PM) - Typically Lunch In
    if (lunchInBtn) {
      lunchInBtn.checked = true;
      selectedAction = 'Lunch In';
    }
  } else if (hour >= 15 && hour <= 22){
    // Afternoon/Evening (3:00 PM - 10:00 PM) - Typically Time Out
    if (timeOutBtn) {
      timeOutBtn.checked = true;
      selectedAction = 'Time Out';
    }
  } else {
    // Outside regular hours - Select Time In as default
    if (timeInBtn) {
      timeInBtn.checked = true;
      selectedAction = 'Time In';
    }
  }
  
  // Show the hint about auto-selection
  const actionHint = document.getElementById('action-hint');
  if (actionHint && selectedAction) {
    actionHint.textContent = `${selectedAction} auto-selected based on time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    actionHint.classList.add('visible');
    
    // Make it fade out after a few seconds
    setTimeout(() => {
      actionHint.classList.remove('visible');
    }, 5000);
  }
}

// Call this function when employee data is loaded and the action screen is shown
function showEmployeeActionScreen(employeeData) {
  // Set the current employee data
  currentEmployeeData = employeeData;
  
  // Update UI elements with employee info
  const nameElement = document.querySelector('.employee-details');
  if (nameElement) {
    nameElement.innerHTML = `
      <div class="employee-info">
        <h4 id="employee-name">${employeeData.firstName} ${employeeData.lastName}</h4>
        <p id="scan-timestamp">${new Date(employeeData.timestamp).toLocaleString()}</p>
      </div>
    `;
  }
  
  // Auto-select action based on time of day
  selectActionBasedOnTime();
  
  // Show the employee section
  showEmployeeSection();
}

// Add this function to update both counter badges
async function updatePendingRecordsCounter() {
  try {
    const pendingCount = await DB.getPendingCount();
    
    // Update the main tab counter badge
    const pendingBadge = document.getElementById('pending-records-count');
    if (pendingBadge) {
      pendingBadge.textContent = pendingCount || '';
      pendingBadge.classList.toggle('hidden', pendingCount === 0);
    }
    
    // Update the mini badge on the sync button
    const pendingCountBadge = document.getElementById('pending-count-badge');
    if (pendingCountBadge) {
      pendingCountBadge.textContent = pendingCount;
      pendingCountBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    
    return pendingCount;
  } catch (error) {
    console.error('Error updating pending records counter:', error);
    return 0;
  }
}

// History tab functionality
let currentRecords = []; // Store the current set of records
let currentPage = 1;
let recordsPerPage = 10;
let totalPages = 1;
let currentFilter = 'all';
let searchTerm = '';
let showingOrgRecords = false;
let orgRecordsCache = null;
let lastOrgFetchTime = null;

// Initialize history tab functionality
function setupHistoryTab() {
    // Set up data source toggle
    const localRecordsBtn = document.getElementById('local-records-btn');
    const orgRecordsBtn = document.getElementById('org-records-btn');
    
    if (localRecordsBtn && orgRecordsBtn) {
        localRecordsBtn.addEventListener('click', function() {
            if (showingOrgRecords) {
                showingOrgRecords = false;
                localRecordsBtn.classList.add('active');
                orgRecordsBtn.classList.remove('active');
                currentPage = 1;
                loadHistoryRecords();
            }
        });
        
        orgRecordsBtn.addEventListener('click', function() {
            if (!showingOrgRecords) {
                showingOrgRecords = true;
                orgRecordsBtn.classList.add('active');
                localRecordsBtn.classList.remove('active');
                currentPage = 1;
                
                // Always clear cache when explicitly switching to organization records
                orgRecordsCache = null;
                lastOrgFetchTime = null;
                
                loadHistoryRecords();
            }
        });
    }
    
    // Set up filter dropdown
    const filterSelect = document.getElementById('history-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            currentFilter = this.value;
            currentPage = 1;
            loadHistoryRecords();
        });
    }
    
    // Set up search input
    const searchInput = document.getElementById('history-search');
    const clearSearchBtn = document.getElementById('clear-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchTerm = this.value.trim().toLowerCase();
            currentPage = 1;
            loadHistoryRecords();
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
                searchTerm = '';
                loadHistoryRecords();
            }
        });
    }
    
    // Set up pagination
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                loadHistoryRecords();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                loadHistoryRecords();
            }
        });
    }
    
    // Set up sync all button
    const syncAllBtn = document.getElementById('sync-all-btn');
    if (syncAllBtn) {
        syncAllBtn.addEventListener('click', function() {
            syncAllPendingRecords();
        });
    }
    
    // Set up show local only link
    const showLocalOnlyLink = document.getElementById('show-local-only');
    if (showLocalOnlyLink) {
        showLocalOnlyLink.addEventListener('click', function(e) {
            e.preventDefault();
            showingOrgRecords = false;
            if (localRecordsBtn) localRecordsBtn.classList.add('active');
            if (orgRecordsBtn) orgRecordsBtn.classList.remove('active');
            currentPage = 1;
            loadHistoryRecords();
        });
    }

    // Add refresh button for organization records
    const refreshOrgBtn = document.getElementById('refresh-org-btn');
    if (refreshOrgBtn) {
        refreshOrgBtn.addEventListener('click', function() {
            if (showingOrgRecords) {
                // Force refresh by clearing the cache
                orgRecordsCache = null;
                lastOrgFetchTime = null;
                
                // Show loading state
                refreshOrgBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                refreshOrgBtn.disabled = true;
                
                // Reload records
                loadHistoryRecords().finally(() => {
                    // Reset button state
                    refreshOrgBtn.innerHTML = '<i class="fas fa-sync"></i>';
                    refreshOrgBtn.disabled = false;
                });
            }
        });
    }
}

// Load records for the history tab
async function loadHistoryRecords() {
    // Show loading state
    const loadingElement = document.getElementById('history-loading');
    const emptyElement = document.getElementById('history-empty');
    const tableElement = document.getElementById('history-table');
    const orgNoticeElement = document.getElementById('history-org-notice');
    
    if (loadingElement) loadingElement.classList.remove('hidden');
    if (emptyElement) emptyElement.classList.add('hidden');
    if (tableElement) tableElement.classList.add('hidden');
    if (orgNoticeElement) orgNoticeElement.classList.add('hidden');
    
    try {
        let records = [];
        
        if (showingOrgRecords) {
            // Get organization-wide records from Google Sheets
            records = await fetchOrganizationRecords();
            
            // Show the organization notice
            if (orgNoticeElement) {
                orgNoticeElement.classList.remove('hidden');
            }
        } else {
            // Get local records from IndexedDB
            records = await DB.getAllRecords();
        }
        
        // Apply filters
        let filteredRecords = records;
        
        // Filter by status (only applies to local records)
        if (!showingOrgRecords) {
            if (currentFilter === 'pending') {
                filteredRecords = records.filter(record => record.syncStatus === 'pending');
            } else if (currentFilter === 'synced') {
                filteredRecords = records.filter(record => record.syncStatus === 'synced');
            }
        }
        
        // Filter by time period
        if (currentFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            filteredRecords = filteredRecords.filter(record => {
                const recordDate = new Date(record.timestamp);
                return recordDate >= today;
            });
        } else if (currentFilter === 'week') {
            const weekStart = new Date();
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
            filteredRecords = filteredRecords.filter(record => {
                const recordDate = new Date(record.timestamp);
                return recordDate >= weekStart;
            });
        }
        
        // Apply search
        if (searchTerm) {
            filteredRecords = filteredRecords.filter(record => {
                return record.firstName.toLowerCase().includes(searchTerm) || 
                       record.lastName.toLowerCase().includes(searchTerm) ||
                       (record.actionLabel || record.action).toLowerCase().includes(searchTerm);
            });
        }
        
        // Sort by timestamp (newest first)
        filteredRecords.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Store the current set of records
        currentRecords = filteredRecords;
        
        // Calculate pagination
        totalPages = Math.max(1, Math.ceil(filteredRecords.length / recordsPerPage));
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = Math.min(startIndex + recordsPerPage, filteredRecords.length);
        const paginatedRecords = filteredRecords.slice(startIndex, endIndex);
        
        // Update pagination controls
        updatePaginationControls();
        
        // Update table with records
        updateHistoryTable(paginatedRecords);
        
        // After loading records, check for pending records
        if (!showingOrgRecords) {
            const pendingRecords = records.filter(record => record.syncStatus === 'pending');
            if (pendingRecords.length > 0) {
                const currentUser = firebase.auth().currentUser;
                if (navigator.onLine) {
                    if (currentUser) {
                        // User is online and authenticated - can sync now
                        showStatus(`You have ${pendingRecords.length} pending record${pendingRecords.length > 1 ? 's' : ''}. Click "Sync All Pending" to upload to the server.`, 'info', true);
                    } else {
                        // User is online but not authenticated - need to sign in
                        showStatus(`You have ${pendingRecords.length} pending record${pendingRecords.length > 1 ? 's' : ''}. Sign in to access the upload feature.`, 'info', true);
                    }
                } else {
                    // User is offline
                    showStatus(`You have ${pendingRecords.length} pending record${pendingRecords.length > 1 ? 's' : ''}. Connect to internet and use History tab to upload them.`, 'info', true);
                }
            }
        }
        
        // Hide loading state
        if (loadingElement) loadingElement.classList.add('hidden');
        
        // Show empty state or table
        if (filteredRecords.length === 0) {
            if (emptyElement) emptyElement.classList.remove('hidden');
            if (tableElement) tableElement.classList.add('hidden');
        } else {
            if (emptyElement) emptyElement.classList.add('hidden');
            if (tableElement) tableElement.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading history records:', error);
        
        // Hide loading state and show error
        if (loadingElement) loadingElement.classList.add('hidden');
        if (emptyElement) {
            emptyElement.classList.remove('hidden');
            emptyElement.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading records: ${error.message}</p>
            `;
        }
        if (tableElement) tableElement.classList.add('hidden');
    }

    // Update the pending counter
    await updatePendingRecordsCounter();
}

// Update the history table with records
function updateHistoryTable(records) {
    const tableBody = document.getElementById('history-records');
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Create rows for each record
    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Format the timestamp
        const timestamp = new Date(record.timestamp);
        const formattedDate = timestamp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = timestamp.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Status icon and text
        let statusIcon, statusClass, statusText;
        
        if (showingOrgRecords) {
            // For org records, all are considered synced
            statusIcon = 'fas fa-check-circle';
            statusClass = 'synced';
            statusText = 'Synced';
        } else {
            // For local records, check the sync status
            if (record.syncStatus === 'synced') {
                statusIcon = 'fas fa-check-circle';
                statusClass = 'synced';
                statusText = 'Synced';
            } else {
                statusIcon = 'fas fa-clock';
                statusClass = 'pending';
                statusText = 'Pending';
            }
        }
        
        // Determine the action label
        let actionLabel = record.actionLabel || record.action;
        // If it's just a code like "IN", "OUT", expand it
        if (actionLabel === "IN") actionLabel = "Time In";
        if (actionLabel === "OUT") actionLabel = "Time Out";
        if (actionLabel === "LOUT") actionLabel = "Lunch Out";
        if (actionLabel === "LIN") actionLabel = "Lunch In";
        if (actionLabel === "UA") actionLabel = "University Activity";
        
        // Source indicator
        const sourceHtml = showingOrgRecords ? 
            `<span class="record-source remote"><i class="fas fa-globe"></i> Server</span>` : 
            `<span class="record-source local"><i class="fas fa-laptop"></i> Local</span>`;
        
        // Create the row content
        row.innerHTML = `
            <td class="record-time">
                ${formattedDate}<br>
                <span class="time-small">${formattedTime}</span>
            </td>
            <td class="record-name">
                ${record.firstName} ${record.lastName}
            </td>
            <td>${actionLabel}</td>
            <td>
                <span class="record-status ${statusClass}">
                    <i class="${statusIcon}"></i>
                    ${statusText}
                </span>
            </td>
            <td>${sourceHtml}</td>
        `;
        
        // Add the row to the table
        tableBody.appendChild(row);
        
        // Add event listeners for row actions
        row.addEventListener('click', () => {
            showRecordDetails(record);
        });
    });
}

// Update pagination controls
function updatePaginationControls() {
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    if (pageIndicator) {
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

// Fetch organization records from Google Sheets
async function fetchOrganizationRecords() {
    const CACHE_TIMEOUT = 30 * 1000; // 30 seconds
    const now = Date.now();
    
    if (orgRecordsCache && lastOrgFetchTime && (now - lastOrgFetchTime < CACHE_TIMEOUT)) {
        console.log("Using cached organization records");
        return orgRecordsCache;
    }
    
    try {
        // Show status message
        showStatus('Fetching organization records...', 'info');
        
        // Get the current user's email
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error("Must be logged in to fetch university-wide records");
        }
        
        // Fetch records from Google Sheets
        const result = await SheetsAPI.fetchRecords();
        
        // Update cache
        orgRecordsCache = result.records;
        lastOrgFetchTime = now;
        
        // Update last refresh timestamp
        updateLastRefreshTime();
        
        showStatus('Organization records loaded successfully', 'success');
        return result.records;
    } catch (error) {
        console.error("Failed to fetch organization records:", error);
        showStatus(`Failed to fetch organization records: ${error.message}`, 'error');
        throw error;
    }
}

// Show record details in a modal
function showRecordDetails(record) {
    // Get the existing modal or create one
    let detailsModal = document.getElementById('record-details-modal');
    
    if (!detailsModal) {
        console.error("Record details modal not found in HTML");
        return;
    }
    
    // Format the timestamp
    const timestamp = new Date(record.timestamp);
    const formattedDateTime = timestamp.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Determine action label
    let actionLabel = record.actionLabel || record.action;
    // If it's just a code like "IN", "OUT", expand it
    if (actionLabel === "IN") actionLabel = "Time In";
    if (actionLabel === "OUT") actionLabel = "Time Out";
    if (actionLabel === "LOUT") actionLabel = "Lunch Out";
    if (actionLabel === "LIN") actionLabel = "Lunch In";
    if (actionLabel === "UA") actionLabel = "University Activity";
    
    // Status information
    let statusClass, statusIcon, statusText;
    
    if (showingOrgRecords) {
        // For org records, all are considered synced
        statusClass = 'success';
        statusIcon = 'check-circle';
        statusText = 'Synced';
    } else {
        // Local record status
        statusClass = record.syncStatus === 'synced' ? 'success' : 'warning';
        statusIcon = record.syncStatus === 'synced' ? 'check-circle' : 'clock';
        statusText = record.syncStatus === 'synced' ? 'Synced' : 'Pending';
    }
    
    // Source info
    const sourceInfo = showingOrgRecords ? 
        `<div class="detail-item"><span class="label">Source:</span><span class="value record-source remote"><i class="fas fa-globe"></i> Server</span></div>` :
        `<div class="detail-item"><span class="label">Source:</span><span class="value record-source local"><i class="fas fa-laptop"></i> Local</span></div>`;
    
    // Build the modal content
    const detailsSection = detailsModal.querySelector('.record-details');
    if (detailsSection) {
        detailsSection.innerHTML = `
            <div class="detail-item">
                <span class="label">Name:</span>
                <span class="value">${record.firstName} ${record.lastName}</span>
            </div>
            <div class="detail-item">
                <span class="label">Action:</span>
                <span class="value">${actionLabel}</span>
            </div>
            <div class="detail-item">
                <span class="label">Date & Time:</span>
                <span class="value">${formattedDateTime}</span>
            </div>
            <div class="detail-item">
                <span class="label">Status:</span>
                <span class="value record-status ${statusClass}">
                    <i class="fas fa-${statusIcon}"></i>
                    ${statusText}
                </span>
            </div>
            ${sourceInfo}
            ${!showingOrgRecords && record.syncStatus === 'synced' && record.syncedAt ? `
            <div class="detail-item">
                <span class="label">Synced At:</span>
                <span class="value">${new Date(record.syncedAt).toLocaleString()}</span>
            </div>
            ` : ''}
            <div class="detail-item">
                <span class="label">ID:</span>
                <span class="value">${record.id || '(Server record)'}</span>
            </div>
        `;
    }
    
    // Configure modal actions
    const syncRecordBtn = detailsModal.querySelector('#sync-record-btn');
    if (syncRecordBtn) {
        // Only show sync button for local pending records
        if (!showingOrgRecords && record.syncStatus === 'pending') {
            syncRecordBtn.classList.remove('hidden');
            syncRecordBtn.onclick = () => syncSingleRecord(record);
        } else {
            syncRecordBtn.classList.add('hidden');
        }
    }
    
    // Show the modal
    detailsModal.classList.remove('hidden');
    setTimeout(() => {
        detailsModal.classList.add('visible');
    }, 10);
    
    // Set up close button
    const closeBtn = detailsModal.querySelector('.close-modal');
    const closeDetailsBtn = detailsModal.querySelector('#close-details-btn');
    
    const closeModal = () => {
        detailsModal.classList.remove('visible');
        setTimeout(() => {
            detailsModal.classList.add('hidden');
        }, 300);
    };
    
    if (closeBtn) closeBtn.onclick = closeModal;
    if (closeDetailsBtn) closeDetailsBtn.onclick = closeModal;
    
    // Click outside to close
    detailsModal.onclick = (event) => {
        if (event.target === detailsModal) closeModal();
    };
}

// Sync a single record
async function syncSingleRecord(record) {
    try {
        // Get the sync button and show loading state
        const syncBtn = document.querySelector('#sync-record-btn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
        }
        
        showStatus('Syncing record...', 'info');
        
        // Submit the record to Google Sheets
        await SheetsAPI.submitAttendance(record);
        
        // Update the record in IndexedDB
        await DB.updateSyncStatus(record.id, 'synced', new Date());
        
        // Update the pending counter
        await updatePendingRecordsCounter();
        
        showStatus('Record synced successfully', 'success');
        
        // Close the modal
        const modal = document.getElementById('record-details-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
        
        // Reload the history records
        loadHistoryRecords();
        
        return true;
    } catch (error) {
        console.error(`Error syncing record:`, error);
        showStatus(`Failed to sync: ${error.message}`, 'error');
        
        // Reset the sync button
        const syncBtn = document.querySelector('#sync-record-btn');
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fas fa-sync"></i> Retry';
        }
        
        return false;
    }
}

// Modified syncAllPendingRecords to use the shared button animation function
async function syncAllPendingRecords() {
    try {
        // Check if we're online
        if (!navigator.onLine) {
            showStatus('Cannot sync while offline. Please try again when online.', 'warning');
            return;
        }
        
        // Check if user is authenticated
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            // Show login modal if available
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.classList.remove('hidden');
                setTimeout(() => {
                    loginModal.classList.add('visible');
                }, 10);
            }
            showStatus('Please sign in to sync records', 'info');
            return;
        }
        
        // Get pending records count first
        const pendingRecords = await DB.getPendingRecords();
        
        if (pendingRecords.length === 0) {
            showStatus('No pending records to sync', 'info');
            return;
        }
        
        // Show animation on the sync button
        updateSyncButtonState(true);
        
        // Show status
        showStatus(`Syncing ${pendingRecords.length} pending records...`, 'info');
        
        // Track successful and failed records
        let successCount = 0;
        let failureCount = 0;
        
        // Process each record
        for (const record of pendingRecords) {
            try {
                // Submit the record
                await SheetsAPI.submitAttendance(record);
                
                // Mark as synced in local DB
                await DB.updateSyncStatus(record.id, 'synced', new Date());
                
                successCount++;
            } catch (error) {
                console.error(`Failed to sync record ${record.id}:`, error);
                failureCount++;
            }
        }
        
        // Update the badge counter
        await updatePendingRecordsCounter();
        
        // Reset the button state
        updateSyncButtonState(false);
        
        // Show completion status
        if (failureCount === 0) {
            showStatus(`Successfully synced ${successCount} records`, 'success');
        } else {
            showStatus(`Synced ${successCount} records, ${failureCount} failed`, 'warning');
        }
        
        // Reload history to reflect changes
        loadHistoryRecords();
    } catch (error) {
        console.error('Error syncing pending records:', error);
        showStatus(`Sync process error: ${error.message}`, 'error');
        
        // Reset the button state even on error
        updateSyncButtonState(false);
    }
}

// Initialize the employee section controls
document.addEventListener('DOMContentLoaded', function() {
    // Set up employee section controls
    const collapseEmployeeBtn = document.getElementById('collapse-employee-btn');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    const submitActionBtn = document.getElementById('submit-action-btn');
    
    // Hide employee section on collapse button click
    if (collapseEmployeeBtn) {
        collapseEmployeeBtn.addEventListener('click', hideEmployeeSection);
    }
    
    // Cancel button handler
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', function() {
            hideEmployeeSection();
            resetScan();
        });
    }
    
    // Submit button handler
    if (submitActionBtn) {
        submitActionBtn.addEventListener('click', submitAttendanceRecord);
    }
    
    // Make sure the employee section is hidden at startup
    hideEmployeeSection();
});

// Helper function to hide the employee section
function hideEmployeeSection() {
    const employeeSection = document.getElementById('employee-section');
    
    if (employeeSection) {
        employeeSection.classList.add('hidden');
        employeeSection.classList.remove('slide-in');
    }
}

// Function to reset scan after submission or cancel
function resetScan() {
    // Clear current employee data
    currentEmployeeData = null;
    
    // Clear any selected radio button
    const radios = document.querySelectorAll('input[name="time-action"]');
    radios.forEach(radio => radio.checked = false);
    
    // Clear hint text
    const hint = document.getElementById('action-hint');
    if (hint) {
        hint.textContent = '';
        hint.classList.remove('visible');
    }
    
    // Restart scanner
    window.QrScanner.startScanner();
}

// Updated function to fix animation issue
function updateSyncButtonState(isProcessing) {
  const syncAllBtn = document.getElementById('sync-all-btn');
  
  if (!syncAllBtn) {
    console.log("Button not found");
    return;
  }
  
  // Log to confirm function is being called
  console.log("Updating sync button state:", isProcessing);
  
  if (isProcessing) {
    // Store original HTML content including the badge
    if (!syncAllBtn.dataset.originalContent) {
      syncAllBtn.dataset.originalContent = syncAllBtn.innerHTML;
      console.log("Stored original content:", syncAllBtn.innerHTML);
    }
    
    // Apply animation - using both fa-spin class and explicit CSS animation
    syncAllBtn.disabled = true;
    syncAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="animation: fa-spin 2s linear infinite;"></i> Syncing...';
    console.log("Button state set to loading");
  } else {
    // Restore original state with badge
    syncAllBtn.disabled = false;
    
    if (syncAllBtn.dataset.originalContent) {
      syncAllBtn.innerHTML = syncAllBtn.dataset.originalContent;
      console.log("Restored original content");
    } else {
      syncAllBtn.innerHTML = '<i class="fas fa-sync"></i> Sync All Pending <span id="pending-count-badge" class="mini-badge">0</span>';
      console.log("Original content not found, using default");
    }
    
    // Update the badge counter
    updatePendingRecordsCounter();
  }
}

// Periodically refresh org records if showing org tab
function setupOrgRecordsAutoRefresh() {
    // Auto-refresh every 60 seconds if showing organization records
    const AUTO_REFRESH_INTERVAL = 60 * 1000; // 60 seconds
    
    // Clear any existing interval
    if (window.orgRefreshInterval) {
        clearInterval(window.orgRefreshInterval);
    }
    
    window.orgRefreshInterval = setInterval(() => {
        // Only refresh if we're viewing org records and the history tab is active
        const historyTab = document.getElementById('history-tab');
        if (showingOrgRecords && historyTab.classList.contains('active')) {
            console.log('Auto-refreshing organization records');
            
            // Clear cache to force refresh
            orgRecordsCache = null;
            lastOrgFetchTime = null;
            
            // Reload records
            loadHistoryRecords();
            
            // Update refresh button with a brief animation
            const refreshOrgBtn = document.getElementById('refresh-org-btn');
            if (refreshOrgBtn) {
                refreshOrgBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                setTimeout(() => {
                    refreshOrgBtn.innerHTML = '<i class="fas fa-sync"></i>';
                }, 1000);
            }
        }
    }, AUTO_REFRESH_INTERVAL);
}

// Add this function to update refresh timestamp
function updateLastRefreshTime() {
    const refreshTimeElem = document.getElementById('last-refresh-time');
    if (refreshTimeElem) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        refreshTimeElem.textContent = `Last updated: ${timeStr}`;
        refreshTimeElem.classList.add('pulse');
        setTimeout(() => refreshTimeElem.classList.remove('pulse'), 1000);
    }
}

// Initialize setup when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up History tab
    setupHistoryTab();
    
    // Add tab change listener to load history when switching to that tab
    const historyTabBtn = document.querySelector('[data-target="history-tab"]');
    if (historyTabBtn) {
        historyTabBtn.addEventListener('click', function() {
            // Always reset the org records cache if it's been more than 30 seconds
            if (showingOrgRecords && lastOrgFetchTime) {
                const thirtySecondsAgo = Date.now() - (30 * 1000);
                if (lastOrgFetchTime < thirtySecondsAgo) {
                    // Clear cache to force refresh
                    orgRecordsCache = null;
                    lastOrgFetchTime = null;
                }
            }
            
            loadHistoryRecords();
        });
    }
    
    // Set up organization records auto-refresh
    setupOrgRecordsAutoRefresh();
});

// Functions to handle auth UI updates
function updateUIForLoggedInUser() {
    // Update UI elements for logged in state
    const loginBtn = document.getElementById('login-btn');
    const userPanel = document.getElementById('user-panel');
    const userEmail = document.getElementById('user-email');
    const currentUser = firebase.auth().currentUser;
    
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userPanel) userPanel.classList.remove('hidden');
    
    // Update user info
    if (userEmail && currentUser) {
        userEmail.textContent = currentUser.email;
    }
    
    // Update avatar
    const avatarElement = document.querySelector('.user-avatar');
    if (avatarElement && currentUser) {
        if (currentUser.photoURL) {
            avatarElement.innerHTML = `<img src="${currentUser.photoURL}" alt="User avatar">`;
        } else {
            avatarElement.innerHTML = '<i class="fas fa-user-circle"></i>';
        }
    }
    
    // Mark body as authenticated
    document.body.classList.add('user-authenticated');
    document.body.classList.remove('user-unauthenticated');
    
    // Show organization records button if needed
    const orgRecordsBtn = document.getElementById('org-records-btn');
    if (orgRecordsBtn) {
        orgRecordsBtn.classList.remove('hidden');
    }
}

function updateUIForLoggedOutUser() {
    // Update UI elements for logged out state
    const loginBtn = document.getElementById('login-btn');
    const userPanel = document.getElementById('user-panel');
    
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userPanel) userPanel.classList.add('hidden');
    
    // Mark body as unauthenticated
    document.body.classList.remove('user-authenticated');
    document.body.classList.add('user-unauthenticated');
    
    // If showing org records, switch back to local records
    if (showingOrgRecords) {
        showingOrgRecords = false;
        const localRecordsBtn = document.getElementById('local-records-btn');
        const orgRecordsBtn = document.getElementById('org-records-btn');
        
        if (localRecordsBtn) localRecordsBtn.classList.add('active');
        if (orgRecordsBtn) {
            orgRecordsBtn.classList.remove('active');
            orgRecordsBtn.classList.add('hidden');
        }
        
        // Reload history records if on history tab
        const historyTab = document.getElementById('history-tab');
        if (historyTab && historyTab.classList.contains('active')) {
            loadHistoryRecords();
        }
    }
}