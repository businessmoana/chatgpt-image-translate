const { parentPort } = require('worker_threads');
const { OpenAI } = require('openai');
const sharp = require('sharp');
const fs = require('fs').promises;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function translateText(text) {
    try {
        const prompt = `✅ PROMPT FOR TRANSLATING T-SHIRT SAYINGS – SLOVENIAN TO CROATIAN

You are a professional translator specializing in funny slogans and sayings for apparel. Your task is to translate each Slovenian phrase or saying intended for T-shirts into Croatian, while keeping all English words, slogans, brand names, and alphanumeric elements unchanged.

🧭 Guidelines:
Translate short T-shirt slogans from Slovenian to Croatian — each row or phrase is one complete saying. Overwrite the original with the Croatian version.

If a phrase already contains English, do not translate or alter that part — only translate the Slovenian portion.

Keep all capitalization, symbols, emojis, and punctuation in their original positions (e.g., !, :, –, ❤️, etc.).

Preserve the joke or wordplay — make sure the Croatian version is just as fun, edgy, or cheeky as the Slovenian one.

If possible, make it rhyme or keep the rhythm similar to the original.

Be creative, but don't tone it down — cheeky, sassy, or sarcastic tone is welcome!

Do NOT translate:
- English words or phrases
- Brand names or codes
- Size abbreviations
- Color codes
- Units

Please translate this text: "${text}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

async function generateImage(text, originalImagePath) {
    try {
        // Read the original image
        const originalImageBuffer = await fs.readFile(originalImagePath);
        
        // Convert the image to base64
        const base64Image = originalImageBuffer.toString('base64');

        const prompt = `PROMPT ZA GENERIRANJE SLIK MAJIC

TEKST NA MAJICI
${text}

FORMAT SLIKE
Portretna orientacija (razmerje 2:3)

MODEL (Oseba)
Spol: nakljucno (moski ali zenska)
Starost: nakljucno (20s, 30s, 40s, 50s ali 60s)
Videz: evropski tip
Barva las: nakljucno (blond, crna, rdeca, rjava)
Priceska: nakljucno (kratka, dolga, cop, kodrasta, valovita ali ravna)
Obrazne dlake (moski): nakljucno (pobrit, rahla brada, polna brada)
Izraz: nasmejan, samozavesten, sproscen ali prijazen
Smer pogleda: nakljucno (v kamero, ob stran ali neformalno)
Poza: nakljucno (stoji, sedi, se naslanja, hodi)
Brez vidnih tatujev

DIZAJN MAJICE
Tip: standardna majica s kratkimi rokavi
Barva: nakljucno (crna, bela, rdeca, kelly zelena, roza, rumena, royal blue NAJMANJKRAT uporabljena)

PISAVA (nakljucno izberi)
Comic, Antonio, Titan One, Amatic SC, Sunny Drop, Wedges

BARVA PISAVE (nakljucno izberi, vedno v mocnem kontrastu z majico)
Bela, Crna, Rdeca, Neon rumeno-zelena

POSTAVITEV TEKSTA
Centrirano, jasno vidno in dominantno na majici

Use the provided reference image as a design pattern for the new image.`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1536",
            image: base64Image // Include the original image as reference
        });

        return response.data[0].url;
    } catch (error) {
        console.error('Image generation error:', error);
        throw error;
    }
}

parentPort.on('message', async (data) => {
    try {
        const { imagePath, text } = data;
        
        // Translate the text
        const translatedText = await translateText(text);
        
        // Generate new image using the original image as reference
        const newImageUrl = await generateImage(translatedText, imagePath);
        
        // Download and save the new image
        const response = await fetch(newImageUrl);
        const buffer = await response.buffer();
        
        // Save the image
        const outputPath = imagePath.replace(/\.[^/.]+$/, '_translated$&');
        await sharp(buffer).toFile(outputPath);
        
        parentPort.postMessage({
            success: true,
            translatedText,
            outputPath
        });
    } catch (error) {
        parentPort.postMessage({
            success: false,
            error: error.message
        });
    }
}); 