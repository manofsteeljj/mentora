<x-guest-layout>
    <div
        id="react-recovery-password-root"
        data-props="{{ json_encode([
            'status' => session('status'),
            'errors' => $errors->getMessages(),
            'email' => old('email', ''),
        ]) }}"
    >
        <div class="flex min-h-screen items-center justify-center text-sm text-gray-500">
            Loading account recovery…
        </div>
    </div>
</x-guest-layout>
