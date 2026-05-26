import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Lock } from 'lucide-react';

interface DoctorAuthProps {
  onBack: () => void;
}

const DoctorAuth: React.FC<DoctorAuthProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError('Invalid credentials. Please contact admin if you are not registered.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-sm p-8 border border-[#5A5A40]/10">
        <button onClick={onBack} className="text-[#5A5A40]/60 text-sm mb-6 hover:text-[#5A5A40]">← Back to Roles</button>
        
        <h2 className="text-3xl font-serif font-bold text-[#5A5A40] mb-2">Doctor Login</h2>
        <p className="text-[#5A5A40]/60 mb-8">Access your consultation dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login as Doctor'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#5A5A40]/5">
          <p className="text-xs text-[#5A5A40]/50 leading-relaxed text-center">
            <span className="font-bold">Clinic Demo TIP:</span> Doctor accounts are created inside the <span className="font-bold">Admin Dashboard</span>. The default password set for new doctors is <span className="font-bold font-mono">Doc123456!</span> unless overridden. Registered doctors' passwords can be copied directly from the Admin panel!
          </p>
        </div>
      </div>
    </div>
  );
};

export default DoctorAuth;
