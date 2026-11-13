const { Client } = require('discord-rpc-patch')
const limen = require('./limen-config')
let client = null
let activity = null
let retry = null
let active = false
let connecting = false
let ready = false
let generation = 0
let settings = null

function scheduleReconnect(token) {
    if (!active || token !== generation || retry) return
    retry = setTimeout(() => { retry = null; connect(token) }, 15000)
    retry.unref?.()
}
async function publish() {
    if (!client || !ready || !activity) return
    try { await client.setActivity(activity) } catch (_error) { /* Discord may close independently. */ }
}
async function connect(token) {
    if (!active || connecting || token !== generation) return
    connecting = true
    const rpc = new Client({ transport: 'ipc' })
    client = rpc
    rpc.on('ready', () => {
        if (!active || token !== generation) { rpc.destroy().catch(() => {}); return }
        ready = true
        connecting = false
        publish()
    })
    rpc.on('disconnected', () => {
        if (rpc !== client || token !== generation) return
        ready = false
        connecting = false
        rpc.destroy().catch(() => {})
        client = null
        scheduleReconnect(token)
    })
    rpc.on('error', () => { /* Login errors are handled below. */ })
    try { await rpc.login({ clientId: settings.clientId }) } catch (_error) {
        if (rpc === client) { ready = false; connecting = false; client = null }
        await rpc.destroy().catch(() => {})
        scheduleReconnect(token)
    }
}
exports.initRPC = function(genSettings = {}, servSettings = {}, details = 'Préparation de la session') {
    exports.shutdownRPC()
    // Project-owned identity: never accept a per-user application ID override.
    settings = { ...genSettings, clientId: limen.discord.clientId }
    if (!limen.discord.enabled || !/^\d{17,20}$/.test(settings.clientId || '')) return false
    activity = {
        details: details || limen.discord.details,
        state: limen.discord.state,
        largeImageKey: limen.discord.largeImageKey || servSettings.largeImageKey,
        largeImageText: limen.discord.largeImageText || servSettings.largeImageText,
        startTimestamp: Date.now(),
        instance: false
    }
    const buttons = []
    if (/^https:\/\//.test(limen.websiteUrl)) buttons.push({ label: 'Découvrir LIMEN', url: limen.websiteUrl })
    if (/^https:\/\//.test(limen.discordInvite)) buttons.push({ label: 'Notre Discord', url: limen.discordInvite })
    if (buttons.length) activity.buttons = buttons
    active = true
    connect(++generation)
    return true
}
exports.updateDetails = function(details) {
    if (!activity) return
    activity.details = details
    publish()
}
exports.shutdownRPC = function() {
    active = false
    generation++
    clearTimeout(retry)
    retry = null
    const previous = client
    client = null
    ready = connecting = false
    activity = null
    if (previous) previous.destroy().catch(() => {})
}
