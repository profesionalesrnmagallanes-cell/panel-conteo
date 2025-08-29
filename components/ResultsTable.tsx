'use client';

import React from 'react';

type Row = {
  candidatoId: string;
  nombre?: string;
  votos: number;
  porcentaje: number; // 0..100
};

export default function ResultsTable({
  rows,
  totalVotos,
  loading
}: {
  rows: Row[];
  totalVotos: number;
  loading?: boolean;
}) {
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline"
        }}
      >
        <h2>Resultados</h2>
        <div className="kpi">
          <span className="small">Total de votos</span>
          <span className="value">{totalVotos.toLocaleString("es-CL")}</span>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 260 }}>Candidato</th>
            <th style={{ width: 100, textAlign: "right" }}>Votos</th>
            <th>Participación</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={3} className="small">
                Cargando en tiempo real...
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={3} className="small">
                Sin resultados para los filtros seleccionados.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.candidatoId}>
              <td>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{r.nombre || r.candidatoId}</span>
                  <span className="badge">{r.porcentaje.toFixed(1)}%</span>
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                {r.votos.toLocaleString("es-CL")}
              </td>
              <td>
                <div className="bar">
                  <span style={{ width: `${r.porcentaje}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="footer">
        <span className="small">
          Actualización en vivo a través de los oyentes de Firestore
        </span>
      </div>
    </div>
  );
}