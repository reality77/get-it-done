import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { vFocus } from './directives/vFocus'

createApp(App).use(createPinia()).directive('focus', vFocus).mount('#app')
