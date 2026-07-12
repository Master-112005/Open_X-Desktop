!macro customUnInstall
  ; =========================================================
  ; OpenX Pre-Uninstall Shutdown
  ; Gracefully terminates OpenX before uninstallation
  ; =========================================================

  DetailPrint "Checking for running OpenX instance..."

  ; Step 1: Request graceful shutdown (sends WM_CLOSE to all windows)
  DetailPrint "Requesting graceful shutdown of OpenX..."
  ExecWait 'taskkill /IM OpenX.exe /T' $0

  ; Wait up to 5 seconds for graceful shutdown
  Sleep 500
  DetailPrint "Waiting for OpenX to close..."
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500
  Sleep 500

  ; Step 2: Check if still running using FindWindow
  FindWindow $R0 "" "OpenX"
  StrCmp $R0 0 uninstall_done

  ; Step 3: Force kill if still running
  DetailPrint "OpenX did not close gracefully. Force terminating..."
  ExecWait 'taskkill /IM OpenX.exe /F'

  uninstall_done:
    DetailPrint "OpenX shutdown complete. Proceeding with uninstallation..."
!macroend