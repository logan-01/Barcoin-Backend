import fs from "fs";
import path from "path";
import dotenv from "dotenv";
const nodemailer = require("nodemailer");

dotenv.config();

export const sendApproveEmail = (
  name: string,
  password: string,
  email: string
) => {
  const filePath = path.join(__dirname, "../../html/emailTemplate.html");
  let htmlTemplate = fs.readFileSync(filePath, "utf-8");

  htmlTemplate = htmlTemplate.replace("{{name}}", name);
  htmlTemplate = htmlTemplate.replace("{{password}}", password);

  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_HOST, // smtp.gmail.com
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD, // Gmail App Password ONLY
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    socketTimeout: 20000,
  });

  const mailOptions = {
    from: `"Barcoin" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Account Approved - BARCOIN",
    html: htmlTemplate,
  };

  transporter.sendMail(mailOptions, (error: any, info: any) => {
    if (error) {
      console.log("Error:", error);
      return;
    }
    console.log("Email sent:", info.response);
  });
};
