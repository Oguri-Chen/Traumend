const { nanoid } = require('nanoid');
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 3333 })
const code2ws = new Map()

wss.on('connection', function (ws, req) {
    const code = nanoid(8);
    code2ws.set(code, ws)
    ws.sendData = (event, data) => {
        ws.send(JSON.stringify({ event, data }))
    }
    ws.sendError = (msg) => {
        ws.sendData('error', { msg })
    }
    ws.on('message', (msg) => {
        let parsedMsg = {}
        try {
            parsedMsg = JSON.parse(msg)
        } catch (e) {
            ws.sendError('Invalid')
            console.log(e);
            return
        }
        const { event, data } = parsedMsg
        const remote = data?.remote
        switch (event) {
            case 'login':
                ws.sendData('logined', { code })
                break
            case 'control':
                if (code2ws.has(remote)) {
                    ws.sendData('controlled', { remote })
                    ws.sendRemote = code2ws.get(remote).sendData
                    code2ws.get(remote).sendRemote = ws.sendData
                    ws.sendRemote('be-controlled', { remote: code })
                }
                break
            case 'forward':
                ws.sendRemote(data.event, data.data)
                break
            case 'close':
                ws.sendData('close')
                ws.sendRemote('close')
                break
        }
    })
    ws.on('close', () => {
        code2ws.delete(code)
        clearTimeout(ws._closeTimeout)
    })
    ws._closeTimeout = setTimeout(() => {
        ws.terminate()
    }, 40 * 60 * 1000)
})