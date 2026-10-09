import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-estudio',
  templateUrl: './estudio.component.html',
  styleUrls: ['./estudio.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class EstudioComponent implements OnInit, OnDestroy {
  estudioForm!: FormGroup;
  sesiones: any[] = [];
  asignaturasDisponibles: any[] = [];
  guardando: boolean = false;
  exitoMsg: string = '';

  // Configuración de Minutos Personalizados
  minutosSeleccionados: number = 25;

  constructor(
    private fb: FormBuilder,
    public vitalCampusService: VitalCampusService
  ) {}

  ngOnInit(): void {
    this.initForm();

    this.vitalCampusService.asignaturas$.subscribe(asigs => {
      this.asignaturasDisponibles = asigs;
      if (asigs.length > 0 && !this.estudioForm.value.asignatura) {
        this.estudioForm.patchValue({ asignatura: asigs[0].nombre });
      }
    });

    this.vitalCampusService.sesionesEstudio$.subscribe(datos => {
      this.sesiones = datos;
    });

    this.minutosSeleccionados = this.vitalCampusService.pomodoroMinutosConfig;
  }

  ngOnDestroy(): void {}

  initForm(): void {
    const hoy = new Date().toISOString().substring(0, 10);
    this.estudioForm = this.fb.group({
      asignatura: ['', Validators.required],
      fecha: [hoy, Validators.required],
      duracionMinutos: [60, [Validators.required, Validators.min(15)]],
      notas: ['']
    });
  }

  // Detector de Distracciones cuando el usuario cambia de pestaña del navegador
  @HostListener('document:visibilitychange', [])
  onVisibilityChange(): void {
    if (document.hidden && this.vitalCampusService.pomodoroActivo) {
      this.vitalCampusService.registrarDistraccion();
    }
  }

  iniciarOpausar(): void {
    if (this.vitalCampusService.pomodoroActivo) {
      this.vitalCampusService.pausarPomodoro();
    } else {
      this.vitalCampusService.iniciarPomodoro(this.minutosSeleccionados);
    }
  }

  cambiarTiempoConfig(minutos: number): void {
    if (!this.vitalCampusService.pomodoroActivo) {
      this.minutosSeleccionados = minutos;
      this.vitalCampusService.pomodoroMinutosConfig = minutos;
      this.vitalCampusService.pomodoroSegundosRestantes = minutos * 60;
    }
  }

  formatearTiempo(): string {
    const totalSeg = this.vitalCampusService.pomodoroSegundosRestantes;
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  }

  obtenerHorasTotales(): number {
    const min = this.sesiones.reduce((acc, s) => acc + Number(s.duracionMinutos || 0), 0);
    return Math.round((min / 60) * 10) / 10;
  }

  onSubmit(): void {
    if (this.estudioForm.invalid) return;

    this.guardando = true;
    const payload = this.estudioForm.value;

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.guardando = false;
      this.exitoMsg = 'Sesión de estudio registrada y sincronizada con el Dashboard';
      this.estudioForm.patchValue({ notas: '' });
      setTimeout(() => this.exitoMsg = '', 3000);
    });
  }

  eliminar(id: any): void {
    this.vitalCampusService.deleteSesionEstudio(id).subscribe();
  }
}