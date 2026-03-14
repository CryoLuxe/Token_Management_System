'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function BoardPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [queueStates, setQueueStates] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data, error } = await supabase.from('queue_state').select('*').order('department');
      if (!error && data) {
        const states: Record<string, number> = {};
        const depts: string[] = [];
        data.forEach(row => {
          states[row.department] = row.current_token;
          depts.push(row.department);
        });
        setQueueStates(states);
        setDepartments(depts);
      }
    };

    fetchInitialData();

    // Subscribe to queue_state table
    const stateSub = supabase
      .channel('board-queue-state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue_state' }, (payload: any) => {
        setQueueStates(prev => ({
          ...prev,
          [payload.new.department]: payload.new.current_token
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateSub);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0F0C29] via-[#302B63] to-[#24243e] p-8 flex flex-col">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-black text-white tracking-tight drop-shadow-lg">
          Currently Serving
        </h1>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          <span className="text-emerald-300 font-medium tracking-wide">Live Feed</span>
        </div>
      </header>

      <div className="flex-grow flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:justify-center gap-6 max-w-[1400px] w-full mx-auto">
          {departments.map((dept) => {
            const currentToken = queueStates[dept] || 0;

            return (
              <motion.div
                key={dept}
                layout
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 flex flex-col items-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full xl:w-64"
              >
                <h2 className="text-xl font-bold text-indigo-200 mb-6 uppercase tracking-widest text-center">
                  {dept}
                </h2>
                
                <div className="flex-grow flex items-center justify-center bg-white/5 w-full rounded-2xl p-6 border border-white/10">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={currentToken}
                      initial={{ opacity: 0, scale: 0.5, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.5, y: 20 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="text-7xl font-black font-mono text-white tracking-tighter drop-shadow-md"
                    >
                      {currentToken === 0 ? '—' : currentToken}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <footer className="fixed bottom-8 left-0 right-0 text-center text-white/20 text-sm">
        Please wait for your token number to be displayed.
      </footer>
    </main>
  );
}
