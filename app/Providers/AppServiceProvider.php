<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use App\Services\LessonPlanService;
use App\Services\AI\LLMService;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(LLMService::class, fn() => new LLMService());
        $this->app->singleton(LessonPlanService::class, fn($app) => new LessonPlanService($app->make(LLMService::class)));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (!app()->environment('production')) {
            return;
        }

        $appUrl = (string) config('app.url', '');
        if ($appUrl !== '') {
            $appHost = parse_url($appUrl, PHP_URL_HOST);
            if (!in_array($appHost, ['localhost', '127.0.0.1'], true)) {
                URL::forceRootUrl($appUrl);
            }
        }

        // Render terminates TLS at the edge; force generated links/assets to HTTPS.
        if (env('FORCE_HTTPS', true)) {
            URL::forceScheme('https');
        }
    }
}
