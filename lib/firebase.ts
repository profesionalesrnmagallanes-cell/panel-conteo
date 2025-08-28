// FILE: lib/firebase.ts

// Inicializa Firebase con tu proyecto (conteo-en-vivo) y expone Firestore.
// Ya viene con tu apiKey y projectId. No necesitas variables de entorno.

import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMzhSn3k1J_5yAR9vIh_thaKPre7n8DUw",
  authDomain: "conteo-en-vivo.firebaseapp.com",
  projectId: "conteo-en-vivo",
  storageBucket: "conteo-en-vivo.firebasestorage.app",
  messagingSenderId: "904608064786",
  appId: "1:904608064786:web:134286ae96c14187087fcb",
  measurementId: "G-6ENPEC81RD"
};

// Se asegura de que la app solo se inicialice una vez
export const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
