// Country calling codes for the optional phone field on signup.
//
// Keyed by ISO 3166-1 alpha-2 rather than by dial code, because dial codes
// are not unique (+1 is the US and Canada, +7 is Russia and Kazakhstan) and
// Radix's Select needs a unique value per item. Ordered by country name —
// Radix Select has built-in type-ahead, so typing "kos" jumps to Kosovo
// without needing a search box.
export type CallingCode = {
  /** ISO 3166-1 alpha-2 — the stored value. */
  iso: string
  /** Dial code without the leading "+". */
  dial: string
  name: string
  flag: string
}

// Kosovo (+383, assigned 2016) matters here specifically — it's the
// land-succession use case in CLAUDE.md, and plenty of generated lists
// still omit it.
export const CALLING_CODES: CallingCode[] = [
  { iso: 'AF', dial: '93', name: 'Afghanistan', flag: '🇦🇫' },
  { iso: 'AL', dial: '355', name: 'Albania', flag: '🇦🇱' },
  { iso: 'DZ', dial: '213', name: 'Algeria', flag: '🇩🇿' },
  { iso: 'AD', dial: '376', name: 'Andorra', flag: '🇦🇩' },
  { iso: 'AR', dial: '54', name: 'Argentina', flag: '🇦🇷' },
  { iso: 'AM', dial: '374', name: 'Armenia', flag: '🇦🇲' },
  { iso: 'AU', dial: '61', name: 'Australia', flag: '🇦🇺' },
  { iso: 'AT', dial: '43', name: 'Austria', flag: '🇦🇹' },
  { iso: 'AZ', dial: '994', name: 'Azerbaijan', flag: '🇦🇿' },
  { iso: 'BH', dial: '973', name: 'Bahrain', flag: '🇧🇭' },
  { iso: 'BD', dial: '880', name: 'Bangladesh', flag: '🇧🇩' },
  { iso: 'BY', dial: '375', name: 'Belarus', flag: '🇧🇾' },
  { iso: 'BE', dial: '32', name: 'Belgium', flag: '🇧🇪' },
  { iso: 'BA', dial: '387', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { iso: 'BR', dial: '55', name: 'Brazil', flag: '🇧🇷' },
  { iso: 'BG', dial: '359', name: 'Bulgaria', flag: '🇧🇬' },
  { iso: 'KH', dial: '855', name: 'Cambodia', flag: '🇰🇭' },
  { iso: 'CM', dial: '237', name: 'Cameroon', flag: '🇨🇲' },
  { iso: 'CA', dial: '1', name: 'Canada', flag: '🇨🇦' },
  { iso: 'CL', dial: '56', name: 'Chile', flag: '🇨🇱' },
  { iso: 'CN', dial: '86', name: 'China', flag: '🇨🇳' },
  { iso: 'CO', dial: '57', name: 'Colombia', flag: '🇨🇴' },
  { iso: 'CR', dial: '506', name: 'Costa Rica', flag: '🇨🇷' },
  { iso: 'CI', dial: '225', name: 'Côte d’Ivoire', flag: '🇨🇮' },
  { iso: 'HR', dial: '385', name: 'Croatia', flag: '🇭🇷' },
  { iso: 'CY', dial: '357', name: 'Cyprus', flag: '🇨🇾' },
  { iso: 'CZ', dial: '420', name: 'Czechia', flag: '🇨🇿' },
  { iso: 'DK', dial: '45', name: 'Denmark', flag: '🇩🇰' },
  { iso: 'EC', dial: '593', name: 'Ecuador', flag: '🇪🇨' },
  { iso: 'EG', dial: '20', name: 'Egypt', flag: '🇪🇬' },
  { iso: 'EE', dial: '372', name: 'Estonia', flag: '🇪🇪' },
  { iso: 'ET', dial: '251', name: 'Ethiopia', flag: '🇪🇹' },
  { iso: 'FI', dial: '358', name: 'Finland', flag: '🇫🇮' },
  { iso: 'FR', dial: '33', name: 'France', flag: '🇫🇷' },
  { iso: 'GE', dial: '995', name: 'Georgia', flag: '🇬🇪' },
  { iso: 'DE', dial: '49', name: 'Germany', flag: '🇩🇪' },
  { iso: 'GH', dial: '233', name: 'Ghana', flag: '🇬🇭' },
  { iso: 'GR', dial: '30', name: 'Greece', flag: '🇬🇷' },
  { iso: 'HK', dial: '852', name: 'Hong Kong', flag: '🇭🇰' },
  { iso: 'HU', dial: '36', name: 'Hungary', flag: '🇭🇺' },
  { iso: 'IS', dial: '354', name: 'Iceland', flag: '🇮🇸' },
  { iso: 'IN', dial: '91', name: 'India', flag: '🇮🇳' },
  { iso: 'ID', dial: '62', name: 'Indonesia', flag: '🇮🇩' },
  { iso: 'IR', dial: '98', name: 'Iran', flag: '🇮🇷' },
  { iso: 'IQ', dial: '964', name: 'Iraq', flag: '🇮🇶' },
  { iso: 'IE', dial: '353', name: 'Ireland', flag: '🇮🇪' },
  { iso: 'IL', dial: '972', name: 'Israel', flag: '🇮🇱' },
  { iso: 'IT', dial: '39', name: 'Italy', flag: '🇮🇹' },
  { iso: 'JP', dial: '81', name: 'Japan', flag: '🇯🇵' },
  { iso: 'JO', dial: '962', name: 'Jordan', flag: '🇯🇴' },
  { iso: 'KZ', dial: '7', name: 'Kazakhstan', flag: '🇰🇿' },
  { iso: 'KE', dial: '254', name: 'Kenya', flag: '🇰🇪' },
  { iso: 'XK', dial: '383', name: 'Kosovo', flag: '🇽🇰' },
  { iso: 'KW', dial: '965', name: 'Kuwait', flag: '🇰🇼' },
  { iso: 'LA', dial: '856', name: 'Laos', flag: '🇱🇦' },
  { iso: 'LV', dial: '371', name: 'Latvia', flag: '🇱🇻' },
  { iso: 'LB', dial: '961', name: 'Lebanon', flag: '🇱🇧' },
  { iso: 'LY', dial: '218', name: 'Libya', flag: '🇱🇾' },
  { iso: 'LI', dial: '423', name: 'Liechtenstein', flag: '🇱🇮' },
  { iso: 'LT', dial: '370', name: 'Lithuania', flag: '🇱🇹' },
  { iso: 'LU', dial: '352', name: 'Luxembourg', flag: '🇱🇺' },
  { iso: 'MY', dial: '60', name: 'Malaysia', flag: '🇲🇾' },
  { iso: 'MT', dial: '356', name: 'Malta', flag: '🇲🇹' },
  { iso: 'MX', dial: '52', name: 'Mexico', flag: '🇲🇽' },
  { iso: 'MD', dial: '373', name: 'Moldova', flag: '🇲🇩' },
  { iso: 'MC', dial: '377', name: 'Monaco', flag: '🇲🇨' },
  { iso: 'MN', dial: '976', name: 'Mongolia', flag: '🇲🇳' },
  { iso: 'ME', dial: '382', name: 'Montenegro', flag: '🇲🇪' },
  { iso: 'MA', dial: '212', name: 'Morocco', flag: '🇲🇦' },
  { iso: 'MM', dial: '95', name: 'Myanmar', flag: '🇲🇲' },
  { iso: 'NP', dial: '977', name: 'Nepal', flag: '🇳🇵' },
  { iso: 'NL', dial: '31', name: 'Netherlands', flag: '🇳🇱' },
  { iso: 'NZ', dial: '64', name: 'New Zealand', flag: '🇳🇿' },
  { iso: 'NG', dial: '234', name: 'Nigeria', flag: '🇳🇬' },
  { iso: 'MK', dial: '389', name: 'North Macedonia', flag: '🇲🇰' },
  { iso: 'NO', dial: '47', name: 'Norway', flag: '🇳🇴' },
  { iso: 'OM', dial: '968', name: 'Oman', flag: '🇴🇲' },
  { iso: 'PK', dial: '92', name: 'Pakistan', flag: '🇵🇰' },
  { iso: 'PS', dial: '970', name: 'Palestine', flag: '🇵🇸' },
  { iso: 'PA', dial: '507', name: 'Panama', flag: '🇵🇦' },
  { iso: 'PY', dial: '595', name: 'Paraguay', flag: '🇵🇾' },
  { iso: 'PE', dial: '51', name: 'Peru', flag: '🇵🇪' },
  { iso: 'PH', dial: '63', name: 'Philippines', flag: '🇵🇭' },
  { iso: 'PL', dial: '48', name: 'Poland', flag: '🇵🇱' },
  { iso: 'PT', dial: '351', name: 'Portugal', flag: '🇵🇹' },
  { iso: 'QA', dial: '974', name: 'Qatar', flag: '🇶🇦' },
  { iso: 'RO', dial: '40', name: 'Romania', flag: '🇷🇴' },
  { iso: 'RU', dial: '7', name: 'Russia', flag: '🇷🇺' },
  { iso: 'SA', dial: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { iso: 'SN', dial: '221', name: 'Senegal', flag: '🇸🇳' },
  { iso: 'RS', dial: '381', name: 'Serbia', flag: '🇷🇸' },
  { iso: 'SG', dial: '65', name: 'Singapore', flag: '🇸🇬' },
  { iso: 'SK', dial: '421', name: 'Slovakia', flag: '🇸🇰' },
  { iso: 'SI', dial: '386', name: 'Slovenia', flag: '🇸🇮' },
  { iso: 'ZA', dial: '27', name: 'South Africa', flag: '🇿🇦' },
  { iso: 'KR', dial: '82', name: 'South Korea', flag: '🇰🇷' },
  { iso: 'ES', dial: '34', name: 'Spain', flag: '🇪🇸' },
  { iso: 'LK', dial: '94', name: 'Sri Lanka', flag: '🇱🇰' },
  { iso: 'SE', dial: '46', name: 'Sweden', flag: '🇸🇪' },
  { iso: 'CH', dial: '41', name: 'Switzerland', flag: '🇨🇭' },
  { iso: 'TW', dial: '886', name: 'Taiwan', flag: '🇹🇼' },
  { iso: 'TZ', dial: '255', name: 'Tanzania', flag: '🇹🇿' },
  { iso: 'TH', dial: '66', name: 'Thailand', flag: '🇹🇭' },
  { iso: 'TN', dial: '216', name: 'Tunisia', flag: '🇹🇳' },
  { iso: 'TR', dial: '90', name: 'Türkiye', flag: '🇹🇷' },
  { iso: 'UG', dial: '256', name: 'Uganda', flag: '🇺🇬' },
  { iso: 'UA', dial: '380', name: 'Ukraine', flag: '🇺🇦' },
  { iso: 'AE', dial: '971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { iso: 'GB', dial: '44', name: 'United Kingdom', flag: '🇬🇧' },
  { iso: 'US', dial: '1', name: 'United States', flag: '🇺🇸' },
  { iso: 'UY', dial: '598', name: 'Uruguay', flag: '🇺🇾' },
  { iso: 'UZ', dial: '998', name: 'Uzbekistan', flag: '🇺🇿' },
  { iso: 'VE', dial: '58', name: 'Venezuela', flag: '🇻🇪' },
  { iso: 'VN', dial: '84', name: 'Vietnam', flag: '🇻🇳' },
]

// Kosovo — the product's primary land-succession market (CLAUDE.md).
export const DEFAULT_COUNTRY_ISO = 'XK'

export function findCallingCode(iso: string): CallingCode | undefined {
  return CALLING_CODES.find((c) => c.iso === iso)
}

/**
 * Combines a country and a locally-typed number into E.164 (`+38344123456`).
 *
 * Strips spaces, dashes and brackets, and drops leading trunk zeros: people
 * write their own number the way they would dial it at home ("044 123 456"
 * in Kosovo, "07700 900123" in the UK), but that zero is not part of the
 * international form. Returns null when there are no digits to work with.
 */
export function toE164(iso: string, nationalNumber: string): string | null {
  const country = findCallingCode(iso)
  if (!country) return null

  const digits = nationalNumber.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return null

  return `+${country.dial}${digits}`
}
