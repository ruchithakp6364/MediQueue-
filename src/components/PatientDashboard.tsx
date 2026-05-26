import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getNextSequenceValue } from '../utils/sequences';
import { Doctor, Token, Prescription, Patient } from '../types';
import { format } from 'date-fns';
import { User, LogOut, Clock, ClipboardList, Bell, CheckCircle2 } from 'lucide-react';

const PatientDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [myTokens, setMyTokens] = useState<Token[]>([]);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Derived current token
  const myToken = myTokens.find(t => t.id === activeTokenId) || 
                  myTokens.find(t => t.status === 'In Consultation') || 
                  myTokens.find(t => t.status === 'Waiting') || 
                  myTokens[0] || null;

  useEffect(() => {
    // Fetch doctors
    const unsubDoctors = onSnapshot(collection(db, 'doctors'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
      setDoctors(docs);
    });

    // Fetch my tokens for today
    if (auth.currentUser) {
      const q = query(
        collection(db, 'tokens'),
        where('patient_id', '==', auth.currentUser.uid),
        where('date', '==', today),
        orderBy('token_number', 'asc')
      );

      const unsubTokens = onSnapshot(q, (snapshot) => {
        const tokenList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Token));
        setMyTokens(tokenList);
        setLoading(false);
      }, (error) => {
        console.error("Tokens snapshot error:", error);
        setLoading(false);
      });

      return () => {
        unsubDoctors();
        unsubTokens();
      };
    }
  }, [auth.currentUser, today]);

  useEffect(() => {
    if (myToken && auth.currentUser) {
      // Listen to prescription for the current token in real-time
      const pq = query(
        collection(db, 'prescriptions'), 
        where('token_id', '==', myToken.id),
        where('patient_id', '==', auth.currentUser.uid)
      );
      const unsubPrescription = onSnapshot(pq, (psnap) => {
        if (!psnap.empty) {
          setPrescription({ id: psnap.docs[0].id, ...psnap.docs[0].data() } as Prescription);
        } else {
          setPrescription(null);
        }
      }, (error) => {
        console.error("Prescription snapshot error:", error);
      });

      return () => unsubPrescription();
    } else {
      setPrescription(null);
    }
  }, [myToken?.id]);

  useEffect(() => {
    if (myToken && myToken.status !== 'Completed') {
      const q = query(
        collection(db, 'tokens'),
        where('doctor_id', '==', myToken.doctor_id),
        where('date', '==', today),
        where('status', '!=', 'Completed')
      );

      const unsubQueue = onSnapshot(q, (snapshot) => {
        const ahead = snapshot.docs.filter(doc => {
          const data = doc.data() as Token;
          return data.token_number < myToken.token_number;
        }).length;
        setPatientsAhead(ahead);
      });

      return () => unsubQueue();
    }
  }, [myToken, today]);

  const handleGetToken = async (doctorId: string) => {
    if (!auth.currentUser) return;

    // Check if already have an active token for this doctor
    const existingActive = myTokens.find(t => t.doctor_id === doctorId && t.status !== 'Completed');
    if (existingActive) {
      setActiveTokenId(existingActive.id);
      return;
    }

    try {
      // Get next token number
      const q = query(
        collection(db, 'tokens'),
        where('doctor_id', '==', doctorId),
        where('date', '==', today),
        orderBy('token_number', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      let nextToken = 1;
      if (!snapshot.empty) {
        nextToken = (snapshot.docs[0].data() as Token).token_number + 1;
      }

      const tokenNo = await getNextSequenceValue('tokens', 10001);

      await setDoc(doc(db, 'tokens', tokenNo.toString()), {
        patient_id: auth.currentUser.uid,
        doctor_id: doctorId,
        token_number: nextToken,
        date: today,
        status: 'Waiting',
      });
      setActiveTokenId(tokenNo.toString());
    } catch (error) {
      console.error("Error getting token:", error);
    }
  };

  const estimatedTime = patientsAhead * 7;

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#5A5A40]">Patient Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[#5A5A40]/60">Manage your clinic visits</span>
              {(profile as any)?.patient_id_display && (
                <span className="px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded text-xs font-bold font-mono">
                  ID: {(profile as any).patient_id_display}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-[#5A5A40] font-bold hover:underline">
            <LogOut size={20} /> Logout
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Doctors List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">Available Doctors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doctor => (
                <div key={doctor.id} className="bg-white p-6 rounded-3xl border border-[#5A5A40]/10 shadow-sm flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-[#5A5A40]">{doctor.name}</h3>
                    <p className="text-[#5A5A40]/60 text-sm">{doctor.specialization}</p>
                  </div>
                  <button
                    onClick={() => handleGetToken(doctor.id)}
                    disabled={!!myToken && myToken.status !== 'Completed'}
                    className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                  >
                    Get Token
                  </button>
                </div>
              ))}
            </div>

            {prescription && (
              <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <ClipboardList className="text-[#5A5A40]" size={28} />
                  <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">Your Prescription</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A40]/50 font-bold">Diagnosis</label>
                    <p className="text-lg text-[#5A5A40]">{prescription.diagnosis}</p>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[#5A5A40]/50 font-bold">Medicines</label>
                    <p className="text-lg text-[#5A5A40] whitespace-pre-line">{prescription.medicines}</p>
                  </div>
                  {prescription.notes && (
                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#5A5A40]/50 font-bold">Notes</label>
                      <p className="text-[#5A5A40]/70">{prescription.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: My Token Status */}
          <div className="space-y-6">
            <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">Your Status</h2>
            
            {myTokens.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {myTokens.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTokenId(t.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      (activeTokenId === t.id || (!activeTokenId && myToken?.id === t.id))
                        ? 'bg-[#5A5A40] text-white'
                        : 'bg-white text-[#5A5A40] border border-[#5A5A40]/10'
                    }`}
                  >
                    Token #{t.token_number} ({t.status})
                  </button>
                ))}
              </div>
            )}

            {myToken ? (
              <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-[#5A5A40]/10 rounded-full mb-6">
                  <span className="text-4xl font-serif font-bold text-[#5A5A40]">{myToken.token_number}</span>
                </div>
                <h3 className="text-xl font-bold text-[#5A5A40] mb-2">Token Number</h3>
                <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-8 ${
                  myToken.status === 'Waiting' ? 'bg-yellow-100 text-yellow-700' :
                  myToken.status === 'In Consultation' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {myToken.status}
                </div>

                {myToken.status !== 'Completed' && (
                  <div className="space-y-6 border-t border-[#5A5A40]/10 pt-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[#5A5A40]/60">
                        <User size={18} />
                        <span>Patients Ahead</span>
                      </div>
                      <span className="text-xl font-bold text-[#5A5A40]">{patientsAhead}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[#5A5A40]/60">
                        <Clock size={18} />
                        <span>Est. Waiting Time</span>
                      </div>
                      <span className="text-xl font-bold text-[#5A5A40]">{estimatedTime} min</span>
                    </div>

                    {patientsAhead <= 5 && patientsAhead > 0 && (
                      <div className="bg-orange-50 p-4 rounded-2xl flex items-start gap-3 text-left border border-orange-100">
                        <Bell className="text-orange-500 shrink-0" size={20} />
                        <p className="text-sm text-orange-700">
                          <strong>Queue Alert:</strong> Only {patientsAhead} patients ahead of you. Please be ready.
                        </p>
                      </div>
                    )}

                    {myToken.status === 'In Consultation' && (
                      <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-3 text-left border border-blue-100">
                        <CheckCircle2 className="text-blue-500 shrink-0" size={20} />
                        <p className="text-sm text-blue-700">
                          <strong>Now Calling:</strong> It's your turn! Please proceed to the doctor's room.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[32px] border border-dashed border-[#5A5A40]/30 text-center">
                <p className="text-[#5A5A40]/60">You don't have a token for today yet. Select a doctor to get one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
