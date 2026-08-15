// Agonia Engine - AgoniaAudioRules
// System module: applies per-map auto-start audio rules (BGM/BGS2/BGS3)
// defined in the Audio Studio and stored in the `audio` section of
// data/AgoniaEngine.json (Map Rules). Ambient zones are NOT handled here -
// they are real map events with <aex> comments played by OcRam_Audio_EX.
/*:
 * @plugindesc Auto-start audio rules per map (engine system module, Audio Studio)
 * @author Agonia Engine
 *
 * @help
 * Loads with parameters merged from the AgoniaEngine.json `audio` section
 * by the engine bridge. Map Rules is a JSON string:
 *   [{"mapId":45,"bgm":{"name":"Theme","volume":90,"pitch":100,"pan":0},
 *     "bgs2":{"name":"rain","volume":80,"pitch":100,"pan":0},
 *     "bgs3":null}]
 * On Game_Map.setup the matching rule (first hit) is applied:
 *   bgm  -> AudioManager.playBgm (restarts the track, like a map autoplay)
 *   bgs2/bgs3 -> OcRam_Audio_EX generic channels via the live plugin
 *                command chain (play_bgs2/play_bgs3); no-ops if OcRam
 *                is absent.
 *
 * @param Map Rules
 * @type string
 * @default []
 */

(function () {
    'use strict';

    var params = PluginManager.parameters('AgoniaAudioRules');
    var rules = [];
    try {
        var parsed = JSON.parse(params['Map Rules'] || '[]');
        if (Array.isArray(parsed)) rules = parsed;
    } catch (e) { rules = []; }

    function num(v, d) {
        var n = Number(v);
        return isNaN(n) ? d : n;
    }

    function applyChannel(cfg, kind) {
        if (!cfg || !cfg.name) return;
        var name = String(cfg.name);
        var volume = num(cfg.volume, 100);
        var pitch = num(cfg.pitch, 100);
        var pan = num(cfg.pan, 0);
        if (kind === 'bgm') {
            if (typeof AudioManager !== 'undefined' && AudioManager.playBgm) {
                AudioManager.playBgm({ name: name, volume: volume, pitch: pitch, pan: pan });
            }
            return;
        }
        // BGS2/BGS3 live in OcRam_Audio_EX - call through the live chain.
        var command = kind === 'bgs2' ? 'play_bgs2' : 'play_bgs3';
        try {
            if (typeof Game_Interpreter !== 'undefined' &&
                Game_Interpreter.prototype.pluginCommand) {
                Game_Interpreter.prototype.pluginCommand(command,
                    [name, String(volume), String(pitch), String(pan)]);
            }
        } catch (e) { /* OcRam absent or renamed - rule is a no-op */ }
    }

    function applyRule(mapId) {
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (!rule || Number(rule.mapId) !== mapId) continue;
            applyChannel(rule.bgm, 'bgm');
            applyChannel(rule.bgs2, 'bgs2');
            applyChannel(rule.bgs3, 'bgs3');
            return;
        }
    }

    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function (mapId) {
        _Game_Map_setup.call(this, mapId);
        try { applyRule(Number(mapId)); } catch (e) { /* never break map load */ }
    };
})();
