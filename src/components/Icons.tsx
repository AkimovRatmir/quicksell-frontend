export function LogoMark({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  const height = (size * 24) / 21;
  return (
    <svg width={size} height={height} viewBox="0 0 21 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.9257 12C11.2564 19.0588 10.8444 24 10.3362 24C9.82798 24 9.49964 18.9706 8.66309 12C9.24868 4.94118 9.82798 0 10.3362 0C10.8444 0 11.2564 5.11765 11.9257 12Z"
        fill={color}
      />
      <path
        d="M10.1538 13.4193C4.18092 12.7311 -7.63869e-05 12.3075 -7.63652e-05 11.7849C-7.63436e-05 11.2623 4.25558 10.9247 10.1538 10.0645C16.1266 10.6666 20.3076 11.2623 20.3076 11.7849C20.3076 12.3075 15.9773 12.7311 10.1538 13.4193Z"
        fill={color}
      />
    </svg>
  );
}

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.6 10.7a2.1 2.1 0 0 1 .78-1.63l6.3-5.1a2.1 2.1 0 0 1 2.64 0l6.3 5.1a2.1 2.1 0 0 1 .78 1.63V19a2.4 2.4 0 0 1-2.4 2.4H6A2.4 2.4 0 0 1 3.6 19z" />
      <path d="M9.2 21.4v-5.5a2.8 2.8 0 0 1 5.6 0v5.5" />
    </svg>
  );
}

export function IconFinance() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 20.2V4.6" />
      <path d="M4.1 8.5 8 4.6l3.9 3.9" />
      <path d="M16 3.8v15.6" />
      <path d="M12.1 15.5 16 19.4l3.9-3.9" />
    </svg>
  );
}

export function IconProducts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.4 21 7.2v9.6L12 21.6 3 16.8V7.2z" />
      <path d="M3 7.2 12 12l9-4.8" />
      <path d="M12 12v9.6" />
    </svg>
  );
}

export function IconUnitEconomics() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.8" y="2.2" width="16.4" height="19.6" rx="2.8" />
      <path d="M7.6 6.9h8.8" />
      <path d="M8 11.7h.01M12 11.7h.01M16 11.7h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="4.5" strokeLinecap="round" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  );
}

/** Кнопка меню на телефоне — открывает боковую панель поверх страницы. */
export function IconMenu() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3.5h10M2 7h10M2 10.5h10" strokeLinecap="round" />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M7 1.5a4 4 0 014 4v2.5l1 1.5H2L3 8V5.5a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 11.5a1.5 1.5 0 003 0" strokeLinecap="round" />
    </svg>
  );
}

export function IconTariff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.2" y="4" width="19.6" height="16" rx="2.8" />
      <path d="M2.2 9.5h19.6" />
      <path d="M6.2 14.9h4.4" />
    </svg>
  );
}

export function IconLogout() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 6H10M8 3.5L10.5 6 8 8.5M1.5 9.5V2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEye() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconEyeOff() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2 2l12 12" strokeLinecap="round" />
      <path d="M6.5 6.5A2 2 0 0 0 9.5 9.5" strokeLinecap="round" />
      <path d="M4 4.5C2.5 5.7 1 8 1 8s2.5 5 7 5c1.3 0 2.5-.4 3.5-1" strokeLinecap="round" />
      <path d="M10 3.8C11.5 4.8 13 7 13 7s-.6 1.2-1.5 2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconExternalLink() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <path d="M2 8L8 2M8 2H3.5M8 2V6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="11" height="12" viewBox="0 0 12 14" fill="none">
      <path d="M6 1L1.5 3v3.5C1.5 9.5 3.4 12 6 13c2.6-1 4.5-3.5 4.5-6.5V3L6 1z" stroke="#5DCAA5" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4.2 7l1.3 1.3L8 5.8" stroke="#5DCAA5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
