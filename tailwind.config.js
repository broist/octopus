import forms from '@tailwindcss/forms';
import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './resources/views/**/*.blade.php',
        './resources/js/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                // Deep green sidebar family (spec §6).
                sidebar: {
                    DEFAULT: '#21382E', // menüsáv háttér
                    active: '#345742',  // aktív menüpont
                    hover: '#2b4a3b',
                },
                accent: {
                    DEFAULT: '#2E6B4F', // akcent / haladás zöld
                    50: '#eef5f0',
                    100: '#d5e7dc',
                    500: '#2E6B4F',
                    600: '#255c43',
                    700: '#1e4a36',
                },
                cream: '#F6F3EC',       // tartalom háttér
                card: '#FFFFFF',        // kártya háttér
                line: '#EAE5DB',        // kártya / keret szín
                coral: '#C0503A',       // sürgős / csúszás
                amberwarn: '#C98A2B',   // figyelmeztetés
                wood: 'rgba(216,182,132,0.07)', // fa-gerenda tónus
                ink: {
                    DEFAULT: '#2b2b28',
                    soft: '#5b5b52',
                    faint: '#8a8a7e',
                },
            },
            fontFamily: {
                sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', ...defaultTheme.fontFamily.sans],
            },
            borderRadius: {
                // Crisper, more squared corners than the Tailwind defaults
                // (spec §6 allows an angular direction). "full" is left intact
                // for genuinely round elements (status dots).
                none: '0px',
                sm: '2px',
                DEFAULT: '3px',
                md: '3px',
                lg: '4px',
                xl: '5px',
                '2xl': '6px',
                '3xl': '8px',
                card: '4px', // finom lekerekítés a kártyákon (spec §6)
            },
            boxShadow: {
                card: '0 1px 2px rgba(33, 56, 46, 0.05), 0 1px 3px rgba(33, 56, 46, 0.035)',
                beam: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.25)',
                'beam-active': 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 0 rgba(0,0,0,0.30)',
            },
        },
    },
    plugins: [forms],
};
