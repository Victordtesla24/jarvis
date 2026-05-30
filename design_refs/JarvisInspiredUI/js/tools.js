// ==================== URL / APP LAUNCHER ====================
const siteMap = {
    'youtube': 'https://www.youtube.com',
    'google': 'https://www.google.com',
    'github': 'https://github.com',
    'gmail': 'https://mail.google.com',
    'maps': 'https://www.google.com/maps',
    'drive': 'https://drive.google.com',
    'news': 'https://news.google.com',
    'reddit': 'https://www.reddit.com',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'facebook': 'https://www.facebook.com',
    'instagram': 'https://www.instagram.com',
    'linkedin': 'https://www.linkedin.com',
    'stackoverflow': 'https://stackoverflow.com',
    'wikipedia': 'https://www.wikipedia.org',
    'netflix': 'https://www.netflix.com',
    'spotify': 'https://open.spotify.com',
    'twitch': 'https://www.twitch.tv',
    'discord': 'https://discord.com/app',
    'chatgpt': 'https://chat.openai.com',
    'translate': 'https://translate.google.com',
    'calendar': 'https://calendar.google.com',
    'photos': 'https://photos.google.com',
    'docs': 'https://docs.google.com',
    'sheets': 'https://sheets.google.com',
    'whatsapp': 'https://web.whatsapp.com',
    'amazon': 'https://www.amazon.com',
    'ebay': 'https://www.ebay.com',
    'weather': 'https://weather.com',
    'wolfram': 'https://www.wolframalpha.com',
};

function openURL(url, label) {
    window.open(url, '_blank');
    addLog(`Opened ${label || url}`, 'success');
    showToast(`Opening ${label || url}...`, 'info');
}

// Known local application names (matched in Electron main process)
const localApps = [
    'control panel', 'controlpanel', 'file explorer', 'explorer', 'this pc', 'my computer',
    'notepad', 'calculator', 'paint', 'cmd', 'command prompt', 'terminal', 'powershell',
    'task manager', 'settings', 'windows settings', 'device manager', 'disk management',
    'services', 'registry', 'system info', 'resource monitor', 'performance monitor',
    'event viewer', 'snipping tool', 'snip', 'screen sketch', 'magnifier', 'wordpad',
    'character map', 'remote desktop', 'disk cleanup', 'defragment', 'firewall', 'sound',
    'display settings', 'network', 'bluetooth', 'printers', 'apps', 'startup',
    'windows update', 'about', 'downloads', 'documents', 'desktop', 'pictures', 'music',
    'videos', 'recycle bin',
    'chrome', 'google chrome', 'firefox', 'mozilla firefox', 'edge', 'microsoft edge',
    'brave', 'opera', 'vivaldi',
    'vscode', 'vs code', 'visual studio code', 'visual studio', 'sublime', 'sublime text',
    'atom', 'notepad++', 'git bash', 'postman', 'android studio', 'intellij', 'pycharm', 'webstorm',
    'teams', 'microsoft teams', 'slack', 'zoom', 'skype', 'telegram',
    'vlc', 'spotify', 'itunes', 'photos', 'movies', 'groove', 'camera',
    'word', 'excel', 'powerpoint', 'outlook', 'onenote', 'access',
    'steam', 'epic games', 'winrar', '7zip', 'obs', 'obs studio'
];

async function launchLocalApp(name) {
    if (window.jarvisElectron && window.jarvisElectron.isElectron) {
        const result = await window.jarvisElectron.launchApp(name);
        if (result.success) {
            addLog(`Launched: ${name}`, 'success');
            showToast(result.message, 'success');
            typeResponse(`> ${result.message}`);
            speak(`Opening ${name}, Sir.`);
        } else {
            addLog(`Launch failed: ${name}`, 'error');
            showToast(result.message, 'error');
            typeResponse(`> ${result.message}`);
            speak(result.message);
        }
        return true;
    }
    return false;
}

function handleOpen(target) {
    const t = target.toLowerCase().trim();

    // Try local app launch first (Electron only)
    if (window.jarvisElectron && window.jarvisElectron.isElectron) {
        // Check if it matches a known local app
        if (localApps.includes(t)) {
            launchLocalApp(t);
            return;
        }
    }

    // Check the known site map
    if (siteMap[t]) {
        openURL(siteMap[t], t.toUpperCase());
        typeResponse(`> Opening ${t.toUpperCase()}...`);
        speak(`Opening ${t}.`);
        return;
    }
    // If it looks like a URL, open it directly
    if (/^https?:\/\//.test(t) || /^www\./.test(t)) {
        const url = t.startsWith('www.') ? 'https://' + t : t;
        openURL(url, url);
        typeResponse(`> Opening ${url}...`);
        speak('Opening the link.');
        return;
    }
    // If it has a dot, treat it as a domain
    if (t.includes('.')) {
        openURL('https://' + t, t);
        typeResponse(`> Opening ${t}...`);
        speak(`Opening ${t}.`);
        return;
    }

    // In Electron, try launching as an arbitrary app name
    if (window.jarvisElectron && window.jarvisElectron.isElectron) {
        launchLocalApp(t);
        return;
    }

    // Fallback: search for it
    openURL('https://www.google.com/search?q=' + encodeURIComponent(target), 'Google Search: ' + target);
    typeResponse(`> "${target}" not recognized. Searching Google instead...`);
    speak(`I don't have a direct link for ${target}. Searching Google instead.`);
}

// ==================== SAFE CALCULATOR ====================
function safeCalc(expr) {
    try {
        // Only allow numbers, operators, parentheses, dots, spaces
        if (!/^[\d\s+\-*/().%^]+$/.test(expr)) return 'ERROR: Invalid expression';
        // Replace ^ with ** for exponentiation
        const sanitized = expr.replace(/\^/g, '**');
        const result = Function('"use strict"; return (' + sanitized + ')')();
        if (!isFinite(result)) return 'ERROR: Result is not finite';
        addLog(`CALC: ${expr} = ${result}`, 'info');
        return result;
    } catch (e) {
        return 'ERROR: Could not evaluate';
    }
}

// ==================== COUNTDOWN TIMER ====================
let timerInterval = null;
function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);
    let remaining = seconds;
    const display = $('timer-display');
    const value = $('timer-value');
    display.classList.add('active');
    addLog(`Timer started: ${seconds}s`, 'info');

    function updateDisplay() {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        value.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    updateDisplay();

    timerInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            value.textContent = '00:00';
            setTimeout(() => display.classList.remove('active'), 3000);
            speak('Timer complete, Sir.');
            showToast('TIMER COMPLETE', 'warn');
            addLog('Timer completed', 'success');
            screenShake();
            triggerPowerSurge();
        } else {
            updateDisplay();
            // Warning at 10 seconds
            if (remaining === 10) {
                value.style.color = 'var(--gold)';
                speak('Ten seconds remaining.');
            }
            if (remaining <= 5) value.style.color = 'var(--red)';
        }
    }, 1000);
}

// ==================== MEMO SYSTEM (localStorage) ====================
function handleMemo(sub) {
    const lower = sub.toLowerCase();
    if (lower.startsWith('save ')) {
        const text = sub.slice(5).trim();
        if (!text) return 'Nothing to save. Usage: memo save [text]';
        const memos = JSON.parse(localStorage.getItem('jarvis_memos') || '[]');
        memos.push({ text, time: new Date().toLocaleString() });
        localStorage.setItem('jarvis_memos', JSON.stringify(memos));
        addLog(`Memo saved: "${text.substring(0, 30)}"`, 'success');
        speak('Memo saved.');
        return `Memo saved. Total: ${memos.length}`;
    }
    if (lower === 'list') {
        const memos = JSON.parse(localStorage.getItem('jarvis_memos') || '[]');
        if (memos.length === 0) return 'No memos stored.';
        const list = memos.map((m, i) => `[${i + 1}] ${m.time}: ${m.text}`).join(' | ');
        return `${memos.length} memo(s): ${list}`;
    }
    if (lower === 'clear') {
        localStorage.removeItem('jarvis_memos');
        addLog('All memos cleared', 'warn');
        speak('All memos cleared.');
        return 'All memos cleared.';
    }
    if (lower.startsWith('delete ')) {
        const idx = parseInt(lower.slice(7).trim(), 10) - 1;
        const memos = JSON.parse(localStorage.getItem('jarvis_memos') || '[]');
        if (idx < 0 || idx >= memos.length) return 'Invalid memo number.';
        const removed = memos.splice(idx, 1)[0];
        localStorage.setItem('jarvis_memos', JSON.stringify(memos));
        addLog(`Memo deleted: "${removed.text.substring(0, 30)}"`, 'info');
        return `Deleted memo: "${removed.text}"`;
    }
    return 'Usage: memo save [text], memo list, memo delete [#], memo clear';
}

// ==================== EXPORT LOG ====================
function exportLog() {
    const entries = qsa('.log-entry');
    let text = 'J.A.R.V.I.S. SYSTEM LOG EXPORT\n';
    text += `Exported: ${new Date().toLocaleString()}\n`;
    text += '='.repeat(60) + '\n\n';
    entries.forEach(entry => { text += entry.textContent + '\n'; });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('System log exported to file', 'success');
}

// ==================== DEVICE INTELLIGENCE ====================
function populateDeviceIntel() {
    const grid = $('device-grid');
    grid.innerHTML = '';
    const info = [
        ['PLATFORM', navigator.platform || 'N/A'],
        ['LANGUAGE', navigator.language || 'N/A'],
        ['CPU CORES', navigator.hardwareConcurrency || 'N/A'],
        ['MEMORY', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A'],
        ['SCREEN', `${screen.width}x${screen.height}`],
        ['COLOR DEPTH', screen.colorDepth + '-bit'],
        ['PIXEL RATIO', window.devicePixelRatio.toFixed(1) + 'x'],
        ['TOUCH POINTS', navigator.maxTouchPoints || '0'],
        ['ONLINE', navigator.onLine ? 'YES' : 'NO'],
        ['COOKIES', navigator.cookieEnabled ? 'ON' : 'OFF'],
    ];
    // Connection info
    if (navigator.connection) {
        const c = navigator.connection;
        info.push(['NET TYPE', c.effectiveType || 'N/A']);
        info.push(['DOWNLINK', (c.downlink || 'N/A') + ' Mbps']);
    }
    // GPU via WebGL
    try {
        const cvs = document.createElement('canvas');
        const gl = cvs.getContext('webgl') || cvs.getContext('experimental-webgl');
        if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
                const gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
                const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
                info.push(['GPU', gpu.length > 25 ? gpu.substring(0, 23) + '..' : gpu]);
                info.push(['GPU VENDOR', vendor.length > 25 ? vendor.substring(0, 23) + '..' : vendor]);
            }
        }
    } catch (e) { /* WebGL not supported */ }
    // User agent (truncated)
    const ua = navigator.userAgent;
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/);
    if (browser) info.push(['BROWSER', `${browser[1]} ${browser[2]}`]);

    info.forEach(([label, val]) => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `<div class="device-item-label">${label}</div><div class="device-item-val">${val}</div>`;
        grid.appendChild(item);
    });

    addLog(`Device intel: ${navigator.hardwareConcurrency || '?'} cores, ${screen.width}x${screen.height}`, 'success');
}

// ==================== CRYPTO TICKER ====================
async function fetchCrypto() {
    try {
        const res = await jarvisFetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
        const data = await res.json();
        function update(id, coin) {
            if (!data[coin]) return;
            const price = data[coin].usd;
            const change = data[coin].usd_24h_change;
            $(id + '-price').textContent = '$' + price.toLocaleString(undefined, { maximumFractionDigits: price > 100 ? 0 : 2 });
            const changeEl = $(id + '-change');
            const ch = change.toFixed(1);
            changeEl.textContent = (change >= 0 ? '+' : '') + ch + '%';
            changeEl.className = 'crypto-change ' + (change >= 0 ? 'up' : 'down');
        }
        update('btc', 'bitcoin');
        update('eth', 'ethereum');
        update('sol', 'solana');
        addLog('Crypto prices updated', 'info');
    } catch (e) {
        addLog('Crypto API unavailable', 'warn');
    }
}

// ==================== WORLD CLOCK ====================
const worldClockZones = [
    { city: 'NYC', tz: 'America/New_York' },
    { city: 'LDN', tz: 'Europe/London' },
    { city: 'TKY', tz: 'Asia/Tokyo' },
    { city: 'SYD', tz: 'Australia/Sydney' },
    { city: 'NPL', tz: 'Asia/Kathmandu' },
    { city: 'DXB', tz: 'Asia/Dubai' },
];
function updateWorldClock() {
    const container = $('wclock-list');
    container.innerHTML = '';
    worldClockZones.forEach(z => {
        const row = document.createElement('div');
        row.className = 'wclock-row';
        const time = new Date().toLocaleTimeString('en-US', { timeZone: z.tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        row.innerHTML = `<span class="wclock-city">${z.city}</span><span class="wclock-time">${time}</span>`;
        container.appendChild(row);
    });
}

// ==================== REMINDER SYSTEM ====================
let activeReminders = [];
let reminderCheckInterval = null;

function initReminders() {
    // Load reminders from localStorage
    const stored = localStorage.getItem('jarvis_reminders');
    if (stored) {
        activeReminders = JSON.parse(stored);
        // Filter out expired reminders
        const now = Date.now();
        activeReminders = activeReminders.filter(r => r.triggerTime > now);
        saveReminders();
    }
    updateReminderIndicator();
    
    // Start checking for due reminders every second
    if (!reminderCheckInterval) {
        reminderCheckInterval = setInterval(checkReminders, 1000);
    }
}

function saveReminders() {
    localStorage.setItem('jarvis_reminders', JSON.stringify(activeReminders));
    updateReminderIndicator();
}

function updateReminderIndicator() {
    const indicator = $('reminder-indicator');
    const countEl = $('reminder-count');
    if (!indicator || !countEl) return;
    
    if (activeReminders.length > 0) {
        indicator.classList.add('active');
        countEl.textContent = activeReminders.length;
    } else {
        indicator.classList.remove('active');
    }
}

function checkReminders() {
    if (!systemActive || activeReminders.length === 0) return;
    
    const now = Date.now();
    const dueReminders = activeReminders.filter(r => r.triggerTime <= now);
    
    if (dueReminders.length > 0) {
        // Remove due reminders from active list
        activeReminders = activeReminders.filter(r => r.triggerTime > now);
        saveReminders();
        
        // Trigger each due reminder
        dueReminders.forEach(reminder => {
            triggerReminder(reminder.text);
        });
    }
}

function triggerReminder(text) {
    const display = $('reminder-display');
    const textEl = $('reminder-text');
    
    if (display && textEl) {
        textEl.textContent = text.toUpperCase();
        display.classList.add('active');
        
        // Hide after 8 seconds
        setTimeout(() => {
            display.classList.remove('active');
        }, 8000);
    }
    
    // Speak the reminder
    speak(`Reminder, Sir: ${text}`);
    
    // Show toast
    showToast(`REMINDER: ${text}`, 'warn');
    
    // Add to log
    addLog(`REMINDER: ${text}`, 'warn');
    
    // Screen shake for attention
    if (typeof screenShake === 'function') screenShake();
}

function handleReminder(sub) {
    const lower = sub.toLowerCase().trim();
    
    // remind list
    if (lower === 'list') {
        if (activeReminders.length === 0) return 'No active reminders.';
        const list = activeReminders.map((r, i) => {
            const remaining = Math.ceil((r.triggerTime - Date.now()) / 1000);
            if (remaining > 0) {
                const timeStr = formatTimeFriendly(remaining);
                return `[${i + 1}] "${r.text}" in ${timeStr}`;
            } else {
                const targetTime = new Date(r.triggerTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return `[${i + 1}] "${r.text}" at ${targetTime}`;
            }
        }).join(' | ');
        return `${activeReminders.length} reminder(s): ${list}`;
    }
    
    // remind clear
    if (lower === 'clear') {
        const count = activeReminders.length;
        activeReminders = [];
        saveReminders();
        addLog('All reminders cleared', 'warn');
        speak('All reminders cleared.');
        return count > 0 ? `Cleared ${count} reminder(s).` : 'No reminders to clear.';
    }
    
    // remind delete [#]
    if (lower.startsWith('delete ')) {
        const idx = parseInt(lower.slice(7).trim(), 10) - 1;
        if (idx < 0 || idx >= activeReminders.length) return 'Invalid reminder number.';
        const removed = activeReminders.splice(idx, 1)[0];
        saveReminders();
        addLog(`Reminder deleted: "${removed.text}"`, 'info');
        return `Deleted reminder: "${removed.text}"`;
    }
    
    // Check for absolute time patterns first
    // Patterns: "at 6:30 AM [text]", "[text] at 6:30 AM", "when it is 18:00 [text]"
    const absoluteTimeResult = parseAbsoluteTimeReminder(sub);
    if (absoluteTimeResult) {
        const { reminderText, triggerTime, displayTime } = absoluteTimeResult;
        
        const reminder = {
            text: reminderText,
            triggerTime: triggerTime,
            createdAt: new Date().toLocaleString()
        };
        
        activeReminders.push(reminder);
        saveReminders();
        
        addLog(`Reminder set: "${reminderText}" at ${displayTime}`, 'success');
        speak(`Reminder set for ${displayTime}.`);
        
        return `Reminder set: "${reminderText}" at ${displayTime}. Total active: ${activeReminders.length}`;
    }
    
    // remind [time] [text] or remind [text] in [time]
    // Parse "in X minutes/hours/seconds" pattern
    let timeMatch = lower.match(/^(.+?)\s+in\s+(\d+(?:\s+and\s+a\s+half)?\s*(?:hours?|hrs?|h|minutes?|mins?|seconds?|secs?|s)(?:\s+(?:and\s+)?\d+\s*(?:minutes?|mins?|seconds?|secs?))*)$/i);
    let reminderText, timeStr;
    
    if (timeMatch) {
        // Format: "remind call mom in 30 minutes"
        reminderText = timeMatch[1].trim();
        timeStr = timeMatch[2];
    } else {
        // Format: "remind 30 minutes call mom" or "remind 1 hour meeting"
        // Try to find time at the start
        const timeAtStart = lower.match(/^(\d+(?:\s+and\s+a\s+half)?\s*(?:hours?|hrs?|h|minutes?|mins?|seconds?|secs?|s)(?:\s+(?:and\s+)?\d+\s*(?:minutes?|mins?|seconds?|secs?|s))?)\s+(.+)$/i);
        if (timeAtStart) {
            timeStr = timeAtStart[1];
            reminderText = timeAtStart[2].trim();
        } else {
            return 'Usage: remind [text] in [time] OR remind at [time] [text]. Examples: "remind call mom in 30 minutes" OR "remind at 6:30 AM call mom"';
        }
    }
    
    // Parse the time using the natural time parser
    const seconds = parseNaturalTime(timeStr);
    if (!seconds || seconds <= 0) {
        return 'Could not parse time. Try: "30 minutes", "1 hour", "90 seconds", or "at 6:30 AM"';
    }
    
    // Create the reminder
    const reminder = {
        text: reminderText,
        triggerTime: Date.now() + (seconds * 1000),
        createdAt: new Date().toLocaleString()
    };
    
    activeReminders.push(reminder);
    saveReminders();
    
    const friendlyTime = formatTimeFriendly(seconds);
    addLog(`Reminder set: "${reminderText}" in ${friendlyTime}`, 'success');
    speak(`Reminder set for ${friendlyTime}.`);
    
    return `Reminder set: "${reminderText}" in ${friendlyTime}. Total active: ${activeReminders.length}`;
}

// Parse absolute time like "6:30 AM", "18:00", "6:30pm"
function parseAbsoluteTime(timeStr) {
    const lower = timeStr.toLowerCase().trim();
    
    // 12-hour format: 6:30 AM, 6:30AM, 6:30 am, 6:30am, 6 AM, 6am
    const match12h = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (match12h) {
        let hours = parseInt(match12h[1], 10);
        const minutes = match12h[2] ? parseInt(match12h[2], 10) : 0;
        const period = match12h[3];
        
        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return { hours, minutes };
    }
    
    // 24-hour format: 18:00, 06:30, 6:30
    const match24h = lower.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
        const hours = parseInt(match24h[1], 10);
        const minutes = parseInt(match24h[2], 10);
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        
        return { hours, minutes };
    }
    
    return null;
}

function parseAbsoluteTimeReminder(sub) {
    const lower = sub.toLowerCase().trim();
    
    // Pattern 1: "at 6:30 AM [text]" or "at 6:30AM [text]"
    const atStart = lower.match(/^at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\s+(.+)$/i);
    if (atStart) {
        const time = parseAbsoluteTime(atStart[1]);
        if (time) {
            return createAbsoluteReminder(atStart[2].trim(), time);
        }
    }
    
    // Pattern 2: "[text] at 6:30 AM"
    const atEnd = lower.match(/^(.+?)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})$/i);
    if (atEnd) {
        const time = parseAbsoluteTime(atEnd[2]);
        if (time) {
            return createAbsoluteReminder(atEnd[1].trim(), time);
        }
    }
    
    // Pattern 3: "when it is 6:30 AM [text]" or "when its 18:00 [text]"
    const whenItIs = lower.match(/^when\s+(?:it\s+is|it's|its)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\s+(.+)$/i);
    if (whenItIs) {
        const time = parseAbsoluteTime(whenItIs[1]);
        if (time) {
            return createAbsoluteReminder(whenItIs[2].trim(), time);
        }
    }
    
    // Pattern 4: "[text] when it is 6:30 AM"
    const whenItIsEnd = lower.match(/^(.+?)\s+when\s+(?:it\s+is|it's|its)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})$/i);
    if (whenItIsEnd) {
        const time = parseAbsoluteTime(whenItIsEnd[2]);
        if (time) {
            return createAbsoluteReminder(whenItIsEnd[1].trim(), time);
        }
    }
    
    return null;
}

function createAbsoluteReminder(reminderText, time) {
    const now = new Date();
    let targetDate = new Date();
    targetDate.setHours(time.hours, time.minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const displayTime = targetDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    // Add "tomorrow" if it's the next day
    const isToday = targetDate.toDateString() === now.toDateString();
    const finalDisplayTime = isToday ? displayTime : `${displayTime} tomorrow`;
    
    return {
        reminderText,
        triggerTime: targetDate.getTime(),
        displayTime: finalDisplayTime
    };
}

// Click handler for reminder indicator to list reminders
document.addEventListener('DOMContentLoaded', () => {
    const indicator = $('reminder-indicator');
    if (indicator) {
        indicator.addEventListener('click', () => {
            const result = handleReminder('list');
            if (typeof typeResponse === 'function') typeResponse(`> ${result}`);
            speak(result);
        });
    }
});
