require('dotenv').config();
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs').promises;

// Number of concurrent workers
const NUM_WORKERS = 4;

async function processImages() {
    try {
        // Read all images from the images directory
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
            text: '' // You'll need to implement OCR to extract text from images
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
                        console.log(`Successfully processed ${path.basename(result.outputPath)}`);
                        console.log(`Translated text: ${result.translatedText}`);
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

// Start processing
processImages(); 