'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signUp, checkAdminStatus } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Call the signUp method from auth context
      const user = await signUp(email, password, name);
      
      // Check if email confirmation is required
      if (user && !user.email_confirmed_at) {
        // Redirect to the confirm email page
        router.push(`/confirm-email?email=${encodeURIComponent(email)}`);
        return;
      }
      
      // If auto-confirmed, redirect to dashboard or admin
      const isUserAdmin = await checkAdminStatus();
      if (isUserAdmin) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      
      // Handle specific errors
      if (error.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso. Por favor, use outro e-mail ou faça login.');
      } else if (error.code === 'auth/invalid-email') {
        setError('E-mail inválido. Por favor, verifique e tente novamente.');
      } else {
        setError('Não foi possível criar sua conta. Por favor, tente novamente mais tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white">
      <style jsx global>{`
        .auth-card-gradient {
          background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,242,255,0.9) 100%);
          backdrop-filter: blur(10px);
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
      `}</style>
      
      {/* Logo/App name at the top */}
      <div className="mb-6 text-center">
        <img 
          src="/FMP_LaranjaGradient.svg" 
          alt="Dunamis Pockets" 
          className="h-20 w-auto mb-2"
        />
        <h2 className="text-xl font-bold text-purple-800">Dunamis Pockets</h2>
      </div>
      
      <div className="w-full max-w-md px-4">
        <div className="auth-card-gradient rounded-3xl shadow-xl overflow-hidden border border-purple-200">
          {/* Gradient header */}
          <div className="auth-header-gradient px-6 py-5 text-white">
            <h1 className="text-2xl font-bold">Criar Conta</h1>
            <p className="mt-1 text-sm text-white/90">
              Preencha os campos abaixo para se cadastrar
            </p>
          </div>
          
          <div className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-base font-medium text-purple-800 mb-2">Nome Completo</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-colors"
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-base font-medium text-purple-800 mb-2">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-colors"
                  placeholder="seu@email.com"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-base font-medium text-purple-800 mb-2">Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-colors"
                  placeholder="Mínimo de 6 caracteres"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-base font-medium text-purple-800 mb-2">Confirmar Senha</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-4 py-3 border border-purple-200 rounded-xl shadow-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-colors"
                  placeholder="Digite sua senha novamente"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 border border-transparent rounded-xl auth-button-gradient text-white font-medium transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed mt-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando conta...
                  </span>
                ) : 'Criar Conta'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-secondary hover:text-secondary/80 font-medium transition-colors">
                  Faça login
                </Link>
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-purple-600">
          © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
} 