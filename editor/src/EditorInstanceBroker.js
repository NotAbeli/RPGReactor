class EditorInstanceBroker {
    constructor(options = {}) {
        this.app = options.app || (typeof nw !== 'undefined' ? nw.App : null);
        this.process = options.process || (typeof process !== 'undefined' ? process : null);
        this.fs = options.fs || (typeof require === 'function' ? require('fs') : null);
        this.path = options.path || (typeof require === 'function' ? require('path') : null);
        this.os = options.os || (typeof require === 'function' ? require('os') : null);
        this.spawn = options.spawn || (typeof require === 'function' ? require('child_process').spawn : null);
        this.slotCount = options.slotCount || 32;
        this.logger = options.logger || console;
        this.started = false;
    }

    static startForCurrentApp(options = {}) {
        const broker = new EditorInstanceBroker(options);
        return broker.start() ? broker : null;
    }

    start() {
        if (this.started || !this.app?.on || !this.process || !this.fs || !this.path || !this.os || !this.spawn) {
            return false;
        }
        this.started = true;
        this.installInheritedLeaseCleanup();
        this.app.on('open', () => this.launchIsolatedInstance());
        if (this.process.platform === 'darwin') {
            this.app.on('reopen', () => this.launchIsolatedInstance());
        }
        return true;
    }

    launchIsolatedInstance() {
        let lease = null;
        try {
            lease = this.reserveProfile();
            const child = this.spawn(this.process.execPath, this.buildLaunchArgs(lease.profilePath), {
                cwd: this.app.startPath || this.process.cwd(),
                detached: true,
                stdio: 'ignore',
                windowsHide: false,
                env: {
                    ...this.process.env,
                    RPG_REACTOR_INSTANCE_LOCK: lease.lockPath,
                    RPG_REACTOR_INSTANCE_TOKEN: lease.token,
                },
            });
            if (!child?.pid) throw new Error('The isolated editor process did not start.');
            this.writeLeaseOwner(lease, child.pid);
            const release = () => this.releaseLease(lease, child.pid);
            child.once?.('error', release);
            child.once?.('exit', release);
            child.unref?.();
            return child;
        } catch (error) {
            if (lease) this.releaseLease(lease);
            this.logger.error('Could not open another RPG Reactor instance:', error);
            return null;
        }
    }

    buildLaunchArgs(profilePath) {
        const args = [`--user-data-dir=${profilePath}`];
        if (this.isGenericNwRuntime()) {
            args.push(this.app.startPath || this.process.cwd());
        }
        return args;
    }

    isGenericNwRuntime() {
        const executable = this.path.basename(this.process.execPath).toLowerCase();
        if (this.process.platform === 'win32') return executable === 'nw.exe';
        if (this.process.platform === 'darwin') {
            const appNw = this.path.resolve(this.path.dirname(this.process.execPath), '..', 'Resources', 'app.nw');
            return !this.fs.existsSync(appNw);
        }
        return executable === 'nw';
    }

    profileRoot() {
        if (this.process.platform === 'win32') {
            const localAppData = this.process.env.LOCALAPPDATA || this.path.join(this.os.homedir(), 'AppData', 'Local');
            return this.path.join(localAppData, 'RPGReactor', 'EditorProfiles');
        }
        if (this.process.platform === 'darwin') {
            return this.path.join(this.os.homedir(), 'Library', 'Application Support', 'RPGReactor', 'EditorProfiles');
        }
        const configRoot = this.process.env.XDG_CONFIG_HOME || this.path.join(this.os.homedir(), '.config');
        return this.path.join(configRoot, 'rpg-reactor', 'editor-profiles');
    }

    reserveProfile() {
        const root = this.profileRoot();
        this.fs.mkdirSync(root, { recursive: true, mode: 0o700 });
        for (let slot = 1; slot <= this.slotCount; slot++) {
            const lease = this.tryReserveSlot(root, `instance-${slot}`);
            if (lease) return lease;
        }
        return this.tryReserveSlot(root, `instance-${this.process.pid}-${Date.now()}`, true);
    }

    tryReserveSlot(root, name, required = false) {
        const lockPath = this.path.join(root, `${name}.lock`);
        const profilePath = this.path.join(root, name);
        const reserve = () => {
            this.fs.mkdirSync(lockPath, { mode: 0o700 });
            this.fs.mkdirSync(profilePath, { recursive: true, mode: 0o700 });
            const lease = { lockPath, profilePath, token: this.randomToken() };
            this.writeLeaseOwner(lease, 0);
            return lease;
        };

        try {
            return reserve();
        } catch (error) {
            if (error.code !== 'EEXIST') {
                if (required) throw error;
                return null;
            }
        }

        const owner = this.readLeaseOwner(lockPath);
        const reservationPending = (!owner || owner.pid === 0) && !this.isAbandonedLock(lockPath);
        if ((owner?.pid > 0 && this.isProcessAlive(owner.pid)) || reservationPending) {
            return null;
        }
        return this.reclaimStaleSlot(lockPath, reserve, required);
    }

    /**
     * Re-reserve a slot whose lock is stale.
     *
     * Removing the stale lock and re-creating it cannot be done as two loose
     * steps: two launches can both judge the same lock stale, and the slower
     * delete then destroys the lock the faster one just created, leaving both
     * sharing one Chromium --user-data-dir. A per-slot reclaim mutex serializes
     * the re-check, the delete, and the re-create so exactly one launch takes
     * the slot; everyone else fails fast and moves on to the next one.
     */
    reclaimStaleSlot(lockPath, reserve, required = false) {
        const reclaimPath = `${lockPath}.reclaim`;
        if (!this.acquireReclaimMutex(reclaimPath)) {
            return null;
        }
        try {
            // Another launch may have taken the slot between the caller's read
            // and this mutex, so the staleness decision has to be made again.
            const owner = this.readLeaseOwner(lockPath);
            const reservationPending = (!owner || owner.pid === 0) && !this.isAbandonedLock(lockPath);
            if (reservationPending || (owner?.pid > 0 && this.isProcessAlive(owner.pid))) {
                return null;
            }
            this.fs.rmSync(lockPath, { recursive: true, force: true });
            return reserve();
        } catch (error) {
            if (required) throw error;
            return null;
        } finally {
            try {
                this.fs.rmSync(reclaimPath, { recursive: true, force: true });
            } catch (_) {
                // A leftover mutex ages out through isAbandonedLock.
            }
        }
    }

    acquireReclaimMutex(reclaimPath) {
        try {
            this.fs.mkdirSync(reclaimPath, { mode: 0o700 });
            return true;
        } catch (error) {
            if (error.code !== 'EEXIST' || !this.isAbandonedLock(reclaimPath)) return false;
        }
        // Recover a mutex left behind by a launch that died mid-reclaim.
        try {
            this.fs.rmSync(reclaimPath, { recursive: true, force: true });
            this.fs.mkdirSync(reclaimPath, { mode: 0o700 });
            return true;
        } catch (_) {
            return false;
        }
    }

    randomToken() {
        try {
            return require('crypto').randomBytes(16).toString('hex');
        } catch (_) {
            return `${this.process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
    }

    ownerPath(lockPath) {
        return this.path.join(lockPath, 'owner.json');
    }

    writeLeaseOwner(lease, pid) {
        this.fs.writeFileSync(this.ownerPath(lease.lockPath), JSON.stringify({
            pid,
            token: lease.token,
            createdAt: Date.now(),
        }), { encoding: 'utf8', mode: 0o600 });
    }

    readLeaseOwner(lockPath) {
        try {
            const owner = JSON.parse(this.fs.readFileSync(this.ownerPath(lockPath), 'utf8'));
            return owner && typeof owner.token === 'string' ? owner : null;
        } catch (_) {
            return null;
        }
    }

    isAbandonedLock(lockPath) {
        try {
            return Date.now() - this.fs.statSync(lockPath).mtimeMs > 30000;
        } catch (_) {
            return true;
        }
    }

    isProcessAlive(pid) {
        try {
            this.process.kill(pid, 0);
            return true;
        } catch (error) {
            return error?.code === 'EPERM';
        }
    }

    releaseLease(lease, pid = null) {
        try {
            const owner = this.readLeaseOwner(lease.lockPath);
            if (!owner || owner.token !== lease.token || (pid !== null && owner.pid !== pid)) return false;
            this.fs.rmSync(lease.lockPath, { recursive: true, force: true });
            return true;
        } catch (_) {
            return false;
        }
    }

    installInheritedLeaseCleanup() {
        const lockPath = this.process.env.RPG_REACTOR_INSTANCE_LOCK;
        const token = this.process.env.RPG_REACTOR_INSTANCE_TOKEN;
        if (!lockPath || !token || !this.process.once) return;
        const lease = { lockPath, token };
        // Released by token alone. The spawning editor records the pid of the
        // process it started, but this code runs in the NW.js window, whose
        // process.pid is its own — comparing them here never matches, which
        // silently disabled this cleanup. The lease token is unique per
        // reservation, so matching it is already proof of ownership.
        this.process.once('exit', () => this.releaseLease(lease));
    }
}

if (typeof window !== 'undefined') window.EditorInstanceBroker = EditorInstanceBroker;
if (typeof module !== 'undefined' && module.exports) module.exports = EditorInstanceBroker;
