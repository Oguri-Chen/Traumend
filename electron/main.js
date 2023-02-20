const path = require('path');
const robot = require('robotjs')
const vkey = require('vkey')
const signal = require('./signal')
const { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu } = require('electron')

const isDev = !app.isPackaged
const additionalData = { key: 'traumend' }
const gotTheLock = app.requestSingleInstanceLock(additionalData)

const winURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`
const isMac = process.platform === 'darwin'
let tray
let win = null
let controlWin = null
let willQuit = true

const handleMouse = (data) => {
    //data {clientX,clientY,screen:{width,height},video:{width,height}}
    let { clientX, clientY, screen, video } = data
    let x = clientX * screen.width / video.width
    let y = clientY * screen.height / video.height
    robot.moveMouse(x, y)
    robot.mouseClick()
}
const handleKey = (data) => {
    //data [keyCode,meta,alt,ctrl,shift]
    const modifiers = []
    if (data.meta) modifiers.push('meta')
    if (data.alt) modifiers.push('alt')
    if (data.ctrl) modifiers.push('ctrl')
    if (data.shift) modifiers.push('shift')
    let key = vkey[data.keyCode].toLowerCase()
    if (key[0] !== '<') robot.keyTap(key, modifiers)
}

const setTray = () => {
    const icon = path.join(__dirname, 'traumend.ico')
    tray = new Tray(icon)
    let contextMenu = Menu.buildFromTemplate([
        { label: '显示', click: () => winShow(win) },
        { label: '退出', click: () => app.quit() }
    ])
    if (!isMac) {
        tray.on('click', () => {
            winShow(win)
        })
    }
    tray.setToolTip('traumend')
    tray.setContextMenu(contextMenu)
}
const winShow = (win) => {
    if (win.isVisible()) {
        if (win.isMinimized()) {
            win.restore()
            win.focus()
        } else {
            win.focus()
        }
    } else {
        !isMac && win.minimize()
        win.show()
        win.setSkipTaskbar(false)
    }
}

signal.on('controlled', (data) => {
    remoteCode = data.remote
    createControlWindow()
    win.webContents.send('changeState', data.remote, 1)
})
signal.on('be-controlled', (data) => {
    win.webContents.send('changeState', data.remote, 2)
})
signal.on('offer', (data) => {
    win.webContents.send('offer', data)
})
signal.on('answer', (data) => {
    controlWin.webContents.send('answer', data)
})
signal.on('controlCandidate', (data) => {
    win.webContents.send('candidate', data)
})
signal.on('puppetCandidate', (data) => {
    controlWin.webContents.send('candidate', data)
})
signal.on('close', (data) => {
    win.webContents.send('close')
})
ipcMain.on('forward', (e, event, data) => {
    signal.send('forward', { event, data })
})
ipcMain.on('robot', (e, type, data) => {
    if (type === 'mouse') {
        handleMouse(data)
    } else if (type === 'key') {
        handleKey(data)
    }
})

const createWindow = () => {
    win = new BrowserWindow({
        width: 340,
        height: 240,
        minWidth: 340,
        minHeight: 240,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    win.loadURL(winURL);

    win.on('close', (e) => {
        if (willQuit) win = null
        else {
            e.preventDefault();
            win.hide()
        }
    })
    Menu.setApplicationMenu(null)
    isDev && win.webContents.openDevTools();

    ipcMain.on('login', async (e, arg) => {
        const { code } = await signal.invoke('login', null, 'logined')
        e.returnValue = code
    })
    ipcMain.on('control', (e, remote) => {
        signal.send('control', { remote })
        const res = true
        e.returnValue = res
    })
    ipcMain.on('getSource', async (e, arg) => {
        const res = await desktopCapturer.getSources({ types: ['window', 'screen'] })
        e.returnValue = res
    })
}
const createControlWindow = () => {
    controlWin = new BrowserWindow({
        width: 1280,
        height: 750,
        minWidth: 1280,
        minHeight: 750,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    isDev && controlWin.webContents.openDevTools()
    controlWin.loadURL(winURL + '#/control');
    controlWin.on('close', () => {
        signal.send('close')
    })
}

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
            win.show()
        }
    })
    app.whenReady().then(() => {
        createWindow();
        setTray()
    });
}
app.on('before-quit', () => {
    willQuit = true
    win.close()
})
app.on('activate', () => win.show())
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
