const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-integration-'))
app.setPath('userData', temp)
process.env.APPDATA = temp
process.env.LIMEN_UI_TEST = '1'
app.getVersion = () => require('../package.json').version
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('headless')
app.commandLine.appendSwitch('ozone-platform', 'headless')
const errors = []
app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', (_event, level, message) => {
        console.log('RENDER', level, message)
        if (level === 3 && /TypeError|ReferenceError|SyntaxError|Uncaught/.test(message)) errors.push(message)
    })
})
require('../index')
async function waitFor(fn, timeout = 15000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        if (await fn()) return
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    throw new Error('Délai dépassé pendant la vérification UI')
}
app.whenReady().then(async () => {
    await waitFor(() => BrowserWindow.getAllWindows().length)
    const win = BrowserWindow.getAllWindows()[0]
    win.hide()
    const js = code => win.webContents.executeJavaScript(code)
    await waitFor(() => js('typeof getCurrentView === "function" && getCurrentView() === "#welcomeContainer"').catch(() => false))
    await waitFor(() => js('getComputedStyle(document.getElementById("loadingContainer")).display === "none" && Number(getComputedStyle(document.getElementById("welcomeContainer")).opacity) === 1'))
    await js('document.getElementById("welcomeButton").click()')
    await waitFor(() => js('getCurrentView() === "#loginOptionsContainer"'))
    await new Promise(resolve => setTimeout(resolve, 1100))
    await waitFor(() => js('getComputedStyle(document.getElementById("loginOptionsContainer")).display !== "none" && Number(getComputedStyle(document.getElementById("loginOptionsContainer")).opacity) === 1'))
    await new Promise(resolve => setTimeout(resolve, 500))
    fs.writeFileSync(path.resolve(__dirname, '../docs/Connexion.png'), (await win.webContents.capturePage()).toPNG())
    await js('switchView(getCurrentView(), VIEWS.landing, 0, 0)')
    await new Promise(resolve => setTimeout(resolve, 600))
    await js('document.getElementById("limenNewsButton").click()')
    if (!await js('!document.getElementById("limenNewsPage").hidden && document.querySelector(".limenHome").hidden')) throw new Error('Page actualités inaccessible')
    if (await js('document.getElementById("limenInfoDialog").open')) throw new Error('Les actualités ouvrent encore un dialogue')
    await js('document.querySelectorAll(".limenNewsListItem")[1].click()')
    if (!await js('document.getElementById("limenArticleTitle").textContent.includes("ensemble")')) throw new Error('Sélection article impossible')
    await js('document.getElementById("limenNewsSearch").value="zzzzintrouvable";document.getElementById("limenNewsSearch").dispatchEvent(new Event("input"))')
    if (!await js('!document.getElementById("limenNewsEmpty").hidden && document.getElementById("limenNewsArticle").hidden')) throw new Error('Recherche vide incorrecte')
    await js('document.getElementById("limenNewsSearch").value="";document.getElementById("limenNewsSearch").dispatchEvent(new Event("input"));document.getElementById("limenNewsBack").click()')
    if (await js('document.querySelector(".limenHome").hidden')) throw new Error('Retour accueil impossible')
    if (await js('!!document.getElementById("limenAddress") || !!document.getElementById("limenCopyAddress") || !!document.getElementById("limenDiscordIdInput") || !!document.getElementById("limenDiscordSettings")')) throw new Error('Contrôles privés encore affichés')
    await js('document.getElementById("settingsMediaButton").click()')
    await waitFor(() => js('getCurrentView() === "#settingsContainer" && Number(getComputedStyle(document.getElementById("settingsContainer")).opacity) === 1'))
    await js('settingsNavItemListener(document.querySelector("[rSc=settingsTabLauncher]"), false)')
    await new Promise(resolve => setTimeout(resolve, 1100))
    await js('switchView(getCurrentView(), VIEWS.landing, 0, 0)')
    await new Promise(resolve => setTimeout(resolve, 300))
    const out = path.resolve(__dirname, '../docs')
    fs.mkdirSync(out, { recursive: true })
    for (const [width,height] of [[1280,820],[1000,720]]) {
        win.setSize(width,height)
        await new Promise(resolve => setTimeout(resolve, 350))
        const geometry = await js('({scroll:document.getElementById("landingContainer").scrollWidth,client:document.getElementById("landingContainer").clientWidth,play:document.getElementById("launch_button").getBoundingClientRect().width})')
        if (geometry.scroll > geometry.client + 1) throw new Error('Débordement horizontal')
        if (geometry.play < 100) throw new Error('Bouton Jouer trop petit')
        fs.writeFileSync(path.join(out,`Accueil_${width}.png`),(await win.webContents.capturePage()).toPNG())
    }
    await js('showLaunchFailure("Essai erreur", "<img src=x onerror=alert(1)>\\nCode : 1")')
    if (await js('document.querySelectorAll("#overlayDesc img").length')) throw new Error('HTML interprété dans les diagnostics')
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('INTEGRATION_OK : démarrage, bienvenue, connexion, actualités, réglages, identité intégrée et page actualités, affichages 1280 et 1000')
    app.exit(0)
}).catch(async error => { console.error(error); const win=BrowserWindow.getAllWindows()[0]; if(win) { try { console.log('DEBUG_STATE', await win.webContents.executeJavaScript('({url:location.href,view:typeof getCurrentView === "function" ? getCurrentView() : "absent",text:document.body.innerText.slice(0,1800)})')); fs.writeFileSync(path.join(temp,'failure.png'),(await win.webContents.capturePage()).toPNG()); console.log('DEBUG_IMAGE',path.join(temp,'failure.png')) } catch(e){console.log(e)} } app.exit(1) })
