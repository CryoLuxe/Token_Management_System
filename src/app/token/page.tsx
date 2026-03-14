'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, Clock, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

function TokenContent() {
  const searchParams = useSearchParams();
  const tokenId = searchParams.get('id');
  const [token, setToken] = useState<any>(null);
  const [currentServing, setCurrentServing] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) return;

    const fetchTokenAndState = async () => {
      const { data: tokenData } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      
      if (tokenData) {
        setToken(tokenData);
        // Fetch current serving token for this department
        const { data: stateData } = await supabase
          .from('queue_state')
          .select('current_token')
          .eq('department', tokenData.department)
          .single();
        
        if (stateData) {
          setCurrentServing(stateData.current_token);
        }
      }
      setLoading(false);
    };

    fetchTokenAndState();

    // Subscribe to real-time updates for this token
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

    // Subscribe to queue_state for this department
    const stateSub = supabase
      .channel(`state-${tokenId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'queue_state' },
        (payload) => {
          if (token && payload.new.department === token.department) {
            setCurrentServing(payload.new.current_token);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokenSub);
      supabase.removeChannel(stateSub);
    };
  }, [tokenId, token?.department]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!token) return <div className="min-h-screen flex items-center justify-center">Token not found.</div>;

  const handlePrint = () => {
    window.print();
  };

  const livePosition = Math.max(0, token.token_number - currentServing);
  const estimatedWait = livePosition * 7;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {token.status === 'called' && (
        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-emerald-500 text-white p-6 rounded-2xl mb-6 shadow-lg border-2 border-emerald-400 no-print"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full animate-pulse">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl">It's Your Turn!</h2>
              <p className="opacity-90">Please proceed to the {token.department} counter.</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md card-elevated p-8 text-center print-card"
      >
        <div className="flex justify-center mb-6">
          <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
            {token.department}
          </span>
        </div>

        <p className="text-slate-400 font-light mb-2">Your Token Number</p>
        <h1 className="text-8xl font-black text-indigo-600 mb-6 drop-shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
          {token.token_number}
        </h1>

        <div className="h-px bg-slate-100 w-full mb-8" />

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="text-xs text-slate-400 font-light mb-1">Queue Position</p>
            <p className="text-lg font-bold text-slate-700">
              {livePosition === 0 ? 'Now Serving' : `${livePosition}${getOrdinal(livePosition)} in line`}
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="text-xs text-slate-400 font-light mb-1">Estimated Wait</p>
            <p className="text-lg font-bold text-slate-700">~{estimatedWait} mins</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${token.status === 'waiting' ? 'bg-amber-400' : 'bg-emerald-500'} animate-pulse`} />
          <span className="font-medium text-slate-600 capitalize">{token.status}</span>
        </div>

        <button 
          onClick={handlePrint}
          className="btn-primary w-full flex items-center justify-center gap-3 no-print"
        >
          <Printer size={20} />
          Print Token
        </button>

        <div className="hidden print-only mt-8 text-xs text-slate-400">
          <p>MediQueue - Hospital Token Management</p>
          <p>{new Date().toLocaleString()}</p>
        </div>
      </motion.div>
      
      <button 
        onClick={() => window.location.href = '/checkin'}
        className="mt-8 text-indigo-500 flex items-center gap-2 hover:gap-3 transition-all no-print"
      >
        <ArrowRight size={18} />
        New Registration
      </button>
    </main>
  );
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export default function TokenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <TokenContent />
    </Suspense>
  );
}
