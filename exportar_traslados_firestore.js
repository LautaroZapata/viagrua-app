// Script para exportar la colección 'traslados' de Firestore a CSV
// Requisitos: Node.js, firebase-admin, json2csv
// Instala dependencias con: npm install firebase-admin json2csv

const admin = require('firebase-admin');
const { Parser } = require('json2csv');
const fs = require('fs');

// Cambia el nombre del archivo JSON si es necesario
const serviceAccount = require('./trasladosapp-c6164-3ad22e0857a1.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportCollectionToCSV(collectionName, outputFile) {
  const snapshot = await db.collection(collectionName).get();
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (docs.length === 0) {
    console.log('No se encontraron documentos en la colección.');
    return;
  }
  const parser = new Parser();
  const csv = parser.parse(docs);
  fs.writeFileSync(outputFile, csv);
  console.log(`Exportados ${docs.length} documentos a ${outputFile}`);
}

// Exporta la colección 'traslados' a traslados_firestore.csv
exportCollectionToCSV('traslados', 'traslados_firestore.csv');
