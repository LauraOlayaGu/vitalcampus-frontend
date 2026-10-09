import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { ResumenComponent } from './components/resumen/resumen.component';
import { SuenoComponent } from './components/sueno/sueno.component';
import { AsignaturasComponent } from './components/asignaturas/asignaturas.component';
import { EntregasComponent } from './components/entregas/entregas.component';
import { EstudioComponent } from './components/estudio/estudio.component';
import { AlertasComponent } from './components/alertas/alertas.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AuthComponent },
  { path: 'resumen', component: ResumenComponent },
  { path: 'sueno', component: SuenoComponent },
  { path: 'asignaturas', component: AsignaturasComponent },
  { path: 'entregas', component: EntregasComponent },
  { path: 'estudio', component: EstudioComponent },
  { path: 'alertas', component: AlertasComponent },
  { path: '**', redirectTo: 'login' }
];