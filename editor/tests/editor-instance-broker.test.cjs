const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const EditorInstanceBroker = require(path.join(editorRoot, 'src', 'EditorInstanceBroker.js'));

function makeProcess(root, platform = 'linux') {
    const listeners = new Map();
    return {
        platform,
        pid: 500,
        execPath: platform === 'win32' ? path.join(root, 'RPG Reactor.exe') : path.join(root, 'RPGReactor'),
        env: platform === 'win32' ? { LOCALAPPDATA: root } : { XDG_CONFIG_HOME: root },
        cwd: () => root,
        kill(pid) {
            const error = new Error(`missing ${pid}`);
            error.code = 'ESRCH';
            throw error;
        },
        once(name, handler) { listeners.set(name, handler); },
        listeners,
    };
}

test('repeat app launches spawn isolated packaged editor processes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-instance-broker-'));
    const handlers = new Map();
    const processRef = makeProcess(root);
    const spawnCalls = [];
    const childHandlers = new Map();
    const child = {
        pid: 700,
        once(name, handler) { childHandlers.set(name, handler); },
        unref() { this.unreferenced = true; },
    };
    const app = {
        startPath: root,
        on(name, handler) { handlers.set(name, handler); },
    };
    const broker = new EditorInstanceBroker({
        app,
        process: processRef,
        fs,
        path,
        os: { homedir: () => root },
        spawn(executable, args, options) {
            spawnCalls.push({ executable, args, options });
            return child;
        },
    });

    try {
        assert.equal(broker.start(), true);
        handlers.get('open')('ignored second-launch command line');
        assert.equal(spawnCalls.length, 1);
        assert.equal(spawnCalls[0].executable, processRef.execPath);
        assert.equal(spawnCalls[0].args.length, 1, 'appended packages do not need a source path');
        assert.match(spawnCalls[0].args[0], /^--user-data-dir=/);
        assert.equal(spawnCalls[0].options.detached, true);
        assert.equal(child.unreferenced, true);
        assert.ok(spawnCalls[0].options.env.RPG_REACTOR_INSTANCE_LOCK);
        assert.ok(spawnCalls[0].options.env.RPG_REACTOR_INSTANCE_TOKEN);
        assert.equal(fs.existsSync(spawnCalls[0].options.env.RPG_REACTOR_INSTANCE_LOCK), true);

        childHandlers.get('exit')();
        assert.equal(fs.existsSync(spawnCalls[0].options.env.RPG_REACTOR_INSTANCE_LOCK), false);
        assert.equal(fs.existsSync(spawnCalls[0].args[0].slice('--user-data-dir='.length)), true,
            'profile data persists for slot reuse');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('profile leases skip live owners and recover stale owners', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-instance-slots-'));
    const processRef = makeProcess(root);
    processRef.kill = pid => {
        if (pid === 701) return;
        const error = new Error(`missing ${pid}`);
        error.code = 'ESRCH';
        throw error;
    };
    const broker = new EditorInstanceBroker({
        app: { on() {}, startPath: root },
        process: processRef,
        fs,
        path,
        os: { homedir: () => root },
        spawn() {},
        slotCount: 2,
    });

    try {
        const first = broker.reserveProfile();
        broker.writeLeaseOwner(first, 701);
        const second = broker.reserveProfile();
        assert.notEqual(second.profilePath, first.profilePath, 'a live profile is never shared');
        broker.writeLeaseOwner(second, 702);
        const recovered = broker.reserveProfile();
        assert.equal(recovered.profilePath, second.profilePath, 'a stale profile slot is reused');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('two launches reclaiming one stale slot never share a profile', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-instance-race-'));

    function makeBroker(instrumentedFs) {
        const processRef = makeProcess(root);
        // Every recorded owner is dead, so both launches judge slot 1 stale.
        processRef.kill = pid => {
            const error = new Error(`missing ${pid}`);
            error.code = 'ESRCH';
            throw error;
        };
        return new EditorInstanceBroker({
            app: { on() {}, startPath: root },
            process: processRef,
            fs: instrumentedFs || fs,
            path,
            os: { homedir: () => root },
            spawn() {},
            slotCount: 4,
        });
    }

    try {
        // Seed slot 1 with a lock whose owner is gone — the post-crash state
        // where both launches believe the slot is theirs to take.
        const slotRoot = makeBroker().profileRoot();
        fs.mkdirSync(slotRoot, { recursive: true });
        const stalePath = path.join(slotRoot, 'instance-1.lock');
        fs.mkdirSync(stalePath, { recursive: true });
        fs.writeFileSync(path.join(stalePath, 'owner.json'),
            JSON.stringify({ pid: 999999, token: 'dead', createdAt: 0 }));
        fs.utimesSync(stalePath, new Date(0), new Date(0));

        const first = makeBroker();
        const second = makeBroker();
        let firstLease = null;

        // Drive the losing interleaving: `second` clears the staleness gate on
        // the shared slot, then `first` takes the slot outright before `second`
        // acts on its now-outdated decision. Judging staleness once, outside the
        // takeover, is exactly what let both launches claim the same profile.
        second.isProcessAlive = () => {
            if (!firstLease) firstLease = first.reserveProfile();
            return false;
        };

        const secondLease = second.reserveProfile();

        assert.ok(firstLease, 'the winning launch takes the reclaimed slot');
        assert.ok(secondLease, 'the racing launch still gets a slot');
        assert.equal(firstLease.profilePath, path.join(slotRoot, 'instance-1'),
            'the winner reclaims the stale slot');
        assert.notEqual(secondLease.profilePath, firstLease.profilePath,
            'a reclaimed slot is never handed to two launches at once');
        assert.notEqual(secondLease.lockPath, firstLease.lockPath);
        assert.equal(fs.existsSync(firstLease.lockPath), true,
            'the loser does not delete the winner\'s lock');
        assert.equal(fs.existsSync(secondLease.lockPath), true);
        assert.equal(fs.existsSync(`${stalePath}.reclaim`), false, 'the reclaim mutex is released');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a reclaim mutex abandoned by a crashed launch is recovered', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-instance-mutex-'));
    const processRef = makeProcess(root);
    const broker = new EditorInstanceBroker({
        app: { on() {}, startPath: root },
        process: processRef,
        fs,
        path,
        os: { homedir: () => root },
        spawn() {},
        slotCount: 1,
    });

    try {
        const slotRoot = broker.profileRoot();
        fs.mkdirSync(slotRoot, { recursive: true });
        const reclaimPath = path.join(slotRoot, 'instance-1.lock.reclaim');

        fs.mkdirSync(reclaimPath, { recursive: true });
        assert.equal(broker.acquireReclaimMutex(reclaimPath), false, 'a live mutex blocks reclaim');

        fs.utimesSync(reclaimPath, new Date(0), new Date(0));
        assert.equal(broker.acquireReclaimMutex(reclaimPath), true, 'a stale mutex is recovered');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('generic NW runtimes receive the app path after the isolated profile switch', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-generic-nw-'));
    const processRef = makeProcess(root, 'win32');
    processRef.execPath = path.join(root, 'nw.exe');
    const broker = new EditorInstanceBroker({
        app: { on() {}, startPath: path.join(root, 'editor') },
        process: processRef,
        fs,
        path,
        os: { homedir: () => root },
        spawn() {},
    });

    try {
        assert.deepEqual(broker.buildLaunchArgs(path.join(root, 'profile')), [
            `--user-data-dir=${path.join(root, 'profile')}`,
            path.join(root, 'editor'),
        ]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('editor startup loads the launch broker and avoids deprecated manifest flags', () => {
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    const main = fs.readFileSync(path.join(editorRoot, 'src', 'main.js'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(editorRoot, 'package.json'), 'utf8'));
    assert.ok(html.indexOf('src/EditorInstanceBroker.js') < html.indexOf('src/main.js'));
    assert.match(main, /EditorInstanceBroker\.startForCurrentApp\(\)/);
    assert.equal('single-instance' in manifest, false);
});
