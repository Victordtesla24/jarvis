// ==================== NATURAL TIME PARSING ====================
function parseNaturalTime(input) {
    const l = input.toLowerCase();
    let total = 0, found = false;

    // "X and a half hours"
    const halfH = l.match(/(\d+)\s+and\s+a\s+half\s+hours?/);
    if (halfH) { total += (parseFloat(halfH[1]) + 0.5) * 3600; found = true; }
    else {
        const h = l.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
        if (h) { total += parseFloat(h[1]) * 3600; found = true; }
    }

    // "X and a half minutes"
    const halfM = l.match(/(\d+)\s+and\s+a\s+half\s+minutes?/);
    if (halfM) { total += (parseFloat(halfM[1]) + 0.5) * 60; found = true; }
    else {
        const m = l.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/);
        if (m) { total += parseFloat(m[1]) * 60; found = true; }
    }

    // seconds
    const s = l.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/);
    if (s) { total += parseFloat(s[1]); found = true; }

    // Special phrases (only if nothing numeric matched yet)
    if (!found) {
        if (/\ban?\s+hour\s+and\s+a\s+half\b/.test(l)) { total += 5400; found = true; }
        else if (/\bhalf\s+(?:an?\s+)?hour\b/.test(l)) { total += 1800; found = true; }
        else if (/\ban?\s+hour\b/.test(l)) { total += 3600; found = true; }
        if (/\bquarter\s+(?:of\s+)?(?:an?\s+)?hour\b/.test(l)) { total += 900; found = true; }
    }

    // Bare number fallback
    if (!found) {
        const bare = l.match(/\b(\d+)\b/);
        if (bare) { total = parseInt(bare[1], 10); found = true; }
    }

    return found && total > 0 ? Math.round(total) : null;
}

function formatTimeFriendly(sec) {
    if (sec >= 3600) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
        return m > 0 ? h + ' hour' + (h > 1 ? 's' : '') + ' and ' + m + ' minute' + (m > 1 ? 's' : '') : h + ' hour' + (h > 1 ? 's' : '');
    }
    if (sec >= 60) {
        const m = Math.floor(sec / 60), s = sec % 60;
        return s > 0 ? m + ' minute' + (m > 1 ? 's' : '') + ' and ' + s + ' second' + (s > 1 ? 's' : '') : m + ' minute' + (m > 1 ? 's' : '');
    }
    return sec + ' second' + (sec > 1 ? 's' : '');
}
