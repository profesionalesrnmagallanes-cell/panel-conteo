'use client'

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, Firestore } from "firebase/firestore";

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

// Definir un tipo para los datos de los administradores comunales
interface ComunalAdmin {
  id: string;
  name: string;
  email: string;
  createdAt: any;
  motivo?: string; // Nuevo campo para el motivo
}

export default function RegionalAdminPanel() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [regionalAdminId, setRegionalAdminId] = useState<string | null>(null);
  const [newComunalAdminName, setNewComunalAdminName] = useState('');
  const [newComunalAdminEmail, setNewComunalAdminEmail] = useState('');
  const [comunalAdmins, setComunalAdmins] = useState<ComunalAdmin[]>([]);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<ComunalAdmin | null>(null);

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

  // Efecto para obtener la lista de administradores comunales
  useEffect(() => {
    if (!db || !isAuthReady || !regionalAdminId) {
      return;
    }

    const collectionPath = `/artifacts/${appId}/users/${regionalAdminId}/comunal_admins`;
    const q = collection(db, collectionPath);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const comunalAdminsList: ComunalAdmin[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        comunalAdminsList.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          motivo: data.motivo || '',
        });
      });
      comunalAdminsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setComunalAdmins(comunalAdminsList);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener la lista de administradores comunales:", err);
      setError("Error al cargar los administradores comunales.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, regionalAdminId]);

  // Manejador para crear un nuevo administrador comunal
  const handleCreateComunalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !regionalAdminId) {
      setError("Base de datos no disponible o usuario no autenticado.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const collectionPath = `/artifacts/${appId}/users/${regionalAdminId}/comunal_admins`;
      await addDoc(collection(db, collectionPath), {
        name: newComunalAdminName,
        email: newComunalAdminEmail,
        createdAt: new Date(),
      });
      setNewComunalAdminName('');
      setNewComunalAdminEmail('');
      setSuccessMessage('Administrador Comunal creado con éxito!');
      console.log('Nuevo administrador comunal creado.');
    } catch (e) {
      console.error("Error al añadir el documento:", e);
      setError("Error al crear el administrador. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Manejador para iniciar la eliminación de un administrador
  const handleDeleteComunalAdmin = (admin: ComunalAdmin) => {
    setAdminToDelete(admin);
    setShowDeleteModal(true);
  };

  // Manejador para confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (!db || !regionalAdminId || !adminToDelete || !actionReason) {
      setError("Base de datos no disponible, usuario no autenticado o motivo no proporcionado.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const collectionPath = `/artifacts/${appId}/users/${regionalAdminId}/comunal_admins`;
      const adminDocRef = doc(db, collectionPath, adminToDelete.id);
      
      // Guardar el motivo de la eliminación en un log antes de borrar el documento
      const logCollectionPath = `/artifacts/${appId}/users/${regionalAdminId}/audit_log`;
      await addDoc(collection(db, logCollectionPath), {
        action: 'delete',
        userId: adminToDelete.id,
        userEmail: adminToDelete.email,
        reason: actionReason,
        timestamp: new Date(),
      });

      // Ahora eliminar el documento original
      await deleteDoc(adminDocRef);

      setSuccessMessage('Administrador Comunal eliminado con éxito!');
      console.log('Administrador comunal eliminado.');
    } catch (e) {
      console.error("Error al eliminar el documento:", e);
      setError("Error al eliminar el administrador. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setAdminToDelete(null);
      setActionReason('');
    }
  };

  // Manejador para iniciar la edición de un administrador
  const handleEditAdmin = (admin: ComunalAdmin) => {
    setEditingAdminId(admin.id);
    setEditAdminName(admin.name);
    setEditAdminEmail(admin.email);
    setActionReason(admin.motivo || '');
    setSuccessMessage(null);
    setError(null);
  };

  // Manejador para actualizar un administrador comunal
  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !regionalAdminId || !editingAdminId || !actionReason) {
      setError("Base de datos no disponible, usuario no autenticado o motivo no proporcionado.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setError(null);

    try {
      const collectionPath = `/artifacts/${appId}/users/${regionalAdminId}/comunal_admins`;
      const adminDocRef = doc(db, collectionPath, editingAdminId);
      await updateDoc(adminDocRef, {
        name: editAdminName,
        email: editAdminEmail,
        motivo: actionReason,
      });
      setEditingAdminId(null);
      setEditAdminName('');
      setEditAdminEmail('');
      setActionReason('');
      setSuccessMessage('Administrador Comunal actualizado con éxito!');
      console.log('Administrador comunal actualizado.');
    } catch (e) {
      console.error("Error al actualizar el documento:", e);
      setError("Error al actualizar el administrador. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-indigo-600 dark:text-indigo-400 mb-2">Panel de Administrador Regional</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes crear y gestionar administradores comunales.
        </p>

        {/* Sección para crear o editar un administrador comunal */}
        <form onSubmit={editingAdminId ? handleUpdateAdmin : handleCreateComunalAdmin} className="space-y-4 mb-8">
          <h2 className="text-2xl font-bold mb-4">{editingAdminId ? 'Editar Administrador Comunal' : 'Crear Nuevo Administrador Comunal'}</h2>
          <div className="flex flex-col space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre:</label>
            <input
              type="text"
              id="name"
              value={editingAdminId ? editAdminName : newComunalAdminName}
              onChange={(e) => editingAdminId ? setEditAdminName(e.target.value) : setNewComunalAdminName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Correo Electrónico:</label>
            <input
              type="email"
              id="email"
              value={editingAdminId ? editAdminEmail : newComunalAdminEmail}
              onChange={(e) => editingAdminId ? setEditAdminEmail(e.target.value) : setNewComunalAdminEmail(e.target.value)}
              placeholder="Ej: juan.perez@example.com"
              required
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          {editingAdminId && (
            <div className="flex flex-col space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">Motivo del cambio (obligatorio):</label>
              <textarea
                id="reason"
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Ej: Reemplazo por enfermedad, cambio de funciones, etc."
                required
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : (editingAdminId ? 'Actualizar Administrador' : 'Crear Administrador Comunal')}
          </button>
          {editingAdminId && (
            <button
              type="button"
              onClick={() => {
                setEditingAdminId(null);
                setEditAdminName('');
                setEditAdminEmail('');
                setActionReason('');
              }}
              className="w-full py-3 px-6 bg-gray-500 text-white font-bold rounded-lg shadow-md hover:bg-gray-600 transition duration-300"
            >
              Cancelar Edición
            </button>
          )}
        </form>

        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}

        <h2 className="text-2xl font-bold mb-4">Administradores Comunales Existentes</h2>
        
        {/* Mostrar el ID del Administrador Regional para fines de depuración */}
        <p className="text-sm text-gray-500 mb-4">
          **Tu ID de usuario:** {regionalAdminId}
        </p>

        {/* Tabla de administradores comunales */}
        {loading && !error ? (
          <p className="text-center text-gray-500">Cargando lista de administradores...</p>
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
                {comunalAdmins.length > 0 ? (
                  comunalAdmins.map((comunalAdmin) => (
                    <tr key={comunalAdmin.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {comunalAdmin.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {comunalAdmin.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEditAdmin(comunalAdmin)}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={loading}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteComunalAdmin(comunalAdmin)}
                          className="text-red-600 hover:text-red-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={loading}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      Aún no hay administradores comunales creados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de confirmación para eliminar */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-4">Confirmar Eliminación</h3>
              <p className="mb-4">
                Estás a punto de eliminar al administrador con el correo: <span className="font-bold">{adminToDelete?.email}</span>.
              </p>
              <div className="flex flex-col space-y-2 mb-4">
                <label htmlFor="delete-reason" className="text-sm font-medium">Motivo (obligatorio):</label>
                <textarea
                  id="delete-reason"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Ej: Reubicación, renuncia, etc."
                  required
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAdminToDelete(null);
                    setActionReason('');
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={loading || !actionReason}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Eliminando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}