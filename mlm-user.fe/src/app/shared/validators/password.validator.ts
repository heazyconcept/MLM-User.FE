import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Password strength requirements interface
 */
export interface PasswordStrengthOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

/**
 * Default password strength requirements
 */
const DEFAULT_OPTIONS: Required<PasswordStrengthOptions> = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Password strength validator function
 * Validates password strength based on configurable requirements
 * 
 * @param options - Password strength requirements (optional)
 * @returns ValidatorFn that returns null if valid, or an error object with details if invalid
 * 
 * @example
 * ```typescript
 * // Use default requirements (8 chars, uppercase, lowercase, numbers, special chars)
 * const passwordControl = new FormControl('', [passwordStrengthValidator()]);
 * 
 * // Custom requirements
 * const passwordControl = new FormControl('', [
 *   passwordStrengthValidator({ minLength: 6, requireUppercase: false })
 * ]);
 * ```
 */
export function passwordStrengthValidator(options?: PasswordStrengthOptions): ValidatorFn {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      // Don't validate empty values (use required validator for that)
      return null;
    }

    const password = control.value as string;
    const errors: ValidationErrors = {};
    const requirements: string[] = [];

    // Check minimum length
    if (password.length < config.minLength) {
      errors['minLength'] = {
        required: config.minLength,
        actual: password.length,
        message: `Password must be at least ${config.minLength} characters long`
      };
      requirements.push(`at least ${config.minLength} characters`);
    }

    // Check for uppercase letter
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors['requireUppercase'] = {
        message: 'Password must contain at least one uppercase letter'
      };
      requirements.push('one uppercase letter');
    }

    // Check for lowercase letter
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors['requireLowercase'] = {
        message: 'Password must contain at least one lowercase letter'
      };
      requirements.push('one lowercase letter');
    }

    // Check for numbers
    if (config.requireNumbers && !/[0-9]/.test(password)) {
      errors['requireNumbers'] = {
        message: 'Password must contain at least one number'
      };
      requirements.push('one number');
    }

    // Check for special characters
    if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors['requireSpecialChars'] = {
        message: 'Password must contain at least one special character'
      };
      requirements.push('one special character');
    }

    // If there are any errors, return them with a summary message
    if (Object.keys(errors).length > 0) {
      errors['passwordStrength'] = {
        message: `Password must contain: ${requirements.join(', ')}`,
        requirements: requirements
      };
      return errors;
    }

    return null;
  };
}

/**
 * Password match validator function
 * Validates that two password fields match (useful for password confirmation)
 * 
 * @param passwordControlName - Name of the password control to match against
 * @returns ValidatorFn that returns null if passwords match, or an error object if they don't
 * 
 * @example
 * ```typescript
 * this.form = this.fb.group({
 *   password: ['', [passwordStrengthValidator()]],
 *   confirmPassword: ['', [passwordMatchValidator('password')]]
 * });
 * ```
 */
export function passwordMatchValidator(passwordControlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.parent) {
      return null;
    }

    const passwordControl = control.parent.get(passwordControlName);
    
    if (!passwordControl) {
      return null;
    }

    const password = passwordControl.value;
    const confirmPassword = control.value;

    if (!confirmPassword) {
      // Don't validate empty values (use required validator for that)
      return null;
    }

    if (password !== confirmPassword) {
      return {
        passwordMismatch: {
          message: 'Passwords do not match'
        }
      };
    }

    return null;
  };
}
