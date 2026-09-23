const token = get_token();

if (token) {
    window.location.href = "index.html";
}


// grab the elements we need
const login_form = document.getElementById("login_form");
const username_input = document.getElementById("username");
const password_input = document.getElementById("password");
const password_toggle = document.getElementById("password_toggle");
const toggle_icon = document.getElementById("toggle_icon");
const error_message = document.getElementById("error_message");

// show or hide the password text
password_toggle.addEventListener("click", function () {
    const is_hidden = password_input.type === "password";

    password_input.type = is_hidden ? "text" : "password";
    toggle_icon.classList.toggle("bi-eye", !is_hidden);
    toggle_icon.classList.toggle("bi-eye-slash", is_hidden);
    password_toggle.setAttribute("aria-label", is_hidden ? "Hide password" : "Show password");
});

// basic check before the form is sent anywhere
login_form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username_value = username_input.value.trim();
    const password_value = password_input.value.trim();

    if (username_value === "" || password_value === "") {
        show_error("Please fill in both fields.");
        return;
    }

    hide_error();

    try {
        const result = await login_user(username_value, password_value);

        localStorage.setItem("auth_token", result.token);
        localStorage.setItem("user_id", result.id);

        window.location.href = "index.html";
    } catch (error) {
        show_error("Wrong username or password. Please try again.");
    }
});

function show_error(text) {
    error_message.textContent = text;
    error_message.classList.add("is_visible");
}

function hide_error() {
    error_message.textContent = "";
    error_message.classList.remove("is_visible");
}