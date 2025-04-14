'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Create a client component for handling search params
const EmailConfirmationContent = () => {
  const [email, setEmail] = useState<string>('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get email from URL parameter
    const emailParam = searchParams?.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleResendEmail = async () => {
    if (!email) {
      setResendError('Por favor, forneça um endereço de e-mail.');
      return;
    }

    try {
      setResendLoading(true);
      setResendError('');
      setResendSuccess(false);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setResendSuccess(true);
    } catch (error: any) {
      console.error('Error resending confirmation email:', error);
      setResendError(error.message || 'Erro ao reenviar o e-mail de confirmação.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="bg-white/70 p-6 rounded-xl border border-purple-100 text-center">
      <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      
      <h2 className="text-xl font-bold text-purple-900 mb-2">Quase lá!</h2>
      <p className="text-purple-700 mb-4">
        Enviamos um e-mail de confirmação para:
      </p>
      <p className="font-medium text-lg text-purple-800 mb-4">
        {email || 'seu endereço de e-mail'}
      </p>
      <p className="text-sm text-purple-600 mb-6">
        Por favor, verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
      </p>
      
      {resendSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p>E-mail de confirmação reenviado com sucesso!</p>
          </div>
        </div>
      )}
      
      {resendError && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {resendError}
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        <button
          onClick={handleResendEmail}
          disabled={resendLoading}
          className="w-full py-2 px-4 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-lg transition-colors"
        >
          {resendLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Reenviando...
            </span>
          ) : 'Reenviar e-mail de confirmação'}
        </button>
        
        <Link 
          href="/login"
          className="block text-center py-2 px-4 border border-purple-200 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
};

// Main component without direct useSearchParams usage
export default function ConfirmEmailPage() {
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
              Confirme seu E-mail
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Verifique sua caixa de entrada para confirmar seu cadastro
            </p>
          </div>
          
          <div className="p-8 space-y-6 bg-gradient-to-b from-white/60 to-purple-50/60">
            {/* Wrap the component using useSearchParams in a Suspense boundary */}
            <Suspense fallback={<div className="p-4 text-center text-gray-500">Carregando informações de confirmação...</div>}>
              <EmailConfirmationContent />
            </Suspense>
            
            <div className="text-center space-y-4">
              <p className="text-sm text-purple-600">
                Não recebeu o e-mail? Verifique sua pasta de spam ou solicite o reenvio.
              </p>
              <p className="text-xs text-purple-500">
                Se você continuar tendo problemas, entre em contato com o suporte.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent font-medium">
          © {new Date().getFullYear()} Dunamis Pockets. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
} 