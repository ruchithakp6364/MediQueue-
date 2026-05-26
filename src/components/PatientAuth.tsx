import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getNextSequenceValue } from '../utils/sequences';
import { User, Phone, Lock, Calendar, UserCircle } from 'lucide-react';

interface PatientAuthProps {
  onBack: () => void;
}

const PatientAuth: React.FC<PatientAuthProps> = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const email = `${formData.phone}@patient.com`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
        const user = userCredential.user;
        const patientNo = await getNextSequenceValue('patients', 1001);

        await setDoc(doc(db, 'patients', user.uid), {
          name: formData.name,
          phone: formData.phone,
          age: parseInt(formData.age),
          gender: formData.gender,
          role: 'patient',
          patient_id_display: patientNo
        });
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-sm p-8 border border-[#5A5A40]/10">
        <button onClick={onBack} className="text-[#5A5A40]/60 text-sm mb-6 hover:text-[#5A5A40]">← Back to Roles</button>
        
        <h2 className="text-3xl font-serif font-bold text-[#5A5A40] mb-2">
          {isLogin ? 'Patient Login' : 'Patient Registration'}
        </h2>
        <p className="text-[#5A5A40]/60 mb-8">
          {isLogin ? 'Welcome back! Please login to your account.' : 'Join us to manage your clinic visits easily.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
                  <input
                    type="number"
                    name="age"
                    placeholder="Age"
                    required
                    value={formData.age}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
                  />
                </div>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none appearance-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="relative">
            <Phone className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-center text-[#5A5A40]/60 text-sm">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#5A5A40] font-bold hover:underline"
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default PatientAuth;
