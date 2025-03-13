const { Client } = require('pg');
const dotenv = require('dotenv');
const { normalizeDate } = require('../index');
const path = require('path');
const readXlsxFile = require('read-excel-file/node');

// Charger les variables d'environnement pour les tests
dotenv.config({ path: '.env.test' });

// Configurer la connexion à la base de données de test
const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
});

// Fonction pour initialiser la base de données de test
async function initializeDatabase() {
    await client.connect();
    await client.query(`
        CREATE TABLE IF NOT EXISTS personnes (
            id SERIAL PRIMARY KEY,
            matricule VARCHAR(50) NOT NULL,
            nom VARCHAR(100) NOT NULL,
            prenom VARCHAR(100) NOT NULL,
            datedenaissance DATE NOT NULL,
            status VARCHAR(50) NOT NULL
        );
    `);
    await client.query('TRUNCATE TABLE personnes RESTART IDENTITY;'); // Nettoyer la table avant les tests
}

// Fonction pour fermer la connexion à la base de données
async function closeDatabase() {
    await client.end();
}

// Tests d'intégration
describe('Intégration de l\'application', () => {
    beforeAll(async () => {
        await initializeDatabase(); // Initialiser la base de données avant les tests
    });

    afterAll(async () => {
        await closeDatabase(); // Fermer la connexion après les tests
    });

    test('Insertion d\'une personne dans la base de données', async () => {
        // Lire un fichier Excel de test
        const filePath = path.join(__dirname, 'test_data.xlsx');
        const rows = await readXlsxFile(filePath);
        const headers = rows[0]; // En-têtes
        const data = rows.slice(1); // Données

        // Normaliser et insérer les données
        for (const row of data) {
            const personne = {};
            headers.forEach((header, index) => {
                personne[header.toLowerCase()] = row[index];
            });

            const normalizedDate = normalizeDate(personne.datedenaissance);

            await client.query(
                'INSERT INTO personnes (matricule, nom, prenom, datedenaissance, status) VALUES ($1, $2, $3, $4, $5)',
                [personne.matricule, personne.nom, personne.prenom, normalizedDate, personne.status]
            );
        }

        // Vérifier que les données ont été insérées
        const result = await client.query('SELECT * FROM personnes');
        expect(result.rows.length).toBe(data.length); // Vérifier le nombre de lignes insérées
        expect(result.rows[0].nom).toBe(data[0][1]); // Vérifier le nom de la première personne
    });

    test('Normalisation des dates', () => {
        expect(normalizeDate('21/11/1971')).toBe('1971-11-21'); // DD/MM/YYYY
        expect(normalizeDate('11/21/1971')).toBe('1971-11-21'); // MM/DD/YYYY
        expect(normalizeDate('1971-11-21')).toBe('1971-11-21'); // YYYY-MM-DD
    });

    test('Gestion des erreurs pour les dates invalides', () => {
        expect(() => normalizeDate('32/11/1971')).toThrow('Format de date non reconnu ou invalide'); // Jour invalide
        expect(() => normalizeDate('1971/13/01')).toThrow('Format de date non reconnu ou invalide'); // Mois invalide
    });
});