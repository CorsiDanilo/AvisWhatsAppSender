# Changelog

All notable changes to the **AVIS WhatsApp Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-07

### Summary
First official production release of **AVIS WhatsApp Sender**. This release introduces a complete desktop application for managing personalized donor messaging via WhatsApp Web, featuring an automated in-app update mechanism and a continuous integration pipeline for Windows installer builds.

### Added
- **Auto-Updater System**: Integrated `electron-updater` with GitHub Releases provider for automated and manual update checks.
- **In-App Updates UI**: Dedicated "Aggiornamenti" (Updates) tab in the Settings modal with real-time download progress and one-click restart installation.
- **Update Notification Banner**: Prominent banner displayed on startup when a new release is available on GitHub.
- **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/build_installer.yml`) to automatically build NSIS Windows installers (`.exe`) and publish release artifacts upon pushing version tags (`v*`).
- **Core WhatsApp Automation**: WhatsApp Web client integration (`whatsapp-web.js`) with persistent authentication, QR code login, and robust session cleanup.
- **Recipient Management**: CSV and Excel donor list parsing, column mapping preview, telephone number normalization, and recipient selection.
- **Message Composer & Presets**: Dynamic template rendering (`[nome]`, `[cognome]`, etc.), image attachment with captions, and preset management.
- **Humanized Delivery Queue**: Anti-ban pacing with configurable min/max delay intervals, batch pauses, pause/resume/stop controls, and real-time progress tracking.
- **Session Reports & Logging**: Detailed outcome logging and session export in Excel (`.xlsx`) to user-defined directories.

### Fixed
- Resolved development environment version mismatch where `app.getVersion()` reported runtime Electron version instead of `package.json` application version.
- Hardened React state updates in the Settings modal to prevent blank screen crashes on update checks.
- Handled `console-message` deprecation warnings on modern Electron versions.
- Added explicit window display and focus handling on the `ready-to-show` lifecycle event.
