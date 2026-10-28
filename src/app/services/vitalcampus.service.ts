import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VitalCampusService {
  public usuarioActualSubject$ = new BehaviorSubject<any | null>(null);

  public alertasSubject$ = new BehaviorSubject<any[]>([]);
  public asignaturas$ = new BehaviorSubject<any[]>([]);
  public entregas$ = new BehaviorSubject<any[]>([]);
  public sesionesEstudio$ = new BehaviorSubject<any[]>([]);
  public suenos$ = new BehaviorSubject<any[]>([]);

  // RIESGO DINÁMICO REACTIVO
  public porcentajeRiesgoActual$ = new BehaviorSubject<number>(0);
  private ultimaNotificacionAlcanzada60: boolean = false;

  // ESTADO DE PAUSA ACTIVA Y TIEMPO RESTANTE EN SEGUNDOS
  public pausaEnCurso$ = new BehaviorSubject<boolean>(false);
  public segundosRestantesPausa$ = new BehaviorSubject<number>(0);

  public toastNotificacion$ = new BehaviorSubject<any | null>(null);

  public pomodoroActivo: boolean = false;
  public pomodoroSegundosRestantes: number = 25 * 60;
  public pomodoroMinutosConfig: number = 25;
  public distraccionesConteo: number = 0;
  private timerInterval: any = null;
  private timerPausaInterval: any = null;

  constructor() {
    this.cargarSesionUsuario();
  }

  private cargarSesionUsuario(): void {
    const rawUser = localStorage.getItem('vc_usuario_actual');
    if (rawUser) {
      try {
        const usuario = JSON.parse(rawUser);
        this.usuarioActualSubject$.next(usuario);
        this.cargarDatosDelUsuario(usuario.email);
      } catch (e) {
        this.cerrarSesionApp();
      }
    }
  }

  private obtenerUsuariosRegistrados(): any[] {
    const raw = localStorage.getItem('vc_usuarios_registrados');
    return raw ? JSON.parse(raw) : [];
  }

  private cargarDatosDelUsuario(email: string): void {
    if (!email) return;
    const emailKey = email.trim().toLowerCase();
    const key = (prefix: string) => `vc_${emailKey}_${prefix}`;

    const rawAlertas = localStorage.getItem(key('alertas'));
    const alertasCargadas: any[] = rawAlertas ? JSON.parse(rawAlertas) : [];

    const alertasDepuradas = alertasCargadas.filter(a => {
      const titulo = (a.titulo || '').toLowerCase();
      return !titulo.includes('tiempo insuficiente') && 
             !titulo.includes('sesión') && 
             !titulo.includes('registrada') && 
             !titulo.includes('creada');
    });

    this.alertasSubject$.next(alertasDepuradas);
    this.guardarEnStorage('alertas', alertasDepuradas);

    const rawAsignaturas = localStorage.getItem(key('asignaturas'));
    this.asignaturas$.next(rawAsignaturas ? JSON.parse(rawAsignaturas) : []);

    const rawEntregas = localStorage.getItem(key('entregas'));
    this.entregas$.next(rawEntregas ? JSON.parse(rawEntregas) : []);

    const rawSuenos = localStorage.getItem(key('suenos'));
    this.suenos$.next(rawSuenos ? JSON.parse(rawSuenos) : []);

    const rawSesiones = localStorage.getItem(key('sesiones'));
    this.sesionesEstudio$.next(rawSesiones ? JSON.parse(rawSesiones) : []);

    this.actualizarRiesgoBasePorEntregas();
    this.verificarEntregasCercanas();
    this.verificarCalidadSueno();
  }

  private guardarEnStorage(prefix: string, data: any[]): void {
    const usuario = this.usuarioActualSubject$.getValue();
    if (usuario && usuario.email) {
      const emailKey = usuario.email.trim().toLowerCase();
      const key = `vc_${emailKey}_${prefix}`;
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  public actualizarRiesgoBasePorEntregas(): void {
    const estresCalc = this.obtenerNivelEstresCalculado();
    this.porcentajeRiesgoActual$.next(estresCalc.porcentaje);
  }

  public iniciarSesion(correo: string, password: string): Observable<any> {
    const usuarios = this.obtenerUsuariosRegistrados();
    const correoLwr = (correo || '').trim().toLowerCase();

    const usuarioEncontrado = usuarios.find((u: any) => u.email.toLowerCase() === correoLwr);

    if (!usuarioEncontrado) {
      return throwError(() => new Error('El correo electrónico no se encuentra registrado.'));
    }

    if (usuarioEncontrado.password !== password) {
      return throwError(() => new Error('Contraseña incorrecta. Por favor verifica tus datos.'));
    }

    localStorage.setItem('vc_usuario_actual', JSON.stringify(usuarioEncontrado));
    this.usuarioActualSubject$.next(usuarioEncontrado);
    this.cargarDatosDelUsuario(usuarioEncontrado.email);

    return of(usuarioEncontrado);
  }

  public registrarUsuario(datos: any): Observable<any> {
    const usuarios = this.obtenerUsuariosRegistrados();
    const correoLwr = (datos.email || '').trim().toLowerCase();

    const existe = usuarios.some((u: any) => u.email.toLowerCase() === correoLwr);
    if (existe) {
      return throwError(() => new Error('El correo electrónico ya se encuentra registrado.'));
    }

    const nuevoUsuario = {
      nombre: datos.nombre || 'Estudiante VitalCampus',
      email: correoLwr,
      carrera: datos.carrera || 'Ingeniería de Software',
      password: datos.password
    };

    usuarios.push(nuevoUsuario);
    localStorage.setItem('vc_usuarios_registrados', JSON.stringify(usuarios));

    const key = (prefix: string) => `vc_${correoLwr}_${prefix}`;
    localStorage.setItem(key('alertas'), JSON.stringify([]));
    localStorage.setItem(key('asignaturas'), JSON.stringify([]));
    localStorage.setItem(key('entregas'), JSON.stringify([]));
    localStorage.setItem(key('suenos'), JSON.stringify([]));
    localStorage.setItem(key('sesiones'), JSON.stringify([]));

    localStorage.setItem('vc_usuario_actual', JSON.stringify(nuevoUsuario));
    this.usuarioActualSubject$.next(nuevoUsuario);

    this.alertasSubject$.next([]);
    this.asignaturas$.next([]);
    this.entregas$.next([]);
    this.suenos$.next([]);
    this.sesionesEstudio$.next([]);
    this.porcentajeRiesgoActual$.next(0);

    return of({ exito: true, usuario: nuevoUsuario });
  }

  public cerrarSesionApp(): void {
    localStorage.removeItem('vc_usuario_actual');
    this.usuarioActualSubject$.next(null);
    this.alertasSubject$.next([]);
    this.asignaturas$.next([]);
    this.entregas$.next([]);
    this.suenos$.next([]);
    this.sesionesEstudio$.next([]);
    this.porcentajeRiesgoActual$.next(0);
  }

  public mostrarToastGlobal(
    titulo: string, 
    mensaje: string, 
    tipo: 'CRITICA' | 'ADVERTENCIA' | 'INFO' = 'INFO',
    guardarEnCampana: boolean = false,
    idUnicoAlert?: string,
    icono?: string
  ): void {
    const idNotificacion = idUnicoAlert || `alert-${Date.now()}`;

    this.toastNotificacion$.next({
      id: idNotificacion,
      titulo,
      mensaje,
      tipo
    });

    setTimeout(() => {
      this.toastNotificacion$.next(null);
    }, 5000);

    const esTiempoInsuficiente = titulo.toLowerCase().includes('tiempo insuficiente');

    if (guardarEnCampana && (tipo === 'CRITICA' || tipo === 'ADVERTENCIA') && !esTiempoInsuficiente) {
      const actuales = this.alertasSubject$.getValue() || [];
      const yaExiste = actuales.some(a => String(a.id) === String(idNotificacion));

      if (!yaExiste) {
        const nuevaAlerta = {
          id: idNotificacion,
          titulo,
          mensaje,
          tipo,
          icono: icono || (tipo === 'CRITICA' ? '⏰' : '⚠️'),
          leida: false,
          fecha: new Date().toISOString().substring(0, 10)
        };

        const actualizadas = [nuevaAlerta, ...actuales];
        this.alertasSubject$.next(actualizadas);
        this.guardarEnStorage('alertas', actualizadas);
      }
    }
  }

  public cerrarToastGlobal(): void {
    this.toastNotificacion$.next(null);
  }

  // REPRODUCIR SONIDO DE ALARMA MEDIANTE WEB AUDIO API
  public reproducirAlarmaAcustica(frecuencia: number = 880, tipoBip: number = 2): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      for (let i = 0; i < tipoBip; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frecuencia, ctx.currentTime + i * 0.3);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + i * 0.3 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.25);
      }
    } catch (e) {
      console.warn('Audio no soportado o bloqueado por interacción del usuario');
    }
  }

  public incrementarRiesgoPorEstudio(incrementoPorcentaje: number = 2): void {
    // Si se está en pausa activa no sube el riesgo
    if (this.pausaEnCurso$.getValue()) return;

    const actual = this.porcentajeRiesgoActual$.getValue();
    const nuevoRiesgo = Math.min(100, actual + incrementoPorcentaje);
    this.porcentajeRiesgoActual$.next(nuevoRiesgo);

    if (nuevoRiesgo >= 60 && !this.ultimaNotificacionAlcanzada60) {
      this.ultimaNotificacionAlcanzada60 = true;
      this.mostrarToastGlobal(
        'Pausa Activa Recomendada',
        'Tu nivel de carga y fatiga académica alcanzó el 60%. ¡Tómate un descanso de 15 minutos!',
        'ADVERTENCIA',
        true,
        `pausa-riesgo-60-${Date.now()}`,
        '☕'
      );
    }
  }

  // INICIAR PAUSA ACTIVA DE 15 MINUTOS CON CONTEO Y ALARMAS
  public iniciarPausaActiva15Min(): void {
    if (this.timerPausaInterval) clearInterval(this.timerPausaInterval);

    let segundosTotales = 15 * 60; // 15 minutos (900 seg)
    let reduccionTotalRequerida = 30; // -30%
    const reduccionPorSegundo = reduccionTotalRequerida / segundosTotales;

    this.pausaEnCurso$.next(true);
    this.segundosRestantesPausa$.next(segundosTotales);

    this.mostrarToastGlobal(
      '🛋️ ¡Descansa!', 
      'Pausa activa en curso. Tómate 15 minutos para despejar tu mente.', 
      'INFO', 
      false
    );

    this.timerPausaInterval = setInterval(() => {
      segundosTotales--;
      this.segundosRestantesPausa$.next(segundosTotales);

      // Reducción progresiva de la barra de riesgo
      const actual = this.porcentajeRiesgoActual$.getValue();
      if (actual > 0) {
        const nuevoRiesgo = Math.max(0, Math.round((actual - reduccionPorSegundo) * 100) / 100);
        this.porcentajeRiesgoActual$.next(nuevoRiesgo);

        if (nuevoRiesgo < 60) {
          this.ultimaNotificacionAlcanzada60 = false;
        }
      }

      // ALARMA A LOS 5 MINUTOS FALTANTES (Restan 300 segundos = Minuto 10 transcurrido)
      if (segundosTotales === 300) {
        this.reproducirAlarmaAcustica(660, 2);
        this.mostrarToastGlobal(
          '⏰ Quedan 5 Minutos',
          'Faltan solo 5 minutos para finalizar tu descanso de 15 min.',
          'ADVERTENCIA',
          false
        );
      }

      // ALARMA DE FINALIZACIÓN (Llega a 0)
      if (segundosTotales <= 0) {
        clearInterval(this.timerPausaInterval);
        this.timerPausaInterval = null;
        this.pausaEnCurso$.next(false);
        this.segundosRestantesPausa$.next(0);

        this.reproducirAlarmaAcustica(988, 3);
        this.mostrarToastGlobal(
          '🎉 ¡Pausa Finalizada!',
          'Tus 15 minutos de descanso han terminado. ¡Tu nivel de riesgo ha bajado!',
          'INFO',
          false
        );
      }
    }, 1000);
  }

  public getAsignaturas(): Observable<any[]> {
    return of(this.asignaturas$.getValue());
  }

  public createAsignatura(payload: any): Observable<any> {
    const actuales = this.asignaturas$.getValue();
    const nueva = { id: Date.now(), ...payload };
    const actualizadas = [nueva, ...actuales];
    this.asignaturas$.next(actualizadas);
    this.guardarEnStorage('asignaturas', actualizadas);
    return of(nueva);
  }

  public updateAsignatura(id: any, payload: any): Observable<any> {
    const actuales = this.asignaturas$.getValue();
    const actualizadas = actuales.map(a => a.id === id ? { ...a, ...payload } : a);
    this.asignaturas$.next(actualizadas);
    this.guardarEnStorage('asignaturas', actualizadas);
    return of(payload);
  }

  public deleteAsignatura(id: any): Observable<any> {
    const actuales = this.asignaturas$.getValue().filter(a => a.id !== id);
    this.asignaturas$.next(actuales);
    this.guardarEnStorage('asignaturas', actuales);
    return of(true);
  }

  public verificarEntregasCercanas(): void {
    const entregas = this.entregas$.getValue() || [];
    const ahora = new Date().getTime();

    entregas.forEach(e => {
      if (e.estado !== 'COMPLETADA' && e.fechaLimite) {
        const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
        const diffHoras = (limite - ahora) / (1000 * 60 * 60);

        if (diffHoras <= 36) {
          const idAlertaUnica = `entrega-cercana-${e.id}`;
          const yaAlertado = this.alertasSubject$.getValue().some(a => String(a.id) === String(idAlertaUnica));

          if (!yaAlertado) {
            this.mostrarToastGlobal(
              'Entrega Próxima',
              `El trabajo "${e.titulo}" de ${e.asignatura || 'materia'} vence pronto.`,
              'CRITICA',
              true,
              idAlertaUnica,
              '⏰'
            );
          }
        }
      }
    });

    this.actualizarRiesgoBasePorEntregas();
  }

  public verificarCalidadSueno(): void {
    const suenos = this.suenos$.getValue() || [];
    const alertasSinSueno = this.alertasSubject$.getValue().filter(a => !String(a.id).startsWith('sueno-bajo-'));
    
    if (suenos.length > 0) {
      const mapaFechas: { [fecha: string]: number } = {};
      suenos.forEach(s => {
        const fecha = s.fecha || new Date().toISOString().substring(0, 10);
        const horasNum = Number(s.horasCalculadas || s.duracion || 0);
        mapaFechas[fecha] = (mapaFechas[fecha] || 0) + horasNum;
      });

      const fechasOrdenadas = Object.keys(mapaFechas).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (fechasOrdenadas.length > 0) {
        const ultimaFecha = fechasOrdenadas[0];
        const totalHorasDia = Math.round(mapaFechas[ultimaFecha] * 10) / 10;

        if (totalHorasDia < 6) {
          const idAlertaSueno = `sueno-bajo-${ultimaFecha}`;
          const nuevaAlerta = {
            id: idAlertaSueno,
            titulo: 'Descanso Insuficiente',
            mensaje: `Registraste ${totalHorasDia}h de sueño el ${ultimaFecha}. Te recomendamos descansar adecuadamente.`,
            tipo: 'ADVERTENCIA',
            icono: '🌙',
            leida: false,
            fecha: ultimaFecha
          };

          const actualizadas = [nuevaAlerta, ...alertasSinSueno];
          this.alertasSubject$.next(actualizadas);
          this.guardarEnStorage('alertas', actualizadas);
          return;
        }
      }
    }

    this.alertasSubject$.next(alertasSinSueno);
    this.guardarEnStorage('alertas', alertasSinSueno);
  }

  public createEntrega(payload: any): Observable<any> {
    const actuales = this.entregas$.getValue();
    const nueva = { id: Date.now(), estado: 'PENDIENTE', ...payload };
    const actualizadas = [nueva, ...actuales];
    this.entregas$.next(actualizadas);
    this.guardarEnStorage('entregas', actualizadas);
    
    this.verificarEntregasCercanas();
    return of(nueva);
  }

  public cambiarEstadoEntrega(id: any, nuevoEstado: string): Observable<any> {
    const actuales = this.entregas$.getValue();
    const actualizadas = actuales.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e);
    this.entregas$.next(actualizadas);
    this.guardarEnStorage('entregas', actualizadas);

    if (nuevoEstado === 'COMPLETADA') {
      const idAlerta = `entrega-cercana-${id}`;
      this.eliminarAlertaPorId(idAlerta);
    }

    this.actualizarRiesgoBasePorEntregas();
    return of(true);
  }

  public deleteEntrega(id: any): Observable<any> {
    const actuales = this.entregas$.getValue().filter(e => e.id !== id);
    this.entregas$.next(actuales);
    this.guardarEnStorage('entregas', actuales);

    const idAlerta = `entrega-cercana-${id}`;
    this.eliminarAlertaPorId(idAlerta);

    this.actualizarRiesgoBasePorEntregas();
    return of(true);
  }

  public eliminarAlertaPorId(id: any): void {
    const actuales = this.alertasSubject$.getValue().filter(a => String(a.id) !== String(id));
    this.alertasSubject$.next(actuales);
    this.guardarEnStorage('alertas', actuales);
  }

  public createSueno(payload: any): Observable<any> {
    const actuales = this.suenos$.getValue();
    const horasNum = Number(payload.horasCalculadas || payload.duracion || 0);
    const registroCorregido = {
      ...payload,
      id: Date.now(),
      horasCalculadas: horasNum,
      duracion: horasNum
    };

    const actualizadas = [registroCorregido, ...actuales];
    this.suenos$.next(actualizadas);
    this.guardarEnStorage('suenos', actualizadas);

    this.verificarCalidadSueno();
    return of(registroCorregido);
  }

  public deleteSueno(id: any): Observable<any> {
    const actuales = this.suenos$.getValue().filter(s => s.id !== id);
    this.suenos$.next(actuales);
    this.guardarEnStorage('suenos', actuales);
    this.verificarCalidadSueno();
    return of(true);
  }

  public iniciarPomodoro(minutos: number): void {
    this.pomodoroMinutosConfig = minutos;
    this.pomodoroSegundosRestantes = minutos * 60;
    this.pomodoroActivo = true;

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.pomodoroSegundosRestantes > 0) {
        this.pomodoroSegundosRestantes--;
        // Incremento leve progresivo de fatiga mientras estudia
        this.incrementarRiesgoPorEstudio(0.05);
      } else {
        this.pausarPomodoro();
      }
    }, 1000);
  }

  public pausarPomodoro(): void {
    this.pomodoroActivo = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public registrarDistraccion(): void {
    this.distraccionesConteo++;
    this.pomodoroSegundosRestantes += 120;
    this.mostrarToastGlobal(
      'Distracción Detectada',
      'Cambiaste de pestaña en modo estricto (+2 min añadidos).',
      'ADVERTENCIA',
      true,
      `distraccion-${Date.now()}`,
      '⚠️'
    );
  }

  public createSesionEstudio(payload: any): Observable<any> {
    const actuales = this.sesionesEstudio$.getValue() || [];
    const nueva = { id: Date.now(), ...payload };
    const actualizadas = [nueva, ...actuales];
    
    this.sesionesEstudio$.next(actualizadas);
    this.guardarEnStorage('sesiones', actualizadas);
    
    // Al registrar una sesión de estudio se incrementa proporcionalmente la carga
    const minutos = Number(payload.duracionMinutos || 0);
    this.incrementarRiesgoPorEstudio(Math.min(15, Math.round(minutos / 5)));

    return of(nueva);
  }

  public deleteSesionEstudio(id: any): Observable<any> {
    const actuales = this.sesionesEstudio$.getValue().filter(s => s.id !== id);
    this.sesionesEstudio$.next(actuales);
    this.guardarEnStorage('sesiones', actuales);
    return of(true);
  }

  // CÁLCULO RIGUROSO Y CORREGIDO DEL ESTRÉS (0/5 SI NO HAY TAREAS URGENTES)
  public obtenerNivelEstresCalculado(): { porcentaje: number; sobrecargado: boolean; urgentes: number } {
    const entregas = this.entregas$.getValue() || [];
    const ahora = new Date().getTime();

    const entregasPendientes = entregas.filter(e => e.estado !== 'COMPLETADA');

    if (entregasPendientes.length === 0) {
      return { porcentaje: 0, sobrecargado: false, urgentes: 0 };
    }

    const entregasUrgentes = entregasPendientes.filter(e => {
      if (!e.fechaLimite) return false;
      const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
      const diffHoras = (limite - ahora) / (1000 * 60 * 60);
      return diffHoras <= 36;
    });

    if (entregasUrgentes.length === 0) {
      return { porcentaje: 0, sobrecargado: false, urgentes: 0 };
    }

    const porcentajeBase = Math.min(100, entregasUrgentes.length * 40);
    return { porcentaje: porcentajeBase, sobrecargado: porcentajeBase >= 50, urgentes: entregasUrgentes.length };
  }

  public limpiarTodasLasAlertas(): void {
    this.alertasSubject$.next([]);
    this.guardarEnStorage('alertas', []);
  }

  public getDashboardResumen(): Observable<any> {
    const asigs = this.asignaturas$.getValue() || [];
    const suenos = this.suenos$.getValue() || [];

    const cargaPorcentaje = Math.min(100, asigs.length * 25);
    let nivelCargaTexto = 'Sin Asignaturas';
    if (asigs.length >= 4) nivelCargaTexto = 'Alta';
    else if (asigs.length >= 2) nivelCargaTexto = 'Equilibrada';
    else if (asigs.length === 1) nivelCargaTexto = 'Baja';

    let suenoAnocheTexto = '0h';
    let promedioSuenoTexto = '0h';

    if (suenos.length > 0) {
      const mapaFechas: { [fecha: string]: number } = {};

      suenos.forEach(s => {
        const fecha = s.fecha || new Date().toISOString().substring(0, 10);
        const horasNum = Number(s.horasCalculadas || s.duracion || 0);

        if (horasNum > 0) {
          mapaFechas[fecha] = Number((mapaFechas[fecha] || 0) + horasNum);
        }
      });

      const fechasOrdenadas = Object.keys(mapaFechas).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      if (fechasOrdenadas.length > 0) {
        const fechaMasReciente = fechasOrdenadas[0];
        const totalReciente = Math.round(mapaFechas[fechaMasReciente] * 10) / 10;
        suenoAnocheTexto = `${totalReciente}h`;

        const sumaTotal = Object.values(mapaFechas).reduce((acc, h) => acc + h, 0);
        const promedio = Math.round((sumaTotal / fechasOrdenadas.length) * 10) / 10;
        promedioSuenoTexto = `${promedio}h`;
      }
    }

    const estresCalc = this.obtenerNivelEstresCalculado();

    let estresNivel = '0/5';
    let nivelEstres = 'Sin Riesgo';

    if (estresCalc.porcentaje >= 70) {
      estresNivel = '4/5';
      nivelEstres = 'Alto';
    } else if (estresCalc.porcentaje >= 35) {
      estresNivel = '2/5';
      nivelEstres = 'Moderado';
    } else if (estresCalc.porcentaje > 0) {
      estresNivel = '1/5';
      nivelEstres = 'Bajo';
    } else {
      estresNivel = '0/5';
      nivelEstres = 'Sin Riesgo';
    }

    return of({
      suenoAnoche: suenoAnocheTexto,
      promedioSueno: promedioSuenoTexto,
      cargaAcademica: `${cargaPorcentaje}%`,
      nivelCarga: nivelCargaTexto,
      nivelEstres: nivelEstres,
      estresNivel: estresNivel,
      recomendacion: asigs.length === 0 
        ? 'Aún no has registrado asignaturas. Agrega tus materias para llevar el control de tu carga.' 
        : 'Mantén el ritmo. Recuerda realizar pausas cortas durante tus sesiones de estudio.'
    });
  }
}