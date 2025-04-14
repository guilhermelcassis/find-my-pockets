'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await resetPassword(email);
      setMessage('E-mail de recuperação enviado. Verifique sua caixa de entrada.');
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      
      if (error.code === 'auth/user-not-found') {
        setError('Não encontramos uma conta com este e-mail.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Por favor, forneça um endereço de e-mail válido.');
      } else {
        setError('Ocorreu um erro ao enviar o e-mail de recuperação. Por favor, tente novamente.');
      }
    } finally {
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Esqueci minha senha
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Enviaremos instruções para redefinir sua senha
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
            
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm animate-pulse">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {message}
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
                    Enviando...
                  </span>
                ) : 'Enviar instruções'}
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-purple-700">
                  Lembrou sua senha?{' '}
                  <Link href="/login" className="text-pink-600 hover:text-pink-700 font-medium transition-colors">
                    Voltar para o login
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