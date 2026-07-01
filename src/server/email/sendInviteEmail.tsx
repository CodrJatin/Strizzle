import { Resend } from 'resend';
import { InviteEmail } from './InviteEmail';
import * as React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

interface SendInviteEmailInput {
  toEmail: string;
  hiveName: string;
  role: string;
  inviteUrl: string;
}

export async function sendInviteEmail({
  toEmail,
  hiveName,
  role,
  inviteUrl,
}: SendInviteEmailInput) {
  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const data = await resend.emails.send({
      from: `Strizzle Invites <${fromAddress}>`,
      to: toEmail,
      subject: `Join ${hiveName} on Strizzle`,
      react: <InviteEmail hiveName={hiveName} role={role} inviteUrl={inviteUrl} />,
    });

    return data;
  } catch (error) {
    console.error('Error sending invite email:', error);
    throw error;
  }
}
