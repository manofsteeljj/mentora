<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Assessment;
use Illuminate\Support\Facades\Auth;

class AssessmentController extends Controller
{
    public function show($id)
    {
        $assessment = Assessment::with('questions', 'course')->findOrFail($id);
        $material = null;
        if ($assessment->course) {
            $material = $assessment->course->materials()->latest()->first();
        }
        return view('assessments.show', compact('assessment', 'material'));
    }

    public function exportDocx(Request $request, $id)
    {
        $assessment = Assessment::with('questions', 'course')->findOrFail($id);

        $user = Auth::user();
        if (!$user || !$assessment->course || (int) $assessment->course->user_id !== (int) $user->id) {
            abort(403, 'You are not allowed to export this assessment.');
        }

        $title = $assessment->title ?: ('Assessment ' . $assessment->id);
        $courseCode = $assessment->course->course_code ?? '';
        $courseName = $assessment->course->course_name ?? '';
        $courseLabel = trim($courseCode . ($courseCode && $courseName ? ' - ' : '') . $courseName);

        $lines = [];
        $lines[] = $title;
        if ($courseLabel !== '') {
            $lines[] = 'Course: ' . $courseLabel;
        }
        $lines[] = 'Generated on: ' . now()->format('Y-m-d H:i');
        $lines[] = '';
        $lines[] = 'Questions';
        $lines[] = '';

        $number = 1;
        foreach ($assessment->questions as $question) {
            $lines[] = $number . '. ' . trim((string) $question->question_text);
            $lines[] = '';
            $number++;
        }

        if ($number === 1) {
            $lines[] = 'No questions found.';
        }

        $tempFile = $this->createDocxFromLines($lines);

        $safeTitle = preg_replace('/[^A-Za-z0-9_-]+/', '_', $title);
        $safeTitle = trim((string) $safeTitle, '_');
        if ($safeTitle === '') {
            $safeTitle = 'assessment_' . $assessment->id;
        }

        $fileName = $safeTitle . '.docx';

        return response()->download($tempFile, $fileName)->deleteFileAfterSend(true);
    }

    private function createDocxFromLines(array $lines): string
    {
        if (!class_exists('ZipArchive')) {
            abort(500, 'DOCX export requires ZipArchive extension.');
        }

        $zip = new \ZipArchive();
        $tmpPath = tempnam(sys_get_temp_dir(), 'assessment_docx_');
        if ($tmpPath === false) {
            abort(500, 'Unable to create temporary export file.');
        }

        $docxPath = $tmpPath . '.docx';
        @unlink($docxPath);

        $opened = $zip->open($docxPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        if ($opened !== true) {
            @unlink($tmpPath);
            abort(500, 'Unable to initialize DOCX export.');
        }

        $paragraphs = [];
        foreach ($lines as $line) {
            $chunks = preg_split('/\r?\n/', (string) $line);
            foreach ($chunks as $chunk) {
                $text = htmlspecialchars($chunk, ENT_XML1 | ENT_COMPAT, 'UTF-8');
                if ($text === '') {
                    $paragraphs[] = '<w:p/>';
                } else {
                    $paragraphs[] = '<w:p><w:r><w:t xml:space="preserve">' . $text . '</w:t></w:r></w:p>';
                }
            }
        }

        $documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
            . ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            . ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
            . ' xmlns:v="urn:schemas-microsoft-com:vml"'
            . ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
            . ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
            . ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
            . ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            . ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
            . ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
            . ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
            . ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
            . ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">'
            . '<w:body>'
            . implode('', $paragraphs)
            . '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
            . '</w:body></w:document>';

        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            . '</Types>';

        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            . '</Relationships>';

        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rels);
        $zip->addFromString('word/document.xml', $documentXml);
        $zip->close();

        @unlink($tmpPath);

        return $docxPath;
    }
}
