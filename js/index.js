// Credits: dragging och storleksändringen här bygger på MDN:s exempel med pointer capture.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
// https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events

// TODO: Save note position on Database

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

const boards = [{ id: "board_1", name: "Projektplanering", notes: [] }];
let active_board = boards[0];

let z_index_counter = 10;

const unique_id = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const find_note = (note_element) => active_board.notes.find((note) => note.id === note_element.dataset.id);

function render_board_select() {
    board_select.replaceChildren(
        ...boards.map((board) => new Option(board.name, board.id)),
        new Option("+ New board", "__new__"),
    );

    board_select.value = active_board.id;
}

function render_notes() {
    notes_board.replaceChildren(...active_board.notes.map((note) => create_note_element(note)));
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

function create_note() {
    const cascade = (active_board.notes.length % 6) * 24;

    const note = {
        id: unique_id("note"),
        content: "",
        color: Math.floor(Math.random() * note_color_count),
        x: 40 + cascade,
        y: 40 + cascade,
        width: note_size.width,
        height: note_size.height,
    };

    active_board.notes.push(note);
    notes_board.appendChild(create_note_element(note));
}

function delete_note(note_element) {
    const index = active_board.notes.findIndex((note) => note.id === note_element.dataset.id);

    if (index !== -1) {
        active_board.notes.splice(index, 1);
        note_element.remove();
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

notes_board.addEventListener("focusout", (event) => {
    if (event.target.classList.contains("note_content")) {
        find_note(event.target.closest(".note")).content = event.target.textContent;
    }
});

board_select.addEventListener("change", () => {
    if (board_select.value !== "__new__") {
        active_board = boards.find((board) => board.id === board_select.value);
        render_notes();
        return;
    }

    const name = window.prompt("Name your new board:")?.trim();

    if (!name) {
        board_select.value = active_board.id;
        return;
    }

    active_board = { id: unique_id("board"), name, notes: [] };

    boards.push(active_board);
    render_board_select();
    render_notes();
});

new_note_button.addEventListener("click", () => create_note());

render_board_select();
render_notes();