import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'checker' | 'operator';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  
  // Usar Angular Signals para reactividad de sesión
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  private loadSession() {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        this.currentUser.set(JSON.parse(userJson));
      } catch {
        this.logout();
      }
    }
  }

  login(username: string, pass: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { username, pass }).pipe(
      tap((res) => {
        if (res && res.access_token) {
          localStorage.setItem('token', res.access_token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }
}
