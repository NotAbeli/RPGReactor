/**
 * AudioStudioZones - ambient zone plumbing for the Audio Studio.
 *
 * Zones are REAL map events in the OcRam_Audio_EX format: a comment
 * <aex:type:distance+radius:fade:pan:forced:new> followed by a Play BGS
 * command (code 245). The runtime is not touched - OcRam plays them as it
 * always has. This module only scans, edits and generates that event JSON.
 *
 * A zone event is "editable" when its page list contains nothing besides
 * the aex comment lines, one Play BGS command and the list enders - hand
 * authored sources with extra logic are shown read-only.
 */
class AudioStudioZones {
    static get AEX_RE() { return /<aex:([^>]*)>/i; }

    /** [{id, name}] from data/MapInfos.json. */
    static listMaps(projectPath) {
        const fs = window.require('fs');
        const path = window.require('path');
        try {
            const file = path.join(projectPath, 'data', 'MapInfos.json');
            const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
            const out = [];
            for (const info of raw) {
                if (info && info.id) out.push({ id: info.id, name: String(info.name || ('Map' + info.id)) });
            }
            return out.sort((a, b) => a.id - b.id);
        } catch (e) {
            return [];
        }
    }

    static mapFile(projectPath, mapId) {
        const path = window.require('path');
        return path.join(projectPath, 'data', 'Map' + String(mapId).padStart(3, '0') + '.json');
    }

    static readMap(projectPath, mapId) {
        const fs = window.require('fs');
        return JSON.parse(fs.readFileSync(AudioStudioZones.mapFile(projectPath, mapId), 'utf8'));
    }

    static writeMap(projectPath, mapId, map) {
        const fs = window.require('fs');
        const path = window.require('path');
        const file = AudioStudioZones.mapFile(projectPath, mapId);
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(map), 'utf8');
        try { fs.renameSync(tmp, file); }
        catch (e) { fs.unlinkSync(tmp); throw e; }
    }

    /**
     * Parse an aex comment body "d:20+0:2:pan:forced:new" (tolerant).
     * Defaults mirror the OcRam plugin parameters.
     */
    static parseAex(body) {
        const aex = {
            type: 'd', distance: 20, radius: 0, fade: 2,
            pan: true, forced: true, isNew: true
        };
        if (!body) return aex;
        const parts = String(body).split(':');
        if (parts[0] === 'aex') parts.shift();
        if (parts.length > 0 && parts[0]) aex.type = String(parts[0]).toLowerCase();
        if (parts.length > 1 && parts[1] !== undefined && parts[1] !== '') {
            const dr = String(parts[1]).split('+');
            if (dr[0] !== undefined && dr[0] !== '') aex.distance = Number(dr[0]) || 0;
            if (dr[1] !== undefined && dr[1] !== '') aex.radius = Number(dr[1]) || 0;
        }
        if (parts.length > 2 && parts[2] !== '') aex.fade = Number(parts[2]) || 0;
        if (parts.length > 3) aex.pan = !/^(nopan|false|fal)$/i.test(String(parts[3]));
        if (parts.length > 4) aex.forced = !/^(default|false|def)$/i.test(String(parts[4]));
        if (parts.length > 5) aex.isNew = !/^(link|false|lin)$/i.test(String(parts[5]));
        return aex;
    }

    /** "<aex:d:20+0:2:pan:forced:new>" */
    static encodeAex(aex) {
        const type = aex.type || 'd';
        const dist = Math.max(0, Number(aex.distance) || 0);
        const radius = Math.max(0, Number(aex.radius) || 0);
        const fade = Math.max(0, Number(aex.fade) || 0);
        const pan = aex.pan ? 'pan' : 'nopan';
        const forced = aex.forced ? 'forced' : 'default';
        const isNew = aex.isNew ? 'new' : 'link';
        return '<aex:' + type + ':' + dist + '+' + radius + ':' + fade + ':' + pan + ':' + forced + ':' + isNew + '>';
    }

    /**
     * Scan a map for zone events.
     * Returns [{eventId, eventName, x, y, pageIndex, editable, aex, bgs}].
     */
    static scanZones(projectPath, mapId) {
        const map = AudioStudioZones.readMap(projectPath, mapId);
        const zones = [];
        for (const ev of (map.events || [])) {
            if (!ev) continue;
            const found = AudioStudioZones._scanEvent(ev);
            if (found) zones.push(found);
        }
        return zones;
    }

    static _scanEvent(ev) {
        const pages = ev.pages || [];
        for (let pi = 0; pi < pages.length; pi++) {
            const list = pages[pi].list || [];
            const comments = [];
            let bgs = null;
            let extra = 0;
            for (const cmd of list) {
                if (!cmd) continue;
                if (cmd.code === 108 || cmd.code === 408) {
                    for (const line of (cmd.parameters || [])) comments.push(String(line));
                } else if (cmd.code === 245) {
                    if (!bgs) {
                        const p = cmd.parameters || [];
                        bgs = (typeof p[0] === 'object' && p[0] !== null)
                            ? { name: String(p[0].name || ''), volume: Number(p[0].volume) || 0, pitch: Number(p[0].pitch) || 100, pan: Number(p[0].pan) || 0 }
                            : { name: String(p[0] || ''), volume: Number(p[1]) || 0, pitch: Number(p[2]) || 100, pan: Number(p[3]) || 0 };
                    } else {
                        extra++;
                    }
                } else if (cmd.code !== 0) {
                    extra++;
                }
            }
            const joined = comments.join('\n');
            const m = joined.match(AudioStudioZones.AEX_RE);
            if (!m) continue;
            return {
                eventId: ev.id,
                eventName: String(ev.name || ''),
                x: ev.x, y: ev.y,
                pageIndex: pi,
                editable: extra === 0 && !!bgs,
                aex: AudioStudioZones.parseAex(m[1]),
                bgs: bgs || { name: '', volume: 90, pitch: 100, pan: 0 }
            };
        }
        return null;
    }

    /** A fresh zone event in the canonical simple format. */
    static makeZoneEvent(id, x, y, aex, bgs) {
        return {
            id: id,
            name: 'AEX: ' + (bgs.name || 'zone'),
            note: '',
            pages: [{
                conditions: {
                    actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                    selfSwitchCh: 'A', selfSwitchValid: false, switch1Id: 1,
                    switch1Valid: false, switch2Id: 1, switch2Valid: false,
                    variableId: 1, variableValid: false, variableValue: 0
                },
                directionFix: false,
                image: { characterIndex: 0, characterName: '', direction: 2, pattern: 0, tileId: 0 },
                list: [
                    { code: 108, indent: 0, parameters: [AudioStudioZones.encodeAex(aex)] },
                    { code: 245, indent: 0, parameters: [{ name: String(bgs.name || ''), volume: Number(bgs.volume) || 90, pitch: Number(bgs.pitch) || 100, pan: Number(bgs.pan) || 0 }] },
                    { code: 0, indent: 0, parameters: [] }
                ],
                moveFrequency: 3,
                moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false },
                moveSpeed: 3, moveType: 0, priorityType: 0, stepAnime: false,
                through: false, trigger: 0, walkingAnime: true
            }],
            x: Number(x) || 0,
            y: Number(y) || 0
        };
    }

    /**
     * Apply edits to a map's zones. edits: {updates:[{eventId,x,y,aex,bgs}],
     * removals:[eventId], additions:[{x,y,aex,bgs}]}. Returns the report.
     */
    static applyEdits(projectPath, mapId, edits) {
        const map = AudioStudioZones.readMap(projectPath, mapId);
        const events = map.events || (map.events = []);
        const report = { updated: 0, removed: 0, added: 0, errors: [] };

        for (const upd of (edits.updates || [])) {
            const ev = events.find(e => e && e.id === upd.eventId);
            if (!ev) { report.errors.push('update: event ' + upd.eventId + ' not found'); continue; }
            const zone = AudioStudioZones._scanEvent(ev);
            if (!zone || !zone.editable) { report.errors.push('update: event ' + upd.eventId + ' not a simple zone'); continue; }
            const page = ev.pages[zone.pageIndex];
            page.list = [
                { code: 108, indent: 0, parameters: [AudioStudioZones.encodeAex(upd.aex || zone.aex)] },
                { code: 245, indent: 0, parameters: [{
                    name: String((upd.bgs || zone.bgs).name || ''),
                    volume: Number((upd.bgs || zone.bgs).volume) || 90,
                    pitch: Number((upd.bgs || zone.bgs).pitch) || 100,
                    pan: Number((upd.bgs || zone.bgs).pan) || 0
                }] },
                { code: 0, indent: 0, parameters: [] }
            ];
            ev.x = upd.x !== undefined ? Number(upd.x) : ev.x;
            ev.y = upd.y !== undefined ? Number(upd.y) : ev.y;
            if (upd.bgs && upd.bgs.name) ev.name = 'AEX: ' + upd.bgs.name;
            report.updated++;
        }

        for (const id of (edits.removals || [])) {
            const idx = events.findIndex(e => e && e.id === id);
            if (idx === -1) { report.errors.push('remove: event ' + id + ' not found'); continue; }
            events.splice(idx, 1);
            report.removed++;
        }

        let nextId = 1;
        for (const e of events) { if (e && e.id >= nextId) nextId = e.id + 1; }
        for (const add of (edits.additions || [])) {
            events.push(AudioStudioZones.makeZoneEvent(
                nextId++, add.x, add.y, add.aex, add.bgs));
            report.added++;
        }

        AudioStudioZones.writeMap(projectPath, mapId, map);
        return report;
    }
}

if (typeof window !== 'undefined') {
    window.AudioStudioZones = AudioStudioZones;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioStudioZones;
}
