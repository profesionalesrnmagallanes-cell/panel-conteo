"use client";

import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, getDoc, onSnapshot, collection, query, where, getDocs, setDoc, addDoc } from 'firebase/firestore';

// Componente para la tabla de datos
const Table = ({ data, onAdjustVotes, onViewResults }) => {
  const [editingRow, setEditingRow] = useState(null);
  const [newVotes, setNewVotes] = useState({});

  const handleEdit = (tableId) => {
    setEditingRow(tableId);
    setNewVotes(data.find(item => item.id === tableId).votes);
  };

  const handleSave = (tableId) => {
    onAdjustVotes(tableId, newVotes);
    setEditingRow(null);
  };

  const handleCancel = () => {
    setEditingRow(null);
    setNewVotes({});
  };

  const handleInputChange = (e, voteType) => {
    setNewVotes({
      ...newVotes,
      [voteType]: parseInt(e.target.value, 10) || 0,
    });
  };

  return (
    <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-4">Mesas Registradas</h2>
      <table className="min-w-full leading-normal">
        <thead>
          <tr>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              ID Mesa
            </th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Votos de la Alianza
            </th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Votos Candidato A
            </th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Votos Candidato B
            </th>
            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                <p className="text-gray-900 whitespace-no-wrap">{item.id}</p>
              </td>
              <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                {editingRow === item.id ? (
                  <input
                    type="number"
                    value={newVotes.alliance || ''}
                    onChange={(e) => handleInputChange(e, 'alliance')}
                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                ) : (
                  <p className="text-gray-900 whitespace-no-wrap">{item.votes.alliance}</p>
                )}
              </td>
              <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                {editingRow === item.id ? (
                  <input
                    type="number"
                    value={newVotes.candidateA || ''}
                    onChange={(e) => handleInputChange(e, 'candidateA')}
                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                ) : (
                  <p className="text-gray-900 whitespace-no-wrap">{item.votes.candidateA}</p>
                )}
              </td>
              <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                {editingRow === item.id ? (
                  <input
                    type="number"
                    value={newVotes.candidateB || ''}
                    onChange={(e) => handleInputChange(e, 'candidateB')}
                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  />
                ) : (
                  <p className="text-gray-900 whitespace-no-wrap">{item.votes.candidateB}</p>
                )}
              </td>
              <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                {editingRow === item.id ? (
                  <>
                    <button
                      onClick={() => handleSave(item.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={handleCancel}
                      className="text-red-600 hover:text-red-900"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(item.id)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Ajustar Votos
                    </button>
                    <button
                      onClick={() => onViewResults(item.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Ver Resultados
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Componente principal de la aplicación
export default function AdminPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    try {
      // Usar las variables globales proporcionadas por el entorno de Canvas
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

      if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // Establecer el nivel de registro para depuración de Firestore
        // setLogLevel('Debug');

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
            try {
              const adminDocRef = doc(db, `/artifacts/${appId}/public/data/admins`, user.uid);
              const adminDocSnap = await getDoc(adminDocRef);
              if (adminDocSnap.exists() && adminDocSnap.data().role === 'admin') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
            } catch (error) {
              console.error("Error al verificar el rol de administrador:", error);
              setIsAdmin(false);
            }
          } else {
            // Manejar la autenticación anónima si no se proporciona un token
            try {
              if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
              } else {
                await signInAnonymously(auth);
              }
            } catch (error) {
              console.error("Error en la autenticación:", error);
            }
          }
          setLoading(false);
        });

        // Limpiar la suscripción al desmontar el componente
        return () => unsubscribe();
      } else {
        console.error("Firebase no está configurado. Revisa tus credenciales.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error en la inicialización de Firebase:", error);
      setLoading(false);
    }
  }, []);

  // Hook para escuchar los cambios en la colección 'mesas' de Firestore en tiempo real
  useEffect(() => {
    let unsubscribe = () => {};
    if (isAdmin) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const q = collection(db, `/artifacts/${appId}/public/data/mesas`);
        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const fetchedTables = [];
          querySnapshot.forEach((doc) => {
            fetchedTables.push({ id: doc.id, ...doc.data() });
          });
          // Ordenar los datos alfabéticamente por 'id'
          fetchedTables.sort((a, b) => a.id.localeCompare(b.id));
          setTables(fetchedTables);
        }, (error) => {
          console.error("Error al obtener las mesas:", error);
        });
      }
    }
    // Limpiar la suscripción al desmontar o si isAdmin cambia a false
    return () => unsubscribe();
  }, [isAdmin]);

  const handleAdjustVotes = async (tableId, newVotes) => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    if (Object.keys(firebaseConfig).length > 0) {
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      try {
        const tableDocRef = doc(db, `/artifacts/${appId}/public/data/mesas`, tableId);
        await setDoc(tableDocRef, { votes: newVotes }, { merge: true });
        console.log(`Votos de la mesa ${tableId} actualizados correctamente.`);
      } catch (error) {
        console.error("Error al ajustar los votos:", error);
      }
    }
  };

  const handleViewResults = (tableId) => {
    console.log(`Ver resultados de la mesa ${tableId}`);
    // Aquí puedes agregar la lógica para mostrar un modal o redirigir a otra página
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Acceso Denegado</h1>
          <p className="text-gray-700">No tienes permisos de administrador para ver esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-extrabold text-gray-900">Panel de Administración</h1>
        <div className="text-gray-600">
          <p>Tu ID de usuario: <span className="font-mono text-xs break-all">{userId}</span></p>
        </div>
      </header>

      <main className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Resumen de Votos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800">Total Votos Alianza</h3>
              <p className="text-3xl font-bold text-blue-900">0</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800">Total Votos Candidato A</h3>
              <p className="text-3xl font-bold text-green-900">0</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800">Total Votos Candidato B</h3>
              <p className="text-3xl font-bold text-red-900">0</p>
            </div>
          </div>
        </div>

        <Table
          data={tables}
          onAdjustVotes={handleAdjustVotes}
          onViewResults={handleViewResults}
        />
      </main>
    </div>
  );
}