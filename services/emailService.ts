import * as Postmark from 'postmark';
import Constants from 'expo-constants';

const POSTMARK_API_KEY = Constants.expoConfig?.extra?.postmarkApiKey;
const POSTMARK_FROM_EMAIL = Constants.expoConfig?.extra?.postmarkFromEmail;

const client = new Postmark.ServerClient(POSTMARK_API_KEY);

const POSTMARK_TEMPLATE_ALIAS = 'email-verification-bayaan';

export async function sendVerificationEmail(
  to: string,
  verificationCode: string,
) {
  try {
    // Check if the 'to' email is on the same domain as POSTMARK_FROM_EMAIL
    const fromDomain = POSTMARK_FROM_EMAIL.split('@')[1];
    const toDomain = to.split('@')[1];

    if (fromDomain !== toDomain && !__DEV__) {
      console.log(
        `Test mode: Cannot send to ${to}. Logging verification code instead.`,
      );
      console.log(`Verification code for ${to}: ${verificationCode}`);
      return;
    }

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
