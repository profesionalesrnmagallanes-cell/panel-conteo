'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, onSnapshot, collection, query, Firestore } from "firebase/firestore";

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

// Definir el tipo para el registro de votos
interface VoteRecord {
  optionA: number;
  optionB: number;
  nullVotes: number;
  blankVotes: number;
  totalVotes: number;
}

export default function PublicResults() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalOptionA, setTotalOptionA] = useState(0);
  const [totalOptionB, setTotalOptionB] = useState(0);
  const [totalNull, setTotalNull] = useState(0);
  const [totalBlank, setTotalBlank] = useState(0);
  const [totalGeneral, setTotalGeneral] = useState(0);

  // Efecto 1: Inicializa Firebase y maneja la autenticación anónima.
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (e) {
            console.error("Error al iniciar sesión anónima:", e);
            setError("Error de autenticación. No se pueden cargar los resultados.");
          }
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
      setError("Error al conectar con la base de datos.");
      setLoading(false);
    }
  }, []);

  // Efecto 2: Escucha todos los registros de votos para la consolidación total
  useEffect(() => {
    if (!db) return;

    const votesCollection = collection(db, `/artifacts/${appId}/public/data/votes`);
    const q = query(votesCollection);
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let sumA = 0;
      let sumB = 0;
      let sumNull = 0;
      let sumBlank = 0;
      
      querySnapshot.forEach(doc => {
        const data = doc.data() as VoteRecord;
        sumA += data.optionA;
        sumB += data.optionB;
        sumNull += data.nullVotes;
        sumBlank += data.blankVotes;
      });

      setTotalOptionA(sumA);
      setTotalOptionB(sumB);
      setTotalNull(sumNull);
      setTotalBlank(sumBlank);
      setTotalGeneral(sumA + sumB + sumNull + sumBlank);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los registros de votos:", err);
      setError("Error al cargar los resultados. Intente recargar la página.");
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [db]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Resultados Oficiales</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Conteo de votos consolidado en tiempo real.
        </p>

        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-center text-gray-500">Cargando resultados...</p>
        ) : (
          <>
            {/* Dashboard de Resumen Consolidado */}
            <div className="mb-8 p-6 bg-green-50 dark:bg-green-900 rounded-xl shadow-inner">
              <h2 className="text-2xl font-bold mb-4 text-center">Resumen de Votos</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center text-gray-600 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Opción A</p>
                  <p className="text-2xl font-extrabold text-green-600">{totalOptionA.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Opción B</p>
                  <p className="text-2xl font-extrabold text-green-600">{totalOptionB.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Nulos</p>
                  <p className="text-2xl font-extrabold text-gray-500">{totalNull.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos en Blanco</p>
                  <p className="text-2xl font-extrabold text-gray-500">{totalBlank.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 bg-green-600 text-white p-4 rounded-lg shadow-sm text-center">
                <p className="text-lg font-bold">TOTAL GENERAL DE VOTOS</p>
                <p className="text-3xl font-extrabold">{totalGeneral.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Sección de visualización de gráficos */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-xl shadow-inner">
              <h2 className="text-2xl font-bold mb-4 text-center">Resumen Visual</h2>
              <div className="space-y-4">
                {/* Gráfico de barra para Opción A */}
                <div className="flex items-center space-x-4">
                  <span className="w-1/4 text-sm font-medium">Opción A</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-8 overflow-hidden relative">
                    <div
                      style={{ width: `${totalGeneral > 0 ? (totalOptionA / totalGeneral) * 100 : 0}%` }}
                      className="bg-green-600 h-full rounded-full transition-all duration-500 ease-out"
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      {totalOptionA.toLocaleString()} votos
                    </span>
                  </div>
                </div>

                {/* Gráfico de barra para Opción B */}
                <div className="flex items-center space-x-4">
                  <span className="w-1/4 text-sm font-medium">Opción B</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-8 overflow-hidden relative">
                    <div
                      style={{ width: `${totalGeneral > 0 ? (totalOptionB / totalGeneral) * 100 : 0}%` }}
                      className="bg-green-600 h-full rounded-full transition-all duration-500 ease-out"
                    ></div>
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      {totalOptionB.toLocaleString()} votos
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}