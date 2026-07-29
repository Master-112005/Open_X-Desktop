const { execFileSync } = require('child_process');
const Logger = require('../../assistant/Data').Logger;
const Normalizer = require('../../assistant/Data').Normalizer;

const POWERSHELL_EXECUTABLE = 'powershell.exe';
const DEFAULT_POWERSHELL_TIMEOUT_MS = 6000;
const WINDOW_ENUMERATION_TIMEOUT_MS = 10000;
const BROWSER_UIA_TIMEOUT_MS = 12000;
const PROCESS_WINDOW_TIMEOUT_MS = 3000;
const FOREGROUND_TIMEOUT_MS = 5000;
const MAX_WINDOW_QUERY_LENGTH = 240;
const MAX_SEND_KEYS_LENGTH = 512;
const DEFAULT_SEND_KEYS_SETTLE_DELAY_MS = 220;
const MAX_URL_LENGTH = 4096;
const PROCESS_NAME_PATTERN = /^[a-z0-9._-]+$/;
const URI_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function escapePowerShell(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function parseJsonArray(output) {
  const text = String(output || '').trim();
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
}

function parseJsonObject(output) {
  const text = String(output || '').trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function normalizeProcessNames(processNames = []) {
  const values = Array.isArray(processNames) ? processNames : [processNames];
  return [...new Set(values
    .map(name => Normalizer.normalizeText(name).replace(/\.exe$/i, ''))
    .filter(name => PROCESS_NAME_PATTERN.test(name)))];
}

function normalizeLimitedText(value, label, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length > maxLength) {
    throw new Error(`${label} is too long`);
  }
  return text;
}

function toSafeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return number;
}

function toSafeOptionalInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

const USER32_BOOTSTRAP = `
Add-Type -AssemblyName Microsoft.VisualBasic
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class Win32WindowApi {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
'@
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null
`;

class WindowsSessionController {
  constructor(config) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.commandRunner = config?.windows?.sessionCommandRunner || execFileSync;
    this.defaultTimeoutMs = Number(config?.windows?.sessionCommandTimeoutMs || DEFAULT_POWERSHELL_TIMEOUT_MS);
  }

  listWindows() {
    try {
      const output = this._runPowerShell([
        'Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |',
        'Select-Object @{Name=\'handle\';Expression={[int64]$_.MainWindowHandle}},',
        '@{Name=\'title\';Expression={$_.MainWindowTitle}},',
        '@{Name=\'processName\';Expression={$_.ProcessName}},',
        '@{Name=\'id\';Expression={$_.Id}}',
        '| ConvertTo-Json -Compress'
      ].join(' '), { timeout: WINDOW_ENUMERATION_TIMEOUT_MS, encoding: 'utf8' });

      return parseJsonArray(output);
    } catch (err) {
      this.logger.warn('Failed to enumerate desktop windows', err.message);
      return [];
    }
  }

  listBrowserTabs(processNames = ['chrome']) {
    const normalizedProcesses = normalizeProcessNames(processNames);
    if (normalizedProcesses.length === 0) {
      return [];
    }

    const processFilter = normalizedProcesses
      .map(name => `'${escapePowerShell(name)}'`)
      .join(',');
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$processNames = @(${processFilter})
$tabs = New-Object System.Collections.Generic.List[object]

Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and $processNames -contains $_.ProcessName.ToLowerInvariant()
} | ForEach-Object {
  $process = $_
  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)
  if (-not $root) { return }

  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::TabItem
  )
  $items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  foreach ($item in $items) {
    $title = [string]$item.Current.Name
    if ([string]::IsNullOrWhiteSpace($title)) { continue }
    $selected = $false
    try {
      $pattern = $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      if ($pattern) { $selected = $pattern.Current.IsSelected }
    } catch {}
    $tabs.Add([pscustomobject]@{
      title = $title.Trim()
      rawTitle = $title.Trim()
      processName = $process.ProcessName
      processId = $process.Id
      handle = [int64]$process.MainWindowHandle
      windowTitle = $process.MainWindowTitle
      isActiveTab = [bool]$selected
    })
  }

}

$tabs | ConvertTo-Json -Compress
`;

    try {
      return parseJsonArray(this._runPowerShell(script, {
        timeout: BROWSER_UIA_TIMEOUT_MS,
        encoding: 'utf8'
      }));
    } catch (err) {
      this.logger.warn('Failed to enumerate browser tabs with UI Automation', err.message);
      return [];
    }
  }

  listProcessWindows(processNames = []) {
    const normalizedProcesses = normalizeProcessNames(processNames);
    if (normalizedProcesses.length === 0) return [];

    const processFilter = normalizedProcesses.map(name => `'${escapePowerShell(name)}'`).join(',');
    const script = `
$ErrorActionPreference = 'Stop'
$signature = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class OpenXTopLevelWindowApi {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
}
'@
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null
$processNames = @(${processFilter})
$targets = @{}
Get-Process | Where-Object { $processNames -contains $_.ProcessName.ToLowerInvariant() } | ForEach-Object {
  $targets[[string]$_.Id] = $_.ProcessName
}
$result = New-Object System.Collections.Generic.List[object]
$callback = [OpenXTopLevelWindowApi+EnumWindowsProc]{
  param([IntPtr]$hwnd, [IntPtr]$lParam)
  if (-not [OpenXTopLevelWindowApi]::IsWindowVisible($hwnd)) { return $true }
  [uint32]$pidValue = 0
  [OpenXTopLevelWindowApi]::GetWindowThreadProcessId($hwnd, [ref]$pidValue) | Out-Null
  if (-not $targets.ContainsKey([string]$pidValue)) { return $true }
  $length = [OpenXTopLevelWindowApi]::GetWindowTextLength($hwnd)
  $title = New-Object System.Text.StringBuilder ($length + 1)
  [OpenXTopLevelWindowApi]::GetWindowText($hwnd, $title, $title.Capacity) | Out-Null
  $result.Add([pscustomobject]@{
    handle = [int64]$hwnd
    title = $title.ToString()
    processName = $targets[[string]$pidValue]
    id = [int]$pidValue
  })
  return $true
}
[OpenXTopLevelWindowApi]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
$result | ConvertTo-Json -Compress
`;

    try {
      const output = this._runPowerShell(script, {
        encoding: 'utf8',
        timeout: PROCESS_WINDOW_TIMEOUT_MS
      });
      this.lastProcessWindowEnumerationSucceeded = true;
      return parseJsonArray(output);
    } catch (err) {
      this.lastProcessWindowEnumerationSucceeded = false;
      this.logger.warn('Failed to enumerate application windows', err.message);
      return [];
    }
  }

  closeBrowserTab(tabTitle, processNames = ['chrome']) {
    return this._controlBrowserTab(tabTitle, processNames, true);
  }

  focusBrowserTab(tabTitle, processNames = ['chrome']) {
    return this._controlBrowserTab(tabTitle, processNames, false);
  }

  _controlBrowserTab(tabTitle, processNames, closeAfterFocus) {
    const normalizedProcesses = normalizeProcessNames(processNames);
    let title = '';
    try {
      title = normalizeLimitedText(tabTitle, 'Browser tab title', MAX_WINDOW_QUERY_LENGTH);
    } catch (err) {
      return { success: false, error: err.message };
    }

    if (!title || normalizedProcesses.length === 0) {
      return { success: false, error: 'A browser tab title is required' };
    }

    const processFilter = normalizedProcesses.map(name => `'${escapePowerShell(name)}'`).join(',');
    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
${USER32_BOOTSTRAP}
$processNames = @(${processFilter})
$targetTitle = '${escapePowerShell(title)}'
$closeAfterFocus = ${closeAfterFocus ? '$true' : '$false'}
$matched = $null

Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and $processNames -contains $_.ProcessName.ToLowerInvariant()
} | ForEach-Object {
  if ($matched) { return }
  $process = $_
  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)
  if (-not $root) { return }
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::TabItem
  )
  $items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  foreach ($item in $items) {
    if (-not [string]::Equals([string]$item.Current.Name, $targetTitle, [System.StringComparison]::OrdinalIgnoreCase)) {
      continue
    }
    try {
      $selection = $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
      $selection.Select()
    } catch {
      $invoke = $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $invoke.Invoke()
    }
    $matched = [pscustomobject]@{
      title = [string]$item.Current.Name
      windowTitle = $process.MainWindowTitle
      processName = $process.ProcessName
      processId = $process.Id
      handle = [int64]$process.MainWindowHandle
    }
    break
  }
}

if (-not $matched) { throw 'Browser tab not found' }
$hwnd = [IntPtr]$matched.handle
if ([Win32WindowApi]::IsIconic($hwnd)) {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 9) | Out-Null
} else {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 5) | Out-Null
}
[Win32WindowApi]::SetForegroundWindow($hwnd) | Out-Null
$wshell = New-Object -ComObject WScript.Shell
$null = $wshell.AppActivate($matched.processId)
Start-Sleep -Milliseconds 180
if ($closeAfterFocus) { $wshell.SendKeys('^w') }
$matched | ConvertTo-Json -Compress
`;

    try {
      const output = this._runPowerShell(script, {
        encoding: 'utf8',
        timeout: BROWSER_UIA_TIMEOUT_MS
      });
      return {
        success: true,
        data: {
          ...parseJsonObject(output),
          action: closeAfterFocus ? 'closeTab' : 'focusTab'
        }
      };
    } catch (err) {
      const action = closeAfterFocus ? 'close' : 'focus';
      this.logger.warn(`Failed to ${action} browser tab with UI Automation`, err.message);
      return { success: false, error: `Could not find a ${title} tab` };
    }
  }

  minimizeWindow(windowName, options = {}) {
    return this._applyWindowAction('minimize', windowName, options);
  }

  minimizeAllWindows() {
    const script = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$shell.MinimizeAll()
`;

    try {
      this._runScript(script, 6000);
      return {
        success: true,
        data: {
          action: 'minimizeAll',
          matchedWindow: 'all windows'
        }
      };
    } catch (err) {
      return { success: false, error: 'Unable to minimize all windows' };
    }
  }

  maximizeWindow(windowName, options = {}) {
    return this._applyWindowAction('maximize', windowName, options);
  }

  focusWindow(windowName, options = {}) {
    return this._applyWindowAction('focus', windowName, options);
  }

  closeWindow(windowName, options = {}) {
    return this._applyWindowAction('close', windowName, options);
  }

  navigateWindowToUrl(windowName, url, options = {}) {
    const target = this.findWindow(windowName, options);
    if (!target) {
      return { success: false, error: this._missingWindowMessage(windowName, options) };
    }

    if (!url) {
      return { success: false, error: 'No URL provided for window navigation' };
    }

    let safeTarget;
    let safeUrl;
    try {
      safeTarget = this._coerceWindowTarget(target);
      safeUrl = normalizeLimitedText(url, 'URL', MAX_URL_LENGTH);
      if (!URI_PATTERN.test(safeUrl)) {
        return { success: false, error: 'A valid URL is required for window navigation' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }

    const script = `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
$hwnd = [IntPtr]${safeTarget.handle}
$url = '${escapePowerShell(safeUrl)}'
if ([Win32WindowApi]::IsIconic($hwnd)) {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 9) | Out-Null
} else {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 5) | Out-Null
}
[Win32WindowApi]::SetForegroundWindow($hwnd) | Out-Null
$wshell = New-Object -ComObject WScript.Shell
$null = $wshell.AppActivate(${safeTarget.id})
Start-Sleep -Milliseconds 250
${options.newTab === true ? "$wshell.SendKeys('^t')`nStart-Sleep -Milliseconds 120" : ''}
Set-Clipboard -Value $url
Start-Sleep -Milliseconds 80
$wshell.SendKeys('^l')
Start-Sleep -Milliseconds 120
$wshell.SendKeys('^a')
Start-Sleep -Milliseconds 80
$wshell.SendKeys('^v')
Start-Sleep -Milliseconds 80
$wshell.SendKeys('{ENTER}')
`;

    try {
      this._runScript(script, 8000);
      return {
        success: true,
        data: {
          action: 'navigate',
          url: safeUrl,
          matchedWindow: safeTarget.title,
          matchedHandle: safeTarget.handle,
          processName: safeTarget.processName
        }
      };
    } catch (err) {
      return { success: false, error: `Unable to reuse the ${safeTarget.title} window` };
    }
  }

  sendKeys(windowName, keys, options = {}) {
    const directHandle = toSafeOptionalInteger(options.targetHandle || options.matchedHandle);
    const target = directHandle
      ? {
          handle: directHandle,
          id: toSafeOptionalInteger(options.targetProcessId || options.processId) || 0,
          title: options.targetTitle || windowName || 'the matched window',
          processName: options.targetProcessName || options.processName || 'unknown'
        }
      : this.findWindow(windowName, options);
    if (!target) {
      return { success: false, error: this._missingWindowMessage(windowName, options) };
    }

    let safeTarget;
    let safeKeys;
    const settleDelayMs = boundedInteger(
      options.settleDelayMs,
      DEFAULT_SEND_KEYS_SETTLE_DELAY_MS,
      40,
      DEFAULT_SEND_KEYS_SETTLE_DELAY_MS
    );
    try {
      safeTarget = this._coerceWindowTarget(target);
      safeKeys = normalizeLimitedText(keys, 'Keys', MAX_SEND_KEYS_LENGTH);
      if (!safeKeys) {
        return { success: false, error: 'No keys provided for window control' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }

    const script = `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
$hwnd = [IntPtr]${safeTarget.handle}
if ([Win32WindowApi]::IsIconic($hwnd)) {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 9) | Out-Null
} else {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 5) | Out-Null
}
[Win32WindowApi]::SetForegroundWindow($hwnd) | Out-Null
$wshell = New-Object -ComObject WScript.Shell
$null = $wshell.AppActivate(${safeTarget.id})
Start-Sleep -Milliseconds ${settleDelayMs}
$wshell.SendKeys('${escapePowerShell(safeKeys)}')
`;

    try {
      this._runScript(script, 6000);
      return {
        success: true,
        data: {
          action: 'sendKeys',
          keys: safeKeys,
          matchedWindow: safeTarget.title,
          matchedHandle: safeTarget.handle,
          processId: safeTarget.id || null,
          processName: safeTarget.processName
        }
      };
    } catch (err) {
      return { success: false, error: `Unable to control the ${safeTarget.title} window` };
    }
  }

  findWindow(windowName, options = {}) {
    const windows = this.listWindows();
    if (windows.length === 0) {
      return null;
    }

    const normalizedQuery = Normalizer.normalizeText(windowName || '').slice(0, MAX_WINDOW_QUERY_LENGTH);
    const activeHandle = options.activeHandle ?? this._getForegroundWindowHandle();
    const preferredProcesses = Array.isArray(options.preferredProcessNames)
      ? normalizeProcessNames(options.preferredProcessNames)
      : [];
    const preferredTitleTokens = Array.isArray(options.preferredTitleTokens)
      ? options.preferredTitleTokens.map(value => Normalizer.normalizeText(value)).filter(Boolean)
      : [];
    const requireTitleTokenMatch = Boolean(options.requireTitleTokenMatch);
    const excludedTitleTokens = Array.isArray(options.excludeTitleTokens)
      ? options.excludeTitleTokens.map(value => Normalizer.normalizeText(value)).filter(Boolean)
      : [];

    let best = null;

    windows.forEach(candidate => {
      const title = Normalizer.normalizeText(candidate.title);
      const processName = Normalizer.normalizeText(candidate.processName);
      let score = 0;

      if (excludedTitleTokens.some(token => token && title.includes(token))) {
        return;
      }

      if (requireTitleTokenMatch && preferredTitleTokens.length > 0) {
        const titleTokens = new Set(Normalizer.tokenize(title));
        const titleMatches = preferredTitleTokens.every(token => (
          title.includes(token) || titleTokens.has(token)
        ));
        if (!titleMatches) {
          return;
        }
      }

      if (normalizedQuery) {
        const titleSimilarity = title ? Normalizer.similarity(normalizedQuery, title) : 0;
        const processSimilarity = processName ? Normalizer.similarity(normalizedQuery, processName) : 0;

        if (title === normalizedQuery) score += 160;
        if (processName === normalizedQuery) score += 130;
        if (title.includes(normalizedQuery)) score += 120;
        if (processName.includes(normalizedQuery)) score += 90;

        if (titleSimilarity >= 0.6) score += Math.round(titleSimilarity * 80);
        if (processSimilarity >= 0.7) score += Math.round(processSimilarity * 50);

        const queryTokens = Normalizer.tokenize(normalizedQuery);
        if (queryTokens.length > 0) {
          const titleTokens = new Set(Normalizer.tokenize(title));
          const processTokens = new Set(Normalizer.tokenize(processName));
          const overlap = queryTokens.filter(token => titleTokens.has(token) || processTokens.has(token)).length;
          score += overlap * 18;
        }
      } else {
        score += candidate.handle === activeHandle ? 120 : 20;
      }

      preferredProcesses.forEach(process => {
        if (!process) return;
        if (processName === process) score += 60;
        else if (processName.includes(process)) score += 35;
      });

      preferredTitleTokens.forEach(token => {
        if (token && title.includes(token)) score += 28;
      });

      if (candidate.handle === activeHandle) {
        score += 35;
      }

      if (!best || score > best.score) {
        best = { score, candidate };
      }
    });

    if (!best || best.score < 40) {
      return null;
    }

    return best.candidate;
  }

  _applyWindowAction(action, windowName, options = {}) {
    const target = this.findWindow(windowName, options);
    if (!target) {
      return { success: false, error: this._missingWindowMessage(windowName, options) };
    }

    let safeTarget;
    try {
      safeTarget = this._coerceWindowTarget(target);
    } catch (err) {
      return { success: false, error: err.message };
    }

    const actionScripts = {
      minimize: `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
[Win32WindowApi]::ShowWindowAsync([IntPtr]${safeTarget.handle}, 6) | Out-Null
`,
      maximize: `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
$hwnd = [IntPtr]${safeTarget.handle}
if ([Win32WindowApi]::IsIconic($hwnd)) {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 9) | Out-Null
}
[Win32WindowApi]::ShowWindowAsync($hwnd, 3) | Out-Null
[Win32WindowApi]::SetForegroundWindow($hwnd) | Out-Null
`,
      focus: `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
$hwnd = [IntPtr]${safeTarget.handle}
if ([Win32WindowApi]::IsIconic($hwnd)) {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 9) | Out-Null
} else {
  [Win32WindowApi]::ShowWindowAsync($hwnd, 5) | Out-Null
}
[Win32WindowApi]::SetForegroundWindow($hwnd) | Out-Null
$wshell = New-Object -ComObject WScript.Shell
$null = $wshell.AppActivate(${safeTarget.id})
`,
      close: `
$ErrorActionPreference = 'Stop'
${USER32_BOOTSTRAP}
$process = Get-Process -Id ${safeTarget.id} -ErrorAction SilentlyContinue | Select-Object -First 1
if ($process) {
  $closed = $process.CloseMainWindow()
  if ($closed) {
    Start-Sleep -Milliseconds 250
    exit 0
  }
}
[Win32WindowApi]::PostMessage([IntPtr]${safeTarget.handle}, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
`
    };

    try {
      this._runScript(actionScripts[action], 6000);
      return {
        success: true,
        data: {
          action,
          matchedWindow: safeTarget.title,
          matchedHandle: safeTarget.handle,
          processName: safeTarget.processName,
          controllerVerified: true,
          verification: {
            status: 'unknown',
            check: `window-${action}-request`,
            reason: 'Windows accepted the window command; final UI state is verified by the action verifier when available.'
          }
        }
      };
    } catch (err) {
      return {
        success: false,
        error: `Unable to ${action} the ${safeTarget.title} window`
      };
    }
  }

  _getForegroundWindowHandle() {
    try {
      const output = this._runPowerShell(`${USER32_BOOTSTRAP}; [int64][Win32WindowApi]::GetForegroundWindow()`, {
        encoding: 'utf8',
        timeout: FOREGROUND_TIMEOUT_MS
      });

      const handle = parseInt(String(output || '').trim(), 10);
      return Number.isFinite(handle) ? handle : 0;
    } catch (err) {
      return 0;
    }
  }

  _missingWindowMessage(windowName, options = {}) {
    const label = String(windowName || '').trim();
    if (label) {
      return `Window not found: ${label}`;
    }

    if (options.preferredTitleTokens?.length) {
      return `Window not found: ${options.preferredTitleTokens.join(' ')}`;
    }

    return 'No active window is available';
  }

  _coerceWindowTarget(target) {
    return {
      ...target,
      handle: toSafeInteger(target?.handle, 'window handle'),
      id: toSafeInteger(target?.id ?? target?.processId, 'process id'),
      title: normalizeLimitedText(target?.title || target?.windowTitle || 'the matched window', 'Window title', MAX_WINDOW_QUERY_LENGTH),
      processName: normalizeLimitedText(target?.processName || 'unknown', 'Process name', MAX_WINDOW_QUERY_LENGTH)
    };
  }

  _runScript(script, timeout = 6000) {
    this._runPowerShell(script, { timeout, stdio: 'pipe' });
  }

  _runPowerShell(script, options = {}) {
    return this.commandRunner(POWERSHELL_EXECUTABLE, [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], {
      timeout: Number(options.timeout || this.defaultTimeoutMs),
      stdio: options.stdio || 'pipe',
      encoding: options.encoding,
      windowsHide: true
    });
  }
}

module.exports = WindowsSessionController;
