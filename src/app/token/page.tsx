'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, CheckCircle2 } from 'lucide-react';
import PatientHeader from '@/components/PatientHeader';

function TokenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenId = searchParams.get('id');
  const [token, setToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          router.replace('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!tokenId) return;

    const fetchToken = async () => {
      const { data: tokenData } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      
      if (tokenData) {
        setToken(tokenData);
        startTimer(); // Start countdown once token is loaded
      }
      setLoading(false);
    };

    fetchToken();

    const tokenSub = supabase
      .channel(`token-${tokenId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tokens', filter: `id=eq.${tokenId}` },
        (payload) => {
          setToken(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokenSub);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tokenId, router]);

  if (loading) return <div className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Loading token details...</div>;
  if (!token) return <div className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Token not found.</div>;

  const handlePrint = () => {
    startTimer(); // Reset the countdown
    window.print();
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.push('/');
  };

  const formattedDate = new Date(token.created_at).toLocaleDateString('en-GB');
  const formattedTime = new Date(token.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="min-h-screen bg-[#EBF4F7] font-sans">
      <div className="no-print">
        <PatientHeader />
        
        {token.status === 'called' && (
          <div className="w-full bg-[#2B9BB8] text-white p-4 font-bold text-center text-lg mb-6 shadow-md">
            Your token is being called! Please proceed to the {token.department} counter.
          </div>
        )}

        <div className="flex flex-col items-center justify-center p-6 mt-12 max-w-xl mx-auto text-center">
          <CheckCircle2 size={64} className="text-[#16A34A] mb-6" />
          <h2 className="text-[28px] font-bold text-[#16A34A] mb-2">Booking Successful!</h2>
          <p className="text-[#5A7A8A] text-[16px] mb-12">Click the button below to issue your token.</p>
          
          <button 
            onClick={handlePrint}
            className="w-full bg-[#2B9BB8] hover:bg-[#1E7A94] text-white font-bold text-[16px] uppercase py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 mb-6"
          >
            <Printer size={20} />
            PRINT RECEIPT
          </button>

          <button 
            onClick={handleSkip}
            className="text-[#5A7A8A] text-[16px] font-medium hover:text-[#1B3A5C] transition-colors mb-8"
          >
            Skip & Finish
          </button>
          
          <p className="text-[#5A7A8A] text-sm">
            Resetting in {timeLeft}s
          </p>
        </div>
      </div>

      {/* STATE B - PRINT VIEW ONLY */}
      <div className="hidden print-only font-sans w-full max-w-sm mx-auto bg-white p-6 border-2 border-black">
        <h1 className="text-2xl font-bold uppercase text-black mb-4">VSNN Health Center</h1>
        <div className="border-b-2 border-black w-full mb-4"></div>
        
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-4">
            <p className="text-black font-medium text-lg mb-2">Dr. {token.doctor_name || 'Assigned Doctor'}</p>
            <p className="text-black text-sm">Date: {formattedDate}</p>
            <p className="text-black text-sm">Time: {formattedTime}</p>
          </div>
          <div className="border-l-2 border-black pl-4 flex flex-col justify-center items-center min-w-[100px]">
            <div className="bg-black text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm mb-1">Token</div>
            <div className="text-[64px] font-bold text-black leading-none">{token.token_number}</div>
          </div>
        </div>
        
        <div className="border-b-2 border-black w-full mb-4"></div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="uppercase text-[10px] text-gray-500 font-bold mb-1">Patient Name</p>
            <p className="text-black font-bold uppercase text-sm">{token.name}</p>
          </div>
          <div className="text-right">
            <p className="uppercase text-[10px] text-gray-500 font-bold mb-1">Department</p>
            <p className="text-black font-bold uppercase text-sm">{token.department}</p>
          </div>
        </div>
        
        <div className="border-2 border-dashed border-gray-400 rounded-md p-4 min-h-[120px] mt-4 flex items-start">
          <p className="text-gray-400 text-xs italic">Rx / Notes</p>
        </div>
      </div>
    </main>
  );
}

export default function TokenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Loading...</div>}>
      <TokenContent />
    </Suspense>
  );
}
