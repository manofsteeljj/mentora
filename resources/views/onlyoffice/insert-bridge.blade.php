{{--
    ONLYOFFICE "insert bridge" plugin page.

    ONLYOFFICE loads this page in a hidden iframe as an autostart plugin
    (see OnlyofficeInsertPluginController). The React AI sidebar sends the
    generated text here over postMessage; this page forwards it to the editor
    with the plugin PasteText method, which inserts it at the current cursor
    position.

    This runs inside the ONLYOFFICE editor iframe, so it must not rely on any
    script, style, or global from the parent Mentora page.
--}}
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Mentora Insert Bridge</title>
    <script type="text/javascript" src="{{ $onlyofficeUrl }}/sdkjs-plugins/v1/plugins.js"></script>
</head>
<body>
<script>
(function () {
    'use strict';

    // The Mentora page hosting the editor — this iframe's grandparent.
    var hostWindow = null;
    try { hostWindow = window.parent.parent; } catch (e) { /* cross-origin access */ }

    function sendToHost(message) {
        try { hostWindow && hostWindow.postMessage(message, '*'); } catch (e) { /* ignore */ }
    }

    // Announce ourselves to the sidebar once the ONLYOFFICE plugin API has
    // been injected into this iframe (it arrives asynchronously via eval).
    var announced = false;
    function announce() {
        if (announced) return;
        announced = true;
        sendToHost({ type: 'mentora:plugin-ready' });
    }

    // Standard plugin contract: the editor calls init() once the plugin is
    // loaded. OnlyOFFICE logs an error if it is missing.
    window.Asc.plugin.init = function () {
        announce();
    };

    // The init hook above can fire before the plugin API (executeMethod) has
    // been injected, and injection may also replace the plugin object — poll
    // until the API is actually usable, then announce if not done yet.
    var pluginApiPoll = setInterval(function () {
        if (window.Asc && window.Asc.plugin && typeof window.Asc.plugin.executeMethod === 'function') {
            clearInterval(pluginApiPoll);
            if (typeof window.Asc.plugin.init !== 'function') {
                window.Asc.plugin.init = function () { announce(); };
            }
            announce();
        }
    }, 200);
    // Give up eventually (editor closing, plugin rejected, …) — the sidebar
    // just keeps its insert button disabled in that case.
    setTimeout(function () { clearInterval(pluginApiPoll); }, 60000);

    // Handle "insert text" requests from the AI sidebar.
    window.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || typeof data !== 'object' || data.type !== 'mentora:insert') return;
        // Only accept commands from the Mentora page itself — the editor also
        // messages this iframe, but on its own origin.
        if (event.origin !== window.location.origin) return;

        function reply(ok, error) {
            try {
                event.source.postMessage({
                    type: 'mentora:insert-result',
                    reqId: data.reqId,
                    ok: !!ok,
                    error: error || null
                }, '*');
            } catch (e) { /* ignore */ }
        }

        if (typeof data.text !== 'string' || data.text.trim() === '') {
            reply(false, 'empty');
            return;
        }

        if (!(window.Asc && window.Asc.plugin && typeof window.Asc.plugin.executeMethod === 'function')) {
            reply(false, 'editor-not-ready');
            return;
        }

        try {
            // PasteText inserts plain text at the current cursor position —
            // like pasting, but without touching the clipboard.
            window.Asc.plugin.executeMethod('PasteText', [data.text]);
            reply(true);
        } catch (err) {
            reply(false, String(err && err.message || err));
        }
    });
})();
</script>
</body>
</html>
