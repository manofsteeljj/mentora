@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Materials for {{ $courseLabel ?? 'Course' }}</h1>

    @if($materials->count())
        <ul>
            @foreach($materials as $m)
                <li><a href="{{ route('courses.materials.show', [$courseId, $m->id]) }}">{{ $m->title }}</a></li>
            @endforeach
        </ul>
    @else
        <p>No materials uploaded.</p>
    @endif
</div>
@endsection
