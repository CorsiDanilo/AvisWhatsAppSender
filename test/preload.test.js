const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

function loadPreload() {
  const exposed = {}
  const listeners = new Map()
  const calls = []
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposed[name] = api
      },
    },
    ipcRenderer: {
      invoke(channel, ...args) {
        calls.push({ type: 'invoke', channel, args })
        return Promise.resolve({ channel, args })
      },
      on(channel, handler) {
        listeners.set(channel, handler)
      },
      removeListener(channel, handler) {
        calls.push({ type: 'removeListener', channel, handler })
        if (listeners.get(channel) === handler) listeners.delete(channel)
      },
    },
  }

  const originalLoad = Module._load
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electron
    return originalLoad.call(this, request, parent, isMain)
  }

  const preloadPath = require.resolve('../electron/preload.cjs')
  delete require.cache[preloadPath]
  try {
    require(preloadPath)
  } finally {
    Module._load = originalLoad
    delete require.cache[preloadPath]
  }

  return { api: exposed.whatsappSender, calls, listeners }
}

test('preload exposes every IPC operation with the expected channel and arguments', async () => {
  const { api, calls } = loadPreload()
  assert.ok(api)

  const cases = [
    ['inspectCsv', [], 'sender:inspect-csv'],
    ['inspectCsvSheet', ['file.csv', 'Foglio1'], 'sender:inspect-csv-sheet'],
    ['loadCsvMapped', ['file.csv', 'Foglio1', { name: 'Nome' }], 'sender:load-csv-mapped'],
    ['selectImage', [], 'sender:select-image'],
    ['clearImage', [], 'sender:clear-image'],
    ['removeAttachment', [0], 'sender:remove-attachment'],
    ['reorderAttachments', [0, 1], 'sender:reorder-attachments'],
    ['setAttachmentPosition', ['first'], 'sender:set-attachment-position'],
    ['selectPresetAttachment', [], 'sender:select-preset-attachment'],
    ['loadPresetAttachment', [{ fileName: 'a.pdf' }], 'sender:load-preset-attachment'],
    ['connect', [], 'sender:connect'],
    ['reconnect', [], 'sender:reconnect'],
    ['resetWhatsAppSession', [], 'sender:reset-whatsapp-session'],
    ['start', [{ message: 'ciao' }], 'sender:start'],
    ['pause', [], 'sender:pause'],
    ['resume', [], 'sender:resume'],
    ['stop', [], 'sender:stop'],
    ['setSelection', [2, true], 'sender:set-selection'],
    ['setAllSelected', [false], 'sender:set-all-selected'],
    ['updateDonor', [1, { name: 'Nome' }], 'sender:update-donor'],
    ['addDonor', [{ name: 'Nome Alternativo' }, ['email']], 'sender:add-donor'],
    ['saveSettings', [{ minDelayMs: 1000 }], 'sender:save-settings'],
    ['savePreset', [{ name: 'Test' }], 'sender:save-preset'],
    ['deletePreset', ['Test'], 'sender:delete-preset'],
    ['reset', [], 'sender:reset'],
    ['getState', [], 'sender:get-state'],
    ['selectOutputDir', [], 'sender:select-output-dir'],
    ['resetOutputDir', [], 'sender:reset-output-dir'],
    ['selectLogsDir', [], 'sender:select-logs-dir'],
    ['resetLogsDir', [], 'sender:reset-logs-dir'],
    ['openOutputDir', [], 'sender:open-output-dir'],
    ['openLastOutcome', [], 'sender:open-last-outcome'],
    ['openLogsDir', [], 'sender:open-logs-dir'],
    ['sendDeveloperReport', ['stack'], 'sender:send-developer-report'],
    ['clearGmailPassword', [], 'sender:clear-gmail-password'],
    ['openUserDataDir', [], 'sender:open-user-data-dir'],
    ['openPath', ['C:/tmp'], 'sender:open-path'],
    ['showItemInFolder', ['C:/tmp/file'], 'sender:show-item'],
    ['checkForUpdates', [], 'sender:check-for-updates'],
    ['downloadUpdate', [], 'sender:download-update'],
    ['installUpdate', [], 'sender:install-update'],
    ['checkBirthdays', [{ force: true }], 'sender:check-birthdays'],
    ['dismissBirthdayReminder', [], 'sender:dismiss-birthday-reminder'],
    ['toggleBirthdayInhibition', [], 'sender:toggle-birthday-inhibition'],
    ['prepareBirthdaySession', [], 'sender:prepare-birthday-session'],
    ['selectBirthdaySource', [], 'sender:select-birthday-source'],
    ['openBirthdays', [], 'sender:open-birthdays'],
    ['setStartWithWindows', [true], 'sender:set-start-with-windows'],
    ['setNotificationRead', ['notice-1', true], 'sender:set-notification-read'],
    ['markAllNotificationsRead', [], 'sender:mark-all-notifications-read'],
    ['clearAllNotifications', [], 'sender:clear-all-notifications'],
    ['deleteNotification', ['notice-1'], 'sender:delete-notification'],
    ['cancelPostAction', [], 'sender:cancel-post-action'],
  ]

  for (const [method, args, channel] of cases) {
    assert.equal(typeof api[method], 'function', `missing preload method ${method}`)
    await api[method](...args)
    const call = calls.at(-1)
    assert.deepEqual(call, { type: 'invoke', channel, args })
  }
})

test('preload state listeners forward payloads and can be removed safely', () => {
  const { api, listeners, calls } = loadPreload()
  const received = []
  const cleanup = api.onState((state) => received.push(state))
  const stateHandler = listeners.get('sender:state')
  assert.equal(typeof stateHandler, 'function')

  stateHandler({}, { connection: 'ready' })
  assert.deepEqual(received, [{ connection: 'ready' }])

  cleanup()
  assert.equal(listeners.has('sender:state'), false)
  assert.equal(calls.at(-1).type, 'removeListener')
  assert.equal(calls.at(-1).channel, 'sender:state')
})

test('preload open-birthdays listener does not leak the IPC event object', () => {
  const { api, listeners } = loadPreload()
  let calls = 0
  const cleanup = api.onOpenBirthdays(() => { calls += 1 })
  listeners.get('sender:open-birthdays')({ unexpected: true })
  assert.equal(calls, 1)
  cleanup()
})

test('every preload invoke channel has a corresponding Electron main handler', () => {
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8')
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8')
  const channels = [...preloadSource.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((match) => match[1])
  const missing = [...new Set(channels)].filter((channel) => !mainSource.includes(`registerHandler('${channel}'`))
  assert.deepEqual(missing, [])
})
