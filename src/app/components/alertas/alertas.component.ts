import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-alertas',
  templateUrl: './alertas.component.html',
  styleUrls: ['./alertas.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class AlertasComponent implements OnInit {
  alertas: any[] = [];
  filtroActual: string = 'TODAS'; // 'TODAS', 'CRITICA', 'ADVERTENCIA', 'LEIDAS'
  
  nivelSalud: string = 'SALUDABLE'; // 'SALUDABLE', 'ATENCION', 'CRITICO'
  porcentajeEstres: number = 20;

  constructor(
    private vitalCampusService: VitalCampusService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarAlertas();
  }

  cargarAlertas(): void {
    this.vitalCampusService.alertasSubject$.subscribe(datos => {
      this.alertas = datos || [];
      this.recalcularSemaforoSalud();
    });
  }

  recalcularSemaforoSalud(): void {
    const criticas = this.alertas.filter(a => a.tipo === 'CRITICA' && !a.leida).length;
    const advertencias = this.alertas.filter(a => a.tipo === 'ADVERTENCIA' && !a.leida).length;

    if (criticas > 0) {
      this.nivelSalud = 'CRITICO';
      this.porcentajeEstres = 90;
    } else if (advertencias > 0) {
      this.nivelSalud = 'ATENCION';
      this.porcentajeEstres = 55;
    } else {
      this.nivelSalud = 'SALUDABLE';
      this.porcentajeEstres = 15;
    }
  }

  get alertasFiltradas(): any[] {
    if (this.filtroActual === 'CRITICA') {
      return this.alertas.filter(a => a.tipo === 'CRITICA');
    }
    if (this.filtroActual === 'ADVERTENCIA') {
      return this.alertas.filter(a => a.tipo === 'ADVERTENCIA');
    }
    if (this.filtroActual === 'LEIDAS') {
      return this.alertas.filter(a => a.leida);
    }
    return this.alertas;
  }

  marcarLeida(id: any): void {
    this.vitalCampusService.marcarAlertaComoLeida(id);
  }

  limpiarTodas(): void {
    this.vitalCampusService.limpiarTodasLasAlertas();
  }

  ejecutarAccion(alerta: any): void {
    if (alerta.id?.includes('estres')) {
      this.router.navigate(['/entregas']);
    } else if (alerta.id?.includes('sueno')) {
      this.router.navigate(['/sueno']);
    } else if (alerta.id?.includes('distraccion') || alerta.id?.includes('burnout')) {
      this.router.navigate(['/estudio']);
    }
  }
}