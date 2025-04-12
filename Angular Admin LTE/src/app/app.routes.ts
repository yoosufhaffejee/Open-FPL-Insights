import { Routes } from '@angular/router';
import { FixturesComponent } from './components/fixtures/fixtures.component';
import { LeaguesComponent } from './components/leagues/leagues.component';
import { ManagersComponent } from './components/managers/managers.component'; 
import { TeamComponent } from './components/team/team.component';

export const routes: Routes = [
    { path: '', component: TeamComponent },
    { path: 'fixtures', component: FixturesComponent },
    { path: 'leagues', component: LeaguesComponent },
    { path: 'managers', component: ManagersComponent },
];

