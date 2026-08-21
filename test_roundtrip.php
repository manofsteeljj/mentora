<?php
require __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

$path = __DIR__ . '/mockup/format/SF2_2026_Grade 6 - RIZAL.xls';

// Test 1: round-trip load + save as Xls
$reader = IOFactory::createReaderForFile($path);
$ss = $reader->load($path);
$writer = new \PhpOffice\PhpSpreadsheet\Writer\Xls($ss);
$writer->save(__DIR__ . '/test_roundtrip_output.xls');
echo "Round-trip saved OK\n";

// Test 2: verify round-trip fidelity — reload and compare merges + widths + heights
$ss2 = IOFactory::createReaderForFile(__DIR__ . '/test_roundtrip_output.xls')->load(__DIR__ . '/test_roundtrip_output.xls');
$s1 = $ss->getSheet(0);
$s2 = $ss2->getSheet(0);

$m1 = $s1->getMergeCells(); sort($m1);
$m2 = $s2->getMergeCells(); sort($m2);
echo "Merges: orig=" . count($m1) . " roundtrip=" . count($m2) . " identical=" . ($m1 == $m2 ? 'YES' : 'NO') . "\n";
if ($m1 != $m2) {
    $only1 = array_diff($m1, $m2); $only2 = array_diff($m2, $m1);
    echo "  Only in orig (" . count($only1) . "): " . implode(',', array_slice($only1, 0, 10)) . "\n";
    echo "  Only in rt (" . count($only2) . "): " . implode(',', array_slice($only2, 0, 10)) . "\n";
}

$w1 = []; foreach ($s1->getColumnDimensions() as $c => $d) { $w1[$c] = $d->getWidth(); }
$w2 = []; foreach ($s2->getColumnDimensions() as $c => $d) { $w2[$c] = $d->getWidth(); }
echo "ColWidths identical: " . ($w1 == $w2 ? 'YES' : 'NO') . "\n";
if ($w1 != $w2) {
    foreach ($w1 as $c => $w) { if (($w2[$c] ?? null) != $w) echo "  $c: $w vs " . ($w2[$c] ?? 'MISSING') . "\n"; }
}

$h1 = []; foreach ($s1->getRowDimensions() as $r => $d) { $h1[$r] = $d->getRowHeight(); }
$h2 = []; foreach ($s2->getRowDimensions() as $r => $d) { $h2[$r] = $d->getRowHeight(); }
echo "RowHeights identical: " . ($h1 == $h2 ? 'YES' : 'NO') . "\n";
if ($h1 != $h2) {
    foreach ($h1 as $r => $h) { if (($h2[$r] ?? null) != $h) echo "  Row $r: $h vs " . ($h2[$r] ?? 'MISSING') . "\n"; }
    foreach ($h2 as $r => $h) { if (!isset($h1[$r])) echo "  Row $r extra in rt: $h\n"; }
}

// Test 3: insert 3 rows before row 25 — do merges/heights below shift?
$ss3 = IOFactory::createReaderForFile($path)->load($path);
$s3 = $ss3->getSheet(0);
$s3->insertNewRowBefore(25, 3);
$m3 = $s3->getMergeCells();
echo "After insert 3 rows @25: merges=" . count($m3) . "\n";
echo "  A26:X29 still present (should be gone/shifted): " . (in_array('A26:X29', $m3) ? 'STILL THERE (BAD)' : 'shifted OK') . "\n";
echo "  A29:X32 present (shifted +3): " . (in_array('A29:X32', $m3) ? 'YES' : 'NO') . "\n";
$hd3 = [];
foreach ($s3->getRowDimensions() as $r => $d) { $hd3[$r] = $d->getRowHeight(); }
echo "  Row heights after shift: row26=" . ($hd3[26] ?? 'none') . " (orig row26=10, expect 10 if shifted... orig 26 => 10) row29=" . ($hd3[29] ?? 'none') . " (orig 29=5) row32=" . ($hd3[32] ?? 'none') . " (orig 32=10)\n";

// Test 4: remove 3 rows at 22
$ss4 = IOFactory::createReaderForFile($path)->load($path);
$s4 = $ss4->getSheet(0);
$s4->removeRow(22, 3);
$m4 = $s4->getMergeCells();
echo "After remove 3 rows @22: merges=" . count($m4) . "\n";
echo "  A26:X29 shifted to A23:X26: " . (in_array('A23:X26', $m4) ? 'YES' : 'NO') . "\n";
$hd4 = [];
foreach ($s4->getRowDimensions() as $r => $d) { $hd4[$r] = $d->getRowHeight(); }
echo "  Row heights: row23=" . ($hd4[23] ?? 'none') . " (orig 26=10) row26=" . ($hd4[26] ?? 'none') . " (orig 29=5)\n";
