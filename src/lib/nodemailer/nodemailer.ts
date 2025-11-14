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
