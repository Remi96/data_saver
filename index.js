const readXlsxFile = require('read-excel-file/node');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const winston = require('winston');
const cliProgress = require('cli-progress');
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const readline = require("readline");

/// Load env variables
dotenv.config();

/// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

function isLinuxDesktop() {
    if (process.platform !== "linux") return false; // Check if we are on Linux
    return !!process.env.DISPLAY || !!process.env.WAYLAND_DISPLAY;
}

// Configure PostgreSQL connection
const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
});

client.connect()
    .then(async () => {
        // logger.info('Connecté à la base de données PostgreSQL.');
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
    })
    .catch((error) => {
        logger.error(`Erreur de connexion à la base de données: ${error.message}`);
        process.exit(1);
    });


// Normalize dates
function normalizeDate(dateStr) {
    if (!dateStr) {
        throw new Error('Date manquante');
    }
    // return the date if is YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Handle common formats
    const formats = [
        // Format DD/MM/YYYY
        { regex: /(\d{2})\/(\d{2})\/(\d{4})/, replace: '$3-$2-$1', validator: (day, month) => month <= 12 && day <= 31 },
        // Format MM/DD/YYYY
        { regex: /(\d{2})\/(\d{2})\/(\d{4})/, replace: '$3-$1-$2', validator: (month, day) => month <= 12 && day <= 31 },
        // Format DD-MM-YYYY
        { regex: /(\d{2})-(\d{2})-(\d{4})/, replace: '$3-$2-$1', validator: (day, month) => month <= 12 && day <= 31 },
        // Format MM-DD-YYYY
        { regex: /(\d{2})-(\d{2})-(\d{4})/, replace: '$3-$1-$2', validator: (month, day) => month <= 12 && day <= 31 },
        // Format YYYY/MM/DD
        { regex: /(\d{4})\/(\d{2})\/(\d{2})/, replace: '$1-$2-$3', validator: (month, day) => month <= 12 && day <= 31 },
        // Format YYYY/DD/MM
        { regex: /(\d{4})\/(\d{2})\/(\d{2})/, replace: '$1-$3-$2', validator: (day, month) => month <= 12 && day <= 31 },
        // Format YYYY-MM-DD
        { regex: /(\d{4})-(\d{2})-(\d{2})/, replace: '$1-$2-$3', validator: (month, day) => month <= 12 && day <= 31 },
        // Format YYYY-DD-MM
        { regex: /(\d{4})-(\d{2})-(\d{2})/, replace: '$1-$3-$2', validator: (day, month) => month <= 12 && day <= 31 },
    ];

    let validDates = [];

    for (const format of formats) {
        const match = dateStr.match(format.regex);
        if (match) {
            const normalizedDate = dateStr.replace(format.regex, format.replace);

            // Validate the month and day if a validator is provided
            if (format.validator) {
                let month, day, validate;

                // Identify the groups corresponding to the month and day based on the format
                if (format.replace.includes('$1-$2-$3')) {
                    // Formats YYYY/MM/DD, YYYY-MM-DD
                    month = parseInt(match[2], 10);
                    day = parseInt(match[3], 10);
                    validate = format.validator(month, day);
                } else if (format.replace.includes('$1-$3-$2')) {
                    // Formats YYYY/DD/MM, YYYY-DD-MM
                    month = parseInt(match[3], 10);
                    day = parseInt(match[2], 10);
                    validate = format.validator(day, month);
                } else if (format.replace.includes('$3-$2-$1')) {
                    // Formats DD/MM/YYYY, DD-MM-YYYY
                    month = parseInt(match[2], 10);
                    day = parseInt(match[1], 10);
                    validate = format.validator(day, month);
                } else if (format.replace.includes('$3-$1-$2')) {
                    // Formats MM/DD/YYYY, MM-DD-YYYY
                    month = parseInt(match[1], 10);
                    day = parseInt(match[2], 10);
                    validate = format.validator(month, day);
                }

                // Apply the validation
                if (!validate) {
                    //logger.warn(`Date invalide : ${dateStr} (mois: ${month}, jour: ${day})`);
                    continue; // Move to the next format if the date is invalid
                }
            }

            // Check if normalized date is valid
            if (!isNaN(Date.parse(normalizedDate))) {
                validDates.push(normalizedDate);
            }
        }
    }

    // Disambiguate the formats
    if (validDates.length > 1) {
        // If both formats valid, choose one where the month is <= 12
        const preferredDate = validDates.find(date => {
            const [, month] = date.split('-');
            return parseInt(month, 10) <= 12;
        });

        if (preferredDate) {
            return preferredDate;
        } else {
            throw new Error(`Format de date ambigu : ${dateStr} (peut être interprété comme ${validDates.join(' ou ')})`);
        }
    }

    // If only one format is valid, return it
    if (validDates.length === 1) {
        return validDates[0];
    }

    // If no format matches, throw an error
    throw new Error(`Format de date non reconnu ou invalide: ${dateStr}`);
}

    // Ask the user to select a file
    async function askForFilePath() {
        while (true) {
            try {
                // Open Dialog file if Linux desktop
                if(isLinuxDesktop()){
                    const filePath = execSync("zenity --file-selection --title='Sélectionner un fichier XLSX'", { encoding: "utf-8" }).trim();
                if (!fs.existsSync(filePath)) {
                  logger.info("Fichier introuvable. Veuillez réessayer.");
                  continue;
                }
                if (path.extname(filePath).toLowerCase() !== ".xlsx") {
                    logger.error("Le fichier sélectionné n'est pas au format XLSX. Veuillez choisir un fichier valide.");
                    continue;
                  }
                return filePath;
                } else {
                    // Enter file path if linux server
                    return new Promise((resolve) => {
                        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                        rl.question("Entrez le chemin du fichier XLSX : ", (filePath) => {
                          rl.close();
                          resolve(filePath.trim());
                        });
                    });
                }
                
              } catch (err) {
                logger.error("Une erreure s'est produite: "+err);
              }   
        }
    }
    
    // Read a batch of rows from the Excel file
    async function readBatch(filePath, batchSize, offset) {
        const rows = await readXlsxFile(filePath, { offset, limit: batchSize });
        return rows;
    }

    // Insert a batch of data into the database
    async function insertBatch(batch, headers) {
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic); // Progress bar
        bar.start(batch.length, 0);

        for (let i = 0; i < batch.length; i++) {
            const row = batch[i];
            const personne = {};
            headers.forEach((header, index) => {
                personne[header.toLowerCase()] = row[index]; // Uses headers as keys
            });

            try {
                
                if(personne.datedenaissance != "datedenaissance"){ /// Ignore save header
                const normalizedDate = normalizeDate(personne.datedenaissance);

                await client.query(
                    'INSERT INTO personnes (matricule, nom, prenom, datedenaissance, status) VALUES ($1, $2, $3, $4, $5)',
                    [personne.matricule, personne.nom, personne.prenom, normalizedDate, personne.status]
                );
                // logger.info(`Personne insérée: ${personne.nom} ${personne.prenom}`);
                }
            } catch (error) {
                logger.error(`Erreur lors de l'insertion de ${personne.nom} ${personne.prenom}: ${error.message}`);
                throw error;
            }
            bar.update(i + 1);
        }

        bar.stop();
    }

    function getCurrentDateTime() {
        const now = new Date();
    
        const day = String(now.getDate()).padStart(2, '0'); // Jour (DD)
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Mois (MM)
        const year = now.getFullYear(); // Année (YYYY)
    
        const hours = String(now.getHours()).padStart(2, '0'); // Heures (HH)
        const minutes = String(now.getMinutes()).padStart(2, '0'); // Minutes (mm)
    
        // Format date
        const formattedDateTime = `${day}-${month}-${year} ${hours}:${minutes}`;
    
        return formattedDateTime;
    }

// Main function
async function main() {
    try {
        logger.info("Bienvenue dans le logiciel d'enrégistrement de personnes.");
        logger.info("Ce logiciel vous permet d'enrégistrer automatiquement la liste des personnes contenus dans votre fichier excel dans la base de données.");
        // Select file
        logger.info("Veuillez sélectionner le fichier excel:")
        const filePath = await askForFilePath();

        logger.info(`Fichier sélectionné: ${filePath}`);

        // Connect the client only once
        if (client.user == null) {
            logger.info('Connection à la base de données...');
            await client.connect();
        }

        let headers = null;
        let offset = 0;
        logger.info(`Date de début d'enrégistement: ${getCurrentDateTime()}`)

        while (true) {
            // Read a batch of 50 rows
            logger.info(headers === null ? 'Initialisation du traitement...' : 'Extraction des données...');
            const batch = await readBatch(filePath, 50, offset);
            if(headers !== null) logger.info('Enrégistrement des données...');
            if (batch.length === 0) {
                logger.info('Toutes les données ont été traitées.');
                break;
            }

            // Retrieve the headers during the first iteration
            if (!headers) {
                headers = batch[0];
                offset++; // Move to the next line after the headers
                continue;
            }

            try {
                // Insert the batch into the database
                await insertBatch(batch, headers);
                offset += 50; // Update offset
                //saveState(offset); // Save state
                logger.info('Toutes les données ont été enrégistées.');
                logger.info(`Date de fin d'enrégistement: ${getCurrentDateTime()}`)
                await client.end();
                break;
            } catch (error) {
                logger.error(`Erreur lors du traitement du lot. Reprise au lot suivant.`);
                break;
            }
        }
        process.exit();
    } catch (error) {
        logger.error(`Erreur: ${error.message}`);
    } finally {
        await client.end();
    }
}

// Start application
main();

module.exports = { normalizeDate };
