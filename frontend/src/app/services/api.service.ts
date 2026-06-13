import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    });
  }

  // --- USERS / EMPLOYEES ---
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`, { headers: this.getHeaders() });
  }

  createUser(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/users`, data, { headers: this.getHeaders() });
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/users/${id}`, data, { headers: this.getHeaders() });
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  // --- VEHICLES ---
  getVehicles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/vehicles`, { headers: this.getHeaders() });
  }

  createVehicle(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/vehicles`, data, { headers: this.getHeaders() });
  }

  updateVehicle(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/vehicles/${id}`, data, { headers: this.getHeaders() });
  }

  deleteVehicle(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/vehicles/${id}`, { headers: this.getHeaders() });
  }

  syncVehicles(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/vehicles/sync`, {}, { headers: this.getHeaders() });
  }

  // --- WORK ORDERS ---
  getWorkOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/work-orders`, { headers: this.getHeaders() });
  }

  createWorkOrder(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/work-orders`, data, { headers: this.getHeaders() });
  }

  approveWorkOrder(id: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/work-orders/${id}/approve`, {}, { headers: this.getHeaders() });
  }

  getWorkOrdersStats(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/work-orders/stats`, { headers: this.getHeaders() });
  }

  getNextConduceNumber(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/work-orders/next-number`, { headers: this.getHeaders() });
  }

  // --- EXPENSES ---
  getExpenses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/expenses`, { headers: this.getHeaders() });
  }

  createExpense(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/expenses`, data, { headers: this.getHeaders() });
  }

  getExpensesStats(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/expenses/stats`, { headers: this.getHeaders() });
  }

  // --- SYSTEM MODULES SETTINGS ---
  getSystemModules(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/settings/modules`, { headers: this.getHeaders() });
  }

  updateSystemModule(id: string, isEnabled: boolean): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/settings/modules/${id}`, { isEnabled }, { headers: this.getHeaders() });
  }

  getGpsSettings(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/settings/gps`, { headers: this.getHeaders() });
  }

  updateGpsSettings(data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/settings/gps`, data, { headers: this.getHeaders() });
  }
}
