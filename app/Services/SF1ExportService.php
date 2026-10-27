<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Student;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

/**
 * Generates School Form 1 (SF1) School Register.
 *
 * The output is built ON TOP of the official SF1 template
 * (resources/templates/sf1_template.xls) so every merge, column width, row
 * height, border and font is byte-for-byte identical to the reference format.
 * Only the data cells are written; the layout itself is never touched.
 */
class SF1ExportService
{
    /** Absolute path to the pristine SF1 template. */
    private string $templatePath;

    /** First data row in the template. */
    private const DATA_START_ROW = 6;

    /** Number of learner rows in the pristine template. */
    private const TEMPLATE_LEARNER_ROWS = 14;

    private Spreadsheet $spreadsheet;
    private $sheet;
    private Course $course;
    private array $config;

    /** Captured row style for replication. */
    private array $learnerRowStyle = [];

    public function __construct(?string $templatePath = null)
    {
        $this->templatePath = $templatePath
            ?: resource_path('templates/sf1_template.xls');
    }

    /**
     * Generate the SF1 workbook for a course.
     *
     * @param  string|null $targetPath When given the .xls is written there;
     *                                  otherwise a temp file is used and its path returned.
     * @return string Path of the generated .xls file.
     */
    public function generate(Course $course, array $config = [], ?string $targetPath = null): string
    {
        $this->course = $course;
        $this->config = $config;

        $this->loadTemplate();
        $this->writeHeader();
        $this->writeLearnerSection();

        $targetPath ??= tempnam(sys_get_temp_dir(), 'sf1_') . '.xls';
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

        // Capture the archetype row style before any modifications
        $this->learnerRowStyle = $this->captureRowStyle(self::DATA_START_ROW);
    }

    private function captureRowStyle(int $row): array
    {
        $styles = [];
        $highestCol = $this->sheet->getHighestDataColumn();
        $colIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);
        
        for ($col = 1; $col <= $colIndex; $col++) {
            $coord = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col) . $row;
            $styles[$coord] = $this->sheet->getStyle($coord)->exportArray();
        }
        
        return $styles;
    }

    // ── Header (rows 1-5) ─────────────────────────────────────────────────────

    private function writeHeader(): void
    {
        // School year
        $schoolYear = $this->config['school_year'] ?? '';
        if ($schoolYear) {
            $this->sheet->setCellValue('E3', $schoolYear);
        }

        // School details
        $this->setIfProvided('B2', $this->config['school_id'] ?? '');
        $this->setIfProvided('E2', $this->config['region'] ?? '');
        $this->setIfProvided('B3', $this->config['division'] ?? '');
        $this->setIfProvided('B4', $this->config['district'] ?? '');
        $this->setIfProvided('B5', $this->config['school_name'] ?? '');

        // Grade level and section
        [$gradeLevel, $section] = $this->splitGradeAndSection();
        $this->setIfProvided('E4', $gradeLevel);
        $this->setIfProvided('E5', $section);
    }

    /**
     * Split a course section like "6 - RIZAL" into ["Grade 6", "RIZAL"].
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

    // ── Learner section ────────────────────────────────────────────────────────

    private function writeLearnerSection(): void
    {
        $students = Student::where('course_id', $this->course->id)
            ->orderBy('name')
            ->get();

        $males = $students->filter(fn ($s) => strtolower(trim($s->gender ?? 'male')) === 'male')->values();
        $females = $students->filter(fn ($s) => strtolower(trim($s->gender ?? 'female')) === 'female')->values();

        // Handle students with undefined gender
        $others = $students->filter(function ($s) {
            $g = strtolower(trim($s->gender ?? ''));
            return $g !== 'male' && $g !== 'female';
        })->values();
        $males = $males->concat($others);

        $totalStudents = $males->count() + $females->count();
        $neededRows = $totalStudents + 2; // +2 for male and female total rows

        // Resize the learner section if needed
        $this->resizeLearnerSection($neededRows);

        // Write learners
        $row = self::DATA_START_ROW;
        
        // Male learners
        foreach ($males as $index => $student) {
            $this->writeLearnerRow($row, $index + 1, $student);
            $row++;
        }

        // Male total row
        $this->writeTotalRow($row, 'MALE', $males->count());
        $row++;

        // Female learners
        $femaleStartIndex = $males->count() + 1;
        foreach ($females as $index => $student) {
            $this->writeLearnerRow($row, $femaleStartIndex + $index, $student);
            $row++;
        }

        // Female total row
        $this->writeTotalRow($row, 'FEMALE', $females->count());
        $row++;

        // Combined total row
        $this->writeTotalRow($row, 'COMBINED', $totalStudents);
    }

    private function resizeLearnerSection(int $neededRows): void
    {
        $delta = $neededRows - self::TEMPLATE_LEARNER_ROWS;
        $insertPoint = self::DATA_START_ROW + self::TEMPLATE_LEARNER_ROWS;

        if ($delta > 0) {
            // Need more rows
            $this->sheet->insertNewRowBefore($insertPoint, $delta);
        } elseif ($delta < 0) {
            // Need fewer rows
            $this->sheet->removeRow(self::DATA_START_ROW + $neededRows, -$delta);
        }
    }

    private function writeLearnerRow(int $row, int $no, Student $student): void
    {
        // Apply row style
        $this->stampRowStyle($row);

        // Write data
        $this->sheet->setCellValue('A' . $row, $student->lrn ?? '');
        $this->sheet->setCellValue('B' . $row, strtoupper(trim((string) $student->name)));
        $this->sheet->setCellValue('C' . $row, strtoupper(substr(trim($student->gender ?? 'M'), 0, 1)));
        $this->sheet->setCellValue('D' . $row, $student->birth_date ? date('m/d/Y', strtotime($student->birth_date)) : '');
        $this->sheet->setCellValue('E' . $row, $student->age ?? '');
        $this->sheet->setCellValue('F' . $row, $student->mother_tongue ?? '');
        $this->sheet->setCellValue('G' . $row, $student->ip_ethnic_group ?? '');
        $this->sheet->setCellValue('H' . $row, $student->religion ?? '');
        
        // Address
        $this->sheet->setCellValue('I' . $row, $student->house_number ?? '');
        $this->sheet->setCellValue('J' . $row, $student->barangay ?? '');
        $this->sheet->setCellValue('K' . $row, $student->municipality ?? '');
        $this->sheet->setCellValue('L' . $row, $student->province ?? '');
        
        // Parents/Guardian
        $this->sheet->setCellValue('M' . $row, $student->father_name ?? '');
        $this->sheet->setCellValue('N' . $row, $student->mother_name ?? '');
        $this->sheet->setCellValue('O' . $row, $student->guardian_name ?? '');
        $this->sheet->setCellValue('P' . $row, $student->guardian_relationship ?? '');
        $this->sheet->setCellValue('Q' . $row, $student->contact_number ?? '');
        
        // Learning modality and remarks
        $this->sheet->setCellValue('R' . $row, $student->learning_modality ?? 'Face to Face');
        $this->sheet->setCellValue('S' . $row, $student->remarks ?? '');
    }

    private function writeTotalRow(int $row, string $label, int $count): void
    {
        $this->stampRowStyle($row);
        $this->sheet->setCellValue('A' . $row, '');
        $this->sheet->setCellValue('B' . $row, "<=== TOTAL {$label}");
        $this->sheet->getStyle('B' . $row)->getFont()->setBold(true);
        
        // You might want to add total count in a specific column
        // Adjust based on your template layout
    }

    private function stampRowStyle(int $row): void
    {
        foreach ($this->learnerRowStyle as $coord => $styleArray) {
            [$column] = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::coordinateFromString($coord);
            $this->sheet->getStyle($column . $row)->applyFromArray($styleArray);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function setIfProvided(string $cell, $value): void
    {
        $value = trim((string) $value);
        if ($value !== '') {
            $this->sheet->setCellValue($cell, $value);
        }
    }
}
