'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, UserPlus, Edit2, Play, Pause, Trash2, X, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DoctorsPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [currentDoctor, setCurrentDoctor] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', department: '' });
  const [newDeptName, setNewDeptName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();

    // Set up realtime subscription to listen to doctor table changes
    const doctorSub = supabase
      .channel('admin-doctors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
        fetchInitialData();
      })
      .subscribe();
      
    const queueSub = supabase
      .channel('admin-queue-dept')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'queue_state' }, (payload: any) => {
        setDepartments(prev => {
          if (!prev.includes(payload.new.department)) {
            return [...prev, payload.new.department].sort();
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(doctorSub);
      supabase.removeChannel(queueSub);
    };
  }, []);

  const fetchInitialData = async () => {
    // Fetch departments
    const { data: qData } = await supabase.from('queue_state').select('department').order('department');
    if (qData && qData.length > 0) {
      setDepartments(qData.map(d => d.department));
      if (!formData.department) {
        setFormData(prev => ({ ...prev, department: qData[0].department }));
      }
    }

    // Fetch doctors
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('department', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setDoctors(data);
    }
    setLoading(false);
  };

  const handleOpenAddModal = () => {
    setFormData({ name: '', department: departments[0] || '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (doctor: any) => {
    setCurrentDoctor(doctor);
    setFormData({ name: doctor.name, department: doctor.department });
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setIsAddDeptModalOpen(false);
    setCurrentDoctor(null);
  };

  const handleAddDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;
    setIsSubmitting(true);
    try {
      // Set is_paused to true initially since it has no doctors
      const { error } = await supabase.from('queue_state').insert({
        department: newDeptName.trim(),
        current_token: 0,
        is_paused: true 
      });

      if (error) throw error;
      setNewDeptName('');
      handleCloseModals();
      await fetchInitialData();
    } catch (error: any) {
      console.error('Error adding department:', error);
      alert(`Failed to add department: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('doctors').insert([
        {
          name: formData.name,
          department: formData.department,
          is_active: true
        }
      ]);

      if (error) throw error;

      // Ensure the department queue is automatically unpaused if there's now an active doctor
      await supabase
        .from('queue_state')
        .update({ is_paused: false })
        .eq('department', formData.department);

      handleCloseModals();
    } catch (error: any) {
      console.error('Error adding doctor:', error);
      alert(`Failed to add doctor: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !currentDoctor) return;
    setIsSubmitting(true);

    try {
      // Find the old department before updating
      const oldDept = currentDoctor.department;
      
      const { error } = await supabase
        .from('doctors')
        .update({ name: formData.name, department: formData.department })
        .eq('id', currentDoctor.id);

      if (error) throw error;

      if (oldDept !== formData.department) {
        // If they switched departments, we should re-evaluate pauses for both the old and new department
        await updateQueuePauseState(oldDept);
        await updateQueuePauseState(formData.department);
      }

      handleCloseModals();
    } catch (error: any) {
      console.error('Error editing doctor:', error);
      alert(`Failed to edit doctor: ${error?.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (doctor: any) => {
    const action = doctor.is_active ? 'Deactivate' : 'Reactivate';
    const queueAction = doctor.is_active ? 'paused' : 'resume';
    
    if (!window.confirm(`${action} ${doctor.name}? Their department queue will ${queueAction}.`)) {
      return;
    }

    try {
      const newActiveStatus = !doctor.is_active;
      const { error: doctorError } = await supabase
        .from('doctors')
        .update({ is_active: newActiveStatus })
        .eq('id', doctor.id);

      if (doctorError) throw doctorError;

      if (!newActiveStatus) {
        await supabase
          .from('queue_state')
          .update({ is_paused: true })
          .eq('department', doctor.department);
      } else {
        await supabase
          .from('queue_state')
          .update({ is_paused: false })
          .eq('department', doctor.department);
      }

    } catch (error) {
      console.error('Error updating doctor status:', error);
      alert('Failed to update doctor status.');
    }
  };

  const handleDelete = async (doctor: any) => {
    if (!window.confirm(`Permanently delete ${doctor.name}? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', doctor.id);

      if (error) throw error;
      await updateQueuePauseState(doctor.department);
    } catch (error) {
      console.error('Error deleting doctor:', error);
      alert('Failed to delete doctor.');
    }
  };

  const updateQueuePauseState = async (department: string) => {
    const { count } = await supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('department', department)
      .eq('is_active', true);

    const shouldBePaused = count === 0;
    await supabase
      .from('queue_state')
      .update({ is_paused: shouldBePaused })
      .eq('department', department);
  };

  return (
    <main className="min-h-screen bg-[#F1F5F9]">
      <header className="bg-white w-full shadow-sm px-8 py-6 mb-8 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2 text-sm font-medium">
            <ArrowLeft size={16} />
            Back to Queue Control
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent hidden sm:block">
            Doctor Management
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAddDeptModalOpen(true)}
            className="text-indigo-500 font-medium py-3 px-4 rounded-xl flex items-center gap-2 hover:bg-indigo-50 transition-all border border-indigo-100"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Department</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-md shadow-indigo-200"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Add Doctor</span>
          </button>
        </div>
      </header>

      <div className="px-8 pb-12 max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <h2 className="text-xl font-bold text-slate-700 mb-2">No doctors found</h2>
            <p className="text-slate-500 font-light mb-6">Add a doctor to manage their availability for the queue.</p>
            <button
              onClick={handleOpenAddModal}
              className="text-indigo-600 font-medium hover:underline"
            >
              + Add your first doctor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {doctors.map((doctor) => (
              <motion.div
                key={doctor.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className={`rounded-2xl shadow-md border p-6 flex flex-col justify-between transition-colors ${
                  doctor.is_active ? 'bg-white border-slate-100' : 'bg-red-50 border-red-100'
                }`}
              >
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {doctor.department}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${doctor.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={`text-xs font-medium ${doctor.is_active ? 'text-emerald-600' : 'text-red-500'}`}>
                        {doctor.is_active ? 'Active' : 'Temporarily Deactivated'}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-indigo-900 truncate" title={doctor.name}>{doctor.name}</h3>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100/50">
                  <button
                    onClick={() => handleOpenEditModal(doctor)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-colors"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(doctor)}
                      className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                        doctor.is_active 
                          ? 'border-red-200 text-red-500 hover:bg-red-50' 
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {doctor.is_active ? <Pause size={16} /> : <Play size={16} />}
                      {doctor.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(doctor)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors ml-1"
                      title="Delete Doctor"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen || isAddDeptModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={handleCloseModals}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white"
            >
              <button 
                onClick={handleCloseModals}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-6">
                {isAddDeptModalOpen ? 'Add Department' : isEditModalOpen ? 'Edit Doctor' : 'Add New Doctor'}
              </h2>
              
              {isAddDeptModalOpen ? (
                <form onSubmit={handleAddDeptSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Department Name</label>
                    <input
                      type="text"
                      required
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                      placeholder="e.g. Neurology"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="pt-4 flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newDeptName}
                      className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : 'Create Department'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={isEditModalOpen ? handleEditSubmit : handleAddSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                      placeholder="e.g. Dr. John Doe"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none bg-white font-medium text-slate-700"
                      disabled={isSubmitting}
                    >
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="pt-4 flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-100 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving...' : isEditModalOpen ? 'Save Changes' : 'Add Doctor'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleCloseModals}
                      disabled={isSubmitting}
                      className="w-full py-3 text-slate-500 font-medium hover:text-slate-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
