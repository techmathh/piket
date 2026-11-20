import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Trophy } from 'lucide-react';
import {
  calculateViolationLeaderboard,
  getMemberOrgLabel,
  isTestingModeEnabled,
  VIOLATION_POINTS_ALFA,
  VIOLATION_POINTS_TERLAMBAT,
  type AttendanceRecord,
  type OsisMember,
  type PiketSchedule,
  type ScheduleSwap,
  type ViolationLeaderboardPeriod,
} from '../utils/piketLogic';

interface ViolationLeaderboardProps {
  todayStr: string;
  currentTimeHHMM: string;
  schedules: PiketSchedule[];
  members: OsisMember[];
  swaps: ScheduleSwap[];
  attendanceRecords: AttendanceRecord[];
  defaultPeriod?: ViolationLeaderboardPeriod;
}

export const ViolationLeaderboard: React.FC<ViolationLeaderboardProps> = ({
  todayStr,
  currentTimeHHMM,
  schedules,
  members,
  swaps,
  attendanceRecords,
  defaultPeriod = 'mingguan',
}) => {
  const [period, setPeriod] =
    useState<ViolationLeaderboardPeriod>(defaultPeriod);
  const [orgFilter, setOrgFilter] = useState<'all' | 'OSIS' | 'MPK'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isTestingMode = isTestingModeEnabled(attendanceRecords);

  const board = useMemo(
    () =>
      calculateViolationLeaderboard(
        period,
        todayStr,
        schedules,
        members,
        swaps,
        attendanceRecords,
        { todayStr, currentTimeHHMM, isTestingMode }
      ),
    [
      period,
      todayStr,
      currentTimeHHMM,
      isTestingMode,
      schedules,
      members,
      swaps,
      attendanceRecords,
    ]
  );

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return board.entries.filter((entry) => {
      const org = getMemberOrgLabel(entry.member);
      if (orgFilter === 'OSIS' && org !== 'OSIS') return false;
      if (orgFilter === 'MPK' && org !== 'MPK') return false;
      if (q) {
        return (
          entry.member.name.toLowerCase().includes(q) ||
          entry.member.kelas.toLowerCase().includes(q) ||
          org.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [board.entries, orgFilter, searchQuery]);

  return (
    <section
      data-testid="violation-leaderboard-section"
      className="card-3d overflow-hidden"
    >
      {/* Sculpted 3D Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden="true"
            className="rank-medal-3d-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          >
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Leaderboard Pelanggaran Piket
            </h2>
            <p className="text-xs text-slate-500">
              Alfa = {VIOLATION_POINTS_ALFA} poin · Terlambat ={' '}
              {VIOLATION_POINTS_TERLAMBAT} poin · {board.periodLabel} ·{' '}
              {board.resetNote}
            </p>
          </div>
        </div>

        {/* Recessed 3D Segmented Period Switch: Mingguan / Bulanan */}
        <div
          role="tablist"
          aria-label="Periode Leaderboard Pelanggaran"
          className="segmented-3d inline-flex items-center p-1 rounded-xl self-start sm:self-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'mingguan'}
            data-testid="leaderboard-period-mingguan"
            onClick={() => setPeriod('mingguan')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              period === 'mingguan'
                ? 'segmented-3d-active'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mingguan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'bulanan'}
            data-testid="leaderboard-period-bulanan"
            onClick={() => setPeriod('bulanan')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              period === 'bulanan'
                ? 'segmented-3d-active'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bulanan
          </button>
        </div>
      </div>

      {/* Filter & Summary Row */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span>
            Total Petugas Tercatat:{' '}
            <strong className="text-slate-900">{board.totalViolators}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            Akumulasi Poin:{' '}
            <strong className="text-rose-700">{board.totalPoints} poin</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented-3d inline-flex items-center p-0.5 rounded-lg">
            {(['all', 'OSIS', 'MPK'] as const).map((org) => (
              <button
                key={org}
                type="button"
                onClick={() => setOrgFilter(org)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  orgFilter === org
                    ? 'segmented-3d-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {org === 'all' ? 'Semua' : org}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau kelas..."
              aria-label="Cari nama di leaderboard pelanggaran"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300/90 rounded-lg text-slate-800 placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Table / Ranked List */}
      {filteredEntries.length === 0 ? (
        <div
          data-testid="leaderboard-empty-state"
          className="px-6 py-12 text-center space-y-1"
        >
          <p className="text-sm font-semibold text-slate-800">
            {board.entries.length === 0
              ? 'Belum ada catatan pelanggaran pada periode ini'
              : 'Tidak ada nama yang cocok dengan pencarian'}
          </p>
          <p className="text-xs text-slate-500">
            {board.entries.length === 0
              ? 'Petugas yang terlambat (1 poin) atau alfa (2 poin) akan muncul otomatis di sini.'
              : 'Coba ubah kata kunci pencarian atau filter organisasi.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-white">
                <th className="py-2.5 pl-4 sm:pl-5 pr-2 w-16">Peringkat</th>
                <th className="py-2.5 px-3">Petugas</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Alfa (×2)
                </th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Terlambat (×1)
                </th>
                <th className="py-2.5 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">
                  Total Poin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEntries.map((entry, rowIdx) => {
                const orgLabel = getMemberOrgLabel(entry.member);
                const isTopThree = entry.rank <= 3;

                return (
                  <motion.tr
                    key={`${period}-${entry.member.id}`}
                    data-testid={`leaderboard-row-${entry.member.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(rowIdx * 0.025, 0.25),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`transition-colors hover:bg-slate-50/90 ${
                      isTopThree ? 'bg-rose-50/20' : 'bg-white'
                    }`}
                  >
                    <td className="py-3 pl-4 sm:pl-5 pr-2 font-mono text-xs font-bold tabular-nums">
                      {entry.rank === 1 ? (
                        <span className="rank-medal-3d-1 inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs">
                          #1
                        </span>
                      ) : entry.rank === 2 ? (
                        <span className="rank-medal-3d-2 inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs">
                          #2
                        </span>
                      ) : entry.rank === 3 ? (
                        <span className="rank-medal-3d-3 inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs">
                          #3
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 text-slate-500">
                          #{entry.rank}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 min-w-[160px]">
                      <p className="font-semibold text-slate-900 leading-snug">
                        {entry.member.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {orgLabel} · {entry.member.kelas}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      <span
                        className={
                          entry.alfaCount > 0
                            ? 'font-semibold text-rose-700'
                            : 'text-slate-400'
                        }
                      >
                        {entry.alfaCount}×
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      <span
                        className={
                          entry.terlambatCount > 0
                            ? 'font-semibold text-amber-700'
                            : 'text-slate-400'
                        }
                      >
                        {entry.terlambatCount}×
                      </span>
                    </td>
                    <td className="py-3 pl-3 pr-4 sm:pr-5 text-right font-mono text-sm font-bold tabular-nums text-rose-700 whitespace-nowrap">
                      {entry.points} poin
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
