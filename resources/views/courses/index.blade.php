@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Your Courses</h1>
    <a href="{{ route('courses.create') }}" class="btn btn-primary mb-3">Create Course</a>

    @if($courses->count())
        <ul>
            @foreach($courses as $c)
                <li><a href="{{ route('courses.show', $c) }}">{{ $c->course_name }} ({{ $c->course_code }})</a></li>
            @endforeach
        </ul>
    @else
        <p>No courses yet.</p>
    @endif
</div>
@endsection
