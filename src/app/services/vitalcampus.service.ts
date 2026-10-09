import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class VitalCampusService {
  private apiUrl = 'http://localhost:3000/api';

  // --- AUTENTICACIÓN Y SESIÓN DE USUARIO ---
  public usuarioActual$ = new BehaviorSubject<any>(
    JSON.parse(localStorage.getItem('vc_usuario') || 'null')
  );

  // --- SUEÑO ---
  private suenosIniciales = [
    { id: 1, fecha: '2026-10-09', horaDormir: '03:00', horaDespertar: '06:00', horasCalculadas: 3, calidad: 'MUY_MALO', notas: 'Dormí poco por estudiar' }
  ];
  public suenos$ = new BehaviorSubject<any[]>(this.cargarStorage('vc_suenos', this.suenosIniciales));

  // --- ASIGNATURAS ---
  private asignaturasIniciales = [
    { id: 1, nombre: 'Telemática', diaClase: 'LUNES', horaInicio: '08:00', carga: 'Alta' },
    { id: 2, nombre: 'Arquitectura de Software', diaClase: 'MIERCOLES', horaInicio: '10:00', carga: 'Media' }
  ];
  public asignaturas$ = new BehaviorSubject<any[]>(this.cargarStorage('vc_asignaturas', this.asignaturasIniciales));

  // --- ENTREGAS ---
  private entregasIniciales = [
    { id: 1, asignatura: 'Telemática', titulo: 'Parcial Final de Redes y VoIP', tipo: 'EXAMEN', fechaLimite: '2026-10-10T19:45', estres: 5, estado: 'PENDIENTE' },
    { id: 2, asignatura: 'Telemática', titulo: 'Taller de Patrones', tipo: 'TALLER', fechaLimite: '2026-10-10T19:46', estres: 4, estado: 'PENDIENTE' }
  ];
  public entregas$ = new BehaviorSubject<any[]>(this.cargarStorage('vc_entregas', this.entregasIniciales));

  // --- ESTUDIO ---
  private estudioInicial = [
    { id: 1, asignatura: 'Telemática', fecha: '2026-10-09', duracionMinutos: 90, notas: 'Repaso de VoIP y Asterisk' }
  ];
  public sesionesEstudio$ = new BehaviorSubject<any[]>(this.cargarStorage('vc_estudio', this.estudioInicial));

  // --- CRONÓMETRO PERSISTENTE Y DISTRACCIONES ---
  public pomodoroMinutosConfig: number = 25;
  public pomodoroSegundosRestantes: number = 25 * 60;
  public pomodoroActivo: boolean = false;
  public distraccionesConteo: number = 0;
  private intervaloPomodoro: any = null;

  // --- ESTADO PERSISTENTE DE ALERTAS DINÁMICAS ---
  public alertasSubject$ = new BehaviorSubject<any[]>([]);
  public eventoToast$ = new BehaviorSubject<any>(null); // Canal para disparar avisos flotantes inmediatos

  constructor(private http: HttpClient) {
    this.recalcularAlertas();
  }

  // --- MÉTODOS DE AUTENTICACIÓN ---
  iniciarSesion(correo: string, pass: string): Observable<any> {
    const usuarioSimulado = {
      correo: correo,
      nombre: correo.split('@')[0].replace('_', ' ').toUpperCase(),
      token: 'jwt_token_' + Date.now()
    };
    localStorage.setItem('vc_usuario', JSON.stringify(usuarioSimulado));
    this.usuarioActual$.next(usuarioSimulado);
    return of(usuarioSimulado);
  }

  registrarUsuario(datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, datos).pipe(
      catchError(() => {
        return of({ success: true, mensaje: 'Usuario registrado localmente' });
      })
    );
  }

  cerrarSesion(): void {
    localStorage.removeItem('vc_usuario');
    this.usuarioActual$.next(null);
  }

  // --- MÉTODOS AUXILIARES DE LOCALSTORAGE ---
  private cargarStorage(clave: string, valorDefecto: any[]): any[] {
    const g = localStorage.getItem(clave);
    return g ? JSON.parse(g) : valorDefecto;
  }

  private guardarStorage(clave: string, data: any[], subject: BehaviorSubject<any[]>): void {
    localStorage.setItem(clave, JSON.stringify(data));
    subject.next(data);
  }

  // RECALCULAR TODAS LAS ALERTAS ACTIVAS DEDUCIDAS DEL SISTEMA
  public recalcularAlertas(): void {
    const estresInfo = this.obtenerNivelEstresCalculado();
    const promSueno = parseFloat(this.obtenerPromedioSueno());
    const cargaInfo = this.obtenerCalculoCargaEstudio();
    
    const actuales = this.alertasSubject$.value || [];
    const leidasIds = new Set(actuales.filter(a => a.leida).map(a => a.id));

    const nuevasAlertas: any[] = [];

    if (this.distraccionesConteo > 0) {
      nuevasAlertas.push({
        id: 'distraccion_' + this.distraccionesConteo,
        tipo: 'ADVERTENCIA',
        titulo: '👀 Distracción Detectada en Sesión',
        mensaje: `Has cambiado de pestaña o ventana ${this.distraccionesConteo} vez(ces). Se agregaron +${this.distraccionesConteo * 2} min adicionales al cronómetro.`,
        fecha: 'Ahora',
        leida: leidasIds.has('distraccion_' + this.distraccionesConteo)
      });
    }

    if (estresInfo.sobrecargado) {
      nuevasAlertas.push({
        id: 'estres_alto',
        tipo: 'CRITICA',
        titulo: '⚠️ Alerta de Sobrecarga y Estrés Máximo',
        mensaje: `Tienes ${estresInfo.urgentes} examen(es) o entrega(s) urgentes. Tu nivel de estrés alcanzó ${estresInfo.puntaje}. Haz una pausa activa de 15 minutos.`,
        fecha: 'Hoy',
        leida: leidasIds.has('estres_alto')
      });
    }

    if (promSueno < 6.0 && promSueno > 0) {
      nuevasAlertas.push({
        id: 'sueno_deficit',
        tipo: 'ADVERTENCIA',
        titulo: '🌙 Alerta de Sueño Insuficiente',
        mensaje: `Tu descanso promedio está en ${promSueno}h. Estudiar con fatiga reduce la retención de memoria.`,
        fecha: 'Hoy',
        leida: leidasIds.has('sueno_deficit')
      });
    }

    if (cargaInfo.horasTotales > 10 && promSueno < 6) {
      nuevasAlertas.push({
        id: 'burnout_riesgo',
        tipo: 'ADVERTENCIA',
        titulo: '⚡ Alerta de Riesgo de Burnout',
        mensaje: `Has acumulado ${cargaInfo.horasTotales}h de estudio esta semana pero has dormido poco. Regula tu ritmo de estudio.`,
        fecha: 'Hoy',
        leida: leidasIds.has('burnout_riesgo')
      });
    }

    this.alertasSubject$.next(nuevasAlertas);
  }

  // MÉTODOS PARA MARCAR ALERTAS COMO LEÍDAS / LIMPIAR
  marcarAlertaComoLeida(id: any): void {
    const act = this.alertasSubject$.value.map(a => a.id === id ? { ...a, leida: true } : a);
    this.alertasSubject$.next(act);
  }

  limpiarTodasLasAlertas(): void {
    const act = this.alertasSubject$.value.map(a => ({ ...a, leida: true }));
    this.alertasSubject$.next(act);
  }

  obtenerConteoAlertasNoLeidas(): number {
    return (this.alertasSubject$.value || []).filter(a => !a.leida).length;
  }

  // CRONÓMETRO DE ENFOQUE Y REGISTRO DE DISTRACCIÓN
  iniciarPomodoro(minutosPersonalizados: number): void {
    if (!this.pomodoroActivo) {
      this.pomodoroMinutosConfig = minutosPersonalizados;
      if (this.pomodoroSegundosRestantes <= 0 || this.pomodoroSegundosRestantes === this.pomodoroMinutosConfig * 60) {
        this.pomodoroSegundosRestantes = minutosPersonalizados * 60;
      }
      this.pomodoroActivo = true;

      this.intervaloPomodoro = setInterval(() => {
        if (this.pomodoroSegundosRestantes > 0) {
          this.pomodoroSegundosRestantes--;
        } else {
          this.detenerPomodoro();
          this.completarPomodoroAuto();
        }
      }, 1000);
    }
  }

  pausarPomodoro(): void {
    if (this.pomodoroActivo) {
      clearInterval(this.intervaloPomodoro);
      this.pomodoroActivo = false;
    }
  }

  detenerPomodoro(): void {
    clearInterval(this.intervaloPomodoro);
    this.pomodoroActivo = false;
  }

  registrarDistraccion(): void {
    if (this.pomodoroActivo) {
      this.distraccionesConteo++;
      this.pomodoroSegundosRestantes += 120; // +2 min
      this.recalcularAlertas();

      this.eventoToast$.next({
        tipo: 'ADVERTENCIA',
        titulo: '👀 Distracción Detectada (+2 min)',
        mensaje: `Te saliste de la sesión de enfoque. Se agregaron +2 minutos de penalización al cronómetro.`
      });
    }
  }

  completarPomodoroAuto(): void {
    const hoy = new Date().toISOString().substring(0, 10);
    const minCalculados = this.pomodoroMinutosConfig + (this.distraccionesConteo * 2);
    const payload = {
      id: Date.now(),
      asignatura: 'Estudio de Enfoque',
      fecha: hoy,
      duracionMinutos: minCalculados,
      notas: `Sesión completada. Distracciones: ${this.distraccionesConteo} (+${this.distraccionesConteo * 2} min penalización)`
    };
    const act = [payload, ...this.sesionesEstudio$.value];
    this.guardarStorage('vc_estudio', act, this.sesionesEstudio$);
    this.distraccionesConteo = 0;
    this.pomodoroSegundosRestantes = this.pomodoroMinutosConfig * 60;
    this.recalcularAlertas();
  }

  // SUEÑO
  getSuenos(): Observable<any> { return of(this.suenos$.value); }
  createSueno(data: any): Observable<any> {
    const act = [{ ...data, id: Date.now() }, ...this.suenos$.value];
    this.guardarStorage('vc_suenos', act, this.suenos$);
    this.recalcularAlertas();
    return of(data);
  }
  deleteSueno(id: any): Observable<any> {
    const act = this.suenos$.value.filter(s => s.id !== id);
    this.guardarStorage('vc_suenos', act, this.suenos$);
    this.recalcularAlertas();
    return of({ success: true });
  }

  obtenerPromedioSueno(): string {
    const lista = this.suenos$.value;
    if (!lista || lista.length === 0) return '0h';
    const mapa: { [key: string]: number } = {};
    lista.forEach(s => mapa[s.fecha] = (mapa[s.fecha] || 0) + Number(s.horasCalculadas || 0));
    const fechas = Object.keys(mapa);
    if (fechas.length === 0) return '0h';
    const promedio = Math.round((fechas.reduce((acc, f) => acc + mapa[f], 0) / fechas.length) * 10) / 10;
    return `${promedio}h`;
  }

  // CARGA Y ESTRÉS
  obtenerCalculoCargaEstudio(): { horasTotales: number; porcentaje: number; nivelTexto: string } {
    const sesiones = this.sesionesEstudio$.value;
    const minutosTotales = sesiones.reduce((acc, s) => acc + Number(s.duracionMinutos || 0), 0);
    const horasTotales = Math.round((minutosTotales / 60) * 10) / 10;
    const porcentaje = Math.min(100, Math.round((horasTotales / 15) * 100));
    let nivelTexto = 'Equilibrada';
    if (porcentaje >= 80) nivelTexto = 'Alta / Intensiva';
    else if (porcentaje < 30) nivelTexto = 'Baja';
    return { horasTotales, porcentaje, nivelTexto };
  }

  obtenerNivelEstresCalculado(): { nivelTexto: string; puntaje: string; sobrecargado: boolean; urgentes: number } {
    const entregasActivas = this.entregas$.value.filter(e => e.estado !== 'COMPLETADA');
    if (entregasActivas.length === 0) return { nivelTexto: 'Bajo', puntaje: '1.2/5', sobrecargado: false, urgentes: 0 };

    const ahora = new Date().getTime();
    let puntajeAcumulado = 0;
    let urgentes = 0;

    entregasActivas.forEach(e => {
      let estresBase = Number(e.estres || 3);
      if (e.fechaLimite) {
        const limite = new Date(e.fechaLimite).getTime();
        const diffHoras = (limite - ahora) / (1000 * 60 * 60);
        if (diffHoras > 0 && diffHoras <= 36) {
          estresBase += 2.0;
          urgentes++;
        }
      }
      puntajeAcumulado += estresBase;
    });

    let calculo = (puntajeAcumulado / entregasActivas.length);
    if (urgentes >= 2) calculo += 1.2;
    const finalProm = Math.min(5.0, Math.round(calculo * 10) / 10);
    let texto = 'Moderado';
    if (finalProm >= 4.2) texto = 'Crítico / Muy Alto';
    else if (finalProm >= 3.5) texto = 'Alto';
    else if (finalProm <= 2.0) texto = 'Bajo';

    return { nivelTexto: texto, puntaje: `${finalProm}/5`, sobrecargado: finalProm >= 3.5, urgentes };
  }

  getAlertas(): Observable<any> {
    this.recalcularAlertas();
    return of(this.alertasSubject$.value);
  }

  getDashboardResumen(): Observable<any> {
    const promSueno = this.obtenerPromedioSueno();
    const estresInfo = this.obtenerNivelEstresCalculado();
    const cargaInfo = this.obtenerCalculoCargaEstudio();
    const alertasNoLeidas = this.obtenerConteoAlertasNoLeidas();

    return of({
      suenoAnoche: promSueno,
      promedioSueno: promSueno,
      cargaAcademica: `${cargaInfo.porcentaje}% (${cargaInfo.horasTotales}h)`,
      nivelCarga: cargaInfo.nivelTexto,
      alertasActivas: alertasNoLeidas,
      nivelEstres: estresInfo.nivelTexto,
      estresNivel: estresInfo.puntaje,
      sobrecargado: estresInfo.sobrecargado,
      recomendacion: estresInfo.sobrecargado 
        ? `🚨 ¡TOMA UN DESCANSO!: Tu nivel de estrés académico está en ${estresInfo.puntaje}. Tienes entregas próximas.`
        : 'Carga académica dentro de rangos normales. Continúa con tu ritmo de estudio.'
    });
  }

  // ASIGNATURAS Y ENTREGAS
  getAsignaturas(): Observable<any> { return of(this.asignaturas$.value); }
  createAsignatura(d: any): Observable<any> { this.guardarStorage('vc_asignaturas', [...this.asignaturas$.value, { ...d, id: Date.now() }], this.asignaturas$); this.recalcularAlertas(); return of(d); }
  updateAsignatura(id: any, d: any): Observable<any> { this.guardarStorage('vc_asignaturas', this.asignaturas$.value.map(a => a.id === id ? { ...a, ...d } : a), this.asignaturas$); this.recalcularAlertas(); return of(d); }
  deleteAsignatura(id: any): Observable<any> { this.guardarStorage('vc_asignaturas', this.asignaturas$.value.filter(a => a.id !== id), this.asignaturas$); this.recalcularAlertas(); return of({ success: true }); }

  getEntregas(): Observable<any> { return of(this.entregas$.value); }
  createEntrega(d: any): Observable<any> { this.guardarStorage('vc_entregas', [{ ...d, id: Date.now() }, ...this.entregas$.value], this.entregas$); this.recalcularAlertas(); return of(d); }
  updateEntrega(id: any, d: any): Observable<any> { this.guardarStorage('vc_entregas', this.entregas$.value.map(e => e.id === id ? { ...e, ...d } : e), this.entregas$); this.recalcularAlertas(); return of(d); }
  deleteEntrega(id: any): Observable<any> { this.guardarStorage('vc_entregas', this.entregas$.value.filter(e => e.id !== id), this.entregas$); this.recalcularAlertas(); return of({ success: true }); }

  getSesionesEstudio(): Observable<any> { return of(this.sesionesEstudio$.value); }
  createSesionEstudio(d: any): Observable<any> {
    const act = [{ ...d, id: Date.now() }, ...this.sesionesEstudio$.value];
    this.guardarStorage('vc_estudio', act, this.sesionesEstudio$);
    this.recalcularAlertas();
    return of(d);
  }
  deleteSesionEstudio(id: any): Observable<any> {
    const act = this.sesionesEstudio$.value.filter(s => s.id !== id);
    this.guardarStorage('vc_estudio', act, this.sesionesEstudio$);
    this.recalcularAlertas();
    return of({ success: true });
  }
}