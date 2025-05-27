require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

const { Worker } = require('worker_threads');
const xlsx = require('xlsx');

const path = require('path');
const fs = require('fs').promises;
const fs2 = require('fs');

// Number of concurrent workers
const NUM_WORKERS = 4;
const PORT = 3000;


const getTimeStamp = () => {
    const now = new Date();
    return now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
};
const excelDir = './excel_files';
if (!fs2.existsSync(excelDir)) {
    fs2.mkdirSync(excelDir);
}

const convertedDir = `./converted_images/${getTimeStamp()}`;
if (!fs2.existsSync(convertedDir)) {
    fs2.mkdirSync(convertedDir);
}

async function processImages() {
    try {
        // Read all images from the images directory
        const excelFileName = `translation_results_${getTimeStamp()}.xlsx`;
        const excelPath = path.join(excelDir, excelFileName);

        let workbook = xlsx.utils.book_new();
        let headerRow = [['Image Name', 'Detected Text', 'Translated Text']];
        let worksheet = xlsx.utils.aoa_to_sheet(headerRow);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');
        xlsx.writeFile(workbook, excelPath);

        console.log(`Excel file created: ${excelFileName}`);

        const imagesDir = path.join(__dirname, 'images');
        const files = await fs.readdir(imagesDir);
        const imageFiles = files.filter(file =>
            file.toLowerCase().endsWith('.jpg') ||
            file.toLowerCase().endsWith('.jpeg') ||
            file.toLowerCase().endsWith('.png')
        );

        if (imageFiles.length === 0) {
            console.log('No images found in the images directory');
            return;
        }

        console.log(`Found ${imageFiles.length} images to process`);

        // Create a queue of images to process
        const queue = imageFiles.map(file => ({
            imagePath: path.join(imagesDir, file),
            imageName: file,
            excelPath,
            convertedDir
        }));

        // Process images using worker threads
        const workers = new Set();
        const results = [];

        while (queue.length > 0 || workers.size > 0) {
            // Fill up workers until we reach the limit or run out of images
            while (workers.size < NUM_WORKERS && queue.length > 0) {
                const imageData = queue.shift();
                const worker = new Worker(path.join(__dirname, 'workers', 'imageWorker.js'));

                worker.on('message', (result) => {
                    if (result.success) {
                        // console.log(`Successfully processed ${path.basename(result.outputPath)}`);
                    } else {
                        console.error(`Error processing ${path.basename(imageData.imagePath)}: ${result.error}`);
                    }
                    results.push(result);
                    workers.delete(worker);
                    worker.terminate();
                });

                worker.on('error', (error) => {
                    console.error(`Worker error for ${path.basename(imageData.imagePath)}: ${error}`);
                    workers.delete(worker);
                    worker.terminate();
                });

                worker.postMessage(imageData);
                workers.add(worker);
                console.log(`Started processing ${path.basename(imageData.imagePath)}`);
            }

            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Log final results
        console.log('\nProcessing complete!');
        console.log(`Successfully processed ${results.filter(r => r.success).length} images`);
        console.log(`Failed to process ${results.filter(r => !r.success).length} images`);

    } catch (error) {
        console.error('Error processing images:', error);
    }
}


app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    await processImages();
});