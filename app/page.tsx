import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container card" style={{ marginTop: 40 }}>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Panel de Conteo de Votos en Vivo
      </h1>
      <p className="text-gray-600 mb-6">
        Este sistema permite el registro de votos a través de comandos de voz y la visualización de los resultados consolidados en tiempo real.
      </p>
      
      <div className="flex flex-col space-y-4">
        <Link href="/voz" legacyBehavior>
          <a className="button bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors duration-200">
            Ir al Panel de Conteo por Voz
          </a>
        </Link>
        <Link href="/resultados" legacyBehavior>
          <a className="button bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors duration-200">
            Ir a los Resultados Consolidados
          </a>
        </Link>
        <Link href="/login" legacyBehavior>
          <a className="button bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors duration-200">
            Iniciar Sesión
          </a>
        </Link>
      </div>
    </div>
  );
}
