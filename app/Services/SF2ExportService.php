<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\Student;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Spreadsheet;

/**
 * Generates School Form 2 (SF2) Daily Attendance Report of Learners.
 *
 * The output is built ON TOP of the official SF2 template
 * (resources/templates/sf2_template.xls) so every merge, column width, row
 * height, border and font is byte-for-byte identical to the reference format
 * (mockup/format/SF2_2026_Grade 6 - RIZAL.xls). Only the data cells are
 * written; the layout itself is never touched.
 *
 * Template geometry (all row numbers refer to the pristine template):
 *   Rows 1-4   headers (school info, school year, month, grade, section)
 *   Row  5-7   table head (No. / NAME / day-of-month / weekday / totals)
 *   Rows 8-14  male learners
 *   Row  15    male "TOTAL Per Day" row
 *   Rows 16-22 female learners
 *   Row  23    female "TOTAL Per Day" row
 *   Row  24    combined "TOTAL Per Day" row
 *   Row  25+   guidelines, reasons/causes, summary table, signature blocks
 *
 * The learner section is resized to the actual male/female head counts by
 * inserting or removing rows before row 25; everything below shifts with it.
 */
class SF2ExportService
{
    /** Absolute path to the pristine SF2 template. */
    private string $templatePath;

    /** First data row of the learner section. */
    private const SECTION_START = 8;

    /** Learner section size in the pristine template (7M + total + 7F + total + combined). */
    private const TEMPLATE_SECTION_ROWS = 17;

    /**
     * Day-of-month columns (anchor cells) in weekday order, Mon-Fri × 5 weeks.
     * Merged day cells (e.g. F:G) are addressed through their anchor column.
     */
    private const DAY_COLUMNS = [
        'F', 'H', 'I', 'J', 'K',            // week 1  M T W TH F
        'L', 'N', 'O', 'P', 'Q',            // week 2  M T W TH F
        'R', 'T', 'U', 'V', 'X',            // week 3  M T W TH F
        'Z', 'AB', 'AC', 'AD', 'AE',        // week 4  M T W TH F
        'AF', 'AG', 'AI', 'AJ', 'AK',       // week 5  M T W TH F
    ];

    /** Per-row cell merges applied to every learner-section row. */
    private const ROW_MERGES = [
        'A:B', 'C:E', 'F:G', 'L:M', 'R:S', 'V:W', 'X:Y', 'Z:AA',
        'AG:AH', 'AK:AL', 'AM:AN', 'AO:AP', 'AQ:AU',
    ];

    private Spreadsheet $spreadsheet;
    private $sheet;
    private Course $course;
    private int $month;
    private int $year;
    private array $config;

    /** Captured cell styles of the three learner-section row archetypes. */
    private array $studentRowStyle = [];
    private array $totalRowStyle = [];
    private array $combinedRowStyle = [];

    /** School-day slots: day-of-month => day-column index. */
    private array $slotByDay = [];

    /** School days (weekday dates) of the reporting month, in order. */
    private array $schoolDays = [];

    /** Row shift applied to everything below the learner section. */
    private int $rowOffset = 0;

    /** Computed section stats, consumed by writeSummary(). */
    private array $sectionStats = ['male' => null, 'female' => null];

    public function __construct(?string $templatePath = null)
    {
        $this->templatePath = $templatePath
            ?: resource_path('templates/sf2_template.xls');
    }

    /**
     * Generate the SF2 workbook for a course and month.
     *
     * @param  string|null $targetPath When given the .xls is written there
     *                                  (e.g. storage for ONLYOFFICE); otherwise
     *                                  a temp file is used and its path returned.
     * @return string Path of the generated .xls file.
     */
    public function generate(Course $course, int $month, int $year, array $config = [], ?string $targetPath = null): string
    {
        $this->course = $course;
        $this->month = $month;
        $this->year = $year;
        $this->config = $config;

        $this->loadTemplate();
        $this->buildCalendar();
        $this->writeHeader();
        $this->writeLearnerSection();
        $this->writeSummary();
        $this->writeSignatureBlock();

        $targetPath ??= tempnam(sys_get_temp_dir(), 'sf2_') . '.xls';
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xls($this->spreadsheet);
        $writer->save($targetPath);

        return $targetPath;
    }

    // ── Template loading ──────────────────────────────────────────────────────

    private function loadTemplate(): void
    {
        $reader = IOFactory::createReaderForFile($this->templatePath);
        $this->spreadsheet = $reader->load($this->templatePath);
        $this->sheet = $this->spreadsheet->getSheet(0);

        // Capture the archetype row styles BEFORE any row surgery so new rows
        // can be stamped with the exact template look.
        $this->studentRowStyle = $this->captureRowStyle(self::SECTION_START);          // row 8: learner row
        $this->totalRowStyle = $this->captureRowStyle(self::SECTION_START + 7);        // row 15: MALE/FEMALE total
        $this->combinedRowStyle = $this->captureRowStyle(self::SECTION_START + 16);    // row 24: combined total
    }

    private function captureRowStyle(int $row): array
    {
        $styles = [];
        $lastCol = Coordinate::columnIndexFromString($this->sheet->getHighestDataColumn());
        for ($col = 1; $col <= $lastCol; $col++) {
            $coord = Coordinate::stringFromColumnIndex($col) . $row;
            $styles[$coord] = $this->sheet->getStyle($coord)->exportArray();
        }
        return $styles;
    }

    /**
     * Map every weekday of the reporting month onto its day-column slot.
     * Weekend dates have no column on the SF2 (the form only has M-F columns)
     * and are skipped entirely.
     *
     * Dates align with the pre-printed weekday letters: a mid-week 1st leaves
     * the leading columns of week 1 blank. A month starting on Sat/Sun begins
     * with the following Monday in week 1 — otherwise a 31-day month would
     * need a sixth week group the form does not have.
     */
    private function buildCalendar(): void
    {
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $this->month, $this->year);
        $firstWeekday = (int) date('N', mktime(0, 0, 0, $this->month, 1, $this->year)); // 1=Mon … 7=Sun

        if ($firstWeekday >= 6) {
            // Month starts on a weekend: school days start the next Monday at slot 0.
            $effectiveFirstDay = 9 - $firstWeekday; // Sat → 3, Sun → 2
            $leadIn = 0;
        } else {
            $effectiveFirstDay = 1;
            $leadIn = $firstWeekday - 1; // blank M/T/… columns before the 1st
        }

        for ($day = 1; $day <= $daysInMonth; $day++) {
            $weekday = (int) date('N', mktime(0, 0, 0, $this->month, $day, $this->year));
            if ($weekday >= 6) {
                continue; // Sat/Sun — no column on the form
            }
            $weekIndex = intdiv($day - $effectiveFirstDay + $leadIn, 7);
            $slot = $weekIndex * 5 + ($weekday - 1);
            $this->slotByDay[$day] = $slot;
            $this->schoolDays[] = $day;
        }
    }

    // ── Header (rows 1-7) ─────────────────────────────────────────────────────

    private function writeHeader(): void
    {
        // School year runs June -> May (PH academic calendar).
        $syStart = $this->month >= 6 ? $this->year : $this->year - 1;
        $this->setIfProvided('M3', "{$syStart} - " . ($syStart + 1));

        [$gradeLevel, $section] = $this->splitGradeAndSection();

        $this->setIfProvided('AA3', strtoupper($this->monthName()));
        $this->setIfProvided('F3', $this->config['school_id'] ?? '');
        $this->setIfProvided('F4', $this->config['school_name'] ?? '');
        $this->setIfProvided('AA4', strtoupper($gradeLevel));
        $this->setIfProvided('AM4', strtoupper($section));

        // Day-of-month numbers on the date row, centred above their weekday letter.
        foreach ($this->slotByDay as $day => $slot) {
            $cell = self::DAY_COLUMNS[$slot] . '6';
            $this->sheet->setCellValue($cell, $day);
            $this->sheet->getStyle($cell)->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                ->setVertical(Alignment::VERTICAL_CENTER);
        }
    }

    /**
     * Split a course section like "6 - RIZAL" into ["Grade 6", "RIZAL"].
     * An explicit grade_level config wins; otherwise the raw section is kept.
     */
    private function splitGradeAndSection(): array
    {
        $gradeLevel = trim((string) ($this->config['grade_level'] ?? ''));
        $section = trim((string) ($this->course->section ?? ''));

        if ($gradeLevel !== '') {
            return [$gradeLevel, $section];
        }
        if (preg_match('/^\s*(\d+)\s*[-–]\s*(.+?)\s*$/', $section, $m)) {
            return ['Grade ' . $m[1], $m[2]];
        }
        return ['', $section];
    }

    // ── Learner section (rows 8 …) ────────────────────────────────────────────

    private function writeLearnerSection(): void
    {
        $students = Student::where('course_id', $this->course->id)
            ->orderBy('name')
            ->get(['id', 'name', 'gender']);

        $males = $students->filter(fn ($s) => strtolower(trim($s->gender ?? 'male')) === 'male')->values();
        $females = $students->filter(fn ($s) => strtolower(trim($s->gender ?? 'female')) === 'female')->values();

        // Learners whose gender is neither male nor female are listed with the males
        // to guarantee nobody is dropped from the report.
        $others = $students->filter(function ($s) {
            $g = strtolower(trim($s->gender ?? ''));
            return $g !== 'male' && $g !== 'female';
        })->values();
        $males = $males->concat($others);

        $neededRows = $males->count() + $females->count() + 3; // + male total + female total + combined
        $sectionEnd = self::SECTION_START + $neededRows - 1;

        $this->resizeLearnerSection($neededRows);
        $this->rebuildSectionRows(self::SECTION_START, $sectionEnd);

        $attendance = $this->loadAttendance();

        // ── Male learners ──
        $row = self::SECTION_START;
        $maleStats = $this->writeLearnerRows($males, $attendance, $row);
        $row += $males->count();

        $maleDaily = $this->writeTotalRow($row, $maleStats, '<=== MALE | TOTAL Per Day ===>', $males->count());
        $row++;

        // ── Female learners ──
        $femaleStats = $this->writeLearnerRows($females, $attendance, $row);
        $row += $females->count();

        $femaleDaily = $this->writeTotalRow($row, $femaleStats, '<=== FEMALE | TOTAL Per Day ===>', $females->count());
        $row++;

        // ── Combined total ──
        $combinedAbsent = $maleStats['absent'] + $femaleStats['absent'];
        $combinedPresent = $maleStats['present'] + $femaleStats['present'];
        $this->stampRowStyle($row, $this->combinedRowStyle);
        $this->sheet->setCellValue('A' . $row, $males->count() + $females->count());
        $this->sheet->setCellValue('C' . $row, 'Combined TOTAL Per Day');
        foreach ($this->slotByDay as $day => $slot) {
            $this->sheet->setCellValue(self::DAY_COLUMNS[$slot] . $row, $maleDaily[$day] + $femaleDaily[$day]);
        }
        $this->sheet->setCellValue('AM' . $row, $combinedAbsent);
        $this->sheet->setCellValue('AO' . $row, $combinedPresent);
        $this->centerDayCells($row);

        // Stash the computed stats for the summary table.
        $this->sectionStats = [
            'male' => $maleStats + ['daily' => $maleDaily, 'count' => $males->count()],
            'female' => $femaleStats + ['daily' => $femaleDaily, 'count' => $females->count()],
        ];
    }

    /**
     * Insert/remove rows so the learner section fits the actual head counts.
     * Everything below the section (guidelines, summary, signatures) shifts
     * along with it — the offset is remembered for the later write passes.
     */
    private function resizeLearnerSection(int $neededRows): void
    {
        $delta = $neededRows - self::TEMPLATE_SECTION_ROWS;
        if ($delta > 0) {
            $this->sheet->insertNewRowBefore(self::SECTION_START + self::TEMPLATE_SECTION_ROWS, $delta);
        } elseif ($delta < 0) {
            $this->sheet->removeRow(self::SECTION_START + $neededRows, -$delta);
        }
        $this->rowOffset = $delta;
    }

    /**
     * Clear the whole learner section (merges, values, styles) and re-stamp
     * every row with fresh merges + the captured archetype styles so inserted
     * and re-purposed rows look exactly like the template rows.
     */
    private function rebuildSectionRows(int $from, int $to): void
    {
        // Unmerge every merge that lives inside the section (they are all
        // single-row merges in the template).
        $toUnmerge = [];
        foreach ($this->sheet->getMergeCells() as $merge) {
            [$fromCell, $toCell] = Coordinate::rangeBoundaries($merge);
            if ($fromCell[1] >= $from && $toCell[1] <= $to) {
                $toUnmerge[] = $merge;
            }
        }
        foreach ($toUnmerge as $merge) {
            $this->sheet->unmergeCells($merge);
        }

        // Wipe values and normalise row heights.
        $lastCol = Coordinate::columnIndexFromString($this->sheet->getHighestDataColumn());
        for ($row = $from; $row <= $to; $row++) {
            for ($col = 1; $col <= $lastCol; $col++) {
                $this->sheet->getCell(Coordinate::stringFromColumnIndex($col) . $row)->setValue(null);
            }
            $this->sheet->getRowDimension($row)->setRowHeight(20);
        }
    }

    /**
     * Write one learner block; returns [absent, present, perStudentAbsences].
     */
    private function writeLearnerRows($students, array $attendanceByStudent, int $startRow): array
    {
        $absentTotal = 0;
        $presentTotal = 0;
        $perStudentAbsences = [];
        $schoolDayCount = count($this->schoolDays);

        foreach ($students as $index => $student) {
            $row = $startRow + $index;
            $this->stampRowStyle($row, $this->studentRowStyle);

            $this->sheet->setCellValue('A' . $row, $index + 1);
            $this->sheet->setCellValue('C' . $row, strtoupper(trim((string) $student->name)));

            $records = $attendanceByStudent[$student->id] ?? [];
            $absences = 0;

            foreach ($this->slotByDay as $day => $slot) {
                $status = $records[$day] ?? null;
                $cell = self::DAY_COLUMNS[$slot] . $row;

                if ($status === 'absent') {
                    $this->sheet->setCellValue($cell, 'x');
                    $absences++;
                } elseif ($status === 'late') {
                    // Tardy: upper half shaded — rendered as a filled upper triangle.
                    $this->sheet->setCellValue($cell, '▴');
                }
                // Present / excused / no record → blank cell.
            }

            $present = max(0, $schoolDayCount - $absences);
            $this->sheet->setCellValue('AM' . $row, $absences);
            $this->sheet->setCellValue('AO' . $row, $present);

            $absentTotal += $absences;
            $presentTotal += $present;
            $perStudentAbsences[] = ['absences' => $absences, 'records' => $records];
        }

        $this->centerDayCellsRange($startRow, $startRow + max(0, $students->count() - 1));

        return [
            'absent' => $absentTotal,
            'present' => $presentTotal,
            'perStudent' => $perStudentAbsences,
        ];
    }

    /**
     * Write a "TOTAL Per Day" row (male or female section footer).
     *
     * @return array<int, int> Day => learners in attendance that day.
     */
    private function writeTotalRow(int $row, array $stats, string $label, int $count): array
    {
        $this->stampRowStyle($row, $this->totalRowStyle);

        $this->sheet->setCellValue('A' . $row, $count);
        $this->sheet->setCellValue('C' . $row, $label);
        $this->sheet->setCellValue('AM' . $row, $stats['absent']);
        $this->sheet->setCellValue('AO' . $row, $stats['present']);

        // Learners in attendance per day = head count minus absentees.
        $daily = [];
        foreach ($this->slotByDay as $day => $slot) {
            $absentThatDay = 0;
            foreach ($stats['perStudent'] as $studentStats) {
                if (($studentStats['records'][$day] ?? null) === 'absent') {
                    $absentThatDay++;
                }
            }
            $daily[$day] = max(0, $count - $absentThatDay);
            $this->sheet->setCellValue(self::DAY_COLUMNS[$slot] . $row, $daily[$day]);
        }

        $this->centerDayCells($row);

        return $daily;
    }

    /** Re-apply a captured archetype style to every cell of a row. */
    private function stampRowStyle(int $row, array $styleMap): void
    {
        foreach ($styleMap as $coord => $styleArray) {
            [$column] = Coordinate::coordinateFromString($coord);
            $this->sheet->getStyle($column . $row)->applyFromArray($styleArray);
        }
        $this->applyRowMerges($row);
    }

    private function applyRowMerges(int $row): void
    {
        foreach (self::ROW_MERGES as $range) {
            [$from, $to] = explode(':', $range);
            $this->sheet->mergeCells($from . $row . ':' . $to . $row);
        }
    }

    // ── Summary table & guidelines (row 25+ in the template) ─────────────────

    private function writeSummary(): void
    {
        $d = $this->rowOffset; // everything below the section moved by this much

        $male = $this->sectionStats['male'];
        $female = $this->sectionStats['female'];
        $totalCount = $male['count'] + $female['count'];
        $schoolDayCount = count($this->schoolDays);

        $this->sheet->setCellValue('AM' . (25 + $d), 'Month : ' . ucfirst(strtolower($this->monthName())));
        $this->sheet->setCellValue('AP' . (25 + $d), 'No. of Days of Classes: ' . $schoolDayCount);

        // Average daily attendance (per gender and combined).
        $ada = fn (array $stats) => $schoolDayCount > 0
            ? round(array_sum($stats['daily']) / $schoolDayCount, 2)
            : 0;
        $maleAda = $ada($male);
        $femaleAda = $ada($female);
        $combinedAda = $schoolDayCount > 0
            ? round((array_sum($male['daily']) + array_sum($female['daily'])) / $schoolDayCount, 2)
            : 0;

        // Percentage of attendance = ADA / registered learners × 100.
        $pct = fn ($average, int $count) => $count > 0 ? round($average / $count * 100, 2) : 0;

        // Learners absent for 5 or more consecutive school days.
        $maleFive = $this->countAbsentFiveConsecutive($male['perStudent']);
        $femaleFive = $this->countAbsentFiveConsecutive($female['perStudent']);

        $this->setSummaryRow(27 + $d, $male['count'], $female['count'], $totalCount);        // Enrolment
        $this->setSummaryRow(29 + $d, 0, 0, 0);                                             // Late enrolment
        $this->setSummaryRow(33 + $d, $male['count'], $female['count'], $totalCount);        // Registered (end of month)
        $this->setSummaryRow(35 + $d, 100, 100, 100);                                       // Percentage of enrolment
        $this->setSummaryRow(37 + $d, $maleAda, $femaleAda, $combinedAda);                  // Average daily attendance
        $this->setSummaryRow(39 + $d, $pct($maleAda, $male['count']), $pct($femaleAda, $female['count']), $pct($combinedAda, $totalCount));
        $this->setSummaryRow(40 + $d, $maleFive, $femaleFive, $maleFive + $femaleFive);      // Absent 5 consecutive days
        $this->setSummaryRow(41 + $d, 0, 0, 0);                                             // Dropped out
        $this->setSummaryRow(43 + $d, 0, 0, 0);                                             // Transferred out
        $this->setSummaryRow(45 + $d, 0, 0, 0);                                             // Transferred in
    }

    /** Fill one M / F / TOTAL triple of the summary table. */
    private function setSummaryRow(int $row, $male, $female, $total): void
    {
        $this->sheet->setCellValue('AR' . $row, $male);
        $this->sheet->setCellValue('AS' . $row, $female);
        $this->sheet->setCellValue('AT' . $row, $total);
    }

    /** Count learners with a run of ≥5 consecutive absent school days. */
    private function countAbsentFiveConsecutive(array $perStudent): int
    {
        $count = 0;
        foreach ($perStudent as $stats) {
            $run = 0;
            foreach ($this->schoolDays as $day) {
                if (($stats['records'][$day] ?? null) === 'absent') {
                    $run++;
                    if ($run >= 5) {
                        $count++;
                        break;
                    }
                } else {
                    $run = 0;
                }
            }
        }
        return $count;
    }

    // ── Signature block ───────────────────────────────────────────────────────

    private function writeSignatureBlock(): void
    {
        $d = $this->rowOffset;

        $adviser = strtoupper(trim((string) ($this->config['adviser_name'] ?? '')));
        if ($adviser !== '') {
            $this->sheet->setCellValue('AN' . (50 + $d), $adviser);
        }

        $head = strtoupper(trim((string) ($this->config['school_head'] ?? '')));
        if ($head !== '') {
            $this->sheet->setCellValue('AN' . (56 + $d), $head);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Attendance for the month keyed as [student_id => [day => status]].
     */
    private function loadAttendance(): array
    {
        $startDate = sprintf('%04d-%02d-01', $this->year, $this->month);
        $endDate = sprintf('%04d-%02d-%02d', $this->year, $this->month, cal_days_in_month(CAL_GREGORIAN, $this->month, $this->year));

        $map = [];
        Attendance::where('course_id', $this->course->id)
            ->whereBetween('date', [$startDate, $endDate])
            ->get(['student_id', 'date', 'status'])
            ->each(function ($record) use (&$map) {
                $map[$record->student_id][(int) substr($record->date, 8, 2)] = $record->status;
            });

        return $map;
    }

    /** Write a config value only when it is non-empty (else keep template value). */
    private function setIfProvided(string $cell, $value): void
    {
        $value = trim((string) $value);
        if ($value !== '') {
            $this->sheet->setCellValue($cell, $value);
        }
    }

    /** Centre the day / total cells of one row (marks read best centred). */
    private function centerDayCells(int $row): void
    {
        foreach (['AM', 'AO'] as $col) {
            $this->sheet->getStyle($col . $row)->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                ->setVertical(Alignment::VERTICAL_CENTER);
        }
        foreach (self::DAY_COLUMNS as $col) {
            $this->sheet->getStyle($col . $row)->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                ->setVertical(Alignment::VERTICAL_CENTER);
        }
    }

    private function centerDayCellsRange(int $fromRow, int $toRow): void
    {
        for ($row = $fromRow; $row <= $toRow; $row++) {
            $this->centerDayCells($row);
        }
    }

    private function monthName(): string
    {
        return date('F', mktime(0, 0, 0, $this->month, 1, $this->year));
    }
}
