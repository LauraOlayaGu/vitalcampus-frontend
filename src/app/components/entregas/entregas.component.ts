import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-entregas',
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class EntregasComponent implements OnInit {
  entregaForm!: FormGroup;
  entregas: any[] = [];
  asignaturasDisponibles: any[] = [];
  guardando: boolean = false;
  exitoMsg: string = '';

  tiposActividad = [
    { valor: 'EXAMEN', etiqueta: '📝 Examen / Parcial / Quiz' },
    { valor: 'TALLER', etiqueta: '📁 Trabajo / Taller / Proyecto' }
  ];

  nivelesEstres = [
    { valor: 1, etiqueta: '1 - Relajado' },
    { valor: 2, etiqueta: '2 - Moderado' },
    { valor: 3, etiqueta: '3 - Relevante' },
    { valor: 4, etiqueta: '4 - Intenso' },
    { valor: 5, etiqueta: '5 - Estrés Máximo' }
  ];

  constructor(
    private fb: FormBuilder,
    private vitalCampusService: VitalCampusService
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    // Cargar Asignaturas Guardadas
    this.vitalCampusService.asignaturas$.subscribe(asigs => {
      this.asignaturasDisponibles = asigs;
      if (asigs.length > 0 && !this.entregaForm.value.asignatura) {
        this.entregaForm.patchValue({ asignatura: asigs[0].nombre });
      }
    });

    // Cargar Entregas y Depurar Expiradas
    this.vitalCampusService.entregas$.subscribe(datos => {
      this.entregas = this.depurarExpiradas(datos);
    });
  }

  initForm(): void {
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 24);
    const isoFecha = ahora.toISOString().substring(0, 16);

    this.entregaForm = this.fb.group({
      asignatura: ['', Validators.required],
      titulo: ['', Validators.required],
      tipo: ['TALLER', Validators.required],
      fechaLimite: [isoFecha, Validators.required],
      estres: [3, Validators.required]
    });
  }

  // Remueve actividades cuya fecha límite ya pasó respecto al momento actual
  depurarExpiradas(lista: any[]): any[] {
    const ahoraTimestamp = new Date().getTime();
    return lista.filter(e => {
      if (!e.fechaLimite) return true;
      const limiteTimestamp = new Date(e.fechaLimite).getTime();
      return limiteTimestamp >= ahoraTimestamp;
    });
  }

  obtenerEvaluacionesExamenes(): any[] {
    return this.entregas.filter(e => e.tipo === 'EXAMEN');
  }

  obtenerTrabajosProyectos(): any[] {
    return this.entregas.filter(e => e.tipo !== 'EXAMEN');
  }

  onSubmit(): void {
    if (this.entregaForm.invalid) return;

    this.guardando = true;
    const payload = {
      ...this.entregaForm.value,
      estado: 'PENDIENTE'
    };

    this.vitalCampusService.createEntrega(payload).subscribe(() => {
      this.guardando = false;
      this.exitoMsg = 'Actividad programada e impacto de estrés registrado';
      this.entregaForm.patchValue({ titulo: '' });
      setTimeout(() => this.exitoMsg = '', 3000);
    });
  }

  eliminar(id: any): void {
    this.vitalCampusService.deleteEntrega(id).subscribe();
  }
}