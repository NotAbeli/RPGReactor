class TilesetGraphicPicker {
    constructor(projectController) {
        this.projectController = projectController;
        this.onSelect = null;
        this.modal = null;
        this.selectedTileId = 0;
    }

    _t(key) {
        return (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(key) : key;
    }

    show(currentTileId, callback) {
        this.onSelect = callback;
        this.selectedTileId = currentTileId || 0;

        const currentProject = this.projectController.getCurrentProject
            ? this.projectController.getCurrentProject()
            : this.projectController.currentProject;
        if (!currentProject) return;

        const path = require('path');
        const fs = require('fs');
        const tilemapManager = this.projectController.getTilemapManager?.();
        if (!tilemapManager?.currentMap) return;

        const tilesetId = tilemapManager.currentMap.tilesetId || 1;
        const tilesetsPath = path.join(currentProject.path, 'data', 'Tilesets.json');
        if (!fs.existsSync(tilesetsPath)) return;
        const tilesets = JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'));
        const tileset = tilesets[tilesetId];
        if (!tileset?.tilesetNames) return;

        const BE_LAYERS = [
            { name: 'B', index: 5, base: 0 },
            { name: 'C', index: 6, base: 256 },
            { name: 'D', index: 7, base: 512 },
            { name: 'E', index: 8, base: 768 }
        ];

        const TILE_SIZE = 48;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
        this.modal = overlay;

        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--color-bg-panel,#2b2b2b);border:1px solid var(--color-border,#555);border-radius:6px;padding:12px;max-width:90vw;max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:8px;';
        modal.innerHTML = `<div style="font-size:14px;font-weight:bold;color:var(--color-text,#eee);">${this._t('event.image')}</div>`;

        const tabRow = document.createElement('div');
        tabRow.style.cssText = 'display:flex;gap:2px;';
        modal.appendChild(tabRow);

        const contentArea = document.createElement('div');
        contentArea.style.cssText = 'background:var(--color-bg-surface,#1e1e1e);border:1px solid var(--color-border,#444);border-radius:4px;padding:8px;overflow:auto;max-height:60vh;';
        modal.appendChild(contentArea);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
        modal.appendChild(btnRow);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = this._t('event.clear');
        clearBtn.style.cssText = 'padding:4px 12px;cursor:pointer;';
        clearBtn.addEventListener('click', () => {
            if (this.onSelect) this.onSelect({ tileId: 0 });
            this.close();
        });
        btnRow.appendChild(clearBtn);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:4px 12px;cursor:pointer;';
        okBtn.addEventListener('click', () => {
            if (this.selectedTileId > 0) {
                if (this.onSelect) this.onSelect({ tileId: this.selectedTileId });
                this.close();
            }
        });
        btnRow.appendChild(okBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this._t('event.cancel');
        cancelBtn.style.cssText = 'padding:4px 12px;cursor:pointer;';
        cancelBtn.addEventListener('click', () => this.close());
        btnRow.appendChild(cancelBtn);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });

        let activeTab = null;
        const tabs = {};

        for (const layer of BE_LAYERS) {
            const sheetName = tileset.tilesetNames[layer.index];
            const tab = document.createElement('button');
            tab.textContent = layer.name;
            tab.dataset.layer = layer.name;
            tab.style.cssText = 'padding:3px 10px;cursor:pointer;border:1px solid var(--color-border,#555);border-bottom:none;border-radius:3px 3px 0 0;background:var(--color-bg-input,#333);color:var(--color-text,#ccc);font-size:12px;';
            if (!sheetName) {
                tab.style.opacity = '0.4';
                tab.style.pointerEvents = 'none';
            }
            tab.addEventListener('click', () => {
                if (activeTab) activeTab.style.background = 'var(--color-bg-input,#333)';
                tab.style.background = 'var(--color-bg-deep,#1a1a2e)';
                activeTab = tab;
                this._renderSheet(contentArea, sheetName, layer, TILE_SIZE, currentProject, path);
            });
            tabRow.appendChild(tab);
            tabs[layer.name] = tab;
        }

        const firstActive = BE_LAYERS.find(l => tileset.tilesetNames[l.index]);
        if (firstActive) tabs[firstActive.name].click();

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    _renderSheet(container, sheetName, layer, TILE_SIZE, currentProject, path) {
        container.innerHTML = '';
        if (!sheetName) {
            container.innerHTML = `<div style="color:var(--color-text-muted,#888);font-size:12px;padding:20px;">${this._t('event.none')}</div>`;
            return;
        }

        const imgPath = (window.RPGReactorAssetUrl
            ? window.RPGReactorAssetUrl(path.join(currentProject.path, 'img', 'tilesets', sheetName + '.png'))
            : 'file://' + path.join(currentProject.path, 'img', 'tilesets', sheetName + '.png').replace(/\\/g, '/'));

        const img = new Image();
        img.onload = () => {
            const cols = Math.floor(img.width / TILE_SIZE);
            const rows = Math.floor(img.height / TILE_SIZE);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.style.cssText = 'image-rendering:pixelated;cursor:crosshair;display:block;max-width:100%;';
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);

            const drawOverlay = (clickCol, clickRow) => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                if (clickCol >= 0 && clickRow >= 0) {
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(clickCol * TILE_SIZE, clickRow * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            };

            const currentLocal = this.selectedTileId > 0 ? this.selectedTileId - layer.base : -1;
            const curCol = currentLocal >= 0 ? currentLocal % 8 : -1;
            const curRow = currentLocal >= 0 ? Math.floor(currentLocal / 8) : -1;
            const displayCol = curCol >= 0 && curCol < cols ? curCol : -1;
            const displayRow = curRow >= 0 && curRow < rows ? curRow : -1;
            drawOverlay(displayCol, displayRow);

            canvas.addEventListener('click', (e) => {
                const rect = canvas.getBoundingClientRect();
                const scale = canvas.width / rect.width;
                const x = (e.clientX - rect.left) * scale;
                const y = (e.clientY - rect.top) * scale;
                let col = Math.floor(x / TILE_SIZE);
                let row = Math.floor(y / TILE_SIZE);
                if (col < 0 || col >= cols || row < 0 || row >= rows) return;

                let encCol = col;
                let encRow = row;
                if (encCol >= 8) { encCol -= 8; encRow += 16; }
                const tileIndex = encRow * 8 + encCol;
                this.selectedTileId = layer.base + tileIndex;
                drawOverlay(col, row);
            });

            container.appendChild(canvas);
        };
        img.onerror = () => {
            container.innerHTML = `<div style="color:#f88;font-size:12px;padding:20px;">Error loading ${sheetName}</div>`;
        };
        img.src = imgPath;
    }

    close() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = TilesetGraphicPicker;
