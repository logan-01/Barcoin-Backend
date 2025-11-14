import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const nodemailer = require("nodemailer");

dotenv.config();

export const sendApproveEmail = async (
  name: string,
  password: string,
  email: string
): Promise<void> => {
  // Validate environment variables
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      "Missing required email configuration environment variables"
    );
  }

  const filePath = path.join(__dirname, "../../html/emailTemplate.html");
  let htmlTemplate = fs.readFileSync(filePath, "utf-8");

  // Replace placeholders dynamically
  htmlTemplate = htmlTemplate.replace("{{name}}", name);
  htmlTemplate = htmlTemplate.replace("{{password}}", password);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: "barcoinapp@gmail.com",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
  });

  // Compose Email
  const mailOptions = {
    from: `"Barcoin" <barcoinapp@gmail.com>`,
    to: email,
    subject: "Account Approved - BARCOIN",
    html: htmlTemplate,
  };

  // Send Email with Promise
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error: any, info: any) => {
      if (error) {
        console.error("Email Error:", error);
        reject(error);
      } else {
        console.log("Email sent:", info.response);
        resolve();
      }
    });
  });
};
