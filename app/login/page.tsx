"use client";

import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function LoginPage() {
  const auth = getAuth(app);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setError("");
    } catch (err: any) {
      setError("Credenciales inválidas o error en login");
      setSuccess(false);
    }
  };

  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1>Login Apoderado</h1>
      <form onSubmit={handleLogin}>
        <div className="select">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="select">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Ingresar</button>
      </form>
      {success && <p style={{ color: "green" }}>Login exitoso ✅</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
