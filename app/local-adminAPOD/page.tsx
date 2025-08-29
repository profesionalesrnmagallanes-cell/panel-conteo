'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, where, Firestore, doc, addDoc, deleteDoc, setLogLevel } from "firebase/firestore";

// Declaración de variables globales para TypeScript
declare global {
  var __app_id: string;
  var __firebase_config: string;
  var __initial_auth_token: string;
}

// Variables de configuración global del entorno
// Si no están definidas, se usan valores por defecto para evitar errores.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Define los tipos de datos para los documentos de Firestore
interface TableRep {
  id: string;
  name: string;
  email: string;
  localId: string;
  mesa: string;
}

interface LocalRepProfile {
  id: string;
  name: string;
  email: string;
  region: string;
  comuna: string;
  local: string;
  electionId?: string;
  electionName?: string;
}

interface VoteCount {
  id: string;
  mesa: string;
  candidate: string;
  votes: number;
}

export default function LocalRepDashboard() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localRepId, setLocalRepId] = useState<string | null>(null);
  const [localRepProfile, setLocalRepProfile] = useState<LocalRepProfile | null>(null);
  const [tableReps, setTableReps] = useState<TableRep[]>([]);
  const [voteCounts, setVoteCounts] = useState<VoteCount[]>([]);
  
  // Estados para el formulario de creación de apoderado
  const [newRepName, setNewRepName] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepMesa, setNewRepMesa] = useState('');

  // Efecto para inicializar Firebase y manejar la autenticación
  useEffect(() => {
    try {
      // Configuración de logs para depuración
      setLogLevel('debug');
      
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      // Se utiliza un listener de autenticación para asegurar que el usuario esté listo
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          console.log("Usuario no autenticado, intentando iniciar sesión...");
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
          setLocalRepId(user.uid);
          console.log("Usuario autenticado. ID:", user.uid);
        }
        setIsAuthReady(true);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
      setError("Error al conectar con la base de datos.");
      setLoading(false);
    }
  }, []);

  // Efecto para obtener el perfil del apoderado de local una vez que la autenticación esté lista
  useEffect(() => {
    if (!db || !isAuthReady || !localRepId) return;

    // La ruta del documento de perfil está en la colección 'public'
    const profileDocRef = doc(db, `artifacts/${appId}/public/data/local_rep_profiles`, localRepId);
    console.log("Fetching local rep profile for path:", profileDocRef.path);

    const unsubscribe = onSnapshot(profileDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data() as Omit<LocalRepProfile, 'id'>;
            setLocalRepProfile({ ...data, id: docSnapshot.id });
        } else {
            console.error("Perfil de apoderado de local no encontrado.");
            setError("No se pudo cargar el perfil del local.");
        }
    }, (err) => {
      console.error("Error al obtener el perfil:", err);
      setError("Error al cargar el perfil del local.");
    });

    return () => unsubscribe();
  }, [db, isAuthReady, localRepId]);

  // Efecto para obtener los apoderados de mesa para el local actual
  useEffect(() => {
    if (!db || !isAuthReady || !localRepProfile?.local) return;

    // Ruta de la colección para los apoderados de mesa, dentro de 'public/data'
    const tableRepsCollectionPath = `artifacts/${appId}/public/data/table_reps`;
    const q = query(collection(db, tableRepsCollectionPath), where("localId", "==", localRepProfile.local));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const repsList: TableRep[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        repsList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          localId: data.localId,
          mesa: data.mesa,
        });
      });
      setTableReps(repsList);
    }, (err) => {
      console.error("Error al obtener los apoderados de mesa:", err);
      setError("Error al cargar los apoderados de mesa.");
    });

    return () => unsubscribe();
  }, [db, isAuthReady, localRepProfile]);
  
  // Efecto para obtener los conteos de votos en tiempo real para el local actual
  useEffect(() => {
    if (!db || !isAuthReady || !localRepProfile?.local || !localRepProfile?.electionId) return;
    
    // Ruta de la colección de votos, dentro de 'public/data'
    const votesCollectionPath = `artifacts/${appId}/public/data/votes`;
    const q = query(
      collection(db, votesCollectionPath),
      where("localId", "==", localRepProfile.local),
      where("electionId", "==", localRepProfile.electionId)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const voteCountsList: VoteCount[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        voteCountsList.push({
          id: doc.id,
          mesa: data.mesa,
          candidate: data.candidate,
          votes: data.votes,
        });
      });
      setVoteCounts(voteCountsList);
    }, (err) => {
      console.error("Error al obtener los conteos de votos:", err);
      setError("Error al cargar los conteos de votos.");
    });

    return () => unsubscribe();
  }, [db, isAuthReady, localRepProfile]);


  // Handler para crear un nuevo apoderado de mesa
  const handleCreateTableRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !localRepProfile) {
      setError("Base de datos no disponible o perfil no cargado.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/table_reps`), {
        name: newRepName,
        email: newRepEmail,
        localId: localRepProfile.local,
        mesa: newRepMesa,
        electionId: localRepProfile.electionId,
        electionName: localRepProfile.electionName,
        createdAt: new Date(),
      });
      setNewRepName('');
      setNewRepEmail('');
      setNewRepMesa('');
      setSuccessMessage('Apoderado de Mesa creado con éxito!');
    } catch (e) {
      console.error("Error al crear el apoderado:", e);
      setError("Error al crear el apoderado. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };
  
  // Handler para eliminar un apoderado de mesa
  const handleDeleteTableRep = async (repId: string) => {
    // Uso de un modal de confirmación en lugar de la función 'alert()'
    if (window.confirm("¿Estás seguro de que quieres eliminar a este apoderado?")) {
      if (!db) {
        setError("Base de datos no disponible.");
        return;
      }
      setLoading(true);
      setSuccessMessage(null);
      setError(null);

      try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/table_reps`, repId));
        setSuccessMessage('Apoderado de Mesa eliminado con éxito!');
      } catch (e) {
        console.error("Error al eliminar el apoderado:", e);
        setError("Error al eliminar el apoderado. Por favor, inténtelo de nuevo.");
      } finally {
        setLoading(false);
      }
    }
  };

  const getVoteTotalsByCandidate = () => {
    const totals: { [key: string]: number } = {};
    voteCounts.forEach(vote => {
      totals[vote.candidate] = (totals[vote.candidate] || 0) + vote.votes;
    });
    return totals;
  };

  const voteTotals = getVoteTotalsByCandidate();

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-red-600 dark:text-red-400 mb-2">Panel de Apoderado de Local</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes gestionar a los apoderados de mesa y ver los resultados en tiempo real para tu local de votación.
        </p>

        {/* Muestra el ID del usuario actual */}
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mb-4">
          ID del Usuario: {localRepId || 'Cargando...'}
        </p>

        {/* Mensajes de estado */}
        {error && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}
        {successMessage && (
          <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg dark:bg-green-200 dark:text-green-800" role="alert">
            <span className="font-medium">Éxito:</span> {successMessage}
          </div>
        )}
        
        {/* Sección de Resumen del Local */}
        <div className="mb-8 p-6 bg-red-50 dark:bg-red-900 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold mb-2">Resumen del Local</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-red-800 dark:text-red-200">
                <p><strong>Local:</strong> {localRepProfile?.local || 'Cargando...'}</p>
                <p><strong>Elección:</strong> {localRepProfile?.electionName || 'Cargando...'}</p>
            </div>
        </div>
        
        {/* Formulario para crear un nuevo apoderado */}
        <form onSubmit={handleCreateTableRep} className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold mb-4">Crear Nuevo Apoderado de Mesa</h2>
          <div className="flex flex-col space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre:</label>
            <input
              type="text"
              id="name"
              value={newRepName}
              onChange={(e) => setNewRepName(e.target.value)}
              placeholder="Ej: Juan Silva"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Correo Electrónico:</label>
            <input
              type="email"
              id="email"
              value={newRepEmail}
              onChange={(e) => setNewRepEmail(e.target.value)}
              placeholder="Ej: juan.silva@example.com"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="mesa" className="text-sm font-medium">Mesa de Votación:</label>
            <input
              type="text"
              id="mesa"
              value={newRepMesa}
              onChange={(e) => setNewRepMesa(e.target.value)}
              placeholder="Ej: Mesa 12"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !localRepProfile?.local}
            className="w-full py-3 px-6 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : 'Crear Apoderado de Mesa'}
          </button>
        </form>

        <h2 className="text-2xl font-bold mb-4">Apoderados de Mesa de {localRepProfile?.local || '...'}</h2>
        
        {loading && !error ? (
          <p className="text-center text-gray-500">Cargando apoderados...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mesa
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {tableReps.length > 0 ? (
                  tableReps.map((rep) => (
                    <tr key={rep.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {rep.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {rep.mesa}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteTableRep(rep.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      Aún no hay apoderados de mesa en este local.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sección de Conteo de Votos */}
        <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900 rounded-xl shadow-inner">
            <h2 className="text-2xl font-bold mb-4">Resultados en Tiempo Real</h2>
            {loading && !error ? (
                <p className="text-center text-gray-500">Cargando conteo de votos...</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-800 dark:text-gray-200">
                  {Object.keys(voteTotals).length > 0 ? (
                    Object.entries(voteTotals).map(([candidate, total]) => (
                      <div key={candidate} className="bg-yellow-100 dark:bg-yellow-800 rounded-lg p-4 shadow-sm">
                        <h3 className="text-lg font-semibold">{candidate}</h3>
                        <p className="text-3xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{total}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center text-gray-500">No hay datos de votos disponibles.</p>
                  )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}