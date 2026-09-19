const SALT = "WeddingSalt2026";
const ROTATION_MS = 1000;

async function getCryptoKey(password, salt = SALT) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
function bytes(value) {
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function decryptData(payload, password) {
  try {
    if (!payload || !payload.iv || !payload.data) return null;
    const key = await getCryptoKey(password, payload.salt || SALT);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(payload.iv) }, key, bytes(payload.data));
    return new TextDecoder().decode(plain);
  } catch (_) { return null; }
}
function source(value) {
  const text = value.trim();
  if (!text) return null;
  return text.startsWith("data:image/") ? text : `data:image/jpeg;base64,${text.replace(/\s/g, "")}`;
}
function payloadFrom(script) {
  try {
    const text = script.textContent.trim();
    return text.includes("PASTE_IV_BASE64_HERE") ? null : JSON.parse(text);
  } catch (_) { return null; }
}
async function decryptStack(script, password) {
  const text = await decryptData(payloadFrom(script), password);
  if (text === null) return false;
  let values;
  try { const parsed = JSON.parse(text); values = Array.isArray(parsed) ? parsed : [text]; }
  catch (_) { values = text.split(/\r?\n/); }
  const images = values.map(source).filter(Boolean);
  if (!images.length) return false;
  const row = script.parentElement;
  const mode = row.dataset.repeat === "fill" ? "fill" : "fixed";
  const wanted = mode === "fill" ? Math.max(1, Math.ceil(row.clientWidth / 192)) : Math.max(1, Number(row.dataset.count) || images.length);
  row.querySelectorAll(".memory-tile").forEach(tile => tile.remove());
  const tiles = [];
  for (let i = 0; i < wanted; i++) {
    const tile = document.createElement("div"); tile.className = "memory-tile";
    const img = document.createElement("img"); img.alt = "Wedding memory"; tile.appendChild(img); row.appendChild(tile); tiles.push(img);
  }
  let frame = 0;
  const paint = () => tiles.forEach((img, i) => { img.src = images[(frame + i) % images.length]; });
  paint();
  if (images.length > 1) setInterval(() => { frame = (frame + 1) % images.length; paint(); }, ROTATION_MS);
  if (mode === "fill") window.addEventListener("resize", () => {
    const needed = Math.max(1, Math.ceil(row.clientWidth / 192));
    if (needed !== tiles.length) location.reload();
  }, { once: true });
  return true;
}
async function unlockPage() {
  const password = document.getElementById("site-password").value;
  const status = document.getElementById("pass-status");
  if (!password) { status.textContent = " Enter a password."; status.style.color = "red"; return; }
  let success = 0;
  for (const node of document.querySelectorAll("[data-encrypted]")) { const value = await decryptData(JSON.parse(node.dataset.encrypted), password); if (value !== null) { node.textContent = value; success++; } }
  for (const node of document.querySelectorAll("[data-encrypted-img]")) { const value = await decryptData(JSON.parse(node.dataset.encryptedImg), password); if (value !== null) { node.src = source(value); success++; } }
  for (const stack of document.querySelectorAll(".encrypted-image-stack")) if (await decryptStack(stack, password)) success++;
  status.textContent = success ? " Unlocked!" : " Incorrect password or invalid payload.";
  status.style.color = success ? "green" : "red";
  if (success) sessionStorage.setItem("weddingPass", password);
}
window.addEventListener("DOMContentLoaded", () => { const pass = sessionStorage.getItem("weddingPass"); if (pass) { document.getElementById("site-password").value = pass; unlockPage(); } });
