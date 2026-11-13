const fs = require('fs')
const path = require('path')
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/limen.json'), 'utf8'))
if (!/^[a-z0-9.-]+:\d{1,5}$/i.test(config.server.address)) throw new Error('Adresse LIMEN invalide')
const port = Number(config.server.address.split(':')[1])
if (port < 1 || port > 65535) throw new Error('Port LIMEN invalide')
module.exports = config
