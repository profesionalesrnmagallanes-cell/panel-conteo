'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, onSnapshot, collection, query, where, doc, Firestore, getDoc, setDoc, setLogLevel, DocumentData } from "firebase/firestore";

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

// Definir el tipo para la información del apoderado de mesa
interface TableRepInfo {
  name: string;
  email: string;
  localId: string;
  mesa: string;
}

export default function TableRepPanel() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [repInfo, setRepInfo] = useState<TableRepInfo | null>(null);
  const [voteRecord, setVoteRecord] = useState<VoteRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para el formulario de votos
  const [optionA, setOptionA] = useState<string>('');
  const [optionB, setOptionB] = useState<string>('');
  const [nullVotes, setNullVotes] = useState<string>('');
  const [blankVotes, setBlankVotes] = useState<string>('');

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

  // Efecto 2: Obtiene la información del apoderado a partir de su email
  useEffect(() => {
    if (!db || !isAuthReady || !currentUserEmail) {
      return;
    }

    const repDocRef = doc(db, `/artifacts/${appId}/public/data/table_reps`, currentUserEmail);
    
    const unsubscribe = onSnapshot(repDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRepInfo({
          name: data.name,
          email: data.email,
          localId: data.localId,
          mesa: data.mesa
        });
        setLoading(false);
      } else {
        setError("No se pudo encontrar su registro como apoderado de mesa. Por favor, contacte al Administrador de Local.");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error al obtener la información del apoderado:", err);
      setError("Error al cargar su información. Por favor, intente recargar la página.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, currentUserEmail]);

  // Efecto 3: Escucha el registro de votos para la mesa asignada
  useEffect(() => {
    if (!db || !isAuthReady || !repInfo) {
      return;
    }

    const q = query(collection(db, `/artifacts/${appId}/public/data/votes`), 
                    where('localId', '==', repInfo.localId),
                    where('mesa', '==', repInfo.mesa));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data() as VoteRecord;
        setVoteRecord({
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : new Date(),
        });
      } else {
        setVoteRecord(null);
      }
    }, (err) => {
      console.error("Error al obtener el registro de votos:", err);
    });
    
    return () => unsubscribe();
  }, [db, isAuthReady, repInfo]);

  // Manejador del formulario de registro de votos
  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !repInfo) {
      setError("Base de datos no disponible o información de apoderado no cargada.");
      return;
    }

    const a = parseInt(optionA) || 0;
    const b = parseInt(optionB) || 0;
    const n = parseInt(nullVotes) || 0;
    const bl = parseInt(blankVotes) || 0;
    const total = a + b + n + bl;
    
    if (total <= 0) {
      setError('El total de votos debe ser mayor que cero.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const voteDocRef = doc(db, `/artifacts/${appId}/public/data/votes`, `${repInfo.localId}-${repInfo.mesa}`);

    try {
      const docSnap = await getDoc(voteDocRef);
      // Corrección: se define 'existingData' de manera segura antes de usarla
      const existingData = docSnap.exists() ? docSnap.data() as VoteRecord : null;

      if (existingData) {
        if (existingData.optionA === a && existingData.optionB === b && existingData.nullVotes === n && existingData.blankVotes === bl) {
          setSuccessMessage('El registro de votos ya existe y es idéntico. No se realizaron cambios.');
          setIsSubmitting(false);
          return;
        }
      }

      await setDoc(voteDocRef, {
        mesa: repInfo.mesa,
        localId: repInfo.localId,
        optionA: a,
        optionB: b,
        nullVotes: n,
        blankVotes: bl,
        totalVotes: total,
        // Corrección: se accede a la propiedad 'createdAt' de 'existingData' solo si existe
        createdAt: existingData?.createdAt || new Date(),
        updatedAt: new Date(),
        createdBy: repInfo.email,
      });

      setSuccessMessage('Votos registrados con éxito!');
      console.log('Votos registrados:', { a, b, n, bl });
    } catch (e) {
      console.error("Error al registrar los votos:", e);
      setError("Error al registrar los votos. Inténtelo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = !repInfo || isSubmitting;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Panel de Apoderado de Mesa</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido, {repInfo?.name || 'Apoderado'}. Ingresa los votos de tu mesa a continuación.
        </p>
        
        {/* Información del apoderado */}
        <div className="text-sm text-gray-500 mb-4 text-center space-y-1">
            <p>ID del Usuario: {currentUserEmail || 'Cargando...'}</p>
            <p>Local de Votación: **{repInfo?.localId || 'Cargando...'}**</p>
            <p>Mesa Asignada: **{repInfo?.mesa || 'Cargando...'}**</p>
        </div>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        {loading || !repInfo ? (
          <p className="text-center text-gray-500">Cargando información del apoderado...</p>
        ) : (
          <>
            {/* Formulario de ingreso de votos */}
            <div className="mb-8 p-6 bg-green-50 dark:bg-green-900 rounded-xl shadow-inner">
              <h2 className="text-2xl font-bold mb-4 text-center">Ingreso de Votos</h2>
              <form onSubmit={handleVoteSubmit} className="space-y-4">
                <div>
                  <label htmlFor="optionA" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Votos Opción A:
                  </label>
                  <input
                    type="number"
                    id="optionA"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    min="0"
                    required
                    disabled={isFormDisabled}
                  />
                </div>
                <div>
                  <label htmlFor="optionB" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Votos Opción B:
                  </label>
                  <input
                    type="number"
                    id="optionB"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    min="0"
                    required
                    disabled={isFormDisabled}
                  />
                </div>
                <div>
                  <label htmlFor="nullVotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Votos Nulos:
                  </label>
                  <input
                    type="number"
                    id="nullVotes"
                    value={nullVotes}
                    onChange={(e) => setNullVotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    min="0"
                    required
                    disabled={isFormDisabled}
                  />
                </div>
                <div>
                  <label htmlFor="blankVotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Votos en Blanco:
                  </label>
                  <input
                    type="number"
                    id="blankVotes"
                    value={blankVotes}
                    onChange={(e) => setBlankVotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    min="0"
                    required
                    disabled={isFormDisabled}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isFormDisabled || isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Votos'}
                </button>
              </form>
            </div>

            {/* Dashboard de Resumen de Votos (si ya se han registrado) */}
            {voteRecord && (
              <div className="p-6 bg-gray-100 dark:bg-gray-700 rounded-xl shadow">
                <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 dark:text-gray-200">
                  Votos registrados para la mesa {voteRecord.mesa}
                </h2>
                <div className="grid grid-cols-2 gap-4 text-center text-gray-600 dark:text-gray-300">
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                    <p className="text-lg font-bold">Opción A</p>
                    <p className="text-2xl font-extrabold text-green-600">{voteRecord.optionA}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                    <p className="text-lg font-bold">Opción B</p>
                    <p className="text-2xl font-extrabold text-green-600">{voteRecord.optionB}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                    <p className="text-lg font-bold">Votos Nulos</p>
                    <p className="text-2xl font-extrabold text-gray-500">{voteRecord.nullVotes}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                    <p className="text-lg font-bold">Votos en Blanco</p>
                    <p className="text-2xl font-extrabold text-gray-500">{voteRecord.blankVotes}</p>
                  </div>
                  <div className="col-span-2 bg-green-500 text-white p-4 rounded-lg shadow-sm">
                    <p className="text-lg font-bold">Total de Votos</p>
                    <p className="text-3xl font-extrabold">{voteRecord.totalVotes}</p>
                  </div>
                </div>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                  Última actualización: {voteRecord.updatedAt?.toLocaleString()}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}