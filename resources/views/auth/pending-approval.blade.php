<x-guest-layout>
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div class="w-full max-w-md">

            {{-- Logo / Brand --}}
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-green-700 rounded-2xl mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422A12.083 12.083 0 0121 13.5c0 2.485-4.03 4.5-9 4.5S3 15.985 3 13.5c0-.67.109-1.314.84-2.078L12 14z"/>
                    </svg>
                </div>
                <h1 class="text-2xl font-semibold text-gray-900">Mentora</h1>
            </div>

            {{-- Card --}}
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">

                {{-- Waiting icon --}}
                <div class="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>

                <h2 class="text-xl font-semibold text-gray-900 mb-2">Awaiting Approval</h2>
                <p class="text-gray-500 text-sm leading-relaxed mb-6">
                    Your account has been created and is currently pending administrator review.
                    You will be able to log in once an admin approves your registration.
                </p>

                {{-- Info box --}}
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
                    <p class="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">What happens next?</p>
                    <ul class="space-y-1.5 text-sm text-blue-700">
                        <li class="flex items-start gap-2">
                            <span class="mt-0.5 text-blue-400">1.</span>
                            The administrator reviews your registration.
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-0.5 text-blue-400">2.</span>
                            Once approved, you can log in with your credentials.
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-0.5 text-blue-400">3.</span>
                            If rejected, you will see a message on the login page.
                        </li>
                    </ul>
                </div>

                <a
                    href="{{ route('login') }}"
                    class="inline-flex items-center justify-center w-full px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    Back to Login
                </a>
            </div>

            <p class="text-center text-xs text-gray-400 mt-6">
                Questions? Contact your school administrator.
            </p>
        </div>
    </div>
</x-guest-layout>
