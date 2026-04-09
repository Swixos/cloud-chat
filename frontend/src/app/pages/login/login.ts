import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  isRegister = signal(false);
  username = '';
  password = '';
  email = '';
  name = '';
  error = signal('');
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/chat']);
    }
  }

  /**
   * Submits the login or registration form based on the active mode.
   * @throws Displays the error message on failure
   */
  async onSubmit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    try {
      if (this.isRegister()) {
        await this.auth.register(this.username, this.password, this.email, this.name);
      } else {
        await this.auth.login(this.username, this.password);
      }
    } catch (err: any) {
      const msg = err?.error?.message || err?.error?.error || err?.message || 'Erreur de connexion';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Toggles between login and registration mode and resets errors.
   */
  toggleMode(): void {
    this.isRegister.update((v) => !v);
    this.error.set('');
  }
}
