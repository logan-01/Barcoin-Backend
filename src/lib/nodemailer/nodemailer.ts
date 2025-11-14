import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendApproveEmail = async (
  name: string,
  password: string,
  email: string
) => {
  const filePath = path.join(__dirname, "../../html/emailTemplate.html");
  let htmlTemplate = fs.readFileSync(filePath, "utf-8");

  htmlTemplate = htmlTemplate.replace("{{name}}", name);
  htmlTemplate = htmlTemplate.replace("{{password}}", password);

  try {
    const data = await resend.emails.send({
      from: "Barcoin <onboarding@resend.dev>",
      to: email,
      subject: "Account Approved - BARCOIN",
      html: htmlTemplate,
    });

    console.log("Email sent:", data);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
