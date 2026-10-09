import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { VitalCampusService } from './services/vitalcampus.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive]
})
export class AppComponent implements OnInit {
  toastAlerta: any = null;
  alertasCriticasConteo: number = 0;

  constructor(
    public vitalCampusService: VitalCampusService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.solicitarPermisoNotificaciones();
    this.monitorearAlertasGlobales();
  }

  // Verifica si la ruta actual es el Login/Registro para ocultar la barra lateral
  esPaginaAuth(): boolean {
    return this.router.url.includes('/login');
  }

  solicitarPermisoNotificaciones(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  monitorearAlertasGlobales(): void {
    // Escuchar cambios en las alertas y actualizar el conteo
    this.vitalCampusService.alertasSubject$.subscribe((alertas: any) => {
      this.vitalCampusService.recalcularAlertas();

      if (Array.isArray(alertas)) {
        this.alertasCriticasConteo = alertas.filter(
          (alerta: any) => alerta.tipo === 'CRITICA' || alerta.esCritica
        ).length;
      } else {
        this.alertasCriticasConteo = 0;
      }
    });

    // Escuchar eventos inmediatos de Toast (Distracciones)
    this.vitalCampusService.eventoToast$.subscribe(alertaToast => {
      if (alertaToast) {
        this.toastAlerta = alertaToast;
        setTimeout(() => {
          this.toastAlerta = null;
        }, 5000);

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(alertaToast.titulo, {
            body: alertaToast.mensaje
          });
        }
      }
    });
  }

  cerrarToast(): void {
    this.toastAlerta = null;
  }

  cerrarSesion(): void {
    this.vitalCampusService.cerrarSesion();
    this.router.navigate(['/login']);
  }
}