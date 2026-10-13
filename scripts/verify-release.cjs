const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(label, command, args, cwd = root) {
  console.log(`\n[verify-release] ${label}`)
  const isWindowsNpm = process.platform === 'win32' && command === npmCommand
  const spawnCommand = isWindowsNpm ? (process.env.ComSpec || 'cmd.exe') : command
  const spawnArgs = isWindowsNpm ? ['/d', '/s', '/c', command, ...args] : args
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) {
    console.error(`[verify-release] ${label} failed to start: ${result.error.message}`)
    return false
  }
  if (result.status !== 0) {
    console.error(`[verify-release] ${label} failed with exit code ${result.status}`)
    return false
  }
  return true
}

const checks = [
  ['backend tests', npmCommand, ['test']],
  ['backend coverage', npmCommand, ['run', 'test:coverage']],
  ['GUI tests', npmCommand, ['run', 'test:gui']],
  ['GUI coverage', npmCommand, ['run', 'test:gui:coverage']],
  ['GUI lint', npmCommand, ['run', 'lint:gui']],
  ['GUI production build', npmCommand, ['run', 'build:gui']],
]

for (const [label, command, args] of checks) {
  if (!run(label, command, args)) process.exit(1)
}

const syntaxFiles = [
  path.join(root, 'electron', 'main.cjs'),
  path.join(root, 'electron', 'preload.cjs'),
  ...fs.readdirSync(path.join(root, 'sender'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(root, 'sender', file)),
]

for (const file of syntaxFiles) {
  if (!run(`syntax check ${path.relative(root, file)}`, process.execPath, ['--check', file])) process.exit(1)
}

console.log('\n[verify-release] all checks passed')
