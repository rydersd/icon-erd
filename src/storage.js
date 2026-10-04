// A separate database keeps the old draft's saved library intact without loading it at launch.
export function createStorage(indexedDB = globalThis.indexedDB) {
  const storage = {
    db: null, failed: null,
    open() {
      return new Promise(resolve => {
        try {
          const request = indexedDB.open('glyph-workbench-open', 2);
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots', { keyPath: 'id' });
            if (!request.result.objectStoreNames.contains('edits')) request.result.createObjectStore('edits', { keyPath: 'name' });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => { storage.failed = request.error; resolve(null); };
          request.onblocked = () => resolve(null);
        } catch (error) { storage.failed = error; resolve(null); }
      });
    },
    run(mode, fn, storeName = 'edits', extraStores = []) {
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = storage.db.transaction([storeName, ...extraStores], mode);
          const request = fn(tx.objectStore(storeName), tx);
          tx.oncomplete = () => resolve(request && 'result' in request ? request.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        } catch (error) { try { tx?.abort(); } catch {} reject(error); }
      });
    },
  };
  return storage;
}
