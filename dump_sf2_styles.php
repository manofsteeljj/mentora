<?php
require __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Border;

$path = __DIR__ . '/mockup/format/SF2_2026_Grade 6 - RIZAL.xls';
$reader = IOFactory::createReaderForFile($path);
$spreadsheet = $reader->load($path);
$sheet = $spreadsheet->getSheet(0);

function borderStr($b) {
    if (!$b) return '-';
    return $b->getBorderStyle() ?: '-';
}

$out = [];
$maxRow = $sheet->getHighestDataRow();
$maxColIdx = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($sheet->getHighestDataColumn());

for ($row = 1; $row <= $maxRow; $row++) {
    for ($col = 1; $col <= $maxColIdx; $col++) {
        $coord = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col) . $row;
        $style = $sheet->getStyle($coord);
        $font = $style->getFont();
        $align = $style->getAlignment();
        $borders = $style->getBorders();
        $fill = $style->getFill();
        $val = $sheet->getCell($coord)->getValue();

        $parts = [];
        $parts[] = 'font=' . $font->getName() . '/' . $font->getSize() . ($font->getBold() ? 'B' : '') . ($font->getItalic() ? 'I' : '');
        $parts[] = 'halign=' . $align->getHorizontal() . ',valign=' . $align->getVertical() . ',wrap=' . ($align->getWrapText() ? 1 : 0);
        $b = [];
        foreach (['top','bottom','left','right'] as $side) {
            $bs = borderStr($borders->{'get' . ucfirst($side)}());
            if ($bs !== '-') $b[] = substr($side,0,1) . ':' . $bs;
        }
        $parts[] = 'borders=' . ($b ? implode(',', $b) : 'none');
        if ($fill->getFillType() !== 'none') {
            $parts[] = 'fill=' . $fill->getFillType() . '/' . $fill->getStartColor()->getARGB();
        }
        if ($val !== null && $val !== '') {
            $parts[] = 'val="' . str_replace("\n", "\\n", (string)$val) . '"';
        }
        $out[] = $coord . ' | ' . implode(' | ', $parts);
    }
}

file_put_contents(__DIR__ . '/sf2_style_dump.txt', implode("\n", $out));
echo "Wrote " . count($out) . " cell styles\n";
