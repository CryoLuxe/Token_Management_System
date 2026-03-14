'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function SelectDoctorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const name = searchParams.get('name');
  const age = searchParams.get('age');
  const department = searchParams.get('department');

  const [doctors, setDoctors] = useState<any[]>([]);
  const [waitCounts, setWaitCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [recommendedDocId, setRecommendedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!name || !age || !department) {
      router.replace('/checkin');
      return;
    }

    const fetchDoctorsData = async () => {
      // 1. Fetch doctors for this department
      const { data: docsData, error: docsError } = await supabase
        .from('doctors')
        .select('*')
        .eq('department', department)
        .order('name', { ascending: true });

      if (docsError || !docsData) {
        setLoading(false);
        return;
      }
      
      setDoctors(docsData);

      // 2. Compute live wait counts for active doctors
      const activeDocs = docsData.filter(d => d.is_active);
      const counts: Record<string, number> = {};
      
      for (const doc of activeDocs) {
        const { count } = await supabase
          .from('tokens')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', doc.id)
          .eq('status', 'waiting');
        
        counts[doc.id] = count || 0;
      }
      
      setWaitCounts(counts);

      // 3. Auto-Assignment Logic
      if (activeDocs.length > 0) {
        // Find minimum wait count
        let minWait = Infinity;
        for (const doc of activeDocs) {
          if (counts[doc.id] < minWait) minWait = counts[doc.id];
        }

        // Collect ties
        const tiedDocs = activeDocs.filter(doc => counts[doc.id] === minWait);
        
        // Randomly pick one of the tied docs
        const chosenDoc = tiedDocs[Math.floor(Math.random() * tiedDocs.length)];
        
        setRecommendedDocId(chosenDoc.id);
        setSelectedDocId(chosenDoc.id);
      }

      setLoading(false);
    };

    fetchDoctorsData();
  }, [name, age, department, router]);

  const handleConfirm = async () => {
    if (!selectedDocId || !name || !age || !department || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedDoc = doctors.find(d => d.id === selectedDocId);
      
      // Get all tokens for this department to calculate raw token boundary
      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('department', department);

      // Calculate strictly doctor-scoped position
      const { count: doctorWaitCount } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', selectedDocId)
        .eq('status', 'waiting');

      const tokenNumber = (totalTokens || 0) + 1;
      const position = (doctorWaitCount || 0) + 1;

      const { data, error } = await supabase
        .from('tokens')
        .insert([
          {
            name,
            age: parseInt(age),
            department,
            doctor_id: selectedDocId,
            doctor_name: selectedDoc?.name,
            token_number: tokenNumber,
            position,
            status: 'waiting'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      router.push(`/token?id=${data.id}`);
    } catch (error: any) {
      console.error('Error generating token:', error);
      alert(`Failed to assign token: ${error?.message || 'Please try again.'}`);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center p-4 bg-[#F1F5F9]">Finding available doctors...</main>;
  }

  const activeDoctorsCount = doctors.filter(d => d.is_active).length;

  return (
    <main className="min-h-screen bg-[#F1F5F9] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/checkin" className="inline-flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-800 transition-colors mb-4 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Choose Your Doctor</h1>
          <p className="text-slate-500">We've suggested the best available doctor for you</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        {/* Patient Summary Bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-x-8 gap-y-2 mb-8 items-center text-sm font-medium text-slate-600">
          <div><span className="text-slate-400 font-light">Patient:</span> {name}</div>
          <div className="w-px h-4 bg-slate-200 hidden sm:block" />
          <div><span className="text-slate-400 font-light">Age:</span> {age}</div>
          <div className="w-px h-4 bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-light">Department:</span>
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-xs uppercase tracking-wide">
              {department}
            </span>
          </div>
        </div>

        {/* Doctor Grid or Offline State */}
        {activeDoctorsCount === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-100 rounded-3xl p-12 text-center shadow-sm max-w-lg mx-auto mt-12"
          >
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-3">No Doctors Available</h2>
            <p className="text-red-700 font-medium leading-relaxed">
              All doctors in {department} are currently unavailable.<br/>
              Please visit the reception desk or try again later.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AnimatePresence>
              {doctors.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isRecommended = recommendedDocId === doc.id;
                const waitCount = waitCounts[doc.id] || 0;

                if (!doc.is_active) {
                  return (
                    <div key={doc.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 opacity-45 relative pointer-events-none">
                      <div className="absolute top-4 right-4 bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
                        Temporarily Unavailable
                      </div>
                      <h3 className="text-xl font-bold text-slate-500 mb-3 pr-24">{doc.name}</h3>
                      <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
                        {doc.department}
                      </div>
                    </div>
                  );
                }

                return (
                  <motion.button
                    key={doc.id}
                    layout
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`text-left rounded-2xl p-6 relative transition-all duration-200 ${
                      isSelected 
                        ? 'bg-indigo-50/50 border-2 border-indigo-500 shadow-md shadow-indigo-100/50' 
                        : 'bg-white border-2 border-transparent shadow-sm hover:shadow-md hover:border-indigo-100'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        Recommended ✓
                      </div>
                    )}
                    
                    <h3 className={`text-2xl font-bold mb-4 pr-32 ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {doc.name}
                    </h3>
                    
                    <div className="flex flex-col gap-4 mt-auto">
                      <div className="bg-gradient-to-r from-indigo-500 w-fit to-violet-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                        {doc.department}
                      </div>
                      
                      <div className="mt-2 font-medium">
                        {waitCount === 0 ? (
                          <span className="text-emerald-600">No queue — see immediately</span>
                        ) : (
                          <span className="text-amber-600">{waitCount} {waitCount === 1 ? 'patient' : 'patients'} waiting</span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Confirm Button */}
        {activeDoctorsCount > 0 && (
          <div className="mt-12 max-w-sm mx-auto">
            <button
              onClick={handleConfirm}
              disabled={!selectedDocId || isSubmitting}
              className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold py-4 px-6 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
            >
              {isSubmitting ? 'Processing...' : 'Confirm & Get Token'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SelectDoctorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">Loading...</div>}>
      <SelectDoctorContent />
    </Suspense>
  );
}
