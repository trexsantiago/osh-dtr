// Google Sheets API Interface - Handles communication with Google Sheets via Apps Script

const SheetsAPI = {
  // Update with your deployment URL
  SHEET_URL: "https://script.google.com/a/macros/wpu.edu.ph/s/AKfycbyTdj6G2LWSPdXgvqvzLzaHqJ8r_Nx0YlW46WDObW0wHVGnmDAzYSWhfkTA9wWcceeW/exec",

  async submitAttendance(record) {
    return new Promise((resolve, reject) => {
      try {
        // Verify we're logged in
        if (!firebase.auth().currentUser) {
          reject(new Error("Must be logged in to sync records"));
          return;
        }

        // Get the current user's email (timekeeper)
        const userEmail = firebase.auth().currentUser.email;
        
        // Create a unique callback function name
        const callbackName = "jsonpCallback_" + Math.round(Math.random() * 1000000);

        // Define the callback function that will handle the response
        window[callbackName] = function (response) {
          // Clean up - remove the script tag and delete the global callback function
          document.body.removeChild(scriptElement);
          delete window[callbackName];

          if (response && response.status === "success") {
            resolve(response);
          } else {
            reject(new Error(response?.message || "Unknown error"));
          }
        };

        // Build URL with parameters
        const url = new URL(this.SHEET_URL);
        
        // Add the callback parameter for JSONP
        url.searchParams.append("callback", callbackName);
        
        // Add authorization header via URL param
        const idToken = firebase.auth().currentUser.uid;
        url.searchParams.append("Authorization", `Bearer ${idToken}`);
        
        // IMPORTANT: Fix parameter name to match what Apps Script expects
        url.searchParams.append("timestamp", record.timestamp);
        url.searchParams.append("timekeeperEmail", userEmail);
        url.searchParams.append("action", record.actionLabel);
        url.searchParams.append("lastName", record.lastName);
        url.searchParams.append("firstName", record.firstName);

        // Create script element for JSONP request
        const scriptElement = document.createElement("script");
        scriptElement.src = url.toString();
        
        // Handle script load errors
        scriptElement.onerror = function () {
          document.body.removeChild(scriptElement);
          delete window[callbackName];
          reject(new Error("Failed to load the JSONP request"));
        };

        // Add the script element to the page to start the request
        document.body.appendChild(scriptElement);
      } catch (error) {
        console.error("Error in submitAttendance:", error);
        reject(error);
      }
    });
  },

  // Helper method to sync multiple records
  async syncBatch(records) {
    const results = [];
    // Process one by one to avoid overwhelming the server
    for (const record of records) {
      try {
        await this.submitAttendance(record);
        results.push({ id: record.id, success: true });
      } catch (error) {
        console.error(`Error syncing record ${record.id}:`, error);
        results.push({ id: record.id, success: false, error });
      }
    }
    return results;
  },

  // Add this method to your SheetsAPI object in sheets-api.js
  async fetchRecords() {
    return new Promise((resolve, reject) => {
        try {
            // Verify we're logged in
            if (!firebase.auth().currentUser) {
                reject(new Error("Must be logged in to fetch records"));
                return;
            }

            // Get the current user's email (timekeeper)
            const userEmail = firebase.auth().currentUser.email;
            
            // Create a unique callback function name
            const callbackName = "jsonpCallback_" + Math.round(Math.random() * 1000000);

            // Define the callback function that will handle the response
            window[callbackName] = function(response) {
                // Clean up - remove the script tag and delete the global callback function
                document.body.removeChild(scriptElement);
                delete window[callbackName];

                if (response && response.status === "success") {
                    resolve({
                        status: "success",
                        records: response.records || []
                    });
                } else {
                    reject(new Error(response?.message || "Failed to fetch records"));
                }
            };

            // Prepare the query parameters
            const params = new URLSearchParams({
                operation: 'fetch', // New operation for fetching records
                callback: callbackName,
                email: userEmail
            });

            // Create a script element to fetch data via JSONP
            const scriptElement = document.createElement('script');
            scriptElement.src = `${this.SHEET_URL}?${params.toString()}`;
            document.body.appendChild(scriptElement);
        } catch (error) {
            reject(error);
        }
    });
  }
};

// Export the API object globally
window.SheetsAPI = SheetsAPI;