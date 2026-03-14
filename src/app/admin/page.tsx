'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AdminPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [queueStates, setQueueStates] = useState<Record<string, { current: number, is_paused: boolean }>>({});
  const [waitingCounts, setWaitingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch queue states
      const { data: qData } = await supabase.from('queue_state').select('*').order('department');
      const depts: string[] = [];
      if (qData) {
        const states: Record<string, { current: number, is_paused: boolean }> = {};
        qData.forEach(row => {
          states[row.department] = { current: row.current_token, is_paused: row.is_paused };
          depts.push(row.department);
        });
        setQueueStates(states);
        setDepartments(depts);
      }

      // Fetch waiting counts
      const counts: Record<string, number> = {};
      for (const dept of depts) {
        const { count } = await supabase
          .from('tokens')
          .select('*', { count: 'exact', head: true })
          .eq('department', dept)
          .eq('status', 'waiting');
        counts[dept] = count || 0;
      }
      setWaitingCounts(counts);
    };

    fetchInitialData();

    // Subscribe to queue_state table
    const stateSub = supabase
      .channel('admin-queue-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_state' }, (payload: any) => {
        setQueueStates(prev => ({
          ...prev,
          [payload.new.department]: { current: payload.new.current_token, is_paused: payload.new.is_paused }
        }));
      })
      .subscribe();

    // Subscribe to tokens table to update waiting counts live
    const tokenSub = supabase
      .channel('admin-tokens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, async (payload: any) => {
        const affectedDept = payload.new?.department || payload.old?.department;
        if (affectedDept) {
          const { count } = await supabase
            .from('tokens')
            .select('*', { count: 'exact', head: true })
            .eq('department', affectedDept)
            .eq('status', 'waiting');
          
          setWaitingCounts(prev => ({
            ...prev,
            [affectedDept]: count || 0
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateSub);
      supabase.removeChannel(tokenSub);
    };
  }, []);

  const handleCallNext = async (department: string) => {
    if (loading[department] || waitingCounts[department] === 0 || queueStates[department]?.is_paused) return;

    setLoading(prev => ({ ...prev, [department]: true }));
    try {
      const { data: nextToken, error: fetchError } = await supabase
        .from('tokens')
        .select('*')
        .eq('department', department)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (fetchError || !nextToken) return;

      const { error: tokenError } = await supabase
        .from('tokens')
        .update({ status: 'called' })
        .eq('id', nextToken.id);

      if (tokenError) throw tokenError;

      const { error: stateError } = await supabase
        .from('queue_state')
        .update({ current_token: nextToken.token_number })
        .eq('department', department);

      if (stateError) throw stateError;

    } catch (error) {
      console.error('Error calling next:', error);
      alert('Failed to call next patient.');
    } finally {
      setLoading(prev => ({ ...prev, [department]: false }));
    }
  };

  const handleReset = async (department: string) => {
    if (window.confirm(`Reset ${department} queue? This cannot be undone.`)) {
      setLoading(prev => ({ ...prev, [department]: true }));
      try {
        await supabase
          .from('tokens')
          .update({ status: 'completed' })
          .eq('department', department)
          .in('status', ['waiting', 'called']);

        await supabase
          .from('queue_state')
          .update({ current_token: 0 })
          .eq('department', department);
          
      } catch (error) {
        console.error('Error resetting queue:', error);
        alert('Failed to reset queue.');
      } finally {
        setLoading(prev => ({ ...prev, [department]: false }));
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#F1F5F9]">
      <header className="bg-white w-full shadow-sm px-8 py-6 mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
          MediQueue
        </h1>
        <h2 className="text-xl font-medium text-slate-700 hidden md:block">
          Admin — Queue Control
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-600">Live</span>
          </div>
          <Link href="/admin/doctors" className="text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
            Manage Doctors →
          </Link>
        </div>
      </header>

      <div className="px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {departments.map((dept: string) => {
            const state = queueStates[dept];
            const currentToken = state?.current || 0;
            const isPaused = state?.is_paused || false;
            
            const waitingCount = waitingCounts[dept] || 0;
            const isCallNextDisabled = loading[dept] || waitingCount === 0 || isPaused;

            return (
              <motion.div
                key={dept}
                whileHover={{ y: -2 }}
                className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 flex flex-col relative overflow-hidden"
              >
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold text-indigo-600 mb-4">{dept}</h3>
                  
                  {isPaused && (
                    <div className="absolute top-8 right-8 bg-amber-100 text-amber-700 px-3 py-1 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wider">
                      Queue Paused — No Active Doctor
                    </div>
                  )}

                  <p className="text-xs text-slate-400 font-light uppercase tracking-wider mb-1">
                    Now Serving
                  </p>
                  <p className="text-5xl font-black text-slate-800 mb-6">
                    {currentToken === 0 ? '—' : currentToken}
                  </p>
                  
                  <div className="h-px bg-slate-100 w-full mb-6" />
                  
                  <p className="text-sm text-slate-600 font-medium mb-6">
                    {waitingCount} {waitingCount === 1 ? 'patient' : 'patients'} waiting
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleCallNext(dept)}
                    disabled={isCallNextDisabled}
                    className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold py-4 px-6 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading[dept] ? 'Processing...' : 'Call Next'}
                  </button>
                  
                  <button
                    onClick={() => handleReset(dept)}
                    disabled={loading[dept]}
                    className="w-full text-red-500 text-sm font-medium py-2 rounded-xl border border-transparent hover:border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Reset Queue
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
