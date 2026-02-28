<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Student;
use App\Models\Assessment;
use App\Models\Submission;
use App\Models\User;
use Google\Client as GoogleClient;
use Google\Service\Classroom as GoogleClassroom;
use Illuminate\Support\Facades\Log;

class GoogleClassroomService
{
    protected GoogleClient $client;
    protected GoogleClassroom $classroom;
    protected User $user;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->client = new GoogleClient();
        $this->client->setClientId(config('services.google.client_id'));
        $this->client->setClientSecret(config('services.google.client_secret'));
        $this->client->setAccessToken($user->google_token);

        // Handle token refresh
        if ($this->client->isAccessTokenExpired() && $user->google_refresh_token) {
            $newToken = $this->client->fetchAccessTokenWithRefreshToken($user->google_refresh_token);

            if (!isset($newToken['error'])) {
                $user->update([
                    'google_token'         => $newToken['access_token'],
                    'google_refresh_token' => $newToken['refresh_token'] ?? $user->google_refresh_token,
                ]);
                $this->client->setAccessToken($newToken['access_token']);
            } else {
                Log::error('Google token refresh failed', $newToken);
                throw new \Exception('Google token expired. Please re-authenticate.');
            }
        }

        $this->classroom = new GoogleClassroom($this->client);
    }

    /**
     * Fetch all courses from Google Classroom where user is a teacher.
     */
    public function listCourses(): array
    {
        $courses = [];
        $pageToken = null;

        do {
            $params = [
                'teacherId' => 'me',
                'pageSize'  => 100,
            ];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            $response = $this->classroom->courses->listCourses($params);

            if ($response->getCourses()) {
                foreach ($response->getCourses() as $course) {
                    $courses[] = [
                        'id'          => $course->getId(),
                        'name'        => $course->getName(),
                        'section'     => $course->getSection(),
                        'room'        => $course->getRoom(),
                        'description' => $course->getDescriptionHeading() ?: $course->getDescription(),
                        'status'      => $course->getCourseState(),
                        'enrollCode'  => $course->getEnrollmentCode(),
                        'link'        => $course->getAlternateLink(),
                    ];
                }
            }

            $pageToken = $response->getNextPageToken();
        } while ($pageToken);

        return $courses;
    }

    /**
     * Import all Google Classroom courses into the local database.
     * Uses upsert logic — updates existing, creates new.
     */
    public function importCourses(): array
    {
        $googleCourses = $this->listCourses();
        $imported = [];
        $updated  = [];

        foreach ($googleCourses as $gc) {
            $existing = Course::where('google_classroom_id', $gc['id'])
                ->where('user_id', $this->user->id)
                ->first();

            // Derive a course code from the enrollment code or name
            $courseCode = $gc['enrollCode']
                ?: strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $gc['name']), 0, 10));

            $data = [
                'user_id'             => $this->user->id,
                'google_classroom_id' => $gc['id'],
                'course_code'         => $courseCode,
                'course_name'         => $gc['name'],
                'description'         => $gc['description'] ?? null,
                'section'             => $gc['section'] ?? null,
                'room'                => $gc['room'] ?? null,
                'status'              => $gc['status'] ?? 'ACTIVE',
                'last_synced_at'      => now(),
            ];

            if ($existing) {
                $existing->update($data);
                $updated[] = $existing;
            } else {
                $course = Course::create($data);
                $imported[] = $course;
            }
        }

        Log::info('Google Classroom import', [
            'user_id'  => $this->user->id,
            'imported' => count($imported),
            'updated'  => count($updated),
            'total'    => count($googleCourses),
        ]);

        return [
            'imported' => $imported,
            'updated'  => $updated,
            'total'    => count($googleCourses),
        ];
    }

    /**
     * Get students enrolled in a specific Google Classroom course.
     */
    public function listStudents(string $courseId): array
    {
        $students = [];
        $pageToken = null;

        do {
            $params = ['pageSize' => 100];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            try {
                $response = $this->classroom->courses_students->listCoursesStudents($courseId, $params);

                if ($response->getStudents()) {
                    foreach ($response->getStudents() as $student) {
                        $profile = $student->getProfile();
                        $name = $profile ? $profile->getName() : null;
                        $students[] = [
                            'userId'   => $student->getUserId(),
                            'name'     => $name ? $name->getFullName() : 'Unknown',
                            'email'    => $profile ? $profile->getEmailAddress() : null,
                            'photoUrl' => $profile ? $profile->getPhotoUrl() : null,
                        ];
                    }
                }

                $pageToken = $response->getNextPageToken();
            } catch (\Exception $e) {
                Log::warning('Failed to fetch students for course ' . $courseId, ['error' => $e->getMessage()]);
                break;
            }
        } while ($pageToken);

        return $students;
    }

    /**
     * Import students from Google Classroom for a specific course.
     * Upserts by google_classroom_id.
     */
    public function importStudents(string $googleCourseId, int $localCourseId): array
    {
        $googleStudents = $this->listStudents($googleCourseId);
        $imported = 0;
        $updated  = 0;

        foreach ($googleStudents as $gs) {
            $existing = Student::where('google_classroom_id', $gs['userId'])
                ->where('course_id', $localCourseId)
                ->first();

            $data = [
                'course_id'            => $localCourseId,
                'google_classroom_id'  => $gs['userId'],
                'student_number'       => $gs['userId'],          // Use Google userId as student ID
                'name'                 => $gs['name'],
                'email'                => $gs['email'],
                'photo_url'            => $gs['photoUrl'],
            ];

            if ($existing) {
                $existing->update($data);
                $updated++;
            } else {
                Student::create($data);
                $imported++;
            }
        }

        // Update last_synced_at on the course
        Course::where('id', $localCourseId)->update(['last_synced_at' => now()]);

        Log::info('Google Classroom students imported', [
            'course_id'       => $localCourseId,
            'google_course_id' => $googleCourseId,
            'imported'        => $imported,
            'updated'         => $updated,
            'total'           => count($googleStudents),
        ]);

        return [
            'imported' => $imported,
            'updated'  => $updated,
            'total'    => count($googleStudents),
        ];
    }

    /**
     * Fetch coursework (assignments) for a Google Classroom course.
     */
    public function listCoursework(string $courseId): array
    {
        $coursework = [];
        $pageToken = null;

        do {
            $params = ['pageSize' => 100];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            try {
                $response = $this->classroom->courses_courseWork->listCoursesCourseWork($courseId, $params);

                if ($response->getCourseWork()) {
                    foreach ($response->getCourseWork() as $cw) {
                        $dueDate = null;
                        if ($cw->getDueDate()) {
                            $d = $cw->getDueDate();
                            $dueDate = sprintf('%04d-%02d-%02d', $d->getYear(), $d->getMonth(), $d->getDay());
                        }

                        $coursework[] = [
                            'id'          => $cw->getId(),
                            'title'       => $cw->getTitle(),
                            'description' => $cw->getDescription(),
                            'state'       => $cw->getState(),
                            'maxPoints'   => $cw->getMaxPoints(),
                            'dueDate'     => $dueDate,
                            'workType'    => $cw->getWorkType(),
                            'creationTime' => $cw->getCreationTime(),
                        ];
                    }
                }

                $pageToken = $response->getNextPageToken();
            } catch (\Exception $e) {
                Log::warning('Failed to fetch coursework for course ' . $courseId, ['error' => $e->getMessage()]);
                break;
            }
        } while ($pageToken);

        return $coursework;
    }

    /**
     * Import coursework as assessments for a specific course.
     */
    public function importCoursework(string $googleCourseId, int $localCourseId): array
    {
        $googleCoursework = $this->listCoursework($googleCourseId);
        $imported = 0;
        $updated  = 0;

        foreach ($googleCoursework as $gcw) {
            $existing = Assessment::where('google_classroom_id', $gcw['id'])
                ->where('course_id', $localCourseId)
                ->first();

            $data = [
                'course_id'            => $localCourseId,
                'google_classroom_id'  => $gcw['id'],
                'title'                => $gcw['title'],
                'description'          => $gcw['description'],
                'instructions'         => $gcw['description'],
                'max_points'           => $gcw['maxPoints'],
                'due_date'             => $gcw['dueDate'],
                'state'                => $gcw['state'],
            ];

            if ($existing) {
                $existing->update($data);
                $updated++;
            } else {
                Assessment::create($data);
                $imported++;
            }
        }

        Log::info('Google Classroom coursework imported', [
            'course_id'        => $localCourseId,
            'google_course_id' => $googleCourseId,
            'imported'         => $imported,
            'updated'          => $updated,
        ]);

        return ['imported' => $imported, 'updated' => $updated, 'total' => count($googleCoursework)];
    }

    /**
     * Fetch student submissions for a specific coursework item.
     */
    public function listStudentSubmissions(string $courseId, string $courseworkId): array
    {
        $submissions = [];
        $pageToken = null;

        do {
            $params = ['pageSize' => 100];
            if ($pageToken) {
                $params['pageToken'] = $pageToken;
            }

            try {
                $response = $this->classroom->courses_courseWork_studentSubmissions
                    ->listCoursesCourseWorkStudentSubmissions($courseId, $courseworkId, $params);

                if ($response->getStudentSubmissions()) {
                    foreach ($response->getStudentSubmissions() as $sub) {
                        $submissions[] = [
                            'id'             => $sub->getId(),
                            'userId'         => $sub->getUserId(),
                            'state'          => $sub->getState(),
                            'late'           => $sub->getLate() ?? false,
                            'assignedGrade'  => $sub->getAssignedGrade(),
                            'draftGrade'     => $sub->getDraftGrade(),
                            'creationTime'   => $sub->getCreationTime(),
                            'updateTime'     => $sub->getUpdateTime(),
                        ];
                    }
                }

                $pageToken = $response->getNextPageToken();
            } catch (\Exception $e) {
                Log::warning("Failed to fetch submissions for coursework {$courseworkId}", ['error' => $e->getMessage()]);
                break;
            }
        } while ($pageToken);

        return $submissions;
    }

    /**
     * Import student submissions from Google Classroom for a specific assessment.
     */
    public function importSubmissions(string $googleCourseId, string $googleCourseworkId, int $localAssessmentId, int $localCourseId): array
    {
        $googleSubs = $this->listStudentSubmissions($googleCourseId, $googleCourseworkId);
        $imported = 0;
        $updated  = 0;

        foreach ($googleSubs as $gs) {
            // Map Google userId to local student
            $student = Student::where('google_classroom_id', $gs['userId'])
                ->where('course_id', $localCourseId)
                ->first();

            if (!$student) continue; // Skip if student not synced yet

            $existing = Submission::where('google_classroom_id', $gs['id'])
                ->where('assessment_id', $localAssessmentId)
                ->first();

            // Determine submission status
            $state = $gs['state']; // NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT

            $data = [
                'student_id'           => $student->id,
                'assessment_id'        => $localAssessmentId,
                'google_classroom_id'  => $gs['id'],
                'state'                => $state,
                'assigned_grade'       => $gs['assignedGrade'],
                'draft_grade'          => $gs['draftGrade'],
                'late'                 => $gs['late'],
                'submitted_at'         => $gs['updateTime'],
            ];

            if ($existing) {
                $existing->update($data);
                $updated++;
            } else {
                Submission::create($data);
                $imported++;
            }
        }

        return ['imported' => $imported, 'updated' => $updated, 'total' => count($googleSubs)];
    }

    /**
     * Full sync — import courses, students, coursework, and submissions.
     * Returns comprehensive results.
     */
    public function syncAll(): array
    {
        $courseResult = $this->importCourses();

        $studentResults = [];
        $totalStudentsImported = 0;
        $totalStudentsUpdated  = 0;

        // Get all courses with google_classroom_id
        $courses = Course::where('user_id', $this->user->id)
            ->whereNotNull('google_classroom_id')
            ->get();

        foreach ($courses as $course) {
            try {
                $result = $this->importStudents($course->google_classroom_id, $course->id);
                $totalStudentsImported += $result['imported'];
                $totalStudentsUpdated  += $result['updated'];
                $studentResults[$course->course_code] = $result;
            } catch (\Exception $e) {
                Log::warning('Failed to sync students for course ' . $course->course_code, [
                    'error' => $e->getMessage(),
                ]);
                $studentResults[$course->course_code] = [
                    'error' => $e->getMessage(),
                ];
            }
        }

        // Sync coursework (assessments) and submissions for each course
        $courseworkResults = [];
        $submissionResults = [];
        $totalCourseworkImported   = 0;
        $totalCourseworkUpdated    = 0;
        $totalSubmissionsImported  = 0;
        $totalSubmissionsUpdated   = 0;

        foreach ($courses as $course) {
            try {
                $cwResult = $this->importCoursework($course->google_classroom_id, $course->id);
                $totalCourseworkImported += $cwResult['imported'];
                $totalCourseworkUpdated  += $cwResult['updated'];
                $courseworkResults[$course->course_code] = $cwResult;

                // Now sync submissions for each assessment in this course
                $assessments = Assessment::where('course_id', $course->id)
                    ->whereNotNull('google_classroom_id')
                    ->get();

                foreach ($assessments as $assessment) {
                    try {
                        $subResult = $this->importSubmissions(
                            $course->google_classroom_id,
                            $assessment->google_classroom_id,
                            $assessment->id,
                            $course->id
                        );
                        $totalSubmissionsImported += $subResult['imported'];
                        $totalSubmissionsUpdated  += $subResult['updated'];
                    } catch (\Exception $e) {
                        Log::warning("Failed to sync submissions for assessment {$assessment->title}", [
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            } catch (\Exception $e) {
                Log::warning('Failed to sync coursework for course ' . $course->course_code, [
                    'error' => $e->getMessage(),
                ]);
                $courseworkResults[$course->course_code] = ['error' => $e->getMessage()];
            }
        }

        // Update user's last synced timestamp
        $this->user->update(['last_synced_at' => now()]);

        Log::info('Full Google Classroom sync completed', [
            'user_id'              => $this->user->id,
            'courses_imported'     => count($courseResult['imported']),
            'courses_updated'      => count($courseResult['updated']),
            'students_imported'    => $totalStudentsImported,
            'students_updated'     => $totalStudentsUpdated,
            'coursework_imported'  => $totalCourseworkImported,
            'coursework_updated'   => $totalCourseworkUpdated,
            'submissions_imported' => $totalSubmissionsImported,
            'submissions_updated'  => $totalSubmissionsUpdated,
        ]);

        return [
            'courses' => [
                'imported' => count($courseResult['imported']),
                'updated'  => count($courseResult['updated']),
                'total'    => $courseResult['total'],
            ],
            'students' => [
                'imported' => $totalStudentsImported,
                'updated'  => $totalStudentsUpdated,
                'details'  => $studentResults,
            ],
            'coursework' => [
                'imported' => $totalCourseworkImported,
                'updated'  => $totalCourseworkUpdated,
                'details'  => $courseworkResults,
            ],
            'submissions' => [
                'imported' => $totalSubmissionsImported,
                'updated'  => $totalSubmissionsUpdated,
            ],
            'synced_at' => now()->toISOString(),
        ];
    }
}
