const { EventEmitter } = require('events')
const { MojangIndexProcessor, downloadQueue, getExpectedDownloadSize } = require('helios-core/dl')
const { validateLocalFile } = require('helios-core/common')

/** Adapter for the vanilla profile. Uses Helios' official Mojang download pipeline. */
class LimenRepair {
    constructor(commonDirectory, _instances, _launcher, _serverId, _devMode) {
        this.processor = new MojangIndexProcessor(commonDirectory, require('./limen-config').server.minecraftVersion)
        this.childProcess = new EventEmitter()
        this.assets = []
    }
    spawnReceiver() { /* Vanilla validation runs asynchronously in this process. */ }
    destroyReceiver() { this.childProcess.removeAllListeners() }
    async verifyFiles(onProgress) {
        await this.processor.init()
        const results = await this.processor.validate(() => onProgress(100))
        this.assets = Object.values(results).flat()
        return this.assets.length
    }
    async download(onProgress) {
        const total = getExpectedDownloadSize(this.assets)
        await downloadQueue(this.assets, received => onProgress(total ? Math.min(100, Math.floor(100 * received / total)) : 100))
        // A completed transfer is not enough: verify every downloaded hash.
        for (const asset of this.assets) {
            if (!await validateLocalFile(asset.path, asset.algo, asset.hash)) {
                throw new Error(`Fichier Minecraft invalide après téléchargement : ${asset.id}`)
            }
        }
        await this.processor.postDownload()
    }
}
module.exports = LimenRepair
