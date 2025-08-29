import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';

// Variables globales proporcionadas por el entorno de Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Componente principal de la aplicación.
export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState('');
  const [count, setCount] = useState('');
  const [counts, setCounts] = useState([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState('');
  const [message, setMessage] = useState(null);

  // Inicialización de Firebase y autenticación.
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authentication = getAuth(app);
        setDb(firestore);
        setAuth(authentication);

        const unsubscribe = authentication.onAuthStateChanged(async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            // Autenticación anónima si no hay un token de inicio de sesión.
            try {
              if (initialAuthToken) {
                const userCredential = await signInWithCustomToken(authentication, initialAuthToken);
                setUserId(userCredential.user.uid);
              } else {
                const userCredential = await signInAnonymously(authentication);
                setUserId(userCredential.user.uid);
              }
            } catch (error) {
              console.error("Error signing in:", error);
              setMessage("Error al iniciar sesión. Por favor, inténtalo de nuevo.");
            }
          }
          setIsAuthReady(true);
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        console.error("Firebase config is missing.");
        setMessage("Error: Falta la configuración de Firebase.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setMessage("Error al inicializar Firebase. Por favor, revisa la configuración.");
      setLoading(false);
    }
  }, []);

  // Escucha cambios en la base de datos en tiempo real.
  useEffect(() => {
    if (isAuthReady && db) {
      const collectionPath = `/artifacts/${appId}/public/data/counts`;
      const q = collection(db, collectionPath);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const countsData = [];
        querySnapshot.forEach((doc) => {
          countsData.push({ id: doc.id, ...doc.data() });
        });
        setCounts(countsData);
      }, (error) => {
        console.error("Error fetching documents:", error);
        setMessage("Error al cargar los datos. Por favor, inténtalo de nuevo.");
      });

      return () => unsubscribe();
    }
  }, [db, isAuthReady]);

  // Maneja el envío del formulario.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!count.trim() || !userId) {
      setMessage("Por favor, ingresa un valor para el conteo.");
      return;
    }

    try {
      const countsCollectionRef = collection(db, `/artifacts/${appId}/public/data/counts`);
      await addDoc(countsCollectionRef, {
        value: count,
        userId: userId,
        timestamp: new Date()
      });
      setCount('');
      setMessage("Conteo guardado exitosamente.");
    } catch (error) {
      console.error("Error adding document:", error);
      setMessage("Error al guardar el conteo. Intenta de nuevo.");
    }
  };

  // Borra un conteo.
  const handleDelete = async (id) => {
    try {
      const docRef = doc(db, `/artifacts/${appId}/public/data/counts`, id);
      await deleteDoc(docRef);
      setMessage("Conteo eliminado exitosamente.");
    } catch (error) {
      console.error("Error deleting document:", error);
      setMessage("Error al eliminar el conteo. Intenta de nuevo.");
    }
  };

  // Maneja la actualización de un conteo.
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editCount.trim() || !editId) {
      setMessage("Por favor, ingresa un valor para la actualización.");
      return;
    }
    try {
      const docRef = doc(db, `/artifacts/${appId}/public/data/counts`, editId);
      await updateDoc(docRef, {
        value: editCount
      });
      setEditId(null);
      setEditCount('');
      setMessage("Conteo actualizado exitosamente.");
    } catch (error) {
      console.error("Error updating document:", error);
      setMessage("Error al actualizar el conteo. Intenta de nuevo.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700 animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Panel de Conteo</h1>
        <p className="text-sm text-center text-gray-500 mb-4">ID de Usuario: <span className="font-mono text-xs break-all">{userId}</span></p>

        {message && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{message}</span>
            <span onClick={() => setMessage(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer text-blue-700 font-bold">×</span>
          </div>
        )}

        {editId ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            <input
              type="text"
              value={editCount}
              onChange={(e) => setEditCount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Actualizar conteo"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white font-semibold p-3 rounded-lg shadow-md hover:bg-green-700 transition duration-200"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => { setEditId(null); setEditCount(''); }}
                className="flex-1 bg-gray-400 text-white font-semibold p-3 rounded-lg shadow-md hover:bg-gray-500 transition duration-200"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Escribe un nuevo conteo"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white font-semibold p-3 rounded-lg shadow-md hover:bg-indigo-700 transition duration-200"
            >
              Guardar Conteo
            </button>
          </form>
        )}

        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Conteo de usuarios</h2>
          {counts.length === 0 ? (
            <p className="text-center text-gray-500">No hay conteos disponibles.</p>
          ) : (
            <ul className="space-y-4">
              {counts.map((item) => (
                <li key={item.id} className="bg-gray-50 p-4 rounded-lg shadow flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700 text-lg break-words">{item.value}</span>
                    <p className="text-gray-400 text-xs mt-1 truncate">Por: {item.userId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditId(item.id); setEditCount(item.value); setMessage(null); }}
                      className="bg-yellow-400 text-white p-2 rounded-lg hover:bg-yellow-500 transition duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}