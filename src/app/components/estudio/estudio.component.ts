import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-estudio',
  templateUrl: './estudio.component.html',
  styleUrls: ['./estudio.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class EstudioComponent implements OnInit, OnDestroy {
  exitoMsg: string = '';
  errorMsg: string = '';
  mostrarFormularioManual: boolean = false;

  asignaturasDisponibles: any[] = [];
  asignaturaSeleccionadaCronometro: string = '';
  tipoActividadSeleccionada: string = 'Taller / Guía';

  minutosPersonalizadosInput: number = 25;
  modoInvestigacionLibre: boolean = true;

  // CRONÓMETRO DE ESTUDIO
  enfoqueEnCurso: boolean = false;
  segundosRestantes: number = 25 * 60;
  segundosInicialesSesion: number = 25 * 60;
  intervaloEnfoque: any = null;

  // FORMULARIO MANUAL
  manualAsignatura: string = '';
  manualObjetivo: string = 'Taller / Guía';
  manualHoras: number = 1;
  manualFecha: string = new Date().toISOString().substring(0, 10);

  // ESTRUCTURA POR MATERIAS Y CATEGORÍAS
  materiasConCategorias: any[] = [];
  totalAcumuladoTextoSemestre: string = '0 min';

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.cargarAsignaturas();
    this.suscripcionSesiones();
  }

  ngOnDestroy(): void {
    this.detenerRelojEstudio();
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    if (this.enfoqueEnCurso && !this.modoInvestigacionLibre) {
      this.vitalCampusService.registrarDistraccion();
      this.segundosRestantes += 120;
    }
  }

  cargarAsignaturas(): void {
    this.vitalCampusService.asignaturas$.subscribe(asigs => {
      this.asignaturasDisponibles = asigs || [];
      if (this.asignaturasDisponibles.length > 0 && !this.asignaturaSeleccionadaCronometro) {
        this.asignaturaSeleccionadaCronometro = this.asignaturasDisponibles[0].nombre;
        this.manualAsignatura = this.asignaturasDisponibles[0].nombre;
      }
      this.procesarAgrupacionPorCategorias();
    });
  }

  suscripcionSesiones(): void {
    this.vitalCampusService.sesionesEstudio$.subscribe(() => {
      this.procesarAgrupacionPorCategorias();
    });
  }

  procesarAgrupacionPorCategorias(): void {
    const sesiones = this.vitalCampusService.sesionesEstudio$.getValue() || [];
    let sumaTotalMinutos = 0;

    const mapaMaterias: { [materia: string]: { [categoria: string]: { minutos: number; fecha: string; ids: any[] } } } = {};

    this.asignaturasDisponibles.forEach(a => {
      mapaMaterias[a.nombre] = {};
    });

    sesiones.forEach(s => {
      const min = Number(s.duracionMinutos || (s.horas ? s.horas * 60 : 0));
      sumaTotalMinutos += min;

      const materiaKey = s.asignatura || 'General';
      const catKey = s.objetivo || 'Taller / Guía';

      if (!mapaMaterias[materiaKey]) {
        mapaMaterias[materiaKey] = {};
      }

      if (!mapaMaterias[materiaKey][catKey]) {
        mapaMaterias[materiaKey][catKey] = {
          minutos: 0,
          fecha: s.fecha || new Date().toISOString().substring(0, 10),
          ids: []
        };
      }

      mapaMaterias[materiaKey][catKey].minutos += min;
      mapaMaterias[materiaKey][catKey].ids.push(s.id);
      mapaMaterias[materiaKey][catKey].fecha = s.fecha || mapaMaterias[materiaKey][catKey].fecha;
    });

    if (sumaTotalMinutos >= 60) {
      const horas = Math.floor(sumaTotalMinutos / 60);
      const minRestantes = Math.round(sumaTotalMinutos % 60);
      this.totalAcumuladoTextoSemestre = minRestantes > 0 ? `${horas}h ${minRestantes} min` : `${horas}h`;
    } else {
      this.totalAcumuladoTextoSemestre = `${Math.round(sumaTotalMinutos)} min`;
    }

    this.materiasConCategorias = Object.keys(mapaMaterias).map(nombreMateria => {
      const categoriasMap = mapaMaterias[nombreMateria];
      const categoriasList = Object.keys(categoriasMap).map(catNombre => {
        const totalMin = categoriasMap[catNombre].minutos;
        
        let textoFormateado = `${Math.round(totalMin)} min`;
        if (totalMin >= 60) {
          const h = Math.floor(totalMin / 60);
          const m = Math.round(totalMin % 60);
          textoFormateado = m > 0 ? `${h}h ${m}m` : `${h}.0h`;
        }

        return {
          categoria: catNombre,
          minutosNum: totalMin,
          tiempoFormateado: textoFormateado,
          fecha: categoriasMap[catNombre].fecha,
          ids: categoriasMap[catNombre].ids
        };
      });

      return {
        nombre: nombreMateria,
        categorias: categoriasList
      };
    });
  }

  obtenerHorasTotalesSemestre(): string {
    return this.totalAcumuladoTextoSemestre;
  }

  toggleRegistroManual(): void {
    this.mostrarFormularioManual = !this.mostrarFormularioManual;
    this.exitoMsg = '';
    this.errorMsg = '';
  }

  cambiarAsignaturaCronometro(event: any): void {
    this.asignaturaSeleccionadaCronometro = event.target.value;
  }

  cambiarTipoActividad(event: any): void {
    this.tipoActividadSeleccionada = event.target.value;
  }

  cambiarTiempoConfig(minutos: number): void {
    if (this.enfoqueEnCurso) this.pausarEnfoque();
    this.minutosPersonalizadosInput = minutos;
    this.segundosRestantes = minutos * 60;
    this.segundosInicialesSesion = minutos * 60;
  }

  actualizarTiempoInput(event: any): void {
    const val = Number(event.target.value);
    if (val >= 1) {
      this.minutosPersonalizadosInput = val;
      if (!this.enfoqueEnCurso) {
        this.segundosRestantes = val * 60;
        this.segundosInicialesSesion = val * 60;
      }
    }
  }

  toggleModoInvestigacion(): void {
    this.modoInvestigacionLibre = !this.modoInvestigacionLibre;
  }

  iniciarOpausar(): void {
    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    } else {
      this.iniciarEnfoque();
    }
  }

  // INICIO DE ENFOQUE CON INCREMENTO PAULATINO DE RIESGO
  iniciarEnfoque(): void {
    this.enfoqueEnCurso = true;
    this.errorMsg = '';
    this.vitalCampusService.iniciarPomodoro(this.minutosPersonalizadosInput);

    let contadorTicks = 0;

    this.intervaloEnfoque = setInterval(() => {
      if (this.segundosRestantes > 0) {
        this.segundosRestantes--;
        contadorTicks++;

        // Cada 15 segundos de estudio continuo, el riesgo sube un 2%
        if (contadorTicks % 15 === 0) {
          this.vitalCampusService.incrementarRiesgoPorEstudio(2);
        }
      } else {
        this.finalizarSesionExito();
      }
    }, 1000);
  }

  pausarEnfoque(): void {
    this.detenerRelojEstudio();
    this.enfoqueEnCurso = false;
    this.vitalCampusService.pausarPomodoro();
  }

  guardarRegistroManualCronometro(): void {
    const segundosTranscurridos = this.segundosInicialesSesion - this.segundosRestantes;

    if (segundosTranscurridos < 60) {
      this.errorMsg = '⚠️ Debes estudiar al menos 1 minuto (60 segundos) para poder guardar un registro de estudio.';
      this.vitalCampusService.mostrarToastGlobal('⚠️ Tiempo Insuficiente', 'Debes estudiar al menos 1 minuto para registrar.', 'ADVERTENCIA', false);
      setTimeout(() => this.errorMsg = '', 5000);
      return;
    }

    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    }

    const minutosGuardar = Math.round(segundosTranscurridos / 60);

    const payload = {
      asignatura: this.asignaturaSeleccionadaCronometro || 'General',
      objetivo: this.tipoActividadSeleccionada,
      duracionMinutos: minutosGuardar,
      fecha: new Date().toISOString().substring(0, 10)
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 Registrado: ${minutosGuardar} min guardados en "${payload.objetivo}" de ${payload.asignatura}.`;
      this.errorMsg = '';
      this.segundosRestantes = this.minutosPersonalizadosInput * 60;
      this.segundosInicialesSesion = this.segundosRestantes;
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 5000);
    });
  }

  finalizarSesionExito(): void {
    this.detenerRelojEstudio();
    this.enfoqueEnCurso = false;
    this.vitalCampusService.pausarPomodoro();

    this.reproducirAlarmaEstudioExito();

    const payload = {
      asignatura: this.asignaturaSeleccionadaCronometro || 'General',
      objetivo: this.tipoActividadSeleccionada,
      duracionMinutos: this.minutosPersonalizadosInput,
      fecha: new Date().toISOString().substring(0, 10)
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 ¡Sesión completada! Se sumaron ${this.minutosPersonalizadosInput} min a ${payload.objetivo}.`;
      this.segundosRestantes = this.minutosPersonalizadosInput * 60;
      this.segundosInicialesSesion = this.segundosRestantes;
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 6000);
    });
  }

  private detenerRelojEstudio(): void {
    if (this.intervaloEnfoque) {
      clearInterval(this.intervaloEnfoque);
      this.intervaloEnfoque = null;
    }
  }

  reanudarCategoriaEspecifica(materiaNombre: string, categoriaNombre: string): void {
    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    }

    this.asignaturaSeleccionadaCronometro = materiaNombre;
    this.tipoActividadSeleccionada = categoriaNombre;
    this.segundosRestantes = this.minutosPersonalizadosInput * 60;
    this.segundosInicialesSesion = this.minutosPersonalizadosInput * 60;

    this.iniciarEnfoque();
  }

  eliminarCategoria(ids: any[]): void {
    if (confirm('¿Deseas eliminar este tiempo acumulado?')) {
      ids.forEach(id => {
        this.vitalCampusService.deleteSesionEstudio(id).subscribe();
      });
      this.procesarAgrupacionPorCategorias();
    }
  }

  reproducirAlarmaEstudioExito(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notas = [523.25, 659.25, 783.99, 1046.50];
      const ahora = audioCtx.currentTime;

      notas.forEach((frecuencia, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frecuencia, ahora + i * 0.22);

        gain.gain.setValueAtTime(0.01, ahora + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.3, ahora + i * 0.22 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ahora + i * 0.22 + 0.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(ahora + i * 0.22);
        osc.stop(ahora + i * 0.22 + 0.2);
      });
    } catch (e) {
      console.log('Audio no interactuado aún');
    }
  }

  formatearTiempo(): string {
    const min = Math.floor(this.segundosRestantes / 60);
    const seg = this.segundosRestantes % 60;
    return `${min < 10 ? '0' : ''}${min}:${seg < 10 ? '0' : ''}${seg}`;
  }

  guardarSesionManual(): void {
    if (this.manualHoras <= 0) {
      alert('Ingresa una cantidad de horas válida.');
      return;
    }

    const payload = {
      asignatura: this.manualAsignatura || 'General',
      objetivo: this.manualObjetivo || 'Taller / Guía',
      duracionMinutos: this.manualHoras * 60,
      fecha: this.manualFecha
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 Se agregaron ${this.manualHoras}h de estudio en "${payload.objetivo}" para ${payload.asignatura}.`;
      this.mostrarFormularioManual = false;
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 5000);
    });
  }
}