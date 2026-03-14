'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import PatientHeader from '@/components/PatientHeader';

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

      if (activeDocs.length > 0) {
        let minWait = Infinity;
        for (const doc of activeDocs) {
          if (counts[doc.id] < minWait) minWait = counts[doc.id];
        }

        const tiedDocs = activeDocs.filter(doc => counts[doc.id] === minWait);
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
      
      const { count: totalTokens } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('department', department);

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
    return <main className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Finding available doctors...</main>;
  }

  const activeDoctorsCount = doctors.filter(d => d.is_active).length;

  return (
    <main className="min-h-screen bg-[#EBF4F7] font-sans pb-24">
      <PatientHeader />

      <div className="max-w-4xl mx-auto px-6 mt-6">
        <Link href="/checkin" className="inline-block text-[#2B9BB8] text-sm font-medium hover:text-[#1E7A94] transition-colors mb-6">
          ← Back
        </Link>
        
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1B3A5C] mb-8 text-center">
          Select a Doctor
        </h1>

        {/* Patient Summary Bar */}
        <div className="bg-white rounded-lg p-6 border border-[#D0E8F0] flex flex-wrap gap-x-12 gap-y-4 mb-8">
          <div>
            <div className="uppercase tracking-[0.05em] text-[12px] text-[#5A7A8A] mb-1">Patient Name</div>
            <div className="font-bold text-[#1B3A5C] text-lg">{name}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.05em] text-[12px] text-[#5A7A8A] mb-1">Age</div>
            <div className="font-bold text-[#1B3A5C] text-lg">{age}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.05em] text-[12px] text-[#5A7A8A] mb-1">Department</div>
            <div className="font-bold text-[#1B3A5C] text-lg uppercase">{department}</div>
          </div>
        </div>

        {/* Doctor Grid or Offline State */}
        {activeDoctorsCount === 0 ? (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg p-8 text-center max-w-2xl mx-auto mt-8">
            <h2 className="text-xl font-bold text-[#DC2626] mb-2">No Doctors Available</h2>
            <p className="text-[#991B1B]">
              All doctors in {department} are currently unavailable.<br/>
              Please visit the reception desk or try again later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {doctors.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isRecommended = recommendedDocId === doc.id;
                const waitCount = waitCounts[doc.id] || 0;

                if (!doc.is_active) {
                  return (
                    <div key={doc.id} className="bg-white rounded-lg p-5 border border-[#D0E8F0] opacity-40 relative pointer-events-none">
                      <div className="absolute top-4 right-4 bg-[#FEF2F2] text-[#DC2626] text-[11px] font-bold px-2 py-1 roundeduppercase tracking-[0.05em]">
                        UNAVAILABLE
                      </div>
                      <h3 className="text-[18px] font-bold text-[#1B3A5C] mb-3 pr-24">{doc.name}</h3>
                      <div className="text-[#2B9BB8] border border-[#2B9BB8] rounded px-2 py-0.5 text-[12px] uppercase inline-block mb-3">
                        {doc.department}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`text-left rounded-lg p-5 relative transition-all duration-200 block w-full ${
                      isSelected 
                        ? 'bg-[#F0F9FC] border-[2px] border-[#2B9BB8]' 
                        : 'bg-white border border-[#D0E8F0] hover:border-[#2B9BB8]'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-4 right-4 bg-[#2B9BB8] text-white text-[11px] font-bold px-2 py-1 rounded uppercase tracking-[0.05em]">
                        RECOMMENDED
                      </div>
                    )}
                    
                    <h3 className="text-[18px] font-bold text-[#1B3A5C] mb-3 pr-28">
                      {doc.name}
                    </h3>
                    
                    <div className="text-[#2B9BB8] border border-[#2B9BB8] rounded px-2 py-0.5 text-[12px] uppercase inline-block mb-4">
                      {doc.department}
                    </div>
                    
                    <div className="mt-auto">
                      {waitCount === 0 ? (
                        <div className="text-[#16A34A] text-[14px] font-medium">No queue — see immediately</div>
                      ) : (
                        <div className="text-[#5A7A8A] text-[14px]">Tokens Booked: <span className="font-bold">{waitCount}</span></div>
                      )}
                    </div>
                  </button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Confirm Button */}
        {activeDoctorsCount > 0 && (
          <div className="mt-8 max-w-sm mx-auto">
            <button
              onClick={handleConfirm}
              disabled={!selectedDocId || isSubmitting}
              className="w-full bg-[#2B9BB8] hover:bg-[#1E7A94] disabled:bg-[#A0AEC0] text-white font-bold text-[16px] uppercase py-4 px-6 rounded-lg transition-colors"
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
    <Suspense fallback={<div className="min-h-screen bg-[#EBF4F7] flex items-center justify-center p-4">Loading...</div>}>
      <SelectDoctorContent />
    </Suspense>
  );
}
