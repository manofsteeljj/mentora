<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\Material;
use App\Models\Assessment;
use App\Models\Question;

$courses = Course::with(['materials','materials:id,course_id,title','materials:id,course_id,file_path'])->get();
if ($courses->isEmpty()) {
    echo "No courses found\n";
    exit(0);
}

foreach ($courses as $c) {
    echo "Course {$c->id}: {$c->course_name} ({$c->course_code})\n";
    $mats = Material::where('course_id', $c->id)->get();
    echo "  Materials (" . $mats->count() . "):\n";
    foreach ($mats as $m) {
        $len = $m->extracted_text ? mb_strlen($m->extracted_text) : 0;
        echo "    - Material {$m->id}: {$m->title} | file: {$m->file_path} | extracted_text_len={$len}\n";
    }

    $assess = Assessment::where('course_id', $c->id)->get();
    echo "  Assessments (" . $assess->count() . "):\n";
    foreach ($assess as $a) {
        $qCount = Question::where('assessment_id', $a->id)->count();
        echo "    - Assessment {$a->id}: {$a->title} | questions={$qCount}\n";
    }

    echo "\n";
}
