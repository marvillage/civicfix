import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string
) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log(
      `Email skipped (EMAIL_* env not configured): to=${to} subject="${subject}"`
    );
    return;
  }

  try {
    await mailer.sendMail({
      from:
        process.env.EMAIL_FROM ??
        `CivicFix <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("Email send failed:", error);
  }
}
