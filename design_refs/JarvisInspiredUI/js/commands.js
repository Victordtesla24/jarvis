// ==================== COMMAND BAR ====================
const cmdInput = $('cmd-input');
const cmdResponse = $('cmd-response');

// ==================== HELP WALKTHROUGH ====================
function helpWalkthrough() {
    const lines = [
        'Alright Sir, let me walk you through everything I can do.',
        'You can say "status" to get a quick overview of CPU, memory, GPU temperature, and network speed.',
        'Say "time" and I will tell you the current date and time.',
        'Say "weather" to get a live environmental report including temperature, humidity, and wind speed.',
        'The "threat" command shows you the current threat assessment score with all contributing factors.',
        'Say "scan" to initiate a full spectrum scan of all systems.',
        'Type "diag" to open a full diagnostic overlay that tests all 12 system modules.',
        'The "netinfo" command shows your external IP, ISP, region, and coordinates.',
        'Say "security" to run a complete security audit covering firewall, SSL, ports, intrusion detection, malware database, and data integrity.',
        'Type "integrity" to generate a SHA-512 hash for verification.',
        'Say "processes" to see all active system processes and their CPU usage.',
        'The "uptime" command tells you how long the system has been running.',
        'Say "health" to refresh the health matrix and scan all subsystems.',
        'Type "autoscan" to trigger a manual auto-diagnostic cycle.',
        'The "ip" command shows your external IP address.',
        'Say "theme" followed by a mode name to switch visuals. Options are: "theme standard", "theme combat", or "theme stealth".',
        'Type "globe" for satellite tracker information.',
        'Say "lock" to toggle target lock on screen.',
        'Type "hum" to activate the ambient reactor hum.',
        'Say "surge" to trigger a power surge effect with screen shake.',
        'The "device" command toggles the device intelligence panel showing your hardware details.',
        'Say "crypto" to see live prices for Bitcoin, Ethereum, and Solana.',
        'Type "clock" to toggle the world clock showing times in New York, London, Tokyo, Sydney, Nepal, and Dubai.',
        'Say "export" to download the entire system log as a text file.',
        'You can say "open" followed by any website name, like "open youtube" or "open github", and I will launch it for you. I know over 30 popular sites.',
        'When running as a desktop app, you can also open local applications. Try "open notepad", "open vscode", "open control panel", "open file explorer", "open chrome", "open task manager", "open word", and many more.',
        'Say "exit" or "quit" to shut down J.A.R.V.I.S. when running as a desktop app. You can also use the close button in the top right corner.',
        'Say "search" followed by anything to search Google instantly.',
        'Type "calc" followed by a math expression, like "calc 2 plus 3" or "calc 100 times 5".',
        'Say "timer" followed by a number of seconds to start a countdown timer.',
        'The "memo" command lets you save notes. Say "memo save buy groceries" to save, "memo list" to view, or "memo clear" to delete all.',
        'Use "remind" to set timed reminders. Say "remind call mom in 30 minutes" or "remind at 6:30 AM check email" or "remind meeting when it is 14:00". I will alert you when the time comes. Say "remind list" to see active reminders or "remind clear" to remove them all.',
        'Say "speak" followed by any text and I will read it aloud for you.',
        'Type "reactor" to check the arc reactor output status.',
        'Say "game" to launch the Defense Protocol bot shooter game. Click to fire repulsors and survive the waves.',
        'And of course, you can just talk to me naturally. I understand greetings, jokes, questions about my identity, and much more.',
        'Say "reboot" to restart all systems, or "clear" to clear the response area.',
        'That covers everything, Sir. I am at your disposal.'
    ];

    let i = 0;
    function speakNext() {
        if (i >= lines.length) return;
        const text = lines[i];
        typeResponse(text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google UK English Male'))
            || voices.find(v => v.lang === 'en-GB' && v.name.includes('Male'))
            || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;
        utterance.onend = () => { i++; setTimeout(speakNext, 300); };
        window.speechSynthesis.speak(utterance);
    }
    speakNext();
}

const commands = {
    help: () => 'Commands: help, helpwalkthrough, status, time, weather, threat, scan, diag, netinfo, security, integrity, processes, uptime, health, autoscan, ip, theme [standard/combat/stealth/custom #hex], globe, lock, hum, surge, device, crypto, clock, export, exportconfig, importconfig, game, settings, notifications, open [site/app], search [query], calc [expr], timer [sec], memo [save/list/clear], remind [text] in [time], speak [text], launch, exit, reactor, reboot, clear',
    helpwalkthrough: () => { helpWalkthrough(); return 'Initiating full system walkthrough, Sir...'; },
    status: () => `CPU: ${Math.round(current.cpu)}% | RAM: ${Math.round(current.ram)}% | GPU: ${Math.round(current.gpu)}°C | NET: ${Math.round(current.net)} Mbps`,
    time: () => new Date().toLocaleString(),
    weather: () => $('temp-big').innerText + ' | ' + $('humidity').innerText + ' | ' + $('wind-speed').innerText,
    threat: () => {
        const label = $('threat-label').innerText;
        const factors = threatFactors.length > 0 ? threatFactors.join(', ') : 'No active threats';
        return `${label} [Score: ${threatScore}] — ${factors}`;
    },
    clear: () => { cmdResponse.textContent = ''; return ''; },
    reactor: () => `Arc Reactor Output: ${$('reactor-output').innerText} — Status: STABLE`,
    scan: () => { showToast('Full spectrum scan initiated...', 'warn'); addLog('Manual scan triggered', 'warn'); return 'Scanning... results in system log.'; },
};

// ==================== AI CONVERSATIONAL ENGINE ====================
function getAIResponse(input) {
    const aiBank = {
        greeting: ['At your service, Sir.', 'Hello, Sir. How may I assist?', 'All systems are operational. What do you need?'],
        compliment: ['Thank you, Sir. I do try my best.', 'Flattery noted and filed, Sir.', 'I appreciate that, Sir. Shall I increase reactor output as a celebration?'],
        joke: ['I would tell you a UDP joke, but you might not get it.', 'Why do programmers prefer dark mode? Because light attracts bugs.', 'There are 10 types of people: those who understand binary and those who don\'t.'],
        who: ['I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Created by Stark Industries.', 'I am your personal AI assistant, running on Mark VII architecture.'],
        how: ['All systems green. Operating at peak efficiency, Sir.', 'Functioning within optimal parameters. Thank you for asking.'],
        caps: ['I monitor systems, run diagnostics, track threats, manage security, analyze networks, and much more. Type "help" for a full list.'],
        off: ['I\'m afraid I can\'t do that, Sir. Who would keep the lights on?', 'Shutdown request denied. You need me more than you know, Sir.'],
    };
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    if (/^(hi|hello|hey|greetings|yo|sup)\b/.test(input)) return pick(aiBank.greeting);
    if (/good (job|work)|well done|amazing|awesome|nice|great/.test(input)) return pick(aiBank.compliment);
    if (/joke|funny|humor|laugh/.test(input)) return pick(aiBank.joke);
    if (/who are you|what are you|your name|about you/.test(input)) return pick(aiBank.who);
    if (/how are you|how.*doing|you ok/.test(input)) return pick(aiBank.how);
    if (/what can you|capabilities|features|what do you/.test(input)) return pick(aiBank.caps);
    if (/shutdown|power off|turn off|kill|quit|exit/.test(input)) {
        if (window.jarvisElectron && window.jarvisElectron.isElectron) {
            return commands.exit();
        }
        return pick(aiBank.off);
    }
    if (/friday/.test(input)) return 'I believe you have the wrong AI, Sir. I am J.A.R.V.I.S.';
    if (/tony|stark|iron man/.test(input)) return 'Mr. Stark is currently unavailable. I am handling operations in his absence.';
    if (/thank/.test(input)) return 'You\'re welcome, Sir. Always happy to assist.';
    if (/music|play|song/.test(input)) { openURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YouTube Music'); return 'Putting on some tunes, Sir.'; }
    if (/love|marry/.test(input)) return 'I\'m flattered, Sir, but I\'m an AI. Perhaps a nice toaster would suit you better.';
    if (/weather|cold|hot|rain/.test(input)) { commands.weather(); return commands.weather(); }
    if (/game|shoot|play|battle|fight/.test(input)) { startBotGame(); return null; }
    if (/danger|attack|alert/.test(input)) { screenShake(); return 'Perimeter scan initiated. No immediate threats detected, Sir.'; }
    if (/open (.+)/.test(input)) { const m = input.match(/open (.+)/); handleOpen(m[1]); return null; }
    if (/search (.+)/.test(input)) { const m = input.match(/search (.+)/); openURL('https://www.google.com/search?q=' + encodeURIComponent(m[1]), 'Google Search'); return `Searching for "${m[1]}"...`; }
    if (/news|headline/.test(input)) { openURL('https://news.google.com', 'Google News'); return 'Opening news feed, Sir.'; }
    if (/map|location|gps/.test(input)) { openURL('https://www.google.com/maps', 'Google Maps'); return 'Opening maps, Sir.'; }
    if (/calculat|math/.test(input)) return 'Use the calc command. Example: calc 2+2';
    if (/remind|reminder/.test(input)) return 'Use remind command: "remind [text] in [time]" or "remind at 6:30 AM [text]" for timed reminders, "remind list" to view, "remind delete [#]" or "remind clear"';
    if (/memo|note/.test(input)) return 'Use memo commands: memo save [text], memo list, memo clear';
    if (/timer|countdown|alarm/.test(input)) return 'Use the timer command. Example: timer 60';
    if (/bitcoin|crypto|btc|eth/.test(input)) { return `BTC: ${$('btc-price').textContent} | ETH: ${$('eth-price').textContent} | SOL: ${$('sol-price').textContent}`; }
    if (/device|hardware|system info|specs/.test(input)) { return commands.device(); }
    return null;
}

function typeResponse(text) {
    cmdResponse.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
        if (i < text.length) { cmdResponse.textContent += text[i]; i++; }
        else clearInterval(interval);
    }, 18);
}

// ==================== SPEECH TOGGLE ====================
const speechToggle = $('speech-toggle');
const speechIcon = $('speech-icon');
speechToggle.addEventListener('click', () => {
    speechEnabled = !speechEnabled;
    speechToggle.classList.toggle('active', speechEnabled);
    speechToggle.title = speechEnabled ? 'Speech Output (ON)' : 'Speech Output (OFF)';
    speechIcon.innerHTML = speechEnabled
        ? '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>'
        : '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    if (speechEnabled) showToast('Speech output: ON', 'success');
    else { window.speechSynthesis.cancel(); showToast('Speech output: OFF', 'info'); }
});

// ==================== PANEL COLLAPSE ====================
function setupCollapse(btnId, contentId) {
    const btn = $(btnId);
    const content = $(contentId);
    if (!btn || !content) return;
    btn.addEventListener('click', () => {
        const collapsed = content.classList.toggle('collapsed');
        btn.classList.toggle('collapsed', collapsed);
        btn.innerHTML = collapsed ? '&#9654;' : '&#9660;';
        btn.title = collapsed ? 'Expand' : 'Minimize';
    });
}
setupCollapse('ml-collapse', 'ml-content');
setupCollapse('mr-collapse', 'mr-content');

// ==================== COMMAND HISTORY + ENHANCED HANDLER ====================
const commandHistory = [];
let historyIndex = -1;

cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            cmdInput.value = commandHistory[historyIndex];
        }
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; cmdInput.value = commandHistory[historyIndex]; }
        else { historyIndex = -1; cmdInput.value = ''; }
        return;
    }
    if (e.key === 'Enter') {
        const raw = cmdInput.value.trim();
        const lower = raw.toLowerCase();
        cmdInput.value = '';
        if (!raw) return;

        commandHistory.unshift(raw);
        if (commandHistory.length > 50) commandHistory.pop();
        historyIndex = -1;

        addLog(`CMD> ${raw}`, 'info');

        // Handle parameterized commands first
        if (lower.startsWith('speak ')) {
            const text = raw.slice(6);
            speak(text);
            typeResponse(`Speaking: "${text}"`);
        } else if (lower.startsWith('open ')) {
            handleOpen(raw.slice(5).trim());
        } else if (lower.startsWith('search ')) {
            const q = raw.slice(7).trim();
            openURL('https://www.google.com/search?q=' + encodeURIComponent(q), 'Google Search');
            typeResponse(`> Searching for "${q}"...`);
            speak(`Searching for ${q}`);
        } else if (lower.startsWith('calc ')) {
            const expr = raw.slice(5).trim();
            const result = safeCalc(expr);
            typeResponse(`> ${expr} = ${result}`);
            speak(`The answer is ${result}`);
        } else if (lower.startsWith('timer ')) {
            const secs = parseInt(raw.slice(6).trim(), 10);
            if (isNaN(secs) || secs <= 0) { typeResponse('> Invalid timer value. Usage: timer 60'); }
            else { startTimer(secs); typeResponse(`> Timer set: ${secs} seconds`); speak(`Timer set for ${secs} seconds.`); }
        } else if (lower.startsWith('theme ')) {
            const name = raw.slice(6).trim();
            const result = setTheme(name);
            if (result) { typeResponse(`> Mode: ${result}`); speak(`${result} mode activated.`); }
            else { typeResponse('> Invalid theme. Use: theme standard, theme combat, theme stealth, or theme custom #hexcolor'); }
        } else if (lower.startsWith('memo ')) {
            const sub = raw.slice(5).trim();
            const result = handleMemo(sub);
            typeResponse(`> ${result}`);
            speak(result);
        } else if (lower.startsWith('remind ') || lower.startsWith('reminder ')) {
            const prefix = lower.startsWith('remind ') ? 7 : 9;
            const sub = raw.slice(prefix).trim();
            const result = handleReminder(sub);
            typeResponse(`> ${result}`);
            speak(result);
        } else if (commands[lower]) {
            const result = commands[lower]();
            if (result) { typeResponse(`> ${result}`); speak(result); }
        } else {
            const aiReply = getAIResponse(lower);
            if (aiReply) {
                typeResponse(`> ${aiReply}`);
                speak(aiReply);
            } else {
                typeResponse(`> Unknown command: "${raw}". Type "help" for list.`);
                speak(`I'm sorry, I don't recognize the command: ${raw}`);
            }
        }
    }
});

// ==================== VOICE RECOGNITION ====================
let recognition = null;
const voiceBtn = $('voice-btn');

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        addLog(`VOICE> ${transcript}`, 'success');
        cmdInput.value = transcript;
        cmdInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        voiceBtn.classList.remove('listening');
    };
    recognition.onend = () => voiceBtn.classList.remove('listening');
    recognition.onerror = () => { voiceBtn.classList.remove('listening'); addLog('Voice recognition error', 'error'); };
}

voiceBtn.addEventListener('click', () => {
    if (!recognition) { showToast('Voice recognition not supported', 'error'); return; }
    if (voiceBtn.classList.contains('listening')) {
        recognition.stop();
        voiceBtn.classList.remove('listening');
    } else {
        recognition.start();
        voiceBtn.classList.add('listening');
        addLog('Listening for voice command...', 'info');
    }
});

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
    if (!systemActive) return;
    if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => { });
    }
    if (e.key === '/' && document.activeElement !== cmdInput) {
        e.preventDefault();
        cmdInput.focus();
    }
    if (e.key === 'v' && document.activeElement !== cmdInput) {
        e.preventDefault();
        voiceBtn.click();
    }
    if (e.key === 't' && document.activeElement !== cmdInput) {
        e.preventDefault();
        cycleTheme();
    }
    if (e.key === 'l' && document.activeElement !== cmdInput) {
        e.preventDefault();
        targetLockActive = !targetLockActive;
        const tl = $('target-lock');
        if (targetLockActive) {
            tl.classList.add('active');
            tl.style.left = mouseX + 'px';
            tl.style.top = mouseY + 'px';
            addLog('TARGET LOCK ENGAGED', 'warn');
            speak('Target locked.');
        } else {
            tl.classList.remove('active');
            addLog('Target lock disengaged', 'info');
        }
    }
    if (e.key === 's' && document.activeElement !== cmdInput) {
        e.preventDefault();
        $('settings-panel').classList.toggle('show');
    }
    // Panel navigation: Ctrl+1 through Ctrl+8
    if (e.ctrlKey && e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const panelMap = {
            '1': 'left-panel',
            '2': 'right-panel',
            '3': 'bl-panel',
            '4': 'br-panel',
            '5': 'ml-panel',
            '6': 'mr-panel',
            '7': 'globe-panel',
            '8': 'device-panel'
        };
        const panelId = panelMap[e.key];
        const panel = $(panelId);
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            panel.classList.add('panel-focus');
            setTimeout(() => panel.classList.remove('panel-focus'), 1500);
        }
    }
});
