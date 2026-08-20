import { Resend } from 'resend';

/**
 * Transactional email.
 *
 * Provisioned through the Vercel Marketplace, so the key arrives as an
 * environment variable rather than being configured by hand. Without one the
 * app still runs and simply logs what it would have sent — losing an
 * invitation email should not take the workspace down with it.
 */
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Circle <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(input: {
   to: string;
   subject: string;
   text: string;
   html?: string;
}): Promise<void> {
   if (!resend) {
      console.warn(
         `[email] RESEND_API_KEY is not set — would have sent "${input.subject}" to ${input.to}`
      );
      return;
   }

   const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
   });

   if (error) throw new Error(`Could not send "${input.subject}": ${error.message}`);
}

/** The invitation email. Plain and short — it exists to carry one link. */
export function invitationEmail(input: {
   inviterName: string;
   organizationName: string;
   acceptUrl: string;
}): { subject: string; text: string; html: string } {
   const subject = `${input.inviterName} invited you to ${input.organizationName}`;
   const text = [
      `${input.inviterName} invited you to join ${input.organizationName} on Circle.`,
      '',
      `Accept the invitation: ${input.acceptUrl}`,
      '',
      'If you were not expecting this, you can ignore it.',
   ].join('\n');

   const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111">
        <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join
           <strong>${escapeHtml(input.organizationName)}</strong> on Circle.</p>
        <p><a href="${input.acceptUrl}"
              style="display:inline-block;background:#5e6ad2;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
           Accept the invitation</a></p>
        <p style="color:#666;font-size:13px">If you were not expecting this, you can ignore it.</p>
      </div>`;

   return { subject, text, html };
}

function escapeHtml(value: string): string {
   return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
         case '&':
            return '&amp;';
         case '<':
            return '&lt;';
         case '>':
            return '&gt;';
         case '"':
            return '&quot;';
         default:
            return '&#39;';
      }
   });
}
