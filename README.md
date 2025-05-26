# Image Translation and Generation Project

This Node.js project automatically processes images containing text, translates the text from Slovenian to Croatian using ChatGPT, and generates new images with the translated text using DALL-E.

## Prerequisites

- Node.js (v14 or higher)
- OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Project Structure

- `images/` - Place your input images here
- `workers/` - Contains the worker thread implementation
- `index.js` - Main application file
- `workers/imageWorker.js` - Worker thread for processing images

## Usage

1. Place your images in the `images/` directory
2. Run the application:
   ```bash
   node index.js
   ```

The application will:
1. Read all images from the `images/` directory
2. Process them using worker threads for better performance
3. Translate the text using ChatGPT
4. Generate new images with the translated text using DALL-E
5. Save the new images in the same directory with "_translated" suffix

## Features

- Multi-threaded processing using worker threads
- Automatic translation from Slovenian to Croatian
- Image generation with DALL-E
- Concurrent processing of multiple images
- Error handling and logging

## Notes

- The application uses 4 worker threads by default
- Supported image formats: JPG, JPEG, PNG
- Make sure you have sufficient OpenAI API credits
- The generated images will be saved in the same directory as the input images 