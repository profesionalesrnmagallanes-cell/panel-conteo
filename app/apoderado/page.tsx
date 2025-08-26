"use client";

import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// IMPORTANT: These variables are provided by the canvas environment.
// DO NOT try to get them from an external file or API.
declare const __app_id: string;
declare const __firebase_config: string;
declare const __initial_auth_token: string;


export default function FormApoderado() {
  const [eleccionId, setEleccionId] = useState("2025");
  const [cargoId, setCargoId] = useState("PRE");
  const [localId, setLocalId] = useState("LAB-PA");
  const [mesaId, setMesaId] = useState("LAB-PA-M1");
  const [candidatoId, setCandidatoId] = useState("PRE-0001");
  const [votos, setVotos] = useState<number>(0);
  const [mensaje, setMensaje] = useState("");
  const [db, setDb] = useState<any>(null);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);


  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        
        setDb(firestoreDb);

        onAuthStateChanged(firebaseAuth, async (currentUser) => {
          if (currentUser) {
            setUserId(currentUser.uid);
            setIsLoading(false);
          } else {
            try {
              await signInAnonymously(firebaseAuth);
            } catch (anonError) {
              console.error("Anonymous sign-in failed", anonError);
              setIsLoading(false);
            }
          }
        });
        
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } catch (tokenError) {
            console.error("Custom token sign-in failed", tokenError);
          }
        }
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setIsLoading(false);
      }
    };
    initFirebase();
  }, []);

  const handleSave = async () => {
    if (!db || isLoading) {
      setMensaje("❌ Error: La base de datos no está lista.");
      return;
    }
    
    try {
      // Documento con ID único: eleccion_local_mesa_cargo_candidato
      const docId = `${eleccionId}_${localId}_${mesaId}_${cargoId}_${candidatoId}`;
      await setDoc(doc(db, "resultados", docId), {
        eleccionId,
        cargoId,
        localId,
        mesaId,
        candidatoId,
        votos: Number(votos),
      });
      setMensaje("✅ Voto guardado correctamente");
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error al guardar el voto");
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 20, maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "0 auto" }}>
      <h1>Formulario Apoderado</h1>

      <label>Elección:</label>
      <input
        value={eleccionId}
        onChange={(e) => setEleccionId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Cargo:</label>
      <select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
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
        onChange={(e) => setVotos(parseInt(e.target.value))}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleSave} style={{ padding: "10px 20px" }}>
        Guardar
      </button>

      {mensaje && <p>{mensaje}</p>}
    </div>
  );
}
