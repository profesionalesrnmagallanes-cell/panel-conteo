"use client";

import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, User } from "firebase/auth";
import { getFirestore, onSnapshot, collection, query, Firestore } from "firebase/firestore";

// Declarar variables globales para que TypeScript no arroje errores en el entorno
declare global {
  var __app_id: string;
  var __firebase_config: string;
  var __initial_auth_token: string;
}

// Configuración y variables globales proporcionadas por el entorno.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Definir el tipo para el registro de votos
interface Voto {
  opcion: string;
}

export default function ResultadosPage() {
  const [votos, setVotos] = useState<Voto[]>([]);
  const [conteo, setConteo] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<Firestore | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Efecto 1: Inicializa Firebase y maneja la autenticación
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);
      setDb(firestore);

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setAuthReady(true);
        } else {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(auth, initialAuthToken);
            } else {
              await signInAnonymously(auth);
            }
          } catch (e) {
            console.error("Error al iniciar sesión:", e);
          }
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
    }
  }, []);

  // Efecto 2: Escucha los registros de votos en tiempo real
  useEffect(() => {
    if (!db || !authReady) return;

    const collectionPath = `/artifacts/${appId}/public/data/votos`;
    const q = query(collection(db, collectionPath));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conteoVotos: { [key: string]: number } = {};
      const nuevosVotos: Voto[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Voto;
        nuevosVotos.push({ ...data, id: doc.id } as Voto);
        conteoVotos[data.opcion] = (conteoVotos[data.opcion] || 0) + 1;
      });
      setVotos(nuevosVotos);
      setConteo(conteoVotos);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener votos:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db, authReady]);
  
  if (!authReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center font-inter">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xl text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Conteo de Votos</h1>
        <p className="text-gray-500 mb-6">Resultados en tiempo real</p>
        
        {Object.keys(conteo).length === 0 ? (
          <div className="text-gray-400">Aún no hay votos registrados.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(conteo).sort().map(([opcion, cantidad]) => (
              <div 
                key={opcion} 
                className="bg-blue-100 text-blue-800 p-4 rounded-lg flex justify-between items-center"
              >
                <span className="font-medium text-lg">{opcion}</span>
                <span className="font-bold text-2xl">{cantidad}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}