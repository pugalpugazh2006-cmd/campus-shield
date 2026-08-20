const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

require('dotenv').config({ path: 'apps/backend/.env' });

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function test() {
  try {
    const snapshot = await db.collection('incidents')
      .where('campusId', '==', 'main')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    console.log('Success, found ' + snapshot.size + ' docs');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
