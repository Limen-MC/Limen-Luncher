const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const AdmZip = require('adm-zip')

const defaultRoot = path.join(__dirname, '..', '..', 'runtime')
function inside(root, relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || path.posix.isAbsolute(relative)) throw new Error('Chemin de mod invalide')
    const result = path.resolve(root, relative)
    if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error('Chemin de mod invalide')
    return result
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
function atomicCopy(source, destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    if (fs.existsSync(destination) && sha256(source) === sha256(destination)) return
    const temporary = destination + '.limen-tmp-' + crypto.randomBytes(6).toString('hex')
    fs.copyFileSync(source, temporary)
    try { fs.renameSync(temporary, destination) } finally { fs.rmSync(temporary, { force: true }) }
}
function mergeProfile(vanilla, profile) {
    if (profile.inheritsFrom !== vanilla.id || typeof profile.mainClass !== 'string') throw new Error('Profil Fabric incompatible avec Minecraft')
    const merged = structuredClone(vanilla)
    const coordinates = new Set(profile.libraries.map(lib => lib.name.split(':').slice(0, 2).join(':')))
    merged.libraries = merged.libraries.filter(lib => !coordinates.has(lib.name.split(':').slice(0, 2).join(':'))).concat(structuredClone(profile.libraries))
    merged.arguments = {
        jvm: [...(vanilla.arguments.jvm || []), ...(profile.arguments?.jvm || [])],
        game: [...(vanilla.arguments.game || []), ...(profile.arguments?.game || [])]
    }
    // Keep the Mojang id: its real client jar remains in versions/26.3/26.3.jar.
    merged.mainClass = profile.mainClass
    merged.limenFabric = true
    return merged
}
function prepareRuntime(common, instances, serverId, vanilla, root = defaultRoot) {
    if (!/^[a-zA-Z0-9_-]+$/.test(serverId)) throw new Error('Instance Minecraft invalide')
    const bundle = JSON.parse(fs.readFileSync(path.join(root, 'bundle.json'), 'utf8'))
    const profile = JSON.parse(fs.readFileSync(path.join(root, 'fabric-profile.json'), 'utf8'))
    if (bundle.schemaVersion !== 1 || bundle.minecraft !== vanilla.id) throw new Error('Pack LIMEN incompatible avec cette version Minecraft')
    const merged = mergeProfile(vanilla, profile)
    for (const entry of [...bundle.mods, ...bundle.libraries]) {
        if (!/^[a-f0-9]{64}$/.test(entry.sha256) || sha256(inside(root, entry.file)) !== entry.sha256) throw new Error('Pack LIMEN endommagé : ' + entry.file)
    }
    const game = path.join(instances, serverId)
    const mods = path.join(game, 'mods')
    fs.mkdirSync(mods, { recursive: true })
    const managedIds = new Set(bundle.mods.map(mod => mod.id))
    const targets = new Map(bundle.mods.map(mod => [path.basename(mod.file), mod]))
    // Back up older copies of our mod IDs, preserving shaders and unrelated mods.
    for (const name of fs.readdirSync(mods)) {
        const file = path.join(mods, name)
        if (!name.endsWith('.jar') || !fs.statSync(file).isFile()) continue
        let id
        try {
            const entry = new AdmZip(file).getEntry('fabric.mod.json')
            if (entry) id = JSON.parse(entry.getData().toString('utf8')).id
        } catch (_error) { continue }
        const wanted = targets.get(name)
        if (managedIds.has(id) && (!wanted || sha256(file) !== wanted.sha256)) {
            const backup = path.join(game, 'limen-mod-backups', Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '-' + name)
            fs.mkdirSync(path.dirname(backup), { recursive: true })
            fs.renameSync(file, backup)
        }
    }
    for (const entry of bundle.mods) atomicCopy(inside(root, entry.file), path.join(mods, path.basename(entry.file)))
    for (const entry of bundle.libraries) atomicCopy(inside(root, entry.file), inside(path.join(common, 'libraries'), entry.path))
    return merged
}
module.exports = { prepareRuntime, mergeProfile, inside }
