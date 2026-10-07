// grab the elements we need
const forgot_password_form = document.getElementById("forgot_password_form");
const email_input = document.getElementById("email");
const error_message = document.getElementById("error_message");
const success_message = document.getElementById("success_message");
const submit_button = document.getElementById("submit_button");

forgot_password_form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email_value = email_input.value.trim();

    if (email_value === "") {
        show_error("Please enter your email.");
        return;
    }

    hide_error();
    submit_button.disabled = true;

    try {
        const result = await request_password_reset(email_value);
        show_success(`${result.msg} (Check the inbox at http://localhost:8025)`);
    } catch (error) {
        console.error("Password reset request failed:", error);
        show_error(error.message);
        submit_button.disabled = false;
    }
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