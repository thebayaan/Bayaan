import * as Postmark from 'postmark';
import Constants from 'expo-constants';

const POSTMARK_API_KEY = Constants.expoConfig?.extra?.postmarkApiKey;
const POSTMARK_FROM_EMAIL = Constants.expoConfig?.extra?.postmarkFromEmail;
const POSTMARK_TEMPLATE_ALIAS = 'email-verification-bayaan-1';

function createClient() {
  if (!POSTMARK_API_KEY || !POSTMARK_FROM_EMAIL) {
    throw new Error('Postmark email configuration is incomplete');
  }

  return new Postmark.ServerClient(POSTMARK_API_KEY);
}

export async function sendVerificationEmail(
  to: string,
  verificationCode: string,
) {
  try {
    await createClient().sendEmailWithTemplate({
      From: POSTMARK_FROM_EMAIL,
      To: to,
      TemplateAlias: POSTMARK_TEMPLATE_ALIAS,
      TemplateModel: {
        verification_code: verificationCode,
        product_name: 'Bayaan',
      },
    });
    if (__DEV__) {
      console.log('Verification email sent successfully');
    }
  } catch (error) {
    console.error('Error sending verification email', error);
    throw error;
  }
}
