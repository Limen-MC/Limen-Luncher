const crypto = require('crypto')
function localAccount(raw) {
    const name = String(raw).trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Pseudo : 3 à 16 lettres, chiffres ou tirets bas.')
    const bytes = crypto.createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest()
    bytes[6] = (bytes[6] & 15) | 48
    bytes[8] = (bytes[8] & 63) | 128
    const hex = bytes.toString('hex')
    const uuid = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
    return { uuid, username: name, displayName: name, accessToken: '0', type: 'offline' }
}
module.exports = { localAccount }
