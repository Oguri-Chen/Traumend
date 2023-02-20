import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Main',
        component: () => import('../views/Main.vue')
    },
    {
        path: '/control',
        name: 'Control',
        component: () => import('../views/Control.vue')
    }
]

const router = createRouter({ history: createWebHashHistory(), routes })

export default router