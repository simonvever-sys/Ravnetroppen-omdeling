const SAVED_USER_KEY = "savedUser";
const ACTIVE_USER_KEY = "activeUser";

const users = {
  admin: "admin",
  1: "ravnetroppen",
  2: "ravnetroppen",
  3: "ravnetroppen",
  4: "ravnetroppen",
  5: "ravnetroppen",
  6: "ravnetroppen",
  7: "ravnetroppen",
  8: "ravnetroppen",
  9: "ravnetroppen",
  10: "ravnetroppen",
  11: "ravnetroppen",
  12: "ravnetroppen",
  13: "ravnetroppen",
  14: "ravnetroppen",
  15: "ravnetroppen",
  16: "ravnetroppen",
  17: "ravnetroppen",
  18: "ravnetroppen",
  19: "ravnetroppen",
  20: "ravnetroppen"
};

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberInput = document.getElementById("rememberMe");
const errorMsg = document.getElementById("errorMsg");

window.addEventListener("load", () => {
  const savedUser = localStorage.getItem(SAVED_USER_KEY);
  if (!savedUser) {
    return;
  }

  sessionStorage.setItem(ACTIVE_USER_KEY, savedUser);
  goToDestination(savedUser);
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMsg.textContent = "";

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim().toLowerCase();
  const rememberMe = rememberInput.checked;

  const validPassword = users[username];
  if (!validPassword || validPassword !== password) {
    errorMsg.textContent = "Forkert login. Proev igen.";
    return;
  }

  sessionStorage.setItem(ACTIVE_USER_KEY, username);

  if (rememberMe) {
    localStorage.setItem(SAVED_USER_KEY, username);
  } else {
    localStorage.removeItem(SAVED_USER_KEY);
  }

  goToDestination(username);
});

function goToDestination(username) {
  if (username === "admin") {
    window.location.href = "admin.html";
    return;
  }

  window.location.href = "app.html?rute=" + encodeURIComponent(username);
}
