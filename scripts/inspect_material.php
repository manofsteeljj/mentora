<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Material;

$m = Material::where('course_id', 4)->first();
if (! $m) {
    echo "No material found for course_id=4\n";
    exit(0);
}

echo "Material id: {$m->id}\n";
echo "file_path: {$m->file_path}\n";
$len = $m->extracted_text ? mb_strlen($m->extracted_text) : 0;
echo "extracted_text length: {$len}\n";
if ($len > 0) {
    $preview = mb_substr($m->extracted_text, 0, 500);
    // remove non-printable/control characters
    $preview = preg_replace('/[\x00-\x1F\x7F]/u', '', $preview);
    echo "preview:\n" . $preview . "\n";
}
