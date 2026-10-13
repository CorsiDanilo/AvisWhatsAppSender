class SendTimeoutError extends Error {
  constructor(operation, timeoutMs) {
    super(`Timeout (${timeoutMs / 1000}s): ${operation}`);
    this.name = 'SendTimeoutError';
    this.code = 'SEND_TIMEOUT';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

function withTimeout(operation, timeoutMs, label, { onLateResolve, onLateReject } = {}) {
  let timedOut = false;
  let timer;
  const pending = Promise.resolve().then(() => (
    typeof operation === 'function' ? operation() : operation
  ));

  const observed = pending.then(
    (value) => {
      if (timedOut && onLateResolve) onLateResolve(value);
      return value;
    },
    (error) => {
      if (timedOut && onLateReject) onLateReject(error);
      throw error;
    },
  );

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new SendTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([observed, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { SendTimeoutError, withTimeout };
