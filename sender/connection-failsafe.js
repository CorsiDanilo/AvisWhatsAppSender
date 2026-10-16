function createConnectionFailsafe({
  getState = () => ({}),
  scheduleShutdown = () => {},
  cancelShutdown = () => {},
  saveOutcome = () => {},
  notifyEmergency,
  audit = () => {},
  publish = () => {},
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  countdownSeconds = 300,
} = {}) {
  let armed = false;
  let interval = null;

  function clearCountdown() {
    if (interval) clearIntervalFn(interval);
    interval = null;
  }

  async function arm(reason) {
    if (armed) return false;
    armed = true;

    const state = getState();
    const summary = { ...(state.progress || {}) };
    let secondsLeft = countdownSeconds;
    state.postSessionCountdown = { action: 'shutdown', secondsLeft, reason };
    saveOutcome('connection_lost', summary);
    scheduleShutdown(countdownSeconds);
    publish();

    interval = setIntervalFn(() => {
      secondsLeft = Math.max(0, secondsLeft - 1);
      const currentState = getState();
      if (currentState.postSessionCountdown) {
        currentState.postSessionCountdown = { action: 'shutdown', secondsLeft, reason };
        publish();
      }
      if (secondsLeft === 0) clearCountdown();
    }, 1000);
    interval?.unref?.();

    if (typeof notifyEmergency === 'function') {
      try {
        await notifyEmergency({ reason, summary, shutdownInSeconds: countdownSeconds });
        audit('info', 'connection_failsafe.notification_sent', { reason });
      } catch (error) {
        audit('warn', 'connection_failsafe.notification_failed', {
          reason,
          error: error?.message || String(error),
        });
      }
    }
    return true;
  }

  function cancel() {
    if (!armed) return false;
    armed = false;
    clearCountdown();
    getState().postSessionCountdown = null;
    cancelShutdown();
    publish();
    audit('info', 'connection_failsafe.cancelled');
    return true;
  }

  return { arm, cancel, isArmed: () => armed };
}

module.exports = { createConnectionFailsafe };
