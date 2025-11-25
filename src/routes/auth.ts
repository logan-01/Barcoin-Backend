import express from "express";
import { auth, firestore, admin } from "../lib/firebase/config";
import { generateOTP } from "../functions/helper";
import { sendApproveEmail } from "../lib/resend/config";
import { formatName } from "../functions/helper";

const router = express.Router();

//Register Account
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
