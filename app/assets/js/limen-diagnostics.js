const fs = require('fs-extra')
const path = require('path')
function redact(value, secrets = []) {
    let text = String(value)
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(secret).join('[MASQUÉ]')
    return text.replace(/((?:accessToken|refreshToken|access_token|refresh_token)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[MASQUÉ]')
}
function createJournal(directory, secrets = []) {
    const file = path.join(directory, 'logs', 'dernier-lancement.log')
    let tail = '', written = 0
    try { fs.ensureDirSync(path.dirname(file)); fs.writeFileSync(file, '', { mode: 0o600 }) } catch (_) { /* Diagnostics must not prevent play. */ }
    return { file, get tail() { return tail }, write(value) {
        const line = redact(value, secrets).slice(0, 32000)
        tail = (tail + line + '\n').slice(-8000)
        if (written < 2 * 1024 * 1024) {
            try { fs.appendFileSync(file, line + '\n'); written += Buffer.byteLength(line) } catch (_) { /* Read-only directory. */ }
        }
    } }
}
function watchGame(child, { journal, onReady, onClose, onError, readyPattern, delay = 5000 }) {
    let timer, stopped = false, ready = false
    const started = Date.now()
    const output = data => {
        journal.write(data)
        if (!ready && !stopped && readyPattern.test(String(data))) {
            ready = true
            timer = setTimeout(() => { if (!stopped) onReady() }, Math.max(0, delay - (Date.now() - started)))
        }
    }
    child.stdout?.on('data', output)
    child.stderr?.on('data', output)
    const stop = () => { stopped = true; clearTimeout(timer); child.stdout?.removeListener('data', output); child.stderr?.removeListener('data', output) }
    child.once('error', err => { if (stopped) return; stop(); journal.write(err.message); onError(err) })
    child.once('close', (code, signal) => { if (stopped) return; stop(); journal.write(`Fin du processus : code=${code}, signal=${signal || 'aucun'}`); onClose(code, signal) })
    return stop
}
module.exports = { redact, createJournal, watchGame }
