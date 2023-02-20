<template>
  <div class="main">
    <div v-if="!text" class="no-control">
      <p>你的控制码{{ code }}</p>
      <input v-model="remoteCode" type="text">
      <button @click="startControl">确认</button>
    </div>
    <div v-else class="control">{{ text }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
const { ipcRenderer } = require('electron')

const code = ref()
const remoteCode = ref()
const text = ref()

//获取桌面流
const getSource = async () => {
  const res = await ipcRenderer.sendSync('getSource')
  if (res) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: res[0].id,
            maxWidth: window.screen.width,
            maxHeight: window.screen.height,
            minWidth: 1280,
            minHeight: 720,
          }
        }
      })
      return stream
    } catch (error) {
      console.log(error)
      return false
    }
  }
}

//控制状态
ipcRenderer.on('changeState', (e, name, type) => {
  if (type === 1) text.value = `正在控制${name}`
  else if (type === 2) text.value = `被${name}控制`
})
//创建控制码
const login = async () => {
  const res = await ipcRenderer.sendSync('login')
  if (res) code.value = res
}
//发起控制
const startControl = async () => {
  ipcRenderer.send('control', remoteCode.value)
}

//创建answer
const pc = new window.RTCPeerConnection({})
pc.ondatachannel = (e) => {
  e.channel.onmessage = (e) => {
    const { type, data } = JSON.parse(e.data)
    ipcRenderer.send('robot', type, data)
  }
}

///监听icecandidate
let candidates = []
pc.onicecandidate = (e) => {
  if (e.candidate) {
    ipcRenderer.send('forward', 'puppetCandidate', JSON.stringify(e.candidate))
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

ipcRenderer.on('offer', async (e, offer) => {
  const answer = await createAnswer(offer)
  const { type, sdp } = answer
  ipcRenderer.send('forward', 'answer', { type, sdp })
})
const createAnswer = async (offer) => {
  const stream = await getSource()
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream)
  })
  await pc.setRemoteDescription(offer)
  await pc.setLocalDescription(await pc.createAnswer())
  return pc.localDescription
}
ipcRenderer.on('close', () => {
  text.value = null
})

onMounted(() => {
  login()
})

</script>

<style scoped>
.main {
  display: flex;
  justify-content: center;
  height: 100vh;
  text-align: center;
}

.no-control {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.no-control p {
  font-size: 20px;
}

.no-control input {
  margin: 15px 0;
  padding: 5px 10px;
  border: 1px solid #eee;
  border-radius: 10px;
  filter: drop-shadow(1px 1px 1px #ccc)
}

.no-control button {
  width: 100%;
  padding: 5px 0;
  border-radius: 10px;
  border: none;
  filter: drop-shadow(1px 1px 2px #ccc)
}
</style>