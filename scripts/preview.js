const ejs = require('ejs')
const fs = require('fs')
const path = require('path')
const Lang = require('../app/assets/js/langloader')
Lang.setupLanguage()
async function main() {
    let html = await ejs.renderFile(path.join(__dirname, '../app/app.ejs'), { bkid: 0, lang: (key, values) => Lang.queryEJS(key, values) })
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    html = html.replace('</head>', '<style>#main{display:block!important}#landingContainer{display:block!important}#loadingContainer{display:none!important}</style></head>')
    const file = path.join(__dirname, '../app/preview.html')
    fs.writeFileSync(file, html)
    console.log(file)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
