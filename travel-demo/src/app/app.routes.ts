import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/travel-chat/components/chat-page/chat-page.component').then(
        (m) => m.ChatPageComponent
      ),
  },
];
