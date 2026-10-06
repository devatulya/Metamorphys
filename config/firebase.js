const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let isMock = false;

// Attempt to initialize Firebase Admin SDK
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[Firebase] Initialized with Service Account Key file.');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[Firebase] Initialized with Service Account JSON env var.');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    db = admin.firestore();
    console.log('[Firebase] Initialized with Application Default Credentials.');
  } else {
    throw new Error('No Firebase credentials found. Falling back to local offline mock database.');
  }
} catch (err) {
  console.log(`[Firebase] ${err.message}`);
  isMock = true;

  // Standalone high-performance in-memory collection store
  const collections = new Map();

  function getCollectionStore(colName) {
    if (!collections.has(colName)) {
      collections.set(colName, new Map());
    }
    return collections.get(colName);
  }

  db = {
    collection: (colName) => {
      const store = getCollectionStore(colName);

      return {
        doc: (docId) => ({
          get: async () => {
            const data = store.get(docId);
            return {
              exists: !!data,
              id: docId,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
            };
          },
          set: async (data, options = {}) => {
            const existing = options.merge ? store.get(docId) || {} : {};
            const updated = { ...existing, ...data, id: docId };
            store.set(docId, updated);
            return { id: docId };
          },
          update: async (data) => {
            const existing = store.get(docId);
            if (!existing) throw new Error(`Document ${docId} not found in ${colName}`);
            const updated = { ...existing, ...data };
            store.set(docId, updated);
            return { id: docId };
          },
          delete: async () => {
            store.delete(docId);
            return true;
          }
        }),

        add: async (data) => {
          const docId = data.id || require('uuid').v4();
          const record = { ...data, id: docId };
          store.set(docId, record);
          return {
            id: docId,
            get: async () => ({
              exists: true,
              id: docId,
              data: () => JSON.parse(JSON.stringify(record))
            })
          };
        },

        get: async () => {
          const docs = Array.from(store.values()).map((record) => ({
            id: record.id,
            exists: true,
            data: () => JSON.parse(JSON.stringify(record))
          }));
          return {
            empty: docs.length === 0,
            size: docs.length,
            docs
          };
        },

        where: function (field, op, value) {
          const allDocs = Array.from(store.values());
          const filtered = allDocs.filter((doc) => {
            const val = doc[field];
            if (op === '==') return val === value;
            if (op === '>=') return val >= value;
            if (op === '<=') return val <= value;
            if (op === '!=') return val !== value;
            return true;
          });

          return {
            get: async () => ({
              empty: filtered.length === 0,
              size: filtered.length,
              docs: filtered.map((record) => ({
                id: record.id,
                exists: true,
                data: () => JSON.parse(JSON.stringify(record))
              }))
            })
          };
        }
      };
    }
  };
}

module.exports = {
  db,
  isMock
};
