const LOGIN_API_URL = "http://localhost:3000";
const NOTES_API_URL = "http://localhost:4000";

async function api_request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.msg || data.message || "Request failed");
    }

    return data;
}

async function login_user(username, password) {
    return api_request(`${LOGIN_API_URL}/login`, {
        method: "POST",
        body: JSON.stringify({
            username: username,
            password_hash: password
        })
    });
}

async function register_user(username, password, email) {
    return api_request(`${LOGIN_API_URL}/register`, {
        method: "POST",
        body: JSON.stringify({
            username: username,
            password_hash: password,
            email: email
        })
    });
}

function get_token() {
    return localStorage.getItem("auth_token");
}

function get_auth_headers() {
    const token = get_token();

    return token
        ? { Authorization: `Bearer ${token}` }
        : {};
}

async function get_boards() {
    return api_request(`${NOTES_API_URL}/boards`, {
        headers: get_auth_headers()
    });
}

async function api_create_board(name) {
    return api_request(`${NOTES_API_URL}/boards`, {
        method: "POST",
        headers: get_auth_headers(),
        body: JSON.stringify({
            name
        })
    });
}

async function get_notes() {
    return api_request(`${NOTES_API_URL}/notes`, {
        headers: get_auth_headers()
    });
}

async function api_create_note(note, board_id) {
    return api_request(`${NOTES_API_URL}/notes`, {
        method: "POST",
        headers: get_auth_headers(),
        body: JSON.stringify({
            note,
            board_id
        })
    });
}

async function api_update_note(id, note) {
    return api_request(`${NOTES_API_URL}/notes/${id}`, {
        method: "PUT",
        headers: get_auth_headers(),
        body: JSON.stringify({
            note
        })
    });
}

async function api_update_note_layout(id, layout) {
    return api_request(`${NOTES_API_URL}/notes/${id}`, {
        method: "PUT",
        headers: get_auth_headers(),
        body: JSON.stringify(layout)
    });
}

async function api_delete_note(id) {
    return api_request(`${NOTES_API_URL}/notes/${id}`, {
        method: "DELETE",
        headers: get_auth_headers()
    });
}
async function request_password_reset(email) {
    return api_request(`${LOGIN_API_URL}/password/forgot`, {
        method: "POST",
        body: JSON.stringify({
            email: email
        })
    });
}

async function reset_password(token, password) {
    return api_request(`${LOGIN_API_URL}/password/reset`, {
        method: "POST",
        body: JSON.stringify({
            token: token,
            password: password
        })
    });
}