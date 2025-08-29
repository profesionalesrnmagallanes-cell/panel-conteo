'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, where } from 'firebase/firestore';

// Definimos los tipos de las props para el componente
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

// Se obtienen las variables de configuración de Firebase desde el entorno
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

export default function Filters({
  eleccionId, setEleccionId,
  cargoId, setCargoId,
  localId, setLocalId,
  mesaId, setMesaId
}: Props) {
  const [elecciones, setElecciones] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [locales, setLocales] = useState<string[]>([]);
  const [mesas, setMesas] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeAll: (() => void)[] = [];

    const setupFirebase = async () => {
      try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // Autenticación con token personalizado o de forma anónima
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }

        const userId = auth.currentUser?.uid || crypto.randomUUID();
        const basePath = `/artifacts/${appId}/users/${userId}`;

        // Oyente para la colección de elecciones
        const qElecciones = query(collection(db, `${basePath}/elecciones`));
        unsubscribeAll.push(onSnapshot(qElecciones, (snapshot) => {
          const fetchedElecciones: string[] = snapshot.docs.map(doc => doc.id);
          setElecciones(fetchedElecciones);
        }));

        // Oyente para la colección de cargos
        const qCargos = query(collection(db, `${basePath}/cargos`));
        unsubscribeAll.push(onSnapshot(qCargos, (snapshot) => {
          const fetchedCargos: string[] = snapshot.docs.map(doc => doc.id);
          setCargos(fetchedCargos);
        }));

        // Oyente para la colección de locales
        const qLocales = query(collection(db, `${basePath}/locales`));
        unsubscribeAll.push(onSnapshot(qLocales, (snapshot) => {
          const fetchedLocales: string[] = snapshot.docs.map(doc => doc.id);
          setLocales(fetchedLocales);
        }));

        // Oyente para la colección de mesas
        // La consulta de mesas ahora puede ser más compleja
        const qMesas = query(collection(db, `${basePath}/mesas`));
        unsubscribeAll.push(onSnapshot(qMesas, (snapshot) => {
          const fetchedMesas: string[] = snapshot.docs.map(doc => doc.id);
          setMesas(fetchedMesas);
          setLoading(false);
        }, (error) => {
          console.error("Error al obtener datos:", error);
          setLoading(false);
        }));

      } catch (error) {
        console.error("Error al configurar Firebase:", error);
        setLoading(false);
      }
    };

    setupFirebase();

    return () => {
      // Limpiamos todos los oyentes al desmontar el componente
      unsubscribeAll.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2>Filtros</h2>
      <div className="row">
        <div className="select">
          <label>Elección</label>
          <select value={eleccionId} onChange={e => setEleccionId(e.target.value)} disabled={loading}>
            {loading ? (
              <option value="">Cargando...</option>
            ) : (
              elecciones.map(elec => <option key={elec} value={elec}>{elec}</option>)
            )}
          </select>
        </div>

        <div className="select">
          <label>Cargo</label>
          <select value={cargoId} onChange={e => setCargoId(e.target.value)} disabled={loading}>
            {loading ? (
              <option value="">Cargando...</option>
            ) : (
              cargos.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)
            )}
          </select>
        </div>

        <div className="select">
          <label>Local</label>
          <select value={localId} onChange={e => setLocalId(e.target.value)} disabled={loading}>
            <option value="todos">Todos</option>
            {loading ? (
              <option value="">Cargando...</option>
            ) : (
              locales.map(local => <option key={local} value={local}>{local}</option>)
            )}
          </select>
        </div>

        <div className="select">
          <label>Mesa</label>
          <select value={mesaId} onChange={e => setMesaId(e.target.value)} disabled={loading}>
            <option value="todas">Todas</option>
            {loading ? (
              <option value="">Cargando...</option>
            ) : (
              mesas.map(mesa => <option key={mesa} value={mesa}>{mesa}</option>)
            )}
          </select>
        </div>
      </div>
    </div>
  );
}