import { Plus } from 'lucide-react';

export default function PatientHeader() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="bg-white border-b-[3px] border-[#2B9BB8] h-16 w-full flex items-center justify-between px-6 sticky top-0 z-50 no-print">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#2B9BB8] flex items-center justify-center text-white">
          <Plus size={20} strokeWidth={3} />
        </div>
        <h1 className="text-[#1B3A5C] font-bold text-lg tracking-tight">
          VSNN Health Center
        </h1>
      </div>
      
      <div className="text-[#5A7A8A] text-sm font-medium hidden sm:block">
        {currentDate}
      </div>
    </header>
  );
}
