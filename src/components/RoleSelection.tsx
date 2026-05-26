import React from 'react';
import { User, Stethoscope, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

interface RoleSelectionProps {
  onSelect: (role: UserRole) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center mb-12">
        <h1 className="text-5xl font-serif font-bold text-[#5A5A40] mb-4">MediQueue</h1>
        <p className="text-xl text-[#5A5A40]/70 font-serif italic">Streamlining patient care, one token at a time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <button
          onClick={() => onSelect('patient')}
          className="group bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-all border border-[#5A5A40]/10 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
            <User size={40} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-2">Patient</h2>
          <p className="text-[#5A5A40]/60 text-sm">Get tokens, track your queue, and view prescriptions.</p>
        </button>

        <button
          onClick={() => onSelect('doctor')}
          className="group bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-all border border-[#5A5A40]/10 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
            <Stethoscope size={40} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-2">Doctor</h2>
          <p className="text-[#5A5A40]/60 text-sm">Manage your queue, call patients, and issue prescriptions.</p>
        </button>

        <button
          onClick={() => onSelect('admin')}
          className="group bg-white p-8 rounded-[32px] shadow-sm hover:shadow-md transition-all border border-[#5A5A40]/10 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#5A5A40] mb-2">Admin</h2>
          <p className="text-[#5A5A40]/60 text-sm">Manage doctors, monitor queues, and system settings.</p>
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;
