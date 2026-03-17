import React from 'react';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 hover:shadow-md transition-shadow">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-black mt-1 text-bauhaus-black">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

const SYSTEM_COLORS: Record<string, string> = {
  'Health': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Families': 'bg-blue-50 text-blue-700 border-blue-200',
  'Child Protection': 'bg-purple-50 text-purple-700 border-purple-200',
  'DFV': 'bg-red-50 text-red-700 border-red-200',
  'Women': 'bg-pink-50 text-pink-700 border-pink-200',
  'Youth Justice': 'bg-orange-50 text-orange-700 border-orange-200',
  'Economic Dev': 'bg-teal-50 text-teal-700 border-teal-200',
  'Enterprise': 'bg-amber-50 text-amber-700 border-amber-200',
  'Cultural': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function SystemBadge({ system }: { system: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm ${SYSTEM_COLORS[system] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {system}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  awarded: 'bg-green-100 text-green-800 border-green-300',
  upcoming: 'bg-amber-50 text-amber-700 border-amber-200',
  drafting: 'bg-blue-50 text-blue-700 border-blue-200',
  prospect: 'bg-gray-50 text-gray-500 border-gray-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm uppercase ${STATUS_STYLES[status] ?? STATUS_STYLES.prospect}`}>
      {status}
    </span>
  );
}

const CONTACT_TYPE_COLORS: Record<string, string> = {
  governance: 'bg-purple-50 text-purple-600 border-purple-200',
  funder: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  partner: 'bg-blue-50 text-blue-600 border-blue-200',
  supplier: 'bg-teal-50 text-teal-600 border-teal-200',
  political: 'bg-red-50 text-red-600 border-red-200',
  community: 'bg-amber-50 text-amber-600 border-amber-200',
  advocacy: 'bg-indigo-50 text-indigo-600 border-indigo-200',
};

export function ContactTypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border rounded-sm ${CONTACT_TYPE_COLORS[type] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {type}
    </span>
  );
}
