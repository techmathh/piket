import {
  DAY_NAMES_ID,
  STATUS_LABELS_ID,
  calculateShiftCheckInProgress,
  formatFullDateId,
  formatWeekCycleLabel,
  getMemberOrgLabel,
  getMemberPersonalSchedules,
  getWeekOfMonth,
  type MemberRecapRow,
  type OsisMember,
  type PeriodRecapSummary,
  type PiketSchedule,
  type ResolvedScheduleForDate,
} from './piketLogic';

/**
 * Escapes text for PDF literal strings (...) in WinAnsiEncoding.
 */
function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Truncates text to fit within a maximum character count.
 */
function clipText(input: string, maxChars: number): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(0, maxChars - 3)) + '...';
}

interface PdfPageBuilder {
  ops: string[];
  cursorY: number;
}

/**
 * Low-level multi-page PDF 1.4 document assembler using standard Type1 Helvetica (/F1) and Helvetica-Bold (/F2).
 */
class SimplePdfDocument {
  private pages: PdfPageBuilder[] = [];
  private readonly pageWidth = 595.28; // A4 portrait width in pt
  private readonly pageHeight = 841.89; // A4 portrait height in pt
  private readonly marginX = 36;

  constructor() {
    this.addPage();
  }

  public get current(): PdfPageBuilder {
    return this.pages[this.pages.length - 1];
  }

  public addPage(): PdfPageBuilder {
    const page: PdfPageBuilder = {
      ops: [],
      cursorY: this.pageHeight - 40,
    };
    this.pages.push(page);
    return page;
  }

  public ensureSpace(requiredHeight: number, onNewPageHeader?: () => void) {
    if (this.current.cursorY - requiredHeight < 48) {
      this.addPage();
      if (onNewPageHeader) {
        onNewPageHeader();
      }
    }
  }

  public drawFilledRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    rgb: [number, number, number]
  ) {
    const bottomY = topY - h;
    const [r, g, b] = rgb.map((v) => (v / 255).toFixed(3));
    this.current.ops.push(
      `q ${r} ${g} ${b} rg ${x.toFixed(2)} ${bottomY.toFixed(2)} ${w.toFixed(
        2
      )} ${h.toFixed(2)} re f Q`
    );
  }

  public drawStrokedRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    rgb: [number, number, number],
    lineWidth = 0.75
  ) {
    const bottomY = topY - h;
    const [r, g, b] = rgb.map((v) => (v / 255).toFixed(3));
    this.current.ops.push(
      `q ${lineWidth.toFixed(2)} w ${r} ${g} ${b} RG ${x.toFixed(
        2
      )} ${bottomY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`
    );
  }

  public drawText(
    text: string,
    x: number,
    y: number,
    options?: {
      font?: 'regular' | 'bold';
      size?: number;
      color?: [number, number, number];
    }
  ) {
    const fontKey = options?.font === 'bold' ? '/F2' : '/F1';
    const size = options?.size ?? 10;
    const [r, g, b] = (options?.color ?? [28, 25, 23]).map((v) =>
      (v / 255).toFixed(3)
    );
    const safe = escapePdfText(text);
    this.current.ops.push(
      `BT ${fontKey} ${size} Tf ${r} ${g} ${b} rg ${x.toFixed(2)} ${y.toFixed(
        2
      )} Td (${safe}) Tj ET`
    );
  }

  public toUint8Array(): Uint8Array {
    // Object 1: Catalog
    // Object 2: Pages
    // Object 3: Font F1 (Helvetica)
    // Object 4: Font F2 (Helvetica-Bold)
    // For each page i:
    //   Page object = 5 + i * 2
    //   Content stream object = 6 + i * 2
    const objects: string[] = [];
    const pageObjNumbers: number[] = [];

    for (let i = 0; i < this.pages.length; i++) {
      const pageObjNum = 5 + i * 2;
      pageObjNumbers.push(pageObjNum);
    }

    // Add Footer page numbers on each page before serializing
    const totalPages = this.pages.length;
    for (let i = 0; i < totalPages; i++) {
      const p = this.pages[i];
      const footerText = `SiPiket OSIS & MPK - Halaman ${i + 1} dari ${totalPages}`;
      p.ops.push(
        `BT /F1 8 Tf 0.45 0.42 0.39 rg ${this.marginX} 24 Td (${escapePdfText(
          footerText
        )}) Tj ET`
      );
    }

    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
    objects.push(
      `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers
        .map((n) => `${n} 0 R`)
        .join(' ')}] /Count ${this.pages.length} >>\nendobj\n`
    );
    objects.push(
      `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
    );
    objects.push(
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
    );

    for (let i = 0; i < this.pages.length; i++) {
      const pageObjNum = 5 + i * 2;
      const contentObjNum = 6 + i * 2;
      const streamBody = this.pages[i].ops.join('\n');
      const streamLength = streamBody.length;

      objects.push(
        `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth.toFixed(
          2
        )} ${this.pageHeight.toFixed(
          2
        )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
      );
      objects.push(
        `${contentObjNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}\nendstream\nendobj\n`
      );
    }

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];

    for (const obj of objects) {
      offsets.push(pdf.length);
      pdf += obj;
    }

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      const padded = String(offsets[i]).padStart(10, '0');
      pdf += `${padded} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${
      objects.length + 1
    } /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    const encoder = new TextEncoder();
    return encoder.encode(pdf);
  }
}

/**
 * Generates PDF bytes for the Live Display / Daily Attendance report.
 */
export function generateDailyAttendancePdfBytes(
  dateStr: string,
  schedules: ResolvedScheduleForDate[],
  printedAtTime = '07:00:00',
  dayNoteInfo?: { note: string; isHoliday: boolean } | null
): Uint8Array {
  const doc = new SimplePdfDocument();
  const contentWidth = 523;
  const startX = 36;

  const allDutyMembers = schedules.flatMap((s) => s.dutyMembers);
  const overallProgress = calculateShiftCheckInProgress(allDutyMembers);
  const weekNum = getWeekOfMonth(dateStr);

  // Header Banner
  const topY = doc.current.cursorY;
  doc.drawFilledRect(startX, topY, contentWidth, 64, [255, 243, 224]);
  doc.drawStrokedRect(startX, topY, contentWidth, 64, [245, 158, 11], 1.2);

  doc.drawText(
    'LAPORAN PRESENSI KEHADIRAN PIKET OSIS & MPK',
    startX + 14,
    topY - 22,
    { font: 'bold', size: 13, color: [194, 65, 12] }
  );
  doc.drawText(
    `Tanggal: ${formatFullDateId(dateStr)}  |  Siklus: Minggu ke-${weekNum}`,
    startX + 14,
    topY - 39,
    { font: 'bold', size: 10, color: [28, 25, 23] }
  );
  doc.drawText(
    `Dicetak pada: ${printedAtTime} WIB  |  Total Shift Aktif: ${schedules.length} Jadwal`,
    startX + 14,
    topY - 54,
    { font: 'regular', size: 8.5, color: [87, 83, 78] }
  );

  doc.current.cursorY = topY - 74;

  // Optional Day-Level Keterangan / Status Libur Banner
  if (dayNoteInfo && dayNoteInfo.note.trim()) {
    const noteY = doc.current.cursorY;
    doc.drawFilledRect(
      startX,
      noteY,
      contentWidth,
      32,
      dayNoteInfo.isHoliday ? [254, 242, 242] : [254, 249, 195]
    );
    doc.drawStrokedRect(
      startX,
      noteY,
      contentWidth,
      32,
      dayNoteInfo.isHoliday ? [248, 113, 113] : [250, 204, 21],
      1
    );
    doc.drawText(
      `${
        dayNoteInfo.isHoliday ? 'STATUS HARI LIBUR' : 'KETERANGAN DAFTAR HADIR'
      }: ${clipText(dayNoteInfo.note, 78)}`,
      startX + 12,
      noteY - 20,
      {
        font: 'bold',
        size: 9.5,
        color: dayNoteInfo.isHoliday ? [185, 28, 28] : [161, 98, 7],
      }
    );
    doc.current.cursorY = noteY - 42;
  }

  // Overall Progress Box + Visual Progress Bar
  const progY = doc.current.cursorY;
  doc.drawFilledRect(startX, progY, contentWidth, 52, [240, 253, 244]);
  doc.drawStrokedRect(startX, progY, contentWidth, 52, [52, 211, 153], 1);

  doc.drawText(
    `Progress Check-In Hari Ini: ${overallProgress.checkedInCount} / ${overallProgress.totalMembers} Petugas Hadir (${overallProgress.checkedInPercentage}%)`,
    startX + 12,
    progY - 18,
    { font: 'bold', size: 10, color: [6, 95, 70] }
  );
  doc.drawText(
    `Rincian: Hadir ${overallProgress.hadirCount}  |  Terlambat ${overallProgress.terlambatCount}  |  Izin/Sakit ${overallProgress.excusedCount}  |  Tidak Piket ${overallProgress.absentCount}  |  Belum Absen ${overallProgress.pendingCount}`,
    startX + 12,
    progY - 31,
    { font: 'regular', size: 8.5, color: [68, 64, 60] }
  );

  // Draw Progress Bar Track & Fill
  const barX = startX + 12;
  const barTopY = progY - 37;
  const barWidth = contentWidth - 24;
  const barHeight = 8;
  doc.drawFilledRect(barX, barTopY, barWidth, barHeight, [226, 232, 240]);
  const fillWidth = Math.max(
    0,
    Math.min(barWidth, (barWidth * overallProgress.checkedInPercentage) / 100)
  );
  if (fillWidth > 0) {
    doc.drawFilledRect(barX, barTopY, fillWidth, barHeight, [16, 185, 129]);
  }

  doc.current.cursorY = progY - 66;

  if (schedules.length === 0) {
    doc.drawText(
      'Tidak ada jadwal piket aktif pada tanggal ini.',
      startX,
      doc.current.cursorY - 14,
      { font: 'bold', size: 10, color: [120, 113, 108] }
    );
    return doc.toUint8Array();
  }

  // Render Each Shift Table
  for (const resolved of schedules) {
    const { schedule, dutyMembers } = resolved;
    const shiftProg = calculateShiftCheckInProgress(dutyMembers);

    doc.ensureSpace(95);

    // Shift Header Card
    const shTop = doc.current.cursorY;
    doc.drawFilledRect(startX, shTop, contentWidth, 42, [255, 251, 235]);
    doc.drawStrokedRect(startX, shTop, contentWidth, 42, [217, 119, 6], 0.9);

    doc.drawText(
      `${clipText(schedule.title, 48)} (${schedule.startTime} - ${
        schedule.endTime
      } WIB)`,
      startX + 10,
      shTop - 16,
      { font: 'bold', size: 10.5, color: [28, 25, 23] }
    );
    doc.drawText(
      `Check-In Shift: ${shiftProg.checkedInCount}/${shiftProg.totalMembers} (${shiftProg.checkedInPercentage}%)`,
      startX + contentWidth - 165,
      shTop - 16,
      { font: 'bold', size: 9.5, color: [5, 150, 105] }
    );
    doc.drawText(
      `Lokasi: ${clipText(schedule.location, 45)}  |  Siklus: ${formatWeekCycleLabel(
        schedule.activeWeeks
      )}`,
      startX + 10,
      shTop - 31,
      { font: 'regular', size: 8.5, color: [87, 83, 78] }
    );

    // Mini shift progress bar inside shift header
    const miniBarX = startX + contentWidth - 165;
    const miniBarTop = shTop - 24;
    const miniBarW = 153;
    doc.drawFilledRect(miniBarX, miniBarTop, miniBarW, 6, [229, 231, 235]);
    const miniFillW = (miniBarW * shiftProg.checkedInPercentage) / 100;
    if (miniFillW > 0) {
      doc.drawFilledRect(miniBarX, miniBarTop, miniFillW, 6, [16, 185, 129]);
    }

    doc.current.cursorY = shTop - 46;

    // Table Column Header
    const drawTableHeader = () => {
      const thTop = doc.current.cursorY;
      doc.drawFilledRect(startX, thTop, contentWidth, 20, [41, 37, 36]);
      doc.drawText('No', startX + 8, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Nama Lengkap Petugas', startX + 32, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Label', startX + 215, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Kelas', startX + 258, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Status Kehadiran', startX + 305, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Jam', startX + 402, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.drawText('Keterangan', startX + 442, thTop - 13, {
        font: 'bold',
        size: 8.5,
        color: [255, 255, 255],
      });
      doc.current.cursorY = thTop - 20;
    };

    drawTableHeader();

    for (let idx = 0; idx < dutyMembers.length; idx++) {
      doc.ensureSpace(20, drawTableHeader);
      const dm = dutyMembers[idx];
      const rowTop = doc.current.cursorY;
      const isEven = idx % 2 === 0;
      doc.drawFilledRect(
        startX,
        rowTop,
        contentWidth,
        18,
        isEven ? [255, 255, 255] : [254, 249, 239]
      );
      doc.drawStrokedRect(
        startX,
        rowTop,
        contentWidth,
        18,
        [231, 229, 228],
        0.4
      );

      const orgLabel = getMemberOrgLabel(dm.member);
      const statusText = STATUS_LABELS_ID[dm.effectiveStatus];
      const checkInTime =
        dm.attendance && dm.attendance.checkInTime !== '-'
          ? dm.attendance.checkInTime
          : '-';
      const noteParts: string[] = [];
      if (dm.isSwapped && dm.swappedFromMember) {
        noteParts.push(`Ganti ${dm.swappedFromMember.name}`);
      }
      if (dm.attendance?.note) {
        noteParts.push(dm.attendance.note);
      }
      const noteText = noteParts.length > 0 ? noteParts.join('; ') : '-';

      const statusColor: [number, number, number] =
        dm.effectiveStatus === 'hadir'
          ? [5, 150, 105]
          : dm.effectiveStatus === 'terlambat'
          ? [2, 132, 199]
          : dm.effectiveStatus === 'izin' || dm.effectiveStatus === 'sakit'
          ? [217, 119, 6]
          : dm.effectiveStatus === 'tidak_piket'
          ? [225, 29, 72]
          : [120, 113, 108];

      doc.drawText(String(idx + 1), startX + 8, rowTop - 12, {
        font: 'regular',
        size: 8.5,
      });
      doc.drawText(clipText(dm.member.name, 32), startX + 32, rowTop - 12, {
        font: 'bold',
        size: 8.5,
      });
      doc.drawText(orgLabel, startX + 215, rowTop - 12, {
        font: 'bold',
        size: 8,
        color: orgLabel === 'OSIS' ? [194, 65, 12] : [67, 56, 202],
      });
      doc.drawText(dm.member.kelas, startX + 258, rowTop - 12, {
        font: 'regular',
        size: 8.5,
      });
      doc.drawText(statusText, startX + 305, rowTop - 12, {
        font: 'bold',
        size: 8.5,
        color: statusColor,
      });
      doc.drawText(checkInTime, startX + 402, rowTop - 12, {
        font: 'regular',
        size: 8.5,
      });
      doc.drawText(clipText(noteText, 16), startX + 442, rowTop - 12, {
        font: 'regular',
        size: 8,
        color: [87, 83, 78],
      });

      doc.current.cursorY = rowTop - 18;
    }

    doc.current.cursorY -= 14;
  }

  return doc.toUint8Array();
}

/**
 * Generates PDF bytes for Weekly / Monthly Recap Reports.
 */
export function generatePeriodRecapPdfBytes(
  recapType: 'mingguan' | 'bulanan',
  summary: PeriodRecapSummary,
  rows: MemberRecapRow[]
): Uint8Array {
  const doc = new SimplePdfDocument();
  const contentWidth = 523;
  const startX = 36;

  const topY = doc.current.cursorY;
  doc.drawFilledRect(startX, topY, contentWidth, 60, [255, 243, 224]);
  doc.drawStrokedRect(startX, topY, contentWidth, 60, [245, 158, 11], 1.2);

  doc.drawText(
    `REKAPITULASI ABSENSI PIKET OSIS & MPK (${recapType.toUpperCase()})`,
    startX + 14,
    topY - 22,
    { font: 'bold', size: 13, color: [194, 65, 12] }
  );
  doc.drawText(
    `Periode: ${summary.startDate} s/d ${summary.endDate}  |  Tingkat Kehadiran: ${summary.overallAttendanceRate}%`,
    startX + 14,
    topY - 38,
    { font: 'bold', size: 9.5, color: [28, 25, 23] }
  );
  doc.drawText(
    `Total Slot: ${summary.totalDutySlots}  |  Hadir: ${
      summary.totalHadir + summary.totalTerlambat
    }  |  Izin/Sakit: ${
      summary.totalIzin + summary.totalSakit
    }  |  Alfa: ${summary.totalTidakPiket}`,
    startX + 14,
    topY - 52,
    { font: 'regular', size: 8.5, color: [87, 83, 78] }
  );

  doc.current.cursorY = topY - 72;

  const drawRecapTableHeader = () => {
    const thTop = doc.current.cursorY;
    doc.drawFilledRect(startX, thTop, contentWidth, 20, [41, 37, 36]);
    doc.drawText('No', startX + 6, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Nama Pengurus', startX + 26, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Label', startX + 195, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Kelas', startX + 230, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Jdwl', startX + 268, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Hadir', startX + 298, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Telat', startX + 330, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Izin/Skt', startX + 360, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Alfa', startX + 402, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('%', startX + 430, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.drawText('Predikat', startX + 458, thTop - 13, {
      font: 'bold',
      size: 8,
      color: [255, 255, 255],
    });
    doc.current.cursorY = thTop - 20;
  };

  drawRecapTableHeader();

  for (let i = 0; i < rows.length; i++) {
    doc.ensureSpace(18, drawRecapTableHeader);
    const r = rows[i];
    const rowTop = doc.current.cursorY;
    const isEven = i % 2 === 0;
    doc.drawFilledRect(
      startX,
      rowTop,
      contentWidth,
      17,
      isEven ? [255, 255, 255] : [254, 249, 239]
    );
    doc.drawStrokedRect(
      startX,
      rowTop,
      contentWidth,
      17,
      [231, 229, 228],
      0.4
    );

    const orgLabel = getMemberOrgLabel(r.member);
    doc.drawText(String(i + 1), startX + 6, rowTop - 12, { size: 8 });
    doc.drawText(clipText(r.member.name, 30), startX + 26, rowTop - 12, {
      font: 'bold',
      size: 8,
    });
    doc.drawText(orgLabel, startX + 195, rowTop - 12, {
      font: 'bold',
      size: 7.5,
      color: orgLabel === 'OSIS' ? [194, 65, 12] : [67, 56, 202],
    });
    doc.drawText(r.member.kelas, startX + 230, rowTop - 12, { size: 8 });
    doc.drawText(String(r.totalScheduled), startX + 272, rowTop - 12, {
      size: 8,
    });
    doc.drawText(String(r.hadir), startX + 304, rowTop - 12, {
      font: 'bold',
      size: 8,
      color: [5, 150, 105],
    });
    doc.drawText(String(r.terlambat), startX + 335, rowTop - 12, {
      size: 8,
      color: [2, 132, 199],
    });
    doc.drawText(String(r.izin + r.sakit), startX + 370, rowTop - 12, {
      size: 8,
      color: [217, 119, 6],
    });
    doc.drawText(String(r.tidakPiket), startX + 406, rowTop - 12, {
      font: 'bold',
      size: 8,
      color: [225, 29, 72],
    });
    doc.drawText(`${r.attendanceRate}%`, startX + 428, rowTop - 12, {
      font: 'bold',
      size: 8,
    });
    doc.drawText(clipText(r.disciplineLabel, 13), startX + 458, rowTop - 12, {
      size: 7.5,
    });

    doc.current.cursorY = rowTop - 17;
  }

  return doc.toUint8Array();
}

/**
 * Generates PDF bytes for an individual officer's 4-week personal duty schedule card.
 */
export function generateMemberPersonalSchedulePdfBytes(
  member: OsisMember,
  allSchedules: PiketSchedule[]
): Uint8Array {
  const doc = new SimplePdfDocument();
  const contentWidth = 523;
  const startX = 36;
  const orgLabel = getMemberOrgLabel(member);
  const personalShifts = getMemberPersonalSchedules(member.id, allSchedules);

  // Header Banner
  const topY = doc.current.cursorY;
  doc.drawFilledRect(startX, topY, contentWidth, 68, [255, 243, 224]);
  doc.drawStrokedRect(startX, topY, contentWidth, 68, [245, 158, 11], 1.2);

  doc.drawText(
    'KARTU JADWAL PIKET PERSONAL PENGURUS OSIS & MPK',
    startX + 14,
    topY - 22,
    { font: 'bold', size: 12.5, color: [194, 65, 12] }
  );
  doc.drawText(
    `Nama Lengkap: ${member.name}`,
    startX + 14,
    topY - 40,
    { font: 'bold', size: 10.5, color: [28, 25, 23] }
  );
  doc.drawText(
    `Organisasi: ${orgLabel}  |  Kelas: ${member.kelas}  |  Jabatan: ${member.jabatan}  |  Total Siklus Aktif: ${personalShifts.length} Jadwal`,
    startX + 14,
    topY - 56,
    { font: 'regular', size: 8.5, color: [87, 83, 78] }
  );

  doc.current.cursorY = topY - 82;

  if (personalShifts.length === 0) {
    doc.drawText(
      'Belum ada jadwal piket terdaftar untuk pengurus ini.',
      startX,
      doc.current.cursorY - 14,
      { font: 'bold', size: 10, color: [120, 113, 108] }
    );
    return doc.toUint8Array();
  }

  for (const item of personalShifts) {
    doc.ensureSpace(64);
    const cardTop = doc.current.cursorY;
    doc.drawFilledRect(startX, cardTop, contentWidth, 52, [255, 253, 249]);
    doc.drawStrokedRect(startX, cardTop, contentWidth, 52, [217, 119, 6], 0.8);

    doc.drawText(
      `Minggu ${item.weekNum}  -  ${item.title} (${item.timeRange} WIB)`,
      startX + 12,
      cardTop - 18,
      { font: 'bold', size: 10, color: [28, 25, 23] }
    );
    doc.drawText(
      `Lokasi Tugas: ${item.location}`,
      startX + 12,
      cardTop - 32,
      { font: 'regular', size: 8.5, color: [87, 83, 78] }
    );
    const dayLabels = item.days.map((d) => DAY_NAMES_ID[d]).join(', ');
    doc.drawText(
      `Hari Bertugas: ${dayLabels}`,
      startX + 12,
      cardTop - 45,
      { font: 'bold', size: 8.5, color: [5, 150, 105] }
    );

    doc.current.cursorY = cardTop - 62;
  }

  return doc.toUint8Array();
}

/**
 * Triggers a direct browser download for a generated PDF byte array without using window.open.
 */
export function triggerPdfDownload(pdfBytes: Uint8Array, filename: string) {
  const safeBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([safeBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
