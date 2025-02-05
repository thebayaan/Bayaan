/**
 * Validates an email address.
 * @param email The email address to validate.
 * @returns True if the email is valid, false otherwise.
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Checks if a password meets the minimum length requirement.
 * @param password The password to check.
 * @param minLength The minimum required length (default is 8).
 * @returns True if the password meets the minimum length, false otherwise.
 */
export const isValidPassword = (password: string, minLength = 8): boolean => {
  return password.length >= minLength;
};
