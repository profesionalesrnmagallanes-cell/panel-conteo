'use client'

// Declaraciones para las variables globales, esto soluciona el error de TypeScript en Vercel
declare const __firebase_config: string;
declare const __app_id: string;
declare const __initial_auth_token: string;

import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, query, Firestore } from "firebase/firestore";
import { useEffect, useState } from "react";
import { User, getAuth, signInAnonymously, signInWithCustomToken } from "firebase/auth";

interface Voto {
    id: string;
    opcion: string;
}

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export default function ResultadosPage() {
    const [votos, setVotos] = useState<Voto[]>([]);
    const [conteo, setConteo] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState(true);
    const [db, setDb] = useState<Firestore | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const auth = getAuth(app);
            setDb(firestore);

            const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                } else {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Error signing in:", error);
                    }
                }
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Error initializing Firebase:", e);
        }
    }, [initialAuthToken]);

    useEffect(() => {
        if (db && user) {
            const collectionPath = `/artifacts/${appId}/public/data/votos`;
            const q = query(collection(db, collectionPath));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const conteoVotos: { [key: string]: number } = {};
                const nuevosVotos: Voto[] = [];
                snapshot.docs.forEach((doc) => {
                    const data = doc.data() as Voto;
                    nuevosVotos.push({ ...data, id: doc.id });
                    conteoVotos[data.opcion] = (conteoVotos[data.opcion] || 0) + 1;
                });
                setVotos(nuevosVotos);
                setConteo(conteoVotos);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching votes:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [db, user]);

    return (
        <main className="min-h-screen bg-gray-100 p-8 flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-xl text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Conteo de Votos</h1>
                <p className="text-gray-500 mb-6">Resultados en tiempo real</p>
                {loading ? (
                    <div className="text-gray-400">Cargando votos...</div>
                ) : Object.keys(conteo).length === 0 ? (
                    <div className="text-gray-400">Aún no hay votos registrados.</div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(conteo).sort().map(([opcion, cantidad]) => (
                            <div key={opcion} className="bg-blue-100 text-blue-800 p-4 rounded-lg flex justify-between items-center">
                                <span className="font-medium text-lg">{opcion}</span>
                                <span className="font-bold text-2xl">{cantidad}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
