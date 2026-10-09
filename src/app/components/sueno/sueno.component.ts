import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-sueno',
  templateUrl: './sueno.component.html',
  styleUrls: ['./sueno.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class SuenoComponent implements OnInit {
  suenoForm!: FormGroup;
  historial: any[] = [];

  guardando: boolean = false;
  exitoMsg: string = '';

  diasSemanaFijos = [
    { codigo: 'LUN', nombre: 'Lunes' },
    { codigo: 'MAR', nombre: 'Martes' },
    { codigo: 'MIE', nombre: 'Miércoles' },
    { codigo: 'JUE', nombre: 'Jueves' },
    { codigo: 'VIE', nombre: 'Viernes' },
    { codigo: 'SAB', nombre: 'Sábado' },
    { codigo: 'DOM', nombre: 'Domingo' }
  ];

  calidades = [
    { valor: 'MUY_MALO', etiqueta: 'Muy Malo', icono: '😫' },
    { valor: 'MALO', etiqueta: 'Malo', icono: '🙁' },
    { valor: 'REGULAR', etiqueta: 'Regular', icono: '😐' },
    { valor: 'BUENO', etiqueta: 'Bueno', icono: '😊' },
    { valor: 'EXCELENTE', etiqueta: 'Excelente', icono: '😁' }
  ];

  constructor(
    private fb: FormBuilder,
    private vitalCampusService: VitalCampusService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.vitalCampusService.suenos$.subscribe(datos => {
      this.historial = datos;
    });
  }

  initForm(): void {
    const hoy = new Date().toISOString().substring(0, 10);
    this.suenoForm = this.fb.group({
      fecha: [hoy, Validators.required],
      horaDormir: ['14:00', Validators.required],
      horaDespertar: ['17:30', Validators.required],
      calidad: ['BUENO', Validators.required],
      notas: ['Siesta reparadora en la tarde']
    });
  }

  calcularHoras(): number {
    const dormir = this.suenoForm.value.horaDormir;
    const despertar = this.suenoForm.value.horaDespertar;
    if (!dormir || !despertar) return 0;

    const [h1, m1] = dormir.split(':').map(Number);
    const [h2, m2] = despertar.split(':').map(Number);

    let d1 = new Date(2026, 0, 1, h1, m1);
    let d2 = new Date(2026, 0, 1, h2, m2);

    if (d2 <= d1) {
      d2.setDate(d2.getDate() + 1);
    }

    const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
    return Math.round(diff * 10) / 10;
  }

  obtenerEmojiCalidad(valorCalidad: string): string {
    const objeto = this.calidades.find(c => c.valor === valorCalidad);
    return objeto ? `${objeto.icono} ${objeto.etiqueta}` : '😊 Bueno';
  }

  obtenerBarrasSemana(): any[] {
    const mapaDias: { [key: number]: number } = {};

    this.historial.forEach(item => {
      if (item.fecha) {
        const partes = item.fecha.split('-');
        if (partes.length === 3) {
          const fechaObj = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
          let diaIndex = fechaObj.getDay();
          let indexNormalizado = diaIndex === 0 ? 6 : diaIndex - 1;
          mapaDias[indexNormalizado] = (mapaDias[indexNormalizado] || 0) + Number(item.horasCalculadas || 0);
        }
      }
    });

    return this.diasSemanaFijos.map((d, idx) => {
      const horasTotales = mapaDias[idx] ? Math.round(mapaDias[idx] * 10) / 10 : 0;
      return {
        etiqueta: d.codigo,
        nombreCompleto: d.nombre,
        horas: horasTotales,
        porcentaje: Math.min(100, Math.round((horasTotales / 10) * 100)),
        esDeficit: horasTotales > 0 && horasTotales < 6,
        esBuenDescanso: horasTotales >= 6
      };
    });
  }

  onSubmit(): void {
    if (this.suenoForm.invalid) return;

    this.guardando = true;
    const horasCalculadas = this.calcularHoras();
    const payload = {
      ...this.suenoForm.value,
      horasCalculadas
    };

    this.vitalCampusService.createSueno(payload).subscribe(() => {
      this.guardando = false;
      this.exitoMsg = 'Registro guardado con éxito';
      setTimeout(() => this.exitoMsg = '', 3000);
    });
  }

  eliminar(id: any): void {
    this.vitalCampusService.deleteSueno(id).subscribe();
  }
}