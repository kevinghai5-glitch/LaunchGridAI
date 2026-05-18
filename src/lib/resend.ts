import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "proposals@yourdomain.com";

export interface SendProposalEmailParams {
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  proposalTitle: string;
  proposalUrl: string;
  senderName: string;
  monthlyPrice: number;
}

export async function sendProposalEmail({
  recipientEmail,
  recipientName,
  businessName,
  proposalTitle,
  proposalUrl,
  senderName,
  monthlyPrice,
}: SendProposalEmailParams) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: recipientEmail,
    subject: `${proposalTitle} — Proposal for ${businessName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${proposalTitle}</title>
</head>
<body style="background:#0A0B0F;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:48px 24px;">
    <div style="background:#0F1424;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;">
      <h1 style="font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px;">${proposalTitle}</h1>
      <p style="color:#9CA3AF;margin:0 0 32px;">Prepared for ${businessName}</p>

      <p style="color:#e5e7eb;line-height:1.6;margin:0 0 16px;">Hi ${recipientName},</p>
      <p style="color:#e5e7eb;line-height:1.6;margin:0 0 32px;">
        ${senderName} has sent you a professional proposal. Review the complete package overview, deliverables, and pricing at the link below.
      </p>

      <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:24px;margin:0 0 32px;">
        <p style="color:#9CA3AF;font-size:14px;margin:0 0 4px;">Monthly Investment</p>
        <p style="color:#3B82F6;font-size:32px;font-weight:700;margin:0;">$${monthlyPrice}/mo</p>
      </div>

      <a href="${proposalUrl}"
         style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:16px;margin:0 0 32px;">
        View Full Proposal →
      </a>

      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;">
      <p style="color:#6B7280;font-size:12px;margin:0;">
        This proposal was sent via LaunchGrid AI. If you did not expect this email, you may safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  });

  if (error) throw new Error(error.message);
  return data;
}
