# Technical Design Specification: Telegram PC Control Bot

**Date:** 2026-09-29  
**Target Repository:** `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control` (Private GitHub repository)  
**Author:** Danilo Corsi / Antigravity Pair  

---

## 1. Overview & Objectives

The goal is to develop a lightweight, reliable, and secure Python-based Windows background service / bot that enables remote control of the host PC via Telegram.

### Key Objectives
- **Automatic Boot Notification:** Upon Windows boot / startup, the bot initializes and proactively sends an alert message to Danilo (`TELEGRAM_ANOMALINO_ID`) stating the PC is online and ready.
- **Persistent Quick Keyboard:** A standard `ReplyKeyboardMarkup` providing accessible buttons for `🛑 Shutdown`, `🔄 Restart`, `💤 Hibernate`, and `ℹ️ Status`.
- **Interactive Inline Numeric PIN Keypad:** For security against accidental touches or unauthorized local access, critical power actions require a numeric PIN configured on the host machine. The PIN is entered via an interactive numeric inline keyboard (`[1-9]`, `[0]`, `[⌫ Del]`, `[❌ Cancel]`) with masked display (`••••`), 60s timeout, and failed attempt rate limiting.
- **Strict Authorization:** Only the configured Telegram user ID (`TELEGRAM_ANOMALINO_ID`) can interact with the bot. All other requests are ignored.
- **Windows System Integration:** Executes native power management commands (`shutdown /s`, `shutdown /r`, `shutdown /h`) with appropriate grace periods for message delivery.
- **Headless & Resilient Startup:** Designed to run silently in the background (via `pythonw.exe` and Windows Task Scheduler) with automatic network retry on startup.
- **Language:** Code, comments, documentation, logs, and bot user interface are 100% in English.

---

## 2. Architecture & File Structure

The project will reside at `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control` with the following structure:

```text
telegram-pc-control/
├── .env                  # Private environment variables (ignored by git)
├── .env.example          # Sample environment configuration template
├── .gitignore            # Git ignore file (.env, __pycache__, logs/, .venv/)
├── requirements.txt      # Python dependencies (python-telegram-bot>=20.7, python-dotenv)
├── README.md             # Comprehensive English documentation and setup guide
├── config.py             # Configuration loader, validator, and settings definitions
├── power.py              # Windows OS commands wrapper (shutdown, restart, hibernate, status)
├── bot.py                # Telegram bot application, handlers, and PIN keypad state machine
├── main.py               # Application entrypoint with network readiness check
└── scripts/
    └── install_task.ps1  # Automated PowerShell script to register Windows Task Scheduler job
```

---

## 3. Configuration & Environment

Environment variables are loaded from `.env` using `python-dotenv`:

| Variable | Type | Description | Required | Example |
| :--- | :--- | :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | string | Token provided by Telegram BotFather | Yes | `123456789:ABC...` |
| `TELEGRAM_ANOMALINO_ID` | integer | Authorized Telegram Chat ID (Danilo) | Yes | `12345678` |
| `SECURITY_PIN` | string | Secret numeric PIN required to authorize actions | Yes | `1234` |
| `PIN_TIMEOUT_SECONDS` | integer | Timeout in seconds for active PIN keypad session | No (default: 60) | `60` |
| `MAX_PIN_ATTEMPTS` | integer | Maximum consecutive failed PIN attempts | No (default: 3) | `3` |
| `LOCKOUT_SECONDS` | integer | Lockout duration after exceeding max attempts | No (default: 300) | `300` |
| `SHUTDOWN_GRACE_SECONDS`| integer | Delay before shutdown/reboot to flush network | No (default: 3) | `3` |

---

## 4. Security & State Management

### 4.1 Access Control Middleware / Decorator
Every incoming update (commands, text messages, inline callbacks) passes through an authorization filter:
- If `update.effective_user.id != TELEGRAM_ANOMALINO_ID`, log warning and silently drop the update.

### 4.2 Interactive PIN Keypad State Machine
- When a user presses a critical action button (`🛑 Shutdown`, `🔄 Restart`, `💤 Hibernate`), a session is initiated in an in-memory dictionary `_active_sessions[user_id]`:
  ```python
  {
      "action": "shutdown",       # "shutdown" | "restart" | "hibernate"
      "entered_pin": "",          # Accumulated digits
      "message_id": 1234,         # Telegram message ID of the inline keypad
      "created_at": 1727638000.0, # Timestamp for expiration check
      "attempts": 0               # Failed attempts count in current session
  }
  ```
- **Inline Keypad Layout:**
  ```text
  [ 1 ] [ 2 ] [ 3 ]
  [ 4 ] [ 5 ] [ 6 ]
  [ 7 ] [ 8 ] [ 9 ]
  [ ❌ Cancel ] [ 0 ] [ ⌫ Del ]
  ```
- **Visual Feedback:**
  - Display string: `PIN: ` + `• ` * len(entered_pin) + `_ ` * (len(SECURITY_PIN) - len(entered_pin))
- **Transitions:**
  - `Digit Pressed`: appends digit. When `len(entered_pin) == len(SECURITY_PIN)`:
    - If `entered_pin == SECURITY_PIN`: Edit message to `✅ PIN verified! Executing {action}...`, clean up session, and trigger power command asynchronously.
    - If `entered_pin != SECURITY_PIN`: Increment `attempts`. If `attempts >= MAX_PIN_ATTEMPTS`, lock out for `LOCKOUT_SECONDS` and edit message to `⛔ Too many failed attempts. Locked out for 5 minutes.`. Otherwise, reset `entered_pin` and show `❌ Incorrect PIN. Attempt X/3`.
  - `⌫ Del Pressed`: removes last digit if any.
  - `❌ Cancel Pressed`: terminates session, edits message to `🚫 Action cancelled.`.
  - `Timeout Check`: If timestamp exceeds `PIN_TIMEOUT_SECONDS`, session expires and prompt is invalidated.

---

## 5. Telegram UI & Command Handlers

### 5.1 Startup Notification (`post_init`)
Registered via `ApplicationBuilder.post_init(on_startup)`.
When the bot is initialized:
- Retrieves system hostname, local IP (optional), and startup time.
- Sends startup message to `TELEGRAM_ANOMALINO_ID`:
  ```text
  🚀 *PC is online and ready!*
  🖥️ *Host:* MY-DESKTOP
  ⏰ *Booted at:* 2026-09-29 21:35:00
  ```
- Displays the permanent `ReplyKeyboardMarkup`.

### 5.2 Main Menu (`ReplyKeyboardMarkup`)
```text
[ [ "🛑 Shutdown", "🔄 Restart" ],
  [ "💤 Hibernate", "ℹ️ Status" ] ]
```
- `resize_keyboard=True`, `is_persistent=True`.

### 5.3 Informational Command (`ℹ️ Status`)
Does not require PIN. Instantly replies with:
- System Hostname & Windows version.
- System Uptime (hours, minutes).
- RAM usage percentage and CPU summary (via standard library / `psutil` or `ctypes`).

---

## 6. Windows System Power Integration (`power.py`)

All commands are executed using `subprocess.run` asynchronously (`asyncio.to_thread`):

1. **Shutdown:**
   ```powershell
   shutdown /s /t <SHUTDOWN_GRACE_SECONDS> /c "Remote shutdown requested via Telegram"
   ```
2. **Restart:**
   ```powershell
   shutdown /r /t <SHUTDOWN_GRACE_SECONDS> /c "Remote restart requested via Telegram"
   ```
3. **Hibernate:**
   ```powershell
   shutdown /h
   ```
   *Note:* Ensures hibernation is enabled by checking or advising `powercfg /hibernate on`.
4. **Abort Shutdown:**
   ```powershell
   shutdown /a
   ```
   Can be invoked if cancellation is requested within grace period.

---

## 7. Windows Startup & Task Scheduler Integration

### 7.1 Startup Reliability (Network Readiness Loop)
When Windows boots, network interfaces may take 3-10 seconds to connect.
`main.py` implements a startup loop:
- Pings Telegram API / DNS with exponential backoff or 3-second delay up to 60 seconds.
- Once connectivity is established, proceeds with Telegram Application initialization.

### 7.2 Headless Execution
Executed via `pythonw.exe`, completely suppressing the console window.

### 7.3 Task Scheduler Automation (`scripts/install_task.ps1`)
A PowerShell script registers the scheduled task:
- **Task Name:** `TelegramPCControlBot`
- **Trigger:** At system startup (`-AtStartup`)
- **Principal:** Current user or SYSTEM with Highest Privileges (`-RunLevel Highest`)
- **Action:** Execute `pythonw.exe` passing `main.py` in the project root directory
- **Settings:** "Run whether user is logged on or not", restart on failure after 1 minute (3 attempts).

---

## 8. Testing & Verification Plan

### 8.1 Automated Unit Tests
- `tests/test_config.py`: Validates environment variable loading and defaults.
- `tests/test_keypad_logic.py`: Tests PIN validation, masking, deletion, attempt limits, and session timeouts without network.
- `tests/test_auth.py`: Ensures unauthorized Telegram IDs are blocked.

### 8.2 Live Integration Testing
- Mock power execution mode (`DRY_RUN=true` in `.env`) allowing full end-to-end testing of bot responses without shutting down the test machine.
- Verify startup message delivery to Danilo on bot launch.
- Test interactive keypad: click digits, delete, cancel, incorrect PIN limit, and successful PIN verification.
- Test actual `ℹ️ Status` command output.
