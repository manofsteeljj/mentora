<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

/**
 * Serves the tiny ONLYOFFICE "insert bridge" plugin used by the AI sidebar's
 * "Insert into document" button.
 *
 * DocumentController::editor() registers this plugin in editorConfig.plugins,
 * so ONLYOFFICE loads it automatically while a document is open. The plugin
 * renders no UI: the React sidebar posts the AI response to the plugin iframe
 * (same origin as the app), and the plugin inserts it into the open document
 * via the plugin PasteText method — at the user's cursor, without touching
 * the clipboard.
 *
 * These routes are public because ONLYOFFICE fetches them from its own
 * cross-origin editor iframe, which does not carry the Mentora session cookie.
 */
class OnlyofficeInsertPluginController extends Controller
{
    // Plugin identifier — referenced by the autostart list in the editor config
    public const GUID = 'asc.{8F4C2D6E-9A1B-4E7D-B5C3-F0A2D8E64B17}';

    // Route prefix both endpoints live under
    public const PATH = 'plugins/mentora-insert';

    // ── GET /plugins/mentora-insert/config.json ────────────────────────────────

    public function config(): Response
    {
        $config = [
            'name'       => 'Mentora Insert Bridge',
            'guid'       => self::GUID,
            'version'    => '1.0.0',
            'minVersion' => '8.2.0',

            'variations' => [
                [
                    'description'    => 'Inserts Mentora AI responses into the document.',
                    'url'            => 'index.html',
                    'isViewer'       => false,
                    'isVisual'       => false,
                    'isModal'        => false,
                    'isInsideMode'   => false,
                    'initDataType'   => 'none',
                    'EditorsSupport' => ['word'],
                    'buttons'        => [],
                ],
            ],
        ];

        return response(json_encode($config), 200, [
            'Content-Type'                => 'application/json',
            // Fetched cross-origin by the ONLYOFFICE editor iframe
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    // ── GET /plugins/mentora-insert/index.html ─────────────────────────────────

    public function page(): Response
    {
        return response()->view('onlyoffice.insert-bridge', [
            'onlyofficeUrl' => rtrim((string) config('services.onlyoffice.url', 'http://localhost:8080'), '/'),
        ]);
    }
}
