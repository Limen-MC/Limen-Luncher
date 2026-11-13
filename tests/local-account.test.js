const test = require('node:test')
const assert = require('node:assert/strict')
const { localAccount } = require('../app/assets/js/limen-local-account')
test('Compte local : identité stable sans mot de passe ni faux jeton Microsoft', () => {
    const account = localAccount('Notch')
    assert.equal(account.uuid, 'b50ad385-829d-3141-a216-7e7d7539ba7f')
    assert.equal(account.type, 'offline')
    assert.equal(account.accessToken, '0')
    assert.equal(account.password, undefined)
    assert.deepEqual(account, localAccount(' Notch '))
    assert.notEqual(account.uuid, localAccount('notch').uuid)
})
test('Compte local : pseudos invalides refusés', () => {
    for (const name of ['', 'ab', 'a'.repeat(17), '../test', 'deux mots', 'éclair', '<script>']) {
        assert.throws(() => localAccount(name))
    }
})
