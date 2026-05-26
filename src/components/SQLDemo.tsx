import React, { useState, useEffect } from 'react';
import alasql from 'alasql';
import { Doctor, Token, Patient } from '../types';
import { Play, Database, Table, Info, AlertCircle, RefreshCcw, CheckCircle2 } from 'lucide-react';
import { doc, updateDoc, deleteDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

interface SQLDemoProps {
  doctors: Doctor[];
  patients: Patient[];
  tokens: Token[];
  prescriptions: any[]; // Prescriptions might not have a strict type in current context
}

const SQLDemo: React.FC<SQLDemoProps> = ({ doctors, patients, tokens, prescriptions }) => {
  const [query, setQuery] = useState('SELECT * FROM patients WHERE age > 20');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [activeSchema, setActiveSchema] = useState<'patients' | 'doctors' | 'tokens' | 'prescriptions'>('patients');

  const runQuery = async () => {
    setError(null);
    setIsSyncing(false);
    try {
      // 1. Reset and Re-initialize tables
      // We use a clean sequence to ensure the environment is ready
      alasql('DROP TABLE IF EXISTS doctors');
      alasql('DROP TABLE IF EXISTS patients');
      alasql('DROP TABLE IF EXISTS tokens');
      alasql('DROP TABLE IF EXISTS prescriptions');

      // 2. Explicitly CREATE tables first to ensure they exist even if data is empty
      alasql('CREATE TABLE doctors');
      alasql('CREATE TABLE patients');
      alasql('CREATE TABLE tokens');
      alasql('CREATE TABLE prescriptions');

      // 3. Load latest data into the tables
      // We clone to prevent AlaSQL from mutating our React state objects directly
      if (doctors && doctors.length > 0) alasql('INSERT INTO doctors SELECT * FROM ?', [JSON.parse(JSON.stringify(doctors))]);
      if (patients && patients.length > 0) alasql('INSERT INTO patients SELECT * FROM ?', [JSON.parse(JSON.stringify(patients))]);
      if (tokens && tokens.length > 0) alasql('INSERT INTO tokens SELECT * FROM ?', [JSON.parse(JSON.stringify(tokens))]);
      if (prescriptions && prescriptions.length > 0) alasql('INSERT INTO prescriptions SELECT * FROM ?', [JSON.parse(JSON.stringify(prescriptions))]);

      // 4. Identify if it's a WRITE query
      const trimmedQuery = query.trim().replace(/;$/, ''); // Remove trailing semicolon for better AlaSQL parsing
      const isWrite = /^\s*(insert|update|delete)/i.test(trimmedQuery);

      // 5. Execute query
      const res = alasql(trimmedQuery);
      
      if (Array.isArray(res)) {
        setResults(res);
      } else if (typeof res === 'number') {
        setResults([{ rows_affected: res }]);
      } else if (res === undefined || res === null) {
        setResults([{ result: 'Success' }]);
      } else {
        setResults([{ result: typeof res === 'object' ? JSON.stringify(res) : String(res) }]);
      }

      // 6. If WRITE, sync changes back to Firestore
      if (isWrite) {
        setIsSyncing(true);
        await syncChanges();
        setIsSyncing(false);
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('SQL Error:', err);
      // AlaSQL error messages can be nested or objects
      const msg = err?.message || (typeof err === 'string' ? err : 'Invalid SQL query');
      setError(msg);
      setResults([]);
    }
  };

  const syncChanges = async () => {
    const tables = {
      patients: { current: alasql.tables.patients.data, original: patients, coll: 'patients' },
      doctors: { current: alasql.tables.doctors.data, original: doctors, coll: 'doctors' },
      tokens: { current: alasql.tables.tokens.data, original: tokens, coll: 'tokens' },
      prescriptions: { current: alasql.tables.prescriptions.data, original: prescriptions, coll: 'prescriptions' }
    };

    for (const [tableName, config] of Object.entries(tables)) {
      const current = config.current as any[];
      const original = config.original as any[];
      
      // Find Deleted
      const originalIds = original.map(o => o.id);
      const currentIds = current.map(c => c.id);
      const deletedIds = originalIds.filter(id => !currentIds.includes(id));
      
      for (const id of deletedIds) {
        await deleteDoc(doc(db, config.coll, id));
      }

      // Find Updated or Inserted
      for (const item of current) {
        const orig = original.find(o => o.id === item.id);
        if (!orig) {
          // INSERT
          const newDocRef = doc(collection(db, config.coll), item.id || undefined);
          const data = { ...item };
          delete data.id; // Let Firestore handle ID or keep existing if manually set
          await setDoc(newDocRef, data);
        } else {
          // Check for changes (Simple stringify check for demo purposes)
          if (JSON.stringify(item) !== JSON.stringify(orig)) {
            // UPDATE
            const data = { ...item };
            delete data.id;
            await updateDoc(doc(db, config.coll, item.id), data);
          }
        }
      }
    }
  };

  useEffect(() => {
    runQuery();
  }, [doctors, patients, tokens, prescriptions]);

  const schemaInfo = {
    patients: ['id', 'patient_id_display', 'name', 'phone', 'age', 'gender', 'role'],
    doctors: ['id', 'doctor_id_display', 'name', 'specialization', 'email', 'role'],
    tokens: ['id', 'patient_id', 'doctor_id', 'token_number', 'date', 'status'],
    prescriptions: ['id', 'token_id', 'doctor_id', 'doctor_no', 'patient_id', 'patient_no', 'diagnosis', 'medicines', 'date']
  };

  const exampleQueries = [
    { label: 'All Patients (Quick ID)', sql: 'SELECT patient_id_display, name, age FROM patients' },
    { label: 'Update Patient Age', sql: 'UPDATE patients SET age = 30 WHERE name = "John Doe"' },
    { label: 'Tokens for Today', sql: `SELECT id, token_number, status FROM tokens WHERE date = '${new Date().toISOString().split('T')[0]}'` },
    { label: 'Join Patient & Tokens', sql: 'SELECT patients.name, tokens.token_number FROM patients JOIN tokens ON patients.id = tokens.patient_id' }
  ];

  return (
    <div className="space-y-8 p-8 bg-white rounded-[32px] border border-[#5A5A40]/10 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-2xl">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#5A5A40]">SQL Laboratory</h2>
          <div className="flex items-center gap-3">
            <p className="text-[#5A5A40]/60 text-sm">Run standard SQL queries on your clinic's live data.</p>
            {isSyncing ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse">
                <RefreshCcw size={10} className="animate-spin" /> SYNCING TO FIREBASE...
              </span>
            ) : lastSync && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                <CheckCircle2 size={10} /> SYNCED AT {lastSync}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left: Schema Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-[#5A5A40]/5">
            <h3 className="flex items-center gap-2 font-bold text-[#5A5A40] mb-4">
              <Table size={18} /> Available Tables
            </h3>
            <div className="space-y-3">
              {Object.keys(schemaInfo).map((table) => (
                <div key={table}>
                  <button
                    onClick={() => setActiveSchema(table as any)}
                    className={`w-full text-left text-sm font-bold p-2 px-3 rounded-lg transition-all ${
                      activeSchema === table ? 'bg-[#5A5A40] text-white' : 'hover:bg-[#5A5A40]/5 text-[#5A5A40]'
                    }`}
                  >
                    {table.toUpperCase()}
                  </button>
                  {activeSchema === table && (
                    <div className="mt-2 ml-4 flex flex-wrap gap-1">
                      {schemaInfo[table as keyof typeof schemaInfo].map(f => (
                        <span key={f} className="text-[10px] bg-white border border-[#5A5A40]/10 px-2 py-0.5 rounded text-[#5A5A40]/60">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#f5f5f0] p-6 rounded-2xl border border-[#5A5A40]/5">
            <h3 className="flex items-center gap-2 font-bold text-[#5A5A40] mb-4">
              <Info size={18} /> Example Queries
            </h3>
            <div className="space-y-2">
              {exampleQueries.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(ex.sql);
                    setTimeout(runQuery, 10);
                  }}
                  className="w-full text-left text-xs bg-white p-3 rounded-xl border border-[#5A5A40]/10 hover:border-[#5A5A40]/40 transition-colors"
                >
                  <p className="font-bold text-[#5A5A40] mb-1">{ex.label}</p>
                  <code className="text-[#5A5A40]/60 block truncate">{ex.sql}</code>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Query & Results */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-2">
              <label className="text-sm font-bold text-[#5A5A40]/60 uppercase tracking-wider">SQL Query Editor</label>
              <button 
                onClick={runQuery}
                className="flex items-center gap-2 px-6 py-2 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
              >
                <Play size={16} fill="white" /> Execute Query
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-32 p-6 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm border-none focus:ring-4 focus:ring-[#5A5A40]/10 outline-none rounded-[24px] shadow-inner"
              placeholder="SELECT * FROM patients..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 italic text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="bg-[#f5f5f0] rounded-[24px] overflow-hidden border border-[#5A5A40]/5">
            <div className="p-4 bg-white border-b border-[#5A5A40]/5 flex justify-between items-center">
              <span className="text-xs font-bold text-[#5A5A40]/60 uppercase tracking-wider">
                Results: {results.length} rows returned
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              {results.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr>
                      {Object.keys(results[0]).map((key) => (
                        <th key={key} className="px-6 py-3 text-xs font-bold text-[#5A5A40]/40 uppercase tracking-widest border-b border-[#5A5A40]/5">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#5A5A40]/5">
                    {results.map((row, i) => (
                      <tr key={i} className="hover:bg-white transition-colors">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-6 py-4 text-sm text-[#5A5A40]/80">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : !error ? (
                <div className="p-12 text-center text-[#5A5A40]/40 italic">
                  Run a query to see results.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SQLDemo;
