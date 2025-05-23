'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, checkAdminStatus } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(email, password);
      
      // Check if user is admin and redirect accordingly
      const isUserAdmin = await checkAdminStatus();
      if (isUserAdmin) {
        // Redirect admin users to admin page
        router.push('/admin');
      } else {
        // Redirect regular users to main page
        router.push('/');
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Email ou senha inválidos');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Muitas tentativas malsucedidas. Tente novamente mais tarde.');
      } else if (error.message === 'Email not confirmed') {
        // Redirect to email confirmation page
        router.push('/confirm-email?email=' + encodeURIComponent(email));
        return;
      } else {
        setError('Ocorreu um erro ao fazer login. Por favor, tente novamente.');
      }
      
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100">
      <style jsx global>{`
        .auth-card-gradient {
          background: linear-gradient(135deg, rgba(255,245,255,0.8) 0%, rgba(255,240,245,0.9) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 8px 32px rgba(193, 53, 132, 0.15);
        }
        .auth-header-gradient {
          background: linear-gradient(135deg, #c13584 0%, #f56040 100%);
        }
        .auth-button-gradient {
          background: linear-gradient(to right, #c13584, #e05c82);
        }
        .auth-button-gradient:hover {
          background: linear-gradient(to right, #b62f7a, #d34873);
        }
        .input-focus-color {
          transition: all 0.3s ease;
        }
        .input-focus-color:focus {
          border-color: #e05c82;
          box-shadow: 0 0 0 2px rgba(224, 92, 130, 0.2);
          outline: none;
        }
        .animated-gradient-bg {
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
        }
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-gradient-to-br from-pink-200 to-pink-300 blur-2xl opacity-30 transform -translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-gradient-to-br from-orange-200 to-red-200 blur-2xl opacity-30 transform translate-x-1/3 translate-y-1/2"></div>
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-purple-200 to-indigo-200 blur-2xl opacity-20"></div>
      </div>
      
      {/* Logo/App name at the top */}
      <div className="mb-6 text-center relative z-10">
        <img 
          src="/FMP_LaranjaGradient.svg" 
          alt="Dunamis Pockets" 
          className="h-20 w-auto mb-2 drop-shadow-lg"
        />
        <h2 className="text-xl font-bold bg-gradient-to-r from-purple-700 via-pink-700 to-orange-600 bg-clip-text text-transparent drop-shadow-sm">Dunamis Pockets</h2>
      </div>
      
      <div className="w-full max-w-md px-4 relative z-10">
        <div className="auth-card-gradient rounded-3xl overflow-hidden">
          {/* Gradient header */}
          <div className="auth-header-gradient px-6 py-5 text-white">
            <h1 className="text-2xl font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Entrar
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Acesse sua conta para continuar
            </p>
          </div>
          
          <div className="p-8 space-y-6 bg-gradient-to-b from-white/60 to-purple-50/60">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm animate-pulse">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-base font-medium text-purple-800 mb-2">Email</label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/80 input-focus-color transition-colors"
                    placeholder="seu@email.com"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-base font-medium text-purple-800">Senha</label>
                  <Link href="/forgot-password" className="text-sm text-pink-600 hover:text-pink-700 transition-colors">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/80 input-focus-color transition-colors"
                    placeholder="********"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 border border-transparent rounded-xl auth-button-gradient text-white font-medium transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Entrando...
                  </span>
                ) : 'Entrar'}
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-purple-700">
                  Não tem uma conta?{' '}
                  <Link href="/signup" className="text-pink-600 hover:text-pink-700 font-medium transition-colors">
                    Registre-se
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent font-medium">
          © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
} 