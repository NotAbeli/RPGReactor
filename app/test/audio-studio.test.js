const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// AudioStudioZones is a browser-global class using window.require for fs/path.
global.window = { require: name => (name === 'fs' ? fs : name === 'path' ? path : null) };
const AudioStudioZones = require('../src/AudioStudioZones.js');

function tempProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-studio-'));
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'MapInfos.json'),
        JSON.stringify([null, { id: 1, name: 'Forest' }, { id: 2, name: 'Bunker' }]));
    return dir;
}

function makeMap() {
    const AEX = '<aex:d:25+2:3:pan:default:link>';
    return {
        events: [
            null,
            {
                id: 1, name: 'campfire', x: 3, y: 4,
                pages: [{
                    list: [
                        { code: 108, indent: 0, parameters: ['comment before', AEX] },
                        { code: 245, indent: 0, parameters: [{ name: 'Fire', volume: 80, pitch: 100, pan: 0 }] },
                        { code: 0, indent: 0, parameters: [] }
                    ]
                }]
            },
            {
                id: 2, name: 'complex source', x: 8, y: 9,
                pages: [{
                    list: [
                        { code: 108, indent: 0, parameters: [AEX] },
                        { code: 245, indent: 0, parameters: [{ name: 'Wind', volume: 40, pitch: 100, pan: 0 }] },
                        { code: 101, indent: 0, parameters: [] }, // extra logic
                        { code: 0, indent: 0, parameters: [] }
                    ]
                }]
            }
        ]
    };
}

function writeMap(dir, mapId, map) {
    fs.writeFileSync(path.join(dir, 'data', 'Map' + String(mapId).padStart(3, '0') + '.json'),
        JSON.stringify(map));
}

test('aex parse/encode round-trips the OcRam format', () => {
    const aex = AudioStudioZones.parseAex('d:25+2:3:pan:default:link');
    assert.strictEqual(aex.type, 'd');
    assert.strictEqual(aex.distance, 25);
    assert.strictEqual(aex.radius, 2);
    assert.strictEqual(aex.fade, 3);
    assert.strictEqual(aex.pan, true);
    assert.strictEqual(aex.forced, false);
    assert.strictEqual(aex.isNew, false);
    assert.strictEqual(AudioStudioZones.encodeAex(aex), '<aex:d:25+2:3:pan:default:link>');
    // Defaults mirror the plugin parameters.
    const def = AudioStudioZones.parseAex('');
    assert.strictEqual(def.type, 'd');
    assert.strictEqual(def.distance, 20);
    assert.ok(def.pan && def.forced && def.isNew);
});

test('scanZones finds zones and flags hand-authored ones read-only', () => {
    const dir = tempProject();
    try {
        writeMap(dir, 1, makeMap());
        const zones = AudioStudioZones.scanZones(dir, 1);
        assert.strictEqual(zones.length, 2);
        const fire = zones.find(z => z.eventId === 1);
        assert.ok(fire.editable, 'simple zone is editable');
        assert.strictEqual(fire.bgs.name, 'Fire');
        assert.strictEqual(fire.bgs.volume, 80);
        assert.strictEqual(fire.aex.distance, 25);
        assert.strictEqual(fire.aex.forced, false);
        const wind = zones.find(z => z.eventId === 2);
        assert.ok(!wind.editable, 'zone with extra commands is read-only');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('applyEdits updates, adds and removes zone events', () => {
    const dir = tempProject();
    try {
        writeMap(dir, 1, makeMap());
        const report = AudioStudioZones.applyEdits(dir, 1, {
            updates: [{
                eventId: 1, x: 5, y: 6,
                aex: { type: 'bg', distance: 0, radius: 0, fade: 5, pan: false, forced: true, isNew: true },
                bgs: { name: 'Rain', volume: 70, pitch: 90, pan: 10 }
            }],
            removals: [2],
            additions: [{
                x: 1, y: 2,
                aex: { type: 'd', distance: 15, radius: 1, fade: 2, pan: true, forced: true, isNew: true },
                bgs: { name: 'Crickets', volume: 50, pitch: 100, pan: 0 }
            }]
        });
        assert.strictEqual(report.updated, 1);
        assert.strictEqual(report.removed, 1);
        assert.strictEqual(report.added, 1);
        assert.strictEqual(report.errors.length, 0);

        const zones = AudioStudioZones.scanZones(dir, 1);
        assert.strictEqual(zones.length, 2, 'one updated + one added');
        const rain = zones.find(z => z.bgs.name === 'Rain');
        assert.ok(rain, 'updated zone persists');
        assert.strictEqual(rain.x, 5);
        assert.strictEqual(rain.aex.type, 'bg');
        assert.strictEqual(rain.aex.pan, false);
        const crickets = zones.find(z => z.bgs.name === 'Crickets');
        assert.ok(crickets, 'added zone persists');
        assert.strictEqual(crickets.aex.distance, 15);
        // The freed id from the removed zone may be reused (RPG Maker
        // semantics); ids must stay unique.
        const ids = zones.map(z => z.eventId);
        assert.strictEqual(new Set(ids).size, ids.length, 'zone event ids unique');
        // Rejected: updating a read-only zone.
        const rep2 = AudioStudioZones.applyEdits(dir, 1, {
            updates: [{ eventId: crickets.eventId + 100, aex: crickets.aex, bgs: crickets.bgs }],
            removals: [], additions: []
        });
        assert.strictEqual(rep2.errors.length, 1);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('listMaps reads MapInfos', () => {
    const dir = tempProject();
    try {
        const maps = AudioStudioZones.listMaps(dir);
        assert.strictEqual(maps.length, 2);
        assert.strictEqual(maps[0].name, 'Forest');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
