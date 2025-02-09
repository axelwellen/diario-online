/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// 🔥 Inicializar Firebase Admin
admin.initializeApp();

// 📩 Configurar Nodemailer con Gmail
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: functions.config().gmail.email, // ⚠️ Tu dirección de Gmail
        pass: functions.config().gmail.password // ⚠️ La contraseña de aplicación
    }
});

// 📩 Función para enviar emails cuando se crea una nueva entrada
exports.sendEmailNotification = functions.firestore
    .document("diaries/{diaryId}/entries/{entryId}")
    .onCreate(async (snap, context) => {
        const diaryId = context.params.diaryId;
        const newEntry = snap.data();

        // 📌 Obtener el diario para conocer a los suscriptores
        const diaryRef = admin.firestore().doc(`diaries/${diaryId}`);
        const diarySnap = await diaryRef.get();

        if (!diarySnap.exists) {
            console.error("Diary not found:", diaryId);
            return null;
        }

        const diaryData = diarySnap.data();

        // 📌 Obtener los emails de los suscriptores
        const subscribers = diaryData.subscribers || [];
        if (subscribers.length === 0) {
            console.log("No subscribers, skipping email notification.");
            return null;
        }

        // 📌 Construir el email
        const mailOptions = {
            from: `"Tu Diario" <${functions.config().gmail.email}>`,
            to: subscribers.join(","), // Enviar a todos los suscriptores
            subject: `Nueva entrada en el diario ${diaryData.title}`,
            text: `Se ha publicado una nueva entrada en el diario "${diaryData.title}".`,
            html: `<p>📖 Se ha publicado una nueva entrada en el diario <strong>${diaryData.title}</strong>.</p>
                   <p>Puedes verla aquí: <a href="https://tudiario.com/diary/${diaryId}">Ver entrada</a></p>`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log("Emails enviados correctamente.");
        } catch (error) {
            console.error("Error enviando email:", error);
        }

        return null;
    });
