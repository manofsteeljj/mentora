@extends('layouts.app')

@section('content')
<div class="container">
    <h1>Assessment #{{ $assessment->id }} @if($assessment->title) - {{ $assessment->title }} @endif</h1>

    @if(isset($material) && $material)
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">Material: {{ $material->title ?? 'Untitled' }}</h5>
                <p class="card-text">{{ Str::limit(strip_tags($material->extracted_text ?? ''), 400) }}</p>
            </div>
        </div>
    @endif

    <h3>Questions ({{ $assessment->questions->count() }})</h3>
    @if($assessment->questions->isEmpty())
        <p>No questions yet.</p>
    @else
        <div class="list-group">
            @foreach($assessment->questions as $question)
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">Q{{ $question->id }} ({{ strtoupper($question->question_type) }})</h5>
                        <small>{{ $question->created_at ? $question->created_at->diffForHumans() : '' }}</small>
                    </div>
                    <p class="mb-1">{!! nl2br(e($question->question_text)) !!}</p>
                    @if(isset($question->options) && is_array($question->options))
                        <ul>
                            @foreach($question->options as $opt)
                                <li>{{ $opt }}</li>
                            @endforeach
                        </ul>
                    @endif
                </div>
            @endforeach
        </div>
    @endif
</div>
@endsection
