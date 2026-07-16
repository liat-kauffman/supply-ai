import { Resend } from "resend";

interface AuthEmail {
  to: string;
  subject: string;
  actionUrl: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export async function sendAuthEmail(email: AuthEmail): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const from = process.env.AUTH_EMAIL_FROM;
    if (!from && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_EMAIL_FROM is required for Resend in production");
    }

    const resend = new Resend(resendApiKey);
    const actionUrl = escapeHtml(email.actionUrl);
    const { error } = await resend.emails.send({
      from: from ?? "Supplying <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#18211e">
          <p style="font-size:20px;font-weight:700;color:#173f35">Supplying</p>
          <h1 style="font-size:24px">${escapeHtml(email.subject)}</h1>
          <p style="line-height:1.6;color:#5f6964">Use the secure link below to continue. If you did not request this, you can ignore this email.</p>
          <p style="margin:28px 0">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#173f35;color:#fff;text-decoration:none;font-weight:700">Continue to Supplying</a>
          </p>
          <p style="font-size:12px;color:#7d8581;word-break:break-all">${actionUrl}</p>
        </div>
      `,
      text: `${email.subject}\n\nContinue to Supplying: ${email.actionUrl}\n\nIf you did not request this, ignore this email.`,
    });

    if (error)
      throw new Error(
        `Resend could not send authentication email: ${error.message}`,
      );
    return;
  }

  const webhookUrl = process.env.AUTH_EMAIL_WEBHOOK_URL;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(email),
    });
    if (!response.ok)
      throw new Error(`Auth email provider returned ${response.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RESEND_API_KEY or AUTH_EMAIL_WEBHOOK_URL is required to send authentication email in production",
    );
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "auth.email.development",
      ...email,
    }),
  );
}
