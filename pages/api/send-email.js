import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await resend.emails.send({
      from: "no-reply@tudiario.com",
      to,
      subject,
      html: `<p>${message}</p>`,
    });

    return res.status(200).json({ success: "Email sent successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
