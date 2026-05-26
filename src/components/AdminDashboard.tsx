import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getNextSequenceValue } from '../utils/sequences';
import firebaseConfig from '../../firebase-applet-config.json';
import { Doctor, Token, Patient } from '../types';
import { format } from 'date-fns';
import { LogOut, UserPlus, Users, Activity, Edit2, Trash2, X, Search, UserCheck } from 'lucide-react';

import SQLDemo from './SQLDemo';

const AdminDashboard: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'doctors' | 'patients' | 'sql'>('doctors');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string, type: 'doctor' | 'patient' } | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [doctorForm, setDoctorForm] = useState({
    name: '',
    specialization: '',
    email: '',
    password: 'Doc123456!',
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const unsubDoctors = onSnapshot(collection(db, 'doctors'), (snapshot) => {
      setDoctors(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Doctor)));
    });

    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      setPatients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
      setLoading(false);
    });

    const unsubTokens = onSnapshot(collection(db, 'tokens'), (snapshot) => {
      setTokens(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Token)));
    });

    const unsubPrescriptions = onSnapshot(collection(db, 'prescriptions'), (snapshot) => {
      setPrescriptions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubDoctors();
      unsubPatients();
      unsubTokens();
      unsubPrescriptions();
    };
  }, []);

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setActionError(null);
    try {
      if (editingDoctor) {
        await setDoc(doc(db, 'doctors', editingDoctor.id), {
          ...editingDoctor,
          name: doctorForm.name,
          specialization: doctorForm.specialization,
          password: doctorForm.password || (editingDoctor as any).password || 'Doc123456!',
        });
        setEditingDoctor(null);
      } else {
        // Create a secondary app to create the user without signing out the admin
        const secondaryAppName = `secondary-app-${Date.now()}`;
        const secondaryApp = getApps().find(app => app.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, doctorForm.email, doctorForm.password);
        const user = userCredential.user;
        const doctorNo = await getNextSequenceValue('doctors', 501);

        // Create the doctor document using the Auth UID
        await setDoc(doc(db, 'doctors', user.uid), {
          id: user.uid,
          name: doctorForm.name,
          specialization: doctorForm.specialization,
          email: doctorForm.email,
          password: doctorForm.password,
          role: 'doctor',
          doctor_id_display: doctorNo,
          createdAt: new Date().toISOString()
        });
      }
      setShowAddModal(false);
      setDoctorForm({ name: '', specialization: '', email: '', password: 'Doc123456!' });
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoctor = async () => {
    if (!showDeleteModal || showDeleteModal.type !== 'doctor') return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'doctors', showDeleteModal.id));
      setShowDeleteModal(null);
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!showDeleteModal || showDeleteModal.type !== 'patient') return;
    setLoading(true);
    try {
      const patientId = showDeleteModal.id;
      
      // 1. Delete patient document
      await deleteDoc(doc(db, 'patients', patientId));
      
      // 2. Delete associated tokens
      const tokensSnap = await getDocs(query(collection(db, 'tokens'), where('patient_id', '==', patientId)));
      const tokenDeletes = tokensSnap.docs.map(d => deleteDoc(doc(db, 'tokens', d.id)));
      
      // 3. Delete associated prescriptions
      const prescriptionsSnap = await getDocs(query(collection(db, 'prescriptions'), where('patient_id', '==', patientId)));
      const prescriptionDeletes = prescriptionsSnap.docs.map(d => deleteDoc(doc(db, 'prescriptions', d.id)));
      
      await Promise.all([...tokenDeletes, ...prescriptionDeletes]);
      
      setShowDeleteModal(null);
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone.includes(searchTerm)
  );

  const handleCleanupOrphanedData = async () => {
    setLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const patientIds = new Set(patients.map(p => p.id));
      
      // Find orphaned tokens
      const allTokensSnap = await getDocs(collection(db, 'tokens'));
      const orphanedTokens = allTokensSnap.docs.filter(d => !patientIds.has(d.data().patient_id));
      
      // Find orphaned prescriptions
      const allPrescriptionsSnap = await getDocs(collection(db, 'prescriptions'));
      const orphanedPrescriptions = allPrescriptionsSnap.docs.filter(d => !patientIds.has(d.data().patient_id));
      
      const totalToDelete = orphanedTokens.length + orphanedPrescriptions.length;
      
      if (totalToDelete === 0) {
        setActionSuccess("No orphaned data found.");
        return;
      }

      const deletes = [
        ...orphanedTokens.map(d => deleteDoc(doc(db, 'tokens', d.id))),
        ...orphanedPrescriptions.map(d => deleteDoc(doc(db, 'prescriptions', d.id)))
      ];
      
      await Promise.all(deletes);
      setActionSuccess(`Successfully cleaned up ${totalToDelete} orphaned records.`);
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#5A5A40]">Admin Dashboard</h1>
            <p className="text-[#5A5A40]/60">System management and clinic monitoring.</p>
          </div>
          <button onClick={() => auth.signOut()} className="flex items-center gap-2 text-[#5A5A40] font-bold hover:underline">
            <LogOut size={20} /> Logout
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Users size={32} />
            </div>
            <div>
              <p className="text-[#5A5A40]/60 text-sm font-bold uppercase tracking-wider">Doctors</p>
              <h3 className="text-3xl font-serif font-bold text-[#5A5A40]">{doctors.length}</h3>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <UserCheck size={32} />
            </div>
            <div>
              <p className="text-[#5A5A40]/60 text-sm font-bold uppercase tracking-wider">Patients</p>
              <h3 className="text-3xl font-serif font-bold text-[#5A5A40]">{patients.length}</h3>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
              <Activity size={32} />
            </div>
            <div>
              <p className="text-[#5A5A40]/60 text-sm font-bold uppercase tracking-wider">Tokens Today</p>
              <h3 className="text-3xl font-serif font-bold text-[#5A5A40]">
                {tokens.filter(t => t.date === today).length}
              </h3>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-[#5A5A40]/10 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
              <Edit2 size={32} />
            </div>
            <div>
              <p className="text-[#5A5A40]/60 text-sm font-bold uppercase tracking-wider">Active Queues</p>
              <h3 className="text-3xl font-serif font-bold text-[#5A5A40]">
                {new Set(tokens.filter(t => t.date === today && t.status !== 'Completed').map(t => t.doctor_id)).size}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-[#5A5A40]/10 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-[#5A5A40]/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('doctors')}
                className={`text-2xl font-serif font-bold pb-2 border-b-2 transition-all ${activeTab === 'doctors' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-[#5A5A40]/40'}`}
              >
                Doctors
              </button>
              <button 
                onClick={() => setActiveTab('patients')}
                className={`text-2xl font-serif font-bold pb-2 border-b-2 transition-all ${activeTab === 'patients' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-[#5A5A40]/40'}`}
              >
                Patients
              </button>
              <button 
                onClick={() => setActiveTab('sql')}
                className={`text-2xl font-serif font-bold pb-2 border-b-2 transition-all ${activeTab === 'sql' ? 'border-[#5A5A40] text-[#5A5A40]' : 'border-transparent text-[#5A5A40]/40'}`}
              >
                SQL Demo
              </button>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={handleCleanupOrphanedData}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                title="Remove tokens and prescriptions belonging to deleted patients"
              >
                Cleanup Orphaned Data
              </button>
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                />
              </div>
              {activeTab === 'doctors' && (
                <button
                  onClick={() => {
                    setEditingDoctor(null);
                    setDoctorForm({ name: '', specialization: '', email: '', password: 'Doc123456!' });
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors whitespace-nowrap"
                >
                  <UserPlus size={20} /> Add Doctor
                </button>
              )}
            </div>
          </div>

          {actionSuccess && (
            <div className="mx-8 mt-4 p-4 bg-green-50 text-green-700 rounded-2xl text-sm font-bold flex justify-between items-center">
              {actionSuccess}
              <button onClick={() => setActionSuccess(null)}><X size={16} /></button>
            </div>
          )}

          <div className="overflow-x-auto">
            {activeTab === 'sql' ? (
              <SQLDemo 
                doctors={doctors}
                patients={patients}
                tokens={tokens}
                prescriptions={prescriptions}
              />
            ) : activeTab === 'doctors' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f5f5f0]/50 text-[#5A5A40]/50 text-xs uppercase tracking-wider font-bold">
                    <th className="px-8 py-4">Doctor Name</th>
                    <th className="px-8 py-4">Specialization</th>
                    <th className="px-8 py-4">Email</th>
                    <th className="px-8 py-4">Queue Status</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#5A5A40]/5">
                    {filteredDoctors.map(doctor => {
                      const doctorTokens = tokens.filter(t => t.doctor_id === doctor.id && t.date === today);
                      const waiting = doctorTokens.filter(t => t.status === 'Waiting').length;
                      const inConsultation = doctorTokens.some(t => t.status === 'In Consultation');

                      return (
                        <tr key={doctor.id} className="hover:bg-[#f5f5f0]/30 transition-colors">
                          <td className="px-8 py-6 font-bold text-[#5A5A40]">
                            {doctor.name}
                            {(doctor as any).doctor_id_display && (
                              <span className="ml-2 text-[10px] bg-[#5A5A40]/10 px-1.5 py-0.5 rounded">
                                ID: {(doctor as any).doctor_id_display}
                              </span>
                            )}
                          </td>
                        <td className="px-8 py-6 text-[#5A5A40]/70">{doctor.specialization}</td>
                        <td className="px-8 py-6 text-[#5A5A40]/70 font-sans">
                          <div>{doctor.email}</div>
                          <div className="text-[11px] text-[#5A5A40]/55 mt-1 select-all" title="Share this login password with the doctor">
                            PWD: <span className="font-mono bg-amber-50 rounded border border-amber-100 px-1.5 py-0.5 text-amber-800 font-bold">{doctor.password || 'Doc123456!'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${inConsultation ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                            <span className="text-sm font-medium text-[#5A5A40]">
                              {waiting} waiting {inConsultation && '(Active)'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingDoctor(doctor);
                              setDoctorForm({
                                name: doctor.name,
                                specialization: doctor.specialization,
                                email: doctor.email,
                                password: doctor.password || 'Doc123456!'
                              });
                              setShowAddModal(true);
                            }}
                            className="p-2 text-[#5A5A40]/60 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setShowDeleteModal({ id: doctor.id, type: 'doctor' })}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f5f5f0]/50 text-[#5A5A40]/50 text-xs uppercase tracking-wider font-bold">
                    <th className="px-8 py-4">Patient Name</th>
                    <th className="px-8 py-4">Phone</th>
                    <th className="px-8 py-4">Age/Gender</th>
                    <th className="px-8 py-4">Total Visits</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#5A5A40]/5">
                    {filteredPatients.map(patient => {
                      const patientTokens = tokens.filter(t => t.patient_id === patient.id);
                      return (
                        <tr key={patient.id} className="hover:bg-[#f5f5f0]/30 transition-colors">
                          <td className="px-8 py-6 font-bold text-[#5A5A40]">
                            {patient.name}
                            {(patient as any).patient_id_display && (
                              <span className="ml-2 text-[10px] bg-[#5A5A40]/10 px-1.5 py-0.5 rounded">
                                ID: {(patient as any).patient_id_display}
                              </span>
                            )}
                          </td>
                        <td className="px-8 py-6 text-[#5A5A40]/70">{patient.phone}</td>
                        <td className="px-8 py-6 text-[#5A5A40]/70">{patient.age} / {patient.gender}</td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-[#5A5A40]/5 text-[#5A5A40] rounded-full text-sm font-bold">
                            {patientTokens.length} visits
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => setShowDeleteModal({ id: patient.id, type: 'patient' })}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-[#5A5A40]/40 italic">
                        No patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white max-w-md w-full rounded-[32px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">
                {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#5A5A40]/40 hover:text-[#5A5A40]">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveDoctor} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={doctorForm.name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Specialization</label>
                <input
                  type="text"
                  required
                  value={doctorForm.specialization}
                  onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                  className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                />
              </div>
              {!editingDoctor && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5A5A40]/60 mb-2">Password</label>
                    <input
                      type="password"
                      required
                      value={doctorForm.password}
                      onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                      className="w-full px-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                    />
                    <p className="text-[11px] text-[#5A5A40]/60 mt-1.5 leading-normal">
                      Pre-filled with a default of <span className="font-bold underline">Doc123456!</span>. You can change this, and it will be visible to copy/share inside your Admin Dashboard list!
                    </p>
                  </div>
                </>
              )}
              {actionError && <p className="text-red-500 text-sm mt-2">{actionError}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors mt-4 disabled:opacity-50"
              >
                {loading ? 'Processing...' : editingDoctor ? 'Update Doctor' : 'Create Doctor Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white max-w-sm w-full rounded-[32px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-2">Delete {showDeleteModal.type === 'doctor' ? 'Doctor' : 'Patient'}?</h2>
            <p className="text-[#5A5A40]/60 mb-8">
              This action cannot be undone. All associated data (tokens, prescriptions) will also be permanently deleted.
            </p>
            
            {actionError && <p className="text-red-500 text-sm mb-4">{actionError}</p>}
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(null);
                  setActionError(null);
                }}
                className="flex-1 py-3 bg-[#f5f5f0] text-[#5A5A40] rounded-xl font-bold hover:bg-[#e5e5e0] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showDeleteModal.type === 'doctor' ? handleDeleteDoctor : handleDeletePatient}
                disabled={loading}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
