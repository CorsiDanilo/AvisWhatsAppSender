function createWindowsShutdownScheduler({ execFile, platform = process.platform } = {}) {
  if (typeof execFile !== 'function') throw new TypeError('execFile deve essere una funzione.');

  function run(args) {
    if (platform !== 'win32') return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      execFile('shutdown', args, { windowsHide: true }, (error) => {
        if (error) reject(error);
        else resolve(true);
      });
    });
  }

  return {
    schedule: (seconds) => run(['/s', '/t', String(seconds), '/f']),
    cancel: () => run(['/a']),
  };
}

module.exports = { createWindowsShutdownScheduler };
