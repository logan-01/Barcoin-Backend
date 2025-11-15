import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY!);

export const sendApproveEmail = async (
  name: string,
  password: string,
  email: string
): Promise<void> => {
  const filePath = path.join(__dirname, "../../html/emailTemplate.html");
  let htmlTemplate = fs.readFileSync(filePath, "utf-8");

  // Replace placeholders dynamically
  htmlTemplate = htmlTemplate.replace("{{name}}", name);
  htmlTemplate = htmlTemplate.replace("{{password}}", password);

  try {
    const response = await resend.emails.send({
      from: "Barcoin <no-reply@bananacare.site>", // <- your verified domain
      to: email,
      subject: "Account Approved - BARCOIN",
      html: htmlTemplate,
    });

    if (response.data) {
      console.log("Email sent, ID:", response.data.id);
    }
  } catch (error) {
    console.error("Resend Email Error:", error);
    throw error;
  }
};
