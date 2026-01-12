import { Component, forwardRef, input, model, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth-input',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-input.component.html',
  styleUrl: './auth-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AuthInputComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthInputComponent implements ControlValueAccessor {
  id = input<string>('auth-input-' + Math.random().toString(36).substring(2, 9));
  label = input<string>();
  type = input<string>('text');
  placeholder = input<string>('');
  icon = input<string>();
  required = input<boolean>(false);
  error = input<string | null>(null);

  value = signal<string>('');
  isDisabled = signal<boolean>(false);
  isTouched = signal<boolean>(false);
  showPassword = signal<boolean>(false);

  actualType = computed(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  });

  inputClasses = computed(() => {
    return [
      'auth-input-field',
      this.icon() ? 'pl-11' : 'pl-4',
      this.type() === 'password' ? 'pr-11' : 'pr-4',
      this.error() && this.isTouched() ? 'border-mlm-error focus:ring-mlm-error/10 border-2' : 'border-slate-400 focus:border-mlm-primary focus:ring-mlm-primary/10',
      this.isDisabled() ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'bg-white'
    ].join(' ');
  });

  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(value: any): void {
    this.value.set(value || '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onInputChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);
    this.onChange(val);
  }

  onBlur(): void {
    this.isTouched.set(true);
    this.onTouched();
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }
}

