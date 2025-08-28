"use client";

import { useEffect, useState, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";

type Votos = {
  presidente: { [key: string]: number; };
  diputado: { [key: string]: number; };
};

// Mapeo simple de usuarios (por UID) a mesas
// El administrador no cuenta votos, así que su UID no está en la lista.
const USER_ID_TO_MESA_ID: { [key: string]: string } = {
  "giXA2LVDIhQfRW9qeZenKRLExZ63": "mesa_1", // jorgemunozj@gmail.com
  "daNL4OkUmBRa7zMfdtyW7mTjqjF3": "mesa_2", // blanca.barria1956@gmail.com
  "6NOrwtH3DXcqRQOaTXnd3cmkhaY2": "mesa_3", // cesar.alvarado.barria@gmail.com
};

export default function VotoPage() {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const auth = getAuth(app);

  useEffect(() => {
    // Escuchar el estado de autenticación
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

  const parsearVoto = (text: string): { cargo: string; candidato: string } | null => {
    const palabras = text.split(" ");
    const cargo = palabras[0]; // Asume que la primera palabra es el cargo
    const candidato = palabras.slice(1).join(" "); // El resto es el candidato

    if (cargo === "presidente" || cargo === "diputado") {
      return { cargo, candidato };
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

        if (docSnap.exists()) {
          const data = docSnap.data() as Votos;
          const votosActuales = data[voto.cargo as keyof Votos] || {};
          const nuevoVoto = votosActuales[voto.candidato] || 0;
          
          await updateDoc(votosDocRef, {
            [voto.cargo]: {
              ...votosActuales,
              [voto.candidato]: nuevoVoto + 1,
            },
          });
        } else {
          const nuevoDoc: Votos = {
            presidente: {},
            diputado: {},
          };
          nuevoDoc[voto.cargo as keyof Votos][voto.candidato] = 1;

          await setDoc(votosDocRef, nuevoDoc);
        }
        console.log(`Voto registrado: ${voto.cargo} para ${voto.candidato}`);
      } catch (e) {
        console.error("Error al escribir en la base de datos: ", e);
      }
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
      <p>Di "presidente [candidato]" o "diputado [candidato]"</p>
      <button onClick={toggleListening} className={isListening ? 'stop' : 'start'}>
        {isListening ? "Detener Conteo" : "Iniciar Conteo"}
      </button>
      {lastCommand && <p className="command-display">Último comando: {lastCommand}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
