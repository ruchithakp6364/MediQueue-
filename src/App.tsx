import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import RoleSelection from './components/RoleSelection';
import PatientAuth from './components/PatientAuth';
import DoctorAuth from './components/DoctorAuth';
import AdminAuth from './components/AdminAuth';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import AdminDashboard from './components/AdminDashboard';
import { UserRole } from './types';

const AppContent: React.FC = () => {
  const { user, profile, role, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5A5A40]"></div>
      </div>
    );
  }

  // If logged in, show dashboard based on profile role
  if (user && profile) {
    switch (profile.role) {
      case 'patient':
        return <PatientDashboard />;
      case 'doctor':
        return <DoctorDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <RoleSelection onSelect={setSelectedRole} />;
    }
  }

  // If not logged in, show role selection or auth page
  if (!selectedRole) {
    return <RoleSelection onSelect={setSelectedRole} />;
  }

  switch (selectedRole) {
    case 'patient':
      return <PatientAuth onBack={() => setSelectedRole(null)} />;
    case 'doctor':
      return <DoctorAuth onBack={() => setSelectedRole(null)} />;
    case 'admin':
      return <AdminAuth onBack={() => setSelectedRole(null)} />;
    default:
      return <RoleSelection onSelect={setSelectedRole} />;
  }
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
