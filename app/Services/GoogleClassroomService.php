<?php

namespace App\Services;

use App\Models\Course;
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
}
