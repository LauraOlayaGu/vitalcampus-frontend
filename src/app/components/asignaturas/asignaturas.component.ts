import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-asignaturas',
  templateUrl: './asignaturas.component.html',
  styleUrls: ['./asignaturas.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class AsignaturasComponent implements OnInit {
  asignaturaForm!: FormGroup;
  asignaturas: any[] = [];
  editandoId: number | string | null = null;
  guardando: boolean = false;
  exitoMsg: string = '';

  diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  cargas = [
    { valor: 'Baja', etiqueta: 'Baja' },
    { valor: 'Media-Baja', etiqueta: 'Media-Baja' },
    { valor: 'Media', etiqueta: 'Media' },
    { valor: 'Alta', etiqueta: 'Alta' },
    { valor: 'Muy Alta', etiqueta: 'Muy Alta' }
  ];

  constructor(
    private fb: FormBuilder,
    private vitalCampusService: VitalCampusService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.vitalCampusService.asignaturas$.subscribe(datos => {
      this.asignaturas = datos;
    });
  }

  initForm(): void {
    this.asignaturaForm = this.fb.group({
      nombre: ['', Validators.required],
      diaClase: ['LUNES', Validators.required],
      horaInicio: ['08:00', Validators.required],
      carga: ['Media', Validators.required]
    });
  }

  obtenerClasesPorDia(dia: string): any[] {
    return this.asignaturas.filter(a => (a.diaClase || '').toUpperCase() === dia.toUpperCase());
  }

  onSubmit(): void {
    if (this.asignaturaForm.invalid) return;

    this.guardando = true;
    const payload = this.asignaturaForm.value;

    if (this.editandoId) {
      this.vitalCampusService.updateAsignatura(this.editandoId, payload).subscribe(() => {
        this.guardando = false;
        this.editandoId = null;
        this.exitoMsg = 'Asignatura actualizada correctamente';
        this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
        setTimeout(() => this.exitoMsg = '', 3000);
      });
    } else {
      this.vitalCampusService.createAsignatura(payload).subscribe(() => {
        this.guardando = false;
        this.exitoMsg = 'Asignatura guardada y añadida al horario';
        this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
        setTimeout(() => this.exitoMsg = '', 3000);
      });
    }
  }

  editar(asig: any): void {
    this.editandoId = asig.id;
    this.asignaturaForm.patchValue({
      nombre: asig.nombre,
      diaClase: asig.diaClase,
      horaInicio: asig.horaInicio,
      carga: asig.carga || 'Media'
    });
  }

  eliminar(id: any): void {
    this.vitalCampusService.deleteAsignatura(id).subscribe();
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
  }
}