const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const fs = require('fs')
const os = require('os')
const vm = require('vm')
const { createRequire } = require('module')
const { EventEmitter } = require('events')
const ejs = require('ejs')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}, globals = {}) {
    const filename = path.join(root, file)
    const nativeRequire = createRequire(filename)
    const module = { exports: {} }
    const context = { module, exports: module.exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name), __dirname: path.dirname(filename), __filename: filename, process, console, Buffer, URL, structuredClone, setTimeout, clearTimeout, ...globals }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
    return module.exports
}
const config = require('../app/assets/js/limen-config')
const cm = {
    getCommonDirectory: () => '/tmp/limen/common', getInstanceDirectory: () => '/tmp/limen/instances',
    getMaxRAM: () => '4G', getMinRAM: () => '1G', getJVMOptions: () => [], getAutoConnect: () => true,
    getFullscreen: () => false, getGameWidth: () => 1280, getGameHeight: () => 720
}
test('Le catalogue local ne présente que LIMEN à la bonne adresse', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-test-'))
    try {
        const { DistroAPI } = load('app/assets/js/distromanager.js', { './configmanager': { getLauncherDirectory: () => dir } })
        DistroAPI.commonDir = path.join(dir, 'common')
        DistroAPI.instanceDir = path.join(dir, 'instances')
        const distro = await DistroAPI.getDistribution()
        assert.equal(distro.servers.length, 1)
        const server = distro.getMainServer()
        assert.equal(server.hostname, 'txadmin.sanna.studio')
        assert.equal(server.port, 30121)
        assert.equal(server.rawServer.autoconnect, true)
        assert.equal(server.rawServer.minecraftVersion, '26.3')
        assert.equal(server.effectiveJavaOptions.suggestedMajor, 25)
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'distribution.json'))).servers[0].modules, [])
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('Vanilla inclut le client.jar, rejoint LIMEN et ne modifie pas le manifeste', () => {
    const PB = load('app/assets/js/processbuilder.js', { './configmanager': cm, './ipcconstants': { AZURE_CLIENT_ID: 'public-test-id' } })
    const manifest = { id: '26.3', mainClass: 'net.minecraft.client.main.Main', type: 'release', assets: '26', libraries: [], arguments: { jvm: ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'], game: ['--username', '${auth_player_name}', '--uuid', '${auth_uuid}', '--accessToken', '${auth_access_token}', '--clientId', '${clientid}', '--xuid', '${auth_xuid}'] } }
    const server = { rawServer: { id: 'limen-main', minecraftVersion: '26.3', autoconnect: true }, modules: [], hostname: 'txadmin.sanna.studio', port: 30121 }
    const original = JSON.stringify(manifest)
    const pb = new PB(server, manifest, null, { displayName: 'Joueur', uuid: 'test-uuid', accessToken: 'test-token', type: 'microsoft' }, '3.0.0')
    pb._resolveMojangLibraries = () => ({})
    pb._resolveServerLibraries = () => ({})
    const args = pb.constructJVMArguments([], '/tmp/limen/natives')
    assert.ok(args.includes('net.minecraft.client.main.Main'))
    assert.ok(args.some(a => String(a).includes(path.join('versions', '26.3', '26.3.jar'))))
    assert.equal(args[args.indexOf('--quickPlayMultiplayer') + 1], config.server.address)
    assert.ok(!args.some(a => String(a).includes('${')))
    assert.equal(JSON.stringify(manifest), original)
    assert.deepEqual(Array.from(pb.constructJVMArguments([], '/tmp/limen/natives')), Array.from(args))
})
test('La réparation Vanilla refuse un fichier dont le hash ne correspond pas', async () => {
    let valid = false
    class Processor {
        async init() {}
        async validate() { return { client: [{ id: 'client', size: 10, url: 'https://example.invalid', path: '/tmp/client', algo: 'sha1', hash: 'expected' }] } }
        async postDownload() {}
    }
    const Repair = load('app/assets/js/limen-repair.js', { 'helios-core/dl': { MojangIndexProcessor: Processor, getExpectedDownloadSize: () => 10, downloadQueue: async (_assets, cb) => cb(10) }, 'helios-core/common': { validateLocalFile: async () => valid } })
    const repair = new Repair('/tmp/common')
    assert.equal(await repair.verifyFiles(() => {}), 1)
    await assert.rejects(repair.download(() => {}), /invalide/)
    valid = true
    await repair.download(() => {})
})
test('Discord absent, connexion tardive et fermeture restent sans erreur non gérée', async () => {
    const clients = []
    let timer
    class Client extends EventEmitter {
        constructor() { super(); clients.push(this) }
        async login(options) { this.loginOptions = options; if (clients.length === 1) throw new Error('ENOENT'); this.emit('ready') }
        async destroy() {}
        async setActivity(value) { this.activity = { ...value } }
    }
    const rpc = load('app/assets/js/discordwrapper.js', { 'discord-rpc-patch': { Client }, './limen-config': { ...config, discord: { ...config.discord, clientId: '123456789012345678' } }, 'fs-extra': { readJsonSync: () => { throw new Error('Une préférence locale ne doit plus définir l’identité Discord') } }, './configmanager': { getLauncherDirectory: () => '/tmp' } }, { setTimeout: fn => { timer = fn; return { unref() {} } }, clearTimeout: () => {} })
    rpc.updateDetails('Avant initialisation')
    assert.equal(rpc.initRPC({ clientId: '999999999999999999' }, {}, 'Sur LIMEN'), true)
    await new Promise(resolve => setImmediate(resolve))
    assert.ok(timer)
    assert.equal(clients[0].loginOptions.clientId, '123456789012345678')
    timer()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(clients[1].activity.details, 'Sur LIMEN')
    rpc.updateDetails('Session en cours')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(clients[1].activity.details, 'Session en cours')
    rpc.shutdownRPC()
    rpc.updateDetails('Après fermeture')
})
test('Les vues EJS se rendent en français avec les contrôles du moteur', async () => {
    const Lang = require('../app/assets/js/langloader')
    Lang.setupLanguage()
    const html = await ejs.renderFile(path.join(root, 'app/app.ejs'), { bkid: 0, lang: (key, values) => Lang.queryEJS(key, values) })
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    for (const id of ['launch_button','launch_content','launch_details','launch_progress','server_selection_button','user_text','avatarContainer','settingsMediaButton','newsContainer','newsButton','limenHeroVideo']) assert.ok(ids.includes(id), id)
    assert.equal(new Set(ids).size, ids.length, 'IDs DOM uniques')
    assert.match(html, /lang="fr"/)
    assert.match(html, /Jouer à LIMEN/)
    assert.ok(!html.includes('WesterosCraft'))
    assert.ok(!html.includes(config.server.address), 'Adresse de connexion absente des vues')
    assert.ok(!html.includes('limenCopyAddress'))
    assert.ok(!html.includes('limenDiscordIdInput'))
    assert.ok(html.includes('id="limenNewsPage"'))
    for (const match of html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"?]+)"/g)) assert.ok(fs.existsSync(path.join(root,'app',match[1])), match[1])
    const settings = Lang.queryEJS('settings.launchDetachedDesc')
    assert.match(settings, /Discord/)
})
test('Vanilla démarre même sans configuration de mods enregistrée', () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {}
    child.stderr = new EventEmitter(); child.stderr.setEncoding = () => {}
    let launched = false
    const PB = load('app/assets/js/processbuilder.js', {
        './configmanager': { ...cm, getModConfiguration: () => null, getTempNativeFolder: () => 'limen-test', getLaunchDetached: () => false, getJavaExecutable: () => 'java' },
        'fs-extra': { ensureDirSync() {} },
        'child_process': { spawn: (_java, args) => { launched = args.includes('net.minecraft.client.main.Main'); return child } }
    })
    const pb = new PB({ modules: [], rawServer: { id: 'limen-main', minecraftVersion: '26.3' } }, {}, null, { accessToken: 'secret' }, '3.1.0')
    pb.constructJVMArguments = () => ['net.minecraft.client.main.Main']
    assert.equal(pb.build(), child)
    assert.equal(launched, true)
})
test('Une fermeture pendant le chargement annule le timer et conserve une erreur expurgée', async () => {
    const { createJournal, watchGame } = require('../app/assets/js/limen-diagnostics')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-log-test-'))
    try {
        const journal = createJournal(dir, ['private-token'])
        const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter()
        let ready = 0, closeCode
        watchGame(child, { journal, readyPattern: /OpenAL/, delay: 20, onReady: () => ready++, onClose: code => { closeCode = code }, onError: () => assert.fail('Unexpected spawn error') })
        child.stdout.emit('data', 'OpenAL initialized')
        child.stdout.emit('data', 'OpenAL initialized')
        child.stderr.emit('data', 'Crash accessToken=private-token refresh_token=another-secret')
        child.emit('close', 1)
        await new Promise(resolve => setTimeout(resolve, 30))
        assert.equal(ready, 0)
        assert.equal(closeCode, 1)
        const log = fs.readFileSync(journal.file, 'utf8')
        assert.ok(!log.includes('private-token')); assert.ok(!log.includes('another-secret'))
        assert.match(log, /code=1/)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('Les bibliothèques natives sont entièrement extraites avant le lancement Java', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-natives-test-'))
    try {
        const zip = new (require('adm-zip'))()
        zip.addFile('windows/x64/lwjgl.dll', Buffer.from('native-test-bytes'))
        zip.addFile('META-INF/MANIFEST.MF', Buffer.from('metadata'))
        const jar = path.join(dir, 'libraries', 'natives.jar')
        fs.mkdirSync(path.dirname(jar), { recursive: true }); zip.writeZip(jar)
        const PB = load('app/assets/js/processbuilder.js', { './configmanager': { ...cm, getCommonDirectory: () => dir }, 'helios-core/common': { ...require('helios-core/common'), isLibraryCompatible: () => true } })
        const manifest = { libraries: [{ name: 'org.lwjgl:lwjgl:3.4.3:natives-windows', downloads: { artifact: { path: 'natives.jar' } } }] }
        const pb = new PB({ modules: [], rawServer: { id: 'limen-main' } }, manifest, null, {}, '3.1.1')
        const natives = path.join(dir, 'extracted')
        const libraries = pb._resolveMojangLibraries(natives)
        assert.equal(fs.readFileSync(path.join(natives, 'lwjgl.dll'), 'utf8'), 'native-test-bytes')
        assert.ok(Object.values(libraries).includes(jar), 'Le JAR natif reste aussi dans le classpath')
        assert.ok(!fs.existsSync(path.join(natives, 'MANIFEST.MF')))
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('Le lancement LIMEN embarqué utilise KnotClient et les bibliothèques Fabric', () => {
    const { mergeProfile } = require('../app/assets/js/limen-runtime')
    const profile = JSON.parse(fs.readFileSync(path.join(root, 'app/runtime/fabric-profile.json')))
    const manifest = mergeProfile({ id: '26.3', mainClass: 'net.minecraft.client.main.Main', type: 'release', assets: '26', libraries: [], arguments: { jvm: ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'], game: ['--username', '${auth_player_name}', '--uuid', '${auth_uuid}', '--accessToken', '${auth_access_token}'] } }, profile)
    const PB = load('app/assets/js/processbuilder.js', { './configmanager': cm, './ipcconstants': { AZURE_CLIENT_ID: 'public-test-id' } })
    const server = { rawServer: { id: 'limen-main', minecraftVersion: '26.3', autoconnect: true }, modules: [], hostname: 'txadmin.sanna.studio', port: 30121 }
    const pb = new PB(server, manifest, null, { displayName: 'Joueur', uuid: 'test-uuid', accessToken: 'test-token', type: 'microsoft' }, '3.2.0')
    const args = Array.from(pb.constructJVMArguments([], path.join(os.tmpdir(), 'limen-test-natives')))
    assert(args.includes('net.fabricmc.loader.impl.launch.knot.KnotClient'))
    const classpath = args[args.indexOf('-cp') + 1]
    assert(classpath.includes('fabric-loader-0.20.1.jar'))
    assert(classpath.includes(path.join('versions', '26.3', '26.3.jar')))
    assert(!args.some(arg => String(arg).includes('${')))
    assert.equal(args[args.indexOf('--quickPlayMultiplayer') + 1], config.server.address)
})
