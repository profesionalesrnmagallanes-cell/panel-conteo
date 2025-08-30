'use client'

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInAnonymously, Auth } from "firebase/auth";
import { getFirestore, collection, onSnapshot, query, where, Firestore, DocumentData, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  number?: string;
}

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
  const [lastVotedCandidate, setLastVotedCandidate] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actaImageUrl, setActaImageUrl] = useState<string | null>(null);

  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
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

  useEffect(() => {
    if (!db || !isAuthReady || !tableRepId) return;

    const profileDocRef = doc(db, "artifacts", appId, "public", "table_rep_profiles", tableRepId);

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
          number: data.number,
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


  const handleUpdateVote = async (candidateName: string, newVotes: number) => {
    if (!db || !tableRepProfile || isProcessValidated) {
      setError("Base de datos no disponible, perfil no cargado o proceso ya validado.");
      return;
    }

    try {
      const votesCollectionPath = `/artifacts/${appId}/public/votes`;
      const docId = `${tableRepProfile.mesa}-${candidateName.replace(/\s+/g, '-').toLowerCase()}`;
      const docRef = doc(db, votesCollectionPath, docId);

      if (newVotes <= 0) {
        await deleteDoc(docRef);
        setSuccessMessage(`Votos de ${candidateName} eliminados.`);
      } else {
        await setDoc(docRef, {
          mesa: tableRepProfile.mesa,
          local: tableRepProfile.local,
          comuna: tableRepProfile.comuna,
          region: tableRepProfile.region,
          electionId: tableRepProfile.electionId,
          candidate: candidateName,
          votes: newVotes,
        }, { merge: true });
        setSuccessMessage(`Votos de ${candidateName} actualizados a ${newVotes}.`);
      }
      setLastVotedCandidate(candidateName);
    } catch (e) {
      console.error("Error al actualizar votos:", e);
      setError("Error al actualizar votos. Por favor, inténtelo de nuevo.");
    }
  };


  const handleVoiceCommand = (transcript: string) => {
    if (isProcessValidated) {
      setError("El proceso ya ha sido validado. No se pueden actualizar los votos.");
      return;
    }

    const cleanTranscript = transcript.toLowerCase().trim();
    
    let candidateName = '';
    let change = 1;
    let commandFound = false;

    // Palabras clave para restar un voto
    const negativeKeywords = ['restar', 'eliminar', 'borrar', 'sacar'];

    // Lógica para detectar el comando de corrección
    if (negativeKeywords.some(keyword => cleanTranscript.startsWith(keyword))) {
      change = -1;
      commandFound = true;
      const restOfTranscript = negativeKeywords.reduce((acc, keyword) => acc.replace(keyword, ''), cleanTranscript).trim();

      // Lógica para el comando "de lo ultimo" o "anterior"
      if (restOfTranscript.includes('lo ultimo') || restOfTranscript.includes('anterior')) {
        if (lastVotedCandidate) {
          candidateName = lastVotedCandidate;
        } else {
          setError("No se ha registrado ningún voto anterior para corregir.");
          return;
        }
      } else {
        // Buscar el candidato en el resto de la transcripción
        for (const c of candidates) {
          if (restOfTranscript.includes(c.name.toLowerCase())) {
            candidateName = c.name;
            break;
          }
          const nameParts = c.name.toLowerCase().split(/\s+/);
          if (nameParts.length > 1 && restOfTranscript.includes(nameParts[1])) {
            candidateName = c.name;
            break;
          }
          if (c.number && restOfTranscript.includes(c.number)) {
            candidateName = c.name;
            break;
          }
        }
        if (!candidateName) {
          if (restOfTranscript.includes('blanco')) {
            candidateName = 'Blanco';
          } else if (restOfTranscript.includes('nulo')) {
            candidateName = 'Nulo';
          }
        }
      }
    } else {
      // Lógica para detectar el comando de suma (valor por defecto)
      for (const c of candidates) {
        if (cleanTranscript.includes(c.name.toLowerCase())) {
          candidateName = c.name;
          break;
        }
        const nameParts = c.name.toLowerCase().split(/\s+/);
        if (nameParts.length > 1 && cleanTranscript.includes(nameParts[1])) {
          candidateName = c.name;
          break;
        }
        if (c.number && cleanTranscript.includes(c.number)) {
          candidateName = c.name;
          break;
        }
      }
      if (!candidateName) {
        if (cleanTranscript.includes('blanco')) {
          candidateName = 'Blanco';
        } else if (cleanTranscript.includes('nulo')) {
          candidateName = 'Nulo';
        }
      }
    }

    if (!candidateName) {
      setError("Comando no reconocido. Por favor, intente de nuevo.");
      return;
    }

    const currentVotes = voteCountsMap.get(candidateName) || 0;
    const newVotes = currentVotes + change;
    
    handleUpdateVote(candidateName, newVotes);
  };


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


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || !tableRepProfile) {
      setError("No se ha seleccionado ninguna foto o falta la información del perfil.");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const storage = getStorage(initializeApp(firebaseConfig));
      const fileExtension = file.name.split('.').pop();
      const fileName = `${tableRepProfile.mesa}-${tableRepProfile.electionId}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `actas/${fileName}`);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setActaImageUrl(url);
      setSuccessMessage("¡Foto del acta cargada con éxito!");

    } catch (e) {
      console.error("Error al subir el archivo:", e);
      setError("Error al subir la foto del acta. Por favor, intente de nuevo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleValidateProcess = async () => {
    if (!db || !tableRepProfile) {
      setError("Base de datos no disponible o perfil no cargado.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalResults = {
        mesa: tableRepProfile.mesa,
        local: tableRepProfile.local,
        comuna: tableRepProfile.comuna,
        region: tableRepProfile.region,
        electionId: tableRepProfile.electionId,
        validatedBy: tableRepProfile.id,
        timestamp: new Date().toISOString(),
        voteCounts: Object.fromEntries(voteCountsMap),
        actaImageUrl: actaImageUrl, // Aquí se añade la URL de la foto del acta
        status: 'validated'
      };

      const validatedResultsCollectionPath = `/artifacts/${appId}/public/validated_results`;
      const docRef = doc(db, validatedResultsCollectionPath, `${tableRepProfile.mesa}-${tableRepProfile.electionId}`);
      await setDoc(docRef, finalResults);

      setIsProcessValidated(true);
      setShowValidationModal(true);
      setSuccessMessage("¡Proceso de escrutinio validado y guardado con éxito!");
      setLoading(false);

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
          Mesa: **{tableRepProfile?.mesa || '...'}** | Local: **{tableRepProfile?.local || '...'}** | Elección: **{tableRepProfile?.electionName || '...'}**
        </p>

        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-center text-green-500 mb-4">{successMessage}</p>}
        
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
            **Para agregar un voto:** Diga el nombre completo del candidato, su apellido, o su número de lista. Por ejemplo: "Juanito Arcoiris", "Arcoiris" o "70". También diga "Blanco" o "Nulo".
            <br />
            **Para corregir (restar) un voto:** Diga **"restar"**, **"eliminar"**, **"borrar"** o **"sacar"** seguido del nombre del candidato. Por ejemplo: "Restar Juanito Arcoiris" o "Sacar Nulo".
            <br />
            **Para corregir el último voto:** Diga **"restar lo anterior"** o **"eliminar el último"**.
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-4">Conteo de Votos en Tiempo Real</h2>
        
        {loading && !error ? (
          <p className="text-center text-gray-500">Cargando conteo de votos...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map(candidate => (
              <div key={candidate.id} className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm flex flex-col items-center">
                <h3 className="text-lg font-semibold text-center">{candidate.name}</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get(candidate.name) || 0}
                </p>
              </div>
            ))}
              <div className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm flex flex-col items-center">
                <h3 className="text-lg font-semibold text-center">Votos Blancos</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get('Blanco') || 0}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-800 rounded-lg p-4 shadow-sm flex flex-col items-center">
                <h3 className="text-lg font-semibold text-center">Votos Nulos</h3>
                <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {voteCountsMap.get('Nulo') || 0}
                </p>
              </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-4">Adjuntar Acta de Votación</h2>
          <label htmlFor="acta-upload" className="w-full py-3 px-6 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 cursor-pointer text-center block">
            {uploadingImage ? 'Subiendo...' : 'Tomar Foto del Acta'}
          </label>
          <input
            id="acta-upload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessValidated}
          />
          {actaImageUrl && (
            <div className="mt-4">
              <p className="text-center text-green-500 mb-2">¡Foto cargada con éxito!</p>
              <img src={actaImageUrl} alt="Acta de Votación" className="mx-auto rounded-lg shadow-md max-w-full h-auto" />
            </div>
          )}
        </div>

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