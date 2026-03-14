'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import PatientHeader from '@/components/PatientHeader';

export default function CheckinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState('en-IN');
  const [loading, setLoading] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Read selected language
    const storedLang = localStorage.getItem('mediqueue_lang');
    if (storedLang === 'ml') {
      setLang('ml-IN');
    } else {
      setLang('en-IN');
    }

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
      // Stay loading until nav completes
    }
  };

  if (!initialFetchDone) {
    return <main className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Loading application...</main>;
  }

  return (
    <main className="min-h-screen bg-[#EBF4F7] flex flex-col font-sans">
      <PatientHeader />
      
      <div className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-[480px] bg-white border border-[#D0E8F0] rounded-lg p-8 relative">
          
          <Link href="/" className="absolute top-8 left-8 text-[#2B9BB8] text-sm font-medium hover:text-[#1E7A94] transition-colors">
            ← Back
          </Link>

          <div className="mt-8 mb-8">
            <h2 className="text-[22px] font-bold text-[#1B3A5C]">
              Patient Registration
            </h2>
            <div className="w-12 h-[3px] bg-[#2B9BB8] mt-2"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block uppercase tracking-[0.05em] text-[12px] font-bold text-[#5A7A8A]">
                Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#D0E8F0] rounded-md px-4 py-3 text-[16px] text-[#1B3A5C] focus:outline-none focus:border-[#2B9BB8] transition-colors pr-12"
                  placeholder="Enter your name"
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md transition-all ${
                    isListening ? 'bg-[#EBF4F7] text-[#2B9BB8] animate-pulse' : 'text-[#5A7A8A] hover:text-[#2B9BB8]'
                  }`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block uppercase tracking-[0.05em] text-[12px] font-bold text-[#5A7A8A]">
                Age
              </label>
              <input
                type="number"
                required
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full border border-[#D0E8F0] rounded-md px-4 py-3 text-[16px] text-[#1B3A5C] focus:outline-none focus:border-[#2B9BB8] transition-colors"
                placeholder="How old are you?"
              />
            </div>

            <div className="space-y-2">
              <label className="block uppercase tracking-[0.05em] text-[12px] font-bold text-[#5A7A8A]">
                Department
              </label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-[#D0E8F0] rounded-md px-4 py-3 text-[16px] text-[#1B3A5C] focus:outline-none focus:border-[#2B9BB8] transition-colors appearance-none bg-white"
                >
                  {departments.map((dept: string) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A7A8A] pointer-events-none" size={20} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2B9BB8] hover:bg-[#1E7A94] disabled:bg-[#A0AEC0] text-white font-bold text-[16px] uppercase py-4 px-6 rounded-lg transition-colors mt-6"
            >
              {loading ? 'Processing...' : 'Next'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
