# Windows 11 RAM Cleanup Log — HP 15s-du2xxx

**Date:** 2026-07-12
**Goal:** Idle RAM ≤ 3.5 GB
**Restore point:** "pre-cleanup" (SequenceNumber 1) created before any change.

## Baseline
- RAM used: **6.19 GB / 7.79 GB (79.5%)**
- Process count: **228**

## Hardware finding
- 2 memory slots, **1 filled** (`Bottom-Slot 1`, 8 GB Samsung DDR4-2667 SODIMM, part M471A1K43DB1-CTD).
- RAM is **removable (not soldered)**. Max supported 32 GB.

---

## CHANGES APPLIED (Phase A — reversible, no data touched)

### 1. System Restore point
- Enabled System Restore on C: and set creation-frequency throttle to 0.
- Created restore point "pre-cleanup".
- **UNDO (restore-frequency default):** `Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore" -Name "SystemRestorePointCreationFrequency"`

### 2. Services stopped + disabled
Original state: all were `Running / Auto` (except dmwappushservice = Stopped/Manual).

| Service | Original | Now |
|---|---|---|
| WSearch | Running/Auto | Stopped/Disabled |
| SysMain | Running/Auto | Stopped/Disabled |
| DiagTrack | Running/Auto | Stopped/Disabled |
| dmwappushservice | Stopped/Manual | Stopped/Disabled |
| HPAppHelperCap | Running/Auto | Stopped/Disabled |
| HPDiagsCap | Running/Auto | Stopped/Disabled |
| HPNetworkCap | Running/Auto | Stopped/Disabled |
| HPSysInfoCap | Running/Auto | Stopped/Disabled |
| HpTouchpointAnalyticsService | Running/Auto | Stopped/Disabled |
| HPPrintScanDoctorService | Running/Auto | Stopped/Disabled |

- **UNDO (restore Microsoft services to Auto):**
  `Set-Service WSearch -StartupType Automatic; Set-Service SysMain -StartupType Automatic; Set-Service DiagTrack -StartupType Automatic; Set-Service dmwappushservice -StartupType Manual`
- **UNDO (restore HP services to Auto):**
  `'HPAppHelperCap','HPDiagsCap','HPNetworkCap','HPSysInfoCap','HpTouchpointAnalyticsService','HPPrintScanDoctorService' | %{ Set-Service $_ -StartupType Automatic; Start-Service $_ }`

### 3. OneDrive
- Killed running process; removed HKCU Run key.
- Original Run value: `"C:\Program Files\Microsoft OneDrive\OneDrive.exe" /background`
- **UNDO:** `Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name OneDrive -Value '"C:\Program Files\Microsoft OneDrive\OneDrive.exe" /background'`
- Note: files remain synced/on disk; only auto-start was removed. Restart OneDrive anytime from Start menu.

### 4. Microsoft Defender
- Original: no exclusions; ScanAvgCPULoadFactor = 50.
- Added ExclusionProcess: Code.exe, electron.exe, git.exe, node.exe, npm.exe, python.exe
- Added ExclusionPath (11 active dev roots): OneDrive\Desktop\{ATTENDANCE,srinaryana-website,SAVESweb,APP}, Desktop\{ATTENDANCE,APP,SNHS PS AGENT,snhs-creative-agent}, anatomy-3d, bus-tracker, fee-test-app
- Set ScanAvgCPULoadFactor = 20
- **UNDO:**
  `Remove-MpPreference -ExclusionProcess Code.exe,electron.exe,git.exe,node.exe,npm.exe,python.exe`
  `Remove-MpPreference -ExclusionPath 'C:\Users\HP\OneDrive\Desktop\ATTENDANCE','C:\Users\HP\OneDrive\Desktop\srinaryana-website','C:\Users\HP\OneDrive\Desktop\SAVESweb','C:\Users\HP\OneDrive\Desktop\APP'`
  `Set-MpPreference -ScanAvgCPULoadFactor 50`

### 5. Visual effects
- Set VisualFXSetting = 2 (Best Performance). Transparency was already off (0).
- **UNDO:** `Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name VisualFXSetting -Value 3` (or delete the value to return to default/auto)

### 6. Pagefile
- Was: **Auto-managed, located on D: (HDD)**.
- Now: fixed **C:\pagefile.sys 8192 16384** (SSD only). Effective after reboot.
- **UNDO (return to Windows default auto-manage):**
  `$cs = Get-CimInstance Win32_ComputerSystem; Set-CimInstance -InputObject $cs -Property @{AutomaticManagedPagefile=$true}`

---

## CHANGES APPLIED (Phase B — approved)

### 7. Appx bloat removed (current user)
Removed: BingNews, BingWeather, Copilot, GamingApp, MixedReality.Portal, PowerAutomateDesktop,
Todos, Xbox.TCUI, XboxApp, XboxGameOverlay, XboxGamingOverlay, XboxSpeechToTextOverlay,
YourPhone, ZuneMusic, WebExperience (Widgets).
Kept: XboxIdentityProvider, XboxGameCallableUI (needed by some launchers).
- **UNDO (reinstall all for user):**
  `Get-AppxPackage -AllUsers Microsoft.BingNews,Microsoft.BingWeather,Microsoft.Copilot,Microsoft.GamingApp,Microsoft.MixedReality.Portal,Microsoft.PowerAutomateDesktop,Microsoft.Todos,Microsoft.Xbox.TCUI,Microsoft.XboxApp,Microsoft.XboxGameOverlay,Microsoft.XboxGamingOverlay,Microsoft.XboxSpeechToTextOverlay,Microsoft.YourPhone,Microsoft.ZuneMusic,MicrosoftWindows.Client.WebExperience | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\AppXManifest.xml" }`
  (or reinstall each from the Microsoft Store)

### 8. HP bloat software uninstalled
- HP One Agent (bundle + MSI) — uninstalled (exit 0).
- HP Connection Optimizer — uninstalled via InstallShield; stale registry key removed.
- HP Documentation — files already gone; stale registry key removed.
- **UNDO:** reinstall from HP Support Assistant / hp.com if ever needed (rarely).
- Kept: HP Audio Switch, HP PC Hardware Diagnostics UEFI, HP Software Framework.

### 9. Extra HP services disabled
- HP Comm Recovery (`HP Comm Recover`): was Auto → Disabled.
- HP One Agent Service (`hp-one-agent-service`): was Auto → Disabled.
- **UNDO:** `Set-Service 'HP Comm Recover' -StartupType Automatic; Set-Service 'hp-one-agent-service' -StartupType Automatic`

### 10. Startup entries disabled (HKCU Run backed up to run-key-backup.reg)
Disabled: HPSEU_Host_Launcher*, GoogleChromeAutoLaunch, MicrosoftEdgeAutoLaunch,
AdobeAAMUpdater-1.0, AdobeGCInvoker-1.0, Nearby Share, KVMS Pro Lite.
- *HPSEU_Host_Launcher was **RESTORED** afterward to protect Fn keys (HP System Event Utility drives them). Kept enabled.
- **UNDO (restore all):** `reg import "C:\Users\HP\OneDrive\Desktop\ATTENDANCE\run-key-backup.reg"`
  HKLM entries undo:
  `Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'AdobeAAMUpdater-1.0' -Value '"C:\Program Files (x86)\Common Files\Adobe\OOBE\PDApp\UWA\UpdaterStartupUtility.exe"'`
  `Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'AdobeGCInvoker-1.0' -Value '"C:\Program Files (x86)\Common Files\Adobe\AdobeGCClient\AGCInvokerUtility.exe"'`
  `Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'Nearby Share' -Value '"C:\Program Files\Google\NearbyShare\nearby_share_launcher.exe" --delayed_start'`

---

## VERIFICATION (pre-reboot)
- Audio services (Audiosrv, AudioEndpointBuilder, Realtek, Intel): Running ✅
- Wi-Fi (WlanSvc + adapter Up): ✅
- Defender real-time protection: Enabled ✅
- Touchpad (ETDService): Running ✅
- Fn keys (HPSEU launcher restored + running): ✅
- Brightness (WmiMonitorBrightness available): ✅

## NOTE
Pagefile + disabled services fully take effect after a **reboot**. True idle RAM must be
measured after reboot with nothing open. Estimated post-reboot idle: ~3.3–4.2 GB.

## FULL RESTORE (nuclear undo)
System Restore → choose "pre-cleanup" (rstrui.exe), OR run the individual UNDO commands above.
