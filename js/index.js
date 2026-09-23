// Credits: dragging och storleksändringen här bygger på MDN:s exempel med pointer capture.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
// https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events

// TODO: Save note position on Database


// Check if the user is logged in
const token = get_token();

if (!token) {
    window.location.href = "login.html";
}


// grab the elements we need
const notes_board = document.getElementById("notes_board");
const board_select = document.getElementById("board_select");
const new_note_button = document.getElementById("new_note_button");
const note_template = document.getElementById("note_template");

const note_color_count = note_template.content.querySelectorAll(".note_color_swatch").length;

const note_size = { width: 220, height: 160, min_width: 180, min_height: 110 };

let boards = [];
let active_board = null;

let z_index_counter = 10;

const unique_id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const find_note = (note_element) => active_board.notes.find((note) => note.id === note_element.dataset.id);

// Find a note by its ID
function convert_api_note(api_note, board_note_index) {
    const cascade = (board_note_index % 6) * 24;

    return {
        id: String(api_note.id),
        content: api_note.note ?? "",
        color: 0,
        x: 40 + cascade,
        y: 40 + cascade,
        width: note_size.width,
        height: note_size.height,
        board_id: api_note.board_id ?? api_note.board?.id,
    };
}

async function load_boards_and_notes() {
    const api_notes = await get_notes();

    const boards_by_id = new Map();

    api_notes.forEach((api_note) => {
        const board = api_note.board;

        if (!board) {
            return;
        }

        if (!boards_by_id.has(board.id)) {
            boards_by_id.set(board.id, {
                id: String(board.id),
                name: board.name,
                notes: [],
            });
        }

        const frontend_board = boards_by_id.get(board.id);

        frontend_board.notes.push(
            convert_api_note(api_note, frontend_board.notes.length)
        );
    });

    boards = [...boards_by_id.values()];
    active_board = boards[0] ?? null;
}

function render_board_select() {
    board_select.replaceChildren(
        ...boards.map((board) => new Option(board.name, board.id))
    );

    if (active_board) {
        board_select.value = active_board.id;
    }
}

function render_notes() {
    notes_board.replaceChildren();

    if (!active_board) {
        return;
    }

    notes_board.replaceChildren(
        ...active_board.notes.map((note) => create_note_element(note))
    );
}

function create_note_element(note) {
    const note_element = note_template.content.firstElementChild.cloneNode(true);

    note_element.dataset.id = note.id;
    note_element.querySelector(".note_content").textContent = note.content;

    place_note(note_element, note);
    paint_note(note_element, note.color);

    return note_element;
}

function place_note(note_element, note) {
    note_element.style.left = `${note.x}px`;
    note_element.style.top = `${note.y}px`;
    note_element.style.width = `${note.width}px`;
    note_element.style.height = `${note.height}px`;
}

function paint_note(note_element, color_index) {
    note_element.dataset.color = color_index;

    note_element.querySelectorAll(".note_color_swatch").forEach((swatch) => {
        swatch.setAttribute("aria-pressed", String(Number(swatch.dataset.color) === color_index));
    });
}

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
    };

    note_element.addEventListener("pointermove", (move_event) => {
        note[key_x] = Math.max(floor_x, offset_x + move_event.clientX);
        note[key_y] = Math.max(floor_y, offset_y + move_event.clientY);

        place_note(note_element, note);
    }, options);

    note_element.addEventListener("pointerup", end, options);
    note_element.addEventListener("pointercancel", end, options);
}

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

        find_note(note_element).color = color_index;
        paint_note(note_element, color_index);
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
});

new_note_button.addEventListener("click", () => create_note());

async function initialize_page() {
    try {
        await load_boards_and_notes();
        render_board_select();
        render_notes();
    } catch (error) {
        console.error(error);
        notes_board.textContent = "Could not load notes.";
    }
}

initialize_page();