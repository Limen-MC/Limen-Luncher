/* global remote, ConfigManager, VIEWS, switchView, getCurrentView, settingsNavItemListener */
;(() => {
    document.querySelectorAll('video').forEach(video => video.addEventListener('error', () => { if (video.poster) { const img = document.createElement('img'); img.src = video.poster; img.className = video.className; img.alt = 'LIMEN'; video.replaceWith(img) } }, true))
    const limen = require('./assets/js/limen-config')
    const fs = require('fs-extra')
    const path = require('path')
    const $id = id => document.getElementById(id)
    const bind = (id, fn) => $id(id)?.addEventListener('click', fn)
    function info(title, text) {
        $id('limenDialogTitle').textContent = title
        $id('limenDialogText').textContent = text
        if (!$id('limenInfoDialog').open) $id('limenInfoDialog').showModal()
    }
    function open(url, missing) {
        if (/^https:\/\//.test(url || '')) require('electron').shell.openExternal(url)
        else info('La communauté LIMEN', missing)
    }
    async function settings(tab) {
        await prepareSettings()
        switchView(getCurrentView(), VIEWS.settings, 150, 200, () => {
            if (tab) {
                const item = document.querySelector(`[rSc="${tab}"]`)
                if (item) settingsNavItemListener(item, false)
            }
        })
    }
    bind('limenOpenLogs', async () => {
        const dir = path.join(ConfigManager.getLauncherDirectory(), 'logs')
        await fs.ensureDir(dir)
        await require('electron').shell.openPath(dir)
    })
    const home = document.querySelector('.limenHome')
    const newsPage = $id('limenNewsPage')
    const articles = (limen.news || []).map((article, index) => ({ ...article, index }))
    let selectedArticle = null
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    function selectArticle(article) {
        selectedArticle = article.index
        $id('limenArticleLabel').textContent = article.label || 'LIMEN / ACTUALITÉS'
        $id('limenArticleTitle').textContent = article.title
        $id('limenArticleBody').replaceChildren()
        const paragraphs = Array.isArray(article.body) ? article.body : String(article.body || article.text || '').split(/\n\s*\n/)
        for (const text of paragraphs) {
            const paragraph = document.createElement('p')
            paragraph.textContent = text
            $id('limenArticleBody').appendChild(paragraph)
        }
        for (const button of $id('limenNewsList').children) {
            const selected = Number(button.dataset.index) === selectedArticle
            button.classList.toggle('selected', selected)
            if (selected) button.setAttribute('aria-current', 'true')
            else button.removeAttribute('aria-current')
        }
    }
    function renderNews() {
        const query = normalize($id('limenNewsSearch').value.trim())
        const matches = articles.filter(article => normalize([article.title, article.label, article.text, ...(Array.isArray(article.body) ? article.body : [article.body])].join(' ')).includes(query))
        $id('limenNewsList').replaceChildren()
        $id('limenNewsCount').textContent = `${matches.length} actualité${matches.length === 1 ? '' : 's'}`
        $id('limenNewsArticle').hidden = !matches.length
        $id('limenNewsEmpty').hidden = !!matches.length
        for (const article of matches) {
            const button = document.createElement('button')
            button.className = 'limenNewsListItem'
            button.dataset.index = article.index
            const label = document.createElement('small')
            label.textContent = article.label || 'LIMEN'
            const title = document.createElement('strong')
            title.textContent = article.title
            const excerpt = document.createElement('span')
            excerpt.textContent = article.text || 'Lire l’actualité'
            button.append(label, title, excerpt)
            button.addEventListener('click', () => selectArticle(article))
            $id('limenNewsList').appendChild(button)
        }
        if (matches.length) selectArticle(matches.find(article => article.index === selectedArticle) || matches[0])
    }
    const showNews = () => {
        home.hidden = true
        newsPage.hidden = false
        $id('limenHomeButton').classList.remove('active')
        $id('limenNewsButton').classList.add('active')
        renderNews()
        $id('landingContainer').scrollTo({ top: 0 })
        $id('limenNewsPageTitle').focus({ preventScroll: true })
    }
    const showHome = () => {
        newsPage.hidden = true
        home.hidden = false
        $id('limenHomeButton').classList.add('active')
        $id('limenNewsButton').classList.remove('active')
        $id('landingContainer').scrollTo({ top: 0 })
    }
    bind('limenNewsBack', () => { showHome(); $id('limenAllNews').focus({ preventScroll: true }) })
    $id('limenNewsSearch').addEventListener('input', renderNews)
    $id('limenVersion').textContent = `Java ${limen.server.minecraftVersion}`
    $id('limenLauncherVersion').textContent = remote.app.getVersion()
    if (limen.news?.length) {
        $id('limenNewsLabel').textContent = limen.news[0].label
        $id('limenNewsTitle').textContent = limen.news[0].title
        $id('limenNewsText').textContent = limen.news[0].text
    }
    bind('limenQuickSettings', () => settings('settingsTabJava'))
    bind('limenAccountButton', () => settings('settingsTabAccount'))
    bind('limenAccountEdit', () => settings('settingsTabAccount'))
    bind('limenHomeButton', showHome)
    for (const id of ['limenNewsButton', 'limenAllNews', 'limenFeatureNews']) bind(id, showNews)
    for (const id of ['limenDiscordButton', 'limenCommunityLink']) bind(id, () => open(limen.discordInvite, 'Le lien du Discord sera annoncé prochainement.'))
    bind('limenWebsiteLink', () => open(limen.websiteUrl, 'Le site web sera annoncé prochainement.'))
    bind('limenShopLink', () => open(limen.shopUrl, 'La boutique LIMEN sera disponible prochainement.'))
    if (limen.shopUrl) $id('limenShopLink').firstChild.textContent = 'Découvrir la boutique '
    bind('limenNotificationsButton', () => info('Bienvenue sur LIMEN', 'Retrouve ton serveur, prépare ta session et lance Minecraft depuis cet espace. Les prochaines annonces seront affichées dans les nouvelles.'))
    bind('limenDialogClose', () => $id('limenInfoDialog').close())
    $id('limenInfoDialog').addEventListener('click', event => { if (event.target === $id('limenInfoDialog')) $id('limenInfoDialog').close() })
    document.addEventListener('limen-server-status', event => {
        const el = $id('limenServiceTag')
        el.dataset.online = event.detail.online
        el.textContent = event.detail.online ? '● En ligne' : '● Indisponible'
        $id('limenServerSummary').textContent = event.detail.online ? 'Prêt pour ta prochaine aventure.' : 'Vérifie ta connexion ou réessaie plus tard.'
    })
    document.addEventListener('limen-game-state', event => {
        if (event.detail === 'playing') $id('launch_button').innerHTML = '<span>Session en cours</span>'
        else if (event.detail === 'starting') $id('launch_button').innerHTML = '<span>Démarrage…</span>'
        else $id('launch_button').innerHTML = '<span>Jouer à LIMEN</span>'
    })
    let paused = localStorage.getItem('limen-motion') === 'paused' || matchMedia('(prefers-reduced-motion: reduce)').matches
    function applyMotion() {
        for (const video of document.querySelectorAll('video')) {
            video.muted = true
            if (paused) video.pause()
            else if (video.getClientRects().length && document.visibilityState !== 'hidden') video.play().catch(() => {})
        }
        $id('limenMotionButton').textContent = paused ? 'Activer les animations' : 'Pause des animations'
        $id('limenMotionButton').setAttribute('aria-pressed', String(paused))
    }
    bind('limenMotionButton', () => { paused = !paused; localStorage.setItem('limen-motion', paused ? 'paused' : 'playing'); applyMotion() })
    applyMotion()
    const observer = new IntersectionObserver(entries => {
        for (const { target, isIntersecting } of entries) {
            if (isIntersecting && !paused && document.visibilityState !== 'hidden') target.play().catch(() => {})
            else target.pause()
        }
    })
    for (const video of document.querySelectorAll('video')) observer.observe(video)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') for (const video of document.querySelectorAll('video')) video.pause()
        else applyMotion()
    })
})()
