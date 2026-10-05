// Credits: dragging och storleksändringen här bygger på MDN:s exempel med pointer capture.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
// https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events

// Check if the user is logged in
const token = get_token();

if (!token) {
    window.location.href = "login.html";
}

// grab the elements we need
const notes_board = document.getElementById("notes_board");
const board_select = document.getElementById("board_select");
const new_note_button = document.getElementById("new_note_button");
const logout_button = document.getElementById("logout_button");
const note_template = document.getElementById("note_template");

const note_color_count = note_template.content.querySelectorAll(".note_color_swatch").length;

const note_size = { width: 220, height: 160, min_width: 180, min_height: 110 };

let boards = [];
let active_board = null;

let z_index_counter = 10;

let socket = null;
let has_connected_before = false;
const note_author_names = new Map();

const unique_id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const find_note = (note_element) => active_board.notes.find((note) => note.id === note_element.dataset.id);
const find_note_by_id = (id) => active_board?.notes.find((note) => note.id === String(id));
const find_note_element = (id) => notes_board.querySelector(`.note[data-id="${Number(id)}"]`);

// Find a note by its ID
function convert_api_note(api_note, board_note_index) {
    const cascade = (board_note_index % 6) * 24;

    return {
        id: String(api_note.id),
        content: api_note.note ?? "",
        color: api_note.color ?? 0,
        x: api_note.pos_x ?? 40 + cascade,
        y: api_note.pos_y ?? 40 + cascade,
        width: api_note.width ?? note_size.width,
        height: api_note.height ?? note_size.height,
        board_id: api_note.board_id ?? api_note.board?.id,
        author_id: api_note.author_id,
        author_name: api_note.author?.username
            ?? api_note.author?.name
            ?? api_note.author_name
            ?? note_author_names.get(String(api_note.author_id))
            ?? "",
    };
}

// Load author names for notes
async function load_note_author_names(api_notes) {
    const author_ids = [...new Set(
        api_notes
            .map((api_note) => api_note.author_id)
            .filter(Boolean)
            .map(String)
    )];

    await Promise.all(author_ids.map(async (author_id) => {
        if (note_author_names.has(author_id)) {
            return;
        }

        try {
            const user = await get_user(author_id);
            const author_name = user.username ?? user.name;

            if (author_name) {
                note_author_names.set(author_id, author_name);
            }
        } catch (error) {
            console.error(`Could not load author for note(s) by user ${author_id}:`, error);
        }
    }));
}


// Load boards and notes from the API
async function load_boards_and_notes() {
    let api_boards = await get_boards();

    if (api_boards.length === 0) {
        api_boards = [await api_create_board("My board")];
    }

    const api_notes = await get_notes();
    await load_note_author_names(api_notes);

    boards = api_boards.map((board) => ({
        id: String(board.id),
        name: board.name,
        notes: [],
    }));

    api_notes.forEach((api_note) => {
        const board = boards.find((candidate) => candidate.id === String(api_note.board_id));

        if (board) {
            board.notes.push(convert_api_note(api_note, board.notes.length));
        }
    });

    const previous_board_id = active_board?.id;
    active_board = boards.find((board) => board.id === previous_board_id) ?? boards[0] ?? null;
}

// Render the board select dropdown
function render_board_select() {
    board_select.replaceChildren(
        ...boards.map((board) => new Option(board.name, board.id))
    );

    if (active_board) {
        board_select.value = active_board.id;
    }
}

// Render the notes on the board
function render_notes() {
    notes_board.replaceChildren();

    if (!active_board) {
        return;
    }

    notes_board.replaceChildren(
        ...active_board.notes.map((note) => create_note_element(note))
    );
}

// Create a note element from a note object
function create_note_element(note) {
    const note_element = note_template.content.firstElementChild.cloneNode(true);

    note_element.dataset.id = note.id;
    note_element.querySelector(".note_content").textContent = note.content;
    note_element.querySelector(".note_author").textContent = note.author_name;

    place_note(note_element, note);
    paint_note(note_element, note.color);

    return note_element;
}

// Place a note element on the board based on its properties
function place_note(note_element, note) {
    note_element.style.left = `${note.x}px`;
    note_element.style.top = `${note.y}px`;
    note_element.style.width = `${note.width}px`;
    note_element.style.height = `${note.height}px`;
}

// Paint a note element with the specified color index
function paint_note(note_element, color_index) {
    note_element.dataset.color = color_index;

    note_element.querySelectorAll(".note_color_swatch").forEach((swatch) => {
        swatch.setAttribute("aria-pressed", String(Number(swatch.dataset.color) === color_index));
    });
}


// Handle dragging and resizing of notes
const drag_gesture = { keys: ["x", "y"], floors: [0, 0], class_name: "is_dragging" };
const resize_gesture = { keys: ["width", "height"], floors: [note_size.min_width, note_size.min_height], class_name: "is_resizing" };

function start_gesture(event, note_element, gesture) {
    const note = find_note(note_element);
    const [key_x, key_y] = gesture.keys;
    const [floor_x, floor_y] = gesture.floors;

    const offset_x = note[key_x] - event.clientX;
    const offset_y = note[key_y] - event.clientY;

    event.preventDefault();

    z_index_counter += 1;
    note_element.style.zIndex = z_index_counter;
    note_element.classList.add(gesture.class_name);
    note_element.setPointerCapture(event.pointerId);

    const running = new AbortController();
    const options = { signal: running.signal };

    const end = () => {
        running.abort();
        note_element.classList.remove(gesture.class_name);

        save_note_layout(note, { [key_x]: note[key_x], [key_y]: note[key_y] });
    };

    note_element.addEventListener("pointermove", (move_event) => {
        note[key_x] = Math.max(floor_x, offset_x + move_event.clientX);
        note[key_y] = Math.max(floor_y, offset_y + move_event.clientY);

        place_note(note_element, note);

        send_live({
            type: "note_moving",
            id: note.id,
            x: note.x,
            y: note.y,
            width: note.width,
            height: note.height,
        });
    }, options);

    note_element.addEventListener("pointerup", end, options);
    note_element.addEventListener("pointercancel", end, options);
}


// Save the note layout to the API
async function save_note_layout(note, layout) {
    try {
        await api_update_note_layout(note.id, layout);
    } catch (error) {
        console.error("Could not save note layout:", error);
    }
}


// Create a new note
async function create_note() {
    if (!active_board) {
        return;
    }

    const note_text = window.prompt("Note text:")?.trim();

    if (!note_text) {
        return;
    }

    try {
        await api_create_note(note_text, Number(active_board.id));

        await load_boards_and_notes();
        render_board_select();
        render_notes();
    } catch (error) {
        console.error(error);
        window.alert(error.message);
    }
}

// Delete a note
async function delete_note(note_element) {
    const note = find_note(note_element);

    if (!note) {
        return;
    }

    try {
        await api_delete_note(note.id);

        await load_boards_and_notes();
        render_board_select();
        render_notes();
    } catch (error) {
        console.error(error);
        window.alert(error.message);
    }
}

notes_board.addEventListener("click", (event) => {
    const note_element = event.target.closest(".note");
    const swatch = event.target.closest(".note_color_swatch");

    if (!note_element) {
        return;
    }

    if (event.target.closest(".note_delete")) {
        delete_note(note_element);
    } else if (swatch) {
        const color_index = Number(swatch.dataset.color);

        const note = find_note(note_element);

        note.color = color_index;
        paint_note(note_element, color_index);
        save_note_layout(note, { color: color_index });
    }
});

notes_board.addEventListener("pointerdown", (event) => {
    const note_element = event.target.closest(".note");

    if (event.button !== 0 || !note_element) {
        return;
    }

    if (event.target.closest(".note_resize")) {
        start_gesture(event, note_element, resize_gesture);
    } else if (event.target.closest(".note_header") && !event.target.closest(".note_delete, .note_color_swatch")) {
        start_gesture(event, note_element, drag_gesture);
    }
});

notes_board.addEventListener("input", (event) => {
    if (!event.target.classList.contains("note_content")) {
        return;
    }

    send_live({
        type: "note_typing",
        id: event.target.closest(".note").dataset.id,
        content: event.target.textContent,
    });
});

notes_board.addEventListener("focusout", async (event) => {
    if (!event.target.classList.contains("note_content")) {
        return;
    }

    const note_element = event.target.closest(".note");
    const note = find_note(note_element);

    if (!note) {
        return;
    }

    const new_content = event.target.textContent.trim();

    try {
        await api_update_note(note.id, new_content);
        note.content = new_content;
    } catch (error) {
        console.error(error);
        window.alert(error.message);
    }
});

board_select.addEventListener("change", () => {
    const selected_board = boards.find(
        (board) => board.id === board_select.value
    );

    if (!selected_board) {
        return;
    }

    active_board = selected_board;
    render_notes();
    join_active_board();
});

new_note_button.addEventListener("click", () => create_note());

function log_out() {
    socket?.close(1000);
    clear_session();
    window.location.href = "login.html";
}

logout_button.addEventListener("click", log_out);

// Connect socket
function connect_socket() {
    socket = new WebSocket(`${NOTES_WS_URL}?token=${encodeURIComponent(get_token())}`);

    socket.addEventListener("open", async () => {
        if (has_connected_before) {
            await load_boards_and_notes();
            render_board_select();
            render_notes();
        }

        has_connected_before = true;
        join_active_board();
    });

    socket.addEventListener("message", (event) => {
        handle_socket_message(JSON.parse(event.data));
    });

    socket.addEventListener("close", (event) => {
        if (event.code === 4001) {
            log_out();
        } else if (event.code !== 1000) {
            setTimeout(connect_socket, 2000);
        }
    });
}

function send_socket_message(message) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function join_active_board() {
    if (active_board) {
        send_socket_message({ type: "join", board_id: active_board.id });
    }
}

const pending_live_messages = new Map();
let live_timer = null;

function send_live(message) {
    pending_live_messages.set(`${message.type}_${message.id}`, message);

    if (live_timer) {
        return;
    }

    live_timer = setTimeout(() => {
        pending_live_messages.forEach(send_socket_message);
        pending_live_messages.clear();
        live_timer = null;
    }, 50);
    // send state every 50ms
}

const is_busy_moving = (note_element) => note_element.matches(".is_dragging, .is_resizing");
const is_busy_typing = (note_element) => note_element.contains(document.activeElement);

function apply_layout(note, note_element, layout) {
    note.x = layout.x ?? note.x;
    note.y = layout.y ?? note.y;
    note.width = layout.width ?? note.width;
    note.height = layout.height ?? note.height;

    place_note(note_element, note);
}

function handle_socket_message(message) {
    if (!active_board || String(message.board_id) !== active_board.id) {
        return;
    }

    if (message.type === "note_created") {
        if (find_note_by_id(message.note.id)) {
            return;
        }

        const note = convert_api_note(message.note, active_board.notes.length);

        active_board.notes.push(note);
        const note_element = create_note_element(note);
        notes_board.append(note_element);

        if (note.author_id && !note.author_name) {
            get_user(note.author_id)
                .then((user) => {
                    const author_name = user.username ?? user.name;

                    if (!author_name) {
                        return;
                    }

                    note_author_names.set(note.author_id, author_name);
                    note.author_name = author_name;
                    note_element.querySelector(".note_author").textContent = author_name;
                })
                .catch((error) => {
                    console.error(`Could not load author for note ${note.id}:`, error);
                });
        }
        return;
    }

    if (message.type === "note_deleted") {
        active_board.notes = active_board.notes.filter((note) => note.id !== String(message.id));
        find_note_element(message.id)?.remove();
        return;
    }

    const note = find_note_by_id(message.type === "note_updated" ? message.note.id : message.id);
    const note_element = note && find_note_element(note.id);

    if (!note_element) {
        return;
    }

    if (message.type === "note_moving" && !is_busy_moving(note_element)) {
        apply_layout(note, note_element, message);

        if (note_element.style.zIndex !== String(z_index_counter)) {
            z_index_counter += 1;
            note_element.style.zIndex = z_index_counter;
        }
    }

    if (message.type === "note_typing" && !is_busy_typing(note_element)) {
        note.content = message.content;
        note_element.querySelector(".note_content").textContent = message.content;
    }

    if (message.type === "note_updated") {
        const saved = message.note;

        note.color = saved.color ?? 0;
        paint_note(note_element, note.color);

        if (!is_busy_moving(note_element)) {
            apply_layout(note, note_element, {
                x: saved.pos_x,
                y: saved.pos_y,
                width: saved.width,
                height: saved.height,
            });
        }

        if (!is_busy_typing(note_element)) {
            note.content = saved.note ?? "";
            note_element.querySelector(".note_content").textContent = note.content;
        }
    }
}

async function initialize_page() {
    try {
        await load_boards_and_notes();
        render_board_select();
        render_notes();
        connect_socket();
    } catch (error) {
        console.error(error);
        notes_board.textContent = "Could not load notes.";
    }
}

initialize_page();