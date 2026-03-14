'use client';

import { useRouter } from 'next/navigation';
import PatientHeader from '@/components/PatientHeader';

export default function Home() {
  const router = useRouter();

  const handleLanguageSelect = (lang: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mediqueue_lang', lang);
      router.push('/checkin');
    }
  };

  return (
    <main className="min-h-screen bg-[#EBF4F7] flex flex-col font-sans">
      <PatientHeader />
      
      <div className="flex-grow flex flex-col items-center justify-center p-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#1B3A5C] mb-12 text-center">
          Choose Your Language
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl justify-center">
          <button
            onClick={() => handleLanguageSelect('en')}
            className="flex-1 bg-[#2B9BB8] hover:bg-[#1E7A94] text-white font-bold text-xl py-8 px-6 rounded-lg transition-colors shadow-sm active:scale-[0.98] min-h-[100px]"
          >
            English
          </button>
          
          <button
            onClick={() => handleLanguageSelect('ml')}
            className="flex-1 bg-[#2B9BB8] hover:bg-[#1E7A94] text-white font-bold text-2xl py-8 px-6 rounded-lg transition-colors shadow-sm active:scale-[0.98] min-h-[100px]"
          >
            മലയാളം
          </button>
        </div>
      </div>
    </main>
  );
}
