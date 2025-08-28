"use client";

import { useEffect, useState, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";

// Agrega esta línea para declarar el tipo de SpeechRecognition
declare const SpeechRecognition: any;

type Votos = {
  presidente: { [key: string]: number; };
  diputado: { [key: string]: number; };
};

// Mapeo simple de usuarios (por UID) a mesas
const USER_ID_TO_MESA_ID: { [key: string]: string } = {
  "giXA2LVDIhQfRW9qeZenKRLExZ63": "mesa_1", // jorgemunozj@gmail.com
  "daNL4OkUmBRa7zMfdtyW7mTjqjF3": "mesa_2", // blanca.barria1956@gmail.com
  "6NOrwtH3DXcqRQOaTXnd3cmkhaY2": "mesa_3", // cesar.alvarado.barria@gmail.com
};

// Mapeo de sinónimos y números a nombres de candidatos y tipos de voto
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
    "voto en blanco": "blancos",
    "voto nulo": "nulos",
    "nulo": "nulos",
    "anulado": "nulos",
  },
  diputado: {
    "manoslimpias": "manoslimpias",
    "uno": "manoslimpias",
    "1": "manoslimpias",
    "cascote": "cascote",
    "dos": "cascote",
    "2": "cascote",
    "blanco": "blancos",
    "voto en blanco": "blancos",
    "voto nulo": "nulos",
    "nulo": "nulos",
    "anulado": "nulos",
  }
};

export default function VotoPage() {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [lastVoto, setLastVoto] = useState<{ cargo: string; candidato: string, tipo?: 'objetado' } | null>(null); // Guardamos el último voto y su tipo
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (authReady && currentUser && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "es-CL";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        setLastCommand(transcript);
        handleVoiceCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Error de reconocimiento de voz:", event.error);
        if (event.error === 'not-allowed') {
          setError('Necesitas dar permiso al micrófono. Recarga la página y acepta el permiso.');
        } else {
          setError(`Error de reconocimiento de voz: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }
  }, [authReady, currentUser, isListening]);

  const toggleListening = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        setError(null);
        recognitionRef.current.start();
        setIsListening(true);
      }
    }
  };

  const parsearVoto = (text: string): { cargo: string; candidato: string, tipo?: 'objetado' } | null => {
    const palabras = text.split(" ");
    const cargo = palabras[0];
    let candidatoRaw = palabras.slice(1).join(" ").trim();
    let tipoVoto: 'objetado' | undefined = undefined;

    if (candidatoRaw.includes("objetado")) {
      tipoVoto = 'objetado';
      candidatoRaw = candidatoRaw.replace("objetado", "").trim();
    }

    if (cargo in CANDIDATOS_MAP) {
      const cargoMap = CANDIDATOS_MAP[cargo as keyof typeof CANDIDATOS_MAP];
      const candidatoNormalizado = cargoMap[candidatoRaw as keyof typeof cargoMap] || null;

      if (candidatoNormalizado) {
        return { cargo, candidato: candidatoNormalizado, tipo: tipoVoto };
      }
    }
    return null;
  };

  const handleVoiceCommand = async (text: string) => {
    if (!currentUser) {
      console.error("No hay usuario autenticado. No se puede contar.");
      return;
    }

    const mesaId = USER_ID_TO_MESA_ID[currentUser.uid];
    if (!mesaId) {
      console.error(`Usuario ${currentUser.uid} no tiene una mesa asignada.`);
      return;
    }

    const voto = parsearVoto(text);

    if (voto) {
      try {
        const votosDocRef = doc(db, "resultados_mesas", mesaId);
        const docSnap = await getDoc(votosDocRef);
        const cargoKey = voto.cargo as keyof Votos;
        const candidatoKey = voto.candidato;
        const tipoKey = voto.tipo ? `${candidatoKey}-objetado` : candidatoKey; // Nueva clave para votos objetados

        if (docSnap.exists()) {
          const data = docSnap.data() as any; // Usamos 'any' temporalmente para la nueva estructura
          const votosActuales = data[cargoKey] || {};
          const nuevoVoto = (votosActuales[tipoKey] || 0) + 1;
          
          await updateDoc(votosDocRef, {
            [cargoKey]: {
              ...votosActuales,
              [tipoKey]: nuevoVoto,
            },
          });
        } else {
          const nuevoDoc: any = {
            presidente: {},
            diputado: {},
          };
          nuevoDoc[cargoKey][tipoKey] = 1;
          await setDoc(votosDocRef, nuevoDoc);
        }
        console.log(`Voto registrado: ${voto.cargo} para ${voto.candidato}${voto.tipo ? ' (objetado)' : ''}`);
        setLastVoto(voto);
      } catch (e) {
        console.error("Error al escribir en la base de datos: ", e);
      }
    }
  };

  const undoLastCommand = async () => {
    if (!lastVoto) {
      setError("No hay un comando previo para deshacer.");
      return;
    }

    if (!currentUser) {
      setError("No hay usuario autenticado.");
      return;
    }

    const mesaId = USER_ID_TO_MESA_ID[currentUser.uid];
    if (!mesaId) {
      setError("Tu usuario no está asignado a una mesa.");
      return;
    }

    try {
      const votosDocRef = doc(db, "resultados_mesas", mesaId);
      const docSnap = await getDoc(votosDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        const cargoKey = lastVoto.cargo as keyof Votos;
        const candidatoKey = lastVoto.candidato;
        const tipoKey = lastVoto.tipo ? `${candidatoKey}-objetado` : candidatoKey;

        const votosActuales = data[cargoKey] || {};
        const votosRestantes = (votosActuales[tipoKey] || 1) - 1;

        if (votosRestantes <= 0) {
          const nuevosVotos = { ...votosActuales };
          delete nuevosVotos[tipoKey];
          await updateDoc(votosDocRef, { [cargoKey]: nuevosVotos });
        } else {
          await updateDoc(votosDocRef, {
            [cargoKey]: {
              ...votosActuales,
              [tipoKey]: votosRestantes,
            },
          });
        }
        console.log(`Último voto deshecho: ${lastVoto.cargo} para ${lastVoto.candidato}${lastVoto.tipo ? ' (objetado)' : ''}`);
        setLastVoto(null);
        setError(null);
      }
    } catch (e) {
      console.error("Error al deshacer el voto: ", e);
      setError("Error al deshacer el voto.");
    }
  };

  if (!authReady) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Cargando autenticación...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Necesitas <a href="/login">iniciar sesión</a> para contar votos.</p>
      </div>
    );
  }

  const mesaActual = USER_ID_TO_MESA_ID[currentUser.uid];
  if (!mesaActual) {
    return (
      <div className="container" style={{ marginTop: 40 }}>
        <p>Tu usuario no está asignado a ninguna mesa. Contacta a un administrador.</p>
      </div>
    );
  }

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Panel de Conteo por Voz</h1>
      <p>ID de la mesa asignada: **{mesaActual}**</p>
      <p>Di "presidente [candidato]" o "diputado [candidato]".</p>
      <p>Para un voto objetado, di "[candidato] objetado".</p>
      <div className="button-container">
        <button onClick={toggleListening} className={isListening ? 'stop' : 'start'}>
          {isListening ? "Detener Conteo" : "Iniciar Conteo"}
        </button>
        <button onClick={undoLastCommand} className="undo" disabled={!lastVoto}>
          Deshacer Último Voto
        </button>
      </div>
      {lastCommand && <p className="command-display">Último comando: {lastCommand}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
