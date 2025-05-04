// Database Controller - Handles IndexedDB operations for offline storage

const DB = {
  db: null,
  DB_NAME: "osh-dtr-db",
  STORE_NAME: "attendanceRecords",

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });          
          store.createIndex("lastName", "lastName", { unique: false });
          store.createIndex("firstName", "firstName", { unique: false });
          store.createIndex("action", "action", { unique: false });
          store.createIndex("syncStatus", "syncStatus", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };
    });
  },

  async saveRecord(record) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
        const store = transaction.objectStore(this.STORE_NAME);

        // Set status to pending by default - safer for offline use
        const recordToSave = {
          ...record,
          syncStatus: "pending",
          createdAt: new Date().toISOString()
        };

        const request = store.add(recordToSave);

        request.onsuccess = (event) => {
          resolve({ ...recordToSave, id: event.target.result });
        };

        request.onerror = (event) => {
          console.error("Error saving record:", event.target.error);
          reject(new Error("Failed to save record to IndexedDB"));
        };
        
        transaction.onerror = (event) => {
          console.error("Transaction error:", event.target.error);
          reject(new Error("Database transaction failed"));
        };
      } catch (error) {
        console.error("Error in saveRecord:", error);
        reject(error);
      }
    });
  },

  async getPendingRecords() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const index = store.index('syncStatus');
        const request = index.getAll('pending');
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
        
        request.onerror = (event) => {
          console.error("Error getting pending records:", event.target.error);
          reject(new Error("Failed to get pending records from IndexedDB"));
        };
      } catch (error) {
        console.error("Error in getPendingRecords:", error);
        reject(error);
      }
    });
  },

  async updateSyncStatus(id, status) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const getRequest = store.get(id);

      getRequest.onsuccess = (event) => {
        const record = event.target.result;
        if (record) {
          record.syncStatus = status;
          const updateRequest = store.put(record);

          updateRequest.onsuccess = () => {
            resolve(record);
          };

          updateRequest.onerror = (event) => {
            console.error("Error updating record:", event.target.error);
            reject(new Error("Failed to update record in IndexedDB"));
          };
        } else {
          reject(new Error("Record not found"));
        }
      };

      getRequest.onerror = (event) => {
        console.error("Error getting record:", event.target.error);
        reject(new Error("Failed to get record from IndexedDB"));
      };
    });
  },

  async getPendingCount() {
    const pendingRecords = await this.getPendingRecords();
    return pendingRecords.length;
  },

  async getAllRecords() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
        
        request.onerror = (event) => {
          console.error("Error getting records:", event.target.error);
          reject(new Error("Failed to get records from IndexedDB"));
        };
      } catch (error) {
        console.error("Error in getAllRecords:", error);
        reject(error);
      }
    });
  },
};

// Export the DB object globally
window.DB = DB;