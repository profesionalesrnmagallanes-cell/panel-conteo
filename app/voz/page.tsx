"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from 'next/navigation';
import { app } from "@/lib/firebase";

export default function VozPage() {
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);
  const [votos, setVotos] = useState(0); // Estado para contar los votos
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    // Escucha los cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si hay un usuario autenticado, establece el estado
        setUser(user);
      } else {
        // Si no hay un usuario, redirige a la página de login
        router.push("/login");
      }
    });

    // Detiene la escucha cuando el componente se desmonta
    return () => unsubscribe();
  }, [auth, router]);

  const startRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("El navegador no soporta el reconocimiento de voz.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "es-CL";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setText(transcript);

      // Lógica de conteo de votos
      const palabraClave = "pasto seco";
      const regex = new RegExp(`\\b${palabraClave}\\b`, 'g');
      const matches = transcript.match(regex) || [];
      if (matches.length > 0) {
        setVotos(prevVotos => prevVotos + matches.length);
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      alert(`Error en el reconocimiento de voz: ${event.error}`);
    };

    recognition.start();
  };

  // Muestra un mensaje de carga mientras se verifica el estado de autenticación
  if (!user) {
    return (
      <div className="container card" style={{ marginTop: 40 }}>
        <h1>Cargando...</h1>
      </div>
    );
  }

  // Muestra el contenido de la página solo si el usuario está autenticado
  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Registro por Voz</h1>
      <button onClick={startRecognition}>
        <span role="img" aria-label="microphone">🎤</span> Empezar dictado
      </button>
      <p style={{ marginTop: 20 }}>
        **Texto detectado:**
        <br />
        {text}
      </p>
      <h2 style={{ marginTop: 20 }}>Votos Contados: {votos}</h2>
    </div>
  );
}
