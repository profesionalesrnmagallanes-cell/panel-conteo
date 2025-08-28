"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Votos = {
  presidente: { [key: string]: number; };
  diputado: { [key: string]: number; };
};

const cargos = ["presidente", "diputado"];
const candidatos = {
  presidente: ["gabriel boric", "jose antonio kast", "franco parisi", "sebastián sichel"],
  diputado: ["candidato 1", "candidato 2", "candidato 3"]
};

export default function Home() {
  const [votosTotales, setVotosTotales] = useState<Votos | null>(null);
  const [votosPorMesa, setVotosPorMesa] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const mesas = ["mesa_1", "mesa_2", "mesa_3"];
    
    // Inicializar votos en 0
    const votosTotalesInicial: Votos = { presidente: {}, diputado: {} };
    cargos.forEach(cargo => {
      candidatos[cargo as keyof typeof candidatos].forEach(candidato => {
        votosTotalesInicial[cargo as keyof Votos][candidato] = 0;
      });
    });

    setVotosTotales(votosTotalesInicial);

    mesas.forEach(mesa => {
      const mesaDocRef = doc(db, "resultados_mesas", mesa);

      const unsubscribe = onSnapshot(mesaDocRef, (docSnap) => {
        const datosMesa = docSnap.exists() ? (docSnap.data() as Votos) : null;
        
        setVotosPorMesa(prev => {
          const updatedVotosPorMesa = {
            ...prev,
            [mesa]: datosMesa,
          };
          
          let nuevosVotosTotales = { ...votosTotalesInicial };
          cargos.forEach(cargo => {
            candidatos[cargo as keyof typeof candidatos].forEach(candidato => {
              Object.values(updatedVotosPorMesa).forEach((tableData: any) => {
                if (tableData && tableData[cargo] && tableData[cargo][candidato]) {
                  nuevosVotosTotales[cargo as keyof Votos][candidato] += tableData[cargo][candidato];
                }
              });
            });
          });

          setVotosTotales(nuevosVotosTotales);
          setLoading(false);
          return updatedVotosPorMesa;
        });
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Cargando resultados...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: 40 }}>
      <h1>Resultados de Votación por Mesa</h1>
      
      {Object.keys(votosPorMesa).length > 0 ? (
        Object.keys(votosPorMesa).map(mesaId => (
          <div key={mesaId} className="card" style={{ marginBottom: 20 }}>
            <h2>Mesa {mesaId.split('_')[1]}</h2>
            {votosPorMesa[mesaId] && Object.keys(votosPorMesa[mesaId]).length > 0 ? (
              cargos.map(cargo => (
                <div key={cargo}>
                  <h3>Votos para {cargo}</h3>
                  <ul>
                    {candidatos[cargo as keyof typeof candidatos].map(candidato => (
                      <li key={candidato}>
                        **{candidato.toUpperCase()}**: {votosPorMesa[mesaId][cargo]?.[candidato] || 0}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p>No hay votos registrados para esta mesa.</p>
            )}
          </div>
        ))
      ) : (
        <p>No se encontraron resultados.</p>
      )}

      <h1>Resultados Totales Consolidados</h1>
      <div className="card">
        {votosTotales && Object.keys(votosTotales).length > 0 ? (
          cargos.map(cargo => (
            <div key={cargo}>
              <h2>Votos para {cargo}</h2>
              <ul>
                {candidatos[cargo as keyof typeof candidatos].map(candidato => (
                  <li key={candidato}>
                    **{candidato.toUpperCase()}**: {votosTotales[cargo as keyof Votos][candidato] || 0}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </div>
    </div>
  );
}
