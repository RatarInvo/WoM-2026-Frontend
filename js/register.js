// grab the elements we need
const register_form = document.getElementById("register_form");
const username_input = document.getElementById("username");
const email_input = document.getElementById("email");
const password_input = document.getElementById("password");
const confirm_password_input = document.getElementById("confirm_password");
const error_message = document.getElementById("error_message");
const success_message = document.getElementById("success_message");

const min_password_length = 8;

// wires up one eye icon to one password field
function setup_password_toggle(toggle_id, icon_id, input_element) {
    const toggle_button = document.getElementById(toggle_id);
    const toggle_icon = document.getElementById(icon_id);

    toggle_button.addEventListener("click", function () {
        const is_hidden = input_element.type === "password";

        input_element.type = is_hidden ? "text" : "password";
        toggle_icon.classList.toggle("bi-eye", !is_hidden);
        toggle_icon.classList.toggle("bi-eye-slash", is_hidden);
        toggle_button.setAttribute("aria-label", is_hidden ? "Hide password" : "Show password");
    });
}

setup_password_toggle("password_toggle", "password_toggle_icon", password_input);
setup_password_toggle("confirm_password_toggle", "confirm_password_toggle_icon", confirm_password_input);

register_form.addEventListener("submit", function (event) {
    event.preventDefault();

    const username_value = username_input.value.trim();
    const email_value = email_input.value.trim();
    const password_value = password_input.value.trim();
    const confirm_value = confirm_password_input.value.trim();

    if (username_value === "" || email_value === "" || password_value === "" || confirm_value === "") {
        show_error("Please fill in all fields.");
        return;
    }

    if (password_value.length < min_password_length) {
        show_error(`Password must be at least ${min_password_length} characters.`);
        return;
    }

    if (password_value !== confirm_value) {
        show_error("Passwords do not match.");
        return;
    }

    hide_error();
    show_success("Account created. You can now sign in.");

    // form is valid, hand it off to backend
    console.log("register submitted:", { username: username_value, email: email_value });
});

function show_error(text) {
    error_message.textContent = text;
    error_message.classList.add("is_visible");
    success_message.classList.remove("is_visible");
}

function hide_error() {
    error_message.textContent = "";
    error_message.classList.remove("is_visible");
}

function show_success(text) {
    success_message.textContent = text;
    success_message.classList.add("is_visible");
}