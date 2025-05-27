const { parentPort } = require('worker_threads');
const { OpenAI } = require('openai');
const { toFile } = require('openai')
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const promptsDir = path.join('./prompts');

function loadPrompt(promptName) {
    const promptPath = path.join(promptsDir, `${promptName}.txt`);
    try {
        const promptContent = fs.readFileSync(promptPath, 'utf-8');
        return promptContent;
    } catch (err) {
        console.error(`Error loading prompt ${promptName}:`, err.message);
        throw err;
    }
}

async function detectTextFromImage(imagePath) {
    const promptContent = loadPrompt('detect_text_prompt');
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: promptContent
                    },
                    {
                        type: 'image_url',
                        image_url: { 'url': imageUrl }
                    }
                ]
            }
        ]
    });
    return response.choices[0].message.content
}

async function translateText(detectedText) {
    try {
        const promptContent = loadPrompt('translate_text_prompt');
        const prompt = `${promptContent} Please translate this text: "${detectedText}"`;

        const response = await openai.chat.completions.create({
            model: "gpt-4.5-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

async function translateImageName(imageName) {
    try {
        const prompt = `You are an expert translator tasked with translating file names from Slovenian to Croatian.

        Instructions:

        Translate only words from Slovenian to Croatian.

        Preserve the original filename structure including:

        Underscores (_)

        Hyphens (-)

        Numbers (e.g., 01, 02, 123)

        File extensions (.png, .jpg, .jpeg, etc.)

        Do not add spaces where they do not exist.

        Do not alter casing (uppercase, lowercase should remain as in the original).

        If the filename has no separators (no spaces, underscores, or hyphens), carefully translate it without inserting any separators.

        Translate accurately, contextually appropriate, and naturally.                                                
        translate this : ${imageName}
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4.5-preview",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

async function generateImage(translatedText, originalImagePath) {
    try {
        // Read the original image
        const image = await toFile(fs.createReadStream(originalImagePath), null, {
            type: "image/png",
        })
        const promptContent = loadPrompt('generate_image_prompt');
        const prompt = promptContent.replace('[TEXT]', translatedText);;
        const response = await openai.images.edit({
            model: "gpt-image-1",
            image: image,
            prompt: prompt,
        });
        const image_base64 = response.data[0].b64_json;
        const image_bytes = Buffer.from(image_base64, "base64");
        return image_bytes;
    } catch (error) {
        console.error('Image generation error:', error);
        throw error;
    }
}


function ensurePngExtension(filename) {
    // Get the file extension
    const ext = path.extname(filename).toLowerCase();

    // If there's no extension or it's not .png, add .png
    if (!ext || ext !== '.png') {
        // Remove any existing extension and add .png
        const basename = path.basename(filename, ext); // Removes existing extension
        filename = `${basename}.png`;
    }

    return filename;
}

parentPort.on('message', async (data) => {
    console.log("here worker")
    try {
        const { imagePath, imageName, excelPath, convertedDir } = data;
        const detectedText = await detectTextFromImage(imagePath);
        console.log("detectedText=>", detectedText);
        const translatedText = await translateText(detectedText);
        const translatedImageName = await translateImageName(imageName);
        console.log("imageName=>", imageName);
        console.log("translatedText=>", translatedText);
        console.log("translatedImageName=>", translatedImageName);
        const workbook = xlsx.readFile(excelPath);
        let worksheet = workbook.Sheets['Results'];

        const existingData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        existingData.push([imageName, detectedText, translatedText]);

        worksheet = xlsx.utils.aoa_to_sheet(existingData);
        workbook.Sheets['Results'] = worksheet;

        xlsx.writeFile(workbook, excelPath);

        translatedImageName = ensurePngExtension(translatedImageName);
        const buffer = await generateImage(translatedText, imagePath);
        const outputPath = path.join(convertedDir, path.basename(translatedImageName));
        fs.writeFileSync(outputPath, buffer);
        parentPort.postMessage({
            success: true,
            translatedText
            // outputPath
        });
    } catch (error) {
        parentPort.postMessage({
            success: false,
            error: error.message
        });
    }
}); 