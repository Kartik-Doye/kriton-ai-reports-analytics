import 'dotenv/config';
import nodemailer from 'nodemailer';

async function main() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'Test Email',
      text: 'This is a test email.',
    });
    console.log("Success");
  } catch(e) {
    console.error("Error:", e);
  }
}
main();
