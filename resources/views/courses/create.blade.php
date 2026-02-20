@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Create Course</h1>

    @if ($errors->any())
        <div class="alert alert-danger">
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('courses.store') }}">
        @csrf

        <div class="mb-3">
            <label for="course_code" class="form-label">Course Code</label>
            <input id="course_code" name="course_code" type="text" class="form-control" required>
        </div>

        <div class="mb-3">
            <label for="course_name" class="form-label">Course Name</label>
            <input id="course_name" name="course_name" type="text" class="form-control" required>
        </div>

        <div class="mb-3">
            <label for="description" class="form-label">Description</label>
            <textarea id="description" name="description" class="form-control"></textarea>
        </div>

        <div class="mb-3">
            <label for="academic_term" class="form-label">Academic Term</label>
            <input id="academic_term" name="academic_term" type="text" class="form-control">
        </div>

        <button type="submit" class="btn btn-primary">Create Course</button>
    </form>
</div>
@endsection
