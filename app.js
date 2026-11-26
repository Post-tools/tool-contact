// ★ここに質問者用GAS（プロジェクト①）のウェブアプリURLを貼り付けてください
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxW1kZ5S7x9n5jetH30cj4ZpjMy98WFOqbim_X8AV3wLhhvm1k7w30i8dxR7VaUzJA/exec';

let currentId = null;
let currentPassword = null;

// 画面の切り替え
function show(id) {
  document.querySelectorAll('main section')
    .forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ダークモードの切り替え
function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(
    'contactTheme',
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

// 初期テーマの復元
if (localStorage.getItem('contactTheme') === 'dark') {
  document.body.classList.add('dark');
}

// HTMLエスケープ処理（XSS対策）
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function(c) {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#039;';
  });
}

// GASと通信する共通関数
async function callGas(payload) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(data.message);
  }
  return data;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(',').pop();
      resolve({
        name: file.name,
        type: file.type,
        data: base64Data
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 画像選択時の枚数表示
document.getElementById('images').addEventListener('change', e => {
  const files = Array.from(e.target.files);
  document.getElementById('fileName').textContent =
    files.length
      ? files.length + '枚の画像が選択されています。'
      : '画像は複数枚選択できます。';
});

// 新規お問い合わせの送信処理
document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '送信中...';
  }

  try {
    const files = Array.from(document.getElementById('images').files);
    const images = await Promise.all(files.map(readFileAsBase64));

    const payload = {
      action: 'submit',
      category: document.getElementById('category').value,
      tool: document.getElementById('tool').value,
      detail: document.getElementById('detail').value,
      reply: document.getElementById('reply').checked ? '希望する' : '希望しない',
      images: images
    };

    const res = await callGas(payload);

    document.getElementById('issuedId').textContent = res.id;
    document.getElementById('issuedPassword').textContent = res.password;

    e.target.reset();
    document.getElementById('fileName').textContent = '画像は複数枚選択できます。';
    show('complete');
  } catch (err) {
    alert('送信に失敗しました：' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'お問い合わせを送信する';
    }
  }
});

// 送信済みお問い合わせの確認処理
async function lookup() {
  const id = document.getElementById('lookupId').value.trim();
  const password = document.getElementById('lookupPassword').value.trim();
  const errEl = document.getElementById('lookupError');
  const btn = document.querySelector('#lookup button.primary');

  if (!id || !password) {
    errEl.textContent = '受付番号とパスワードを入力してください。';
    return;
  }

  errEl.textContent = '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '確認中...';
  }

  try {
    const res = await callGas({ action: 'lookup', id, password });
    currentId = id;
    currentPassword = password;
    renderThread(res.record);
    show('thread');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '確認する';
    }
  }
}

// お問い合わせ履歴の描画
function renderThread(record) {
  const followUps = record.messages.slice(1);
  const messagesHtml = followUps.map(m => `
    <div class="record">
      <strong>${m.from === 'admin' ? '管理者からの返信' : '追加メッセージ'}</strong>
      <p style="white-space:pre-wrap">${escapeHTML(m.text)}</p>
      <small>${escapeHTML(m.date)}</small>
    </div>
  `).join('');

  document.getElementById('threadContent').innerHTML = `
    <div class="notice">
      <strong>${escapeHTML(record.category)}｜${escapeHTML(record.tool)}</strong>
      <p>受付番号：${escapeHTML(record.id)}</p>
      <p>状態：${escapeHTML(record.status)}</p>
      <p style="white-space:pre-wrap">${escapeHTML(record.detail)}</p>
      ${record.imageNames.length
        ? '<p>添付ファイル：' + record.imageNames.map(escapeHTML).join('、') + '</p>'
        : ''}
    </div>
    ${messagesHtml}
  `;
}

// 追加メッセージの送信処理
async function sendUserMessage() {
  const text = document.getElementById('userMessage').value.trim();
  if (!text) return;

  const btn = document.querySelector('#thread button.primary');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '送信中...';
  }

  try {
    const res = await callGas({
      action: 'message',
      id: currentId,
      password: currentPassword,
      text: text
    });
    document.getElementById('userMessage').value = '';
    renderThread(res.record);
  } catch (err) {
    alert('送信に失敗しました：' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'メッセージを送信';
    }
  }
}
