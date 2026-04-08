import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat').then(m => m.ChatComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'login' },
];
