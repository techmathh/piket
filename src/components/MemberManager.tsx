import React, { useState } from 'react';
import {
  UserPlus,
  Search,
  Trash2,
  Edit3,
  Phone,
  Calendar,
  X,
} from 'lucide-react';
import {
  DAY_NAMES_ID,
  getMemberOrgLabel,
  normalizeMemberId,
  type OsisMember,
  type PiketSchedule,
} from '../utils/piketLogic';
import { CharacterAvatar3D } from './CharacterAvatar3D';
import { mascotHeroImg } from '../assets/brandAssets';

interface MemberManagerProps {
  members: OsisMember[];
  schedules: PiketSchedule[];
  onAddMember: (
    member: OsisMember,
    assignScheduleId?: string,
    assignDay?: number
  ) => void;
  onUpdateMember: (member: OsisMember) => void;
  onDeleteMember: (memberId: string) => void;
}

const SEKBID_OPTIONS = [
  'OSIS',
  'MPK',
  'OSIS · BPH Inti',
  'OSIS · Seksi Bidang',
  'MPK · Komisi',
];

export const MemberManager: React.FC<MemberManagerProps> = ({
  members,
  schedules,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState<string>('');
  const [kelas, setKelas] = useState<string>('XI MIPA 1');
  const [jabatan, setJabatan] = useState<string>(SEKBID_OPTIONS[0]);
  const [phone, setPhone] = useState<string>('0812-');
  const [assignScheduleId, setAssignScheduleId] = useState<string>(
    schedules[0]?.id || ''
  );
  const [assignDay, setAssignDay] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const filteredMembers = members.filter((m) => {
    const orgLabel = getMemberOrgLabel(m);
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orgLabel.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (divisionFilter === 'osis') return orgLabel === 'OSIS';
    if (divisionFilter === 'mpk') return orgLabel === 'MPK';
    return true;
  });

  const getMemberScheduleSummary = (memberId: string): string[] => {
    const summary: string[] = [];
    for (const sch of schedules) {
      const dailyNorm = sch.dailyMembers.map(normalizeMemberId);
      if (sch.mode === 'harian' && dailyNorm.includes(memberId)) {
        summary.push(`${sch.title} (Harian)`);
      } else if (sch.mode === 'mingguan') {
        const days: string[] = [];
        for (const [dayStr, ids] of Object.entries(sch.weeklyAssignments)) {
          if (ids.map(normalizeMemberId).includes(memberId)) {
            days.push(DAY_NAMES_ID[Number(dayStr)]);
          }
        }
        if (days.length > 0) {
          summary.push(`${sch.title} (${days.join(', ')})`);
        }
      } else if (sch.mode === 'custom') {
        const inCustom =
          dailyNorm.includes(memberId) ||
          Object.values(sch.customDateAssignments).some((arr) =>
            arr.map(normalizeMemberId).includes(memberId)
          );
        if (inCustom) {
          summary.push(`${sch.title} (Custom)`);
        }
      }
    }
    return summary;
  };

  const handleOpenAdd = () => {
    setEditingMemberId(null);
    setName('');
    setKelas('XI MIPA 1');
    setJabatan(SEKBID_OPTIONS[0]);
    setPhone('0812-');
    setAssignScheduleId(schedules[0]?.id || '');
    setAssignDay(1);
    setErrorMsg('');
    setShowAddForm(true);
  };

  const handleOpenEdit = (m: OsisMember) => {
    setEditingMemberId(m.id);
    setName(m.name);
    setKelas(m.kelas);
    setJabatan(m.jabatan);
    setPhone(m.phone);
    setErrorMsg('');
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama lengkap pengurus OSIS wajib diisi.');
      return;
    }
    if (!kelas.trim()) {
      setErrorMsg('Kelas wajib diisi.');
      return;
    }

    if (editingMemberId) {
      onUpdateMember({
        id: editingMemberId,
        name: name.trim(),
        kelas: kelas.trim(),
        jabatan: jabatan.trim(),
        phone: phone.trim() || '-',
        active: true,
      });
    } else {
      const newMember: OsisMember = {
        id: `osis-${Date.now()}`,
        name: name.trim(),
        kelas: kelas.trim(),
        jabatan: jabatan.trim(),
        phone: phone.trim() || '-',
        active: true,
      };
      onAddMember(
        newMember,
        assignScheduleId || undefined,
        assignDay
      );
    }

    setShowAddForm(false);
    setName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card-3d p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl border-2 border-amber-300 shadow-[0_4px_0_0_#F59E0B] overflow-hidden shrink-0 bg-[#FFF3DF]">
            <img
              src={mascotHeroImg}
              alt="Maskot 3D Anggota OSIS"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
              <span>Data Pengurus & Petugas Piket (Database Firestore)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-stone-700">
                {members.length} anggota terdaftar
              </span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">
              Daftar Anggota Piket OSIS
            </h1>
            <p className="text-sm text-stone-600">
              Tambah pengurus OSIS baru, kelola penugasan seksi bidang, dan
              simpan permanen ke database.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Anggota Piket</span>
        </button>
      </section>

      {/* Inline Add / Edit Member Form */}
      {showAddForm && (
        <section className="card-3d p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#F3E3D0] pb-3">
            <h2 className="text-lg font-bold text-stone-900">
              {editingMemberId
                ? 'Perbarui Data Pengurus OSIS'
                : 'Tambah Anggota Piket Baru'}
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              aria-label="Tutup Form Anggota"
              className="p-1 text-stone-400 hover:text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="member-name-input"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Nama Lengkap Pengurus
                </label>
                <input
                  id="member-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Raka Pratama"
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label
                  htmlFor="member-kelas-input"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Kelas
                </label>
                <input
                  id="member-kelas-input"
                  type="text"
                  required
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  placeholder="Contoh: XI MIPA 2"
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label
                  htmlFor="member-jabatan-select"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Jabatan / Seksi Bidang
                </label>
                <select
                  id="member-jabatan-select"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
                >
                  {SEKBID_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="member-phone-input"
                  className="block text-xs font-bold text-stone-700 mb-1"
                >
                  Kontak / WhatsApp
                </label>
                <input
                  id="member-phone-input"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
                />
              </div>
            </div>

            {!editingMemberId && schedules.length > 0 && (
              <div className="p-4 bg-[#FFF8EE] border-2 border-[#F3E3D0] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="member-assign-schedule"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Langsung Masukkan ke Jadwal Piket (Opsional)
                  </label>
                  <select
                    id="member-assign-schedule"
                    value={assignScheduleId}
                    onChange={(e) => setAssignScheduleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                  >
                    <option value="">-- Jangan tugaskan dulu --</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.mode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="member-assign-day"
                    className="block text-xs font-bold text-stone-700 mb-1"
                  >
                    Hari Piket (Untuk Jadwal Mingguan)
                  </label>
                  <select
                    id="member-assign-day"
                    value={assignDay}
                    onChange={(e) => setAssignDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl"
                  >
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <option key={d} value={d}>
                        Hari {DAY_NAMES_ID[d]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-3d-secondary px-4 py-2 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-3d-primary px-4 py-2 text-xs font-bold"
              >
                {editingMemberId
                  ? 'Simpan Perubahan'
                  : 'Simpan Anggota Baru'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search & Filter Toolbar */}
      <div className="card-3d-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Cari Nama atau Kelas Anggota"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pengurus, kelas, atau seksi bidang..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#FFF3E0] rounded-xl self-start">
          <button
            type="button"
            onClick={() => setDivisionFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              divisionFilter === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Semua ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setDivisionFilter('osis')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              divisionFilter === 'osis'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            OSIS ({members.filter((m) => getMemberOrgLabel(m) === 'OSIS').length})
          </button>
          <button
            type="button"
            onClick={() => setDivisionFilter('mpk')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
              divisionFilter === 'mpk'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            MPK ({members.filter((m) => getMemberOrgLabel(m) === 'MPK').length})
          </button>
        </div>
      </div>

      {/* Members Data Table or Clean Empty State */}
      {members.length === 0 ? (
        <section className="card-3d p-10 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl border-2 border-amber-300 overflow-hidden bg-[#FFF3DF]">
            <img
              src={mascotHeroImg}
              alt="Maskot OSIS"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-lg font-bold text-stone-900">
            Belum Ada Data Anggota Piket
          </h2>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            Semua data dummy telah dibersihkan. Silakan klik tombol di bawah
            untuk menambahkan anggota pengurus OSIS pertama Anda ke database.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Anggota Pertama</span>
          </button>
        </section>
      ) : (
        <section className="card-3d overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#F3E3D0] bg-[#FFF8EE] text-xs text-stone-600">
                  <th className="py-3.5 px-5 font-bold">Nama Pengurus</th>
                  <th className="py-3.5 px-4 font-bold">Kelas</th>
                  <th className="py-3.5 px-4 font-bold">
                    Jabatan / Seksi Bidang
                  </th>
                  <th className="py-3.5 px-4 font-bold">
                    Penugasan Jadwal Piket
                  </th>
                  <th className="py-3.5 px-4 font-bold">Kontak</th>
                  <th className="py-3.5 px-5 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F7ECE0] text-xs">
                {filteredMembers.map((m) => {
                  const assignedList = getMemberScheduleSummary(m.id);
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-[#FFFBF4] transition-colors"
                    >
                      <td className="py-3.5 px-5 font-bold text-stone-900 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <CharacterAvatar3D name={m.name} size="sm" />
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold tabular-nums text-sky-700 whitespace-nowrap">
                        {m.kelas}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${
                            getMemberOrgLabel(m) === 'OSIS'
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          }`}
                        >
                          {getMemberOrgLabel(m)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {assignedList.length === 0 ? (
                          <span className="text-stone-400 italic">
                            Belum ditugaskan
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {assignedList.map((txt, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-stone-700 font-medium"
                              >
                                <Calendar className="w-3 h-3 text-orange-500 shrink-0" />
                                <span>{txt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-stone-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          {m.phone}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(m)}
                            aria-label={`Edit ${m.name}`}
                            className="p-1.5 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMember(m.id)}
                            aria-label={`Hapus ${m.name}`}
                            className="p-1.5 text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
