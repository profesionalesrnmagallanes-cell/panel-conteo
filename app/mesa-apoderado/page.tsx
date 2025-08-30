'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Declarar variables globales para que TypeScript no arroje errores
declare global {
  var __app_id: string;
  var __firebase_config: string;
  var __initial_auth_token: string;
}

// Configuración y variables globales proporcionadas por el entorno.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

export default function MesaRepPanel() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isVotingClosed, setIsVotingClosed] = useState(false);
  const [initialCount, setInitialCount] = useState(0); // Simula el conteo inicial
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Efecto para inicializar Firebase y manejar la autenticación
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          console.log("Usuario no autenticado, iniciando sesión anónimamente...");
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (e) {
            console.error("Error al iniciar sesión:", e);
            setError("Error de autenticación. No se pueden cargar los resultados.");
          }
        } else {
          console.log("Usuario autenticado. ID:", user.uid);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
      setError("Error al conectar con la base de datos.");
    }
  }, []);

  // Manejador del botón "Cerrar votación"
  const handleCloseVoting = () => {
    // Por ahora, solo actualizamos el estado local.
    // En el futuro, podríamos guardar esto en Firestore.
    setIsVotingClosed(true);
    setSuccessMessage("¡La votación ha sido cerrada con éxito!");
    setError(null);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-600 dark:text-blue-400 mb-6">Panel del Apoderado de Mesa</h1>
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Conteo Inicial de Votos</p>
          <p className="text-5xl font-extrabold text-blue-600 dark:text-blue-400">{initialCount}</p>
        </div>
        <button
          onClick={handleCloseVoting}
          disabled={isVotingClosed}
          className={`w-full py-3 px-6 text-white font-semibold rounded-lg shadow-lg transform transition-all duration-300
                     ${isVotingClosed ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 active:scale-95'}`}>
          {isVotingClosed ? 'Votación cerrada' : 'Cerrar la votación'}
        </button>
        {successMessage && (
          <div className="mt-4 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700 text-sm font-medium">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}