// Option lists for the public registration forms.

export const countries = [
  'Rwanda', 'Burundi', 'Cameroon', 'Côte d’Ivoire', 'Democratic Republic of the Congo', 'Ethiopia', 'Ghana', 'Kenya',
  'Nigeria', 'Senegal', 'South Africa', 'South Sudan', 'Tanzania', 'Uganda', 'Zambia', 'Other',
];

export const sectors = [
  'Education', 'Health', 'Agriculture', 'Technology', 'Finance', 'Government', 'Non-profit or NGO', 'Faith-based', 'Manufacturing', 'Other',
];

export const staffSizes = ['1 to 10', '11 to 50', '51 to 200', '201 to 500', 'More than 500'];

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isPhone = (v: string) => /^\+?[\d\s()-]{9,}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 9;

export const ageOn = (dob: string, today = new Date()) => {
  const d = new Date(dob + 'T00:00:00');
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};
