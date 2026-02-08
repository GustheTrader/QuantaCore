
import { TaskAttachment } from "../types";

const DB_NAME = 'QuantaStorageBucket';
const STORE_NAME = 'files';

// Initialize IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const uploadToBucket = async (file: File): Promise<TaskAttachment> => {
  const id = `file_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();
  
  // 1. Write to Local Machine (IndexedDB)
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const fileData = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    data: file, // Storing the Blob directly
    timestamp
  };
  
  store.put(fileData);
  
  // 2. Simulate S3 Replication (Latency)
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    localUrl: URL.createObjectURL(file), // Immediate access
    s3Url: `s3://quanta-user-bucket/assets/${timestamp}/${file.name}`,
    synced: true
  };
};

export const getFileFromBucket = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
    request.onerror = () => resolve(null);
  });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
