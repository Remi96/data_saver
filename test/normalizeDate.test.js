const { normalizeDate } = require('../index');

describe('normalizeDate', () => {
    test('Formats valides', () => {
        expect(normalizeDate('21/11/1971')).toBe('1971-11-21'); // DD/MM/YYYY
        expect(normalizeDate('11/21/1971')).toBe('1971-11-21'); // MM/DD/YYYY
        expect(normalizeDate('1971/11/21')).toBe('1971-11-21'); // YYYY/MM/DD
        expect(normalizeDate('1971-11-21')).toBe('1971-11-21'); // YYYY-MM-DD
        expect(normalizeDate('21-11-1971')).toBe('1971-11-21'); // DD-MM-YYYY
        expect(normalizeDate('11-21-1971')).toBe('1971-11-21'); // MM-DD-YYYY
    });

    test('Dates ambiguës', () => {
        expect(() => normalizeDate('01/02/1971')).toThrow('Format de date ambigu'); // DD/MM/YYYY ou MM/DD/YYYY
        expect(() => normalizeDate('1971/02/01')).toThrow('Format de date ambigu'); // YYYY/MM/DD ou YYYY/DD/MM
    });

    test('Dates invalides', () => {
        expect(() => normalizeDate('32/11/1971')).toThrow('Format de date non reconnu ou invalide'); // Jour invalide
        expect(() => normalizeDate('1971/13/01')).toThrow('Format de date non reconnu ou invalide'); // Mois invalide
    });

    test('Dates manquantes', () => {
        expect(() => normalizeDate('')).toThrow('Date manquante');
    });
});