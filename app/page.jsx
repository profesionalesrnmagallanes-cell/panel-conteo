"use client";

import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, getDoc, onSnapshot, collection, query, where, getDocs, setDoc, addDoc } from 'firebase/firestore';

// Componente para la ventana modal de resultados
const ResultsModal = ({ table, onClose }) => {
  if (!table) {
    return null;
  }

  const { id, votes } = table;
  const totalVotes = votes.alliance + votes.candidateA + votes.candidateB;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-900">Resultados de la Mesa: {id}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-gray-700 space-y-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-lg font-semibold text-blue-800">Votos de la Alianza</p>
            <p className="text-2xl font-bold text-blue-900">{votes.alliance}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-md">
            <p className="text-lg font-semibold text-green-800">Votos Candidato A</p>
            <p className="text-2xl font-bold text-green-900">{votes.candidateA}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-lg font-semibold text-red-800">Votos Candidato B</p>
            <p className="text-2xl font-bold text-red-900">{votes.candidateB}</p>
          </div>
          <hr className="my-4 border-t border-gray-300" />
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="text-lg font-semibold text-gray-800">Total de Votos</p>
            <p className="text-2xl font-bold text-gray-900">{totalVotes}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

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
                      onClick={() => onViewResults(item)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Ver Resultados
                    </button>
                    <button
                      onClick={() => handleEdit(item.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Ajustar Votos
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
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // Estados para los totales de votos
  const [totalAlliance, setTotalAlliance] = useState(0);
  const [totalCandidateA, setTotalCandidateA] = useState(0);
  const [totalCandidateB, setTotalCandidateB] = useState(0);

  useEffect(() => {
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

      if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

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
          let tempTotalAlliance = 0;
          let tempTotalCandidateA = 0;
          let tempTotalCandidateB = 0;

          querySnapshot.forEach((doc) => {
            const tableData = doc.data();
            fetchedTables.push({ id: doc.id, ...tableData });

            // Sumar los votos para el total general
            if (tableData.votes) {
              tempTotalAlliance += tableData.votes.alliance || 0;
              tempTotalCandidateA += tableData.votes.candidateA || 0;
              tempTotalCandidateB += tableData.votes.candidateB || 0;
            }
          });

          fetchedTables.sort((a, b) => a.id.localeCompare(b.id));
          setTables(fetchedTables);

          // Actualizar los estados de los totales
          setTotalAlliance(tempTotalAlliance);
          setTotalCandidateA(tempTotalCandidateA);
          setTotalCandidateB(tempTotalCandidateB);

        }, (error) => {
          console.error("Error al obtener las mesas:", error);
        });
      }
    }
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

  const handleViewResults = (table) => {
    setSelectedTable(table);
    setShowResultsModal(true);
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
              <p className="text-3xl font-bold text-blue-900">{totalAlliance}</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800">Total Votos Candidato A</h3>
              <p className="text-3xl font-bold text-green-900">{totalCandidateA}</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800">Total Votos Candidato B</h3>
              <p className="text-3xl font-bold text-red-900">{totalCandidateB}</p>
            </div>
          </div>
        </div>

        <Table
          data={tables}
          onAdjustVotes={handleAdjustVotes}
          onViewResults={handleViewResults}
        />
      </main>

      {showResultsModal && (
        <ResultsModal
          table={selectedTable}
          onClose={() => setShowResultsModal(false)}
        />
      )}
    </div>
  );
}