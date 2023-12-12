# VoicePointGPT
 Upload your PowerPoint slides and let this tool do the work! Automatically generate a script for each slide, and even add a professional touch with optional voiceover generation. Simplify your presentation preparation and enhance your delivery.

## Key Features

- **Script Generation:** Analyze your slides and get a ready-made script.
- **Voiceover Option:** Choose to add a voiceover to your presentation for a complete package.
- **User-Friendly Interface:** Easy-to-use platform for seamless navigation.

## Getting Started (Locally)

To get started with GPThreatIntel-Summarizer, follow these steps:

1. Clone the repository:

    ```bash
    git clone https://github.com/nitroz3us/VoicePointGPT.git
    ```

2. Install the required dependencies:
  
    ```bash
    pip install -r requirements.txt
    ```
    
3. Set up your ```.env``` file
    ```bash
    SUPABASE_URL = 
    SUPABASE_KEY =
    SUPABASE_BUCKET_NAME =
    ```

4. Run the application:
   
    ```bash
    uvicorn app:app --host localhost --port 3000 --reload
    ```
    
5. Access the web interface in your browser at http://localhost:3000.

## Getting Started (Online)

1. Access the web interface in your browser at https://voice-point-gpt.vercel.app/


## Usage
1. Enter your OpenAI API Key, which can be found here [Has to be GPT4]
    - https://platform.openai.com/account/api-keys
    - https://help.openai.com/en/articles/7102672-how-can-i-access-gpt-4 [Accessing GPT4]

## Demo


https://github.com/nitroz3us/VoicePointGPT/assets/109442833/0c9ca210-da09-4044-9eed-e67154ac9b71

## Limitations
- Maximum of 32 slides.
- Within the token limit of GPT4 Vision.
 
## Why am I doing this?
- Wanted to try out OpenAI Vision API & Text-To-Speech

## Technologies Used
- OpenAI
- FastAPI
- TailwindCSS
- Supabase

## Contributing
Contributions are welcome! If you have any suggestions, bug reports, or feature requests, please open an issue or submit a pull request.
