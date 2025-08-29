import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore';

// Componente principal de la aplicación.
const App = () => {
  // Estados para gestionar la autenticación, la base de datos y los datos de resultados.
  const [auth, setAuth] = useState(null);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inicializa Firebase y maneja la autenticación una vez al cargar el componente.
  useEffect(() => {
    try {
      // Intenta usar las variables globales proporcionadas por el entorno de Canvas.
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        throw new Error("Firebase config no está disponible. Asegúrate de que las variables globales están definidas.");
      }

      const app = initializeApp(firebaseConfig, appId);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const handleAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (authError) {
          console.error("Error de autenticación:", authError);
          // Permite continuar incluso si la autenticación falla, usando un ID anónimo.
          setUserId(firebaseAuth.currentUser?.uid || `anon-${Math.random().toString(36).substr(2, 9)}`);
        }
      };

      // Establece un observador para el estado de autenticación.
      const unsubscribeAuth = firebaseAuth.onAuthStateChanged(user => {
        if (user) {
          setUserId(user.uid);
          setLoading(false);
        } else {
          // Si no hay usuario, inicia el proceso de autenticación.
          handleAuth();
        }
      });

      // Función de limpieza para el observador de autenticación.
      return () => unsubscribeAuth();

    } catch (err) {
      console.error("Error al inicializar la aplicación:", err);
      setError("Error al inicializar la aplicación. Por favor, revisa la consola para más detalles.");
      setLoading(false);
    }
  }, []);

  // Escucha los cambios en la colección de Firestore en tiempo real.
  useEffect(() => {
    if (!db || !userId) {
      // No continuar si la base de datos o el ID de usuario no están listos.
      return;
    }

    // Configura la referencia de la colección y la consulta.
    const collectionRef = collection(db, 'resultados');
    const q = query(collectionRef, where('eleccionId', '==', 2025));

    // Configura el listener en tiempo real.
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("Datos de Firestore actualizados.");
      const aggregatedResults = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const { candidatoId, votos } = data;

        if (candidatoId && typeof votos === 'number') {
          if (!aggregatedResults[candidatoId]) {
            aggregatedResults[candidatoId] = 0;
          }
          aggregatedResults[candidatoId] += votos;
        }
      });

      setResults(aggregatedResults);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los datos de Firestore:", err);
      setError("Error al cargar los datos en tiempo real. Por favor, revisa la consola.");
      setLoading(false);
    });

    // Función de limpieza para detener el listener cuando el componente se desmonte.
    return () => unsubscribe();
  }, [db, userId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 flex flex-col items-center justify-center font-sans">
      <style jsx global>{`
        body {
          margin: 0;
          font-family: 'Inter', sans-serif;
          background-color: #1a202c;
        }
      `}</style>
      <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-10 border-4 border-lime-500 transform transition-all hover:scale-[1.01]">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-green-500">
          Panel de Resultados
        </h1>
        <p className="text-lg text-center text-gray-400 mb-8 font-light">
          Actualización en tiempo real desde Firestore.
        </p>
        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-4">
                ID de Usuario: {userId || "Cargando..."}
            </span>
        </div>
        {loading ? (
          <div className="text-center text-gray-400">Cargando datos...</div>
        ) : error ? (
          <div className="text-center text-red-500 font-medium">{error}</div>
        ) : Object.keys(results).length === 0 ? (
          <div className="text-center text-gray-400">
            No hay datos disponibles. Asegúrate de que los documentos existen en la colección 'resultados' en Firestore.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(results).sort(([, a], [, b]) => b - a).map(([candidatoId, votos]) => (
              <div
                key={candidatoId}
                className="bg-gray-700 p-6 rounded-xl flex flex-col items-center shadow-lg transform transition-transform hover:scale-105"
              >
                <div className="text-xl font-bold text-lime-400 uppercase tracking-wider mb-2">
                  {candidatoId}
                </div>
                <div className="text-6xl font-extrabold text-white">
                  {votos}
                </div>
                <div className="text-gray-400 mt-1">
                  voto{votos !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;