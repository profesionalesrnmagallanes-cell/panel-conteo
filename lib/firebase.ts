import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMzSn3k1J_5yAR9vIh_thaKPre7n8DUw",
  authDomain: "conteo-en-vivo.firebaseapp.com",
  projectId: "conteo-en-vivo",
  storageBucket: "conteo-en-vivo.appspot.com",
  messagingSenderId: "904608064786",
  appId: "1:904608064786:web:134286ae96c14187887fcb",
  measurementId: "G-6EN8PEC81R"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
