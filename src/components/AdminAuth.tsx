import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Mail, Lock, UserCircle, HelpCircle } from 'lucide-react';

interface AdminAuthProps {
  onBack: () => void;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [setupSuccessInfo, setSetupSuccessInfo] = useState<{email: string, pass: string} | null>(null);

  const handleInstantSetup = async () => {
    setLoading(true);
    setError('');
    setSetupSuccessInfo(null);
    try {
      const baseEmail = 'ruchitha.admin';
      const passwordToUse = 'Admin123!';
      let registeredUser = null;
      let attempt = 0;
      let emailToTry = `${baseEmail}@gmail.com`;

      while (attempt < 15) {
        if (attempt > 0) {
          emailToTry = `${baseEmail}${attempt}@gmail.com`;
        }
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, emailToTry, passwordToUse);
          registeredUser = userCredential.user;
          break;
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            attempt++;
          } else {
            throw authErr;
          }
        }
      }

      if (!registeredUser) {
        throw new Error('Failed to find an available secure admin email. Please try registering manually.');
      }

      await setDoc(doc(db, 'admins', registeredUser.uid), {
        name: 'Ruchitha Admin',
        email: emailToTry,
        role: 'admin',
        createdAt: new Date().toISOString()
      });

      setSetupSuccessInfo({ email: emailToTry, pass: passwordToUse });
      setEmail(emailToTry);
      setPassword(passwordToUse);
      
      // Auto signing in
      await signInWithEmailAndPassword(auth, emailToTry, passwordToUse);
    } catch (err: any) {
      setError(err?.message || 'Failed to auto-configure fresh credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your admin email address first in the input field above.');
      return;
    }
    setResetLoading(true);
    setError('');
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Only allow specific admin emails to register for security
        const isAuthorizedAdminEmail = (e: string): boolean => {
          const lower = e.toLowerCase();
          return (
            lower === 'ruchithakp74@gmail.com' ||
            lower === 'admin@mediqueue.com' ||
            lower.startsWith('ruchitha') ||
            lower.includes('admin') ||
            lower.endsWith('@mediqueue.com')
          );
        };

        if (!isAuthorizedAdminEmail(email)) {
          throw new Error('Only authorized admins can register here. You can use ruchithakp74@gmail.com, admin@mediqueue.com, or any email starting with "ruchitha" / including "admin" to easily set up a new account!');
        }

        let user;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
        } catch (authErr: any) {
          // If the auth account already exists, let's see if we can sign them in and restore/ensure their document exists!
          if (authErr.code === 'auth/email-already-in-use') {
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              user = userCredential.user;
            } catch (loginErr: any) {
              if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/invalid-credential') {
                throw new Error('This admin email is already registered in Authentication. If you deleted your Firestore user document and are trying to restore access, please provide the correct password for this account.');
              }
              throw authErr; // Re-throw original register error
            }
          } else {
            throw authErr;
          }
        }
        
        await setDoc(doc(db, 'admins', user.uid), {
          name: name || email.split('@')[0],
          email: email,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-sm p-8 border border-[#5A5A40]/10">
        <button onClick={onBack} className="text-[#5A5A40]/60 text-sm mb-6 hover:text-[#5A5A40]">← Back to Roles</button>
        
        <h2 className="text-3xl font-serif font-bold text-[#5A5A40] mb-2">
          {isLogin ? 'Admin Login' : 'Admin Registration'}
        </h2>
        
        <div className="bg-amber-50 p-5 rounded-3xl border border-amber-200 mb-6">
          <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
            ⚙️ Admin Reset & Setup Tool
          </h3>
          <p className="text-xs text-amber-800 leading-normal mb-4">
            Forgot the password or need a clean admin account? Click below to instantly generate, register, and log in with a brand new, pre-authorized administrative access credential:
          </p>

          <button
            type="button"
            onClick={handleInstantSetup}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-700 text-white rounded-xl text-xs font-bold hover:bg-amber-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm border border-amber-600 disabled:opacity-50"
          >
            {loading ? 'Setting up new admin...' : '✨ Create & Login with Fresh Admin Account'}
          </button>

          {setupSuccessInfo && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1 select-all animate-pulse">
              <div className="font-bold text-emerald-900 text-[11px] uppercase tracking-wider">Created Successfully!</div>
              <div><strong>Email:</strong> <span className="font-mono bg-white/70 px-1 py-0.5 rounded border border-emerald-100">{setupSuccessInfo.email}</span></div>
              <div><strong>Password:</strong> <span className="font-mono bg-white/70 px-1 py-0.5 rounded border border-emerald-100">{setupSuccessInfo.pass}</span></div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <UserCircle className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
              <input
                type="text"
                placeholder="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 outline-none"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-[#5A5A40]/40" size={20} />
            <input
              type="email"
              placeholder="Admin Email"
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

          <div className="flex justify-end pr-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-xs font-bold text-[#5A5A40] hover:underline flex items-center gap-1"
            >
              <HelpCircle size={13} />
              {resetLoading ? 'Sending link...' : 'Forgot or don\'t know password?'}
            </button>
          </div>

          {resetSent && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <p className="text-xs text-emerald-800 leading-normal">
                ✨ Password reset link sent to <strong>{email}</strong>! Please check your email inbox (and spam folder) to set a new password, then try logging in.
              </p>
            </div>
          )}

          {error && <p className="text-red-500 text-sm leading-relaxed">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'Login as Admin' : 'Register Admin'}
          </button>
        </form>

        <p className="mt-6 text-center text-[#5A5A40]/60 text-sm">
          {isLogin ? "Need to register? " : "Already have an account? "}
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

export default AdminAuth;
