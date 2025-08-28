"use client";

import { useState } from "react";

export default function VozPage() {
  const [text, setText] = useState("");

  const startRecognition = () => {
    // Check if the browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window)) {
      alert("El navegador no soporta el reconocimiento de voz.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "es-CL";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      alert(`Error en el reconocimiento de voz: ${event.error}`);
    };

    recognition.start();
  };

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
    </div>
  );
}
