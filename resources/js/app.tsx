import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as ziggyRoute } from 'ziggy-js';

// Expose Ziggy's route() helper globally; it reads window.Ziggy set by @routes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).route = ziggyRoute;

const appName = import.meta.env.VITE_APP_NAME || 'Octopus';

createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#2E6B4F',
        showSpinner: false,
    },
});
