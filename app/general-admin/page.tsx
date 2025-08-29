'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, Firestore, DocumentData, where, doc, setDoc } from "firebase/firestore";

// Declarar variables globales para que TypeScript no arroje errores en este entorno.
// eslint-disable-next-line no-unused-vars
declare global {
  var __app_id: string;
  var __firebase_config: string;
  var __initial_auth_token: string;
}

// Configuración y variables globales proporcionadas por el entorno de Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Definir tipos de datos para los documentos de Firestore
interface Election {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface RegionalAdmin {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function GeneralAdminDashboard() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<any>(null); // Usamos 'any' para evitar errores de tipo con el objeto de autenticación
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Estados para la creación de elecciones
  const [newElectionName, setNewElectionName] = useState('');
  const [newElectionStartDate, setNewElectionStartDate] = useState('');
  const [newElectionEndDate, setNewElectionEndDate] = useState('');
  const [elections, setElections] = useState<Election[]>([]);
  const [electionsLoading, setElectionsLoading] = useState(true);

  // Estados para la creación de administradores regionales
  const [newRegionalAdminName, setNewRegionalAdminName] = useState('');
  const [newRegionalAdminEmail, setNewRegionalAdminEmail] = useState('');
  const [regionalAdmins, setRegionalAdmins] = useState<RegionalAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  // Estados para el conteo de datos consolidados
  const [totalComunalAdmins, setTotalComunalAdmins] = useState(0);
  const [totalLocalReps, setTotalLocalReps] = useState(0);

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
          setCurrentUserId(user.uid);
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

  // Efecto para obtener las elecciones
  useEffect(() => {
    if (!db || !isAuthReady) return;
    setElectionsLoading(true);
    const electionsCollectionPath = `/artifacts/${appId}/public/elections`;
    const q = query(collection(db, electionsCollectionPath));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const electionsList: Election[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        electionsList.push({
          id: doc.id,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'Fecha no disponible',
        });
      });
      setElections(electionsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setElectionsLoading(false);
    }, (err) => {
      console.error("Error al obtener las elecciones:", err);
      setError("Error al cargar las elecciones.");
      setElectionsLoading(false);
    });
    return () => unsubscribe();
  }, [db, isAuthReady]);

  // Efecto para obtener los administradores regionales y el conteo de admins y apoderados
  useEffect(() => {
    if (!db || !isAuthReady) return;
    setAdminsLoading(true);
    const userProfilesCollection = collection(db, `/artifacts/${appId}/public/user_profiles`);

    // Listener para administradores regionales
    const qAdmins = query(userProfilesCollection, where("role", "==", "regional-admin"));
    const unsubscribeAdmins = onSnapshot(qAdmins, (querySnapshot) => {
      const adminsList: RegionalAdmin[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        adminsList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'Fecha no disponible',
        });
      });
      setRegionalAdmins(adminsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setAdminsLoading(false);
    }, (err) => {
      console.error("Error al obtener los administradores regionales:", err);
      setError("Error al cargar los administradores regionales.");
      setAdminsLoading(false);
    });

    // Listener para el conteo de administradores comunales
    const qComunalAdmins = query(userProfilesCollection, where("role", "==", "comunal-admin"));
    const unsubscribeComunal = onSnapshot(qComunalAdmins, (snapshot) => {
      setTotalComunalAdmins(snapshot.size);
    }, (err) => {
      console.error("Error al obtener el conteo de administradores comunales:", err);
    });

    // Listener para el conteo de apoderados locales
    const qLocalReps = query(userProfilesCollection, where("role", "==", "local-rep"));
    const unsubscribeReps = onSnapshot(qLocalReps, (snapshot) => {
      setTotalLocalReps(snapshot.size);
    }, (err) => {
      console.error("Error al obtener el conteo de apoderados locales:", err);
    });

    return () => {
      unsubscribeAdmins();
      unsubscribeComunal();
      unsubscribeReps();
    };
  }, [db, isAuthReady]);

  // Manejador para crear una nueva elección
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      setError("Base de datos no disponible.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const electionsCollectionPath = `/artifacts/${appId}/public/elections`;
      await addDoc(collection(db, electionsCollectionPath), {
        name: newElectionName,
        startDate: newElectionStartDate,
        endDate: newElectionEndDate,
        createdAt: new Date(),
      });
      setNewElectionName('');
      setNewElectionStartDate('');
      setNewElectionEndDate('');
      setSuccessMessage('Elección creada con éxito!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      console.error("Error al crear la elección:", e);
      setError("Error al crear la elección. Por favor, inténtelo de nuevo.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Manejador para crear un nuevo administrador regional
  const handleCreateRegionalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !newRegionalAdminEmail || !newRegionalAdminName) {
      setError("Por favor, complete todos los campos.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const userProfileRef = doc(db, `/artifacts/${appId}/public/user_profiles`, newRegionalAdminEmail);
      await setDoc(userProfileRef, {
        name: newRegionalAdminName,
        email: newRegionalAdminEmail,
        role: "regional-admin",
        createdAt: new Date(),
      });
      setNewRegionalAdminName('');
      setNewRegionalAdminEmail('');
      setSuccessMessage('Administrador regional creado con éxito!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      console.error("Error al crear el administrador regional:", e);
      setError("Error al crear el administrador. Por favor, inténtelo de nuevo.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };
  
  // Componente de spinner de carga para los botones
  const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Panel de Administración General</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes gestionar elecciones, crear administradores regionales y ver un resumen de los datos.
        </p>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4 font-bold">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4 font-bold">{successMessage}</p>}
        {loading && <p className="text-center text-blue-500">Cargando datos iniciales...</p>}

        {/* Sección de Resumen Consolidado */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Resumen Consolidado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-100 dark:bg-blue-900 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center">
              <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-200">Total de Administradores Comunales</h3>
              <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mt-2">{totalComunalAdmins}</p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900 rounded-xl p-6 shadow-lg flex flex-col items-center justify-center">
              <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">Total de Apoderados Locales</h3>
              <p className="text-4xl font-bold text-purple-600 dark:text-purple-400 mt-2">{totalLocalReps}</p>
            </div>
          </div>
        </div>

        {/* Formulario para crear Elecciones */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <h2 className="text-2xl font-bold mb-4">Crear Nueva Elección</h2>
          <form onSubmit={handleCreateElection} className="space-y-4">
            <div>
              <label htmlFor="electionName" className="block text-sm font-medium">Nombre de la Elección:</label>
              <input type="text" id="electionName" value={newElectionName} onChange={(e) => setNewElectionName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium">Fecha de Inicio:</label>
              <input type="date" id="startDate" value={newElectionStartDate} onChange={(e) => setNewElectionStartDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium">Fecha de Fin:</label>
              <input type="date" id="endDate" value={newElectionEndDate} onChange={(e) => setNewElectionEndDate(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 px-6 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {loading ? <Spinner /> : null}
              {loading ? 'Creando Elección...' : 'Crear Elección'}
            </button>
          </form>
        </div>

        {/* Tabla de Elecciones Existentes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Elecciones Creadas</h2>
          {electionsLoading ? (
            <p className="text-center text-gray-500">Cargando elecciones...</p>
          ) : elections.length > 0 ? (
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Inicio</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fin</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Creado en</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {elections.map((election) => (
                    <tr key={election.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{election.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{election.startDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{election.endDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{election.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">Aún no hay elecciones creadas.</p>
          )}
        </div>

        {/* Formulario para crear Administradores Regionales */}
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <h2 className="text-2xl font-bold mb-4">Crear Nuevo Administrador Regional</h2>
          <form onSubmit={handleCreateRegionalAdmin} className="space-y-4">
            <div>
              <label htmlFor="regionalAdminName" className="block text-sm font-medium">Nombre:</label>
              <input type="text" id="regionalAdminName" value={newRegionalAdminName} onChange={(e) => setNewRegionalAdminName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label htmlFor="regionalAdminEmail" className="block text-sm font-medium">Correo Electrónico:</label>
              <input type="email" id="regionalAdminEmail" value={newRegionalAdminEmail} onChange={(e) => setNewRegionalAdminEmail(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {loading ? <Spinner /> : null}
              {loading ? 'Creando Administrador...' : 'Crear Administrador Regional'}
            </button>
          </form>
        </div>

        {/* Tabla de Administradores Regionales */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Administradores Regionales</h2>
          {adminsLoading ? (
            <p className="text-center text-gray-500">Cargando administradores...</p>
          ) : regionalAdmins.length > 0 ? (
            <div className="overflow-x-auto rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Correo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Creado en</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {regionalAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{admin.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{admin.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{admin.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500">Aún no hay administradores regionales creados.</p>
          )}
        </div>
        <div className="mt-8 text-center text-sm text-gray-400 dark:text-gray-600">
          ID de Usuario actual: {currentUserId || 'No autenticado'}
        </div>
      </div>
    </div>
  );
}