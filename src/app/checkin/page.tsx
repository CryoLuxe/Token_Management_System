'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, Languages, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CheckinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [lang, setLang] = useState('en-IN');
  const [loading, setLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from('queue_state').select('department').order('department');
      if (data && data.length > 0) {
        const parsedDepts = data.map((d: any) => d.department);
        setDepartments(parsedDepts);
        setDepartment(parsedDepts[0]);
      }
      setInitialFetchDone(true);
    };

    fetchDepartments();

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).speechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setName(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setIsListening(true);
      setShowLangSelector(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age || !department || loading) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        name,
        age,
        department
      });
      router.push(`/select-doctor?${params.toString()}`);
    } catch (error: any) {
      console.error('Error navigating:', error);
    } finally {
      // Let it stay loading until navigation completes
    }
  };

  if (!initialFetchDone) {
    return <main className="min-h-screen flex items-center justify-center p-4">Loading application...</main>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            MediQueue
          </h1>
          <p className="text-slate-500 font-light mt-1">Register & Get Your Token</p>
        </div>

        <div className="card-elevated p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-light text-slate-500">Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-styled pr-12"
                  placeholder="Enter your name"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowLangSelector(!showLangSelector)}
                    className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                    <Languages size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-lg transition-all ${
                      isListening ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-500'
                    }`}
                  >
                    {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                </div>

                <AnimatePresence>
                  {showLangSelector && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-slate-100 p-2 z-10 w-32"
                    >
                      <button
                        type="button"
                        onClick={() => { setLang('en-IN'); setShowLangSelector(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${lang === 'en-IN' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600'}`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLang('ml-IN'); setShowLangSelector(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm ${lang === 'ml-IN' ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-600'}`}
                      >
                        Malayalam
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-light text-slate-500">Age</label>
              <input
                type="number"
                required
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input-styled"
                placeholder="How old are you?"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-light text-slate-500">Department</label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="input-styled appearance-none"
                >
                  {departments.map((dept: string) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              {loading ? 'Processing...' : 'Next'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
