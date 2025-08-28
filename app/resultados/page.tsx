"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, getDoc, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";

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

  const auth = getAuth(app);

  useEffect(() => {
    // Escucha los cambios de autenticación
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

    // Escucha los cambios en la colección
    const unsubscribe = onSnapshot(resultadosCollectionRef, (querySnapshot) => {
      const allData: Votos = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Votos;
        const mesaId = doc.id;

        // Combina los resultados de cada mesa
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

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Resultados Consolidados</h1>
      {resultados ? (
        Object.keys(resultados).map((cargo) => (
          <div key={cargo} style={{ marginBottom: 20 }}>
            <h2>{cargo.charAt(0).toUpperCase() + cargo.slice(1)}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Candidato</th>
                  <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>Votos</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(resultados[cargo]).map((candidato) => (
                  <tr key={candidato}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{candidato}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{resultados[cargo][candidato]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <p>No hay resultados disponibles.</p>
      )}
    </div>
  );
}
