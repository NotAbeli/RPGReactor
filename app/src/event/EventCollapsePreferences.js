/**
 * Remembers which event command blocks the author folded, per page, across
 * sessions. Everything starts expanded; only deliberate folds are stored, so an
 * absent entry always means "show the whole structure".
 */
class EventCollapsePreferences {
    static get STORAGE_KEY() {
        return 'rpg-reactor.eventCollapsedBlocks';
    }

    /** Identifies one event page within a project. */
    static scopeId(scope) {
        if (!scope) return '';
        const parts = [
            scope.projectPath || '',
            scope.kind || 'map',
            scope.mapId ?? '',
            scope.eventId ?? '',
            scope.pageIndex ?? 0
        ];
        return parts.join('|');
    }

    /**
     * Identifies one block inside a page. Command objects are rebuilt from JSON
     * on every load, so the key has to be positional — but position alone goes
     * stale the moment the page is edited elsewhere. Pinning the code and indent
     * alongside the index makes a stale entry self-correcting: it simply stops
     * matching and the block renders expanded, rather than folding whatever
     * unrelated command slid into that slot.
     */
    static blockId(index, command) {
        if (!command) return '';
        return `${index}:${command.code}:${command.indent || 0}`;
    }

    static readAll(storage) {
        try {
            const raw = storage.getItem(this.STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    static load(scope, storage = localStorage) {
        const id = this.scopeId(scope);
        if (!id) return [];
        const entry = this.readAll(storage)[id];
        return Array.isArray(entry) ? entry.filter(value => typeof value === 'string') : [];
    }

    static save(scope, blockIds, storage = localStorage) {
        const id = this.scopeId(scope);
        if (!id) return false;
        try {
            const all = this.readAll(storage);
            const ids = Array.from(new Set((blockIds || []).filter(value => typeof value === 'string')));
            if (ids.length > 0) {
                all[id] = ids.sort();
            } else {
                // Fully expanded is the default, so drop the entry instead of
                // storing an empty list that would grow the record forever.
                delete all[id];
            }
            storage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            return true;
        } catch {
            return false;
        }
    }

    /** Forget every page belonging to a project, e.g. when it is deleted. */
    static clearProject(projectPath, storage = localStorage) {
        if (!projectPath) return false;
        try {
            const all = this.readAll(storage);
            let changed = false;
            for (const id of Object.keys(all)) {
                if (id.startsWith(`${projectPath}|`)) {
                    delete all[id];
                    changed = true;
                }
            }
            if (changed) storage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            return changed;
        } catch {
            return false;
        }
    }
}

if (typeof window !== 'undefined') window.EventCollapsePreferences = EventCollapsePreferences;
if (typeof module !== 'undefined' && module.exports) module.exports = EventCollapsePreferences;
