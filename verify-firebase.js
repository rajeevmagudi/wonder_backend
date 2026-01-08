const admin = require('firebase-admin');
require('dotenv').config();

console.log('Testing Firebase Admin initialization...');

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            })
        });
        console.log('✅ Firebase Admin initialized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error);
        process.exit(1);
    }
} else {
    console.error('❌ Missing environment variables');
    process.exit(1);
}
