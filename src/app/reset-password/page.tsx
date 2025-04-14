'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();

  // Check for token in URL (Supabase format, not Firebase oobCode)
  const token = searchParams?.get('token') || '';
  const type = searchParams?.get('type') || '';

  useEffect(() => {
    // Validate if we have valid recovery parameters
    if (!token || type !== 'recovery') {
      setError('O link de recuperação é inválido ou está expirado. Por favor, solicite um novo link de redefinição de senha.');
    }
  }, [token, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    if (!token) {
      setError('O link de recuperação é inválido ou está expirado');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Update user's password using token (for Supabase)
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      
      // Handle common Supabase error codes
      if (error.message.includes('expired')) {
        setError('O link de redefinição de senha expirou. Por favor, solicite um novo link.');
      } else if (error.message.includes('invalid')) {
        setError('O link de redefinição de senha é inválido. Por favor, solicite um novo link.');
      } else if (error.message.includes('weak password')) {
        setError('A senha fornecida é muito fraca. Por favor, escolha uma senha mais forte.');
      } else {
        setError('Não foi possível redefinir sua senha. Por favor, tente novamente mais tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50">
      <style jsx global>{`
        .auth-card-gradient {
          background: linear-gradient(135deg, rgba(255,250,255,0.8) 0%, rgba(245,240,255,0.9) 100%);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15);
        }
        .auth-header-gradient {
          background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
        }
        .auth-button-gradient {
          background: linear-gradient(to right, #7c3aed, #8b5cf6);
        }
        .auth-button-gradient:hover {
          background: linear-gradient(to right, #6d28d9, #7c3aed);
        }
        .input-focus-color {
          transition: all 0.3s ease;
        }
        .input-focus-color:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
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
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full bg-gradient-to-br from-purple-200 to-purple-300 blur-2xl opacity-30 transform -translate-x-1/3 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-gradient-to-br from-purple-300 to-violet-200 blur-2xl opacity-30 transform translate-x-1/3 translate-y-1/2"></div>
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-violet-200 to-purple-200 blur-2xl opacity-20"></div>
      </div>
      
      {/* Logo/App name at the top */}
      <div className="mb-6 text-center relative z-10">
        <img 
          src="/FMP_LaranjaGradient.svg" 
          alt="Dunamis Pockets" 
          className="h-20 w-auto mb-2 drop-shadow-lg"
        />
        <h2 className="text-xl font-bold bg-gradient-to-r from-purple-700 to-violet-600 bg-clip-text text-transparent drop-shadow-sm">Dunamis Pockets</h2>
      </div>
      
      <div className="w-full max-w-md px-4 relative z-10">
        <div className="auth-card-gradient rounded-3xl overflow-hidden">
          {/* Gradient header */}
          <div className="auth-header-gradient px-6 py-5 text-white">
            <h1 className="text-2xl font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Criar Nova Senha
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Defina uma nova senha para sua conta
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
            
            {success ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p>Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login em instantes.</p>
                  </div>
                </div>
                <div className="text-center py-4">
                  <div className="inline-block animate-spin h-8 w-8 border-4 border-purple-200 rounded-full border-t-purple-600"></div>
                  <p className="mt-2 text-purple-600 font-medium">Redirecionando...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-base font-medium text-purple-800 mb-2">Nova Senha</label>
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
                  <p className="mt-1 text-sm text-purple-600">Mínimo de 6 caracteres</p>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-base font-medium text-purple-800 mb-2">Confirmar Nova Senha</label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                  disabled={isLoading || !token}
                  className={`w-full py-3 rounded-xl font-semibold text-white shadow-lg transition-all auth-button-gradient ${
                    isLoading || !token
                      ? 'opacity-70 cursor-not-allowed' 
                      : 'hover:shadow-xl hover:-translate-y-0.5'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Redefinindo...
                    </div>
                  ) : (
                    'Redefinir Senha'
                  )}
                </button>
                
                <div className="mt-6 text-center">
                  <p className="text-purple-700">
                    Lembrou sua senha?{' '}
                    <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium transition-colors">
                      Voltar para login
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent font-medium">
          © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
} 