import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Parse Firebase service account JSON from .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

// Ensure private_key has proper newlines
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

// * Initialize Firebase Services
const database = admin.database();
const firestore = admin.firestore();
const auth = admin.auth();

// * RTDB Reference
const goatsRef = database.ref("Goats");

export { database, firestore, auth, goatsRef, admin };
