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

async function api_delete_note(id) {
    return api_request(`${NOTES_API_URL}/notes/${id}`, {
        method: "DELETE",
        headers: get_auth_headers()
    });
}