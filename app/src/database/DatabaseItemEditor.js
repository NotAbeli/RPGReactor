/**
 * DatabaseItemEditor - Editor for managing item database entries
 * Handles display and editing of item properties including type, effects, damage, and general settings
 */

class DatabaseItemEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
        this.currentItem = null;
        this.effectsClipboard = null;
        this.effectEditor = new DatabaseEffectEditor(databaseManager, commonUI);
    }

    // ------------------------------------------------------------------
    // sptags note-tag plumbing (SuperDuperItemTags)
    // ------------------------------------------------------------------

    /** Parse '<sptags:a, b>' (may include 'spdisposable') -> [tags]. */
    static readSptags(note) {
        const m = String(note || '').match(/<sptags:([^>]*)>/i);
        if (!m) return [];
        return m[1].split(',')
            .map(s => s.trim().toLowerCase())
            .filter(s => s && s !== 'spdisposable');
    }

    static readSpDisposable(note) {
        const n = String(note || '');
        const inside = ((n.match(/<sptags:([^>]*)>/i) || [])[1] || '')
            .split(',').map(s => s.trim().toLowerCase()).includes('spdisposable');
        return inside || /<spdisposable>/i.test(n);
    }

    /** Rewrite ONLY the <sptags:...> tag in the note (keeps everything else). */
    static writeSptags(note, rawList) {
        const tags = String(rawList || '')
            .split(',').map(s => s.trim().toLowerCase())
            .filter(s => s && s !== 'spdisposable');
        let n = String(note || '').replace(/<sptags:[^>]*>\n?/gi, '').replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
        if (tags.length) {
            const keepDisposable = DatabaseItemEditor.readSpDisposable(note);
            const body = keepDisposable ? tags.concat(['spdisposable']).join(', ') : tags.join(', ');
            n = n ? (n + '\n<sptags:' + body + '>') : ('<sptags:' + body + '>');
        }
        return n;
    }

    static writeSpDisposable(note, enabled) {
        let n = String(note || '');
        const has = DatabaseItemEditor.readSpDisposable(n);
        if (enabled === has) return n;
        if (enabled) {
            // Standalone tag next to sptags (the plugin reads both forms).
            n = n ? (n.replace(/\s*$/, '') + '\n<spdisposable>') : '<spdisposable>';
        } else {
            n = n.replace(/\n?<spdisposable>/gi, '');
            n = n.replace(/<sptags:([^>]*)>/i, (full, body) => {
                const cleaned = body.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== 'spdisposable').join(', ');
                return cleaned ? '<sptags:' + cleaned + '>' : '';
            });
        }
        return n.replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
    }

    /** All tags used across items/weapons/armors + gift TagSettings. */
    static collectKnownTags(databaseManager) {
        const tags = new Set();
        const tables = ['getItems', 'getWeapons', 'getArmors'];
        for (const getter of tables) {
            const list = databaseManager && databaseManager[getter] ? databaseManager[getter]() : [];
            for (const it of (list || [])) {
                if (it && it.note) DatabaseItemEditor.readSptags(it.note).forEach(t => tags.add(t));
            }
        }
        try {
            const agonia = databaseManager && databaseManager.data && databaseManager.data.agonia;
            if (agonia && agonia.gifts && typeof agonia.gifts.Characters === 'string') {
                for (const raw of (JSON.parse(agonia.gifts.Characters) || [])) {
                    const ch = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    for (const rraw of (JSON.parse(ch.TagSettings || '[]') || [])) {
                        const rule = typeof rraw === 'string' ? JSON.parse(rraw) : rraw;
                        if (rule && rule.Tag) tags.add(String(rule.Tag).trim().toLowerCase());
                    }
                }
            }
        } catch (e) { /* best-effort suggestions */ }
        return [...tags].sort((a, b) => a.localeCompare(b, 'ru'));
    }

    showItemDetail(container, item) {
        this.currentItem = item;

        const wrapper = document.createElement('div');
        wrapper.className = 'agn-detail-col';
        wrapper.style.padding = '16px';

        const tt = text => window.I18n ? window.I18n.tText(text) : text;

        // --- General Settings (inspector rows, S19) ---
        const generalSection = document.createElement('div');
        generalSection.className = 'agn-insp';
        generalSection.innerHTML = `
            <div class="agn-insp-section"><span class="agn-insp-caption">${tt('Общее')}</span></div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Иконка')}</div>
                <div class="agn-insp-control" id="item-icon-container-${item.id}"></div>
            </div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Название')}</div>
                <div class="agn-insp-control"><input type="text" class="agonia-input" value="${rrEscapeHtml(item.name)}" data-field="name" data-item-id="${item.id}"></div>
            </div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Описание')}</div>
                <div class="agn-insp-control"><textarea class="agonia-input" rows="2" style="flex:1 1 100%;min-height:52px;resize:vertical;" data-field="description" data-item-id="${item.id}">${rrEscapeHtml(item.description)}</textarea></div>
            </div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Цена')}</div>
                <div class="agn-insp-control"><input type="number" class="agonia-input" value="${rrEscapeHtml(item.price || 0)}" data-field="price" data-item-id="${item.id}"></div>
            </div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Расходуемый')}</div>
                <div class="agn-insp-control">
                    <input type="checkbox" class="system-checkbox" ${item.consumable ? 'checked' : ''} data-field="consumable" data-item-id="${item.id}">
                    <span style="color: var(--color-text-dim); font-size: 11px;">${tt('исчезает из инвентаря после использования')}</span>
                </div>
            </div>
        `;
        // General flows into the two-column grid with the other sections

        // Add icon to the designated container after the DOM is ready
        setTimeout(() => {
            const iconContainer = document.getElementById(`item-icon-container-${item.id}`);
            if (iconContainer) {
                this.parentEditor.addDatabasePreview(iconContainer, item, 'items');
            }
        }, 0);

        // Grid wrapper for all sections
        const gridWrapper = document.createElement('div');
        gridWrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
        gridWrapper.appendChild(generalSection);

        // --- Common Event Effects (S18; S19 inspector rows) ---
        // Only code 44 (Common Event) is used by this project; battle
        // effects were amputated with the standard battle (S12/S13) and
        // stay hidden in the data, untouched.
        const ceEffects = (item.effects || []).filter(e => e && e.code === 44);
        const hiddenEffects = (item.effects || []).length - ceEffects.length;
        const effectsSection = document.createElement('div');
        effectsSection.className = 'agn-insp';
        effectsSection.innerHTML = `
            <div class="agn-insp-section"><span class="agn-insp-caption">${tt('Эффект: Общее событие')}</span></div>
            <div id="item-ce-effects-${item.id}">
                <div style="display:flex;flex-direction:column;gap:2px;">
                    ${ceEffects.map((e, index) => `
                        <div class="agn-insp-row" data-ce-index="${index}">
                            <div class="agn-insp-label">${tt('Общее событие №')}</div>
                            <div class="agn-insp-control">
                                <input type="number" min="1" class="agonia-input" style="flex:none;width:84px;"
                                       value="${rrEscapeHtml(e.dataId || 1)}" data-ce-input data-ce-original-index="${(item.effects || []).indexOf(e)}">
                                <button type="button" class="agonia-btn danger" data-ce-remove data-ce-original-index="${(item.effects || []).indexOf(e)}">✕</button>
                            </div>
                        </div>
                    `).join('')}
                    <div style="display:flex;gap:8px;align-items:center;padding:6px 2px;">
                        <button type="button" class="agonia-btn" data-ce-add>${tt('+ Общее событие')}</button>
                        ${hiddenEffects > 0 ? `<span style="font-size:10px;color:var(--color-text-dim);">${hiddenEffects} ${tt('боевых эффекта(ов) скрыто (данные не тронуты)')}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        gridWrapper.appendChild(effectsSection);

        // --- Tags Section (SuperDuperItemTags; S38 toggle chips) ---
        // Tags live in the item note: <sptags:a, b> + <spdisposable>; the
        // plugin parses both at boot. Tags are PICKED from known chips
        // (click = add, click again = remove); «+» creates a new tag.
        const tagsSection = document.createElement('div');
        tagsSection.className = 'agn-insp';
        tagsSection.innerHTML = `
            <div class="agn-insp-section"><span class="agn-insp-caption">${tt('Теги')}</span></div>
        `;

        const tagsRow = document.createElement('div');
        tagsRow.className = 'agn-insp-row';
        const tagsLabel = document.createElement('div');
        tagsLabel.className = 'agn-insp-label';
        tagsLabel.textContent = tt('Теги предмета');
        tagsRow.appendChild(tagsLabel);
        const chipsHost = document.createElement('div');
        chipsHost.className = 'agn-insp-control';
        chipsHost.style.cssText = 'flex-wrap:wrap;gap:6px;flex:1 1 100%;';
        tagsRow.appendChild(chipsHost);
        tagsSection.appendChild(tagsRow);

        const dispRow = document.createElement('div');
        dispRow.className = 'agn-insp-row';
        const dispLabel = document.createElement('div');
        dispLabel.className = 'agn-insp-label';
        dispLabel.textContent = tt('Одноразовый') + ' (spdisposable)';
        dispRow.appendChild(dispLabel);
        const dispControl = document.createElement('div');
        dispControl.className = 'agn-insp-control';
        const disposableBox = document.createElement('input');
        disposableBox.type = 'checkbox';
        disposableBox.style.cursor = 'pointer';
        disposableBox.checked = DatabaseItemEditor.readSpDisposable(item.note);
        dispControl.appendChild(disposableBox);
        dispRow.appendChild(dispControl);
        tagsSection.appendChild(dispRow);
        disposableBox.addEventListener('change', () => {
            item.note = DatabaseItemEditor.writeSpDisposable(item.note, disposableBox.checked);
            persistNote();
        });
        gridWrapper.appendChild(tagsSection);

        // Chips wiring (immediate - no re-render of the whole form needed).
        const noteAreaRef = { el: null };
        const persistNote = () => {
            if (noteAreaRef.el) noteAreaRef.el.value = item.note || '';
            this.databaseManager.updateItem(item.id, item);
        };
        const saveTags = list => {
            item.note = DatabaseItemEditor.writeSptags(item.note, list.join(', '));
            persistNote();
        };
        const chipStyle = on => `
            padding:3px 12px;font-size:12px;cursor:pointer;border-radius:12px;
            border:1px solid ${on ? 'var(--color-accent-border-mid)' : 'var(--color-border)'};
            background-color:${on ? 'var(--color-bg-deep)' : 'var(--color-bg-panel)'};
            color:${on ? 'var(--color-text-strong)' : 'var(--color-text)'};
            font-weight:${on ? '700' : '400'};
        `;
        const renderChips = () => {
            const active = DatabaseItemEditor.readSptags(item.note);
            const known = DatabaseItemEditor.collectKnownTags(this.databaseManager);
            // tags the item already has but nobody knows yet
            const all = [...new Set(known.concat(active))];
            chipsHost.innerHTML = '';
            for (const tag of all) {
                const on = active.includes(tag);
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.textContent = tag;
                chip.style.cssText = chipStyle(on);
                chip.title = on ? tt('Убрать тег') : tt('Добавить тег');
                chip.addEventListener('click', () => {
                    const cur = DatabaseItemEditor.readSptags(item.note);
                    const next = cur.includes(tag) ? cur.filter(t => t !== tag) : cur.concat([tag]);
                    saveTags(next);
                    renderChips();
                });
                chipsHost.appendChild(chip);
            }
            // «+» - create a new tag
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.textContent = '+';
            plus.title = tt('Новый тег');
            plus.style.cssText = chipStyle(false);
            plus.addEventListener('click', () => {
                if (chipsHost.querySelector('input[data-sptags-new]')) return;
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.dataset.sptagsNew = '1';
                inp.placeholder = tt('имя тега');
                inp.style.cssText = 'padding:3px 8px;font-size:12px;width:110px;background-color:var(--color-bg-deep);color:var(--color-text-strong);border:1px solid var(--color-accent-border-mid);border-radius:12px;';
                const ok = document.createElement('button');
                ok.type = 'button';
                ok.textContent = '✓';
                ok.style.cssText = chipStyle(true);
                const cancel = document.createElement('button');
                cancel.type = 'button';
                cancel.textContent = '✕';
                cancel.style.cssText = chipStyle(false);
                const commit = () => {
                    const name = inp.value.trim().toLowerCase();
                    if (name) {
                        const cur = DatabaseItemEditor.readSptags(item.note);
                        if (!cur.includes(name)) saveTags(cur.concat([name]));
                    }
                    renderChips();
                };
                ok.addEventListener('click', commit);
                cancel.addEventListener('click', () => renderChips());
                inp.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') { e.preventDefault(); renderChips(); }
                });
                plus.replaceWith(inp);
                chipsHost.appendChild(ok);
                chipsHost.appendChild(cancel);
                inp.focus();
            });
            chipsHost.appendChild(plus);
        };
        renderChips();

        // --- Note Section (S19 inspector rows) ---
        const noteSection = document.createElement('div');
        noteSection.className = 'agn-insp';
        noteSection.innerHTML = `
            <div class="agn-insp-section"><span class="agn-insp-caption">${tt('Note')}</span></div>
            <div class="agn-insp-row">
                <div class="agn-insp-label">${tt('Заметка')}</div>
                <div class="agn-insp-control"><textarea class="agonia-input" rows="4" style="flex:1 1 100%;min-height:72px;resize:vertical;font-family:var(--font-mono,monospace);" data-field="note" data-item-id="${item.id}">${rrEscapeHtml(item.note)}</textarea></div>
            </div>
        `;
        gridWrapper.appendChild(noteSection);

        wrapper.appendChild(gridWrapper);
        container.appendChild(wrapper);

        // Add event listeners for all editable fields
        setTimeout(() => {
            // Common-event effects (S18): edit / remove / add on code 44 only
            const ceHost = container.querySelector(`#item-ce-effects-${item.id}`) ||
                document.getElementById(`item-ce-effects-${item.id}`);
            if (ceHost) {
                ceHost.querySelectorAll('[data-ce-input]').forEach(input => {
                    input.addEventListener('change', () => {
                        const oi = parseInt(input.dataset.ceOriginalIndex, 10);
                        const n = Number(input.value);
                        if (!Number.isNaN(n) && item.effects && item.effects[oi]) {
                            item.effects[oi].dataId = Math.max(1, n);
                            this.databaseManager.updateItem(item.id, item);
                        }
                    });
                });
                ceHost.querySelectorAll('[data-ce-remove]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const oi = parseInt(btn.dataset.ceOriginalIndex, 10);
                        if (item.effects && item.effects[oi]) {
                            item.effects.splice(oi, 1);
                            this.databaseManager.updateItem(item.id, item);
                            this.showItemDetail(container.closest('.database-detail') || container, item);
                        }
                    });
                });
                const addBtn = ceHost.querySelector('[data-ce-add]');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        item.effects = item.effects || [];
                        item.effects.push({ code: 44, dataId: 1, value1: 0, value2: 0 });
                        this.databaseManager.updateItem(item.id, item);
                        this.showItemDetail(container.closest('.database-detail') || container, item);
                    });
                }
            }

            // spdisposable is wired at construction (S38); keep the note
            // textarea reference live for tag/disposable note sync.
            const noteArea = container.querySelector(`textarea[data-field="note"][data-item-id="${item.id}"]`);
            if (noteArea) noteAreaRef.el = noteArea;

            const editableFields = container.querySelectorAll('[data-item-id]');
            editableFields.forEach(field => {
                field.addEventListener('change', (e) => {
                    const fieldName = e.target.dataset.field;
                    const itemId = parseInt(e.target.dataset.itemId);
                    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    const normalized = this.updateItemField(itemId, fieldName, value);
                    if (normalized !== undefined && e.target.type === 'number') e.target.value = String(normalized);
                });
            });
        }, 0);
    }

    updateItemField(itemId, fieldName, value) {
        const item = this.databaseManager.getItem(itemId);
        if (!item) return;

        // Handle nested damage fields (e.g. "damage.type", "damage.formula")
        if (fieldName.startsWith('damage.')) {
            const subField = fieldName.split('.')[1];
            if (!item.damage) {
                item.damage = { type: 0, elementId: -1, formula: '0', variance: 20, critical: false };
            }
            // Boolean sub-fields
            if (subField === 'critical') {
                item.damage[subField] = !!value;
            }
            // String sub-fields
            else if (subField === 'formula') {
                item.damage[subField] = value;
            }
            // Numeric sub-fields
            else {
                item.damage[subField] = parseInt(value) || 0;
            }
            console.log(`Updated item ${itemId} damage.${subField} to:`, item.damage[subField]);
        }
        // Handle boolean fields
        else if (fieldName === 'consumable') {
            item[fieldName] = !!value;
            console.log(`Updated item ${itemId} field ${fieldName} to:`, item[fieldName]);
        }
        // Handle numeric fields
        else if (['itypeId', 'price', 'scope', 'occasion', 'speed', 'successRate', 'repeats', 'hitType', 'animationId', 'tpGain'].includes(fieldName)) {
            item[fieldName] = parseInt(value) || 0;
            if (fieldName === 'repeats') {
                item[fieldName] = Math.max(1, Math.min(globalThis.RR_LIMITS?.ACTION_REPEATS || 100, item[fieldName]));
            }
            console.log(`Updated item ${itemId} field ${fieldName} to:`, item[fieldName]);
        }
        // Handle string fields (name, description, note)
        else {
            item[fieldName] = value;
            console.log(`Updated item ${itemId} field ${fieldName} to:`, value);
        }

        this.databaseManager.updateItem(itemId, item);
        return fieldName.startsWith('damage.') ? item.damage[fieldName.split('.')[1]] : item[fieldName];
    }

    setupEffectInteraction(table, item) {
        const rows = table.querySelectorAll('.effect-row');

        rows.forEach(row => {
            const indicator = row.querySelector('.effect-indicator');
            const contentCells = Array.from(row.querySelectorAll('td:not(.effect-indicator)'));

            row.addEventListener('mouseenter', () => {
                if (indicator) {
                    indicator.style.setProperty('background-color', 'var(--color-accent-bright)', 'important');
                }
                contentCells.forEach(cell => {
                    cell.style.setProperty('background-color', 'var(--color-bg-panel)', 'important');
                });
            });

            row.addEventListener('mouseleave', () => {
                if (indicator && !row.classList.contains('selected')) {
                    indicator.style.setProperty('background-color', 'transparent', 'important');
                }
                if (!row.classList.contains('selected')) {
                    contentCells.forEach(cell => {
                        cell.style.setProperty('background-color', '', 'important');
                    });
                }
            });

            row.addEventListener('click', () => {
                rows.forEach(r => {
                    r.classList.remove('selected');
                    const ind = r.querySelector('.effect-indicator');
                    if (ind) ind.style.setProperty('background-color', 'transparent', 'important');
                    const cells = Array.from(r.querySelectorAll('td:not(.effect-indicator)'));
                    cells.forEach(cell => cell.style.setProperty('background-color', '', 'important'));
                });

                row.classList.add('selected');
                if (indicator) {
                    indicator.style.setProperty('background-color', 'var(--color-accent-bright)', 'important');
                }
                contentCells.forEach(cell => {
                    cell.style.setProperty('background-color', 'var(--color-bg-panel)', 'important');
                });
            });
        });
    }

    setupEffectsContextMenu(table, item) {
        table.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const tt = text => window.I18n ? window.I18n.tText(text) : text;

            const row = e.target.closest('.effect-row');
            const effectIndex = row ? parseInt(row.dataset.effectIndex) : null;

            const existingMenu = document.getElementById('effects-context-menu');
            if (existingMenu) existingMenu.remove();

            const menu = document.createElement('div');
            menu.id = 'effects-context-menu';
            menu.style.cssText = `
                position: fixed;
                left: ${e.clientX}px;
                top: ${e.clientY}px;
                background: var(--color-bg-menubar);
                border: 1px solid var(--color-border);
                border-radius: 4px;
                padding: 4px 0;
                z-index: 10000;
                min-width: 150px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            `;

            const menuItems = [
                { label: 'Add', action: () => this.addEffect(item), enabled: true },
                { label: 'Edit', action: () => this.editEffect(item, effectIndex), enabled: effectIndex !== null },
                { label: 'Cut', action: () => this.cutEffect(item, effectIndex), enabled: effectIndex !== null },
                { label: 'Copy', action: () => this.copyEffect(item, effectIndex), enabled: effectIndex !== null },
                { label: 'Paste', action: () => this.pasteEffect(item), enabled: true },
                { label: 'Delete', action: () => this.deleteEffect(item, effectIndex), enabled: effectIndex !== null }
            ];

            menuItems.forEach(menuItemDef => {
                const menuItem = document.createElement('div');
                menuItem.textContent = tt(menuItemDef.label);
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: ${menuItemDef.enabled ? 'pointer' : 'not-allowed'};
                    color: ${menuItemDef.enabled ? 'var(--color-text-strong)' : 'var(--color-text-dim)'};
                    transition: background 0.1s;
                `;

                if (menuItemDef.enabled) {
                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.background = 'var(--color-border)';
                    });
                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.background = 'transparent';
                    });
                    menuItem.addEventListener('click', () => {
                        menuItemDef.action();
                        menu.remove();
                    });
                }

                menu.appendChild(menuItem);
            });

            document.body.appendChild(menu);

            const closeMenu = () => {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        });
    }

    addEffect(item) {
        if (!item.effects) item.effects = [];

        this.effectEditor.showEffectEditorModal(item, -1, (updatedEntry) => {
            this.databaseManager.updateItem(updatedEntry.id, updatedEntry);
            this.refreshItemDetail(updatedEntry);
        });
    }

    editEffect(item, effectIndex) {
        if (effectIndex === null) return;

        this.effectEditor.showEffectEditorModal(item, effectIndex, (updatedEntry) => {
            this.databaseManager.updateItem(updatedEntry.id, updatedEntry);
            this.refreshItemDetail(updatedEntry);
        });
    }

    async cutEffect(item, effectIndex) {
        if (effectIndex === null || !item.effects) return;
        const target = DatabaseRowClipboard.capturePasteTarget(this.parentEditor, this.projectManager, this.databaseManager, item.effects, effectIndex);
        const payload = this.copyEffect(item, effectIndex);
        if (!await DatabaseRowClipboard.confirmCut(payload)) return;
        if (this.currentItem !== item
            || !DatabaseRowClipboard.isPasteTargetCurrent(target, this.parentEditor, this.projectManager, this.databaseManager, item.effects)) return;
        item.effects.splice(effectIndex, 1);
        this.databaseManager.updateItem(item.id, item);
        this.refreshItemDetail(item);
    }

    copyEffect(item, effectIndex) {
        if (effectIndex === null || !item.effects) return;
        this.effectsClipboard = DatabaseRowClipboard.write('effect', item.effects[effectIndex], this.databaseManager);
        return this.effectsClipboard;
    }

    async pasteEffect(item) {
        const target = DatabaseRowClipboard.capturePasteTarget(this.parentEditor, this.projectManager, this.databaseManager, item.effects);
        const result = await DatabaseRowClipboard.read('effect', this.databaseManager, this.effectsClipboard);
        if (this.currentItem !== item
            || !DatabaseRowClipboard.isPasteTargetCurrent(target, this.parentEditor, this.projectManager, this.databaseManager, item.effects)) return;
        if (result.error) {
            DatabaseRowClipboard.showError(result);
            return;
        }
        if (!item.effects) item.effects = [];
        item.effects.push(result.row);
        this.databaseManager.updateItem(item.id, item);
        this.refreshItemDetail(item);
    }

    deleteEffect(item, effectIndex) {
        if (effectIndex === null || !item.effects) return;
        item.effects.splice(effectIndex, 1);
        this.databaseManager.updateItem(item.id, item);
        this.refreshItemDetail(item);
    }

    refreshItemDetail(item) {
        const container = document.getElementById('database-detail');
        if (container) {
            container.innerHTML = '';
            this.showItemDetail(container, item);
        } else {
            console.warn('DatabaseItemEditor.refreshItemDetail - Could not find detail panel container!');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseItemEditor;
}
