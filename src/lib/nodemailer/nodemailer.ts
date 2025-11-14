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

  // Replace placeholders dynamically
  htmlTemplate = htmlTemplate.replace("{{name}}", name);
  htmlTemplate = htmlTemplate.replace("{{password}}", password);

  //Setup Nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD, // Use App Password if 2FA is on
    },
  });

  //Compose Email
  const mailOptions = {
    from: `"Barcoin" ${process.env.GMAIL_USER}`,
    to: email,
    subject: "Account Approved - BARCOIN",
    html: htmlTemplate,
  };

  //Send Email
  transporter.sendMail(mailOptions, (error: any, info: any) => {
    if (error) {
      return console.log("Error:", error);
    }
    console.log("Email sent:", info.response);
  });
};
