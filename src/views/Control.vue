<template>
    <div class="main">
        <video ref="video"></video>
    </div>
</template>
  
<script setup>
import { ref } from "vue"
const { ipcRenderer } = require('electron')

const video = ref(null)

const pc = new window.RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
})
const dc = pc.createDataChannel('robotChannel', { reliable: false })
dc.onopen = () => {
    window.onkeydown = function (e) {
        let data = {}
        data = {
            keyCode: e.keyCode,
            shift: e.shiftKey,
            meta: e.metaKey,
            control: e.ctrlKey,
            alt: e.altKey
        }
        dc.send(JSON.stringify({ type: 'key', data }))
    }

    window.onmouseup = function (e) {
        let data = {}
        data.clientX = e.clientX
        data.clientY = e.clientY
        data.video = {
            width: video.value.getBoundingClientRect().width,
            height: video.value.getBoundingClientRect().height
        }
        data.screen = {
            width: window.screen.width,
            height: window.screen.height
        }
        dc.send(JSON.stringify({ type: 'mouse', data }))
    }
}

//监听icecandidate
let candidates = []
pc.onicecandidate = (e) => {
    if (e.candidate) {
        ipcRenderer.send('forward', 'controlCandidate', JSON.stringify(e.candidate))
    }
}
ipcRenderer.on('candidate', (e, candidate) => {
    addIceCandidate(JSON.parse(candidate))
})

//添加icecandidate
const addIceCandidate = (candidate) => {
    if (candidate) candidates.push(candidate)
    if (pc.remoteDescription && pc.remoteDescription.type) {
        candidates.forEach(async (c) => {
            await pc.addIceCandidate(new RTCIceCandidate(c))
        })
        candidates = []
    }
}

const createOffer = async () => {
    const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    })
    await pc.setLocalDescription(offer)
    return pc.localDescription
}
createOffer().then((offer) => {
    const { type, sdp } = offer
    ipcRenderer.send('forward', 'offer', { type, sdp })
})

//设置SDP
ipcRenderer.on('answer', async (e, answer) => {
    await pc.setRemoteDescription(answer)
})

//监听添加流
pc.ontrack = (e) => {
    video.value.srcObject = e.streams[0]
    video.value.onloadedmetadata = (e) => video.value.play()
}

</script>
  
<style scoped>
.main {
    display: flex;
}

video {
    width: 100%;
    height: 100%;
    object-fit: fill;
}
</style>