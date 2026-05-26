import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, setDoc, addDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getNextSequenceValue } from '../utils/sequences';
import { Token, Prescription, PrescriptionTemplate, Patient } from '../types';
import { format } from 'date-fns';
import { LogOut, User, ClipboardList, Plus, Save, CheckCircle } from 'lucide-react';

const DoctorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [currentConsultation, setCurrentConsultation] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [prescriptionForm, setPrescriptionForm] = useState({
    diagnosis: '',
    medicines: '',
    notes: '',
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(
        collection(db, 'tokens'),
        where('doctor_id', '==', auth.currentUser.uid),
        where('date', '==', today),
        orderBy('token_number', 'asc')
      );

      const unsubTokens = onSnapshot(q, (snapshot) => {
        const tokenList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Token));
        setTokens(tokenList);
        
        const inConsultation = tokenList.find(t => t.status === 'In Consultation');
        setCurrentConsultation(inConsultation || null);
        setLoading(false);
      });

      const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
        const patientMap: Record<string, Patient> = {};
        snapshot.docs.forEach(d => {
          patientMap[d.id] = { id: d.id, ...d.data() } as Patient;
        });
        setPatients(patientMap);
      });

      const unsubTemplates = onSnapshot(
        query(collection(db, 'prescription_templates'), where('doctor_id', '==', auth.currentUser.uid)),
        (snapshot) => {
          setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PrescriptionTemplate)));
        }
      );

      return () => {
        unsubTokens();
        unsubPatients();
        unsubTemplates();
      };
    }
  }, [auth.currentUser, today]);

  const handleCallNext = async () => {
    const next = tokens.find(t => t.status === 'Waiting');
    if (next) {
      await updateDoc(doc(db, 'tokens', next.id), { status: 'In Consultation' });
    }
  };

  const handleApplyTemplate = (template: PrescriptionTemplate) => {
    setPrescriptionForm({
      diagnosis: template.diagnosis,
      medicines: template.medicines,
      notes: template.notes || '',
    });
  };

  const handleSavePrescription = async () => {
    if (!currentConsultation || !auth.currentUser) return;
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const prescriptionNo = await getNextSequenceValue('prescriptions', 50001);
      
      const patientObj = patients[currentConsultation.patient_id];
      
      await setDoc(doc(db, 'prescriptions', prescriptionNo.toString()), {
        token_id: currentConsultation.id,
        doctor_id: auth.currentUser.uid,
        doctor_no: (profile as any)?.doctor_id_display || null,
        patient_id: currentConsultation.patient_id,
        patient_no: (patientObj as any)?.patient_id_display || null,
        diagnosis: prescriptionForm.diagnosis,
        medicines: prescriptionForm.medicines,
        notes: prescriptionForm.notes,
        date: today,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Error saving prescription:", error);
      setSaveStatus('error');
      setErrorMessage(error.message);
    }
  };

  const handleSeedTemplates = async () => {
    if (!auth.currentUser) return;
    const initialTemplates = [
      { title: 'Common Cold', diagnosis: 'Viral Upper Respiratory Infection', medicines: '1. Paracetamol 500mg (3 times a day)\n2. Cetirizine 10mg (at night)\n3. Cough Syrup (as needed)', notes: 'Rest and drink plenty of fluids.' },
      { title: 'Fever', diagnosis: 'Fever of Unknown Origin', medicines: '1. Paracetamol 650mg (every 6 hours)\n2. Multivitamin (once daily)', notes: 'Monitor temperature every 4 hours.' },
      { title: 'Stomach Ache', diagnosis: 'Gastroenteritis', medicines: '1. Antacid (before meals)\n2. ORS (frequently)\n3. Probiotic (once daily)', notes: 'Avoid spicy food for 3 days.' }
    ];

    for (const t of initialTemplates) {
      await addDoc(collection(db, 'prescription_templates'), {
        ...t,
        doctor_id: auth.currentUser.uid
      });
    }
  };

  const handleMarkCompleted = async () => {
    if (!currentConsultation) return;
    await updateDoc(doc(db, 'tokens', currentConsultation.id), { status: 'Completed' });
    setPrescriptionForm({ diagnosis: '', medicines: '', notes: '' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const waitingTokens = tokens.filter(t => t.status === 'Waiting');
  const completedTokens = tokens.filter(t => t.status === 'Completed');

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#5A5A40]">Doctor Dashboard</h1>
            <p className="text-[#5A5A40]/60">Manage your patient queue and consultations.</p>
          </div>
          <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-[#5A5A40] font-bold hover:underline">
            <LogOut size={20} /> Logout
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Queue Section */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">Waiting</h2>
                <span className="bg-[#5A5A40]/10 text-[#5A5A40] px-3 py-1 rounded-full text-sm font-bold">{waitingTokens.length}</span>
              </div>
              <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                {waitingTokens.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-[#f5f5f0] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-[#5A5A40]">
                        {t.token_number}
                      </div>
                      <span className="font-bold text-[#5A5A40]">{patients[t.patient_id]?.name || 'Loading...'}</span>
                    </div>
                  </div>
                ))}
                {waitingTokens.length === 0 && <p className="text-center text-[#5A5A40]/40 py-4 italic">No patients waiting.</p>}
              </div>
              <button
                onClick={handleCallNext}
                disabled={!!currentConsultation || waitingTokens.length === 0}
                className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
              >
                Call Next Patient
              </button>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
              <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-6">Completed Today</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {completedTokens.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-4 border-b border-[#5A5A40]/5">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {t.token_number}
                    </div>
                    <span className="text-[#5A5A40]/70">{patients[t.patient_id]?.name || 'Loading...'}</span>
                  </div>
                ))}
                {completedTokens.length === 0 && <p className="text-center text-[#5A5A40]/40 py-4 italic">No consultations completed yet.</p>}
              </div>
            </div>
          </div>

          {/* Consultation Section */}
          <div className="lg:col-span-8 space-y-8">
            {currentConsultation ? (
              <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                      In Consultation
                    </div>
                    <h2 className="text-3xl font-serif font-bold text-[#5A5A40]">{patients[currentConsultation.patient_id]?.name || 'Loading...'}</h2>
                    <p className="text-[#5A5A40]/60">Token #{currentConsultation.token_number}</p>
                  </div>
                  <button
                    onClick={handleMarkCompleted}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={20} /> Mark Completed
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardList className="text-[#5A5A40]" size={24} />
                      <h3 className="text-xl font-serif font-bold text-[#5A5A40]">Prescription</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Diagnosis</label>
                        <input
                          type="text"
                          value={prescriptionForm.diagnosis}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                          placeholder="Enter diagnosis..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Medicines</label>
                        <textarea
                          rows={4}
                          value={prescriptionForm.medicines}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicines: e.target.value })}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none resize-none"
                          placeholder="Enter medicines (one per line)..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Notes (Optional)</label>
                        <textarea
                          rows={2}
                          value={prescriptionForm.notes}
                          onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                          className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none resize-none"
                          placeholder="Additional instructions..."
                        />
                      </div>
                      <button
                        onClick={handleSavePrescription}
                        disabled={saveStatus === 'saving' || !prescriptionForm.diagnosis || !prescriptionForm.medicines}
                        className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold transition-colors ${
                          saveStatus === 'success' ? 'bg-green-600 text-white' : 
                          saveStatus === 'error' ? 'bg-red-600 text-white' :
                          'bg-[#5A5A40] text-white hover:bg-[#4A4A30]'
                        } disabled:opacity-50`}
                      >
                        {saveStatus === 'saving' ? 'Saving...' : 
                         saveStatus === 'success' ? <><CheckCircle size={20} /> Saved Successfully</> :
                         saveStatus === 'error' ? 'Error Saving' :
                         <><Save size={20} /> Save Prescription</>}
                      </button>
                      {errorMessage && <p className="text-red-500 text-xs text-center">{errorMessage}</p>}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Plus className="text-[#5A5A40]" size={24} />
                        <h3 className="text-xl font-serif font-bold text-[#5A5A40]">Templates</h3>
                      </div>
                      {templates.length === 0 && (
                        <button
                          onClick={handleSeedTemplates}
                          className="text-xs font-bold text-[#5A5A40] hover:underline"
                        >
                          Seed Defaults
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {templates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleApplyTemplate(template)}
                          className="w-full p-4 text-left bg-[#f5f5f0] rounded-2xl hover:bg-[#5A5A40]/5 transition-colors border border-transparent hover:border-[#5A5A40]/10"
                        >
                          <p className="font-bold text-[#5A5A40] text-sm">{template.title}</p>
                          <p className="text-xs text-[#5A5A40]/60 truncate">{template.diagnosis}</p>
                        </button>
                      ))}
                      {templates.length === 0 && <p className="text-xs text-[#5A5A40]/40 italic">No templates found.</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-[32px] border border-dashed border-[#5A5A40]/30 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 bg-[#5A5A40]/5 rounded-full flex items-center justify-center mb-6 text-[#5A5A40]/30">
                  <User size={40} />
                </div>
                <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-2">No Active Consultation</h2>
                <p className="text-[#5A5A40]/60 max-w-md">Call the next patient from the waiting list to start a consultation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
