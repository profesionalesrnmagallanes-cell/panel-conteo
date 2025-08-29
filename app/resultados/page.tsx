"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import GraficoVotos from "@/components/GraficoVotos";

// Define la estructura de los votos
type Votos = {
  [key: string]: {
    [key: string]: number;
  };
};

export default function ResultadosPage() {
  const [resultados, setResultados] = useState<Votos | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cargoSeleccionado, setCargoSeleccionado] = useState<string>('presidente');

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!authReady || !currentUser) {
      return;
    }

    const resultadosCollectionRef = collection(db, "resultados_mesas");

    const unsubscribe = onSnapshot(resultadosCollectionRef, (querySnapshot) => {
      const allData: Votos = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Votos;
        for (const cargo in data) {
          if (!allData[cargo]) {
            allData[cargo] = {};
          }
          for (const candidato in data[cargo]) {
            if (!allData[cargo][candidato]) {
              allData[cargo][candidato] = 0;
            }
            allData[cargo][candidato] += data[cargo][candidato];
          }
        }
      });
      setResultados(allData);
    });

    return () => unsubscribe();
  }, [authReady, currentUser]);

  if (!authReady) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Cargando autenticación...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Necesitas <a href="/login">iniciar sesión</a> para ver los resultados.</p>
      </div>
    );
  }

  const handleCargoChange = (cargo: string) => {
    setCargoSeleccionado(cargo);
  };

  const votosDelCargo = resultados ? resultados[cargoSeleccionado] : {};
  const tituloGrafico = `Resultados para ${cargoSeleccionado.charAt(0).toUpperCase() + cargoSeleccionado.slice(1)}`;

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Resultados Consolidados</h1>
      
      <div className="flex space-x-4 mb-8">
        <button 
          onClick={() => handleCargoChange('presidente')} 
          className={`button ${cargoSeleccionado === 'presidente' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Presidente
        </button>
        <button 
          onClick={() => handleCargoChange('diputado')} 
          className={`button ${cargoSeleccionado === 'diputado' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Diputado
        </button>
      </div>

      {resultados ? (
        <GraficoVotos votos={votosDelCargo} titulo={tituloGrafico} />
      ) : (
        <p>No hay resultados disponibles.</p>
      )}

      <div style={{ marginTop: 40 }}>
        <h2 className="text-xl font-semibold mb-2">{tituloGrafico} (Datos de tabla)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Candidato</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>Votos</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(votosDelCargo).map((candidato) => (
              <tr key={candidato}>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{candidato.charAt(0).toUpperCase() + candidato.slice(1)}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{votosDelCargo[candidato]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}