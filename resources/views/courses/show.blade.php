@extends('layouts.app')

@section('content')
<div class="container">
    <h1>{{ $course->course_name }} ({{ $course->course_code }})</h1>
    <p>{{ $course->description }}</p>

    <h2>Upload Material</h2>
    @if(session('status'))
        <div class="alert alert-success">{{ session('status') }}</div>
    @endif
    <form action="{{ route('courses.materials.store', $course) }}" method="POST" enctype="multipart/form-data">
        @csrf

        <div class="mb-3">
            <label for="title" class="form-label">Title</label>
            <input id="title" name="title" type="text" class="form-control" required>
        </div>

        <div class="mb-3">
            <label for="file" class="form-label">File (PDF only)</label>
            <input id="file" name="file" type="file" accept="application/pdf" class="form-control" required>
        </div>

        <button type="submit" class="btn btn-primary">Upload</button>
    </form>

    <h2 class="mt-4">Materials</h2>
    @if($course->materials && $course->materials->count())
        <ul>
            @foreach($course->materials as $material)
                <li>
                    <a href="{{ route('courses.materials.show', [$course, $material]) }}">{{ $material->title }}</a>
                    <form action="{{ route('courses.materials.destroy', [$course, $material]) }}" method="POST" style="display:inline">
                        @csrf
                        @method('DELETE')
                        <button class="btn btn-sm btn-danger">Delete</button>
                    </form>
                </li>
            @endforeach
        </ul>
        <form action="{{ route('ai.generateForCourse', ['course' => $course->id]) }}" method="POST" class="mt-3">
            @csrf
            <p>This will create a temporary assessment using the latest uploaded material for this course and generate questions (RAG).</p>
            <button class="btn btn-warning">Generate Questions for Course (temporary)</button>
        </form>
    @else
        <p>No materials yet.</p>
    @endif
</div>
@endsection
