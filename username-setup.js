// username-setup.js
import { supabase } from "./supabaseClient.js";

// Particles effect
function createParticles() {
  const container = document.getElementById("particles");
  if (!container) return;

  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 15 + "s";
    p.style.animationDuration = Math.random() * 10 + 10 + "s";
    container.appendChild(p);
  }
}

// State
let checkTimeout = null;
let isChecking = false;

// Show error message
function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  }
}

// Validate username format
function validateUsernameFormat(username) {
  const regex = /^[a-zA-Z0-9_]{3,20}$/;
  
  if (!username) {
    return { valid: false, message: "กรุณากรอก username" };
  }
  
  if (username.length < 3) {
    return { valid: false, message: "Username ต้องมีอย่างน้อย 3 ตัวอักษร" };
  }
  
  if (username.length > 20) {
    return { valid: false, message: "Username ต้องไม่เกิน 20 ตัวอักษร" };
  }
  
  if (!regex.test(username)) {
    return { valid: false, message: "Username ใช้ได้เฉพาะ a-z, A-Z, 0-9, และ _" };
  }
  
  return { valid: true };
}

// Check if username is available
async function checkUsernameAvailability(username) {
  const statusDiv = document.getElementById("usernameStatus");
  const submitBtn = document.getElementById("submitBtn");

  if (!statusDiv || !submitBtn) return;

  // Validate format first
  const validation = validateUsernameFormat(username);
  if (!validation.valid) {
    statusDiv.className = "username-status taken";
    statusDiv.textContent = validation.message;
    submitBtn.disabled = true;
    return;
  }

  // Show checking state
  statusDiv.className = "username-status checking";
  statusDiv.textContent = "⏳ กำลังตรวจสอบ...";
  submitBtn.disabled = true;
  isChecking = true;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data) {
      statusDiv.className = "username-status taken";
      statusDiv.textContent = "❌ Username นี้ถูกใช้งานแล้ว";
      submitBtn.disabled = true;
    } else {
      statusDiv.className = "username-status available";
      statusDiv.textContent = "✅ Username นี้ว่างและใช้งานได้";
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error("Check username error:", error);
    statusDiv.className = "username-status taken";
    statusDiv.textContent = "⚠️ ไม่สามารถตรวจสอบได้ กรุณาลองใหม่";
    submitBtn.disabled = true;
  } finally {
    isChecking = false;
  }
}

// Handle username input with debounce
function handleUsernameInput(event) {
  const username = event.target.value.trim();
  const submitBtn = document.getElementById("submitBtn");

  // Clear previous timeout
  if (checkTimeout) {
    clearTimeout(checkTimeout);
  }

  // Disable submit while typing
  if (submitBtn) submitBtn.disabled = true;

  // If empty, reset status
  if (!username) {
    const statusDiv = document.getElementById("usernameStatus");
    if (statusDiv) {
      statusDiv.style.display = "none";
      statusDiv.textContent = "";
    }
    return;
  }

  // Check after 500ms delay
  checkTimeout = setTimeout(() => {
    checkUsernameAvailability(username);
  }, 500);
}

// Create user record in database
async function createUserRecord(email, username, metadata = {}) {
  try {
    // Get current auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("ไม่พบข้อมูล user authentication");
    }

    // Prepare user data
    const userData = {
      email: email,
      username: username,
      display_name: metadata.full_name || metadata.name || username,
      avatar: metadata.avatar_url || metadata.picture || null,
      auth_provider: "google",
      auth_user_id: user.id, 
      created_at: new Date().toISOString()
    };

    console.log("[Username Setup] Creating user record:", userData);

    // Insert into users table
    const { data, error } = await supabase
      .from("users")
      .insert([userData])
      .select()
      .single();

    if (error) {
      console.error("[Username Setup] Insert error:", error);
      throw error;
    }

    console.log("[Username Setup] User record created:", data);
    return data;

  } catch (error) {
    console.error("[Username Setup] Create user error:", error);
    throw error;
  }
}

// Update existing user record with username
async function updateUserRecord(email, username) {
  try {
    const { data, error } = await supabase
      .from("users")
      .update({ username: username })
      .eq("email", email)
      .select()
      .single();

    if (error) {
      console.error("[Username Setup] Update error:", error);
      throw error;
    }

    console.log("[Username Setup] User record updated:", data);
    return data;

  } catch (error) {
    console.error("[Username Setup] Update user error:", error);
    throw error;
  }
}

// Handle form submission
async function handleSubmit(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const submitBtn = document.getElementById("submitBtn");

  if (!usernameInput || !submitBtn) return;

  const username = usernameInput.value.trim();

  // Validate format
  const validation = validateUsernameFormat(username);
  if (!validation.valid) {
    showError(validation.message);
    return;
  }

  // Get OAuth data from sessionStorage
  const email = sessionStorage.getItem("oauthEmail");
  const metadataStr = sessionStorage.getItem("oauthMetadata");
  
  if (!email) {
    showError("ไม่พบข้อมูล OAuth session กรุณาลองเข้าสู่ระบบใหม่");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  const metadata = metadataStr ? JSON.parse(metadataStr) : {};

  // Disable submit button
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "กำลังสร้างบัญชี...";

  try {
    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw fetchError;
    }

    let userData;

    if (existingUser) {
      // Update existing user
      console.log("[Username Setup] Updating existing user");
      userData = await updateUserRecord(email, username);
    } else {
      // Create new user
      console.log("[Username Setup] Creating new user");
      userData = await createUserRecord(email, username, metadata);
    }

    // Store user data in localStorage
    localStorage.setItem("currentUser", JSON.stringify(userData));

    // Clear sessionStorage
    sessionStorage.removeItem("oauthEmail");
    sessionStorage.removeItem("oauthProvider");
    sessionStorage.removeItem("oauthMetadata");

    // Show success message
    submitBtn.textContent = "✓ สำเร็จ! กำลังพาคุณเข้าสู่ระบบ...";
    submitBtn.style.background = "linear-gradient(135deg, #4caf50, #8bc34a)";

    // Redirect to home
    setTimeout(() => {
      window.location.href = "home.html";
    }, 1500);

  } catch (error) {
    console.error("[Username Setup] Submit error:", error);
    
    let errorMessage = "เกิดข้อผิดพลาดในการสร้างบัญชี";
    
    if (error.code === "23505") {
      errorMessage = "Username นี้ถูกใช้งานแล้ว กรุณาเลือก username อื่น";
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    showError(errorMessage);
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Initialize page
async function initializePage() {
  const email = sessionStorage.getItem("oauthEmail");
  
  if (!email) {
    console.error("[Username Setup] No OAuth email found");
    showError("ไม่พบข้อมูล OAuth session กรุณาลองเข้าสู่ระบบใหม่");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  // Display email
  const emailDisplay = document.getElementById("userEmail");
  if (emailDisplay) {
    emailDisplay.textContent = email;
  }

  // Setup event listeners
  const usernameInput = document.getElementById("username");
  const form = document.getElementById("usernameForm");

  if (usernameInput) {
    usernameInput.addEventListener("input", handleUsernameInput);
    // Focus on username input
    setTimeout(() => usernameInput.focus(), 300);
  }

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }
}

// DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  initializePage();
});
