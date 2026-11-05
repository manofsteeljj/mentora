<div x-data="{ visible: false }" class="relative">
    <x-text-input
        {{ $attributes->merge(['class' => 'pr-14']) }}
        x-bind:type="visible ? 'text' : 'password'"
    />
    <button
        type="button"
        x-on:click="visible = !visible"
        x-bind:aria-label="visible ? 'Hide password' : 'Show password'"
        x-bind:aria-pressed="visible"
        class="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
    >
        <span x-text="visible ? 'Hide' : 'Show'">Show</span>
    </button>
</div>
