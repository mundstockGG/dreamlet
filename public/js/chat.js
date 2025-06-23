document.addEventListener("DOMContentLoaded", () => {
  const socket      = io();
  const envId       = window.envId;
  const username    = window.username;
  let activePlace   = localStorage.getItem(`lastPlace:${envId}`);
  activePlace       = activePlace ? +activePlace : null;

  const form        = document.getElementById("chat-form");
  const input       = form.querySelector('input[name="message"]');
  const hist        = document.getElementById("chat-history");
  const placeLinks  = document.querySelectorAll(".place-link");
  const lobbyLink   = document.querySelector(".lobby-link");
  const typingEl    = document.getElementById("typing-indicator");
  const slashSug    = document.getElementById("slash-suggestions");

  function joinLobby() {
    hist.innerHTML = "";
    socket.emit("joinEnv", envId);
    updateActive();
  }
  function switchToPlace(pid) {
    activePlace = pid;
    localStorage.setItem(`lastPlace:${envId}`, pid);
    hist.innerHTML = "";
    socket.emit("joinPlace", { envId, placeId: pid });
    updateActive();
  }
  function updateActive() {
    document.querySelectorAll(".list-group-item").forEach(li => li.classList.remove("active"));
    if (activePlace === null) {
      lobbyLink.closest("li").classList.add("active");
    } else {
      const el = document.querySelector(`.place-link[data-place-id="${activePlace}"]`);
      if (el) el.closest("li").classList.add("active");
    }
  }
  lobbyLink.addEventListener("click", e => {
    e.preventDefault();
    activePlace = null;
    joinLobby();
  });
  placeLinks.forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    switchToPlace(+a.dataset.placeId);
  }));
  if (activePlace != null) switchToPlace(activePlace);
  else joinLobby();

  socket.on("initialLobbyMessages", msgs => {
    if (activePlace === null) msgs.forEach(append);
  });
  socket.on("initialPlaceMessages", msgs => {
    if (activePlace != null) msgs.forEach(append);
  });
  socket.on("lobbyMessage", msg => {
    if (activePlace === null) append(msg);
  });
  socket.on("placeMessage", msg => {
    if (msg.placeId === activePlace) append(msg);
  });
  socket.on("typing", data => {
    if (
      (activePlace === null && !data.placeId) ||
      (activePlace != null && data.placeId === activePlace)
    ) {
      if (data.username !== username) {
        typingEl.textContent = `${data.username} is typing...`;
        typingEl.style.display = "";
        clearTimeout(window._typingTO);
        window._typingTO = setTimeout(() => {
          typingEl.style.display = "none";
        }, 2000);
      }
    }
  });

  const commands = [
    { cmd: "/roll", desc: "Action Roll…" },
    { cmd: "/me",   desc: "Perform an action" },
    { cmd: "/do",   desc: "Narrative description" },
  ];
  function showSuggestions() {
    slashSug.innerHTML = commands.map(c => `
      <div class="slash-suggestion-item" data-cmd="${c.cmd}">
        <strong>${c.cmd}</strong> <span class="text-muted">${c.desc}</span>
      </div>
    `).join("");
    slashSug.style.display = "";
    slashSug.querySelectorAll(".slash-suggestion-item").forEach(item => {
      item.addEventListener("mousedown", e => {
        e.preventDefault();
        input.value = item.dataset.cmd + " ";
        slashSug.style.display = "none";
        input.focus();
      });
    });
  }
  input.addEventListener("input", () => {
    if (input.value === "/") showSuggestions();
    else slashSug.style.display = "none";
  });
  input.addEventListener("blur", () => {
    setTimeout(() => { slashSug.style.display = "none"; }, 100);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    if (content.startsWith("/")) {
      if (/^\/roll\s*$/i.test(content)) {
        const modalEl = document.getElementById("diceModal");
        if (!modalEl) {
          console.error("⚠️ diceModal element not found in DOM");
          return;
        }
        if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
          console.error("⚠️ Bootstrap JS not loaded, cannot show modal");
          return;
        }
        new bootstrap.Modal(modalEl).show();
      } else if (/^\/(me|do|rr)\s+/.test(content)) {
        if (activePlace === null) {
          socket.emit("lobbyMessage", { envId, content });
        } else {
          socket.emit("placeMessage", { envId, placeId: activePlace, content });
        }
      } else {
        const err = document.createElement("div");
        err.className = "mb-2 text-danger";
        err.textContent = `Unknown or malformed command: ${content}`;
        hist.appendChild(err);
        hist.scrollTop = hist.scrollHeight;
      }
      input.value = "";
      typingEl.style.display = "none";
      return;
    }

    if (activePlace === null) {
      socket.emit("lobbyMessage", { envId, content });
    } else {
      socket.emit("placeMessage", { envId, placeId: activePlace, content });
    }
    input.value = "";
    typingEl.style.display = "none";
  });

  const diceForm = document.getElementById("diceForm");
  diceForm.addEventListener("submit", e => {
    e.preventDefault();
    const desc  = document.getElementById("diceDesc").value.trim();
    const type  = document.getElementById("diceType").value;
    const count = +document.getElementById("diceCount").value;

    socket.emit("roll", {
      envId,
      placeId:    activePlace,
      username,
      desc,
      diceType:   type,
      diceCount:  count
    });
    const modalInstance = bootstrap.Modal.getInstance(
      document.getElementById("diceModal")
    );
    modalInstance.hide();
  });

  socket.on("roll", data => {
    append({
      username: data.username,
      type:     "roll",
      content:  `${data.desc} — rolled ${data.diceCount}×${data.diceType}: ${data.rolls.join(" + ")} = ${data.total}`
    });
  });
  socket.on("action", data => {
    append({
      username:    data.username,
      type:        "action",
      action_type: "me",
      content:     data.action
    });
  });
  socket.on("desc", data => {
    append({
      username:    data.username,
      type:        "action",
      action_type: "do",
      content:     data.text
    });
  });
  socket.on("errorMessage", msg => {
    const el = document.createElement("div");
    el.className   = "mb-2 text-danger";
    el.textContent = msg;
    hist.appendChild(el);
    hist.scrollTop = hist.scrollHeight;
  });

  function append(msg) {
    const div = document.createElement("div");
    div.classList.add("mb-2");
    if (msg.type === "action") {
      div.classList.add("chat-action", `chat-${msg.action_type || "me"}`);
      div.innerHTML = `*${msg.username} ${msg.content}`;
    } else if (msg.type === "roll") {
      div.classList.add("chat-roll");
      div.innerHTML = `🎲 <strong>${msg.username}</strong> ${msg.content}`;
    } else {
      div.classList.add("chat-normal");
      div.innerHTML = `<strong>${msg.username}:</strong> ${msg.content}`;
    }
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }
});
