const WebSocket = require('ws')
const EventEmitter = require('events')
const ws = new WebSocket('ws://127.0.0.1:3333')
const signal = new EventEmitter()

ws.on('message', (msg) => {
    let data
    try {
        data = JSON.parse(msg)
    } catch (e) {
        console.log(e);
    }
    signal.emit(data.event, data.data)
})
const send = (event, data) => {
    ws.send(JSON.stringify({ event, data }))
}
const invoke = async (event, data, answerEvent) => {
    while (ws.readyState !== WebSocket.OPEN) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return new Promise((res, rej) => {
        send(event, data)
        signal.once(answerEvent, res)
        setTimeout(() => {
            rej('timeout')
        }, 5000)
    })
}

signal.send = send
signal.invoke = invoke

module.exports = signal