import React, { useState } from 'react';

// Define una interfaz para los datos de la mesa para una mejor tipificación
interface Mesa {
  id: string;
  isSent: boolean;
  status: 'Enviada' | 'Pendiente'; // Opcional, para tipos de estados específicos
}

// Se asume que estos datos vendrían de una API o una base de datos.
// Ahora se utiliza el tipo 'Mesa' para el mock de datos.
const mockMesas: Mesa[] = [
  {
    id: 'mesa-001',
    isSent: true,
    status: 'Enviada',
  },
  {
    id: 'mesa-002',
    isSent: false,
    status: 'Pendiente',
  },
  {
    id: 'mesa-003',
    isSent: true,
    status: 'Enviada',
  },
  {
    id: 'mesa-004',
    isSent: false,
    status: 'Pendiente',
  },
];

const App = () => {
  const [mesas, setMesas] = useState<Mesa[]>(mockMesas);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedMesaId, setSelectedMesaId] = useState<string>('');

  // Ahora 'mesaId' tiene un tipo 'string' explícito, resolviendo el error de TypeScript.
  const handleAjustarVotos = (mesaId: string) => {
    setSelectedMesaId(mesaId);
    setIsModalOpen(true);
  };

  const confirmAjuste = () => {
    console.log(`Ajustando votos para la mesa: ${selectedMesaId}`);
    setIsModalOpen(false);
  };

  const cancelAjuste = () => {
    setIsModalOpen(false);
    setSelectedMesaId('');
  };

  // Define una interfaz para las propiedades del componente Modal.
  interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    mesaId: string;
  }

  // El componente del modal ahora usa la interfaz 'ModalProps' para sus propiedades.
  const Modal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm, mesaId }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Confirmar Ajuste</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-700 mb-6">
            ¿Estás seguro de que deseas ajustar los votos para la mesa <span className="font-semibold">{mesaId}</span>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
          Panel de Administración de Mesas
        </h1>
        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  ID de la Mesa
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mesas.map((mesa) => (
                <tr key={mesa.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {mesa.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        mesa.isSent ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {mesa.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleAjustarVotos(mesa.id)}
                      disabled={!mesa.isSent}
                      className={`
                        px-4 py-2 rounded-lg font-medium transition-all duration-200
                        ${
                          mesa.isSent
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }
                      `}
                    >
                      Ajustar Votos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={cancelAjuste}
        onConfirm={confirmAjuste}
        mesaId={selectedMesaId}
      />
    </div>
  );
};

export default App;