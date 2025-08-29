'use client';

import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

// Declarar variables globales proporcionadas por el entorno del canvas.
declare global {
  var __firebase_config: string;
  var __initial_auth_token: string;
}

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

      const unsubscribe = onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
          setUser(authUser);
          setLoading(false);
        } else {
          try {
            if (initialAuthToken) {
              signInWithCustomToken(auth, initialAuthToken).then(() => {
                console.log("Inicio de sesión con token personalizado exitoso.");
              });
            } else {
              setError("Token de autenticación no disponible. No se puede iniciar sesión automáticamente.");
              setLoading(false);
            }
          } catch (e: any) {
            setError("Error durante el inicio de sesión: " + e.message);
            setLoading(false);
          }
        }
      });

      return () => unsubscribe();
    } catch (e: any) {
      setError("Error al inicializar Firebase: " + e.message);
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transform transition duration-500 hover:scale-105">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-600 dark:text-blue-400 mb-6">Estado de Autenticación</h1>
        
        {loading && (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 rounded-full animate-pulse bg-blue-600"></div>
            <p className="text-gray-500">Iniciando sesión...</p>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-center">{error}</p>
        )}

        {user && (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">¡Inicio de sesión exitoso!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 break-words">ID de usuario: <span className="font-mono text-gray-800 dark:text-gray-300">{user.uid}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}