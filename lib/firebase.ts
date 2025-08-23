// FILE: lib/firebase.ts

// Inicializa Firebase con TU proyecto (conteo-en-vivo) y expone Firestore.
// Ya viene con tu apiKey y projectId. No necesitas variables de entorno.

import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMzhSn3k1J_5yAR9vIh_thaKPre7n8DUw",
  authDomain: "conteo-en-vivo.firebaseapp.com",
  projectId: "conteo-en-vivo",
  // Estos campos son opcionales para este panel:
  // storageBucket, messagingSenderId, appId
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
