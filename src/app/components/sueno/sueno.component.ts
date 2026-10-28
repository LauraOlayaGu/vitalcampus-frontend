import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-sueno',
  templateUrl: './sueno.component.html',
  styleUrls: ['./sueno.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SuenoComponent implements OnInit {
  fechaMaxima: string = '';
  fechaRegistro: string = '';
  
  horaDormir: string = '23:00';
  horaDespertar: string = '07:00';
  calidadSeleccionada: string = 'Bueno';
  observaciones: string = '';

  horasCalculadas: number = 8;
  historialSueno: any[] = [];
  mapaDiaSemana: { [dia: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };
  
  errorMsg: string = '';

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.establecerFechaLocalHoy();
    this.calcularHoras();
    this.suscripcionHistorial();
  }

  // OBTENER FECHA LOCAL REAL (Sin desfase UTC de noche)
  establecerFechaLocalHoy(): void {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const day = String(hoy.getDate()).padStart(2, '0');

    this.fechaMaxima = `${year}-${month}-${day}`;
    this.fechaRegistro = this.fechaMaxima;
  }

  calcularHoras(): void {
    if (!this.horaDormir || !this.horaDespertar) {
      this.horasCalculadas = 0;
      return;
    }

    const [h1, m1] = this.horaDormir.split(':').map(Number);
    const [h2, m2] = this.horaDespertar.split(':').map(Number);

    let min1 = h1 * 60 + m1;
    let min2 = h2 * 60 + m2;

    if (min2 <= min1) {
      min2 += 24 * 60;
    }

    const diffMin = min2 - min1;
    this.horasCalculadas = Math.round((diffMin / 60) * 10) / 10;
  }

  seleccionarCalidad(calidad: string): void {
    this.calidadSeleccionada = calidad;
  }

  suscripcionHistorial(): void {
    this.vitalCampusService.suenos$.subscribe(registros => {
      this.historialSueno = registros || [];
      this.procesarDiagramaSemanal(this.historialSueno);
    });
  }

  procesarDiagramaSemanal(registros: any[]): void {
    const mapa: { [dia: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };
    const diasClave = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

    registros.forEach(s => {
      if (s.fecha) {
        const partes = s.fecha.split('-').map(Number);
        const dateObj = new Date(partes[0], partes[1] - 1, partes[2]);
        
        let dayIdx = dateObj.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;

        const clave = diasClave[dayIdx];
        const h = Number(s.horasCalculadas || s.duracion || 0);
        
        if (clave && !isNaN(h)) {
          mapa[clave] = Math.round(((mapa[clave] || 0) + h) * 10) / 10;
        }
      }
    });

    this.mapaDiaSemana = mapa;
  }

  calcularAlturaBarra(horas: number): number {
    if (!horas || horas <= 0) return 0;
    const porcentaje = (horas / 10) * 100;
    return Math.min(porcentaje, 100);
  }

  registrarSueno(): void {
    this.errorMsg = '';

    // BLOQUEO ESTRICTO SI INTENTA SELECCIONAR O FORZAR UNA FECHA FUTURA
    if (this.fechaRegistro > this.fechaMaxima) {
      this.errorMsg = '⚠️ No puedes registrar horas de sueño para fechas futuras.';
      this.vitalCampusService.mostrarToastGlobal(
        'Fecha Inválida',
        'No es posible registrar horas de sueño de días futuros.',
        'ADVERTENCIA',
        false
      );
      setTimeout(() => this.errorMsg = '', 4000);
      return;
    }

    if (this.horasCalculadas <= 0) return;

    const nuevoRegistro = {
      id: Date.now(),
      fecha: this.fechaRegistro,
      horaDormir: this.horaDormir,
      horaDespertar: this.horaDespertar,
      horasCalculadas: Number(this.horasCalculadas),
      duracion: Number(this.horasCalculadas),
      calidad: this.calidadSeleccionada,
      observaciones: this.observaciones
    };

    this.vitalCampusService.createSueno(nuevoRegistro).subscribe(() => {
      this.observaciones = '';
    });
  }

  eliminarRegistro(id: any): void {
    this.vitalCampusService.deleteSueno(id).subscribe();
  }
}