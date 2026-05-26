export type UserRole = 'patient' | 'doctor' | 'admin';

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  role: 'patient';
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
  role: 'doctor';
  password?: string;
}

export interface Admin {
  id: string;
  email: string;
  role: 'admin';
}

export interface Token {
  id: string;
  patient_id: string;
  doctor_id: string;
  token_number: number;
  date: string;
  status: 'Waiting' | 'In Consultation' | 'Completed';
  patient_name?: string; // For display
}

export interface Prescription {
  id: string;
  token_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis: string;
  medicines: string;
  notes: string;
  date: string;
}

export interface PrescriptionTemplate {
  id: string;
  doctor_id: string;
  title: string;
  diagnosis: string;
  medicines: string;
  notes: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
