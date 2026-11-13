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
    const out = path.resolve(__dirname, '../docs/layout')
    fs.mkdirSync(out, { recursive: true })
    for (const [width, height] of [[1920,1032],[1280,820],[1000,720]]) {
        win.setSize(width,height)
        await waitFor(() => js('getComputedStyle(document.getElementById("settingsContainer")).display !== "none" && Number(getComputedStyle(document.getElementById("settingsContainer")).opacity) === 1'))
        for (const tab of ['Account','Minecraft','Mods','Java','Launcher','About','Update']) {
            await js(`settingsNavItemListener(document.querySelector('[rSc="settingsTab${tab}"]'), false)`)
            await new Promise(resolve => setTimeout(resolve, 180))
            const geometry = await js(`(() => {
                const el=document.getElementById('settingsTab${tab}');const pane=el.getBoundingClientRect();
                const blocks=[...el.children].filter(x=>x.getClientRects().length && getComputedStyle(x).position!=='absolute' && x.tagName!=='SCRIPT');
                return {scroll:el.scrollWidth,client:el.clientWidth,bad:blocks.filter(x=>x.getBoundingClientRect().right>pane.right-10).map(x=>x.id||x.className),done:document.getElementById('settingsNavDone').getBoundingClientRect().bottom,viewport:innerHeight}
            })()`)
            if(geometry.scroll>geometry.client+1 || geometry.bad.length || geometry.done>geometry.viewport) throw new Error('Settings overflow '+width+' '+tab+' '+JSON.stringify(geometry))
            if(width===1280 || tab==='Launcher') fs.writeFileSync(path.join(out,`Parametres_${tab}_${width}.png`),(await win.webContents.capturePage()).toPNG())
        }
        await js('switchView(getCurrentView(),VIEWS.landing,0,0)')
        await new Promise(resolve => setTimeout(resolve, 450))
        const home = await js('(() => {const b=document.querySelector(".limenAccountChip").getBoundingClientRect();const u=document.getElementById("user_text").getBoundingClientRect();const c=document.querySelector(".limenNewsCard").getBoundingClientRect();const i=document.querySelector(".limenNewsImage").getBoundingClientRect();return {scroll:landingContainer.scrollWidth,client:landingContainer.clientWidth,badge:u.left>=b.left && u.right<=b.right,image:Math.abs(i.top-c.top-1)<2}})()')
        if(!home.badge || !home.image || home.scroll>home.client+1) throw new Error('Home overflow '+width)
        fs.writeFileSync(path.join(out,`Accueil_${width}.png`),(await win.webContents.capturePage()).toPNG())
        await js('document.getElementById("limenNewsButton").click()')
        await new Promise(resolve => setTimeout(resolve, 400))
        const news = await js('(() => {const page=document.getElementById("limenNewsPage");return {w:page.clientWidth,scroll:page.scrollWidth,list:document.querySelectorAll(".limenNewsListItem").length}})()')
        if(news.scroll>news.w+1 || news.list!==2) throw new Error('News overflow '+width+' '+JSON.stringify(news))
        fs.writeFileSync(path.join(out,`Actualites_${width}.png`),(await win.webContents.capturePage()).toPNG())
        await js('document.getElementById("limenNewsBack").click()')
        await js('showLaunchFailure("Minecraft s’est arrêté", "Code : 4294967293\\n\\n" + Array(65).fill("NoClassDefFoundError: Could not initialize class org.lwjgl.system.Library — exemple de journal long, sans compte ni chemin personnel").join("\\n"))')
        await waitFor(() => js('Number(getComputedStyle(document.getElementById("overlayContainer")).opacity) === 1')); await new Promise(resolve=>setTimeout(resolve,100))
        const dialog = await js('(() => {const d=document.getElementById("overlayContent").getBoundingClientRect();const a=document.getElementById("overlayAcknowledge").getBoundingClientRect(); return {left:d.left,right:d.right,bottom:d.bottom,top:d.top,action:a.bottom,w:innerWidth,h:innerHeight}})()')
        if(dialog.left<0 || dialog.right>dialog.w || dialog.top<32 || dialog.bottom>dialog.h || dialog.action>dialog.h) throw new Error('Dialog overflow '+JSON.stringify(dialog))
        fs.writeFileSync(path.join(out,`Erreur_${width}.png`),(await win.webContents.capturePage()).toPNG())
        await js('toggleOverlay(false); switchView(getCurrentView(),VIEWS.settings,0,0)')
        await new Promise(resolve=>setTimeout(resolve,300))
    }
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('LAYOUT_OK : 7 onglets, accueil, page actualités et dialogue long — 1920, 1280, 1000 pixels')
    app.exit(0)
}).catch(async error => { console.error(error); const win=BrowserWindow.getAllWindows()[0]; if(win) { try { console.log('DEBUG_STATE', await win.webContents.executeJavaScript('({url:location.href,view:typeof getCurrentView === "function" ? getCurrentView() : "absent",text:document.body.innerText.slice(0,1800)})')); fs.writeFileSync(path.join(temp,'failure.png'),(await win.webContents.capturePage()).toPNG()); console.log('DEBUG_IMAGE',path.join(temp,'failure.png')) } catch(e){console.log(e)} } app.exit(1) })
