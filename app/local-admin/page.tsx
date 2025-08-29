'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, onSnapshot, collection, query, where, doc, Firestore, getDoc, setLogLevel, DocumentData } from "firebase/firestore";

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
  mesa: string;
  localId: string;
  optionA: number;
  optionB: number;
  nullVotes: number;
  blankVotes: number;
  totalVotes: number;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

// Definir el tipo para la información del administrador de local
interface LocalAdminInfo {
  name: string;
  email: string;
  localId: string;
}

export default function LocalAdminPanel() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<LocalAdminInfo | null>(null);
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);

  // Estados para el resumen de votos
  const [totalOptionA, setTotalOptionA] = useState(0);
  const [totalOptionB, setTotalOptionB] = useState(0);
  const [totalNull, setTotalNull] = useState(0);
  const [totalBlank, setTotalBlank] = useState(0);
  const [totalVotos, setTotalVotos] = useState(0);

  // Efecto 1: Inicializa Firebase y maneja la autenticación.
  useEffect(() => {
    try {
      setLogLevel('debug');
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          console.log("Usuario no autenticado, iniciando sesión anónimamente...");
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } else {
          setCurrentUserEmail(user.email);
          console.log("Usuario autenticado. Email:", user.email);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
      setError("Error al conectar con la base de datos.");
      setLoading(false);
    }
  }, []);

  // Efecto 2: Obtiene la información del administrador a partir de su email
  useEffect(() => {
    if (!db || !isAuthReady || !currentUserEmail) {
      return;
    }

    const adminDocRef = doc(db, `/artifacts/${appId}/public/data/local_admins`, currentUserEmail);
    
    const unsubscribe = onSnapshot(adminDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAdminInfo({
          name: data.name,
          email: data.email,
          localId: data.localId
        });
        setLoading(false);
      } else {
        setError("No se pudo encontrar su registro como administrador de local. Por favor, contacte al Administrador General.");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error al obtener la información del administrador:", err);
      setError("Error al cargar su información. Por favor, intente recargar la página.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, currentUserEmail]);

  // Efecto 3: Escucha los registros de votos para el local asignado
  useEffect(() => {
    if (!db || !isAuthReady || !adminInfo) {
      return;
    }

    const q = query(collection(db, `/artifacts/${appId}/public/data/votes`), 
                    where('localId', '==', adminInfo.localId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let records: VoteRecord[] = [];
      let sumA = 0;
      let sumB = 0;
      let sumNull = 0;
      let sumBlank = 0;
      let sumTotal = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data() as VoteRecord;
        records.push(data);
        sumA += data.optionA;
        sumB += data.optionB;
        sumNull += data.nullVotes;
        sumBlank += data.blankVotes;
        sumTotal += data.totalVotes;
      });

      setVoteRecords(records);
      setTotalOptionA(sumA);
      setTotalOptionB(sumB);
      setTotalNull(sumNull);
      setTotalBlank(sumBlank);
      setTotalVotos(sumTotal);

      console.log('Votos consolidados actualizados:', { sumA, sumB, sumNull, sumBlank });
    }, (err) => {
      console.error("Error al obtener los registros de votos:", err);
      setError("Error al cargar los registros de votos. Intente recargar la página.");
    });
    
    return () => unsubscribe();
  }, [db, isAuthReady, adminInfo]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Panel de Administración de Local</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido, {adminInfo?.name || 'Administrador'}. Monitorea el conteo de votos de todas las mesas de tu local en tiempo real.
        </p>

        {/* Información del administrador */}
        <div className="text-sm text-gray-500 mb-4 text-center space-y-1">
            <p>ID del Usuario: {currentUserEmail || 'Cargando...'}</p>
            <p>Local de Votación: **{adminInfo?.localId || 'Cargando...'}**</p>
        </div>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {loading || !adminInfo ? (
          <p className="text-center text-gray-500">Cargando información del administrador...</p>
        ) : (
          <>
            {/* Dashboard de Resumen Consolidado */}
            <div className="mb-8 p-6 bg-green-50 dark:bg-green-900 rounded-xl shadow-inner">
              <h2 className="text-2xl font-bold mb-4 text-center">Resumen Consolidado de Votos</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center text-gray-600 dark:text-gray-300">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Opción A</p>
                  <p className="text-2xl font-extrabold text-green-600">{totalOptionA}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Opción B</p>
                  <p className="text-2xl font-extrabold text-green-600">{totalOptionB}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos Nulos</p>
                  <p className="text-2xl font-extrabold text-gray-500">{totalNull}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                  <p className="text-sm font-medium">Votos en Blanco</p>
                  <p className="text-2xl font-extrabold text-gray-500">{totalBlank}</p>
                </div>
              </div>
              <div className="mt-4 bg-green-600 text-white p-4 rounded-lg shadow-sm text-center">
                <p className="text-lg font-bold">Total de Votos Reportados</p>
                <p className="text-3xl font-extrabold">{totalVotos}</p>
              </div>
            </div>

            {/* Tabla de Votos por Mesa */}
            <h2 className="text-2xl font-bold mb-4 text-center">Detalle por Mesa</h2>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="min-w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="py-2 px-4 text-left text-sm font-medium">Mesa</th>
                    <th className="py-2 px-4 text-center text-sm font-medium">Opción A</th>
                    <th className="py-2 px-4 text-center text-sm font-medium">Opción B</th>
                    <th className="py-2 px-4 text-center text-sm font-medium">Nulos</th>
                    <th className="py-2 px-4 text-center text-sm font-medium">Blancos</th>
                    <th className="py-2 px-4 text-center text-sm font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {voteRecords.length > 0 ? (
                    voteRecords.map((record, index) => (
                      <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2 px-4 text-left text-sm font-medium">{record.mesa}</td>
                        <td className="py-2 px-4 text-center text-sm">{record.optionA}</td>
                        <td className="py-2 px-4 text-center text-sm">{record.optionB}</td>
                        <td className="py-2 px-4 text-center text-sm">{record.nullVotes}</td>
                        <td className="py-2 px-4 text-center text-sm">{record.blankVotes}</td>
                        <td className="py-2 px-4 text-center text-sm font-bold">{record.totalVotes}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-500">No hay votos registrados para este local aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}