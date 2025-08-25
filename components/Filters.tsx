"use client";

type Props = {
  eleccionId: string;
  setEleccionId: (v: string) => void;
  cargoId: string;
  setCargoId: (v: string) => void;
  localId: string;
  setLocalId: (v: string) => void;
  mesaId: string;
  setMesaId: (v: string) => void;
};

export default function Filters({
  eleccionId, setEleccionId,
  cargoId, setCargoId,
  localId, setLocalId,
  mesaId, setMesaId
}: Props) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2>Filtros</h2>
      <div className="row">
        <div className="select">
          <label>Elección</label>
          <select value={eleccionId} onChange={e=>setEleccionId(e.target.value)}>
            <option value="2025">2025</option>
            <option value="PRUEBA">PRUEBA</option>
          </select>
        </div>

        <div className="select">
          <label>Cargo</label>
          <select value={cargoId} onChange={e=>setCargoId(e.target.value)}>
            <option value="PRE">PRE</option>
            <option value="DIP">DIP</option>
          </select>
        </div>

        <div className="select">
          <label>Local</label>
          <select value={localId} onChange={e=>setLocalId(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="LAB-PA">LAB-PA</option>
          </select>
        </div>

        <div className="select">
          <label>Mesa</label>
          <select value={mesaId} onChange={e=>setMesaId(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="LAB-PA-M1">LAB-PA-M1</option>
            <option value="LAB-PA-M2">LAB-PA-M2</option>
            <option value="LAB-PA-M3">LAB-PA-M3</option>
          </select>
        </div>
      </div>
    </div>
  );
}
