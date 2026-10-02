const SALT = "WeddingSalt2026";
const ROTATION_MS = 1000;
const PASS_KEY = "weddingPass";
const STORY_UNLOCKED_KEY = "storyUnlocked";

async function getCryptoKey(password, salt = SALT) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

function bytes(value) {
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function decryptData(payload, password) {
  try {
    if (!payload || !payload.iv || !payload.data) return null;

    const key = await getCryptoKey(password, payload.salt || SALT);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(payload.iv) },
      key,
      bytes(payload.data)
    );

    return new TextDecoder().decode(plain);
  } catch (_) {
    return null;
  }
}

function source(value) {
  const text = value.trim();
  if (!text) return null;

  return text.startsWith("data:image/")
    ? text
    : `data:image/jpeg;base64,${text.replace(/\s/g, "")}`;
}

function payloadFrom(script) {
  try {
    const text = script.textContent.trim();
    return text.includes("PASTE_IV_BASE64_HERE") ? null : JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function parseList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function setStatus(message, isSuccess) {
  const status = document.getElementById("pass-status");
  if (!status) return;

  status.textContent = message;
  status.style.color = isSuccess ? "green" : "red";
}

function showProtectedContent() {
  const protectedContent = document.getElementById("protected-content");
  if (protectedContent) {
    protectedContent.style.display = "block";
    protectedContent.hidden = false;
  }

  const audio = document.getElementById("protected-audio");
  if (audio) {
    audio.muted = false;
  }
}

function hideProtectedContent() {
  const protectedContent = document.getElementById("protected-content");
  if (protectedContent) {
    protectedContent.style.display = "none";
    protectedContent.hidden = true;
  }

  const audio = document.getElementById("protected-audio");
  if (audio) {
    audio.pause();
    audio.muted = true;
  }
}

function startImageStack(stackNode) {
  if (!stackNode) return;

  const rawImages = parseList(stackNode.dataset.imageStack);
  if (!rawImages.length) return;

  let visibleCount = Number(stackNode.dataset.visible) || 10;
  visibleCount = Math.max(1, visibleCount);

  const delays = parseList(stackNode.dataset.delay)
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0);

  const sequence = parseList(stackNode.dataset.sequence);

  stackNode.querySelectorAll(".memory-tile").forEach(tile => tile.remove());

  const tiles = [];
  for (let i = 0; i < visibleCount; i++) {
    const tile = document.createElement("div");
    tile.className = "memory-tile";

    const img = document.createElement("img");
    img.alt = "Wedding memory";
    img.loading = "lazy";

    tile.appendChild(img);
    stackNode.appendChild(tile);
    tiles.push(img);
  }

  let frame = 0;

  function renderFrame() {
    const frameImages = [];

    if (sequence.length) {
      for (let i = 0; i < visibleCount; i++) {
        const idx = (frame + i) % sequence.length;
        frameImages.push(sequence[idx]);
      }
    } else {
      for (let i = 0; i < visibleCount; i++) {
        const idx = (frame + i) % rawImages.length;
        frameImages.push(rawImages[idx]);
      }
    }

    tiles.forEach((img, index) => {
      img.src = frameImages[index];
    });
  }

  function nextTick() {
    frame = (frame + 1) % Math.max(1, sequence.length || rawImages.length);
    renderFrame();

    const delay = delays.length
      ? delays[frame % delays.length]
      : ROTATION_MS;

    setTimeout(nextTick, delay);
  }

  renderFrame();
  nextTick();
}

async function decryptStack(script, password) {
  const payload = payloadFrom(script);
  if (!payload) return false;

  const text = await decryptData(payload, password);
  if (text === null) return false;

  let values;
  try {
    const parsed = JSON.parse(text);
    values = Array.isArray(parsed) ? parsed : [text];
  } catch (_) {
    values = text.split(/\r?\n/);
  }

  const images = values.map(source).filter(Boolean);
  if (!images.length) return false;

  const row = script.parentElement;
  if (!row) return false;

  const mode = row.dataset.repeat === "fill" ? "fill" : "fixed";
  const wanted =
    mode === "fill"
      ? Math.max(1, Math.ceil(row.clientWidth / 192))
      : Math.max(1, Number(row.dataset.count) || images.length);

  row.querySelectorAll(".memory-tile").forEach(tile => tile.remove());

  const tiles = [];
  for (let i = 0; i < wanted; i++) {
    const tile = document.createElement("div");
    tile.className = "memory-tile";

    const img = document.createElement("img");
    img.alt = "Wedding memory";
    tile.appendChild(img);
    row.appendChild(tile);
    tiles.push(img);
  }

  let frame = 0;
  const paint = () => {
    tiles.forEach((img, i) => {
      img.src = images[(frame + i) % images.length];
    });
  };

  paint();

  if (images.length > 1) {
    setInterval(() => {
      frame = (frame + 1) % images.length;
      paint();
    }, ROTATION_MS);
  }

  return true;
}

async function unlockPage() {
  const password = document.getElementById("site-password")?.value.trim() || "";
  const status = document.getElementById("pass-status");

  if (!password) {
    setStatus("Enter a password.", false);
    return;
  }

  let success = 0;

  for (const node of document.querySelectorAll("[data-encrypted]")) {
    const payload = JSON.parse(node.dataset.encrypted);
    const value = await decryptData(payload, password);

    if (value !== null) {
      node.textContent = value;
      success++;
    }
  }

  for (const node of document.querySelectorAll("[data-encrypted-img]")) {
    const payload = JSON.parse(node.dataset.encryptedImg);
    const value = await decryptData(payload, password);

    if (value !== null) {
      node.src = source(value);
      success++;
    }
  }

  for (const stack of document.querySelectorAll(".encrypted-image-stack")) {
    const payload = payloadFrom(stack);
    if (payload && (await decryptData(payload, password) !== null)) {
      success++;
      startImageStack(stack);
    }
  }

  for (const script of document.querySelectorAll("script[type='application/json']")) {
    if (await decryptStack(script, password)) {
      success++;
    }
  }

  if (success > 0) {
    showProtectedContent();
    setStatus("Unlocked!", true);
    sessionStorage.setItem(PASS_KEY, password);
    sessionStorage.setItem(STORY_UNLOCKED_KEY, "true");
  } else {
    hideProtectedContent();
    setStatus("Incorrect password or invalid payload.", false);
  }
}

function initPage() {
  hideProtectedContent();

  const savedPassword = sessionStorage.getItem(PASS_KEY);
  const sitePasswordInput = document.getElementById("site-password");

  if (sitePasswordInput && savedPassword) {
    sitePasswordInput.value = savedPassword;
  }

  document.querySelectorAll(".encrypted-image-stack").forEach(startImageStack);

  const unlocked = sessionStorage.getItem(STORY_UNLOCKED_KEY) === "true";
  if (unlocked && savedPassword) {
    unlockPage();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initPage();

  const unlockButton = document.querySelector('button[onclick="unlockPage()"]');
  if (unlockButton) {
    unlockButton.addEventListener("click", unlockPage);
  }

  const passwordInput = document.getElementById("site-password");
  if (passwordInput) {
    passwordInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        unlockPage();
      }
    });
  }
});
