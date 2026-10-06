const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let isMock = false;

const PROJECT_ID = 'metamorphys-6efd5';

// Attempt to initialize Firebase Admin SDK using Service Account Credentials
try {
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  } else if (fs.existsSync(path.resolve(__dirname, '../firebase-key.json'))) {
    serviceAccount = require(path.resolve(__dirname, '../firebase-key.json'));
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID
    });
    db = admin.firestore();
    console.log(`[Firebase] Initialized Admin SDK with Service Account Key for project "${PROJECT_ID}".`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: PROJECT_ID
    });
    db = admin.firestore();
    console.log(`[Firebase] Initialized Admin SDK with Application Default Credentials for project "${PROJECT_ID}".`);
  } else {
    throw new Error(`No Firebase service account key found (placed as firebase-key.json or via env). Falling back to standalone mock database engine.`);
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
  isMock,
  projectId: PROJECT_ID
};
