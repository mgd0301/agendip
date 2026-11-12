import { createGlobalStyle } from 'styled-components';

export const theme = {
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  primarySoft: '#eff4ff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  bg: '#f5f7fb',
  surface: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  radius: '10px',
  mobile: '(max-width: 768px)',
};

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: ${theme.text};
    background: ${theme.bg};
    -webkit-font-smoothing: antialiased;
  }
  button, input, select, textarea { font: inherit; color: inherit; }
  a { color: ${theme.primary}; text-decoration: none; }
  h1, h2, h3, h4 { margin: 0; font-weight: 600; }
  :focus-visible { outline: 2px solid ${theme.primary}; outline-offset: 2px; }

  /* Al imprimir (ej. historia clínica) solo sale el contenido de la página. */
  .solo-print { display: none; }
  @media print {
    aside, header, nav, .no-print { display: none !important; }
    .solo-print { display: block; }
    html, body, #root { height: auto; background: #fff; }
  }
`;
