<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Material;
use Smalot\PdfParser\Parser;
use Illuminate\Support\Facades\Log;

echo "Starting re-extraction of materials...\n";

$materials = Material::all();
if ($materials->isEmpty()) {
    echo "No materials found.\n";
    exit(0);
}

$parser = new Parser();
$count = 0;
foreach ($materials as $m) {
    $path = storage_path('app/public/' . $m->file_path);
    if (!file_exists($path)) {
        echo "File missing for material {$m->id}: {$path}\n";
        continue;
    }

    try {
        $pdf = $parser->parseFile($path);
        $text = $pdf->getText();
        $m->extracted_text = $text;
        $m->save();
        $count++;
        echo "Extracted material {$m->id}\n";
    } catch (\Throwable $e) {
        echo "Failed to extract material {$m->id}: " . $e->getMessage() . "\n";
        Log::error('reextract failed', ['id' => $m->id, 'error' => $e->getMessage()]);
    }
}

echo "Done. Extracted texts for {$count} materials.\n";
