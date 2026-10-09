import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.component.html',
  styleUrls: ['./resumen.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class ResumenComponent implements OnInit {
  cargando: boolean = false;

  dashboardData: any = {
    suenoAnoche: '0h',
    promedioSueno: '0h',
    cargaAcademica: '0%',
    nivelCarga: 'Baja',
    alertasActivas: 0,
    nivelEstres: 'Bajo',
    estresNivel: '1/5',
    recomendacion: 'Cargando análisis de bienestar...'
  };

  diagramaPicos: any[] = [];
  pathLineaSvg: string = '';
  pathAreaSvg: string = '';
  entregasProximas: any[] = [];
  proximaClaseHoy: any = null;

  constructor(private vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.cargarResumen();
    this.obtenerGraficoPicosSueno();
    this.obtenerProximasEntregas();
    this.obtenerProximaClaseDelDia();
  }

  cargarResumen(): void {
    this.cargando = true;
    this.vitalCampusService.getDashboardResumen().subscribe({
      next: (data: any) => {
        if (data) {
          this.dashboardData = { ...this.dashboardData, ...data };
        }
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  // GENERAR GRÁFICO DE PICOS Y CURVA DE SUEÑO (SVG)
  obtenerGraficoPicosSueno(): void {
    this.vitalCampusService.suenos$.subscribe(suenos => {
      const diasSemana = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
      const horasPorDia: { [key: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };

      // Calcular la semana actual (Lunes a Domingo)
      const hoy = new Date();
      const diaSemanaIndex = (hoy.getDay() + 6) % 7;
      
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - diaSemanaIndex);
      inicioSemana.setHours(0, 0, 0, 0);

      const finSemana = new Date(inicioSemana);
      finSemana.setDate(inicioSemana.getDate() + 6);
      finSemana.setHours(23, 59, 59, 999);

      suenos.forEach(s => {
        if (s.fecha) {
          const fechaReg = new Date(s.fecha + 'T00:00:00');
          if (fechaReg >= inicioSemana && fechaReg <= finSemana) {
            const index = (fechaReg.getDay() + 6) % 7;
            const claveDia = diasSemana[index];
            horasPorDia[claveDia] += Number(s.horasCalculadas || 0);
          }
        }
      });

      // Dimensiones del canvas SVG interno
      const width = 320;
      const height = 130;
      const paddingX = 25;
      const paddingY = 20;
      const maxHoras = 12; // Techo de 12 horas en la gráfica

      const stepX = (width - paddingX * 2) / (diasSemana.length - 1);

      const puntos = diasSemana.map((dia, i) => {
        const h = Math.round(horasPorDia[dia] * 10) / 10;
        const x = paddingX + i * stepX;
        // Calcular Y invertido (0 arriba, height abajo)
        const porcentajeH = Math.min(1, h / maxHoras);
        const y = (height - paddingY) - (porcentajeH * (height - paddingY * 2));

        return {
          dia,
          horas: h,
          x,
          y,
          esDeficit: h > 0 && h < 6,
          esOptimo: h >= 6
        };
      });

      this.diagramaPicos = puntos;

      // Generar línea de picos SVG
      if (puntos.length > 0) {
        let pathLine = `M ${puntos[0].x} ${puntos[0].y}`;
        for (let i = 1; i < puntos.length; i++) {
          pathLine += ` L ${puntos[i].x} ${puntos[i].y}`;
        }
        this.pathLineaSvg = pathLine;

        // CERRAR ÁREA INFERIOR PARA GRADIENTE
        const primerX = puntos[0].x;
        const ultimoX = puntos[puntos.length - 1].x;
        const baseY = height - 10;
        this.pathAreaSvg = `${pathLine} L ${ultimoX} ${baseY} L ${primerX} ${baseY} Z`;
      }
    });
  }

  obtenerProximasEntregas(): void {
    this.vitalCampusService.entregas$.subscribe(entregas => {
      const ahora = new Date().getTime();

      this.entregasProximas = entregas
        .filter(e => e.estado !== 'COMPLETADA')
        .map(e => {
          let horasRestantes = 999;
          let esUrgente = false;
          let textoTiempo = 'Próximamente';

          if (e.fechaLimite) {
            const limite = new Date(e.fechaLimite).getTime();
            const diffMs = limite - ahora;
            horasRestantes = diffMs / (1000 * 60 * 60);

            if (horasRestantes < 0) {
              textoTiempo = 'Vencida';
            } else if (horasRestantes <= 24) {
              textoTiempo = `Vence hoy / en ${Math.round(horasRestantes)}h`;
              esUrgente = true;
            } else if (horasRestantes <= 48) {
              textoTiempo = `Mañana (${Math.round(horasRestantes)}h restantes)`;
              esUrgente = true;
            } else {
              const dias = Math.round(horasRestantes / 24);
              textoTiempo = `En ${dias} días`;
            }
          }

          return {
            ...e,
            horasRestantes,
            esUrgente,
            textoTiempo
          };
        })
        .sort((a, b) => a.horasRestantes - b.horasRestantes)
        .slice(0, 3);
    });
  }

  obtenerProximaClaseDelDia(): void {
    this.vitalCampusService.asignaturas$.subscribe(asignaturas => {
      const diasMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const diaHoy = diasMap[new Date().getDay()];

      const claseHoy = asignaturas.find(a => a.diaClase === diaHoy);
      this.proximaClaseHoy = claseHoy || null;
    });
  }
}