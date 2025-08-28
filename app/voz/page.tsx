"use client";

import { useState, useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from 'next/navigation';
import { app, db } from "@/lib/firebase"; // Importar 'db'
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";

export default function VozPage() {
  const [text, setText] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [votos, setVotos] = useState({
    presidente: {
      "fenomeno": 0,
      "candonga": 0,
      "pasto seco": 0,
      "blancos": 0,
      "nulos": 0,
    },
    diputado: {
      "manoslimpias": 0,
      "cascote": 0,
      "blancos": 0,
      "nulos": 0,
    },
  });
  const router = useRouter();
  const auth = getAuth(app);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Cargar los votos existentes de Firestore
        const votosDocRef = doc(db, "resultados", "votos-2025");
        const docSnap = await getDoc(votosDocRef);
        if (docSnap.exists()) {
          setVotos(docSnap.data() as any);
        } else {
          // Si el documento no existe, crearlo
          await setDoc(votosDocRef, votos);
        }
        
        // Escuchar cambios en tiempo real
        const unsubscribeFirestore = onSnapshot(votosDocRef, (doc) => {
          if (doc.exists()) {
            setVotos(doc.data() as any);
          }
        });

        return () => unsubscribeFirestore();

      } else {
        setUser(null);
        router.push("/login");
      }
    });

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      unsubscribeAuth();
    };
  }, [auth, router]);

  const startRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("El navegador no soporta el reconocimiento de voz.");
      return;
    }

    if (recognitionRef.current) return;

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "es-CL";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();
      setText(transcript);

      const votosDocRef = doc(db, "resultados", "votos-2025");
      const updatedVotos = { ...votos };

      // Lógica de conteo para Presidente
      const presidenteCandidatos = {
        "fenomeno": ["fenomeno", "uno", "1"],
        "candonga": ["candonga", "dos", "2"],
        "pasto seco": ["pasto seco", "tres", "3"],
        "blancos": ["blancos"],
        "nulos": ["nulos"],
      };

      let votoRegistrado = false;
      for (const candidato in presidenteCandidatos) {
        if (presidenteCandidatos[candidato].some(alias => transcript.includes(alias))) {
          updatedVotos.presidente[candidato] += 1;
          votoRegistrado = true;
        }
      }

      // Lógica de conteo para Diputado
      const diputadoCandidatos = {
        "manoslimpias": ["manoslimpias", "uno", "1"],
        "cascote": ["cascote", "dos", "2"],
        "blancos": ["blancos"],
        "nulos": ["nulos"],
      };

      for (const candidato in diputadoCandidatos) {
        if (diputadoCandidatos[candidato].some(alias => transcript.includes(alias))) {
          updatedVotos.diputado[candidato] += 1;
          votoRegistrado = true;
        }
      }

      if (votoRegistrado) {
        await updateDoc(votosDocRef, updatedVotos);
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      alert(`Error en el reconocimiento de voz: ${event.error}`);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  if (!user) {
    return (
      <div className="container card" style={{ marginTop: 40 }}>
        <h1>Cargando...</h1>
      </div>
    );
  }

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Registro por Voz</h1>
      <button onClick={startRecognition} style={{ marginRight: 10 }}>
        <span role="img" aria-label="microphone">🎤</span> Empezar dictado
      </button>
      <button onClick={stopRecognition}>
        <span role="img" aria-label="stop">⏹️</span> Detener dictado
      </button>
      <p style={{ marginTop: 20 }}>
        **Texto detectado:**
        <br />
        {text}
      </p>
      <h2 style={{ marginTop: 20 }}>Conteo de Votos</h2>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20 }}>
        <div>
          <h3>PRESIDENTE</h3>
          <ul>
            {Object.keys(votos.presidente).map((candidato) => (
              <li key={candidato}>{candidato.charAt(0).toUpperCase() + candidato.slice(1)}: {votos.presidente[candidato]}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>DIPUTADO</h3>
          <ul>
            {Object.keys(votos.diputado).map((candidato) => (
              <li key={candidato}>{candidato.charAt(0).toUpperCase() + candidato.slice(1)}: {votos.diputado[candidato]}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
