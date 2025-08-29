'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, where, Firestore, DocumentData, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";

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

// Definir tipos de datos para los documentos de Firestore
interface TableRep {
  id: string;
  name: string;
  email: string;
  comuna: string;
  electionId?: string;
  electionName?: string;
}

interface CommunalAdminProfile {
  id: string;
  name: string;
  email: string;
  region: string;
  comuna: string;
  electionId?: string;
  electionName?: string;
}

export default function CommunalAdminDashboard() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [communalAdminId, setCommunalAdminId] = useState<string | null>(null);
  const [communalAdminProfile, setCommunalAdminProfile] = useState<CommunalAdminProfile | null>(null);

  const [tableReps, setTableReps] = useState<TableRep[]>([]);
  const [newRepName, setNewRepName] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  
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
          setCommunalAdminId(user.uid);
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

  // Efecto para obtener el perfil del administrador comunal (su comuna)
  useEffect(() => {
    if (!db || !isAuthReady || !communalAdminId) return;

    // Se asume que el perfil del administrador comunal se guarda en una colección pública
    const profileDocRef = doc(db, "artifacts", appId, "public", "communal_admin_profiles", communalAdminId);

    const unsubscribe = onSnapshot(profileDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Omit<CommunalAdminProfile, 'id'>;
        setCommunalAdminProfile({ ...data, id: docSnapshot.id });
      } else {
        console.error("Perfil de administrador comunal no encontrado.");
        setError("No se pudo cargar el perfil de la comuna.");
      }
    });

    return () => unsubscribe();
  }, [db, isAuthReady, communalAdminId]);


  // Efecto para obtener los apoderados de mesa de la comuna del usuario actual
  useEffect(() => {
    if (!db || !isAuthReady || !communalAdminProfile?.comuna) return;
    
    // Se asume que los apoderados de mesa se guardan en una colección pública
    const tableRepsCollectionPath = `artifacts/${appId}/public/table_reps`;
    const q = query(collection(db, tableRepsCollectionPath), where("comuna", "==", communalAdminProfile.comuna));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const repsList: TableRep[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        repsList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          comuna: data.comuna,
          electionId: data.electionId,
          electionName: data.electionName,
        });
      });
      setTableReps(repsList);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los apoderados de mesa:", err);
      setError("Error al cargar los apoderados de mesa.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, communalAdminProfile]);


  // Manejador para crear un nuevo apoderado de mesa
  const handleCreateRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !communalAdminProfile) {
      setError("Base de datos no disponible o perfil no cargado.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/table_reps`), {
        name: newRepName,
        email: newRepEmail,
        comuna: communalAdminProfile.comuna,
        electionId: communalAdminProfile.electionId,
        electionName: communalAdminProfile.electionName,
        createdAt: new Date(),
      });
      setNewRepName('');
      setNewRepEmail('');
      setSuccessMessage('Apoderado de Mesa creado con éxito!');
    } catch (e) {
      console.error("Error al crear el apoderado:", e);
      setError("Error al crear el apoderado. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Manejador para eliminar un apoderado de mesa
  const handleDeleteRep = async (repId: string) => {
    if (!db) {
      setError("Base de datos no disponible.");
      return;
    }
    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/table_reps`, repId));
      setSuccessMessage('Apoderado de Mesa eliminado con éxito!');
    } catch (e) {
      console.error("Error al eliminar el apoderado:", e);
      setError("Error al eliminar el apoderado. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-600 dark:text-blue-400 mb-2">Panel de Administración Comunal</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Gestiona los apoderados de mesa para la comuna de {communalAdminProfile?.comuna || '...'} en la elección '{communalAdminProfile?.electionName || 'Sin asignar'}'.
        </p>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        
        {/* Formulario para crear un nuevo apoderado */}
        <form onSubmit={handleCreateRep} className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold mb-4">Crear Nuevo Apoderado de Mesa</h2>
          <div className="flex flex-col space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre:</label>
            <input
              type="text"
              id="name"
              value={newRepName}
              onChange={(e) => setNewRepName(e.target.value)}
              placeholder="Ej: Ana Pérez"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Correo Electrónico:</label>
            <input
              type="email"
              id="email"
              value={newRepEmail}
              onChange={(e) => setNewRepEmail(e.target.value)}
              placeholder="Ej: ana.perez@example.com"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !communalAdminProfile?.comuna}
            className="w-full py-3 px-6 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : 'Crear Apoderado de Mesa'}
          </button>
        </form>

        <h2 className="text-2xl font-bold mb-4">Apoderados de Mesa de {communalAdminProfile?.comuna || '...'}</h2>
        
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
                    Correo Electrónico
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
                        {rep.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteRep(rep.id)}
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
                      Aún no hay apoderados de mesa en esta comuna.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}