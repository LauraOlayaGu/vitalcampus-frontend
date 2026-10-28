import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AuthComponent {
  isLoginMode: boolean = true;

  // CAMPOS DE FORMULARIO
  nombre: string = '';
  correo: string = '';
  carrera: string = 'Ingeniería de Software';
  password: string = '';
  confirmPassword: string = '';

  errorMensaje: string = '';
  exitoMensaje: string = '';
  cargando: boolean = false;

  // LISTA EXACTA DE PROGRAMAS ACADÉMICOS DE LA INSTITUCIÓN
  carrerasDisponibles: string[] = [
    'Ingeniería Eléctrica',
    'Ingeniería de Software',
    'Seguridad y Salud en el Trabajo',
    'Ingeniería de Alimentos'
  ];

  constructor(
    private vitalCampusService: VitalCampusService,
    private router: Router
  ) {}

  cambiarModo(isLogin: boolean): void {
    this.isLoginMode = isLogin;
    this.errorMensaje = '';
    this.exitoMensaje = '';
  }

  onSubmit(): void {
    if (this.isLoginMode) {
      this.procesarLogin();
    } else {
      this.procesarRegistro();
    }
  }

  private procesarLogin(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    if (!this.correo.trim()) {
      this.errorMensaje = 'Por favor ingresa tu correo institucional.';
      return;
    }

    if (!this.password) {
      this.errorMensaje = 'Por favor ingresa tu contraseña.';
      return;
    }

    this.cargando = true;

    this.vitalCampusService.iniciarSesion(this.correo, this.password).subscribe({
      next: () => {
        this.cargando = false;
        this.vitalCampusService.mostrarToastGlobal('Bienvenido/a', 'Sesión iniciada correctamente', 'INFO', false);
        this.router.navigate(['/resumen']);
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorMensaje = err.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  private procesarRegistro(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    if (!this.nombre.trim()) {
      this.errorMensaje = 'Por favor ingresa tu nombre completo.';
      return;
    }

    const correoLwr = this.correo.trim().toLowerCase();
    if (!correoLwr) {
      this.errorMensaje = 'Por favor ingresa tu correo institucional.';
      return;
    }

    // VALIDACIÓN DE DOMINIO INSTITUCIONAL (@fet.edu.co)
    if (!correoLwr.endsWith('@fet.edu.co')) {
      this.errorMensaje = 'Debes usar un correo institucional válido terminado en @fet.edu.co';
      return;
    }

    if (!this.password) {
      this.errorMensaje = 'Por favor crea una contraseña.';
      return;
    }

    if (this.password.length < 3) {
      this.errorMensaje = 'La contraseña debe tener al menos 3 caracteres.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;

    const datosRegistro = {
      nombre: this.nombre.trim(),
      email: correoLwr,
      carrera: this.carrera,
      password: this.password
    };

    this.vitalCampusService.registrarUsuario(datosRegistro).subscribe({
      next: () => {
        this.cargando = false;
        this.exitoMensaje = '🎉 ¡Cuenta creada con éxito! Iniciando sesión automáticamente...';
        
        setTimeout(() => {
          this.vitalCampusService.iniciarSesion(correoLwr, this.password).subscribe(() => {
            this.router.navigate(['/resumen']);
          });
        }, 1000);
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorMensaje = err.message || 'Error al crear la cuenta. El correo podría estar en uso.';
      }
    });
  }
}