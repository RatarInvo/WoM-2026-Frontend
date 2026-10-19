const ACCESS_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const SERVER_KEY = 'pastebin.server'

const LOGIN_API_URL = 'https://wom-2026-login.onrender.com'
const DEFAULT_WS_URL = 'wss://wom-2026-websocket-server.onrender.com'

const pasteInput = document.getElementById('paste')
const logBox = document.getElementById('log')
const statusText = document.getElementById('status')
const reconnectButton = document.getElementById('reconnect')
const settingsDialog = document.getElementById('settings')
const settingsForm = document.getElementById('settings-form')
const settingsMessage = document.getElementById('settings-message')
const tokenInput = document.getElementById('token')
const serverInput = document.getElementById('server')

let socket = null

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(
        REFRESH_TOKEN_KEY
    )

    if (!refreshToken) {
        return false
    }

    let response

    try {
        response = await fetch(
            `${LOGIN_API_URL}/refresh`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${refreshToken}`
                }
            }
        )
    } catch (error) {
        console.error('Refresh request failed:', error)
        return false
    }

    if (!response.ok) {
        return false
    }

    const data = await response.json()

    if (!data.accessToken) {
        return false
    }

    localStorage.setItem(
        ACCESS_TOKEN_KEY,
        data.accessToken
    )

    return true
}

async function logout() {
    const refreshToken = localStorage.getItem(
        REFRESH_TOKEN_KEY
    )

    if (refreshToken) {
        try {
            await fetch(
                `${LOGIN_API_URL}/refresh`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${refreshToken}`
                    }
                }
            )
        } catch (error) {
            console.error(
                'Logout request failed:',
                error
            )
        }
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem('user_id')

    if (socket) {
        socket.onclose = null
        socket.close()
        socket = null
    }

    setStatus('Not logged in', 'closed')
    window.location.href = 'login.html'
}

function defaultServerUrl() {
    if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    ) {
        return 'ws://localhost:4000'
    }

    return DEFAULT_WS_URL
}

function serverUrl() {
    return (localStorage.getItem(SERVER_KEY) || defaultServerUrl()).replace(/\/+$/, '')
}

function tokenPayload(token) {
    try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    } catch (error) {
        return null
    }
}

function log(text) {
    logBox.textContent = text
}

function setStatus(text, state) {
    statusText.textContent = text
    statusText.className = `status ${state}`
    reconnectButton.hidden = state !== 'closed'
}

function openSettings(message) {
    settingsMessage.textContent = message || ''
    settingsMessage.hidden = !message
    tokenInput.value = localStorage.getItem(ACCESS_TOKEN_KEY) || ''
    serverInput.value = localStorage.getItem(SERVER_KEY) || ''
    serverInput.placeholder = defaultServerUrl()
    if (!settingsDialog.open) {
        settingsDialog.showModal()
    }
}

function connect() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (!token) {
        setStatus('Not logged in', 'closed')
        return openSettings('Paste your JWT to log in.')
    }

    const payload = tokenPayload(token)

    if (!payload) {
        setStatus('Invalid JWT', 'closed')
        return openSettings('That does not look like a JWT. Paste a new JWT to log in.')
    }

    if (payload.exp !== undefined && payload.exp * 1000 <= Date.now()) {
        setStatus('Session expired', 'closed')
        return openSettings('Your session has expired. Paste a new JWT to log in again.')
    }

    if (socket) {
        socket.onclose = null
        socket.close()
    }

    setStatus('Connecting to server...', 'connecting')
    socket = new WebSocket(`${serverUrl()}/?token=${encodeURIComponent(token)}`)

    socket.onopen = () => setStatus('Connected to server', 'open')

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'ack') {
            log(`Pasted value sent to ${message.clients} clients`)
        } else if (message.type === 'paste') {
            log(message.text)
        }
    }

socket.onclose = async (event) => {
    socket = null

    if (
        event.code === 4001 &&
        event.reason === 'ACCESS_TOKEN_EXPIRED'
    ) {
        setStatus(
            'Session expired, refreshing...',
            'connecting'
        )

        const refreshed = await refreshAccessToken()

        if (refreshed) {
            log('Access token refreshed')
            connect()
        } else {
            setStatus(
                'Session expired',
                'closed'
            )

            openSettings(
                'Your session has expired. Please log in again.'
            )
        }

        return
    }

    if (event.code === 4001) {
        setStatus('Not authorized', 'closed')

        openSettings(
            'Your access token is invalid. Please log in again.'
        )

        return
    }

    setStatus(
        'Disconnected from server',
        'closed'
    )
}
}

function send(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        log('Not connected, value was not sent')
        return
    }

    socket.send(JSON.stringify({ type: 'paste', text }))
}

pasteInput.addEventListener('input', () => send(pasteInput.value))

reconnectButton.addEventListener('click', connect)

document.getElementById('settings-button').addEventListener('click', () => openSettings())

document.getElementById('close-settings').addEventListener('click', () => settingsDialog.close())

document.getElementById('logout').addEventListener(
    'click',
    logout
)

settingsForm.addEventListener('submit', (event) => {
    event.preventDefault()
    settingsDialog.close()

    localStorage.setItem(ACCESS_TOKEN_KEY, tokenInput.value.trim())

    if (serverInput.value.trim()) {
        localStorage.setItem(SERVER_KEY, serverInput.value.trim())
    } else {
        localStorage.removeItem(SERVER_KEY)
    }

    connect()
})

connect()