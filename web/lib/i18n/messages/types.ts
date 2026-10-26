// Every key needs English, French and Kinyarwanda. A missing language is a type error.
// Kinyarwanda terms: docs/i18n/KINYARWANDA_GLOSSARY.md
export type Messages = Record<string, { en: string; fr: string; rw: string }>;
