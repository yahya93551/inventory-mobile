export const phoneCountryOptions = [
  { code: '+252', country: 'Somalia', flag: '🇸🇴' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
] as const;

export function normalizePhoneNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

export function isPhoneNumber(phone: string) {
  return /^\+\d{7,15}$/.test(normalizePhoneNumber(phone));
}

export function splitPhoneNumber(phone: string, defaultCode = '+252') {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return { countryCode: defaultCode, phone: '' };

  const country = [...phoneCountryOptions].sort((a, b) => b.code.length - a.code.length)
    .find((option) => normalized.startsWith(option.code));
  if (!country) return { countryCode: defaultCode, phone: normalized.slice(1) };

  return { countryCode: country.code, phone: normalized.slice(country.code.length) };
}
