import express from "express";
import { auth, firestore, admin } from "../lib/firebase/config";
import { generateOTP } from "../functions/helper";
import { sendApproveEmail } from "../lib/resend/config";
import { formatName } from "../functions/helper";

const router = express.Router();

// Login Account
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

    if (!FIREBASE_API_KEY) {
      console.error("FIREBASE_API_KEY not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Verify password with Firebase Auth REST API
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password: password,
          returnSecureToken: true,
        }),
      }
    );

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      const errorCode = authData.error?.message;

      // Log the actual error for debugging
      console.log("Firebase Auth Error:", errorCode);

      switch (errorCode) {
        // Invalid credentials
        case "INVALID_PASSWORD":
        case "EMAIL_NOT_FOUND":
        case "INVALID_EMAIL":
          return res.status(401).json({ error: "Invalid credentials" });

        // Account issues
        case "USER_DISABLED":
          return res.status(403).json({
            error: "Account has been disabled",
          });

        // Rate limiting
        case "TOO_MANY_ATTEMPTS_TRY_LATER":
          return res.status(429).json({
            error: "Too many attempts. Try again later.",
          });

        // Missing password
        case "MISSING_PASSWORD":
          return res.status(400).json({
            error: "Password is required",
          });

        // Weak password (shouldn't happen on login, but just in case)
        case "WEAK_PASSWORD":
          return res.status(400).json({
            error: "Password is too weak",
          });

        // Invalid API key
        case "INVALID_API_KEY":
        case "API_KEY_INVALID":
          console.error("Invalid Firebase API Key!");
          return res.status(500).json({
            error: "Server configuration error",
          });

        // Operation not allowed
        case "OPERATION_NOT_ALLOWED":
          return res.status(403).json({
            error: "Email/password authentication is not enabled",
          });

        // Network or unknown errors
        case "NETWORK_REQUEST_FAILED":
          return res.status(503).json({
            error: "Network error. Please try again.",
          });

        // Fallback for any other error
        default:
          console.error("Unhandled Firebase Auth Error:", errorCode);
          return res.status(400).json({
            error: "Invalid email or password",
          });
      }
    }

    const { localId } = authData;

    // Get user from Firestore
    const userDoc = await firestore.collection("users").doc(localId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Account not found" });
    }

    const userData = userDoc.data();

    if (!userData) {
      return res.status(404).json({ error: "User data not found" });
    }

    // Check account status
    const statusErrors: Record<string, string> = {
      blocked: "Your account has been blocked.",
      pending: "Your account is pending approval.",
      rejected: "Your registration was not approved.",
    };

    if (userData.status !== "approved") {
      const errorMessage =
        statusErrors[userData.status] || "Account not accessible";
      return res.status(403).json({ error: errorMessage });
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(localId, {
      role: userData.role,
      status: userData.status,
    });

    res.json({
      success: true,
      token: customToken,
      user: {
        uid: userData.uid,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Block Account
router.post("/blockUser/:userId", async (req, res) => {
  const { userId } = req.params;
  const { adminId } = req.body; // Who blocked them

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    // 1. Update Firestore status
    await firestore.collection("users").doc(userId).update({
      status: "blocked",
      blockedAt: admin.firestore.FieldValue.serverTimestamp(),
      blockedBy: adminId,
    });

    // 2. Update custom claims (token becomes aware of block)
    await admin.auth().setCustomUserClaims(userId, {
      status: "blocked",
      role: null, // Remove role privileges
    });

    // 3. 🔥 CRITICAL: Revoke all refresh tokens
    // This forces logout on ALL devices immediately
    await admin.auth().revokeRefreshTokens(userId);

    console.log(`✅ User ${userId} blocked and logged out from all devices`);

    res.json({
      success: true,
      message: "User blocked and logged out from all devices",
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Failed to block user" });
  }
});

// Unblock Account
router.post("/unblockUser/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    // Get user data to restore role
    const userDoc = await firestore.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();

    // 1. Update Firestore
    await firestore.collection("users").doc(userId).update({
      status: "approved",
      unblockedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Restore custom claims
    await admin.auth().setCustomUserClaims(userId, {
      status: "approved",
      role: userData?.role || "user",
    });

    console.log(`✅ User ${userId} unblocked`);

    res.json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

router.post("/registerUser", async (req, res) => {
  const { fullName, email, phoneNumber } = req.body;

  if (!fullName || !email || !phoneNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const tempPassword = Math.random().toString(36).slice(-8);

    const userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: fullName,
      disabled: false,
    });

    await firestore.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      fullName,
      phoneNumber, // Add this
      role: "user",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedPassword: null,
      passwordChanged: false,
      tempPassword,
    });

    res.json({
      message: "User created successfully",
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: message });
  }
});

//Check Registration Status
router.post("/registrationStatus", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const querySnapshot = await firestore
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        status: "not_found",
        error: "No account found with this email",
      });
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    return res.json({
      status: data.status,
      email: data.email,
      createdAt: data.createdAt?.toDate() ?? null,
      approvedAt: data.approvedAt?.toDate() ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Approver Account
router.post("/approveUser/:userId", async (req, res) => {
  const { userId } = req.params;
  const { adminId } = req.body;

  try {
    const otp = generateOTP();

    // Update Firebase Auth password
    await auth.updateUser(userId, { password: otp });

    // Get user data from Firestore
    const userDoc = await firestore.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    const fullName = formatName(userData?.fullName || "User");
    const userEmail = userData?.email;

    if (!userEmail) {
      return res.status(400).json({ error: "User email not found" });
    }

    // Update Firestore user document
    await firestore.collection("users").doc(userId).update({
      status: "approved",
      generatedPassword: otp,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: adminId,
    });

    // Send Email and WAIT for it to complete
    try {
      await sendApproveEmail(fullName, otp, userEmail);
      console.log(`✅ Approval email sent successfully to ${userEmail}`);
    } catch (emailError) {
      // Log email error but don't fail the approval
      console.error("❌ Failed to send approval email:", emailError);
      // Optionally: You could still return success but notify about email failure
      return res.json({
        success: true,
        fullName,
        emailSent: false,
        warning: "User approved but email notification failed",
      });
    }

    res.json({ success: true, fullName, emailSent: true });
  } catch (error) {
    console.error("Error approving user:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);
    res.status(500).json({ error: message });
  }
});

// Delete User
router.delete("/deleteUser/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Delete from Firestore
    await firestore.collection("users").doc(userId).delete();

    // Delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
      uid: userId,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: message });
  }
});

export default router;
