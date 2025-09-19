 const KEY_MESSAGES = 'chat_messages_v1';
    const KEY_NICK = 'chat_nick_v1';
    const KEY_EMAIL = 'chat_email_v1';
    const KEY_MIC_OK = 'chat_mic_ok_v1';

    const panelLogin = document.getElementById('panel-login');
    const panelChat = document.getElementById('panel-chat');
    const enterBtn = document.getElementById('enterBtn');
    const clearBtn = document.getElementById('clearBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const meLabel = document.getElementById('meLabel');
    const messagesEl = document.getElementById('messages');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    const statusEl = document.getElementById('status');

    let currentNick = null;
    let currentEmail = null;
    let messages = [];
    let micStream = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    function showLogin(show) {
      panelLogin.classList.toggle('hidden', !show);
      panelChat.classList.toggle('hidden', show);
    }
    function saveMessages() {
      localStorage.setItem(KEY_MESSAGES, JSON.stringify(messages));
    }
    function loadMessagesFromStorage() {
      messages = JSON.parse(localStorage.getItem(KEY_MESSAGES) || '[]');
    }
    function renderAll() {
      messagesEl.innerHTML = '';
      messages.forEach(renderMessage);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }


    function openModal(src) {
      document.getElementById("modalImg").src = src;
      document.getElementById("imgModal").style.display = "flex";
    }
    function closeModal() {
      document.getElementById("imgModal").style.display = "none";
      document.getElementById("modalImg").src = "";
    }

    
    function renderMessage(m) {
      const div = document.createElement('div');
      div.className = 'msg ' + (m.user === currentNick ? 'me' : 'other');
      div.dataset.id = m.id;

      const who = document.createElement('div');
      who.className = 'who';
      who.textContent = (m.user || 'User') + (m.created_at ? ' • ' + new Date(m.created_at).toLocaleTimeString() : '');

      const body = document.createElement('div');
      if (m.isMedia) {
        if (m.mediaType && m.mediaType.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = m.dataUrl;
          img.onclick = () => openModal(img.src);
          body.appendChild(img);
        } else if (m.mediaType && m.mediaType.startsWith('video/')) {
          const v = document.createElement('video');
          v.src = m.dataUrl;
          v.controls = true;
          body.appendChild(v);
        } else if (m.mediaType && m.mediaType.startsWith('audio/')) {
          const a = document.createElement('audio');
          a.src = m.dataUrl;
          a.controls = true;
          body.appendChild(a);
        } else {
          const a = document.createElement('a');
          a.href = m.dataUrl;
          a.target = '_blank';
          a.textContent = 'Файл';
          body.appendChild(a);
        }
      } else {
        body.textContent = m.text || '';
      }

    
      if (m.user === currentNick) {
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.onclick = () => deleteMessage(m.id);
        div.appendChild(delBtn);
      }

      div.appendChild(who);
      div.appendChild(body);
      messagesEl.appendChild(div);
    }
    function deleteMessage(id) {
      const el = document.querySelector(`.msg[data-id="${id}"]`);
      if (el) el.remove();
      messages = messages.filter(m => String(m.id) !== String(id));
      saveMessages();
    }

    function pushMessage(obj) {
      messages.push(obj);
      saveMessages();
      renderMessage(obj);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    enterBtn.addEventListener('click', () => {
      const nick = document.getElementById('nick').value.trim();
      const email = document.getElementById('email').value.trim();
      if (!nick || !email) {
        alert('Введите ник и email');
        return;
      }
      currentNick = nick;
      currentEmail = email;
      localStorage.setItem(KEY_NICK, currentNick);
      localStorage.setItem(KEY_EMAIL, currentEmail);
      meLabel.textContent = currentNick + ' · ' + currentEmail;
      showLogin(false);
      loadMessagesFromStorage();
      renderAll();
      askMicOnce();
    });

    clearBtn.addEventListener('click', () => {
      document.getElementById('nick').value = '';
      document.getElementById('email').value = '';
    });

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(KEY_NICK);
      localStorage.removeItem(KEY_EMAIL);
      currentNick = null;
      currentEmail = null;
      showLogin(true);
    });

    sendBtn.addEventListener('click', () => {
      const t = msgInput.value.trim();
      if (!t) return;
      const obj = { id: Date.now(), user: currentNick, text: t, isMedia: false, created_at: new Date().toISOString() };
      pushMessage(obj);
      msgInput.value = '';
    });
    msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendBtn.click(); });

    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const obj = { id: Date.now(), user: currentNick, isMedia: true, mediaType: f.type, dataUrl, created_at: new Date().toISOString() };
        pushMessage(obj);
      };
      reader.readAsDataURL(f);
      fileInput.value = '';
    });

    async function saveToSupabase(msg) {
  try {
    const { data, error } = await fetch(`${supabaseUrl}/rest/v1/xabar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supAPI,
        'Authorization': 'Bearer ' + supAPI,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: msg.id,
        create: msg.created_at,
        msg: msg.text || null,
        user: msg.user
      })
    }).then(r => r.json());

    if (error) console.error("Supabase error:", error);
  } catch (e) {
    console.error("Save error:", e);
  }
}


    async function askMicOnce() {
      if (localStorage.getItem(KEY_MIC_OK) === '1') {
        try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { }
        return;
      }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStorage.setItem(KEY_MIC_OK, '1');
      } catch (e) { console.warn('mic not allowed on first ask', e); }
    }

    function startRecording() {
      if (!micStream) {
        alert('Нет разрешения на микрофон.');
        return;
      }
      function pushMessage(obj) {
  messages.push(obj);
  saveMessages();
  renderMessage(obj);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  
  saveToSupabase(obj);
}

      audioChunks = [];
      mediaRecorder = new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const fr = new FileReader();
        fr.onload = () => {
          const dataUrl = fr.result;
          const obj = { id: Date.now(), user: currentNick, isMedia: true, mediaType: blob.type || 'audio/webm', dataUrl, created_at: new Date().toISOString() };
          pushMessage(obj);
        };
        fr.readAsDataURL(blob);
      };
      mediaRecorder.start();
      isRecording = true;
      micBtn.classList.add('recording');
    }

    
    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      isRecording = false;
      micBtn.classList.remove('recording');
    }

    micBtn.addEventListener('click', async () => {
      if (!micStream) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStorage.setItem(KEY_MIC_OK, '1');
        } catch (e) { alert('Доступ к микрофону не получен'); return; }
      }
      if (!isRecording) startRecording(); else stopRecording();
    });

    window.addEventListener('load', () => {
      const savedNick = localStorage.getItem(KEY_NICK);
      const savedEmail = localStorage.getItem(KEY_EMAIL);
      if (savedNick) document.getElementById('nick').value = savedNick;
      if (savedEmail) document.getElementById('email').value = savedEmail;
      if (savedNick && savedEmail) {
        currentNick = savedNick; currentEmail = savedEmail;
        meLabel.textContent = currentNick + ' · ' + currentEmail;
        showLogin(false);
        loadMessagesFromStorage();
        renderAll();
        askMicOnce();
      }
    });