"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Candidato, Local, Mesa, ResultadoDoc } from "@/lib/types";
import Filters from "@/components/Filters";
import ResultsTable from "@/components/ResultsTable";

type CandidatosByCargo = Record<string, Candidato[]>;

function parseCandidatoId(docId: string): { cargoId: string; candidatoId: string } {
  const parts = docId.split(" ");
  return {
    cargoId: parts[0] || "",
    candidatoId: parts.slice(1).join(" ") || "" // por si los ID internos incluyen _
  };
}

function parseResultadoDoc(id: string, data: any): ResultadoDoc {
  // ID esperado: eleccionId_localId_mesaId_cargoId_candidatoId
  const parts = id.split(" ");
  const [eleccionId, localId, mesaId, cargoId, ...rest] = parts;
  const candidatoId = rest.join(" ");

  return {
    eleccionId: data?.eleccionId || eleccionId || "",
    localId: data?.localId || localId || "",
    mesaId: data?.mesaId || mesaId || "",
    cargoId: data?.cargoId || cargoId || "",
    candidatoId: data?.candidatoId || candidatoId || "",
    votos:
      typeof data?.votos === "number" ? data.votos : Number(data?.votos || 0)
  };
}

export default function Page() {
  const [elecciones, setElecciones] = useState<string[]>([]);
  const [locales, setLocales] = useState<Local[]>([]);
  const [comunas, setComunas] = useState<string[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);

  const [candidatosPorCargo, setCandidatosPorCargo] =
    useState<CandidatosByCargo>({});
  const cargos = useMemo(() => Object.keys(candidatosPorCargo), [candidatosPorCargo]);

  const [selectedEleccion, setSelectedEleccion] = useState<string | undefined>();
  const [selectedComuna, setSelectedComuna] = useState<string>("todas");
  const [selectedLocal, setSelectedLocal] = useState<string>("todos");
  const [selectedMesa, setSelectedMesa] = useState<string>("todas");
  const [selectedCargo, setSelectedCargo] = useState<string | undefined>();

  const [rows, setRows] = useState<
    { candidatoId: string; nombre?: string; votos: number; porcentaje: number }[]
  >([]);
  const [totalVotos, setTotalVotos] = useState<number>(0);
  const [loadingResultados, setLoadingResultados] = useState<boolean>(false);

  // Mapa localId -> comuna para filtrar por comuna
  const comunaPorLocal = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const l of locales) map.set(l.id, l.comuna);
    return map;
  }, [locales]);

  // Suscripción a locales (obtenemos también comunas)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "locales"), (snap) => {
      const locs: Local[] = [];
      const comunaSet = new Set<string>();
      snap.forEach((d) => {
        const data = d.data() as any;
        const item: Local = {
          id: d.id,
          nombre: data?.nombre,
          comuna: data?.comuna
        };
        locs.push(item);
        if (item.comuna) comunaSet.add(item.comuna);
      });
      setLocales(locs);
      setComunas(Array.from(comunaSet).sort((a, b) => a.localeCompare(b, "es")));
    });
    return () => unsub();
  }, []);

  // Suscripción a candidatos (se agrupan por cargoId)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "candidatos"), (snap) => {
      const byCargo: CandidatosByCargo = {};
      snap.forEach((d) => {
        const data = d.data() as any;
        const { cargoId, candidatoId } = parseCandidatoId(d.id);
        const cand: Candidato = {
          id: candidatoId,
          cargoId,
          candidatoId,
          nombre: data?.nombre
        };
        if (!byCargo[cargoId]) byCargo[cargoId] = [];
        byCargo[cargoId].push(cand);
      });
      // ordenar candidatos por nombre para UI determinista
      Object.keys(byCargo).forEach(cg => byCargo[cg].sort((a,b)=>(a.nombre || a.candidatoId).localeCompare(b.nombre || b.candidatoId, "es")));
      setCandidatosPorCargo(byCargo);
      // autoselección de carga si vacío
      if (!selectedCargo && Object.keys(byCargo).length > 0) {
        setSelectedCargo(Object.keys(byCargo)[0]);
      }
    });
    return () => unsub();
  }, [selectedCargo]);

  // Suscripción a elecciones (derivadas de 'resultados' - se limita a 500 documentos para UI)
  useEffect(() => {
    const q = query(collection(db, "resultados"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const setE = new Set<string>();
      snap.forEach((d) => {
        const data = d.data() as any;
        const parsed = parseResultadoDoc(d.id, data);
        if (parsed.eleccionId) setE.add(parsed.eleccionId);
      });
      const arr = Array.from(setE).sort((a, b) => b.localeCompare(a, "es"));
      setElecciones(arr);
      if (!selectedEleccion && arr.length > 0) {
        setSelectedEleccion(arr[0]);
      }
    });
    return () => unsub();
  }, [selectedEleccion]);

  // Cargar mesas del seleccionado local
  useEffect(() => {
    if (!selectedLocal || selectedLocal === "todos") {
      setMesas([]);
      setSelectedMesa("todas");
      return;
    }
    const ref = collection(
      doc(collection(db, "locales"), selectedLocal),
      "mesas"
    );
    const unsub = onSnapshot(ref, (snap) => {
      const ms: Mesa[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        ms.push({ id: d.id, numero: data?.numero || d.id });
      });
      setMesas(ms);
      // reset mesa si la que estaba seleccionada ya no existe
      if (selectedMesa !== "todas" && !ms.find((m) => m.id === selectedMesa)) {
        setSelectedMesa("todas");
      }
    });
    return () => unsub();
  }, [selectedLocal, selectedMesa]);

  // Listener de resultados en tiempo real
  useEffect(() => {
    if (!selectedEleccion || !selectedCargo) {
      setRows([]);
      setTotalVotos(0);
      return;
    }
    setLoadingResultados(true);

    // Query base: por elección y cargo
    const baseQuery = query(
      collection(db, "resultados"),
      where("eleccionId", "==", selectedEleccion),
      where("cargoId", "==", selectedCargo)
    );

    const unsub = onSnapshot(baseQuery, (snap) => {
      // Agregación por candidato
      const votosPorCandidato = new Map<string, number>();

      snap.forEach((d) => {
        const parsed = parseResultadoDoc(d.id, d.data());
        // Filtros por local/mesa/comuna aplicados en cliente
        if (selectedLocal !== "todos" && parsed.localId !== selectedLocal) return;
        if (selectedMesa !== "todas" && parsed.mesaId !== selectedMesa) return;
        if (selectedComuna !== "todas") {
          const comuna = comunaPorLocal.get(parsed.localId);
          if ((comuna || "") !== selectedComuna) return;
        }
        votosPorCandidato.set(
          parsed.candidatoId,
          (votosPorCandidato.get(parsed.candidatoId) || 0) + (parsed.votos || 0)
        );
      });

      const total = Array.from(votosPorCandidato.values()).reduce((a, b) => a + b, 0);

      // nombres de candidatos (si existen en colección candidatos)
      const nombres = new Map<string, string | undefined>();
      const listaCands = candidatosPorCargo[selectedCargo] || [];
      for (const c of listaCands) {
        nombres.set(c.candidatoId, c.nombre);
      }

      const rowsData = Array.from(votosPorCandidato.entries())
        .map(([candidatoId, votos]) => ({
          candidatoId,
          nombre: nombres.get(candidatoId),
          votos,
          porcentaje: total > 0 ? (votos * 100) / total : 0
        }))
        .sort((a, b) => b.votos - a.votos);

      setRows(rowsData);
      setTotalVotos(total);
      setLoadingResultados(false);
    }, (_e) => {
      setLoadingResultados(false);
    });

    return () => unsub();
  }, [selectedEleccion, selectedCargo, selectedLocal, selectedMesa, selectedComuna, comunaPorLocal, candidatosPorCargo]);

  // Al cambiar comuna, resetear local/mesa
  useEffect(() => {
    setSelectedLocal("todos");
    setSelectedMesa("todas");
  }, [selectedComuna]);

  return (
    <div className="container">
      <h1>Resultados en tiempo real</h1>

      <Filters
        elecciones={elecciones}
        comunas={comunas}
        locales={locales}
        mesas={mesas}
        cargos={cargos}
        selectedEleccion={selectedEleccion}
        selectedComuna={selectedComuna}
        selectedLocal={selectedLocal}
        selectedMesa={selectedMesa}
        selectedCargo={selectedCargo}
        onChangeEleccion={setSelectedEleccion}
        onChangeComuna={setSelectedComuna}
        onChangeLocal={setSelectedLocal}
        onChangeMesa={setSelectedMesa}
        onChangeCargo={setSelectedCargo}
      />

      <ResultsTable
        rows={rows}
        totalVotos={totalVotos}
        loading={loadingResultados}
      />

      <div className="spacer" />
      <div className="card small">
        Estructura de datos esperada:
        <ul>
          <li>
            /locales/{`{localId}`} con campos: nombre, comuna
          </li>
          <li>
            /locales/{`{localId}`}/mesas/{`{mesaId}`} con campos: numero
          </li>
          <li>
            /candidatos/{`{cargoId}_{candidatoId}`} con campos: nombre
          </li>
          <li>
            /resultados/{`{eleccionId}_{localId}_{mesaId}_{cargoId}_{candidatoId}`} con campos: eleccionId, localId, mesaId, cargoId, candidatoId, votos
          </li>
        </ul>
      </div>
    </div>
  );
}
