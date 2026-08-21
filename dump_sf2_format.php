<?php
require __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

$path = __DIR__ . '/mockup/format/SF2_2026_Grade 6 - RIZAL.xls';
$reader = IOFactory::createReaderForFile($path);
$reader->setReadDataOnly(false);
$spreadsheet = $reader->load($path);

foreach ($spreadsheet->getAllSheets() as $sheetIndex => $sheet) {
    echo "=== SHEET {$sheetIndex}: " . $sheet->getTitle() . " ===\n";
    echo "Dimensions: " . $sheet->calculateWorksheetDimension() . "\n";
    echo "Default col width: " . $sheet->getDefaultColumnDimension()->getWidth() . "\n";
    echo "Default row height: " . $sheet->getDefaultRowDimension()->getRowHeight() . "\n";

    // Page setup
    $ps = $sheet->getPageSetup();
    echo "Orientation: " . $ps->getOrientation() . " | PaperSize: " . $ps->getPaperSize() . "\n";
    $pm = $sheet->getPageMargins();
    echo "Margins L/R/T/B: " . $pm->getLeft() . "/" . $pm->getRight() . "/" . $pm->getTop() . "/" . $pm->getBottom() . "\n";
    echo "PrintArea: " . var_export($sheet->getPageSetup()->getPrintArea(), true) . "\n";

    // Column widths
    echo "--- COLUMN WIDTHS ---\n";
    foreach ($sheet->getColumnDimensions() as $col => $dim) {
        echo $col . " => " . $dim->getWidth() . "\n";
    }

    // Row heights
    echo "--- ROW HEIGHTS ---\n";
    foreach ($sheet->getRowDimensions() as $row => $dim) {
        echo $row . " => " . $dim->getRowHeight() . "\n";
    }

    // Merged cells
    echo "--- MERGED CELLS ---\n";
    $merges = $sheet->getMergeCells();
    sort($merges);
    foreach ($merges as $m) {
        echo $m . "\n";
    }

    // Cell data
    echo "--- CELL DATA (non-empty) ---\n";
    $maxRow = $sheet->getHighestDataRow();
    $maxCol = $sheet->getHighestDataColumn();
    echo "MaxRow: {$maxRow} MaxCol: {$maxCol}\n";
    for ($row = 1; $row <= $maxRow; $row++) {
        for ($col = 1; $col <= \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($maxCol); $col++) {
            $coord = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col) . $row;
            $cell = $sheet->getCell($coord);
            $val = $cell->getValue();
            if ($val !== null && $val !== '') {
                echo "{$coord}: " . str_replace("\n", "\\n", (string)$val) . "\n";
            }
        }
    }
}
