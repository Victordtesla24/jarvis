// ==================== J.A.R.V.I.S. AI ENGINE v3.0 ====================
// Dependencies: utils.js, tools.js, commands.js, ai-personality.js, ai-time.js,
//               ai-system-monitor.js, ai-learning.js, ai-advanced-commands.js

// ==================== 1. CONTEXT MEMORY ====================
const jarvisContext = {
    exchanges: [],
    lastAction: null,
    lastActionResult: null,
    MAX: 10,
    add(user, response, meta) {
        this.exchanges.push({ user, response, ts: Date.now(), ...meta });
        if (this.exchanges.length > this.MAX) this.exchanges.shift();
    },
    last() { return this.exchanges[this.exchanges.length - 1] || null; },
    recent(n) { return this.exchanges.slice(-(n || 3)); }
};

// ==================== TOPIC DETECTION ====================
function detectTopic(input) {
    const lower = input.toLowerCase();
    const map = [
        [/weather|temperature|forecast|rain|cold|hot|humid/, 'weather'],
        [/map|location|direction|navigate/, 'maps'],
        [/scan|full spectrum/, 'scan'],
        [/diagnos/, 'diag'],
        [/security|firewall|audit|intrusion/, 'security'],
        [/crypto|bitcoin|ethereum|solana/, 'crypto'],
        [/threat|danger|alert/, 'threat'],
        [/network|netinfo|ip\b|latency|bandwidth/, 'network'],
        [/process|cpu|memory|ram/, 'processes'],
        [/health|subsystem/, 'health'],
        [/timer|countdown|remind/, 'timer'],
        [/calc|math|compute/, 'calc'],
        [/open|launch|browse/, 'open'],
        [/search|find|look up|google/, 'search'],
        [/game|play.*game|shoot/, 'game'],
        [/battery|charging|power level/, 'battery'],
        [/storage|disk space/, 'storage'],
        [/gpu|graphics/, 'gpu'],
        [/benchmark|speed test/, 'benchmark'],
        [/permission/, 'permissions'],
        [/system check|what.?s working|what.?s broken/, 'systemcheck'],
        [/my stats|usage|analytics/, 'mystats'],
        [/alias/, 'alias'],
        [/clipboard/, 'clipboard'],
        [/screen|display/, 'screen'],
    ];
    for (const [re, t] of map) { if (re.test(lower)) return t; }
    return null;
}

// ==================== 2. INTENT CLASSIFICATION ====================
const INTENT_DEFS = {
    COMMAND: [
        { re: /^(status|time|weather|threat|scan|diag|netinfo|security|integrity|processes|uptime|health|autoscan|ip|reactor|reboot|clear|help|helpwalkthrough|globe|lock|hum|surge|device|crypto|clock|export|game)$/i, s: 1.0 },
        { re: /\b(run|execute|start|launch|trigger|initiate|activate|perform|do)\s+(a\s+)?(scan|diagnostic|security|audit|reboot|check|analysis)/i, s: 0.9 },
        { re: /\b(check|show|display|get|give me|pull up)\s+(the\s+)?(status|stats|diagnostics?|weather|time|processes|uptime|health|threat|network|security|log|crypto|clock)/i, s: 0.85 },
    ],
    PARAMETERIZED: [
        { re: /^(open|search|calc|timer|memo|speak|theme)\s/i, s: 1.0 },
        { re: /\b(open|launch|go to|navigate to|visit)\s+(.+)/i, s: 0.85 },
        { re: /\b(search|look up|google|find)\s+(.+)/i, s: 0.85 },
        { re: /\b(calculate|compute|what(?:'s| is))\s+\d/i, s: 0.7 },
        { re: /\b(set\s+(?:a\s+)?timer|timer|countdown|remind me)\b/i, s: 0.8 },
        { re: /\btheme\s+(standard|combat|stealth)/i, s: 0.9 },
    ],
    QUESTION: [
        { re: /^(what|who|where|when|why|how|is|are|can|could|would|will|do|does|did)\b/i, s: 0.7 },
        { re: /\?$/, s: 0.5 },
        { re: /\b(tell me|explain|describe|show me|what about)\b/i, s: 0.7 },
    ],
    CONVERSATION: [
        { re: /^(hi|hello|hey|greetings|yo|sup|good\s+(morning|afternoon|evening))\b/i, s: 0.9 },
        { re: /\b(thank|thanks|cheers|appreciate)\b/i, s: 0.8 },
        { re: /\b(joke|funny|humor|laugh|entertain)\b/i, s: 0.8 },
        { re: /\b(who are you|what are you|your name|about you)\b/i, s: 0.9 },
        { re: /\b(how are you|how.*doing|you ok|how.*feel)\b/i, s: 0.9 },
        { re: /\b(love|marry|friend|like you)\b/i, s: 0.7 },
        { re: /\b(good\s+(job|work)|well done|amazing|awesome|nice|great)\b/i, s: 0.8 },
        { re: /\b(shutdown|power off|turn off|kill)\b/i, s: 0.8 },
        { re: /\bfriday\b/i, s: 0.8 },
        { re: /\b(tony|stark|iron man)\b/i, s: 0.8 },
    ],
    NAVIGATION: [
        { re: /\b(open|go to|navigate|visit|launch|browse)\b/i, s: 0.6 },
        { re: /\b(youtube|google|github|reddit|twitter|facebook|instagram|wikipedia|netflix|spotify|discord)\b/i, s: 0.7 },
    ],
    SYSTEM: [
        { re: /\b(scan|diagnos|security|firewall|network|audit|threat|integrity|reboot|processes|health|autoscan)\b/i, s: 0.6 },
    ],
    SEARCH: [
        { re: /\b(search|find|look up|google|query|lookup)\b/i, s: 0.7 },
        { re: /\b(news|headline|latest|trending)\b/i, s: 0.5 },
    ],
    CREATIVE: [
        { re: /\b(philosophy|meaning of life|existential|purpose|consciousness)\b/i, s: 0.8 },
        { re: /\b(science|fact|physics|chemistry|biology|quantum|space|universe)\b/i, s: 0.8 },
        { re: /\b(motivat|inspir|quot|wisdom|advice)\b/i, s: 0.8 },
        { re: /\b(tech|trivia|history|invention|technology)\b/i, s: 0.8 },
        { re: /\b(stark\s+industr|tony.*lab|arc\s+reactor\s+history|avenger)\b/i, s: 0.8 },
        { re: /\b(your\s+(?:opinion|favorite|prefer|think)|do\s+you\s+(?:like|enjoy|prefer|think|believe))\b/i, s: 0.7 },
    ],
};

function classifyIntent(input) {
    const lower = input.toLowerCase().trim();
    const scores = {};
    for (const [cat, pats] of Object.entries(INTENT_DEFS)) {
        let best = 0;
        for (const p of pats) { if (p.re.test(lower) && p.s > best) best = p.s; }
        if (best > 0) scores[cat] = best;
    }
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return { best: sorted.length ? sorted[0][0] : 'CONVERSATION', scores, all: sorted };
}

// ==================== 3. MULTI-TURN / CONTEXT RESOLUTION ====================
function resolveContext(input, entities, intent) {
    const lower = input.toLowerCase();
    const last = jarvisContext.last();
    if (!last) return { input, entities, resolved: false };

    if (/^(what|how) about\b/.test(lower) || /^and\s/.test(lower)) {
        const stripped = input.replace(/^(what|how) about\s*/i, '').replace(/^and\s+/i, '');
        if (entities.city && last.topic === 'weather') {
            return { input: 'weather ' + entities.city, entities, resolved: true };
        }
        if (entities.city && last.topic === 'maps') {
            return { input: 'open maps ' + entities.city, entities, resolved: true };
        }
        if (last.topic) {
            return { input: last.topic + ' ' + stripped, entities, resolved: true };
        }
    }

    if (/\b(results?|what happened|outcome|find anything|report|what did you find)\b/.test(lower) && jarvisContext.lastActionResult) {
        return { input: '__recall__', entities, resolved: true };
    }

    return { input, entities, resolved: false };
}

// ==================== 4. ENTITY EXTRACTION ====================
const knownCities = [
    'tokyo','london','new york','paris','sydney','dubai','berlin','moscow',
    'beijing','seoul','mumbai','kathmandu','los angeles','chicago',
    'san francisco','toronto','singapore','hong kong','bangkok','rome',
    'madrid','amsterdam','vancouver','cairo','istanbul','rio de janeiro',
    'mexico city','shanghai','delhi','jakarta','nairobi','cape town',
    'lima','bogota','tehran','taipei','oslo','stockholm','vienna',
    'budapest','prague','warsaw','athens','lisbon','zurich','denver',
    'seattle','boston','miami','dallas','houston','phoenix','portland',
    'las vegas','honolulu','anchorage','montreal','nepal','pokhara', 'kathmandu'
];

function extractEntities(input) {
    const lower = input.toLowerCase();
    const ent = {};

    for (const c of knownCities) { if (lower.includes(c)) { ent.city = c; break; } }

    const nums = [];
    let m;
    const nr = /\b(\d+(?:\.\d+)?)\b/g;
    while ((m = nr.exec(lower)) !== null) nums.push(parseFloat(m[1]));
    if (nums.length) ent.numbers = nums;

    const urlMatch = lower.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) ent.url = urlMatch[1];

    for (const s of Object.keys(siteMap)) { if (lower.includes(s)) { ent.app = s; break; } }

    const t = parseNaturalTime(lower);
    if (t) ent.timerSeconds = t;

    const mathM = lower.match(/(?:calc(?:ulate)?|compute|what(?:'s| is))\s+(.+)/);
    if (mathM) ent.mathExpr = mathM[1].replace(/[?]$/g, '').trim();

    return ent;
}

// ==================== 5. SENTIMENT AWARENESS ====================
function analyzeSentiment(input) {
    const l = input.toLowerCase();
    if (/\b(damn|dammit|wtf|stupid|broken|useless|annoying|ugh|fix this|wrong|doesn'?t work|not working|hate|terrible|awful|sucks|crap|come on|seriously|what the)\b/i.test(l)) return 'frustrated';
    if (/\b(now|immediately|asap|hurry|urgent|quick|fast|emergency|critical|right now|quickly)\b/i.test(l)) return 'urgent';
    if (/\b(thanks|awesome|great|perfect|amazing|love it|wonderful|excellent|nice|good job|well done|brilliant)\b/i.test(l)) return 'happy';
    if (/\b(hey|yo|sup|lol|haha|cool|chill|dude|bro|man|nah|yeah|yep|nope|gonna|wanna|kinda|sorta|btw)\b/i.test(l)) return 'casual';
    return 'neutral';
}

function adjustTone(response, sentiment) {
    const apologies = [
        'I apologize for the trouble, Sir. ',
        'I understand your frustration. Let me address that immediately. ',
        'My apologies, Sir. ',
        'Sorry about that, Sir. Allow me to correct course. ',
        'I hear you, Sir. Resolving this right away. '
    ];
    switch (sentiment) {
        case 'frustrated':
            return apologies[Math.floor(Math.random() * apologies.length)] + response;
        case 'urgent':
            return response.replace(/\.$/, '') + ' — executing with priority, Sir.';
        case 'casual':
            return response.replace(/\bSir\b/g, 'boss').replace(/\bInitiating\b/g, 'Firing up').replace(/\bAffirmative\b/g, 'Sure thing');
        case 'happy':
            return response + (response.endsWith('.') ? '' : '.') + ' Glad to help!';
        default: return response;
    }
}

// ==================== 6. FUZZY COMMAND MATCHING ====================
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return d[m][n];
}

const validCommands = [
    'status','time','weather','threat','scan','diagnostic','diag',
    'netinfo','security','integrity','processes','uptime','health',
    'autoscan','ip','reactor','reboot','clear','help','helpwalkthrough',
    'globe','lock','hum','surge','device','crypto','clock','export',
    'game','open','search','calc','timer','memo','speak','theme',
    'youtube','google','github','news','maps',
    'battery','batterydetail','networkdetail','memorycheck','memorydetail',
    'storagecheck','storagedetail','gpuinfo','gpudetail','perfcheck','perfdetail',
    'permissions','devices','systemcheck','whatworks','mystats','alias',
    'verbose','brief','proactive','locate','tabinfo','screeninfo',
    'clipboard','colorscheme','benchmark','speedtest','helpadvanced','resetlearning'
];

function fuzzyMatchCommand(input) {
    const first = input.toLowerCase().trim().split(/\s+/)[0];
    if (validCommands.includes(first)) return null;
    let bestCmd = null, bestDist = Infinity;
    for (const cmd of validCommands) {
        const d = levenshtein(first, cmd);
        if (d < bestDist && d <= Math.max(2, Math.ceil(cmd.length * 0.4))) {
            bestDist = d; bestCmd = cmd;
        }
    }
    return (bestCmd && bestDist > 0 && bestDist <= 3) ? { original: first, corrected: bestCmd, distance: bestDist } : null;
}

// ==================== 7. SMART SUGGESTIONS ====================
const suggestionMap = {
    scan:       ['Would you like me to run a security audit as well, Sir?',
                 'Shall I open the full diagnostic panel?',
                 'Want me to check the threat assessment?'],
    security:   ['Should I verify the data integrity hash?',
                 'Want to see the full process list?',
                 'Shall I trigger a health matrix scan?'],
    diag:       ['Want me to export the diagnostic report?',
                 'Should I run a security audit next?',
                 'Shall I check the threat level?'],
    status:     ['Want a detailed diagnostic scan?',
                 'Shall I check the network intelligence?',
                 'Would you like the full threat assessment?'],
    weather:    ['Would you like to open the world clock?',
                 'Shall I check conditions in another city?',
                 'Want me to open a weather map?'],
    threat:     ['Shall I run a full security scan?',
                 'Want me to activate the proximity radar?',
                 'Should I check the firewall status?'],
    netinfo:    ['Want me to run a security audit on the network?',
                 'Shall I check endpoint connectivity?',
                 'Would you like to test latency?'],
    processes:  ['Should I check CPU and memory usage?',
                 'Want me to run a health matrix scan?',
                 'Shall I look for anomalous processes?'],
    health:     ['Want me to run a full diagnostic?',
                 'Should I check the subsystem processes?',
                 'Shall I verify the integrity hash?'],
    crypto:     ['Want me to search for more market data?',
                 'Shall I open a crypto exchange?'],
    game:       ['Nice game! Want to check the system status?',
                 'Shall I run diagnostics after that action?'],
};

function getSuggestion(cmdName) {
    const opts = suggestionMap[cmdName];
    if (!opts || Math.random() > 0.55) return null;
    return opts[Math.floor(Math.random() * opts.length)];
}

function suggestionToCommand(text) {
    const l = text.toLowerCase();
    const map = [
        [/security audit/, 'security'], [/diagnostic/, 'diag'], [/threat/, 'threat'],
        [/integrity/, 'integrity'], [/process/, 'processes'], [/health/, 'health'],
        [/export/, 'export'], [/world clock/, 'clock'], [/weather map/, 'maps'],
        [/network/, 'netinfo'], [/status/, 'status'], [/connectivity/, 'netinfo'],
        [/latency/, 'netinfo'], [/cpu|memory/, 'status'], [/subsystem/, 'health'],
        [/proximity|radar/, 'scan'], [/firewall/, 'security'], [/market/, 'crypto'],
        [/exchange/, 'crypto'], [/scan/, 'scan'],
    ];
    for (const [re, cmd] of map) { if (re.test(l)) return cmd; }
    return null;
}

// ==================== 10. CHAINED COMMANDS ====================
const cmdStarters = /^(run|scan|check|open|search|diag|security|status|time|weather|threat|integrity|processes|uptime|health|autoscan|reboot|clear|help|globe|lock|hum|surge|device|crypto|clock|export|game|calc|timer|memo|speak|theme|show|display|get|launch|execute|start|activate|trigger|perform)/i;

function splitChainedCommands(input) {
    const parts = input.split(/\s+(?:and\s+then|then)\s+/i);
    if (parts.length > 1) return parts.map(p => p.trim()).filter(Boolean);

    const andParts = input.split(/\s+and\s+/i);
    if (andParts.length > 1) {
        const allCmd = andParts.every(p => cmdStarters.test(p.trim()));
        if (allCmd) return andParts.map(p => p.trim()).filter(Boolean);
    }
    return [input];
}

// ==================== TYPE RESPONSE WITH SUGGESTION CHIPS ====================
function typeResponseV2(text, suggestion) {
    const resp = $('cmd-response');
    resp.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
        if (i < text.length) { resp.textContent += text[i]; i++; }
        else {
            clearInterval(iv);
            if (suggestion) {
                setTimeout(() => {
                    const br = document.createElement('br');
                    const chip = document.createElement('button');
                    chip.className = 'jarvis-suggestion-chip';
                    chip.textContent = suggestion;
                    chip.addEventListener('click', () => {
                        const cmd = suggestionToCommand(suggestion);
                        if (cmd) {
                            const el = $('cmd-input');
                            el.value = cmd;
                            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
                        }
                        chip.remove(); br.remove();
                    });
                    resp.appendChild(br);
                    resp.appendChild(chip);
                }, 500);
            }
        }
    }, 18);
}

// ==================== NL-TO-COMMAND MAP ====================
const nlMap = {
    'run a scan':'scan','run scan':'scan','system scan':'scan','full scan':'scan','full spectrum scan':'scan',
    'run diagnostic':'diag','run diagnostics':'diag','system diagnostic':'diag','full diagnostic':'diag','run a diagnostic':'diag',
    'check security':'security','security audit':'security','run security':'security','security check':'security','run a security audit':'security',
    'check status':'status','system status':'status','show status':'status','give me status':'status',
    'check weather':'weather','show weather':'weather','weather report':'weather','get weather':'weather',
    'check threat':'threat','threat level':'threat','show threat':'threat','threat assessment':'threat',
    'check network':'netinfo','network info':'netinfo','network status':'netinfo','show network':'netinfo',
    'show processes':'processes','list processes':'processes','check processes':'processes',
    'check uptime':'uptime','show uptime':'uptime','system uptime':'uptime',
    'check health':'health','health check':'health','system health':'health','show health':'health',
    'check integrity':'integrity','verify integrity':'integrity','hash check':'integrity',
    'show crypto':'crypto','crypto prices':'crypto','check crypto':'crypto',
    'show clock':'clock','world clock':'clock','world time':'clock',
    'show devices':'device','device info':'device','check devices':'device',
    'start game':'game','launch game':'game','play game':'game','play the game':'game',
    'export log':'export','export logs':'export','download log':'export',
    'show reactor':'reactor','reactor status':'reactor','check reactor':'reactor',
    'show globe':'globe','satellite tracker':'globe','satellite status':'globe',
    'power surge':'surge','trigger surge':'surge',
    'target lock':'lock','toggle lock':'lock',
    'reactor hum':'hum','ambient hum':'hum',
    'restart system':'reboot','restart':'reboot','system reboot':'reboot',
};

// ==================== ENHANCED AI CONVERSATIONAL ENGINE ====================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function enhancedAI(input, entities, sentiment, intent) {
    const l = input.toLowerCase().trim();

    // --- Conversational ---
    if (/^(hi|hello|hey|greetings|yo|sup|good\s+(morning|afternoon|evening))\b/.test(l)) return pick(PB.greeting);
    if (/\b(good (job|work)|well done|amazing|awesome|nice|great|bravo|excellent)\b/.test(l)) return pick(PB.compliment);
    if (/\b(joke|funny|humor|laugh|entertain|amuse)\b/.test(l)) return pick(PB.joke);
    if (/\b(who are you|what are you|your name|about you|identify yourself)\b/.test(l)) return pick(PB.who);
    if (/\b(how are you|how.*doing|you ok|how.*feel)\b/.test(l)) return pick(PB.how);
    if (/\b(what can you|capabilities|features|what do you|what.*abilities)\b/.test(l)) return pick(PB.caps);
    if (/\b(shutdown|power off|turn off|kill)\b/.test(l)) return pick(PB.off);
    if (/\bfriday\b/.test(l)) return pick(PB.friday);
    if (/\b(tony|stark|iron man)\b/.test(l)) return pick(PB.tony);
    if (/\bthank/.test(l)) return pick(PB.thanks);
    if (/\b(love|marry|date me)\b/.test(l)) return pick(PB.love);
    if (/\b(music|play a song|play music|song)\b/.test(l)) { openURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YouTube Music'); return 'Putting on some tunes, Sir.'; }
    if (/\b(danger|attack|alert)\b/.test(l)) { screenShake(); return pick(PB.danger); }

    // --- System monitoring natural language ---
    if (/\b(battery|charging|power level|power status|how much (battery|charge|power))\b/.test(l)) {
        if (/\b(detail|health|report|full|deep)\b/.test(l)) return SystemMonitor.battery.getDetailedReport();
        return SystemMonitor.battery.getReport();
    }
    if (/\b(memory|ram|heap)(\s+(usage|check|status|info))?\b/.test(l) && !/\b(memo|remember)\b/.test(l)) {
        if (/\b(detail|full|deep)\b/.test(l)) return SystemMonitor.memory.getDetailedReport();
        return SystemMonitor.memory.getReport();
    }
    if (/\b(storage|disk space|how much (space|storage))\b/.test(l)) {
        return 'Checking storage... ' + (await SystemMonitor.storage.getReport());
    }
    if (/\b(gpu|graphics card|graphics info|what gpu|which gpu)\b/.test(l)) {
        if (/\b(detail|full|deep)\b/.test(l)) return SystemMonitor.gpu.getDetailedReport();
        return SystemMonitor.gpu.getReport();
    }
    if (/\b(performance|page (speed|load)|how fast|benchmark)\b/.test(l) && !/\b(game|play)\b/.test(l)) {
        if (/\b(benchmark|test|run)\b/.test(l)) return commands.benchmark();
        return SystemMonitor.performance.getReport();
    }
    if (/\b(system check|full check|check everything|diagnose system|comprehensive|is everything (ok|working|fine))\b/.test(l)) {
        const result = await SystemMonitor.fullSystemCheck();
        buildSystemReportPanel(result);
        const note = result.failures > 0 ? pick(PB.systemHealthBad) : pick(PB.systemHealthGood);
        return note + ' — ' + result.passed + ' passed, ' + result.warnings + ' warnings, ' + result.failures + ' failures.';
    }
    if (/\b(what.?s working|what.?s broken|what.?s not working|is everything working|what works|what is broken|functioning)\b/.test(l)) {
        const result = await SystemMonitor.fullSystemCheck();
        const working = result.checks.filter(c => c.status === 'ok').map(c => c.name);
        const issues = result.checks.filter(c => c.status !== 'ok' && c.status !== 'unknown');
        if (issues.length === 0) return pick(PB.systemHealthGood) + ' Everything is operational: ' + working.join(', ');
        return pick(PB.systemHealthBad) + ' Issues: ' + issues.map(c => c.name + ' (' + c.detail + ')').join(', ');
    }
    if (/\b(permission|permissions|what.?s allowed|access)\b/.test(l) && /\b(check|status|show|list|what)\b/.test(l)) {
        return await SystemMonitor.permissions.getReport();
    }
    if (/\b(speed test|internet speed|test speed|download speed)\b/.test(l)) {
        return await commands.speedtest();
    }
    if (/\b(my stats|my data|my usage|usage stats|analytics|how (much|many) (have i|commands|times))\b/.test(l)) {
        return JarvisLearning.getUserReport();
    }
    if (/\b(screen|display|resolution|monitor)\b/.test(l) && /\b(info|size|resolution|details?)\b/.test(l)) {
        return commands.screeninfo();
    }
    if (/\b(clipboard|paste|what.?s copied|buffer)\b/.test(l)) {
        try { return await commands.clipboard(); } catch { return 'Clipboard access denied.'; }
    }
    if (/\b(dark mode|light mode|color scheme|system (mode|preference))\b/.test(l)) {
        return commands.colorscheme();
    }
    if (/\b(where am i|my location|locate me|gps|find me)\b/.test(l)) {
        return await SystemMonitor.geolocation.getReport();
    }

    // --- Creative / Personality depth ---
    if (/\b(philosophy|meaning of life|existential|purpose|consciousness|free will|existence)\b/.test(l)) return pick(PB.philosophy);
    if (/\b(science fact|physics|chemistry|biology|quantum|space|universe|neutron|atom|tell me.*fact|random fact)\b/.test(l)) return pick(PB.science);
    if (/\b(motivat|inspir|quot|wisdom|advice|encourage|cheer me up|feel down)\b/.test(l)) return pick(PB.motivation);
    if (/\b(tech trivia|tech fact|computer history|first computer|fun fact|technology fact|did you know)\b/.test(l)) return pick(PB.techTrivia);
    if (/\b(stark industr|tony.*lab|arc reactor.*history|avenger|stark tower|vibranium|mark \d|stark.*lore)\b/.test(l)) return pick(PB.starkLore);
    if (/\b(your (opinion|favorite|prefer)|do you (like|enjoy|prefer|think|believe)|what.*you.*think)\b/.test(l)) return pick(PB.opinions);

    // --- Entity-routed commands ---
    if (/\b(weather|temperature|forecast|cold|hot|rain)\b/.test(l)) {
        const base = commands.weather();
        if (entities.city) {
            const cap = entities.city.replace(/\b\w/g, c => c.toUpperCase());
            return base + ' — For live data in ' + cap + ', I\'d recommend a dedicated lookup, Sir.';
        }
        return base;
    }

    if (/\b(timer|countdown|alarm|remind me in|set a timer|set timer)\b/.test(l)) {
        if (entities.timerSeconds) {
            startTimer(entities.timerSeconds);
            return 'Timer set for ' + formatTimeFriendly(entities.timerSeconds) + ', Sir.';
        }
        return 'Try: "timer 5 minutes", "set a 90 second timer", or "remind me in half an hour".';
    }

    if (/\b(calculat|math|compute)\b/.test(l) || /^what(?:'s| is)\s+\d/.test(l)) {
        if (entities.mathExpr) {
            const expr = entities.mathExpr
                .replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-')
                .replace(/\btimes\b/gi, '*').replace(/\bmultiplied by\b/gi, '*')
                .replace(/\bdivided by\b/gi, '/').replace(/\bover\b/gi, '/')
                .replace(/\bmod\b/gi, '%').replace(/\bpower\b/gi, '**')
                .replace(/\bx\b/gi, '*');
            const r = safeCalc(expr);
            return entities.mathExpr + ' = ' + r;
        }
        return 'Use calc: "calc 2+2" or "what\'s 100 times 5"';
    }

    if (/\b(open|launch|go to|navigate|visit|browse)\b/.test(l)) {
        if (entities.app) { handleOpen(entities.app); return null; }
        if (entities.url) { handleOpen(entities.url); return null; }
        const openM = l.match(/(?:open|launch|go to|navigate to|visit|browse)\s+(.+)/);
        if (openM) { handleOpen(openM[1].trim()); return null; }
    }

    if (/\b(search|look up|google|find info)\b/.test(l)) {
        const sM = l.match(/(?:search|look up|google|find)\s+(?:for\s+)?(.+)/);
        if (sM) {
            const q = sM[1].trim();
            openURL('https://www.google.com/search?q=' + encodeURIComponent(q), 'Google Search');
            return 'Searching for "' + q + '"...';
        }
    }

    if (/\b(news|headline)\b/.test(l)) { openURL('https://news.google.com', 'Google News'); return 'Opening news feed, Sir.'; }
    if (/\bmap\b|location|gps/.test(l)) {
        if (entities.city) {
            openURL('https://www.google.com/maps/search/' + encodeURIComponent(entities.city), 'Google Maps: ' + entities.city);
            return 'Opening map for ' + entities.city.replace(/\b\w/g, c => c.toUpperCase()) + ', Sir.';
        }
        openURL('https://www.google.com/maps', 'Google Maps');
        return 'Opening maps, Sir.';
    }
    if (/\b(bitcoin|crypto|btc|eth|sol|cryptocurrency)\b/.test(l)) {
        return 'BTC: ' + $('btc-price').textContent + ' | ETH: ' + $('eth-price').textContent + ' | SOL: ' + $('sol-price').textContent;
    }
    if (/\b(device|hardware|system info|specs)\b/.test(l)) return commands.device();
    if (/\b(remind|memo|note|remember this)\b/.test(l)) return 'Use memo commands: memo save [text], memo list, memo clear';
    if (/\b(game|shoot|battle|fight)\b/.test(l) && /\b(game|play|start|launch)\b/.test(l)) { startBotGame(); return null; }

    return null;
}

// ==================== MAIN COMMAND PROCESSOR ====================
async function processSingle(raw) {
    const lower = raw.toLowerCase().trim();
    if (!lower) return;

    // --- Alias resolution ---
    const aliasResolved = JarvisLearning.resolveAlias(lower);
    if (aliasResolved) {
        addLog('Alias resolved: "' + lower + '" → "' + aliasResolved + '"', 'info');
        return processSingle(aliasResolved);
    }

    const entities = extractEntities(lower);
    const sentiment = analyzeSentiment(lower);
    const intent = classifyIntent(lower);
    const topic = detectTopic(lower);

    // --- Record learning data ---
    JarvisLearning.recordInsight(intent.best, sentiment, raw.length);
    JarvisLearning.recordTopic(topic);

    const ctx = resolveContext(lower, entities, intent);
    let resolved = ctx.input;
    let resLower = resolved.toLowerCase().trim();
    let ent = entities;

    if (ctx.resolved) {
        const re = extractEntities(resLower);
        ent = Object.assign({}, entities, re);
    }

    // --- Multi-turn recall ---
    if (resolved === '__recall__') {
        const result = jarvisContext.lastActionResult || 'I don\'t have any recent results to report, Sir.';
        const r = adjustTone('Last result: ' + result, sentiment);
        typeResponseV2('> ' + r, null);
        speak(result);
        jarvisContext.add(raw, result, { intent: 'recall', topic: null, entities: ent });
        return;
    }

    // --- Alias command handler ---
    if (resLower.startsWith('alias ')) {
        const sub = resolved.slice(6).trim();
        const result = handleAlias(sub);
        typeResponseV2('> ' + result, null);
        speak(result);
        jarvisContext.add(raw, result, { intent: 'alias', topic: null, entities: ent });
        return;
    }

    // --- Whois handler ---
    if (resLower.startsWith('whois ')) {
        const target = resolved.slice(6).trim();
        if (!target) { typeResponseV2('> Usage: whois [IP or domain]', null); return; }
        typeResponseV2('> Looking up ' + target + '...', null);
        try {
            const res = await fetch('https://ipapi.co/' + encodeURIComponent(target) + '/json/');
            const data = await res.json();
            if (data.error) { typeResponseV2('> Lookup failed: ' + (data.reason || 'unknown'), null); return; }
            const info = [data.ip, data.org, data.city, data.region, data.country_name].filter(Boolean).join(' | ');
            typeResponseV2('> ' + info, null);
            speak('Lookup complete for ' + target);
            jarvisContext.add(raw, info, { intent: 'whois', topic: 'network', entities: ent });
        } catch {
            typeResponseV2('> Network lookup failed.', null);
        }
        return;
    }

    // --- Parameterized commands ---
    if (resLower.startsWith('speak ')) {
        const t = resolved.slice(6);
        speak(t);
        typeResponseV2('> Speaking: "' + t + '"', null);
        jarvisContext.add(raw, 'speak', { intent: 'speak', topic: null, entities: ent });
        return;
    }
    if (resLower.startsWith('open ')) {
        handleOpen(resolved.slice(5).trim());
        jarvisContext.add(raw, 'opening', { intent: 'open', topic: 'open', entities: ent });
        return;
    }
    if (resLower.startsWith('search ')) {
        const q = resolved.slice(7).trim();
        openURL('https://www.google.com/search?q=' + encodeURIComponent(q), 'Google Search');
        const resp = 'Searching for "' + q + '"...';
        typeResponseV2('> ' + resp, null);
        speak('Searching for ' + q);
        jarvisContext.add(raw, resp, { intent: 'search', topic: 'search', entities: ent });
        return;
    }
    if (resLower.startsWith('calc ')) {
        let expr = resolved.slice(5).trim();
        expr = expr.replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '-')
                   .replace(/\btimes\b/gi, '*').replace(/\bmultiplied by\b/gi, '*')
                   .replace(/\bdivided by\b/gi, '/').replace(/\bover\b/gi, '/')
                   .replace(/\bmod\b/gi, '%').replace(/\bpower\b/gi, '**')
                   .replace(/\bx\b/gi, '*');
        const result = safeCalc(expr);
        const resp = expr + ' = ' + result;
        typeResponseV2('> ' + resp, null);
        speak('The answer is ' + result);
        jarvisContext.add(raw, resp, { intent: 'calc', topic: 'calc', entities: ent });
        return;
    }
    if (resLower.startsWith('timer ')) {
        const tInput = resolved.slice(6).trim();
        let secs = parseNaturalTime(tInput);
        if (!secs) secs = parseInt(tInput, 10);
        if (isNaN(secs) || secs <= 0) {
            typeResponseV2('> Invalid timer. Try: "timer 5 minutes" or "timer 90 seconds"', null);
            return;
        }
        startTimer(secs);
        const friendly = formatTimeFriendly(secs);
        const resp = 'Timer set: ' + friendly;
        typeResponseV2('> ' + resp, null);
        speak('Timer set for ' + friendly + '.');
        jarvisContext.add(raw, resp, { intent: 'timer', topic: 'timer', entities: ent });
        jarvisContext.lastAction = 'timer'; jarvisContext.lastActionResult = resp;
        return;
    }
    if (resLower.startsWith('theme ')) {
        const name = resolved.slice(6).trim();
        const result = setTheme(name);
        if (result) { typeResponseV2('> Mode: ' + result, null); speak(result + ' mode activated.'); }
        else { typeResponseV2('> Invalid theme. Use: theme standard, theme combat, or theme stealth', null); }
        jarvisContext.add(raw, result || 'invalid theme', { intent: 'theme', topic: null, entities: ent });
        return;
    }
    if (resLower.startsWith('memo ')) {
        const sub = resolved.slice(5).trim();
        const result = handleMemo(sub);
        typeResponseV2('> ' + result, null);
        speak(result);
        jarvisContext.add(raw, result, { intent: 'memo', topic: null, entities: ent });
        return;
    }

    // --- Direct command match ---
    let matchedCmd = null;

    if (commands[resLower]) matchedCmd = resLower;

    if (!matchedCmd) {
        for (const [phrase, cmd] of Object.entries(nlMap)) {
            if (resLower.includes(phrase)) { matchedCmd = cmd; break; }
        }
    }

    if (matchedCmd) {
        let result = commands[matchedCmd]();
        // Handle async commands (battery, storage, speedtest, etc.)
        if (result && typeof result.then === 'function') result = await result;
        if (result) {
            const resp = adjustTone(result, sentiment);
            const sug = getSuggestion(matchedCmd);
            typeResponseV2('> ' + resp, sug);
            speak(typeof result === 'string' && result.length < 200 ? result : 'Command complete, Sir.');
            JarvisLearning.recordCommand(matchedCmd, raw);
            jarvisContext.add(raw, result, { intent: matchedCmd, topic: matchedCmd, entities: ent, actionResult: result });
            jarvisContext.lastAction = matchedCmd;
            jarvisContext.lastActionResult = result;

            // Proactive follow-up from learning
            if (!sug) {
                const proactive = JarvisLearning.getProactiveSuggestion();
                if (proactive) {
                    setTimeout(() => addLog('AI Suggestion: ' + proactive, 'info'), 2000);
                }
            }
        }
        return;
    }

    // --- Fuzzy command matching ---
    const fuzzy = fuzzyMatchCommand(resLower);
    if (fuzzy) {
        const corrected = resLower.replace(fuzzy.original, fuzzy.corrected);
        const msg = 'Did you mean "' + fuzzy.corrected + '"? Running it now.';
        typeResponseV2('> ' + msg, null);
        speak(msg);
        setTimeout(() => processSingle(corrected), 1500);
        return;
    }

    // --- AI conversational response ---
    const aiReply = await enhancedAI(resLower, ent, sentiment, intent);
    if (aiReply) {
        const resp = adjustTone(aiReply, sentiment);
        typeResponseV2('> ' + resp, null);
        speak(typeof aiReply === 'string' && aiReply.length < 200 ? aiReply : 'Processing complete, Sir.');
        JarvisLearning.recordCommand('conversation', raw);
        jarvisContext.add(raw, aiReply, { intent: intent.best, topic: topic || detectTopic(resLower), entities: ent });
        return;
    }

    // --- Absolute fallback ---
    const fb = adjustTone(pick(PB.unknown), sentiment);
    typeResponseV2('> ' + fb, null);
    speak(fb);
    jarvisContext.add(raw, fb, { intent: 'unknown', topic: null, entities: ent });
}

// ==================== INPUT HANDLER ====================
function handleJarvisInput(el) {
    const raw = el.value.trim();
    el.value = '';
    if (!raw) return;

    commandHistory.unshift(raw);
    if (commandHistory.length > 50) commandHistory.pop();
    historyIndex = -1;

    addLog('CMD> ' + raw, 'info');

    const chain = splitChainedCommands(raw);
    if (chain.length > 1) {
        typeResponseV2('> Processing ' + chain.length + ' chained commands...', null);
        speak('Processing ' + chain.length + ' commands sequentially.');
        let delay = 1000;
        chain.forEach((part, idx) => {
            setTimeout(() => {
                addLog('CHAIN[' + (idx + 1) + '/' + chain.length + ']> ' + part, 'info');
                processSingle(part);
            }, delay);
            delay += 2200;
        });
        return;
    }

    processSingle(raw);
}

// ==================== INTERCEPT INPUT ====================
$('cmd-input').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            this.value = commandHistory[historyIndex];
        }
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (historyIndex > 0) { historyIndex--; this.value = commandHistory[historyIndex]; }
        else { historyIndex = -1; this.value = ''; }
        return;
    }
    if (e.key === 'Enter') {
        e.stopImmediatePropagation();
        handleJarvisInput(this);
    }
}, true);

// ==================== INITIALIZE ADVANCED SYSTEMS ====================
(async function initAdvancedAI() {
    await SystemMonitor.init();
    JarvisLearning.init();
    addLog('J.A.R.V.I.S. AI Engine v3.0 online — system monitor, adaptive learning, real hardware access active', 'success');
    // Contextual greeting on boot
    setTimeout(() => {
        const greeting = JarvisLearning.getContextualGreeting();
        addLog(greeting, 'info');
    }, 3000);
})();
