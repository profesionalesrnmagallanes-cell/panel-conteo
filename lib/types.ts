// Local de votación
export type Local = {
  id: string;
  nombre?: string;
  comuna?: string;
};

// Mesa dentro de un local
export type Mesa = {
  id: string;
  numero?: string | number;
};

// Candidato asociado a un cargo
export type Candidato = {
  id: string; // id interno del doc en Firestore
  cargoId: string; // PRE, DIP, etc.
  candidatoId: string; // identificador de candidato
  nombre?: string; // nombre visible
};

// Documento de resultados en Firestore
export type ResultadoDoc = {
  eleccionId: string;
  localId: string;
  mesaId: string;
  cargoId: string;
  candidatoId: string;
  votos: number;
};
