// Decryption and Shared Navigation Logic

// Key Derivation Helper using PBKDF2
async function getCryptoKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

// AES-256-GCM Decryption Function
async function decryptData(encryptedJsonObject, password) {
  try {
    const salt = "WeddingSalt2026"; // Fixed Salt for Key Derivation
    const key = await getCryptoKey(password, salt);
    
    const iv = new Uint8Array(atob(encryptedJsonObject.iv).split("").map(c => c.charCodeAt(0)));
    const cipherText = new Uint8Array(atob(encryptedJsonObject.data).split("").map(c => c.charCodeAt(0)));

    const decryptedContent = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      cipherText
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedContent);
  } catch (e) {
    return null; // Return null on wrong password/failure
  }
}

// Master Function to Trigger Decryption Across the Page
async function unlockPage() {
  const passwordInput = document.getElementById('site-password').value;
  const statusEl = document.getElementById('pass-status');

  // 1. Decrypt Text Nodes
  const encryptedTextNodes = document.querySelectorAll('[data-encrypted]');
  let successCount = 0;

  for (let el of encryptedTextNodes) {
    const rawData = JSON.parse(el.getAttribute('data-encrypted'));
    const decryptedText = await decryptData(rawData, passwordInput);
    
    if (decryptedText !== null) {
      el.textContent = decryptedText;
      successCount++;
    }
  }

  // 2. Decrypt Encrypted Images
  const encryptedImgNodes = document.querySelectorAll('[data-encrypted-img]');
  for (let img of encryptedImgNodes) {
    const rawData = JSON.parse(img.getAttribute('data-encrypted-img'));
    const decryptedBase64 = await decryptData(rawData, passwordInput);
    
    if (decryptedBase64 !== null) {
      img.src = decryptedBase64;
    }
  }

  // 3. Decrypt Form Actions / Mailto / Hotlinks
  const encryptedLinks = document.querySelectorAll('[data-encrypted-href]');
  for (let a of encryptedLinks) {
    const rawData = JSON.parse(a.getAttribute('data-encrypted-href'));
    const decryptedUrl = await decryptData(rawData, passwordInput);
    
    if (decryptedUrl !== null) {
      a.href = decryptedUrl;
    }
  }

  const encryptedForms = document.querySelectorAll('[data-encrypted-action]');
  for (let form of encryptedForms) {
    const rawData = JSON.parse(form.getAttribute('data-encrypted-action'));
    const decryptedAction = await decryptData(rawData, passwordInput);
    
    if (decryptedAction !== null) {
      form.action = decryptedAction;
    }
  }

  if (successCount > 0 || encryptedTextNodes.length === 0) {
    statusEl.textContent = "Unlocked!";
    statusEl.style.color = "green";
    sessionStorage.setItem('weddingPass', passwordInput); // Retain password during session
  } else {
    statusEl.textContent = "Incorrect password.";
    statusEl.style.color = "red";
  }
}

// Auto-unlock if password is saved in session
window.addEventListener('DOMContentLoaded', () => {
  const savedPass = sessionStorage.getItem('weddingPass');
  if (savedPass) {
    document.getElementById('site-password').value = savedPass;
    unlockPage();
  }
});
