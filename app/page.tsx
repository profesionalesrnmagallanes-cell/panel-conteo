"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ResultsTable from "@/components/ResultsTable";
import Filters from "@/components/Filters";

type Row = { candidatoId: string; nombre?: string; votos: number; porcentaje: number };

export default function Page() {
  // Filtros simples (coinciden con components/Filters.tsx)
  const [eleccionId, setEleccionId] = useState<string>("2025");
  const [cargoId, setCargoId]        = useState<string>("PRE");
  const [localId, setLocalId]        = useState<string>("todos");
  const [mesaId, setMesaId]          = useState<string>("todas");

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Suscripción en vivo a /resultados filtrando por eleccionId y cargoId
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "resultados"),
      where("eleccionId", "==", eleccionId),
      where("cargoId", "==", cargoId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const sumByCand = new Map<string, number>();

        snap.forEach((d) => {
          const data = d.data() as any;
          const v = typeof data.votos === "number" ? data.votos : Number(data.votos || 0);

          // filtros de local/mesa (en cliente)
          if (localId !== "todos" && data.localId !== localId) return;
          if (mesaId !== "todas" && data.mesaId !== mesaId) return;

          sumByCand.set(data.candidatoId, (sumByCand.get(data.candidatoId) || 0) + v);
        });

        const totalV = Array.from(sumByCand.values()).reduce((a, b) => a + b, 0);
        const rws: Row[] = Array.from(sumByCand.entries())
          .map(([candidatoId, votos]) => ({
            candidatoId,
            votos,
            porcentaje: totalV > 0 ? (votos * 100) / totalV : 0
          }))
          .sort((a, b) => b.votos - a.votos);

        setRows(rws);
        setTotal(totalV);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [eleccionId, cargoId, localId, mesaId]);

  return (
    <div className="container">
      <h1>Resultados en tiempo real</h1>

      {/* Filtros (props EXACTOS que espera components/Filters.tsx) */}
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

      <div className="spacer" />
      <div className="card small">
        <b>Estructura esperada en Firestore</b>
        <ul>
          <li>Colección: <code>resultados</code></li>
          <li>Campos: <code>eleccionId, localId, mesaId, cargoId, candidatoId, votos</code></li>
          <li>Ejemplo: <code>{`{ eleccionId:"2025", localId:"LAB-PA", mesaId:"LAB-PA-M1", cargoId:"PRE", candidatoId:"PRE-0001", votos: 10 }`}</code></li>
        </ul>
      </div>
    </div>
  );
}
