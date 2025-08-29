'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, onSnapshot, collection, query, where, doc, Firestore, setDoc, getDoc, setLogLevel } from "firebase/firestore";

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

// Tipos de datos para el apoderado de mesa
interface TableRep {
  id: string;
  name: string;
  email: string;
  localId: string;
  mesa: string;
  createdAt: any;
}

export default function LocalAdminPanel() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [localAdminData, setLocalAdminData] = useState<{ local: string, comuna: string, region: string } | null>(null);
  
  const [tableReps, setTableReps] = useState<TableRep[]>([]);
  const [selectedMesa, setSelectedMesa] = useState('all');
  const [mesas, setMesas] = useState<string[]>([]);
  
  // Estado para el formulario de registro de apoderado
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [repMesa, setRepMesa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          setCurrentUserId(user.uid);
          console.log("Usuario autenticado. ID:", user.uid);
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

  // Efecto 2: Obtiene el local y otros datos del administrador.
  useEffect(() => {
    if (!db || !isAuthReady || !currentUserId) {
      return;
    }
    const adminDocRef = doc(db, `/artifacts/${appId}/public/data/local_admins`, currentUserId);
    
    const unsubscribe = onSnapshot(adminDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().local) {
        setLocalAdminData(docSnap.data() as { local: string, comuna: string, region: string });
      } else {
        setError("No se pudo encontrar el local de votación asignado para este usuario. Por favor, contacte al Administrador Comunal.");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error al obtener el documento del administrador de local:", err);
      setError("Error al cargar la información del local.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, currentUserId]);

  // Efecto 3: Obtiene los apoderados de mesa del local asignado.
  useEffect(() => {
    if (!db || !isAuthReady || !localAdminData?.local) {
      return;
    }

    const repsCollectionRef = collection(db, `/artifacts/${appId}/public/data/table_reps`);
    const q = query(repsCollectionRef, where('localId', '==', localAdminData.local));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const repsList: TableRep[] = [];
      const uniqueMesas = new Set<string>();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const repData: TableRep = {
          id: doc.id,
          name: data.name,
          email: data.email,
          localId: data.localId,
          mesa: data.mesa,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
        };
        repsList.push(repData);
        uniqueMesas.add(data.mesa);
      });
      
      repsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setTableReps(repsList);
      setMesas(Array.from(uniqueMesas).sort());
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener la lista de apoderados de mesa:", err);
      setError("Error al cargar los apoderados de mesa.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, localAdminData?.local]);
  
  // Manejador para el envío del formulario de registro de apoderado
  const handleRegisterRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !localAdminData) {
      setError("Base de datos no disponible o datos de local no cargados.");
      return;
    }
    
    if (!repName.trim() || !repEmail.trim() || !repMesa.trim()) {
      setError('Por favor, complete todos los campos.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const repDocRef = doc(db, `/artifacts/${appId}/public/data/table_reps`, repEmail);
      await setDoc(repDocRef, {
        name: repName,
        email: repEmail,
        localId: localAdminData.local,
        mesa: repMesa,
        createdAt: new Date(),
        createdBy: currentUserId
      });
      setSuccessMessage('Apoderado de mesa registrado con éxito!');
      setRepName('');
      setRepEmail('');
      setRepMesa('');
    } catch (e) {
      console.error("Error al registrar apoderado:", e);
      setError("Error al registrar el apoderado. Inténtelo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReps = tableReps.filter(rep => selectedMesa === 'all' || rep.mesa === selectedMesa);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-600 dark:text-indigo-400 mb-2">Panel de Administrador de Local</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes registrar apoderados de mesa para tu local de votación y ver el resumen.
        </p>

        {/* Información del local del administrador */}
        <div className="text-sm text-gray-500 mb-4 text-center space-y-1">
            <p>Estás gestionando el local de: **{localAdminData?.local || 'Cargando...'}**</p>
            <p>Comuna: **{localAdminData?.comuna || 'Cargando...'}**</p>
            <p>Región: **{localAdminData?.region || 'Cargando...'}**</p>
            <p>ID del Usuario: {currentUserId || 'Cargando...'}</p>
        </div>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        {loading || !localAdminData?.local ? (
          <p className="text-center text-gray-500">Cargando información del panel...</p>
        ) : (
          <>
            {/* Formulario para registrar un nuevo apoderado */}
            <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-900 rounded-xl shadow-inner">
              <h2 className="text-2xl font-bold mb-4 text-center">Registrar Nuevo Apoderado de Mesa</h2>
              <form onSubmit={handleRegisterRep} className="space-y-4">
                <div>
                  <label htmlFor="rep-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre Completo:
                  </label>
                  <input
                    type="text"
                    id="rep-name"
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rep-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Correo Electrónico (será el ID único):
                  </label>
                  <input
                    type="email"
                    id="rep-email"
                    value={repEmail}
                    onChange={(e) => setRepEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rep-mesa" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Número de Mesa:
                  </label>
                  <input
                    type="text"
                    id="rep-mesa"
                    value={repMesa}
                    onChange={(e) => setRepMesa(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Registrando...' : 'Registrar Apoderado'}
                </button>
              </form>
            </div>

            {/* Selectores de Filtrado */}
            <div className="flex justify-center mb-8">
              <div>
                <label htmlFor="mesa-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filtrar por Mesa:
                </label>
                <select
                  id="mesa-select"
                  value={selectedMesa}
                  onChange={(e) => setSelectedMesa(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">Todas las Mesas</option>
                  {mesas.map((mesa) => (
                    <option key={mesa} value={mesa}>{mesa}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dashboard de Resumen y Tabla */}
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <h2 className="text-2xl font-bold mb-4">Lista de Apoderados de {localAdminData?.local || 'tu local'}</h2>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Correo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Mesa
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Creado en
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {filteredReps.length > 0 ? (
                    filteredReps.map((rep) => (
                      <tr key={rep.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {rep.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {rep.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {rep.mesa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {rep.createdAt?.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        No hay apoderados que coincidan con los filtros seleccionados.
                      </td>
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