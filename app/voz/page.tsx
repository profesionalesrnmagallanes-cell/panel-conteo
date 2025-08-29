'use client'

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, where, Firestore, DocumentData, doc, setDoc, updateDoc } from "firebase/firestore";

// Declarar variables globales para que TypeScript no arroje errores
declare global {
  var __app_id: string;
  var __firebase_config: string;
  var __initial_auth_token: string;
}

// Configuración y variables globales proporcionadas por el entorno.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Definir tipos de datos para los documentos de Firestore
interface TableRepProfile {
  id: string;
  name: string;
  email: string;
  region: string;
  comuna: string;
  local: string;
  mesa: string;
  electionId?: string;
  electionName?: string;
}

interface Candidate {
  id: string;
  name: string;
}

// Definir las interfaces para los objetos de reconocimiento de voz para evitar errores de tipo.
interface SpeechRecognition extends EventTarget {
  grammars: any;
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;
  onaudiostart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Global variable for SpeechRecognition, to be used safely.
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function TableRepDashboard() {
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tableRepId, setTableRepId] = useState<string | null>(null);
  const [tableRepProfile, setTableRepProfile] = useState<TableRepProfile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voteCountsMap, setVoteCountsMap] = useState<Map<string, number>>(new Map());
  const [isProcessValidated, setIsProcessValidated] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Referencia al objeto de reconocimiento de voz para controlarlo
  const recognitionRef = useRef<any | null>(null);


  // Efecto para inicializar Firebase y manejar la autenticación
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          console.log("Usuario no autenticado, iniciando sesión anónimamente...");
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (e) {
            console.error("Error al iniciar sesión:", e);
            setError("Error de autenticación. No se pueden cargar los resultados.");
          }
        } else {
          setTableRepId(user.uid);
          console.log("Usuario autenticado. ID:", user.uid);
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error al inicializar Firebase:", e);
      setError("Error al conectar con la base de datos.");
      setLoading(false);
    }
  }, []);

  // Efecto para obtener el perfil del apoderado de mesa
  useEffect(() => {
    if (!db || !isAuthReady || !tableRepId) return;
    
    const profileDocRef = doc(db, "artifacts", appId, "public", "table_rep_profiles", tableRepId);
    console.log("Fetching table rep profile for path:", profileDocRef.path);

    const unsubscribe = onSnapshot(profileDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data() as Omit<TableRepProfile, 'id'>;
            setTableRepProfile({ ...data, id: docSnapshot.id });
        } else {
            console.error("Perfil de apoderado de mesa no encontrado.");
            setError("No se pudo cargar el perfil de la mesa.");
        }
    });

    return () => unsubscribe();
  }, [db, isAuthReady, tableRepId]);


  // Efecto para obtener los candidatos de la elección
  useEffect(() => {
    if (!db || !isAuthReady || !tableRepProfile?.electionId) return;

    const candidatesCollectionPath = `/artifacts/${appId}/public/elections/${tableRepProfile.electionId}/candidates`;
    const q = query(collection(db, candidatesCollectionPath));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const candidatesList: Candidate[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        candidatesList.push({
          id: doc.id,
          name: data.name,
        });
      });
      setCandidates(candidatesList);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los candidatos:", err);
      setError("Error al cargar los candidatos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, tableRepProfile]);


  // Efecto para obtener los conteos de votos en tiempo real para la mesa actual
  useEffect(() => {
    if (!db || !isAuthReady || !tableRepProfile?.mesa || !tableRepProfile?.electionId) return;
    
    const votesCollectionPath = `/artifacts/${appId}/public/votes`;
    const q = query(
      collection(db, votesCollectionPath),
      where("mesa", "==", tableRepProfile.mesa),
      where("electionId", "==", tableRepProfile.electionId)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newMap = new Map<string, number>();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newMap.set(data.candidate, data.votes);
      });
      setVoteCountsMap(newMap);
      setLoading(false);
    }, (err) => {
      console.error("Error al obtener los conteos de votos:", err);
      setError("Error al cargar los conteos de votos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, tableRepProfile]);


  // Manejador para actualizar los conteos de votos
  const handleUpdateVote = async (candidateName: string, votes: number) => {
    if (!db || !tableRepProfile || isProcessValidated) {
      setError("Base de datos no disponible, perfil no cargado o proceso ya validado.");
      return;
    }
    
    try {
      const votesCollectionPath = `/artifacts/${appId}/public/votes`;
      // El id del documento será una combinación de la mesa y el nombre del candidato para asegurar unicidad
      const docId = `${tableRepProfile.mesa}-${candidateName.replace(/\s+/g, '-').toLowerCase()}`;
      const docRef = doc(db, votesCollectionPath, docId);

      await setDoc(docRef, {
        mesa: tableRepProfile.mesa,
        local: tableRepProfile.local,
        comuna: tableRepProfile.comuna,
        region: tableRepProfile.region,
        electionId: tableRepProfile.electionId,
        candidate: candidateName,
        votes: votes,
      }, { merge: true });

      setSuccessMessage(`Votos de ${candidateName} actualizados con éxito.`);
    } catch (e) {
      console.error("Error al actualizar votos:", e);
      setError("Error al actualizar votos. Por favor, inténtelo de nuevo.");
    }
  };

  // Lógica de reconocimiento de voz
  const handleVoiceCommand = (transcript: string) => {
    if (isProcessValidated) {
      setError("El proceso ya ha sido validado. No se pueden actualizar los votos.");
      return;
    }

    // Normalizar la transcripción
    const cleanTranscript = transcript.toLowerCase().trim();
    
    const words = cleanTranscript.split(/\s+/);
    let action = '';
    let votes = 1;
    let target = '';

    if (words.length >= 2) {
      action = words[0];
      
      if (!isNaN(parseInt(words[1], 10))) {
        votes = parseInt(words[1], 10);
        target = words.slice(3).join(' ');
      } else {
        votes = 1;
        target = words.slice(1).join(' ');
      }
    }
    
    let candidateName = '';
    let targetVotes = 0;

    for (const c of candidates) {
      if (cleanTranscript.includes(c.name.toLowerCase())) {
        candidateName = c.name;
        break;
      }
    }

    if (cleanTranscript.includes('blanco')) {
      candidateName = 'Blanco';
    } else if (cleanTranscript.includes('nulo')) {
      candidateName = 'Nulo';
    }
    
    if (!candidateName) {
      setError("Comando no reconocido. Diga un nombre de candidato, 'blanco' o 'nulo'.");
      return;
    }

    const currentVotes = voteCountsMap.get(candidateName) || 0;
    
    if (cleanTranscript.includes('sumar') || cleanTranscript.includes('añadir')) {
      targetVotes = currentVotes + votes;
      setSuccessMessage(`Sumando ${votes} voto(s) a ${candidateName}.`);
    } else if (cleanTranscript.includes('establecer') || cleanTranscript.includes('poner')) {
      if (isNaN(votes)) {
        setError("Comando 'establecer' requiere un número de votos. Intente 'Establecer 50 para Juan Pérez'.");
        return;
      }
      targetVotes = votes;
      setSuccessMessage(`Estableciendo los votos de ${candidateName} a ${votes}.`);
    } else if (cleanTranscript.includes('restar') || cleanTranscript.includes('quitar')) {
      targetVotes = Math.max(0, currentVotes - votes);
      setSuccessMessage(`Restando ${votes} voto(s) a ${candidateName}.`);
    } else {
      targetVotes = currentVotes + 1;
      setSuccessMessage(`Sumando 1 voto a ${candidateName}.`);
    }

    handleUpdateVote(candidateName, targetVotes);
  };


  // Iniciar/detener la escucha
  const toggleListening = () => {
    if (isProcessValidated) {
      setError("El proceso ya ha sido validado. No se puede activar el micrófono.");
      return;
    }
    if (typeof window === 'undefined' || !window.webkitSpeechRecognition) {
      setError("Reconocimiento de voz no soportado por este navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onstart = () => {
        setIsListening(true);
        setSuccessMessage('Escuchando...');
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        handleVoiceCommand(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Error de reconocimiento de voz:", event.error);
        setIsListening(false);
        setError(`Error en el reconocimiento de voz: ${event.error}. Por favor, intente de nuevo.`);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  // -------------------------------------------------------------------------
  // NUEVA LÓGICA AGREGADA AQUÍ: EL BOTÓN "VALIDAR PROCESO DE ESCRUTINIO"
  // -------------------------------------------------------------------------

  // Lógica para validar el proceso de escrutinio
  const handleValidateProcess = async () => {
    if (!db || !tableRepProfile) {
      setError("Base de datos no disponible o perfil no cargado.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Crear un objeto con los resultados finales, incluyendo votos en blanco y nulos
      const finalResults = {
        mesa: tableRepProfile.mesa,
        local: tableRepProfile.local,
        comuna: tableRepProfile.comuna,
        region: tableRepProfile.region,
        electionId: tableRepProfile.electionId,
        validatedBy: tableRepProfile.id,
        timestamp: new Date().toISOString(),
        voteCounts: Object.fromEntries(voteCountsMap),
        status: 'validated'
      };

      // Guardar los resultados finales en una nueva colección
      const validatedResultsCollectionPath = `/artifacts/${appId}/public/validated_results`;
      const docRef = doc(db, validatedResultsCollectionPath, `${tableRepProfile.mesa}-${tableRepProfile.electionId}`);
      await setDoc(docRef, finalResults);

      // Actualizar el estado para deshabilitar los controles y mostrar el modal
      setIsProcessValidated(true);
      setShowValidationModal(true);
      setSuccessMessage("¡Proceso de escrutinio validado y guardado con éxito!");
      setLoading(false);

      // Ocultar el modal después de 3 segundos
      setTimeout(() => {
        setShowValidationModal(false);
      }, 3000);

    } catch (e) {
      console.error("Error al validar el proceso:", e);
      setError("Error al validar el proceso. Por favor, inténtelo de nuevo.");
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 my-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-green-600 dark:text-green-400 mb-2">Panel de Apoderado de Mesa</h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-300 mb-8">
          Bienvenido. Aquí puedes cargar los conteos de votos de tu mesa, {tableRepProfile?.mesa || '...'}.
        </p>
        
        {/* Mensajes de estado */}
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        
        {/* Sección de Carga de Votos por Voz */}
        <div className="mb-8 p-6 bg-green-50 dark:bg-green-900 rounded-xl shadow-inner text-center">
          <h2 className="text-2xl font-bold mb-4">Carga de Datos por Voz</h2>
          <button
            onClick={toggleListening}
            disabled={loading || isProcessValidated}
            className={`w-full sm:w-auto py-3 px-6 font-bold rounded-lg shadow-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isListening ? 'Detener Conteo' : 'Activar Micrófono'}
          </button>
          <p className="mt-4 text-gray-700 dark:text-gray-300">
            Diga "Sumar 50 para Juan Pérez" o "Establecer 100 para María López". También "Sumar uno para blanco".
          </p>
        </div>

        {/* Sección de Conteo de Votos en tiempo real */}
        <h2 className="text-2xl font-bold mb-4">Conteo de Votos en Mesa {tableRepProfile?.mesa || '...'}</h2>
        
        {loading && !error ? (
          <p className="text-center text-gray-500">Cargando conteo de votos...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map(candidate => (
              <div key={candidate.id} className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{candidate.name}</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get(candidate.name) || 0}
                </p>
              </div>
            ))}
             <div className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-semibold">Votos Blancos</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get('Blanco') || 0}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-semibold">Votos Nulos</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get('Nulo') || 0}
                </p>
              </div>
          </div>
        )}

        {/* Sección de validación del proceso */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleValidateProcess}
            disabled={loading || isProcessValidated}
            className="w-full py-3 px-6 bg-gray-600 text-white font-bold rounded-lg shadow-md hover:bg-gray-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessValidated ? 'Proceso Validado' : 'Validar Proceso de Escrutinio'}
          </button>
        </div>
      </div>
      {showValidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl text-center">
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">¡Validación Exitosa!</h2>
            <p className="text-gray-800 dark:text-gray-200">El conteo de votos de la mesa ha sido validado y guardado.</p>
          </div>
        </div>
      )}
    </div>
  );
}