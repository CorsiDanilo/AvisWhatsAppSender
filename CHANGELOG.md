# Changelog

All notable changes to the **AVIS WhatsApp Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-10-08

### Added
- **Promemoria compleanni**: controllo all'avvio della lista configurata, riconoscimento delle date di nascita e preparazione guidata di una sessione di auguri, senza invio automatico.
- **Notifiche Windows e centro notifiche**: avviso per i compleanni, indicatore di elementi non letti e storico persistente separato tra notifiche da leggere e già lette.
- **Indicatori nell'app e nell'area di notifica**: pallino rosso per promemoria compleanni e notifiche non lette nella barra dell'applicazione, nella taskbar e nell'icona di sistema.
- **Allegati nei preset**: ogni modello può conservare un'immagine JPG, JPEG o PNG nell'area dati interna dell'applicazione.
- **Avvio con Windows**: opzione per avviare l'applicazione all'accesso dell'utente e controllare i compleanni all'apertura.
- **Tutorial operativo aggiornato**: guida interattiva e manuale in-app allineati alle nuove funzioni.

### Changed
- Riordinate le sezioni delle impostazioni e uniformata l'interfaccia dei compleanni, dei modelli e delle azioni di promemoria.
- L'uscita dal menu dell'icona di sistema chiude ora effettivamente l'applicazione.

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
