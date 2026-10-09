import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  isLoginMode: boolean = true;
  errorMensaje: string = '';
  exitoMensaje: string = '';

  // Campos de formulario
  nombreCompleto: string = '';
  carreraSeleccionada: string = '';
  correo: string = '';
  password: string = '';
  confirmPassword: string = '';

  // Lista oficial de programas académicos de la FET
  carrerasFET: string[] = [
    'Ingeniería de Software',
    'Ingeniería Eléctrica',
    'Ingeniería Ambiental',
    'Ingeniería de Alimentos',
    'Seguridad y Salud en el Trabajo',
    'Gestión de Redes y Servicios Telemáticos'
  ];

  private regexCorreoFET: RegExp = /^[a-z0-9._%+-]+@fet\.edu\.co$/i;

  constructor(
    private router: Router,
    private vitalCampusService: VitalCampusService
  ) {}

  cambiarModo(isLogin: boolean): void {
    this.isLoginMode = isLogin;
    this.errorMensaje = '';
    this.exitoMensaje = '';
  }

  validarCorreoFET(email: string): boolean {
    return this.regexCorreoFET.test(email.trim());
  }

  onSubmit(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    const correoLimpio = this.correo.trim().toLowerCase();

    if (!this.validarCorreoFET(correoLimpio)) {
      this.errorMensaje = 'Ingresa un correo institucional FET válido. Ejemplo: laura_olayagu@fet.edu.co';
      return;
    }

    if (this.isLoginMode) {
      // INICIO DE SESIÓN
      if (!this.password) {
        this.errorMensaje = 'Por favor ingresa tu contraseña.';
        return;
      }

      this.vitalCampusService.iniciarSesion(correoLimpio, this.password).subscribe({
        next: (usuario) => {
          this.exitoMensaje = `¡Bienvenido de nuevo, ${usuario.nombre || 'Estudiante'}!`;
          setTimeout(() => {
            this.router.navigate(['/resumen']);
          }, 1000);
        },
        error: (err) => {
          this.errorMensaje = err.error?.mensaje || 'Error al iniciar sesión.';
        }
      });

    } else {
      // CREAR CUENTA
      if (!this.nombreCompleto.trim()) {
        this.errorMensaje = 'Por favor ingresa tu nombre completo.';
        return;
      }
      if (!this.carreraSeleccionada) {
        this.errorMensaje = 'Por favor selecciona tu carrera o programa académico.';
        return;
      }
      if (this.password.length < 6) {
        this.errorMensaje = 'La contraseña debe tener mínimo 6 caracteres.';
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMensaje = 'Las contraseñas no coinciden.';
        return;
      }

      this.vitalCampusService.registrarUsuario({
        nombre: this.nombreCompleto.trim(),
        carrera: this.carreraSeleccionada,
        correo: correoLimpio,
        password: this.password
      }).subscribe({
        next: () => {
          this.exitoMensaje = '¡Cuenta registrada con éxito! Redirigiendo al inicio de sesión...';
          setTimeout(() => {
            this.cambiarModo(true);
          }, 1500);
        },
        error: (err) => {
          this.errorMensaje = err.error?.mensaje || 'Error al registrar el usuario.';
        }
      });
    }
  }
}