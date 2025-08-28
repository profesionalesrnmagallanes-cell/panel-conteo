"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Votos = {
  presidente: { [key: string]: number; };
  diputado: { [key: string]: number; };
};

const USER_ID_TO_MESA_ID: { [key: string]: string } = {
  "giXA2LVDIhQfRW9qeZenKRLExZ63": "mesa_1",
  "daNL4OkUmBRa7zMfdtyW7mTjqjF3": "mesa_2",
  "6NOrwtH3DXcqRQOaTXnd3cmkhaY2": "mesa_3",
};

const CANDIDATOS_MAP = {
  presidente: {
    "fenomeno": "fenomeno",
    "uno": "fenomeno",
    "1": "fenomeno",
    "candonga": "candonga",
    "dos": "candonga",
    "2": "candonga",
    "pasto seco": "pasto seco",
    "tres": "pasto seco",
    "3": "pasto seco",
    "blanco": "blancos",
    "nulo": "nulos",
  },
  diputado: {
    "manoslimpias": "manoslimpias",
    "uno": "manoslimpias",
    "1": "manoslimpias",
    "cascote": "cascote",
    "dos": "cascote",
    "2": "cascote",
    "blanco": "blancos",
    "nulo": "nulos",
  }
};

const CARGOS = ["presidente", "diputado"];
const MESAS = ["mesa_1", "mesa_2", "mesa_3"];

export default function Home() {
  const [resultados, setResultados] = useState<Votos | null>(null);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const resultadosPorMesa: { [key: string]: Votos } = {};

    const consolidarResultados = () => {
      const resultadosConsolidados: Votos = {
        presidente: {},
        diputado: {},
      };

      for (const mesaId of MESAS) {
        const mesaData = resultadosPorMesa[mesaId];
        if (mesaData) {
          for (const cargo of CARGOS) {
            const candidatos = mesaData[cargo as keyof Votos];
            if (candidatos) {
              for (const candidato in candidatos) {
                if (candidatos.hasOwnProperty(candidato)) {
                  resultadosConsolidados[cargo as keyof Votos][candidato] = (resultadosConsolidados[cargo as keyof Votos][candidato] || 0) + (candidatos[candidato as keyof typeof candidatos] || 0);
                }
              }
            }
          }
        }
      }
      setResultados(resultadosConsolidados);
    };

    for (const mesaId of MESAS) {
      const docRef = doc(db, "resultados_mesas", mesaId);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          resultadosPorMesa[mesaId] = docSnap.data() as Votos;
        } else {
          resultadosPorMesa[mesaId] = { presidente: {}, diputado: {} };
        }
        consolidarResultados();
      }, (error) => {
        console.error(`Error al escuchar la mesa ${mesaId}:`, error);
      });
      unsubscribes.push(unsubscribe);
    }

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  if (!resultados) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Cargando resultados...</p>
      </div>
    );
  }

  const candidatos = {
    presidente: Object.keys(CANDIDATOS_MAP.presidente),
    diputado: Object.keys(CANDIDATOS_MAP.diputado),
  };

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Resultados Electorales Consolidados</h1>
      <div className="results-grid">
        <div className="cargo-card">
          <h2>Presidente</h2>
          <ul>
            {candidatos.presidente.map((candidato, index) => (
              <li key={index}>
                {CANDIDATOS_MAP.presidente[candidato as keyof typeof CANDIDATOS_MAP["presidente"]]}
                : **{resultados.presidente[CANDIDATOS_MAP.presidente[candidato as keyof typeof CANDIDATOS_MAP["presidente"]]] || 0}**
              </li>
            ))}
          </ul>
        </div>
        <div className="cargo-card">
          <h2>Diputado</h2>
          <ul>
            {candidatos.diputado.map((candidato, index) => (
              <li key={index}>
                {CANDIDATOS_MAP.diputado[candidato as keyof typeof CANDIDATOS_MAP["diputado"]]}
                : **{resultados.diputado[CANDIDATOS_MAP.diputado[candidato as keyof typeof CANDIDATOS_MAP["diputado"]]] || 0}**
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
