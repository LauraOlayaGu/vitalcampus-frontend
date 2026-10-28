import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { ResumenComponent } from './components/resumen/resumen.component';
import { SuenoComponent } from './components/sueno/sueno.component';
import { AsignaturasComponent } from './components/asignaturas/asignaturas.component';
import { EntregasComponent } from './components/entregas/entregas.component';
import { EstudioComponent } from './components/estudio/estudio.component';

export const routes: Routes = [
  { path: '', redirectTo: 'resumen', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'resumen', component: ResumenComponent },
  { path: 'sueno', component: SuenoComponent },
  { path: 'asignaturas', component: AsignaturasComponent },
  { path: 'entregas', component: EntregasComponent },
  { path: 'estudio', component: EstudioComponent },
  // Redirigir alertas directamente al resumen
  { path: 'alertas', redirectTo: 'resumen' },
  { path: '**', redirectTo: 'resumen' }
];