import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página não encontrada - Dunamis Pockets',
  description: 'A página que você está procurando não foi encontrada',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-200 via-indigo-100 to-orange-100 p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-gradient-to-br from-purple-300 to-indigo-300 blur-2xl opacity-30 transform -translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-gradient-to-br from-orange-200 to-red-200 blur-2xl opacity-30 transform translate-x-1/3 translate-y-1/2"></div>
      </div>
      
      <div className="relative z-10 max-w-md w-full text-center bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold mb-2 text-gray-800">404</h1>
        <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-purple-700 via-pink-700 to-orange-600 bg-clip-text text-transparent">Página não encontrada</h2>
        
        <p className="text-gray-600 mb-8">
          A página que você está procurando não existe ou foi movida.
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/"
            className="block w-full py-3 px-4 text-center rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 text-white font-medium hover:from-purple-700 hover:to-orange-600 transition-all shadow-md hover:shadow-lg"
          >
            Voltar para o início
          </Link>
          
          <Link 
            href="/login"
            className="block w-full py-3 px-4 text-center rounded-lg border border-purple-200 text-purple-700 bg-white/50 hover:bg-white/80 font-medium transition-colors"
          >
            Ir para login
          </Link>
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent font-medium">
        © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
      </div>
    </div>
  );
} 