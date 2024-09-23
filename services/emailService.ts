import * as Postmark from 'postmark';
import Constants from 'expo-constants';

const POSTMARK_API_KEY = Constants.expoConfig?.extra?.postmarkApiKey;
const POSTMARK_FROM_EMAIL = Constants.expoConfig?.extra?.postmarkFromEmail;

const client = new Postmark.ServerClient(POSTMARK_API_KEY);

const POSTMARK_TEMPLATE_ALIAS = 'email-verification-bayaan-1';

export async function sendVerificationEmail(
  to: string,
  verificationCode: string,
) {
  try {
    await client.sendEmailWithTemplate({
      From: POSTMARK_FROM_EMAIL,
      To: to,
      TemplateAlias: POSTMARK_TEMPLATE_ALIAS,
      TemplateModel: {
        verification_code: verificationCode,
        product_name: 'Bayaan',
      },
    });
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Error sending verification email', error);
    throw error;
  }
}
