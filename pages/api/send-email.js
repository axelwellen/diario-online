import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY); // ✅ Asegurar que está en Vercel

//const resend = new Resend('re_5V3yS2kd_PzxYFAPZWp2vZZ5PziGMzBTU'); // ✅ 

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
        from: 'Acme <onboarding@resend.dev>',
        to,
      subject,
      html: `<p>${message}</p>`,
    });

    return res.status(200).json({ success: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: error.message });
  }
}
