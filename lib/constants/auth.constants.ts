/**
 * Authentication configuration and UI constants
 */

export const AUTH = {
  ERRORS: {
    // Console error prefixes
    SIGN_UP_ERROR: 'Sign up error:',
    LOGIN_ERROR: 'Login error:',
    LOGOUT_ERROR: 'Logout error:',
    RESET_PASSWORD_ERROR: 'Reset password error:',
    UPDATE_PASSWORD_ERROR: 'Update password error:',
    GET_SESSION_ERROR: 'Get session error:',
    GET_USER_ERROR: 'Get user error:',
    UPDATE_METADATA_ERROR: 'Error updating user metadata:',
    CHANGE_PASSWORD_ERROR: 'Error changing password:',
    CHANGE_EMAIL_ERROR: 'Error changing email:',
    REAUTH_ERROR: 'Re-authentication error:',

    // Error messages
    FAILED_SIGN_UP: 'Failed to sign up',
    FAILED_LOGIN: 'Failed to login',
    FAILED_LOGOUT: 'Failed to logout',
    FAILED_RESET_EMAIL: 'Failed to send reset email',
    FAILED_UPDATE_PASSWORD: 'Failed to update password',
    FAILED_GET_SESSION: 'Failed to get session',
    FAILED_GET_USER: 'Failed to get user',
    FAILED_UPDATE_PROFILE: 'Failed to update profile',
    FAILED_CHANGE_PASSWORD: 'Failed to change password',
    FAILED_CHANGE_EMAIL: 'Failed to change email',
    REAUTH_FAILED: 'Re-authentication failed. Please log out and log back in.',

    // Session errors
    AUTH_SESSION_MISSING_ERROR: 'AuthSessionMissingError',
    AUTH_SESSION_MISSING_MESSAGE: 'Auth session missing!',
  },
  LOGIN: {
    TITLE: 'Welcome back',
    DESCRIPTION: 'Enter your credentials to access your account',
    LABELS: {
      EMAIL: 'Email',
      PASSWORD: 'Password',
      FORGOT_PASSWORD: 'Forgot password?',
      NO_ACCOUNT: "Don't have an account?",
      SIGN_UP: 'Sign up',
    },
    BUTTONS: {
      LOGIN: 'Login',
      LOGGING_IN: 'Logging in...',
    },
    PLACEHOLDERS: {
      EMAIL: 'you@example.com',
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to login',
      LOADING: 'Loading...',
    },
  },
  SIGNUP: {
    TITLE: 'Create an account',
    DESCRIPTION: 'Enter your information to create your Finance Tracker account',
    CHECK_EMAIL_TITLE: 'Check your email',
    CHECK_EMAIL_DESC: "We've sent you a verification link. Please check your email to verify your account.",
    LABELS: {
      FIRST_NAME: 'First Name',
      LAST_NAME: 'Last Name',
      EMAIL: 'Email',
      PASSWORD: 'Password',
      CONFIRM_PASSWORD: 'Confirm Password',
      ALREADY_HAVE_ACCOUNT: 'Already have an account?',
      LOGIN: 'Login',
    },
    BUTTONS: {
      SIGN_UP: 'Sign up',
      CREATING_ACCOUNT: 'Creating account...',
    },
    PLACEHOLDERS: {
      FIRST_NAME: 'John',
      LAST_NAME: 'Doe',
      EMAIL: 'you@example.com',
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to sign up',
      SUCCESS_REDIRECT: 'Please check your email to verify your account',
    },
  },
  RESET_PASSWORD: {
    TITLE: 'Reset your password',
    DESCRIPTION: "Enter your email address and we'll send you a link to reset your password",
    CHECK_EMAIL_TITLE: 'Check your email',
    CHECK_EMAIL_DESC: "We've sent you a password reset link. Please check your email and follow the instructions.",
    LABELS: {
      EMAIL: 'Email',
    },
    BUTTONS: {
      SEND_LINK: 'Send reset link',
      SENDING_LINK: 'Sending reset link...',
      BACK_TO_LOGIN: 'Back to login',
    },
    PLACEHOLDERS: {
      EMAIL: 'you@example.com',
    },
    MESSAGES: {
      ERROR: 'Failed to send reset email',
    },
  },
  UPDATE_PASSWORD: {
    TITLE: 'Update your password',
    DESCRIPTION: 'Enter your new password below',
    LABELS: {
      NEW_PASSWORD: 'New Password',
      CONFIRM_PASSWORD: 'Confirm New Password',
    },
    BUTTONS: {
      UPDATE: 'Update password',
      UPDATING: 'Updating password...',
    },
    PLACEHOLDERS: {
      PASSWORD: '••••••••',
    },
    MESSAGES: {
      ERROR: 'Failed to update password',
      SUCCESS_REDIRECT: 'Password updated successfully. Please login with your new password.',
    },
  },
} as const;
