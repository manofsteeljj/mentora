<?php

namespace App\Http\Controllers;

use App\Models\LessonPlan;
use App\Models\ClassRecordDocument;
use App\Models\AttendanceDocument;
use App\Models\UserDocument;
use App\Models\Course;
use App\Models\User;
use App\Models\GradebookAssessment;
use App\Models\GradebookGrade;
use App\Models\Student;
use App\Services\LessonPlanService;
use App\Services\SF2ExportService;
use App\Services\SF1ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Handles ONLYOFFICE document editing integration.
 *
 * Endpoints:
 *   GET  /api/documents/{type}/{id}/editor    — return editor config JSON (JWT-signed)
 *   GET  /api/documents/{type}/{id}/content   — serve the raw DOCX/XLSX/XLS file
 *   POST /api/documents/onlyoffice/callback   — receive save callbacks from ONLYOFFICE
 *   POST /api/documents/attendance-sf2/generate — build an SF2 workbook for ONLYOFFICE
 */
class DocumentController extends Controller
{
    private const PERSONAL_TYPES = [
        'docx' => ['ooType' => 'word', 'mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xlsx' => ['ooType' => 'cell', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'xls' => ['ooType' => 'cell', 'mime' => 'application/vnd.ms-excel'],
        'pptx' => ['ooType' => 'slide', 'mime' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ];
    // Supported document types and their ONLYOFFICE documentType mappings
    private const TYPE_MAP = [
        'lesson-plan' => [
            'model' => LessonPlan::class, 'ext' => 'docx', 'ooType' => 'word',
            'path' => 'docx_path', 'version' => 'docx_version', 'dir' => 'lesson-plans',
            'mime' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        'class-record' => [
            'model' => ClassRecordDocument::class, 'ext' => 'xlsx', 'ooType' => 'cell',
            'path' => 'xlsx_path', 'version' => 'xlsx_version', 'dir' => 'class-records',
            'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        'attendance-sf2' => [
            'model' => AttendanceDocument::class, 'ext' => 'xls', 'ooType' => 'cell',
            'path' => 'xls_path', 'version' => 'xls_version', 'dir' => 'attendance-sf2',
            'mime' => 'application/vnd.ms-excel',
        ],
    ];

    public function personalIndex(Request $request): JsonResponse
    {
        return response()->json(
            UserDocument::where('user_id', $request->user()->id)
                ->latest('updated_at')
                ->get(['id', 'title', 'kind', 'extension', 'mime_type', 'version', 'created_at', 'updated_at'])
        );
    }

    public function personalUpload(Request $request): JsonResponse
    {
        $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'kind' => ['nullable', 'string', 'in:uploaded,sf1,sf2,class-record'],
            'file' => ['required', 'file', 'mimes:docx,xlsx,xls,pptx', 'max:51200'],
        ]);

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        if (!isset(self::PERSONAL_TYPES[$extension])) {
            return response()->json(['message' => 'This file type cannot be edited in ONLYOFFICE.'], 422);
        }

        $document = UserDocument::create([
            'user_id' => $request->user()->id,
            'title' => trim((string) ($request->input('title') ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME))),
            'kind' => $request->input('kind', 'uploaded'),
            'extension' => $extension,
            'storage_path' => 'documents/personal/pending',
            'mime_type' => self::PERSONAL_TYPES[$extension]['mime'],
        ]);

        $path = 'documents/personal/' . $document->id . '.' . $extension;
        $stored = $file->storeAs('documents/personal', $document->id . '.' . $extension, 'local');
        if ($stored === false) {
            $document->delete();
            return response()->json(['message' => 'Unable to save the uploaded document.'], 500);
        }

        $document->update(['storage_path' => $path]);

        return response()->json($this->personalDocumentPayload($document), 201);
    }

    public function personalTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'in:sf1,sf2,class-record'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $titles = [
            'sf1' => 'SF1 School Register',
            'sf2' => 'SF2 Daily Attendance',
            'class-record' => 'Class Record',
        ];
        $title = trim((string) ($data['title'] ?? '')) ?: $titles[$data['kind']];
        $extension = $data['kind'] === 'class-record' ? 'xlsx' : 'xls';
        $mimeType = self::PERSONAL_TYPES[$extension]['mime'];
        $document = UserDocument::create([
            'user_id' => $request->user()->id,
            'title' => $title,
            'kind' => $data['kind'],
            'extension' => $extension,
            'storage_path' => 'documents/personal/pending',
            'mime_type' => $mimeType,
        ]);

        $path = 'documents/personal/' . $document->id . '.' . $extension;
        try {
            Storage::disk('local')->makeDirectory('documents/personal');
            if ($data['kind'] !== 'class-record') {
                $templatePath = resource_path('templates/' . $data['kind'] . '_template.xls');
                if (!is_file($templatePath) || !copy($templatePath, Storage::disk('local')->path($path))) {
                    throw new \RuntimeException('The official document template is unavailable.');
                }
            } else {
                $spreadsheet = $this->buildPersonalClassRecordSpreadsheet(
                    $request->user(),
                    $title
                );
                (new Xlsx($spreadsheet))->save(Storage::disk('local')->path($path));
                $spreadsheet->disconnectWorksheets();
            }
        } catch (\Throwable $e) {
            $document->delete();
            Log::error('Personal document template creation failed', ['kind' => $data['kind'], 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to create the document template.'], 500);
        }

        $document->update(['storage_path' => $path]);

        return response()->json($this->personalDocumentPayload($document), 201);
    }

    private function buildPersonalClassRecordSpreadsheet(User $user, string $title): Spreadsheet
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator($user->name)
            ->setTitle($title);

        $blankCourse = new Course([
            'course_code' => 'TERM1',
            'course_name' => '',
            'section' => '',
            'academic_term' => '',
            'school_year' => '',
        ]);
        $courses = collect([$blankCourse]);

        $activeSheet = $spreadsheet->getActiveSheet();
        $createdSheet = false;

        foreach ($courses as $course) {
            $sheet = $createdSheet
                ? $spreadsheet->createSheet()
                : $activeSheet;
            $createdSheet = true;

            $sheetName = preg_replace('/[^A-Za-z0-9_\-]/', '_', (string) ($course->course_code ?: $course->course_name));
            $sheetName = substr(trim((string) $sheetName) ?: 'Class_Record', 0, 31);
            $sheet->setTitle($sheetName);
            $sheet->getPageSetup()->setOrientation('landscape')->setFitToPage(true)->setFitToWidth(1)->setFitToHeight(0);

            $subject = strtoupper((string) $course->course_name);
            $weights = str_contains($subject, 'EPP')
                || str_contains($subject, 'TLE')
                || str_contains($subject, 'PANTAHANAN')
                ? ['ww' => 0.20, 'pt' => 0.60, 'qa' => 0.20]
                : ['ww' => 0.20, 'pt' => 0.50, 'qa' => 0.30];
            $wwPercent = (int) round($weights['ww'] * 100);
            $ptPercent = (int) round($weights['pt'] * 100);
            $qaPercent = (int) round($weights['qa'] * 100);

            $widths = [4.1, 35.8, 1.8, 8, 8, 4.8, 8, 8, 8, 8, 6.4, 7.1, 8, 4.8, 8, 8, 6.4, 7.1, 8, 4.8, 8, 4.8, 7.1, 7.1, 8, 11.4, 11, 14];
            foreach ($widths as $index => $width) {
                $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index + 1))->setWidth($width);
            }

            $thin = ['style' => Border::BORDER_THIN];
            $medium = ['style' => Border::BORDER_MEDIUM];
            $allThin = ['top' => $thin, 'right' => $thin, 'bottom' => $thin, 'left' => $thin];

            $sheet->mergeCells('A1:AB2');
            $sheet->setCellValue('A1', 'Class Record');
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(21);
            $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_TOP);
            $sheet->getRowDimension(1)->setRowHeight(15);
            $sheet->getRowDimension(2)->setRowHeight(15);
            $sheet->mergeCells('A3:AB3');
            $sheet->setCellValue('A3', '(Pursuant to DepEd Order No. 8, s. 2015)');
            $sheet->getStyle('A3')->getFont()->setItalic(true)->setSize(9);
            $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $sheet->mergeCells('B4:F4');
            $sheet->mergeCells('G4:H4');
            $sheet->mergeCells('I4:K4');
            $sheet->mergeCells('L4:O4');
            $sheet->setCellValue('B4', 'REGION');
            $sheet->setCellValue('G4', '');
            $sheet->setCellValue('I4', 'DIVISION');
            $sheet->setCellValue('L4', '');
            foreach (['B4', 'I4'] as $cell) {
                $sheet->getStyle($cell)->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
            }
            foreach (['G4', 'L4'] as $cell) {
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(true);
                $sheet->getStyle($cell)->applyFromArray(['border' => $allThin]);
            }
            $sheet->getRowDimension(4)->setRowHeight(21);

            $sheet->mergeCells('B5:F5');
            $sheet->mergeCells('G5:O5');
            $sheet->mergeCells('Q5:R5');
            $sheet->mergeCells('S5:U5');
            $sheet->mergeCells('V5:Y5');
            $sheet->mergeCells('Z5:AB5');
            $sheet->setCellValue('B5', 'SCHOOL NAME');
            $sheet->setCellValue('G5', '');
            $sheet->setCellValue('Q5', 'SCHOOL ID');
            $sheet->setCellValue('S5', '');
            $sheet->setCellValue('V5', 'SCHOOL YEAR');
            $sheet->setCellValue('Z5', '');
            foreach (['B5', 'Q5', 'V5'] as $cell) {
                $sheet->getStyle($cell)->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
            }
            foreach (['G5', 'S5', 'Z5'] as $cell) {
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(false);
                $sheet->getStyle($cell)->applyFromArray(['border' => $allThin]);
            }
            $sheet->getRowDimension(5)->setRowHeight(21);

            $sheet->mergeCells('A7:B7');
            $sheet->mergeCells('F7:I7');
            $sheet->mergeCells('J7:M7');
            $sheet->mergeCells('N7:P7');
            $sheet->mergeCells('Q7:V7');
            $sheet->mergeCells('X7:Y7');
            $sheet->mergeCells('Z7:AB7');
            $sheet->setCellValue('A7', 'TERM');
            $sheet->setCellValue('F7', 'GRADE & SECTION:');
            $sheet->setCellValue('J7', '');
            $sheet->setCellValue('N7', 'TEACHER:');
            $sheet->setCellValue('Q7', '');
            $sheet->setCellValue('X7', 'SUBJECT:');
            $sheet->setCellValue('Z7', '');
            $sheet->getStyle('A7')->getFont()->setBold(true)->setSize(12);
            $sheet->getStyle('A7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setVertical(Alignment::VERTICAL_CENTER);
            foreach (['F7', 'N7', 'X7'] as $cell) {
                $sheet->getStyle($cell)->getFont()->setBold(true)->setSize(10);
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT)->setVertical(Alignment::VERTICAL_CENTER);
            }
            foreach (['J7', 'Q7', 'Z7'] as $cell) {
                $sheet->getStyle($cell)->getFont()->setBold(true);
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setVertical(Alignment::VERTICAL_CENTER);
            }
            $sheet->getStyle('A7')->applyFromArray(['border' => ['top' => $medium, 'left' => $medium]]);
            $sheet->getStyle('F7')->applyFromArray(['border' => ['top' => $medium, 'left' => $medium]]);
            $sheet->getRowDimension(7)->setRowHeight(23.25);

            $sheet->mergeCells('A8:A10');
            $sheet->mergeCells('B8:B10');
            $sheet->mergeCells('F8:M8');
            $sheet->mergeCells('N8:S8');
            $sheet->mergeCells('T8:Y8');
            $sheet->mergeCells('Z8:Z10');
            $sheet->mergeCells('AA8:AA10');
            $sheet->mergeCells('AB8:AB10');
            $sheet->setCellValue('A8', 'No.');
            $sheet->setCellValue('B8', "LEARNERS' NAMES");
            $sheet->setCellValue('F8', "WRITTEN / ORAL WORKS ({$wwPercent}%)");
            $sheet->setCellValue('N8', "PRODUCT / PERFORMANCE TASKS ({$ptPercent}%)");
            $sheet->setCellValue('T8', "SUMMATIVE TESTS AND TERM EXAMINATIONS ({$qaPercent}%)");
            $sheet->setCellValue('Z8', 'Initial Grade');
            $sheet->setCellValue('AA8', 'TERM GRADE');
            $sheet->setCellValue('AB8', 'DESCRIPTOR');

            $headerFill = ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD9E1F2']];
            foreach (['A8', 'B8', 'F8', 'N8', 'T8', 'Z8', 'AA8', 'AB8'] as $cell) {
                $sheet->getStyle($cell)->getFont()->setBold(true)->setSize($cell === 'B8' ? 14 : 11);
                $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(true);
                $sheet->getStyle($cell)->applyFromArray([
                    'fill' => $headerFill,
                    'border' => [
                        'top' => $medium,
                        'right' => $medium,
                        'bottom' => $thin,
                        'left' => $medium,
                    ],
                ]);
            }

            $itemHeaders = [
                'F' => 1, 'G' => 2, 'H' => 3, 'I' => 4, 'J' => 5, 'K' => 'Total', 'L' => 'PS', 'M' => 'WS',
                'N' => 1, 'O' => 2, 'P' => 3, 'Q' => 'Total', 'R' => 'PS', 'S' => 'WS',
                'T' => 'ST1', 'U' => 'ST2', 'V' => 'TE', 'W' => 'Total', 'X' => 'PS', 'Y' => 'WS',
            ];
            foreach ($itemHeaders as $column => $value) {
                $sheet->setCellValue("{$column}9", $value);
                $sheet->getStyle("{$column}9")->getFont()->setBold(true);
                $sheet->getStyle("{$column}9")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
                $sheet->getStyle("{$column}9")->applyFromArray([
                    'fill' => $headerFill,
                    'border' => [
                        'top' => $thin,
                        'right' => $thin,
                        'bottom' => $thin,
                        'left' => $medium,
                    ],
                ]);
            }
            $sheet->getRowDimension(9)->setRowHeight(18);
            $sheet->getRowDimension(8)->setRowHeight(46.75);
            $sheet->setCellValue('B10', 'HIGHEST POSSIBLE SCORE');
            $sheet->getStyle('B10')->getFont()->setBold(true)->setSize(11);
            $sheet->getStyle('B10')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getStyle('B10')->applyFromArray(['border' => $allThin]);
            foreach (['K' => 100, 'L' => 100, 'M' => $weights['ww'], 'Q' => 100, 'R' => 100, 'S' => $weights['pt'], 'W' => 100, 'X' => 100, 'Y' => $weights['qa']] as $column => $value) {
                $sheet->setCellValue("{$column}10", $value);
                $sheet->getStyle("{$column}10")->getFont()->setBold(true)->setSize(11);
                $sheet->getStyle("{$column}10")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("{$column}10")->applyFromArray(['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFFFF2CC']], 'border' => $allThin]);
                if (in_array($column, ['M', 'S', 'Y'], true)) {
                    $sheet->getStyle("{$column}10")->getNumberFormat()->setFormatCode('0%');
                }
            }
            $sheet->getRowDimension(10)->setRowHeight(18);

            $students = Student::where('course_id', $course->id)
                ->orderBy('name')
                ->get();
            $males = $students->filter(fn (Student $student) => strtoupper((string) $student->gender) !== 'F');
            $females = $students->filter(fn (Student $student) => strtoupper((string) $student->gender) === 'F');

            $assessmentsByPeriod = [];
            $gradesByPeriod = [];
            foreach (['1st', '2nd', '3rd'] as $period) {
                $assessmentsByPeriod[$period] = GradebookAssessment::where('course_id', $course->id)
                    ->where('grading_period', $period)
                    ->orderBy('created_at')
                    ->get();
                $gradesByPeriod[$period] = GradebookGrade::whereIn(
                    'assessment_id',
                    $assessmentsByPeriod[$period]->pluck('id')
                )->get()->groupBy('student_id');
            }

            $selectedPeriod = '3rd';
            $selectedPeriodScore = -1;
            foreach (['1st', '2nd', '3rd'] as $period) {
                $periodScore = $gradesByPeriod[$period]->count() + $assessmentsByPeriod[$period]->count();
                if ($periodScore > $selectedPeriodScore) {
                    $selectedPeriod = $period;
                    $selectedPeriodScore = $periodScore;
                }
            }
            $termLabel = match ($selectedPeriod) {
                '1st' => 'TERM 1',
                '2nd' => 'TERM 2',
                default => 'TERM 3',
            };
            $sheet->setCellValue('A7', '');

            $row = 11;
            $sheet->mergeCells("A{$row}:AB{$row}");
            $sheet->setCellValue("A{$row}", 'MALE');
            $sheet->getStyle("A{$row}:AB{$row}")->getFont()->setBold(true)->setSize(11);
            $sheet->getStyle("A{$row}:AB{$row}")->applyFromArray([
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE2EFDA']],
                'border' => [
                    'top' => $thin,
                    'left' => $medium,
                    'right' => $medium,
                    'bottom' => $thin,
                ],
            ]);
            $row++;

            foreach ($males->values() as $index => $student) {
                $this->writeClassRecordStudentRow($sheet, $row, $index + 1, $student, $selectedPeriod, $weights, $assessmentsByPeriod, $gradesByPeriod);
                $row++;
            }

            $sheet->mergeCells("A{$row}:AB{$row}");
            $sheet->setCellValue("A{$row}", 'FEMALE');
            $sheet->getStyle("A{$row}:AB{$row}")->getFont()->setBold(true)->setSize(11);
            $sheet->getStyle("A{$row}:AB{$row}")->applyFromArray([
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE2EFDA']],
                'border' => [
                    'top' => $thin,
                    'left' => $medium,
                    'right' => $medium,
                    'bottom' => $thin,
                ],
            ]);
            $row++;

            foreach ($females->values() as $index => $student) {
                $this->writeClassRecordStudentRow($sheet, $row, $index + 1, $student, $selectedPeriod, $weights, $assessmentsByPeriod, $gradesByPeriod);
                $row++;
            }

            $row++;
            $sheet->setCellValue("B{$row}", 'MEAN');
            $sheet->setCellValue("AA{$row}", '=IFERROR(ROUND(AVERAGE(AA12:AA' . ($row - 3) . '),2),"")');
            $sheet->getStyle("B{$row}")->getFont()->setBold(true);
            $sheet->getStyle("AA{$row}")->getFont()->setBold(true);
            $sheet->getStyle("AA{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
            $row++;
            $sheet->setCellValue("B{$row}", '% OF MASTERY (75 & above)');
            $sheet->setCellValue("AA{$row}", '=IFERROR(ROUND(COUNTIF(AA12:AA' . ($row - 4) . ',">=75")/COUNT(AA12:AA' . ($row - 4) . ')*100,2),"")');
            $sheet->setCellValue("AB{$row}", '%');
            $sheet->getStyle("B{$row}")->getFont()->setBold(true);
            $sheet->getStyle("AA{$row}:AB{$row}")->getFont()->setBold(true);
            $sheet->getStyle("AA{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);

            $row += 2;
            $sheet->setCellValue("B{$row}", 'Prepared by:');
            $sheet->setCellValue("J{$row}", 'Noted by:');
            $row += 2;
            $sheet->mergeCells("B{$row}:H{$row}");
            $sheet->setCellValue("B{$row}", '');
            $sheet->getStyle("B{$row}")->getFont()->setBold(true)->setUnderline(true);
            $sheet->getStyle("B{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $row++;
            $sheet->mergeCells("B{$row}:H{$row}");
            $sheet->setCellValue("B{$row}", 'Teacher');
            $sheet->getStyle("B{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $sheet->freezePane('C11');
        }

        if (!$createdSheet) {
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Class_Record');
            $sheet->setCellValue('A1', $title);
            $sheet->mergeCells('A1:H1');
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
            $sheet->setCellValue('A3', 'No courses found.');
            $sheet->setCellValue('A4', 'Create or sync a course, then create this template again.');
            $sheet->getColumnDimension('A')->setWidth(50);
        }

        return $spreadsheet;
    }

    private function writeClassRecordStudentRow(
        $sheet,
        int $row,
        int $number,
        Student $student,
        string $period,
        array $weights,
        array $assessmentsByPeriod,
        array $gradesByPeriod
    ): void {
        $assessments = $assessmentsByPeriod[$period];
        $written = $assessments->filter(fn (GradebookAssessment $assessment) => in_array($assessment->type, ['activity', 'quiz'], true))->values();
        $performance = $assessments->filter(fn (GradebookAssessment $assessment) => in_array($assessment->type, ['project', 'assignment'], true))->values();
        $summative = $assessments->filter(fn (GradebookAssessment $assessment) => $assessment->type === 'exam')->values();

        $sheet->setCellValue("A{$row}", $number);
        $sheet->setCellValue("B{$row}", $student->name);

        $studentGrades = $gradesByPeriod[$period]->get($student->id, collect());
        $scoreMap = $studentGrades->pluck('score', 'assessment_id');

        $writtenColumns = ['F', 'G', 'H', 'I', 'J'];
        foreach ($writtenColumns as $index => $column) {
            $assessment = $written->get($index);
            if ($assessment && $scoreMap->has($assessment->id)) {
                $sheet->setCellValue("{$column}{$row}", (float) $scoreMap[$assessment->id]);
            }
        }
        $performanceColumns = ['N', 'O', 'P'];
        foreach ($performanceColumns as $index => $column) {
            $assessment = $performance->get($index);
            if ($assessment && $scoreMap->has($assessment->id)) {
                $sheet->setCellValue("{$column}{$row}", (float) $scoreMap[$assessment->id]);
            }
        }
        $summativeColumns = ['T', 'U', 'V'];
        foreach ($summativeColumns as $index => $column) {
            $assessment = $summative->get($index);
            if ($assessment && $scoreMap->has($assessment->id)) {
                $sheet->setCellValue("{$column}{$row}", (float) $scoreMap[$assessment->id]);
            }
        }

        $sheet->setCellValue("K{$row}", "=IF(COUNT(\$F{$row}:\$J{$row})=0,\"\",SUM(\$F{$row}:\$J{$row}))");
        $sheet->setCellValue("L{$row}", "=IF(\$K{$row}=\"\",\"\",ROUND((\$K{$row}/\$K\$10)*\$L\$10,2))");
        $sheet->setCellValue("M{$row}", "=IF(\$L{$row}=\"\",\"\",ROUND(\$L{$row}*\$M\$10,2))");
        $sheet->setCellValue("Q{$row}", "=IF(COUNT(\$N{$row}:\$P{$row})=0,\"\",SUM(\$N{$row}:\$P{$row}))");
        $sheet->setCellValue("R{$row}", "=IF(\$Q{$row}=\"\",\"\",ROUND((\$Q{$row}/\$Q\$10)*\$R\$10,2))");
        $sheet->setCellValue("S{$row}", "=IF(\$R{$row}=\"\",\"\",ROUND(\$R{$row}*\$S\$10,2))");
        $sheet->setCellValue("W{$row}", "=IF(COUNT(\$T{$row}:\$V{$row})=0,\"\",SUM(\$T{$row}:\$V{$row}))");
        $sheet->setCellValue("X{$row}", "=IF(\$W{$row}=\"\",\"\",ROUND((\$W{$row}/\$W\$10)*\$X\$10,2))");
        $sheet->setCellValue("Y{$row}", "=IF(\$X{$row}=\"\",\"\",ROUND(\$X{$row}*\$Y\$10,2))");
        $sheet->setCellValue("Z{$row}", "=IF(\$W{$row}=\"\",\"\",ROUND(SUM(\$M{$row},\$S{$row},\$Y{$row}),2))");

        $initialGrade = $this->calculatePersonalClassRecordInitialGrade(
            $written,
            $performance,
            $summative,
            $scoreMap,
            $weights
        );
        if ($initialGrade !== null) {
            $termGrade = $this->transmutePersonalClassRecordGrade($initialGrade);
            $sheet->setCellValue("AA{$row}", $termGrade);
            $sheet->setCellValue("AB{$row}", $this->descriptorPersonalClassRecordGrade($termGrade));
        }

        $thin = ['style' => Border::BORDER_THIN];
        $medium = ['style' => Border::BORDER_MEDIUM];
        for ($columnIndex = 1; $columnIndex <= 28; $columnIndex++) {
            $column = Coordinate::stringFromColumnIndex($columnIndex);
            $borderLeft = $column === 'A' ? $medium : $thin;
            $borderRight = $column === 'AB' ? $medium : $thin;
            $sheet->getStyle("{$column}{$row}")->applyFromArray([
                'border' => [
                    'top' => $thin,
                    'right' => $borderRight,
                    'bottom' => $thin,
                    'left' => $borderLeft,
                ],
            ]);
            $sheet->getStyle("{$column}{$row}")->getFont()->setSize(11);
            $sheet->getStyle("{$column}{$row}")->getAlignment()->setHorizontal(
                $column === 'B' ? Alignment::HORIZONTAL_LEFT : Alignment::HORIZONTAL_CENTER
            )->setVertical(Alignment::VERTICAL_CENTER);
        }
        foreach (['L', 'M', 'R', 'S', 'X', 'Y', 'Z', 'AA', 'AB'] as $column) {
            $sheet->getStyle("{$column}{$row}")->getFont()->setBold(true)->setSize(11);
        }
        $sheet->getRowDimension($row)->setRowHeight(18);
    }

    private function calculatePersonalClassRecordInitialGrade($written, $performance, $summative, $scoreMap, array $weights): ?float
    {
        $categories = [
            [$written, $weights['ww']],
            [$performance, $weights['pt']],
            [$summative, $weights['qa']],
        ];
        $percentages = [];

        foreach ($categories as $categoryIndex => [$assessments, $weight]) {
            $raw = 0.0;
            $maximum = 0.0;
            $limit = $categoryIndex === 0 ? 5 : 3;
            foreach ($assessments->take($limit) as $assessment) {
                if (!$scoreMap->has($assessment->id)) {
                    continue;
                }
                $raw += (float) $scoreMap[$assessment->id];
                $maximum += (float) $assessment->max_score;
            }
            $percentages[] = $maximum > 0 ? ($raw / $maximum) * 100 : null;
        }

        if ($percentages[0] === null || $percentages[1] === null || $percentages[2] === null) {
            return null;
        }

        return round(
            ($percentages[0] * $weights['ww'])
            + ($percentages[1] * $weights['pt'])
            + ($percentages[2] * $weights['qa']),
            2
        );
    }

    private function transmutePersonalClassRecordGrade(float $grade): int
    {
        $table = [
            [0, 39.99, 60], [40, 42.99, 61], [43, 45.99, 62], [46, 47.99, 63],
            [48, 49.99, 64], [50, 51.99, 65], [52, 53.99, 66], [54, 55.99, 67],
            [56, 57.99, 68], [58, 59.99, 69], [60, 61.99, 70], [62, 63.99, 71],
            [64, 65.99, 72], [66, 67.99, 73], [68, 69.99, 74], [70, 72.99, 75],
            [73, 74.99, 76], [75, 75.99, 77], [76, 76.99, 78], [77, 77.99, 79],
            [78, 78.99, 80], [79, 79.99, 81], [80, 80.99, 82], [81, 81.99, 83],
            [82, 82.99, 84], [83, 83.99, 85], [84, 84.99, 86], [85, 85.99, 87],
            [86, 86.99, 88], [87, 87.99, 89], [88, 88.99, 90], [89, 89.99, 91],
            [90, 90.99, 92], [91, 91.99, 93], [92, 92.99, 94], [93, 93.99, 95],
            [94, 94.99, 96], [95, 95.99, 97], [96, 97.49, 98], [97.5, 99.49, 99],
            [99.5, 100, 100],
        ];
        foreach ($table as [$low, $high, $value]) {
            if ($grade >= $low && $grade <= $high) return $value;
        }
        return $grade >= 100 ? 100 : 60;
    }

    private function descriptorPersonalClassRecordGrade(int $grade): string
    {
        if ($grade >= 90) return 'Advancing';
        if ($grade >= 80) return 'Benchmarking';
        if ($grade >= 75) return 'Connecting';
        if ($grade >= 65) return 'Developing';
        return 'Emerging';
    }

    public function personalEditor(Request $request, int $id): JsonResponse
    {
        $document = UserDocument::where('user_id', $request->user()->id)->findOrFail($id);
        $type = self::PERSONAL_TYPES[$document->extension];
        $appUrl = $this->resolveOnlyOfficeAppUrl($request);
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');
        $contentUrl = $appUrl . '/api/documents/personal/' . $id . '/content';
        if ($jwtSecret !== '') {
            $contentUrl .= '?access_token=' . urlencode($this->signJwt([
                'type' => 'personal',
                'id' => $id,
                'exp' => time() + 3600,
            ], $jwtSecret));
        }

        $config = [
            'document' => [
                'fileType' => $document->extension,
                'key' => $document->documentKey(),
                'title' => $document->title . '.' . $document->extension,
                'url' => $contentUrl,
            ],
            'documentType' => $type['ooType'],
            'editorConfig' => [
                'callbackUrl' => $appUrl . '/api/documents/onlyoffice/callback?type=personal&id=' . $id,
                'mode' => 'edit',
                'lang' => 'en',
                'user' => ['id' => (string) $request->user()->id, 'name' => $request->user()->name],
            ],
        ];
        if ($jwtSecret !== '') {
            $config['token'] = $this->signJwt($config, $jwtSecret);
        }

        return response()->json([
            'id' => $id,
            'type' => 'personal',
            'title' => $document->title,
            'extension' => $document->extension,
            'documentType' => $type['ooType'],
            'config' => $config,
            'onlyofficeUrl' => rtrim(config('services.onlyoffice.url', 'http://localhost:8080'), '/'),
        ]);
    }

    public function personalContent(Request $request, int $id): Response
    {
        $document = UserDocument::findOrFail($id);
        if (Auth::check()) {
            abort_unless((int) $document->user_id === (int) Auth::id(), 403);
        } elseif (!$this->hasValidContentAccessToken($request, 'personal', $id)) {
            abort(403, 'Invalid content access token.');
        }

        abort_unless(Storage::disk('local')->exists($document->storage_path), 404);
        return response(Storage::disk('local')->get($document->storage_path), 200, [
            'Content-Type' => $document->mime_type,
            'Content-Disposition' => 'inline; filename="' . $document->title . '.' . $document->extension . '"',
        ]);
    }

    public function personalDownload(Request $request, int $id): BinaryFileResponse
    {
        $document = UserDocument::where('user_id', $request->user()->id)->findOrFail($id);
        abort_unless(Storage::disk('local')->exists($document->storage_path), 404);

        return response()->download(
            Storage::disk('local')->path($document->storage_path),
            $document->title . '.' . $document->extension,
            ['Content-Type' => $document->mime_type]
        );
    }

    public function personalRename(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $title = trim($data['title']);
        if ($title === '') {
            return response()->json(['message' => 'A document name is required.'], 422);
        }

        $document = UserDocument::where('user_id', $request->user()->id)->findOrFail($id);
        $document->update(['title' => $title]);

        return response()->json($this->personalDocumentPayload($document->refresh()));
    }

    public function personalDelete(Request $request, int $id): JsonResponse
    {
        $document = UserDocument::where('user_id', $request->user()->id)->findOrFail($id);
        Storage::disk('local')->delete($document->storage_path);
        $document->delete();

        return response()->json(['success' => true]);
    }

    private function personalDocumentPayload(UserDocument $document): array
    {
        return [
            'id' => $document->id,
            'type' => 'personal',
            'title' => $document->title,
            'kind' => $document->kind,
            'extension' => $document->extension,
            'version' => $document->version,
            'updated_at' => $document->updated_at?->toISOString(),
        ];
    }

    // ── POST /api/documents/{type}/upload ────────────────────────────────────

    public function upload(Request $request, string $type): JsonResponse
    {
        [$model, $ext] = $this->resolveType($type);

        $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'file'  => ['required', 'file', 'mimetypes:application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip'],
        ]);

        $uploaded = $request->file('file');
        $title    = trim((string) ($request->input('title') ?: $uploaded->getClientOriginalName()));
        $title    = $title !== '' ? $title : ucfirst(str_replace(['-', '_'], ' ', $type));

        $pathKey = $type === 'class-record' ? 'xlsx_path' : 'docx_path';
        $doc = $model::create([
            'user_id' => Auth::id(),
            'title'   => $title,
            'xlsx_path' => $type === 'class-record' ? null : null,
            'docx_path' => $type === 'lesson-plan' ? null : null,
            'xlsx_version' => 1,
            'docx_version' => 1,
        ]);

        $storagePath = $type === 'class-record'
            ? 'documents/class-records/' . $doc->id . '.xlsx'
            : 'documents/lesson-plans/' . $doc->id . '.docx';

        $stored = $uploaded->storeAs(dirname($storagePath), basename($storagePath), 'local');
        if ($stored === false) {
            $doc->delete();
            return response()->json(['error' => 'Unable to save uploaded document.'], 500);
        }

        $doc->update([$pathKey => $storagePath]);

        return response()->json([
            'id'        => $doc->id,
            'type'      => $type,
            'title'     => $doc->title,
            'extension' => $ext,
            'path'      => $storagePath,
            'version'   => $type === 'class-record' ? ($doc->xlsx_version ?? 1) : ($doc->docx_version ?? 1),
        ], 201);
    }

    // ── POST /api/documents/attendance-sf2/generate ───────────────────────────

    /**
     * Build a School Form 2 (SF2) Daily Attendance Report workbook from the
     * official template and store it for editing in ONLYOFFICE.
     */
    public function generateSf2(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'course_id'    => ['required', 'integer'],
            'month'        => ['required', 'integer', 'min:1', 'max:12'],
            'year'         => ['required', 'integer', 'min:2020', 'max:2100'],
            'school_name'  => ['nullable', 'string'],
            'school_id'    => ['nullable', 'string'],
            'grade_level'  => ['nullable', 'string'],
            'adviser_name' => ['nullable', 'string'],
            'school_head'  => ['nullable', 'string'],
        ]);

        $course = Course::where('user_id', $user->id)
            ->where('id', $data['course_id'])
            ->with('user')
            ->first();

        if (!$course) {
            return response()->json(['message' => 'Course not found'], 404);
        }

        $monthName = date('F', mktime(0, 0, 0, $data['month'], 1, $data['year']));
        $syStart = $data['month'] >= 6 ? $data['year'] : $data['year'] - 1;

        $doc = AttendanceDocument::create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'month' => $data['month'],
            'year' => $data['year'],
            'title' => sprintf('SF2 %s %s', trim((string) $course->section), $monthName),
        ]);

        $config = [
            'school_name' => $data['school_name'] ?? '',
            'school_id' => $data['school_id'] ?? '',
            'grade_level' => $data['grade_level'] ?? '',
            'adviser_name' => $data['adviser_name'] ?? strtoupper($user->name),
            'school_head' => $data['school_head'] ?? '',
        ];

        $path = 'documents/attendance-sf2/' . $doc->id . '.xls';
        try {
            $disk = Storage::disk('local');
            $disk->makeDirectory('documents/attendance-sf2');
            if (!is_dir($disk->path('documents/attendance-sf2'))) {
                throw new \RuntimeException('Unable to create the SF2 storage directory.');
            }

            $targetPath = $disk->path($path);
            app(SF2ExportService::class)->generate($course, $data['month'], $data['year'], $config, $targetPath);
            if (!$disk->exists($path)) {
                throw new \RuntimeException('The generated SF2 workbook is not present in storage.');
            }
        } catch (\Throwable $e) {
            $doc->delete();
            Log::error('SF2 generation failed', [
                'course_id' => $course->id,
                'month' => $data['month'],
                'year' => $data['year'],
                'template' => resource_path('templates/sf2_template.xls'),
                'target_path' => $disk->path($path),
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Could not generate the SF2 report.',
                'error' => $e->getMessage(),
            ], 500);
        }

        $doc->update(['xls_path' => $path]);

        return response()->json([
            'id'        => $doc->id,
            'type'      => 'attendance-sf2',
            'title'     => $doc->title,
            'extension' => 'xls',
            'path'      => $path,
            'version'   => $doc->xls_version,
        ], 201);
    }

    // ── POST /api/documents/class-record-sf1/generate ───────────────────────────

    /**
     * Build a School Form 1 (SF1) School Register workbook and store it for
     * ONLYOFFICE editing.
     */
    public function generateSf1(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'course_id'    => ['required', 'integer'],
            'school_name'  => ['nullable', 'string'],
            'school_id'    => ['nullable', 'string'],
            'region'       => ['nullable', 'string'],
            'division'     => ['nullable', 'string'],
            'district'     => ['nullable', 'string'],
            'grade_level'  => ['nullable', 'string'],
            'school_year'  => ['nullable', 'string'],
        ]);

        $course = Course::where('user_id', $user->id)
            ->where('id', $data['course_id'])
            ->first();

        if (!$course) {
            return response()->json(['message' => 'Course not found'], 404);
        }

        $doc = ClassRecordDocument::create([
            'user_id' => $user->id,
            'title' => sprintf('SF1 %s', trim((string) $course->section)),
        ]);

        $config = [
            'school_name' => $data['school_name'] ?? '',
            'school_id' => $data['school_id'] ?? '',
            'region' => $data['region'] ?? 'Region I',
            'division' => $data['division'] ?? 'La Union',
            'district' => $data['district'] ?? 'Balaoan',
            'grade_level' => $data['grade_level'] ?? '',
            'school_year' => $data['school_year'] ?? '',
        ];

        $path = 'documents/class-records/' . $doc->id . '.xls';
        try {
            Storage::disk('local')->makeDirectory('documents/class-records');
            app(SF1ExportService::class)->generate($course, $config, Storage::disk('local')->path($path));
        } catch (\Throwable $e) {
            $doc->delete();
            Log::error('SF1 generation failed', ['course_id' => $course->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Could not generate the SF1 report.'], 500);
        }

        $doc->update(['xlsx_path' => $path]);

        return response()->json([
            'id'        => $doc->id,
            'type'      => 'class-record',
            'title'     => $doc->title,
            'extension' => 'xls',
            'path'      => $path,
            'version'   => $doc->xlsx_version ?? 1,
        ], 201);
    }

    // ── GET /api/documents/{type}/{id}/editor ─────────────────────────────────

    public function editor(Request $request, string $type, int $id): JsonResponse
    {
        [$model, $ext, $ooType, $pathKey] = $this->resolveType($type);

        /** @var LessonPlan $doc */
        $doc = $model::findOrFail($id);
        $this->authorizeDoc($doc, $type);

        // For lesson plans: auto-generate DOCX if missing
        if ($type === 'lesson-plan' && (!$doc->docx_path || !Storage::disk('local')->exists($doc->docx_path))) {
            app(LessonPlanService::class)->saveDocxToDisk($doc);
            $doc->refresh();
        }

        // Determine the stored file path based on type
        $filePath = $doc->{$pathKey};

        if (!$filePath || !Storage::disk('local')->exists($filePath)) {
            return response()->json(['error' => 'Document file not found on server.'], 404);
        }

        // Read-only mode (admin review view); defaults to edit
        $mode     = $request->query('mode') === 'view' ? 'view' : 'edit';
        $appUrl    = $this->resolveOnlyOfficeAppUrl($request);
        $ooUrl     = rtrim(config('services.onlyoffice.url', 'http://localhost:8080'), '/');
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');

        $user    = Auth::user();
        $docKey  = $doc->docxKey();

        // ONLYOFFICE needs a URL it can reach (the Laravel content endpoint)
        $contentUrl  = $appUrl . '/api/documents/' . $type . '/' . $id . '/content';
        if ($jwtSecret !== '') {
            $contentToken = $this->signJwt([
                'type' => $type,
                'id'   => $id,
                'exp'  => time() + 3600,
            ], $jwtSecret);
            $contentUrl .= '?access_token=' . urlencode($contentToken);
        }
        $callbackUrl = $appUrl . '/api/documents/onlyoffice/callback?type=' . $type . '&id=' . $id;

        $config = [
            'document' => [
                'fileType' => $ext,
                'key'      => $docKey,
                'title'    => ($doc->title ?: 'Document') . '.' . $ext,
                'url'      => $contentUrl,
            ],
            'documentType' => $ooType,
            'editorConfig' => [
                'callbackUrl' => $callbackUrl,
                'mode'        => $mode,
                'lang'        => 'en',
                'user' => [
                    'id'   => (string) $user->id,
                    'name' => $user->name,
                ],
            ],
        ];

        // Autostart the "insert bridge" plugin (served by this app) that the AI
        // sidebar's "Insert into document" button talks to. Only needed while
        // editing — read-only review mode can't accept insertions anyway.
        // (The SF2 spreadsheet has no AI-insert flow.)
        if ($mode === 'edit' && $type !== 'attendance-sf2') {
            $config['editorConfig']['plugins'] = [
                'autostart'   => [OnlyofficeInsertPluginController::GUID],
                // Browser-facing URL (the editor iframe fetches this), NOT the
                // docker-internal one used for document content.
                'pluginsData' => [
                    $request->getSchemeAndHttpHost() . '/' . OnlyofficeInsertPluginController::PATH . '/config.json',
                ],
            ];
        }

        // Sign with JWT if a secret is configured
        if ($jwtSecret !== '') {
            // ONLYOFFICE expects the JWT payload to match the config shape directly.
            $config['token'] = $this->signJwt($config, $jwtSecret);
        }

        return response()->json([
            'id'           => $id,
            'type'         => $type,
            'title'        => $doc->title,
            'extension'    => $ext,
            'documentType' => $ooType,
            'key'          => $docKey,
            'config'       => $config,
            'onlyofficeUrl'=> $ooUrl,
        ]);
    }

    // ── GET /api/documents/{type}/{id}/content ────────────────────────────────

    public function content(Request $request, string $type, int $id): Response
    {
        [$model, $ext, , $pathKey, , , $mimeType] = $this->resolveType($type);

        /** @var LessonPlan $doc */
        $doc = $model::findOrFail($id);

        if (Auth::check()) {
            $this->authorizeDoc($doc, $type);
        } else {
            if (!$this->hasValidContentAccessToken($request, $type, $id)) {
                abort(403, 'Invalid content access token.');
            }
        }

        $filePath = $doc->{$pathKey};

        if (!$filePath || !Storage::disk('local')->exists($filePath)) {
            abort(404, 'Document file not found.');
        }

        $bytes = Storage::disk('local')->get($filePath);

        return response($bytes, 200, [
            'Content-Type'        => $mimeType,
            'Content-Disposition' => 'inline; filename="' . ($doc->title ?: 'document') . '.' . $ext . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    // ── POST /api/documents/onlyoffice/callback ───────────────────────────────

    /**
     * ONLYOFFICE callback statuses:
     *  0 - no document with the key identifier could be found
     *  1 - document is being edited
     *  2 - document is ready for saving
     *  3 - document saving error has occurred
     *  4 - document is closed with no changes
     *  6 - document is being edited, but the current document state is saved
     *  7 - error has occurred while force saving the document
     */
    public function callback(Request $request): JsonResponse
    {
        $type = $request->query('type', 'lesson-plan');
        $id   = (int) $request->query('id', 0);

        if (!$id) {
            return response()->json(['error' => 1], 400);
        }

        // Validate JWT if secret is configured
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');
        if ($jwtSecret !== '') {
            $authHeader = $request->header('Authorization', '');
            $token      = $request->input('token') ?: (
                str_starts_with($authHeader, 'Bearer ') ? substr($authHeader, 7) : $authHeader
            );

            if (!$token || !$this->verifyJwt($token, $jwtSecret)) {
                Log::warning('ONLYOFFICE callback JWT verification failed', [
                    'type' => $type, 'id' => $id,
                ]);
                return response()->json(['error' => 1]);
            }
        }

        $body   = $request->all();
        $status = (int) ($body['status'] ?? 0);

        // Status 2 = ready to save, status 6 = force-save
        if ($status === 2 || $status === 6) {
            $downloadUrl = $body['url'] ?? null;

            if (!$downloadUrl) {
                Log::error('ONLYOFFICE callback: no URL in status 2/6 payload', ['type' => $type, 'id' => $id]);
                return response()->json(['error' => 1]);
            }

            try {
                if ($type === 'personal') {
                    $doc = UserDocument::findOrFail($id);
                    $response = Http::timeout(30)->get($downloadUrl);
                    if ($response->failed()) {
                        Log::error('ONLYOFFICE callback: failed to download personal document', ['id' => $id]);
                        return response()->json(['error' => 1]);
                    }

                    Storage::disk('local')->put($doc->storage_path, $response->body());
                    $doc->update(['version' => ($doc->version ?? 1) + 1]);
                    Log::info('ONLYOFFICE callback: personal document saved', ['id' => $id]);

                    return response()->json(['error' => 0]);
                }

                [$model, $ext, , $pathKey, $verKey, $dir] = $this->resolveType($type);
                /** @var LessonPlan|ClassRecordDocument|AttendanceDocument $doc */
                $doc = $model::findOrFail($id);

                // Download the saved document from ONLYOFFICE
                $response = Http::timeout(30)->get($downloadUrl);
                if ($response->failed()) {
                    Log::error('ONLYOFFICE callback: failed to download updated document', ['type' => $type, 'id' => $id]);
                    return response()->json(['error' => 1]);
                }

                $path = 'documents/' . $dir . '/' . $id . '.' . $ext;

                Storage::disk('local')->put($path, $response->body());

                $updates = [
                    $pathKey => $path,
                    $verKey  => ($doc->$verKey ?? 1) + 1,
                ];
                // Note: lesson plan status is owned by the admin review workflow —
                // saving from ONLYOFFICE only bumps the document version.
                $doc->update($updates);

                Log::info('ONLYOFFICE callback: document saved', ['type' => $type, 'id' => $id]);
            } catch (\Throwable $e) {
                Log::error('ONLYOFFICE callback: exception during save', [
                    'type'  => $type,
                    'id'    => $id,
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['error' => 1]);
            }
        }

        // ONLYOFFICE expects {"error": 0} on success
        return response()->json(['error' => 0]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resolve a document type slug into its TYPE_MAP entry.
     *
     * Always returns the full tuple
     *   [model, ext, ooType, pathKey, versionKey, dir, mime]
     * so callers can destructure just the prefix they need and skip the rest
     * with empty slots.
     */
    private function resolveType(string $type): array
    {
        if (!isset(self::TYPE_MAP[$type])) {
            abort(404, "Unknown document type: {$type}");
        }
        $m = self::TYPE_MAP[$type];
        return [$m['model'], $m['ext'], $m['ooType'], $m['path'], $m['version'], $m['dir'], $m['mime']];
    }

    private function authorizeDoc(mixed $doc, string $type = ''): void
    {
        // Admins may open any lesson plan document (review view)
        if ($type === 'lesson-plan' && $this->isAdminUser()) {
            return;
        }

        $ownerId = (int) ($doc->user_id ?? 0);
        $currentUserId = (int) (Auth::id() ?? 0);

        if ($ownerId === 0 || $ownerId !== $currentUserId) {
            abort(403, 'You do not have access to this document.');
        }
    }

    // Same admin rule as AdminLessonPlanController / FacultyController
    private function isAdminUser(): bool
    {
        return Auth::user()->isAdmin();
    }

    /**
     * Sign a payload as a JWT (HS256).
     * Pure PHP — no external JWT package needed.
     */
    private function signJwt(array $payload, string $secret): string
    {
        $header  = $this->base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = $this->base64url(json_encode($payload));
        $sig     = $this->base64url(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        return $header . '.' . $payload . '.' . $sig;
    }

    private function verifyJwt(string $token, string $secret): bool
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;
        [$header, $payload, $sig] = $parts;
        $expected = $this->base64url(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        return hash_equals($expected, $sig);
    }

    private function decodeJwtPayload(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        $decoded = base64_decode(strtr($parts[1], '-_', '+/'));
        if ($decoded === false) {
            return null;
        }

        $payload = json_decode($decoded, true);
        return is_array($payload) ? $payload : null;
    }

    private function hasValidContentAccessToken(Request $request, string $type, int $id): bool
    {
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');
        if ($jwtSecret === '') {
            return false;
        }

        $token = (string) $request->query('access_token', '');
        if ($token === '' || !$this->verifyJwt($token, $jwtSecret)) {
            return false;
        }

        $payload = $this->decodeJwtPayload($token);
        if (!$payload) {
            return false;
        }

        if (($payload['type'] ?? null) !== $type) {
            return false;
        }

        if ((int) ($payload['id'] ?? 0) !== $id) {
            return false;
        }

        $exp = (int) ($payload['exp'] ?? 0);
        if ($exp <= 0 || $exp < time()) {
            return false;
        }

        return true;
    }

    private function resolveOnlyOfficeAppUrl(Request $request): string
    {
        $raw = (string) config('services.onlyoffice.app_url', '');
        if ($raw === '') {
            $raw = (string) config('app.url', '');
        }
        if ($raw === '') {
            $raw = $request->getSchemeAndHttpHost();
        }

        $parts = parse_url($raw);
        if (!is_array($parts)) {
            return rtrim($request->getSchemeAndHttpHost(), '/');
        }

        $host = (string) ($parts['host'] ?? '');
        if ($host === 'localhost' || $host === '127.0.0.1') {
            $host = 'host.docker.internal';
        }

        $scheme = (string) ($parts['scheme'] ?? $request->getScheme());
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';

        return rtrim($scheme . '://' . $host . $port, '/');
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
