// ==================== J.A.R.V.I.S. ADAPTIVE LEARNING v3.0 ====================
// Learns user patterns, preferences, command frequency, and adapts behavior

const JarvisLearning = {

    // ========== USER PROFILE — built over time ==========
    profile: {
        name: null,
        preferredTone: 'formal',   // formal, casual, brief
        favoriteCommands: {},       // cmd -> count
        topicInterests: {},         // topic -> count
        activeHours: new Array(24).fill(0), // hour -> activity count
        sessionCount: 0,
        totalCommands: 0,
        lastSeen: null,
        customAliases: {},          // user-defined shortcuts
        dislikedResponses: [],      // responses user reacted badly to
    },

    // ========== BEHAVIOR FLAGS ==========
    flags: {
        proactiveMode: true,        // offer suggestions unprompted
        verboseMode: false,         // longer detailed responses
        quickMode: false,           // short terse responses
        learningEnabled: true,
    },

    STORAGE_KEY: 'jarvis_learning_v3',

    // ========== PERSISTENCE ==========
    save() {
        try {
            const data = {
                profile: this.profile,
                flags: this.flags,
                commandPatterns: this.commandPatterns,
                conversationInsights: this.conversationInsights,
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch { /* storage full or not available */ }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.profile) Object.assign(this.profile, data.profile);
                if (data.flags) Object.assign(this.flags, data.flags);
                if (data.commandPatterns) Object.assign(this.commandPatterns, data.commandPatterns);
                if (data.conversationInsights) Object.assign(this.conversationInsights, data.conversationInsights);
                addLog('Learning data restored — ' + this.profile.totalCommands + ' historical commands', 'success');
            }
        } catch { /* corrupted data, start fresh */ }
    },

    // ========== COMMAND FREQUENCY TRACKING ==========
    commandPatterns: {
        recentCommands: [],     // last 50 commands with timestamps
        commandPairs: {},       // "cmd1->cmd2" -> count (sequential patterns)
        timeOfDay: {},          // "hour:cmd" -> count
    },

    recordCommand(cmd, raw) {
        // Track frequency
        this.profile.favoriteCommands[cmd] = (this.profile.favoriteCommands[cmd] || 0) + 1;
        this.profile.totalCommands++;
        this.profile.lastSeen = Date.now();

        // Track active hours
        const hour = new Date().getHours();
        this.profile.activeHours[hour]++;

        // Track sequential patterns
        const recent = this.commandPatterns.recentCommands;
        if (recent.length > 0) {
            const prev = recent[recent.length - 1].cmd;
            const pair = prev + '->' + cmd;
            this.commandPatterns.commandPairs[pair] = (this.commandPatterns.commandPairs[pair] || 0) + 1;
        }

        // Track time-of-day patterns
        const tod = hour + ':' + cmd;
        this.commandPatterns.timeOfDay[tod] = (this.commandPatterns.timeOfDay[tod] || 0) + 1;

        recent.push({ cmd, raw, ts: Date.now(), hour });
        if (recent.length > 50) recent.shift();

        // Auto-detect tone preference
        this._detectTonePreference(raw);

        // Save periodically (every 5 commands)
        if (this.profile.totalCommands % 5 === 0) this.save();
    },

    _detectTonePreference(input) {
        const l = input.toLowerCase();
        if (/\b(yo|sup|bro|dude|lol|haha|nah|yeah|bruh|chill)\b/.test(l)) {
            this.profile.preferredTone = 'casual';
        } else if (/\b(please|could you|would you|kindly|pardon|excuse me)\b/.test(l)) {
            this.profile.preferredTone = 'formal';
        } else if (input.length < 15 && /^[a-z]+$/i.test(input.trim())) {
            this.profile.preferredTone = 'brief';
        }
    },

    // ========== TOPIC TRACKING ==========
    recordTopic(topic) {
        if (!topic) return;
        this.profile.topicInterests[topic] = (this.profile.topicInterests[topic] || 0) + 1;
    },

    // ========== PREDICTIONS ==========
    predictNextCommand() {
        const recent = this.commandPatterns.recentCommands;
        if (recent.length === 0) return null;
        const lastCmd = recent[recent.length - 1].cmd;
        const pairs = this.commandPatterns.commandPairs;
        let bestNext = null, bestCount = 0;
        for (const [pair, count] of Object.entries(pairs)) {
            if (pair.startsWith(lastCmd + '->') && count > bestCount) {
                bestCount = count;
                bestNext = pair.split('->')[1];
            }
        }
        return bestCount >= 2 ? bestNext : null;
    },

    getTopCommands(n) {
        const sorted = Object.entries(this.profile.favoriteCommands)
            .sort((a, b) => b[1] - a[1]);
        return sorted.slice(0, n || 5);
    },

    getPeakHours() {
        const hours = this.profile.activeHours;
        const indexed = hours.map((v, i) => ({ hour: i, count: v }))
            .filter(h => h.count > 0)
            .sort((a, b) => b.count - a.count);
        return indexed.slice(0, 3);
    },

    // ========== CONVERSATION INSIGHTS ==========
    conversationInsights: {
        avgInputLength: 0,
        totalInputs: 0,
        questionCount: 0,
        commandCount: 0,
        conversationalCount: 0,
        frustrationCount: 0,
        complimentCount: 0,
    },

    recordInsight(intent, sentiment, inputLength) {
        const ci = this.conversationInsights;
        ci.totalInputs++;
        ci.avgInputLength = ((ci.avgInputLength * (ci.totalInputs - 1)) + inputLength) / ci.totalInputs;

        if (intent === 'QUESTION') ci.questionCount++;
        else if (intent === 'COMMAND' || intent === 'PARAMETERIZED') ci.commandCount++;
        else if (intent === 'CONVERSATION' || intent === 'CREATIVE') ci.conversationalCount++;

        if (sentiment === 'frustrated') ci.frustrationCount++;
        if (sentiment === 'happy') ci.complimentCount++;
    },

    // ========== CUSTOM ALIASES ==========
    setAlias(alias, command) {
        this.profile.customAliases[alias.toLowerCase()] = command.toLowerCase();
        this.save();
        return 'Alias set: "' + alias + '" → "' + command + '"';
    },

    removeAlias(alias) {
        const key = alias.toLowerCase();
        if (this.profile.customAliases[key]) {
            delete this.profile.customAliases[key];
            this.save();
            return 'Alias "' + alias + '" removed.';
        }
        return 'Alias "' + alias + '" not found.';
    },

    resolveAlias(input) {
        const lower = input.toLowerCase().trim();
        return this.profile.customAliases[lower] || null;
    },

    listAliases() {
        const entries = Object.entries(this.profile.customAliases);
        if (entries.length === 0) return 'No custom aliases set. Use: alias set [name] [command]';
        return entries.map(([a, c]) => '"' + a + '" → "' + c + '"').join(' | ');
    },

    // ========== CONTEXTUAL GREETING ==========
    getContextualGreeting() {
        const hour = new Date().getHours();
        const total = this.profile.totalCommands;
        const lastSeen = this.profile.lastSeen;
        const timeSince = lastSeen ? (Date.now() - lastSeen) / 3600000 : null; // hours

        let timeGreet = 'Good evening';
        if (hour >= 5 && hour < 12) timeGreet = 'Good morning';
        else if (hour >= 12 && hour < 17) timeGreet = 'Good afternoon';

        if (total === 0) {
            return timeGreet + ', Sir. Welcome to J.A.R.V.I.S. Mark VII. I\'m ready to be configured to your preferences.';
        }

        if (timeSince && timeSince > 24) {
            return timeGreet + ', Sir. It\'s been ' + Math.floor(timeSince / 24) + ' day(s) since our last session. All systems maintained and ready.';
        }

        if (timeSince && timeSince > 6) {
            return timeGreet + ', Sir. Welcome back. I\'ve been running diagnostics in your absence. All clear.';
        }

        const topCmds = this.getTopCommands(1);
        if (topCmds.length > 0) {
            return timeGreet + ', Sir. Systems are online. Your most used command is "' + topCmds[0][0] + '" — shall I run it?';
        }

        return timeGreet + ', Sir. All systems operational. What shall we tackle?';
    },

    // ========== PROACTIVE SUGGESTIONS ==========
    getProactiveSuggestion() {
        if (!this.flags.proactiveMode) return null;

        // Suggest based on command frequency at this time of day
        const hour = new Date().getHours();
        const todEntries = Object.entries(this.commandPatterns.timeOfDay)
            .filter(([k]) => parseInt(k) === hour)
            .map(([k, v]) => ({ cmd: k.split(':')[1], count: v }))
            .sort((a, b) => b.count - a.count);

        if (todEntries.length > 0 && todEntries[0].count >= 3) {
            return 'Based on your patterns, you usually run "' + todEntries[0].cmd + '" around this time. Shall I?';
        }

        // Predict next command
        const predicted = this.predictNextCommand();
        if (predicted) {
            return 'Based on your flow, you might want to run "' + predicted + '" next.';
        }

        return null;
    },

    // ========== USER STATS REPORT ==========
    getUserReport() {
        const p = this.profile;
        const ci = this.conversationInsights;
        const lines = ['=== J.A.R.V.I.S. USER ANALYTICS ==='];
        lines.push('Total Commands: ' + p.totalCommands);
        lines.push('Session Count: ' + p.sessionCount);
        lines.push('Preferred Tone: ' + p.preferredTone.toUpperCase());
        const top = this.getTopCommands(5);
        if (top.length > 0) {
            lines.push('Top Commands: ' + top.map(([c, n]) => c + '(' + n + ')').join(', '));
        }
        const peaks = this.getPeakHours();
        if (peaks.length > 0) {
            lines.push('Peak Hours: ' + peaks.map(h => h.hour + ':00 (' + h.count + ' cmds)').join(', '));
        }
        const topics = Object.entries(p.topicInterests).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topics.length > 0) {
            lines.push('Top Topics: ' + topics.map(([t, n]) => t + '(' + n + ')').join(', '));
        }
        lines.push('Avg Input Length: ' + Math.round(ci.avgInputLength) + ' chars');
        lines.push('Questions Asked: ' + ci.questionCount);
        lines.push('Commands Issued: ' + ci.commandCount);
        lines.push('Conversations: ' + ci.conversationalCount);
        if (ci.frustrationCount > 0) lines.push('Frustration Events: ' + ci.frustrationCount);
        if (ci.complimentCount > 0) lines.push('Compliments Given: ' + ci.complimentCount);
        const aliases = Object.entries(p.customAliases);
        if (aliases.length > 0) {
            lines.push('Custom Aliases: ' + aliases.length);
        }
        return lines.join('\n');
    },

    // ========== INIT ==========
    init() {
        this.load();
        this.profile.sessionCount++;
        this.save();
        addLog('Adaptive learning module initialized — session #' + this.profile.sessionCount, 'success');
    }
};
