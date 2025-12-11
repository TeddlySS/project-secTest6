// oauth-callback.js
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

// Show error
function showError(message) {
  const loadingContainer = document.getElementById("loadingContainer");
  const errorContainer = document.getElementById("errorContainer");
  const errorMessage = document.getElementById("errorMessage");

  if (loadingContainer) loadingContainer.style.display = "none";
  if (errorContainer) errorContainer.style.display = "block";
  if (errorMessage) errorMessage.textContent = message;
}

// Main OAuth callback handler
async function handleOAuthCallback() {
  try {
    console.log("[OAuth Callback] Starting...");

    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[OAuth Callback] Session error:", sessionError);
      showError("ไม่สามารถตรวจสอบ session ได้: " + sessionError.message);
      return;
    }

    if (!sessionData.session) {
      console.error("[OAuth Callback] No session found");
      showError("ไม่พบ session กรุณาลองเข้าสู่ระบบอีกครั้ง");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return;
    }

    const user = sessionData.session.user;
    console.log("[OAuth Callback] User authenticated:", user.id);

    // Check if user exists in users table
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[OAuth Callback] Database error:", fetchError);
      showError("เกิดข้อผิดพลาดในการตรวจสอบข้อมูล: " + fetchError.message);
      return;
    }

    // Case 1: New user - need to set username
    if (!existingUser) {
      console.log("[OAuth Callback] New user detected, redirecting to username setup");
      // Store email temporarily for username setup page
      sessionStorage.setItem("oauthEmail", user.email);
      sessionStorage.setItem("oauthProvider", "google");
      
      // Store user metadata
      if (user.user_metadata) {
        sessionStorage.setItem("oauthMetadata", JSON.stringify(user.user_metadata));
      }
      
      window.location.href = "username-setup.html";
      return;
    }

    // Case 2: Existing user with username - check if username exists
    if (!existingUser.username) {
      console.log("[OAuth Callback] User exists but no username, redirecting to username setup");
      sessionStorage.setItem("oauthEmail", user.email);
      sessionStorage.setItem("oauthProvider", "google");
      
      if (user.user_metadata) {
        sessionStorage.setItem("oauthMetadata", JSON.stringify(user.user_metadata));
      }
      
      window.location.href = "username-setup.html";
      return;
    }

    // Case 3: User has username - proceed to home
    console.log("[OAuth Callback] User has username, proceeding to home");
    
    // Store current user data
    localStorage.setItem("currentUser", JSON.stringify(existingUser));

    // Redirect to home
    window.location.href = "home.html";

  } catch (error) {
    console.error("[OAuth Callback] Unexpected error:", error);
    showError("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + error.message);
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  handleOAuthCallback();
});
