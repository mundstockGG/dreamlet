document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const envId  = window.envId || '';
  const username = window.username || '';
  // Try to restore last active place from localStorage
  let activePlace = localStorage.getItem(`lastPlace:${envId}`);
  if (activePlace !== null && activePlace !== '') activePlace = +activePlace;
  else activePlace = null;

  // Elements
  const form    = document.getElementById('chat-form');
  const input   = form.querySelector('input[name="message"]');
  const hist    = document.getElementById('chat-history');
  const placeLinks = document.querySelectorAll('.place-link');
  const lobbyLink  = document.querySelector('.lobby-link');

  function joinLobby() {
    hist.innerHTML = '';
    socket.emit('joinEnv', envId);
    updateActiveList();
  }

  function updateActiveList() {
    document.querySelectorAll('.list-group-item').forEach(li => li.classList.remove('active'));
    if (activePlace === null) {
      lobbyLink.closest('.list-group-item').classList.add('active');
    } else {
      document.querySelectorAll('.place-link').forEach(a => {
        if (+a.dataset.placeId === activePlace) {
          a.closest('.list-group-item').classList.add('active');
        }
      });
    }
  }

  function switchToPlace(placeId) {
    activePlace = placeId;
    localStorage.setItem(`lastPlace:${envId}`, placeId);
    hist.innerHTML = '';
    socket.emit('joinPlace', { envId, placeId });
    updateActiveList();
  }
  placeLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      switchToPlace(+a.dataset.placeId);
    });
  });
  lobbyLink.addEventListener('click', e => {
    e.preventDefault();
    activePlace = null;
    localStorage.setItem(`lastPlace:${envId}`, '');
    joinLobby();
  });

  if (activePlace !== null && !isNaN(activePlace)) {
    switchToPlace(activePlace);
  } else {
    joinLobby();
  }

  socket.on('initialLobbyMessages', msgs => {
    if (activePlace === null) {
      hist.innerHTML = '';
      msgs.forEach(append);
    }
  });
  socket.on('initialPlaceMessages', msgs => {
    if (activePlace !== null) {
      hist.innerHTML = '';
      msgs.forEach(append);
    }
  });
  socket.on('lobbyMessage', msg => {
    if (activePlace === null) append(msg);
  });
  socket.on('placeMessage', msg => {
    if (msg.placeId === activePlace) append(msg);
  });

  // Typing indicator logic
  const typingIndicator = document.getElementById('typing-indicator');
  let typingTimeout;
  let lastTypedRoom = null;

  input.addEventListener('input', () => {
    if (activePlace === null) {
      socket.emit('typing', { envId });
      lastTypedRoom = `lobby-${envId}`;
    } else {
      socket.emit('typing', { envId, placeId: activePlace });
      lastTypedRoom = `place-${envId}-${activePlace}`;
    }
  });

  socket.on('showTyping', ({ username: typingUser, envId: typingEnv, placeId }) => {
    if (
      (activePlace === null && !placeId && typingEnv == envId && typingUser !== username) ||
      (activePlace !== null && placeId == activePlace && typingEnv == envId && typingUser !== username)
    ) {
      typingIndicator.textContent = `${typingUser} is typing...`;
      typingIndicator.style.display = '';
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        typingIndicator.style.display = 'none';
      }, 2000);
    }
  });

  // Slash command suggestion logic
  const slashSuggestions = document.getElementById('slash-suggestions');
  const commands = [
    { cmd: '/roll', desc: 'Roll dice, e.g. /roll 2d6' },
    { cmd: '/me', desc: 'Action, e.g. /me waves' },
    { cmd: '/do', desc: 'Description, e.g. /do the wind blows' }
  ];
  function renderSlashSuggestions() {
    slashSuggestions.innerHTML = commands.map(c =>
      `<div class=\"slash-suggestion-item\" data-cmd=\"${c.cmd}\"><strong>${c.cmd}</strong> <span class=\"text-muted\">${c.desc}</span></div>`
    ).join('');
    slashSuggestions.style.display = '';
    slashSuggestions.querySelectorAll('.slash-suggestion-item').forEach(item => {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        input.value = this.getAttribute('data-cmd') + ' ';
        slashSuggestions.style.display = 'none';
        input.focus();
      });
    });
  }
  input.addEventListener('input', () => {
    const val = input.value;
    if (val === '/') {
      renderSlashSuggestions();
    } else {
      slashSuggestions.style.display = 'none';
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { slashSuggestions.style.display = 'none'; }, 100);
  });
  input.addEventListener('focus', () => {
    if (input.value === '/') renderSlashSuggestions();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    if (activePlace === null) {
      socket.emit('lobbyMessage', { envId, content });
    } else {
      socket.emit('placeMessage', { envId, placeId: activePlace, content });
    }
    input.value = '';
    typingIndicator.style.display = 'none';
  });

  socket.on('roll', ({ username, count, sides, rolls, total }) => {
    appendSystem(`<strong>${username}</strong> rolled ${count}d${sides}: [${rolls.join(', ')}] = <strong>${total}</strong>`);
  });
  socket.on('action', ({ username, action }) => {
    appendSystem(`<em class="chat-me">*${username} ${action}</em>`);
  });
  socket.on('desc', ({ username, text }) => {
    appendSystem(`<em class="chat-do">${text}</em>`);
  });
  socket.on('errorMessage', msg => {
    appendSystem(`<span class="text-danger">${msg}</span>`);
  });

  function appendSystem(html) {
    const div = document.createElement('div');
    div.className = 'mb-2 text-muted';
    div.innerHTML = html;
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }

  function append({ username, content, type, action_type }) {
    const div = document.createElement('div');
    if (type === 'action') {
      div.className = `mb-2 chat-action chat-${action_type || 'me'}`;
      div.innerHTML = `*${username} ${content}`;
    } else {
      div.className = 'mb-2 chat-normal';
      div.innerHTML = `<strong>${username}:</strong> ${content}`;
    }
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }
});
