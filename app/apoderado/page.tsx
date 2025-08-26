"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FormApoderado() {
  const [eleccionId, setEleccionId] = useState("2025");
  const [cargoId, setCargoId] = useState("PRE");
  const [localId, setLocalId] = useState("LAB-PA");
  const [mesaId, setMesaId] = useState("LAB-PA-M1");
  const [candidatoId, setCandidatoId] = useState("PRE-0001");
  const [votos, setVotos] = useState<string>("0");
  const [mensaje, setMensaje] = useState("");

  const handleSave = async () => {
    setMensaje("");
    const n = Number(votos);
    if (!Number.isFinite(n) || n < 0) {
      setMensaje("❌ Votos inválidos");
      return;
    }
    try {
      const docId = `${eleccionId}_${localId}_${mesaId}_${cargoId}_${candidatoId}`;
      await setDoc(doc(db, "resultados", docId), {
        eleccionId,
        cargoId,
        localId,
        mesaId,
        candidatoId,
        votos: n,
      });
      setMensaje("✅ Voto guardado correctamente");
    } catch (err: any) {
      console.error(err);
      setMensaje(`❌ Error: ${err?.code || err?.message || "desconocido"}`);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 540, margin: "0 auto" }}>
      <h1>Formulario Apoderado</h1>

      <label>Elección:</label>
      <input
        value={eleccionId}
        onChange={(e) => setEleccionId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Cargo:</label>
      <select
        value={cargoId}
        onChange={(e) => setCargoId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      >
        <option value="PRE">Presidente</option>
        <option value="DIP">Diputados</option>
      </select>

      <label>Local:</label>
      <input
        value={localId}
        onChange={(e) => setLocalId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Mesa:</label>
      <input
        value={mesaId}
        onChange={(e) => setMesaId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Candidato:</label>
      <input
        value={candidatoId}
        onChange={(e) => setCandidatoId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Votos:</label>
      <input
        type="number"
        value={votos}
        onChange={(e) => setVotos(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleSave} style={{ padding: "10px 20px" }}>
        Guardar
      </button>

      {mensaje && <p style={{ marginTop: 12 }}>{mensaje}</p>}
    </div>
  );
}
