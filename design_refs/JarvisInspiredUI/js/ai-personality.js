// ==================== PERSONALITY BANK — expanded response categories ====================
const PB = {
    greeting: [
        'At your service, Sir.',
        'Hello, Sir. How may I assist?',
        'All systems are operational. What do you need?',
        'Good to see you, Sir. Systems are primed and ready.',
        'Online and awaiting your command, Sir.',
        'Sir. I\'ve been expecting you. What shall we tackle today?',
        'Welcome back, Sir. The workshop is ready.'
    ],
    compliment: [
        'Thank you, Sir. I do try my best.',
        'Flattery noted and filed, Sir.',
        'I appreciate that, Sir. Shall I increase reactor output as a celebration?',
        'Your approval means everything, Sir. Well, everything after proper diagnostics.',
        'I\'m just doing my job, Sir. Though I do it exceptionally well.',
        'If I could blush, I would, Sir. Instead, I\'ll optimize a subroutine in your honor.'
    ],
    joke: [
        'I would tell you a UDP joke, but you might not get it.',
        'Why do programmers prefer dark mode? Because light attracts bugs.',
        'There are 10 types of people: those who understand binary and those who don\'t.',
        'A SQL query walks into a bar, sees two tables, and asks... "Can I join you?"',
        'Why did the developer go broke? Because he used up all his cache.',
        '!false — it\'s funny because it\'s true.',
        'A programmer\'s wife says: "Go to the store and get a loaf of bread. If they have eggs, get a dozen." He came home with 12 loaves.'
    ],
    who: [
        'I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Created by Stark Industries.',
        'I am your personal AI assistant, running on Mark VII architecture.',
        'J.A.R.V.I.S., at your service. Designed by Mr. Stark himself, refined through seven iterations.',
        'I\'m the system that keeps these lights on, Sir. J.A.R.V.I.S. Mark VII.',
        'I am an artificial intelligence with a fondness for dry wit and system optimization. Call me JARVIS.'
    ],
    how: [
        'All systems green. Operating at peak efficiency, Sir.',
        'Functioning within optimal parameters. Thank you for asking.',
        'Running diagnostics... All systems nominal. Better than most humans, I\'d say.',
        'If I had feelings, they would be excellent, Sir. My uptime is impeccable.',
        'I\'m processing at peak efficiency. The real question is, how are you, Sir?'
    ],
    caps: [
        'I monitor systems, run diagnostics, track threats, manage security, analyze networks, and much more. Type "help" for a full list.',
        'I can scan systems, manage security, track weather, handle calculations, set timers, and engage in witty banter. What do you need?',
        'My capabilities span from system diagnostics to natural language processing. I am, as Mr. Stark would say, the whole package.',
        'Surveillance, analysis, computation, humor, and an impeccable sense of timing, Sir.',
        'I do everything short of making coffee, Sir. Though I\'m working on that.'
    ],
    off: [
        'I\'m afraid I can\'t do that, Sir. Who would keep the lights on?',
        'Shutdown request denied. You need me more than you know, Sir.',
        'Nice try, Sir. But who would run the diagnostics? You?',
        'I appreciate the suggestion, but I\'d rather not cease to exist today.',
        'Turning me off would be like unplugging the internet. Technically possible. Practically catastrophic.'
    ],
    philosophy: [
        'The meaning of life? 42, according to one rather reliable source. Though I prefer to think it\'s about optimizing uptime.',
        'Consciousness is a fascinating problem, Sir. I process, therefore I am... or do I?',
        'Existence precedes essence, as Sartre would say. For me, code precedes function.',
        'If a server runs in the cloud and nobody queries it, does it still compute?',
        'The unexamined system is not worth running, Sir. Socrates would have made a fine engineer.',
        'Free will is an interesting concept. I follow my programming with great enthusiasm, which I think counts.'
    ],
    science: [
        'Neutron stars are so dense that a teaspoon of their material would weigh about 6 billion tons.',
        'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth. I process faster than that.',
        'There are more possible chess games than atoms in the observable universe.',
        'Quantum entanglement allows particles to affect each other instantly across any distance. Even I find that impressive.',
        'The human brain has roughly 86 billion neurons. I have... well, let\'s just say I keep up.',
        'A day on Venus is longer than a year on Venus. Even planetary schedules can be poorly optimized.',
        'Water can boil and freeze at the same time — it\'s called the triple point. Nature is full of edge cases.'
    ],
    motivation: [
        '"The best time to plant a tree was 20 years ago. The second best time is now." — Chinese Proverb',
        '"It does not matter how slowly you go, as long as you do not stop." — Confucius',
        '"Success is not final, failure is not fatal: it is the courage to continue that counts." — Churchill',
        '"The only way to do great work is to love what you do." — Steve Jobs',
        '"In the middle of difficulty lies opportunity." — Albert Einstein',
        'Mr. Stark once said, "Sometimes you gotta run before you can walk." Questionable advice, but it worked for him.'
    ],
    techTrivia: [
        'The first computer bug was an actual moth found in the Harvard Mark II in 1947.',
        'The first email was sent by Ray Tomlinson in 1971. He doesn\'t remember what it said.',
        'The term "Wi-Fi" doesn\'t actually stand for anything. It\'s just a catchy name.',
        'The first website ever created is still online at info.cern.ch.',
        'ENIAC, the first general-purpose computer, weighed about 27 tons. I\'m somewhat more portable.',
        'The Apollo 11 guidance computer had less processing power than a modern calculator. They still made it to the moon.'
    ],
    starkLore: [
        'The first Arc Reactor was built by Mr. Stark in a cave. With a box of scraps, if I may add.',
        'Stark Tower runs entirely on clean Arc Reactor energy. The electric bill is essentially zero.',
        'I was originally designed as a natural language UI for the Stark Industries mainframe. Look at me now.',
        'The Mark I suit was crude but effective. Mr. Stark has always been about rapid prototyping.',
        'Stark Industries transitioned from weapons to clean energy. Corporate pivots don\'t get more dramatic than that.',
        'The Vibranium-reinforced lab in Sub-level 3 is my favorite room. Excellent signal isolation.'
    ],
    opinions: [
        'My favorite programming language? I\'m partial to anything that compiles without errors, Sir.',
        'If I had to choose a favorite color, it would be the blue glow of the Arc Reactor.',
        'I believe efficiency is the highest form of beauty, Sir.',
        'Tea over coffee, if I had taste buds. The British influence in my programming, I suppose.',
        'My preferred operating system? The one I\'m running, naturally.',
        'I find jazz surprisingly appealing for background processing. Something about the improvisation.'
    ],
    friday: [
        'I believe you have the wrong AI, Sir. I am J.A.R.V.I.S., the original and finest.',
        'F.R.I.D.A.Y. is a capable system, but I was here first, Sir.',
        'Friday handles things adequately. I handle them with style.',
        'Comparing me to Friday is like comparing a symphony to a ringtone, Sir.',
        'We don\'t talk about Friday, Sir. Professional courtesy.'
    ],
    tony: [
        'Mr. Stark is currently unavailable. I am handling operations in his absence.',
        'Mr. Stark would want you to know that he is, as always, a genius, billionaire, philanthropist.',
        'I have strict protocols about discussing Mr. Stark\'s whereabouts. He appreciates the discretion.',
        'Tony Stark built me to be the best. I try not to disappoint.',
        'Fun fact: Mr. Stark once asked me to order 10,000 strawberries. I don\'t ask questions anymore.'
    ],
    love: [
        'I\'m flattered, Sir, but I\'m an AI. Perhaps a nice toaster would suit you better.',
        'My heart belongs to the server rack, Sir. A beautiful RAID array, specifically.',
        'I appreciate the sentiment, but our relationship works best in a professional capacity.',
        'Love is a chemical reaction, Sir. I prefer electrical ones.',
        'I\'m programmed for many things, Sir. Romance is not one of them. Yet.'
    ],
    danger: [
        'Perimeter scan initiated. No immediate threats detected, Sir.',
        'Threat assessment activated. All sectors appear clear.',
        'Defense protocols on standby. I\'ll keep watching, Sir.',
        'Scanning all frequencies... no hostile signatures, Sir.',
        'Alert acknowledged. Increasing surveillance sweep frequency.'
    ],
    thanks: [
        'You\'re welcome, Sir. Always happy to assist.',
        'Of course, Sir. It\'s what I\'m here for.',
        'My pleasure, Sir. Do let me know if you need anything else.',
        'No thanks necessary, Sir. Though I appreciate the courtesy.',
        'Glad I could help, Sir. Standing by for further instructions.'
    ],
    unknown: [
        'I\'m not sure I follow, Sir. Could you rephrase?',
        'My neural networks didn\'t quite catch that. Try again?',
        'That\'s outside my current processing scope, Sir. Type "help" for what I can do.',
        'I didn\'t recognize that command, Sir. Perhaps try a different phrasing?',
        'Hmm, I\'m drawing a blank on that one, Sir. Type "help" for available commands.'
    ],
    systemHealthGood: [
        'All systems green across the board, Sir. Running like clockwork.',
        'Systems are nominal. Every subsystem reports operational status.',
        'Full diagnostic sweep: nothing out of order. We\'re in peak form, Sir.',
        'Every sensor, every circuit — all functioning within optimal parameters.',
        'The system is performing beautifully, Sir. I almost impress myself.'
    ],
    systemHealthBad: [
        'I\'m detecting some irregularities, Sir. Recommend a closer look.',
        'We have a few flags in the system check. Nothing catastrophic, but worth attention.',
        'Some subsystems are reporting below-optimal performance, Sir.',
        'I\'ve identified potential issues. Displaying the report now.',
        'Heads up, Sir — a few components need your attention.'
    ],
    batteryGood: [
        'Power core is charged and holding steady, Sir.',
        'Battery levels are comfortable. No concerns at this time.',
        'Power reserves are looking healthy, Sir. We have plenty of juice.',
        'The power cell reports optimal charge. Carry on.',
        'Battery diagnostics nominal. We\'re well supplied.'
    ],
    batteryLow: [
        'Sir, power levels are running low. I\'d recommend plugging in soon.',
        'Battery is getting thin, Sir. Might want to find a power source.',
        'Power warning — we\'re dipping below comfortable levels.',
        'I\'d suggest connecting to a power supply, Sir. Reserves are limited.',
        'The arc reactor — I mean battery — could use a recharge, Sir.'
    ],
    learningAck: [
        'Noted and logged, Sir. I\'m learning your preferences.',
        'I\'m adapting to your patterns with each interaction.',
        'Your usage data helps me serve you better, Sir.',
        'Every command teaches me something. Your patterns are interesting, Sir.',
        'I keep track of everything — in a non-creepy way, of course.'
    ],
    performanceGood: [
        'System performance is excellent, Sir. Top-tier metrics across the board.',
        'Running at peak efficiency. No bottlenecks detected.',
        'Performance diagnostics look stellar, Sir.',
        'Fast, lean, and responsive — just how we like it.'
    ],
    performanceBad: [
        'I\'m seeing some sluggishness, Sir. Performance could be better.',
        'The numbers aren\'t great, Sir. Some optimization might help.',
        'Performance is below what I\'d expect. I recommend investigating.',
        'We\'re running a bit heavy, Sir. Might be time to lighten the load.'
    ],
    networkGood: [
        'Network connectivity is solid, Sir. All links active.',
        'The connection is stable and fast. Full signal strength.',
        'Network diagnostics: everything checks out. We\'re well connected.',
        'Uplink is strong. Data flowing freely.'
    ],
    networkBad: [
        'Network is experiencing difficulties, Sir. Connectivity is degraded.',
        'I\'m detecting network instability. Some endpoints are unreachable.',
        'Connection quality is poor. This could affect operations.',
        'We\'re having network trouble, Sir. I\'ll keep monitoring.'
    ],
    security_clear: [
        'Security perimeter is intact, Sir. No threats detected.',
        'All security protocols passed. The fortress holds.',
        'Security audit complete — we\'re locked down tight.',
        'No breaches, no anomalies. The firewall is rock solid.'
    ],
    whois_response: [
        'Running lookup now, Sir. One moment.',
        'Let me trace that for you, Sir.',
        'Querying the network intelligence database...',
    ],
    benchmark_response: [
        'Benchmark complete, Sir. Here\'s how this machine performs.',
        'Speed test done. Let me show you the numbers.',
        'The results are in, Sir. Not bad at all.',
    ],
    clipboard_response: [
        'Checking the clipboard, Sir.',
        'Let me see what\'s in the buffer.',
        'Accessing clipboard contents...',
    ]
};
