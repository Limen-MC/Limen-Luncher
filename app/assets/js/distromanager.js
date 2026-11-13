const fs = require('fs-extra')
const path = require('path')
const { DistributionAPI } = require('helios-core/common')
const ConfigManager = require('./configmanager')
const limen = require('./limen-config')
const raw = {
    version: '1.0.0',
    rss: null,
    servers: [{
        id: limen.server.id,
        name: 'LIMEN Serveur',
        description: limen.tagline,
        icon: require('url').pathToFileURL(path.join(__dirname, '..', 'brand', 'logos', 'embleme.png')).href,
        version: '1.0.0',
        address: limen.server.address,
        minecraftVersion: limen.server.minecraftVersion,
        javaOptions: { supported: `>=${limen.server.javaMajor}.x`, suggestedMajor: limen.server.javaMajor, ram: { minimum: 2048, recommended: 4096 } },
        mainServer: true,
        autoconnect: true,
        discord: { shortId: 'LIMEN', largeImageKey: limen.discord.largeImageKey, largeImageText: limen.discord.largeImageText },
        modules: []
    }]
}
raw.discord = { clientId: limen.discord.clientId, smallImageText: 'LIMEN' }
// Bundled, deterministic catalogue: never downloads another community's servers.
const api = new DistributionAPI(ConfigManager.getLauncherDirectory(), null, null, null, false)
api.pullRemote = async () => ({ data: raw })
fs.ensureDirSync(ConfigManager.getLauncherDirectory())
fs.writeJsonSync(path.join(ConfigManager.getLauncherDirectory(), 'distribution.json'), raw)
exports.REMOTE_DISTRO_URL = null
exports.DistroAPI = api
exports.createDistribution = () => structuredClone(raw)
