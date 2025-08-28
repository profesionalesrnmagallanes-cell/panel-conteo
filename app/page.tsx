"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ResultsTable from "@/components/ResultsTable";
import Filters from "@/components/Filters";

// Definición de tipos para las filas de la tabla de resultados
type Row = { candidatoId: string; nombre?: string; votos: number; porcentaje: number };
type Votos = {
  presidente: { [key: string]: number; };
  diputado: { [key: string]: number; };
};

// Mapeo de IDs a nombres para mostrar en la tabla
const candidatoNombres: { [key: string]: string } = {
  "fenomeno": "Fenomeno",
  "candonga": "Candonga",
  "pasto seco": "Pasto Seco",
  "blancos": "Votos en blanco",
  "nulos": "Votos nulos",
  "manoslimpias": "Manos Limpias",
  "cascote": "Cascote",
};

export default function Page() {
  const [eleccionId, setEleccionId] = useState<string>("2025");
  const [cargoId, setCargoId] = useState<string>("PRE");
  const [localId, setLocalId] = useState<string>("todos");
  const [mesaId, setMesaId] = useState<string>("todas");

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const votosDocRef = doc(db, "resultados", "votos-2025");

    const unsub = onSnapshot(
      votosDocRef,
      (docSnap) => {
        const sumByCand = new Map<string, number>();

        if (docSnap.exists()) {
          const data = docSnap.data() as Votos;
          let votosPorCargo;

          if (cargoId === "PRE") {
            votosPorCargo = data.presidente;
          } else if (cargoId === "DIP") {
            votosPorCargo = data.diputado;
          }

          if (votosPorCargo) {
            for (const candidato in votosPorCargo) {
              const votos = votosPorCargo[candidato];
              sumByCand.set(candidato, (sumByCand.get(candidato) || 0) + votos);
            }
          }
        }
        
        const totalV = Array.from(sumByCand.values()).reduce((a, b) => a + b, 0);
        const rws: Row[] = Array.from(sumByCand.entries())
          .map(([candidatoId, votos]) => ({
            candidatoId,
            nombre: candidatoNombres[candidatoId] || candidatoId,
            votos,
            porcentaje: totalV > 0 ? (votos * 100) / totalV : 0
          }))
          .sort((a, b) => b.votos - a.votos);

        setRows(rws);
        setTotal(totalV);
        setLoading(false);
      },
      (error) => {
        console.error("Error al escuchar resultados: ", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [cargoId]);

  return (
    <div className="container" style={{ marginTop: 40 }}>
      <h1>Resultados en tiempo real</h1>

      <Filters
        eleccionId={eleccionId}
        setEleccionId={setEleccionId}
        cargoId={cargoId}
        setCargoId={setCargoId}
        localId={localId}
        setLocalId={setLocalId}
        mesaId={mesaId}
        setMesaId={setMesaId}
      />

      <ResultsTable rows={rows} totalVotos={total} loading={loading} />
    </div>
  );
}
