import React, { useState } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  addDays,
  calculatePeriodRecap,
  formatFullDateId,
  getMonthRange,
  getWeekRange,
  STATUS_LABELS_ID,
  type AttendanceRecord,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
} from '../utils/piketLogic';
import { CharacterAvatar3D } from './CharacterAvatar3D';

interface RecapReportProps {
  todayStr: string;
  schedules: PiketSchedule[];
  members: OsisMember[];
  swaps: ScheduleSwap[];
  attendanceRecords: AttendanceRecord[];
}

export const RecapReport: React.FC<RecapReportProps> = ({
  todayStr,
  schedules,
  members,
  swaps,
  attendanceRecords,
}) => {
  const [recapType, setRecapType] = useState<'mingguan' | 'bulanan'>(
    'mingguan'
  );
  const [weekRefDate, setWeekRefDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    todayStr.slice(0, 7)
  );
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const periodRange =
    recapType === 'mingguan'
      ? getWeekRange(weekRefDate)
      : getMonthRange(selectedMonth);

  const summary = calculatePeriodRecap(
    periodRange.startDate,
    periodRange.endDate,
    schedules,
    members,
    swaps,
    attendanceRecords,
    scheduleFilter
  );

  const filteredMemberRows = summary.memberRows.filter(
    (row) =>
      row.member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.member.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.member.jabatan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const memberMap = new Map<string, OsisMember>();
  for (const m of members) memberMap.set(m.id, m);

  const scheduleMap = new Map<string, PiketSchedule>();
  for (const s of schedules) scheduleMap.set(s.id, s);

  const filteredHistoryLogs = attendanceRecords
    .filter((rec) => {
      const inRange =
        rec.date >= periodRange.startDate && rec.date <= periodRange.endDate;
      if (!inRange) return false;
      if (scheduleFilter !== 'all' && rec.scheduleId !== scheduleFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleDownloadCsv = () => {
    const headers = [
      'Nama Pengurus',
      'Kelas',
      'Jabatan / Sekbid',
      'Total Jadwal',
      'Hadir',
      'Terlambat',
      'Izin',
      'Sakit',
      'Tidak Piket',
      'Belum Absen',
      'Persentase Kehadiran (%)',
      'Predikat Kedisiplinan',
    ];

    const rows = filteredMemberRows.map((r) => [
      `"${r.member.name}"`,
      `"${r.member.kelas}"`,
      `"${r.member.jabatan}"`,
      r.totalScheduled,
      r.hadir,
      r.terlambat,
      r.izin,
      r.sakit,
      r.tidakPiket,
      r.belumAbsen,
      `${r.attendanceRate}%`,
      `"${r.disciplineLabel}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `rekap-piket-osis-${recapType}-${periodRange.startDate}-sd-${periodRange.endDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Switcher */}
      <section className="card-3d p-5 md:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-[#F3E3D0] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
              <span>Evaluasi Kedisiplinan Pengurus OSIS</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-stone-700">
                Periode {periodRange.startDate} s/d {periodRange.endDate}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-stone-900">
              Rekapitulasi Absensi Mingguan & Bulanan
            </h1>
            <p className="text-sm text-stone-600">
              Laporan kehadiran piket pengurus OSIS dari database untuk evaluasi
              mingguan BPH maupun laporan bulanan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Segmented Mode Control: Rekap Mingguan vs Rekap Bulanan */}
            <div className="flex items-center gap-1 p-1 bg-[#FFF3E0] rounded-xl">
              <button
                type="button"
                onClick={() => setRecapType('mingguan')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  recapType === 'mingguan'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Rekap Mingguan
              </button>
              <button
                type="button"
                onClick={() => setRecapType('bulanan')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  recapType === 'bulanan'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Rekap Bulanan
              </button>
            </div>

            {recapType === 'mingguan' ? (
              <div className="flex items-center gap-1 bg-[#FFF5E6] border-2 border-[#EBD5B8] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setWeekRefDate(addDays(weekRefDate, -7))}
                  aria-label="Minggu Sebelumnya"
                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekRefDate(todayStr)}
                  className="px-2.5 py-1 text-xs font-bold text-stone-700 hover:bg-white rounded-lg whitespace-nowrap"
                >
                  Minggu Ini
                </button>
                <button
                  type="button"
                  onClick={() => setWeekRefDate(addDays(weekRefDate, 7))}
                  aria-label="Minggu Berikutnya"
                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <input
                type="month"
                aria-label="Pilih Bulan Rekap"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="px-3 py-1.5 text-xs font-mono bg-white border-2 border-[#E7D5C0] rounded-xl"
              />
            )}

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* 4-Column KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#F3E3D0]">
          <div className="py-2 sm:py-1 sm:pr-5">
            <p className="text-xs font-semibold text-stone-500">
              Total Sesi Penugasan (
              {recapType === 'mingguan' ? 'Minggu Ini' : 'Bulan Ini'})
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-stone-900">
                {summary.totalDutySlots}
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                slot jadwal
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:px-5">
            <p className="text-xs font-semibold text-stone-500">
              Tingkat Kehadiran Piket
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {summary.overallAttendanceRate}%
              </span>
              <span className="text-xs text-emerald-700 font-mono tabular-nums font-bold">
                {summary.totalHadir + summary.totalTerlambat} hadir tercatat
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:px-5">
            <p className="text-xs font-semibold text-stone-500">
              Total Izin & Sakit
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-amber-700">
                {summary.totalIzin + summary.totalSakit}
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                {summary.totalIzin} izin · {summary.totalSakit} sakit
              </span>
            </div>
          </div>

          <div className="py-2 sm:py-1 sm:pl-5">
            <p className="text-xs font-semibold text-stone-500">
              Total Tidak Piket (Alfa)
            </p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-rose-700">
                {summary.totalTidakPiket}
              </span>
              <span className="text-xs text-stone-500 font-mono tabular-nums">
                {summary.totalBelumAbsen} belum berlangsung
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="card-3d-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Cari Nama Pengurus di Rekap"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter nama pengurus, kelas, atau seksi bidang..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl focus:outline-none focus:border-orange-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="recap-schedule-filter"
            className="text-xs font-bold text-stone-600 whitespace-nowrap"
          >
            Filter Jadwal:
          </label>
          <select
            id="recap-schedule-filter"
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border-2 border-[#E7D5C0] rounded-xl text-stone-800"
          >
            <option value="all">Semua Jadwal Piket</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Member Recap Table */}
      <section className="card-3d overflow-hidden">
        <div className="p-5 bg-[#FFFDF8] border-b-2 border-[#F3E3D0] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Tabel Rekapitulasi Per Anggota (
              {recapType === 'mingguan' ? 'Mingguan' : 'Bulanan'})
            </h2>
            <p className="text-xs text-stone-500">
              Rincian jumlah kehadiran, keterlambatan, izin, sakit, dan alfa
              setiap pengurus OSIS.
            </p>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-stone-500">
            {filteredMemberRows.length} anggota ditampilkan
          </span>
        </div>

        {filteredMemberRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            Belum ada data anggota piket untuk direkap pada periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#F3E3D0] bg-[#FFF8EE] text-xs text-stone-600">
                  <th className="py-3 px-5 font-bold">Nama Pengurus</th>
                  <th className="py-3 px-3 font-bold">Kelas · Jabatan</th>
                  <th className="py-3 px-3 text-right font-bold">Jadwal</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-700">
                    Hadir
                  </th>
                  <th className="py-3 px-3 text-right font-bold text-sky-700">
                    Terlambat
                  </th>
                  <th className="py-3 px-3 text-right font-bold text-amber-700">
                    Izin
                  </th>
                  <th className="py-3 px-3 text-right font-bold text-orange-700">
                    Sakit
                  </th>
                  <th className="py-3 px-3 text-right font-bold text-rose-700">
                    Tidak Piket
                  </th>
                  <th className="py-3 px-4 text-right font-bold">% Disiplin</th>
                  <th className="py-3 px-5 font-bold">Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7ECE0] text-xs">
                {filteredMemberRows.map((row) => (
                  <tr
                    key={row.member.id}
                    className="hover:bg-[#FFFBF4] transition-colors"
                  >
                    <td className="py-3 px-5 font-bold text-stone-900 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <CharacterAvatar3D name={row.member.name} size="sm" />
                        <span>{row.member.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-stone-600 whitespace-nowrap">
                      <span className="font-mono font-semibold tabular-nums">
                        {row.member.kelas}
                      </span>{' '}
                      · {row.member.jabatan}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-stone-800">
                      {row.totalScheduled}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                      {row.hadir}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-700">
                      {row.terlambat}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                      {row.izin}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-orange-700">
                      {row.sakit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-rose-700">
                      {row.tidakPiket}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-stone-900">
                      {row.attendanceRate}%
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          row.disciplineLabel === 'Sangat Disiplin'
                            ? 'text-emerald-700'
                            : row.disciplineLabel === 'Disiplin'
                            ? 'text-sky-700'
                            : row.disciplineLabel === 'Perlu Pembinaan'
                            ? 'text-rose-700'
                            : 'text-stone-600'
                        }`}
                      >
                        {row.disciplineLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Historical Attendance Log for Period */}
      <section className="card-3d overflow-hidden">
        <div className="p-5 bg-[#FFFDF8] border-b-2 border-[#F3E3D0] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Riwayat Pencatatan Absensi (Log Harian)
            </h2>
            <p className="text-xs text-stone-500">
              Daftar catatan kehadiran yang telah diinput pada periode ini.
            </p>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-stone-500">
            {filteredHistoryLogs.length} catatan
          </span>
        </div>

        {filteredHistoryLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            Belum ada catatan absensi pada rentang tanggal ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#F3E3D0] bg-[#FFF8EE] text-xs text-stone-600">
                  <th className="py-3 px-5 font-bold">Tanggal</th>
                  <th className="py-3 px-4 font-bold">Nama Petugas</th>
                  <th className="py-3 px-4 font-bold">Jadwal Piket</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Jam Absen</th>
                  <th className="py-3 px-5 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7ECE0] text-xs">
                {filteredHistoryLogs.map((rec) => {
                  const m = memberMap.get(rec.memberId);
                  const s = scheduleMap.get(rec.scheduleId);
                  return (
                    <tr key={rec.id} className="hover:bg-[#FFFBF4]">
                      <td className="py-3 px-5 font-mono tabular-nums text-stone-700 whitespace-nowrap">
                        {formatFullDateId(rec.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">
                        {m?.name || rec.memberId}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        {s?.title || rec.scheduleId}
                      </td>
                      <td className="py-3 px-4 font-bold whitespace-nowrap">
                        <span
                          className={
                            rec.status === 'hadir'
                              ? 'text-emerald-700'
                              : rec.status === 'terlambat'
                              ? 'text-sky-700'
                              : rec.status === 'izin' || rec.status === 'sakit'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {STATUS_LABELS_ID[rec.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-stone-600">
                        {rec.checkInTime}
                      </td>
                      <td className="py-3 px-5 text-stone-600">
                        {rec.note || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
