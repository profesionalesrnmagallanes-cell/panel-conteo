'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, where, Firestore, DocumentData, doc, updateDoc } from "firebase/firestore";

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
interface Election {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface CommunalAdmin {
  id: string;
  name: string;
  email: string;
  region: string;
  comuna: string;
  electionId?: string;
  electionName?: string;
  credentialsIssued?: boolean;
}

export default function RegionalAdminDashboard() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [regionalAdminId, setRegionalAdminId] = useState<string | null>(null);
  const [regionalAdminRegion, setRegionalAdminRegion] = useState<string | null>(null);

  const [availableElections, setAvailableElections] = useState<Election[]>([]);
  const [communalAdmins, setCommunalAdmins] = useState<CommunalAdmin[]>([]);
  
  const [selectedElection, setSelectedElection] = useState('');

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
          setRegionalAdminId(user.uid);
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

  // Efecto para obtener el perfil del administrador regional (su región)
  useEffect(() => {
    if (!db || !isAuthReady || !regionalAdminId) return;

    const profileDocRef = doc(db, "artifacts", appId, "public", "regional_admin_profiles", regionalAdminId);
    console.log("Fetching regional admin profile for path:", profileDocRef.path);

    const unsubscribe = onSnapshot(profileDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setRegionalAdminRegion(data.region);
        } else {
            console.error("Perfil de administrador regional no encontrado.");
            setError("No se pudo cargar el perfil de la región.");
        }
    });

    return () => unsubscribe();
  }, [db, isAuthReady, regionalAdminId]);


  // Efecto para obtener las elecciones disponibles (públicas)
  useEffect(() => {
    if (!db || !isAuthReady) return;
    const electionsCollectionPath = `/artifacts/${appId}/public/elections`;
    const q = collection(db, electionsCollectionPath);
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const electionsList: Election[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        electionsList.push({
          id: doc.id,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
        });
      });
      setAvailableElections(electionsList);
    });
    return () => unsubscribe();
  }, [db, isAuthReady]);

  // Efecto para obtener los administradores comunales de la región del usuario actual
  useEffect(() => {
    if (!db || !isAuthReady || !regionalAdminRegion) return;

    const communalAdminsCollectionPath = `/artifacts/${appId}/public/communal_admins`;
    const q = query(collection(db, communalAdminsCollectionPath), where("region", "==", regionalAdminRegion));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const adminsList: CommunalAdmin[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        adminsList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          region: data.region,
          comuna: data.comuna,
          electionId: data.electionId,
          electionName: data.electionName,
          credentialsIssued: data.credentialsIssued || false,
        });
      });
      setCommunalAdmins(adminsList);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los administradores comunales:", err);
      setError("Error al cargar los administradores comunales.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, regionalAdminRegion]);

  // Manejador para vincular una elección con un administrador comunal
  const handleLinkElection = async (communalAdminId: string) => {
    if (!db || !selectedElection) {
      setError("Por favor, selecciona una elección.");
      return;
    }
    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const adminDocRef = doc(db, "artifacts", appId, "public", "communal_admins", communalAdminId);
      const election = availableElections.find(e => e.id === selectedElection);

      if (!election) {
        throw new Error("Elección no encontrada.");
      }

      await updateDoc(adminDocRef, {
        electionId: election.id,
        electionName: election.name,
      });

      setSuccessMessage('Elección vinculada con éxito!');
    } catch (e) {
      console.error("Error al vincular la elección:", e);
      setError("Error al vincular la elección. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Manejador para emitir las credenciales (actualizar un campo en la DB)
  const handleIssueCredentials = async (communalAdminId: string) => {
    if (!db) {
      setError("Base de datos no disponible.");
      return;
    }
    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const adminDocRef = doc(db, "artifacts", appId, "public", "communal_admins", communalAdminId);
      await updateDoc(adminDocRef, {
        credentialsIssued: true,
      });
      setSuccessMessage('Credenciales emitidas con éxito!');
    } catch (e) {
      console.error("Error al emitir credenciales:", e);
      setError("Error al emitir credenciales. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Panel de Administración Regional</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes vincular elecciones y gestionar a los administradores comunales de tu región.
        </p>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        
        {/* Sección de Resumen Regional */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Resumen de la Región</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-100 dark:bg-blue-900 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center">
              <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-200">Tu Región</h3>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mt-2">{regionalAdminRegion || 'Cargando...'}</p>
            </div>
            {/* Aquí se podría agregar el conteo de votos regional/comunal */}
            <div className="bg-purple-100 dark:bg-purple-900 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center">
              <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">Votos Reportados</h3>
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 mt-2">0</p>
            </div>
          </div>
        </div>

        {/* Selector de Elecciones */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">Elecciones Disponibles</h2>
            <p className="text-sm font-medium mb-2">Selecciona la elección que deseas vincular:</p>
            <select
                value={selectedElection}
                onChange={(e) => setSelectedElection(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
                <option value="">-- Selecciona una Elección --</option>
                {availableElections.map((election) => (
                    <option key={election.id} value={election.id}>
                        {election.name} ({election.startDate} - {election.endDate})
                    </option>
                ))}
            </select>
        </div>


        {/* Tabla de Administradores Comunales */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Administradores Comunales de tu Región</h2>
          {loading && !error ? (
            <p className="text-center text-gray-500">Cargando administradores...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Comuna
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Elección Vinculada
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {communalAdmins.length > 0 ? (
                    communalAdmins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {admin.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {admin.comuna}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {admin.electionName || 'Sin vincular'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleLinkElection(admin.id)}
                            disabled={loading || !selectedElection}
                            className="text-blue-600 hover:text-blue-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Vincular Elección
                          </button>
                          <button
                            onClick={() => handleIssueCredentials(admin.id)}
                            disabled={loading || admin.credentialsIssued}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {admin.credentialsIssued ? 'Credenciales Emitidas' : 'Emitir Credenciales'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        Aún no hay administradores comunales en tu región.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}