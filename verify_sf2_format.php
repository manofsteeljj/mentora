<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Course;
use App\Models\Student;
use App\Models\Attendance;
use App\Services\SF2ExportService;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

function loadSheet($path) {
    return IOFactory::createReaderForFile($path)->load($path)->getSheet(0);
}
function styleSig($sheet, $coord) {
    $s = $sheet->getStyle($coord);
    $f = $s->getFont(); $a = $s->getAlignment(); $b = $s->getBorders();
    $sig = $f->getName() . '/' . $f->getSize() . ($f->getBold()?'B':'') . ($f->getItalic()?'I':'')
        . '|' . $a->getHorizontal() . '/' . $a->getVertical()
        . '|' . $b->getTop()->getBorderStyle() . ',' . $b->getBottom()->getBorderStyle() . ',' . $b->getLeft()->getBorderStyle() . ',' . $b->getRight()->getBorderStyle();
    if ($s->getFill()->getFillType() !== 'none') $sig .= '|fill:' . $s->getFill()->getStartColor()->getARGB();
    return $sig;
}

$template = loadSheet(__DIR__ . '/mockup/format/SF2_2026_Grade 6 - RIZAL.xls');
$generated = loadSheet(__DIR__ . '/SF2_Test_Export_New.xls');

echo "=== FIDELITY CHECK: template vs generated (same student count 7+7) ===\n";

// Column widths
$tw = []; foreach ($template->getColumnDimensions() as $c => $d) $tw[$c] = $d->getWidth();
$gw = []; foreach ($generated->getColumnDimensions() as $c => $d) $gw[$c] = $d->getWidth();
echo "Column widths identical: " . ($tw == $gw ? "YES (" . count($tw) . " cols)" : "NO") . "\n";

// Row heights
$th = []; foreach ($template->getRowDimensions() as $r => $d) $th[$r] = $d->getRowHeight();
$gh = []; foreach ($generated->getRowDimensions() as $r => $d) $gh[$r] = $d->getRowHeight();
echo "Row heights identical: " . ($th == $gh ? "YES (" . count($th) . " rows)" : "NO") . "\n";
if ($th != $gh) {
    foreach ($th as $r => $h) if (($gh[$r] ?? null) != $h) echo "  Row $r: template=$h generated=" . ($gh[$r] ?? 'MISSING') . "\n";
}

// Merges
$tm = $template->getMergeCells(); sort($tm);
$gm = $generated->getMergeCells(); sort($gm);
echo "Merges identical: " . ($tm == $gm ? "YES (" . count($tm) . ")" : "NO (" . count($tm) . " vs " . count($gm) . ")") . "\n";

// Style spot-check on a grid of representative cells
$checkCells = [];
foreach (['A','C','F','H','K','AM','AO','AQ'] as $col) {
    foreach ([5,6,7,8,12,15,16,22,23,24,25,26,27,33,37,41,48,50,56] as $row) {
        $checkCells[] = $col . $row;
    }
}
$mismatch = 0;
foreach ($checkCells as $coord) {
    // skip cells whose values we intentionally wrote (alignment centers differ by design)
    if (in_array($coord, ['F6','AM25'])) continue;
    $t = styleSig($template, $coord);
    $g = styleSig($generated, $coord);
    if ($t !== $g) {
        // AM/AO in student rows are centered by us (data cells) — check others strictly
        $mismatch++;
        if ($mismatch <= 15) echo "  STYLE DIFF $coord:\n    T: $t\n    G: $g\n";
    }
}
echo "Style mismatches (of " . count($checkCells) . " checked): $mismatch\n";

// Page setup
echo "Orientation: " . $generated->getPageSetup()->getOrientation() . " (template: " . $template->getPageSetup()->getOrientation() . ")\n";
echo "PaperSize: " . $generated->getPageSetup()->getPaperSize() . " (template: " . $template->getPageSetup()->getPaperSize() . ")\n";

// Attendance marks — find x marks
$xCells = [];
for ($row = 8; $row <= 22; $row++) {
    foreach (['F','H','I','J','K','L','N','O','P','Q','R','T','U','V','X','Z','AB','AC','AD','AE','AF','AG','AI','AJ','AK'] as $col) {
        $v = $generated->getCell($col . $row)->getValue();
        if ($v !== null && $v !== '') $xCells[] = "$col$row=$v";
    }
}
echo "Attendance marks found: " . count($xCells) . " → " . implode(' ', array_slice($xCells, 0, 25)) . "...\n";

echo "\n=== ROW INSERTION TEST: 12 male + 10 female students ===\n";
// Add temporary students in a transaction
\DB::beginTransaction();
try {
    $course = Course::first();
    $newIds = [];
    for ($i = 1; $i <= 5; $i++) {
        $s = Student::create(['course_id' => $course->id, 'name' => "ZZTEST MALE $i", 'gender' => 'male', 'student_number' => 'ZZT-M' . $i, 'email' => "zztm$i@test.local"]);
        $newIds[] = $s->id;
    }
    for ($i = 1; $i <= 3; $i++) {
        $s = Student::create(['course_id' => $course->id, 'name' => "ZZTEST FEMALE $i", 'gender' => 'female', 'student_number' => 'ZZT-F' . $i, 'email' => "zztf$i@test.local"]);
        $newIds[] = $s->id;
    }

    $service = new SF2ExportService();
    $out = __DIR__ . '/SF2_Test_Export_Grown.xls';
    $service->generate($course, 8, 2026, ['adviser_name' => 'TEST ADVISER', 'school_head' => 'TEST HEAD'], $out);

    $g2 = loadSheet($out);
    echo "Generated with 12M+10F: merges=" . count($g2->getMergeCells()) . "\n";
    // section: 8..8+12+1+10+1+1-1 = 8..31
    for ($r = 8; $r <= 32; $r++) {
        $a = $g2->getCell("A$r")->getValue();
        $c = $g2->getCell("C$r")->getValue();
        if ($c) echo "  Row $r [A=$a]: " . substr((string)$c, 0, 50) . "\n";
    }
    // guidelines should now start at row 25+5=30? delta = (12+10+3)-17 = 8 → guidelines at 33
    echo "  Guidelines row check (A33): " . substr((string)$g2->getCell('A33')->getValue(), 0, 40) . "\n";
    echo "  Summary Month (AM33): " . $g2->getCell('AM33')->getValue() . "\n";
    echo "  Enrolment (AR35/AS35/AT35): " . $g2->getCell('AR35')->getValue() . "/" . $g2->getCell('AS35')->getValue() . "/" . $g2->getCell('AT35')->getValue() . "\n";
    echo "  Adviser (AN58): " . $g2->getCell('AN58')->getValue() . "\n";
    echo "  School head (AN64): " . $g2->getCell('AN64')->getValue() . "\n";
    // row heights of section
    $hs = [];
    foreach ($g2->getRowDimensions() as $r => $d) if ($r >= 8 && $r <= 32) $hs[] = $r . '=' . $d->getRowHeight();
    echo "  Section row heights: " . implode(' ', $hs) . "\n";
    // template rows below should be shifted by 8: template row 40 height=21 → generated 48
    echo "  Shifted heights (t40=21→g48, t50=20→g58, t56=23→g64): "
        . ($g2->getRowDimension(48)->getRowHeight() ?: 'def') . "/"
        . ($g2->getRowDimension(58)->getRowHeight() ?: 'def') . "/"
        . ($g2->getRowDimension(64)->getRowHeight() ?: 'def') . "\n";
    // spot-check style fidelity on an inserted row (row 20 was inserted area) vs template row 8
    echo "  Inserted-row style (C20) vs template (C8): " . (styleSig($g2, 'C20') === styleSig($template, 'C8') ? 'MATCH' : 'DIFF') . "\n";
    echo "  Inserted-row style (F25) vs template (F8): " . (styleSig($g2, 'F25') === styleSig($template, 'F8') ? 'MATCH' : 'DIFF') . "\n";
    echo "  Inserted-row style (AM25) vs template (AM8): " . (styleSig($g2, 'AM25') === styleSig($template, 'AM8') ? 'MATCH' : 'DIFF') . "\n";
    // total row style check: female total at 8+12+1+10 = 31
    echo "  Female total row style (C31) vs template (C23): " . (styleSig($g2, 'C31') === styleSig($template, 'C23') ? 'MATCH' : 'DIFF') . "\n";
    echo "  Combined row style (C32) vs template (C24): " . (styleSig($g2, 'C32') === styleSig($template, 'C24') ? 'MATCH' : 'DIFF') . "\n";
    echo "  Male total row style (C20) vs template (C15): " . (styleSig($g2, 'C20') === styleSig($template, 'C15') ? 'MATCH' : 'DIFF') . "\n";
} finally {
    \DB::rollBack();
}
echo "Rolled back temp students.\n";

echo "\n=== ROW REMOVAL TEST: 3 male + 2 female students ===\n";
\DB::beginTransaction();
try {
    $course = Course::first();
    // remove all but 3 males / 2 females
    $keep = ['DAVID, LUKE THEO O.', 'MINA, KYRIE ERVIN P.', 'VILLANUEVA, ALDRIN E.', 'ALVARO, SHANE JOY C.', 'URBI, ASHLEY JOY C.'];
    Student::where('course_id', $course->id)->whereNotIn('name', $keep)->delete();
    $counts = Student::where('course_id', $course->id)->selectRaw("sum(gender='male') m, sum(gender='female') f")->first();
    echo "Kept: male={$counts->m} female={$counts->f}\n";

    $service = new SF2ExportService();
    $out = __DIR__ . '/SF2_Test_Export_Shrunk.xls';
    $service->generate($course, 8, 2026, ['adviser_name' => 'TEST ADVISER'], $out);

    $g3 = loadSheet($out);
    echo "Generated with 3M+2F: merges=" . count($g3->getMergeCells()) . "\n";
    for ($r = 8; $r <= 15; $r++) {
        $a = $g3->getCell("A$r")->getValue();
        $c = $g3->getCell("C$r")->getValue();
        if ($c) echo "  Row $r [A=$a]: " . substr((string)$c, 0, 50) . "\n";
    }
    // delta = 3+2+3-17 = -9 → guidelines at 25-9=16
    echo "  Guidelines (A16): " . substr((string)$g3->getCell('A16')->getValue(), 0, 40) . "\n";
    echo "  Month cell (AM16): " . $g3->getCell('AM16')->getValue() . "\n";
    echo "  Summary enrolment (AR18/AT18): " . $g3->getCell('AR18')->getValue() . "/" . $g3->getCell('AT18')->getValue() . "\n";
    echo "  School head (AN47): " . $g3->getCell('AN47')->getValue() . "\n";
    echo "  'Generated thru LIS' (Z48): " . $g3->getCell('Z48')->getValue() . "\n";
} finally {
    \DB::rollBack();
}
echo "Rolled back.\n";
