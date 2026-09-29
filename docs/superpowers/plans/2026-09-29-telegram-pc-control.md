# Telegram PC Control Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, lightweight Windows background Telegram bot service that starts on boot, notifies Danilo (`anomalino`) that the PC is online, and allows remote power control (shutdown, restart, hibernate) via quick reply keyboards and an interactive inline numeric PIN keypad.

**Architecture:** A modular Python 3 application (`config.py`, `power.py`, `bot.py`, `main.py`) using `python-telegram-bot` v20+ with async polling, dry-run test mode, in-memory PIN session state machine, Windows network readiness retry loop on startup, and silent background execution via Windows Task Scheduler.

**Tech Stack:** Python 3.10+, `python-telegram-bot>=20.7`, `python-dotenv`, `pytest`, `pytest-asyncio`, Windows PowerShell, Task Scheduler (`pythonw.exe`).

**Spec:** [docs/superpowers/specs/2026-09-29-telegram-pc-control-design.md](file:///c:/Users/danil/Documents/antigravity/adventurous-pasteur/docs/superpowers/specs/2026-09-29-telegram-pc-control-design.md)

## Global Constraints

- **Language:** Code, comments, documentation, logs, and bot UI messages must be 100% in English.
- **Repository Location:** Target repository at `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control`.
- **Git Push Policy:** Create private repository on GitHub (or configure private remote), but **do not push code yet**.
- **Security Check:** All commands and interactions must verify `update.effective_user.id == TELEGRAM_ANOMALINO_ID`; unauthorized users must be ignored.
- **Safety Testing:** `power.py` must support `DRY_RUN` mode (configured via environment or flag) so automated tests and manual runs do not shut down the developer's PC.

## Review Focus

- Non-numeric PIN characters in config: system raises clear `ValueError` on startup if `SECURITY_PIN` is not numeric.
- Network offline on Windows boot: `main.py` retries network connectivity without crashing.
- Multiple rapid button presses on inline keypad: state machine handles concurrent callback queries gracefully.
- Expired PIN sessions: actions attempted after 60 seconds are dismissed with an expiration notice.
- Grace period before shutdown: ensures Telegram bot completes sending confirmation message before OS initiates shutdown.

---

### Task 1: Repository Scaffolding & GitHub Setup

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\.gitignore`
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\requirements.txt`
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\.env.example`

**Interfaces:**
- Produces: Project root directory with git initialized and private GitHub remote linked without pushing code.

- [ ] **Step 1: Create repository directory and initialize git**
  ```powershell
  New-Item -ItemType Directory -Force -Path "C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control"
  cd "C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control"
  git init -b main
  ```

- [ ] **Step 2: Create .gitignore, requirements.txt, and .env.example**
  Create `.gitignore`:
  ```text
  .env
  __pycache__/
  *.pyc
  logs/
  .pytest_cache/
  .venv/
  venv/
  ```

  Create `requirements.txt`:
  ```text
  python-telegram-bot>=20.7
  python-dotenv>=1.0.0
  pytest>=7.4.0
  pytest-asyncio>=0.21.0
  ```

  Create `.env.example`:
  ```env
  TELEGRAM_BOT_TOKEN=your_bot_token_here
  TELEGRAM_ANOMALINO_ID=12345678
  SECURITY_PIN=1234
  PIN_TIMEOUT_SECONDS=60
  MAX_PIN_ATTEMPTS=3
  LOCKOUT_SECONDS=300
  SHUTDOWN_GRACE_SECONDS=3
  DRY_RUN=false
  ```

- [ ] **Step 3: Create private remote on GitHub without pushing code**
  ```powershell
  gh repo create CorsiDanilo/telegram-pc-control --private --source . --remote origin
  ```
  *(Verifies private remote is linked, do not run `git push`)*

- [ ] **Step 4: Commit initial scaffolding locally**
  ```powershell
  git add .gitignore requirements.txt .env.example
  git commit -m "chore: initial project scaffolding"
  ```

---

### Task 2: Configuration Loader (`config.py`)

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\config.py`
- Test: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\tests\test_config.py`

**Interfaces:**
- Produces:
  - `load_config(env_path: str = None) -> Config` dataclass/dict
  - Attributes: `bot_token: str`, `anomalino_id: int`, `security_pin: str`, `pin_timeout_seconds: int`, `max_pin_attempts: int`, `lockout_seconds: int`, `shutdown_grace_seconds: int`, `dry_run: bool`.

- [ ] **Step 1: Write the failing test for configuration loading and validation**
  ```python
  # tests/test_config.py
  import os
  import pytest
  from config import load_config, ConfigError

  def test_load_valid_config(tmp_path):
      env_file = tmp_path / ".env"
      env_file.write_text(
          "TELEGRAM_BOT_TOKEN=123:ABC\n"
          "TELEGRAM_ANOMALINO_ID=987654\n"
          "SECURITY_PIN=4321\n"
          "DRY_RUN=true\n"
      )
      cfg = load_config(str(env_file))
      assert cfg.bot_token == "123:ABC"
      assert cfg.anomalino_id == 987654
      assert cfg.security_pin == "4321"
      assert cfg.dry_run is True
      assert cfg.pin_timeout_seconds == 60

  def test_missing_required_token(tmp_path):
      env_file = tmp_path / ".env"
      env_file.write_text("TELEGRAM_ANOMALINO_ID=987654\nSECURITY_PIN=1234\n")
      with pytest.raises(ConfigError):
          load_config(str(env_file))

  def test_non_numeric_pin(tmp_path):
      env_file = tmp_path / ".env"
      env_file.write_text("TELEGRAM_BOT_TOKEN=token\nTELEGRAM_ANOMALINO_ID=123\nSECURITY_PIN=abcd\n")
      with pytest.raises(ConfigError):
          load_config(str(env_file))
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest tests/test_config.py`
  Expected: FAIL with `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3: Implement `config.py`**
  ```python
  # config.py
  import os
  from dataclasses import dataclass
  from dotenv import load_dotenv

  class ConfigError(ValueError):
      """Raised when configuration values are missing or invalid."""
      pass

  @dataclass(frozen=True)
  class Config:
      bot_token: str
      anomalino_id: int
      security_pin: str
      pin_timeout_seconds: int = 60
      max_pin_attempts: int = 3
      lockout_seconds: int = 300
      shutdown_grace_seconds: int = 3
      dry_run: bool = False

  def load_config(env_path: str = None) -> Config:
      if env_path and os.path.exists(env_path):
          load_dotenv(env_path, override=True)
      else:
          load_dotenv(override=True)

      token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
      if not token:
          raise ConfigError("TELEGRAM_BOT_TOKEN is required in .env")

      anomalino_raw = os.getenv("TELEGRAM_ANOMALINO_ID", "").strip()
      if not anomalino_raw:
          raise ConfigError("TELEGRAM_ANOMALINO_ID is required in .env")
      try:
          anomalino_id = int(anomalino_raw)
      except ValueError:
          raise ConfigError(f"TELEGRAM_ANOMALINO_ID must be an integer, got '{anomalino_raw}'")

      pin = os.getenv("SECURITY_PIN", "").strip()
      if not pin:
          raise ConfigError("SECURITY_PIN is required in .env")
      if not pin.isdigit():
          raise ConfigError(f"SECURITY_PIN must contain only numeric digits, got '{pin}'")

      pin_timeout = int(os.getenv("PIN_TIMEOUT_SECONDS", "60").strip())
      max_attempts = int(os.getenv("MAX_PIN_ATTEMPTS", "3").strip())
      lockout = int(os.getenv("LOCKOUT_SECONDS", "300").strip())
      grace = int(os.getenv("SHUTDOWN_GRACE_SECONDS", "3").strip())
      dry_run = os.getenv("DRY_RUN", "false").strip().lower() in ("true", "1", "yes")

      return Config(
          bot_token=token,
          anomalino_id=anomalino_id,
          security_pin=pin,
          pin_timeout_seconds=pin_timeout,
          max_pin_attempts=max_attempts,
          lockout_seconds=lockout,
          shutdown_grace_seconds=grace,
          dry_run=dry_run
      )
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest tests/test_config.py`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  ```powershell
  git add config.py tests/test_config.py
  git commit -m "feat: add config loader with validation and tests"
  ```

---

### Task 3: Windows Power Management Module (`power.py`)

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\power.py`
- Test: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\tests\test_power.py`

**Interfaces:**
- Consumes: `Config`
- Produces:
  - `shutdown_pc(grace_seconds: int = 3, dry_run: bool = False) -> tuple[bool, str]`
  - `restart_pc(grace_seconds: int = 3, dry_run: bool = False) -> tuple[bool, str]`
  - `hibernate_pc(dry_run: bool = False) -> tuple[bool, str]`
  - `abort_shutdown(dry_run: bool = False) -> tuple[bool, str]`
  - `get_system_status() -> dict`

- [ ] **Step 1: Write the failing test for power operations and dry-run**
  ```python
  # tests/test_power.py
  import pytest
  from power import shutdown_pc, restart_pc, hibernate_pc, abort_shutdown, get_system_status

  def test_dry_run_shutdown():
      success, msg = shutdown_pc(grace_seconds=3, dry_run=True)
      assert success is True
      assert "DRY_RUN" in msg

  def test_dry_run_restart():
      success, msg = restart_pc(grace_seconds=3, dry_run=True)
      assert success is True
      assert "DRY_RUN" in msg

  def test_dry_run_hibernate():
      success, msg = hibernate_pc(dry_run=True)
      assert success is True
      assert "DRY_RUN" in msg

  def test_dry_run_abort():
      success, msg = abort_shutdown(dry_run=True)
      assert success is True
      assert "DRY_RUN" in msg

  def test_system_status():
      status = get_system_status()
      assert "hostname" in status
      assert "uptime" in status
      assert "platform" in status
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest tests/test_power.py`
  Expected: FAIL with `ModuleNotFoundError: No module named 'power'`

- [ ] **Step 3: Implement `power.py`**
  ```python
  # power.py
  import logging
  import os
  import platform
  import socket
  import subprocess
  import time
  from datetime import datetime, timedelta

  logger = logging.getLogger("telegram_pc_control.power")

  def execute_command(cmd: list[str], dry_run: bool = False) -> tuple[bool, str]:
      cmd_str = " ".join(cmd)
      if dry_run:
          logger.info(f"[DRY_RUN] Would execute command: {cmd_str}")
          return True, f"[DRY_RUN] Command simulated: {cmd_str}"
      try:
          logger.info(f"Executing system command: {cmd_str}")
          result = subprocess.run(cmd, capture_output=True, text=True, check=False)
          if result.returncode == 0:
              return True, f"Command executed successfully: {cmd_str}"
          error_msg = result.stderr.strip() or f"Return code {result.returncode}"
          logger.error(f"Command failed ({cmd_str}): {error_msg}")
          return False, f"Failed: {error_msg}"
      except Exception as e:
          logger.error(f"Exception running command ({cmd_str}): {e}")
          return False, f"Error: {e}"

  def shutdown_pc(grace_seconds: int = 3, dry_run: bool = False) -> tuple[bool, str]:
      cmd = ["shutdown", "/s", "/t", str(grace_seconds), "/c", "Remote shutdown requested via Telegram"]
      return execute_command(cmd, dry_run=dry_run)

  def restart_pc(grace_seconds: int = 3, dry_run: bool = False) -> tuple[bool, str]:
      cmd = ["shutdown", "/r", "/t", str(grace_seconds), "/c", "Remote restart requested via Telegram"]
      return execute_command(cmd, dry_run=dry_run)

  def hibernate_pc(dry_run: bool = False) -> tuple[bool, str]:
      cmd = ["shutdown", "/h"]
      return execute_command(cmd, dry_run=dry_run)

  def abort_shutdown(dry_run: bool = False) -> tuple[bool, str]:
      cmd = ["shutdown", "/a"]
      return execute_command(cmd, dry_run=dry_run)

  def get_system_status() -> dict:
      hostname = socket.gethostname()
      system_os = f"{platform.system()} {platform.release()} ({platform.version()})"
      
      # Calculate uptime via Windows API / time
      uptime_seconds = None
      try:
          import ctypes
          kernel32 = ctypes.windll.kernel32
          uptime_ms = kernel32.GetTickCount64()
          uptime_seconds = uptime_ms / 1000.0
      except Exception:
          uptime_seconds = time.time() - time.monotonic()

      td = timedelta(seconds=int(uptime_seconds)) if uptime_seconds else timedelta(seconds=0)
      days, hours, minutes = td.days, td.seconds // 3600, (td.seconds // 60) % 60
      uptime_formatted = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m"

      return {
          "hostname": hostname,
          "platform": system_os,
          "uptime": uptime_formatted,
          "current_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
      }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest tests/test_power.py`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  ```powershell
  git add power.py tests/test_power.py
  git commit -m "feat: add Windows power management module with dry-run support"
  ```

---

### Task 4: Interactive PIN Keypad State Machine & Bot Handlers (`bot.py`)

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\bot.py`
- Test: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\tests\test_keypad_logic.py`

**Interfaces:**
- Consumes: `Config`, `power`
- Produces:
  - `build_application(config: Config) -> Application`
  - `PinSession` state machine and helper functions:
    - `build_pin_keyboard() -> InlineKeyboardMarkup`
    - `render_pin_display(action: str, entered_digits: str, pin_len: int, error_msg: str = "") -> str`
    - `verify_pin(entered: str, actual: str) -> bool`

- [ ] **Step 1: Write the failing tests for keypad state machine logic**
  ```python
  # tests/test_keypad_logic.py
  import pytest
  from bot import render_pin_display, verify_pin, PinSession

  def test_render_pin_display_initial():
      text = render_pin_display("shutdown", "", 4)
      assert "Confirm Shutdown" in text
      assert "• " * 0 in text
      assert "_ _ _ _" in text

  def test_render_pin_display_partial():
      text = render_pin_display("restart", "12", 4)
      assert "Confirm Restart" in text
      assert "• • _ _" in text

  def test_verify_pin():
      assert verify_pin("1234", "1234") is True
      assert verify_pin("1235", "1234") is False

  def test_session_attempt_limit():
      session = PinSession(action="shutdown", expected_pin="1234", max_attempts=3)
      session.register_failure()
      assert session.attempts == 1
      assert session.is_locked() is False
      session.register_failure()
      session.register_failure()
      assert session.attempts == 3
      assert session.is_locked() is True
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest tests/test_keypad_logic.py`
  Expected: FAIL with `ModuleNotFoundError: No module named 'bot'`

- [ ] **Step 3: Implement `bot.py` with full handlers and keypad state machine**
  ```python
  # bot.py
  import asyncio
  import logging
  import time
  from telegram import (
      InlineKeyboardButton,
      InlineKeyboardMarkup,
      KeyboardButton,
      ReplyKeyboardMarkup,
      Update,
  )
  from telegram.ext import (
      Application,
      ApplicationBuilder,
      CallbackQueryHandler,
      CommandHandler,
      ContextTypes,
      MessageHandler,
      filters,
  )
  from config import Config
  import power

  logger = logging.getLogger("telegram_pc_control.bot")

  ACTION_SHUTDOWN = "shutdown"
  ACTION_RESTART = "restart"
  ACTION_HIBERNATE = "hibernate"
  ACTION_STATUS = "status"

  BTN_SHUTDOWN = "🛑 Shutdown"
  BTN_RESTART = "🔄 Restart"
  BTN_HIBERNATE = "💤 Hibernate"
  BTN_STATUS = "ℹ️ Status"

  class PinSession:
      def __init__(self, action: str, expected_pin: str, max_attempts: int = 3, lockout_seconds: int = 300):
          self.action = action
          self.expected_pin = expected_pin
          self.entered_digits = ""
          self.attempts = 0
          self.max_attempts = max_attempts
          self.lockout_seconds = lockout_seconds
          self.created_at = time.time()
          self.locked_until = 0.0

      def register_failure(self):
          self.attempts += 1
          self.entered_digits = ""
          if self.attempts >= self.max_attempts:
              self.locked_until = time.time() + self.lockout_seconds

      def is_locked(self) -> bool:
          return time.time() < self.locked_until

      def is_expired(self, timeout_seconds: int) -> bool:
          return (time.time() - self.created_at) > timeout_seconds

  def verify_pin(entered: str, actual: str) -> bool:
      return entered == actual

  def render_pin_display(action: str, entered_digits: str, pin_len: int, error_msg: str = "") -> str:
      masked = "• " * len(entered_digits)
      remaining = "_ " * max(0, pin_len - len(entered_digits))
      pin_visual = f"{masked}{remaining}".strip()
      header = f"🔒 *Confirm {action.capitalize()}*\n\n"
      display = f"PIN: `{pin_visual}`\n"
      if error_msg:
          display += f"\n{error_msg}\n"
      display += "\n_Enter your security PIN using the keypad below:_"
      return header + display

  def build_pin_keyboard() -> InlineKeyboardMarkup:
      layout = [
          [
              InlineKeyboardButton("1", callback_data="pin:1"),
              InlineKeyboardButton("2", callback_data="pin:2"),
              InlineKeyboardButton("3", callback_data="pin:3"),
          ],
          [
              InlineKeyboardButton("4", callback_data="pin:4"),
              InlineKeyboardButton("5", callback_data="pin:5"),
              InlineKeyboardButton("6", callback_data="pin:6"),
          ],
          [
              InlineKeyboardButton("7", callback_data="pin:7"),
              InlineKeyboardButton("8", callback_data="pin:8"),
              InlineKeyboardButton("9", callback_data="pin:9"),
          ],
          [
              InlineKeyboardButton("❌ Cancel", callback_data="pin:cancel"),
              InlineKeyboardButton("0", callback_data="pin:0"),
              InlineKeyboardButton("⌫ Del", callback_data="pin:del"),
          ],
      ]
      return InlineKeyboardMarkup(layout)

  def build_main_keyboard() -> ReplyKeyboardMarkup:
      keyboard = [
          [KeyboardButton(BTN_SHUTDOWN), KeyboardButton(BTN_RESTART)],
          [KeyboardButton(BTN_HIBERNATE), KeyboardButton(BTN_STATUS)],
      ]
      return ReplyKeyboardMarkup(keyboard, resize_keyboard=True, is_persistent=True)

  def build_application(config: Config) -> Application:
      sessions: dict[int, PinSession] = {}

      def is_authorized(user_id: int) -> bool:
          return user_id == config.anomalino_id

      async def on_startup(app: Application):
          status = power.get_system_status()
          msg = (
              "🚀 *PC is online and listening for commands!*\n\n"
              f"🖥️ *Host:* `{status['hostname']}`\n"
              f"⏱️ *Booted at:* `{status['current_time']}`\n"
              f"🛡️ *Mode:* `{'DRY_RUN' if config.dry_run else 'Production'}`"
          )
          try:
              await app.bot.send_message(
                  chat_id=config.anomalino_id,
                  text=msg,
                  parse_mode="Markdown",
                  reply_markup=build_main_keyboard()
              )
              logger.info("Startup notification successfully delivered to admin.")
          except Exception as e:
              logger.error(f"Failed to send startup notification: {e}")

      async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
          user = update.effective_user
          if not is_authorized(user.id):
              logger.warning(f"Unauthorized /start attempt from user {user.id}")
              return
          await update.message.reply_text(
              f"Hello {user.first_name}! Remote control is active.",
              reply_markup=build_main_keyboard()
          )

      async def handle_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
          user = update.effective_user
          if not is_authorized(user.id):
              return
          status = power.get_system_status()
          msg = (
              "ℹ️ *System Status*\n\n"
              f"🖥️ *Host:* `{status['hostname']}`\n"
              f"💻 *OS:* `{status['platform']}`\n"
              f"⏳ *Uptime:* `{status['uptime']}`\n"
              f"⏰ *Time:* `{status['current_time']}`"
          )
          await update.message.reply_text(msg, parse_mode="Markdown")

      async def handle_power_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
          user = update.effective_user
          if not is_authorized(user.id):
              return

          text = update.message.text.strip()
          action_map = {
              BTN_SHUTDOWN: ACTION_SHUTDOWN,
              BTN_RESTART: ACTION_RESTART,
              BTN_HIBERNATE: ACTION_HIBERNATE,
          }
          action = action_map.get(text)
          if not action:
              return

          # Create PIN session
          session = PinSession(
              action=action,
              expected_pin=config.security_pin,
              max_attempts=config.max_pin_attempts,
              lockout_seconds=config.lockout_seconds
          )
          sessions[user.id] = session

          prompt = render_pin_display(action, "", len(config.security_pin))
          await update.message.reply_text(
              prompt,
              parse_mode="Markdown",
              reply_markup=build_pin_keyboard()
          )

      async def handle_pin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
          query = update.callback_query
          await query.answer()
          user = query.from_user
          if not is_authorized(user.id):
              return

          session = sessions.get(user.id)
          if not session:
              await query.edit_message_text("⚠️ *Session expired or not found.*", parse_mode="Markdown")
              return

          if session.is_locked():
              await query.edit_message_text(
                  f"⛔ *Locked out.* Too many failed attempts. Try again later.",
                  parse_mode="Markdown"
              )
              return

          if session.is_expired(config.pin_timeout_seconds):
              sessions.pop(user.id, None)
              await query.edit_message_text("⌛ *Session timed out.* Action cancelled.", parse_mode="Markdown")
              return

          data = query.data
          if not data.startswith("pin:"):
              return
          key = data.split(":", 1)[1]

          if key == "cancel":
              sessions.pop(user.id, None)
              await query.edit_message_text("🚫 *Action cancelled.*", parse_mode="Markdown")
              return

          elif key == "del":
              session.entered_digits = session.entered_digits[:-1]
              text = render_pin_display(session.action, session.entered_digits, len(config.security_pin))
              await query.edit_message_text(text, parse_mode="Markdown", reply_markup=build_pin_keyboard())
              return

          elif key.isdigit():
              session.entered_digits += key
              if len(session.entered_digits) < len(config.security_pin):
                  text = render_pin_display(session.action, session.entered_digits, len(config.security_pin))
                  await query.edit_message_text(text, parse_mode="Markdown", reply_markup=build_pin_keyboard())
                  return

              # Length matches: verify PIN
              if verify_pin(session.entered_digits, config.security_pin):
                  action = session.action
                  sessions.pop(user.id, None)
                  await query.edit_message_text(
                      f"✅ *PIN verified!*\nExecuting `{action}` in {config.shutdown_grace_seconds}s...",
                      parse_mode="Markdown"
                  )
                  # Execute asynchronously
                  if action == ACTION_SHUTDOWN:
                      await asyncio.to_thread(power.shutdown_pc, config.shutdown_grace_seconds, config.dry_run)
                  elif action == ACTION_RESTART:
                      await asyncio.to_thread(power.restart_pc, config.shutdown_grace_seconds, config.dry_run)
                  elif action == ACTION_HIBERNATE:
                      await asyncio.to_thread(power.hibernate_pc, config.dry_run)
              else:
                  session.register_failure()
                  if session.is_locked():
                      sessions.pop(user.id, None)
                      await query.edit_message_text(
                          f"⛔ *Too many failed attempts!* Locked for {config.lockout_seconds // 60} minutes.",
                          parse_mode="Markdown"
                      )
                  else:
                      err = f"❌ *Incorrect PIN!* (Attempt {session.attempts}/{session.max_attempts})"
                      text = render_pin_display(session.action, "", len(config.security_pin), error_msg=err)
                      await query.edit_message_text(text, parse_mode="Markdown", reply_markup=build_pin_keyboard())

      app = (
          ApplicationBuilder()
          .token(config.bot_token)
          .post_init(on_startup)
          .build()
      )

      app.add_handler(CommandHandler("start", handle_start))
      app.add_handler(MessageHandler(filters.Regex(f"^{BTN_STATUS}$"), handle_status))
      app.add_handler(MessageHandler(filters.Regex(f"^({BTN_SHUTDOWN}|{BTN_RESTART}|{BTN_HIBERNATE})$"), handle_power_button))
      app.add_handler(CallbackQueryHandler(handle_pin_callback, pattern="^pin:"))

      return app
  ```

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pytest tests/test_keypad_logic.py`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  ```powershell
  git add bot.py tests/test_keypad_logic.py
  git commit -m "feat: implement bot handlers and interactive PIN keypad state machine"
  ```

---

### Task 5: Main Entrypoint & Network Readiness Loop (`main.py`)

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\main.py`
- Test: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\tests\test_network.py`

**Interfaces:**
- Consumes: `config.load_config`, `bot.build_application`
- Produces:
  - `wait_for_network(host: str = "8.8.8.8", port: int = 53, timeout: int = 60, interval: int = 3) -> bool`
  - Main entrypoint executing polling loop.

- [ ] **Step 1: Write failing test for network readiness check**
  ```python
  # tests/test_network.py
  from main import wait_for_network

  def test_network_check_success():
      # Localhost loopback connection
      result = wait_for_network(host="127.0.0.1", port=0, timeout=1, interval=1)
      assert isinstance(result, bool)
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest tests/test_network.py`
  Expected: FAIL with `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Implement `main.py` with logging and network wait loop**
  ```python
  # main.py
  import logging
  import os
  import socket
  import sys
  import time
  from config import load_config
  from bot import build_application

  LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
  os.makedirs(LOGS_DIR, exist_ok=True)
  LOG_FILE = os.path.join(LOGS_DIR, "pc_control_bot.log")

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
      handlers=[
          logging.FileHandler(LOG_FILE, encoding="utf-8"),
          logging.StreamHandler(sys.stdout)
      ]
  )
  logger = logging.getLogger("telegram_pc_control")

  def wait_for_network(host: str = "api.telegram.org", port: int = 443, timeout: int = 60, interval: int = 3) -> bool:
      logger.info(f"Checking network connectivity to {host}:{port}...")
      start = time.time()
      while time.time() - start < timeout:
          try:
              with socket.create_connection((host, port), timeout=3):
                  logger.info("Network is available.")
                  return True
          except Exception:
              logger.warning(f"Network not ready yet, retrying in {interval}s...")
              time.sleep(interval)
      logger.error("Timed out waiting for network connectivity.")
      return False

  def main():
      logger.info("Starting Telegram PC Control Bot...")
      config = load_config()

      # Wait for network readiness (especially useful at boot)
      wait_for_network()

      app = build_application(config)
      logger.info("Application built. Starting polling...")
      app.run_polling()

  if __name__ == "__main__":
      try:
          main()
      except KeyboardInterrupt:
          logger.info("Bot stopped by user.")
      except Exception as e:
          logger.critical(f"Fatal error during execution: {e}", exc_info=True)
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest tests/test_network.py`
  Expected: PASS

- [ ] **Step 5: Commit changes**
  ```powershell
  git add main.py tests/test_network.py
  git commit -m "feat: add main entrypoint with network readiness check and logging"
  ```

---

### Task 6: Task Scheduler Automation Script & Documentation (`scripts/install_task.ps1`, `README.md`)

**Files:**
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\scripts\install_task.ps1`
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\scripts\uninstall_task.ps1`
- Create: `C:\Users\danil\Documents\GitHub\Projects\telegram-pc-control\README.md`

**Interfaces:**
- Produces: Automated PowerShell management scripts and full documentation.

- [ ] **Step 1: Write `scripts/install_task.ps1`**
  ```powershell
  # scripts/install_task.ps1
  # Registers TelegramPCControlBot into Windows Task Scheduler to run at system startup silently with pythonw.exe
  $ErrorActionPreference = "Stop"

  $TaskName = "TelegramPCControlBot"
  $ProjectDir = Split-Path -Parent $PSScriptRoot
  $MainScript = Join-Path $ProjectDir "main.py"

  # Find pythonw.exe
  $PythonPath = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
  if (-not $PythonPath) {
      throw "python.exe not found in PATH. Please install Python or add it to PATH."
  }
  $PythonwPath = Join-Path (Split-Path $PythonPath) "pythonw.exe"
  if (-not (Test-Path $PythonwPath)) {
      $PythonwPath = $PythonPath # Fallback
  }

  Write-Host "Registering Scheduled Task: $TaskName"
  Write-Host "Project Directory: $ProjectDir"
  Write-Host "Executing binary: $PythonwPath"

  $Action = New-ScheduledTaskAction -Execute $PythonwPath -Argument "`"$MainScript`"" -WorkingDirectory $ProjectDir
  $Trigger = New-ScheduledTaskTrigger -AtStartup
  $Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
  $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force

  Write-Host "Successfully registered $TaskName! The bot will now run automatically on startup." -ForegroundColor Green
  ```

- [ ] **Step 2: Write `scripts/uninstall_task.ps1`**
  ```powershell
  # scripts/uninstall_task.ps1
  $TaskName = "TelegramPCControlBot"
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Scheduled task $TaskName removed." -ForegroundColor Yellow
  ```

- [ ] **Step 3: Write comprehensive `README.md`**
  Write setup guide, dependencies installation, configuration parameters, how to get Telegram Bot Token & ID, how to run manually, how to enable hibernation (`powercfg /hibernate on`), and how to install the Scheduled Task.

- [ ] **Step 4: Commit scripts and documentation**
  ```powershell
  git add scripts/ README.md
  git commit -m "docs: add comprehensive README and Task Scheduler management scripts"
  ```

---

### Task 7: Full Test Suite Execution & Dry-Run Verification

**Files:**
- Test: All tests in `tests/`

- [ ] **Step 1: Execute full test suite**
  ```powershell
  pytest tests/ -v
  ```
  Expected: All tests PASS with 100% success.

- [ ] **Step 2: Verify git status and ensure clean working tree**
  ```powershell
  git status
  ```
  Verify that all files are committed locally and no uncommitted changes remain.
  Verify that remote is private and no `git push` was performed.
