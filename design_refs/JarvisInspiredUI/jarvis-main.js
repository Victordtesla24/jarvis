const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// ==================== APP LAUNCH MAP ====================
const appMap = {
    // Windows system apps
    'control panel': 'control',
    'controlpanel': 'control',
    'file explorer': 'explorer',
    'explorer': 'explorer',
    'this pc': 'explorer shell:MyComputerFolder',
    'my computer': 'explorer shell:MyComputerFolder',
    'notepad': 'notepad',
    'calculator': 'calc',
    'paint': 'mspaint',
    'cmd': 'cmd',
    'command prompt': 'cmd',
    'terminal': 'wt',
    'powershell': 'powershell',
    'task manager': 'taskmgr',
    'settings': 'start ms-settings:',
    'windows settings': 'start ms-settings:',
    'device manager': 'devmgmt.msc',
    'disk management': 'diskmgmt.msc',
    'services': 'services.msc',
    'registry': 'regedit',
    'system info': 'msinfo32',
    'resource monitor': 'resmon',
    'performance monitor': 'perfmon',
    'event viewer': 'eventvwr',
    'snipping tool': 'snippingtool',
    'snip': 'snippingtool',
    'screen sketch': 'ms-screensketch:',
    'magnifier': 'magnify',
    'wordpad': 'wordpad',
    'character map': 'charmap',
    'remote desktop': 'mstsc',
    'disk cleanup': 'cleanmgr',
    'defragment': 'dfrgui',
    'firewall': 'wf.msc',
    'sound': 'mmsys.cpl',
    'display settings': 'start ms-settings:display',
    'network': 'start ms-settings:network',
    'bluetooth': 'start ms-settings:bluetooth',
    'printers': 'start ms-settings:printers',
    'apps': 'start ms-settings:appsfeatures',
    'startup': 'start ms-settings:startupapps',
    'windows update': 'start ms-settings:windowsupdate',
    'about': 'start ms-settings:about',
    'downloads': 'explorer shell:Downloads',
    'documents': 'explorer shell:Personal',
    'desktop': 'explorer shell:Desktop',
    'pictures': 'explorer shell:My Pictures',
    'music': 'explorer shell:My Music',
    'videos': 'explorer shell:My Video',
    'recycle bin': 'explorer shell:RecycleBinFolder',

    // Browsers
    'chrome': 'start chrome',
    'google chrome': 'start chrome',
    'firefox': 'start firefox',
    'mozilla firefox': 'start firefox',
    'edge': 'start msedge',
    'microsoft edge': 'start msedge',
    'brave': 'start brave',
    'opera': 'start opera',
    'vivaldi': 'start vivaldi',

    // Coding / Dev tools
    'vscode': 'code',
    'vs code': 'code',
    'visual studio code': 'code',
    'visual studio': 'start devenv',
    'sublime': 'start sublime_text',
    'sublime text': 'start sublime_text',
    'atom': 'start atom',
    'notepad++': 'start notepad++',
    'git bash': 'start git-bash',
    'postman': 'start postman',
    'android studio': 'start studio64',
    'intellij': 'start idea64',
    'pycharm': 'start pycharm64',
    'webstorm': 'start webstorm64',

    // Communication
    'teams': 'start msteams:',
    'microsoft teams': 'start msteams:',
    'slack': 'start slack',
    'zoom': 'start zoom',
    'skype': 'start skype:',
    'telegram': 'start telegram',

    // Media
    'vlc': 'start vlc',
    'spotify': 'start spotify',
    'itunes': 'start itunes',
    'photos': 'start ms-photos:',
    'movies': 'start mswindowsvideo:',
    'groove': 'start mswindowsmusic:',
    'camera': 'start microsoft.windows.camera:',

    // Productivity
    'word': 'start winword',
    'excel': 'start excel',
    'powerpoint': 'start powerpnt',
    'outlook': 'start outlook',
    'onenote': 'start onenote',
    'access': 'start msaccess',

    // Gaming
    'steam': 'start steam:',
    'epic games': 'start com.epicgames.launcher:',

    // Utilities
    'winrar': 'start winrar',
    '7zip': 'start 7zFM',
    'obs': 'start obs64',
    'obs studio': 'start obs64',
};

function launchApplication(appName) {
    const key = appName.toLowerCase().trim();
    const command = appMap[key];
    if (command) {
        return new Promise((resolve) => {
            exec(command, { shell: true }, (error) => {
                if (error) {
                    resolve({ success: false, message: `Failed to open ${appName}. It may not be installed.` });
                } else {
                    resolve({ success: true, message: `Opening ${appName}...` });
                }
            });
        });
    }

    // Try to launch it directly as a command
    return new Promise((resolve) => {
        exec(`start "" "${appName}"`, { shell: true }, (error) => {
            if (error) {
                resolve({ success: false, message: `"${appName}" not found. Try the exact application name.` });
            } else {
                resolve({ success: true, message: `Attempting to open ${appName}...` });
            }
        });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: true,
        autoHideMenuBar: true,
        backgroundColor: '#020608',
        title: 'J.A.R.V.I.S. MARK VII HUD',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
    win.setMenu(null);

    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
        }
    });
}

// ==================== IPC HANDLERS ====================
ipcMain.on('app-close', () => {
    app.quit();
});

ipcMain.handle('launch-app', async (event, appName) => {
    return await launchApplication(appName);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
