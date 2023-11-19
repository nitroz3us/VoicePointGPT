from io import BytesIO
import os
import fitz
import asyncio
import datetime
from pathlib import Path
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI, Request, Form, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi import Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    # define the allowed origins explicitly, currently this wildcard is NOT recommended
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase_bucket_name = os.environ.get("SUPABASE_BUCKET_NAME")
supabase: Client = create_client(supabase_url, supabase_key)
# client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY")) # OpenAI API Key


templates = Jinja2Templates(directory="src/templates")
app.mount("/static", StaticFiles(directory="src/static"), name="static")

# Serve the index.html file
@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# Get object from frontend, e.g. PDF file
@app.post("/", response_class=JSONResponse)
async def generate(request: Request, data: str = Form(None), file_upload: UploadFile = File(None), apiKey: str = Form(None)):
    if file_upload is not None:
        data = await file_upload.read()
        current_time = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
        pdf_filename = f"{current_time}_{file_upload.filename}"

        convert_pdf_to_images(data, pdf_filename) # Convert PDF to images, and upload to supabase storage
        retrieve_urls(pdf_filename) # Retrieve signed urls for image files in supabase storage
        result = analyze_images(pdf_filename, apiKey) # Analyze the images and get the text results from the API
        delete_folder_from_supabase_storage(pdf_filename) # Schedule the deletion of the folder
        # generate_text_to_speech(result, apiKey, modelChoice, voiceChoice) # Generate the audio file from the API

        return {"result": result} # return result

# Convert PDF to image, enumerate pages
def convert_pdf_to_images(data: bytes, pdf_filename: str):
    pdf_document = fitz.open("pdf", data)
    for page_number in range(pdf_document.page_count):
        print("PDF converting to images... \n")
        page = pdf_document.load_page(page_number)
        image = page.get_pixmap()

        pil_image = Image.frombytes("RGB", (image.width, image.height), image.samples)
        image_bytes_io = BytesIO()
        pil_image.save(image_bytes_io, format="PNG")
        image_bytes = image_bytes_io.getvalue()

        upload_image_to_supabase(image_bytes, pdf_filename, page_number + 1)

    pdf_document.close()


# Upload those pages to supabase storage, create a folder using the name of the PDF file, and store the images in that folder
def upload_image_to_supabase(image_bytes: bytes, pdf_filename: str, page_number: int):
    print("Uploading images... \n")
    path_on_supastorage = f"{pdf_filename}/page_{page_number}.png"
    supabase.storage.from_(supabase_bucket_name).upload(file=image_bytes, path=path_on_supastorage, file_options={"content-type": "image/png"})

# Get signed url for file in supabase storage, change to get the folder name and get all files in that folder
def retrieve_urls(pdf_filename):
    """
    Retrieve signed url for image files in supabase storage
    """
    # get all files in bucket
    folder_path = f"{pdf_filename}/"
    list_files_folder = supabase.storage.from_(supabase_bucket_name).list(path=folder_path)
    print(list_files_folder) # works

    # get signed urls for all files
    image_urls = []
    for file_object in list_files_folder:
        file_name = file_object['name']
        file_path = f"{pdf_filename}/{file_name}"
        get_all_signed_url = supabase.storage.from_(supabase_bucket_name).create_signed_url(file_path, 60) # 60 seconds
        image_urls.append(get_all_signed_url['signedURL'])
    print("\nRetrieving SignedURL: \n",image_urls) # works
    return image_urls

# Use the urls to pipe it to OpenAI Visions API for processing, get the text results from the API. Based off the image.
def analyze_images(pdf_filename, user_apiKey):
    """
    Analyze the signed urls for image files in supabase storage
    """
    image_urls = retrieve_urls(pdf_filename)
    print("\n Analyze Image signed URL", image_urls) # works

    # retrieve OpenAI Key here, from the frontend
    client = OpenAI(api_key=user_apiKey)

    # Create messages with the signed URLs
    messages = [
        {
            "role": "user",  # system
            "content": [
                {
                    "type": "text",
                    "text": "Analyze the images in such a way that you are doing a presentation. Make sure you analyze them in order of the page number, e.g. page_1.png, then page_2.png, so on and so forth. Title slides should only be a few words or ignored. Each individual slide should provide a narrative that is relevant to the slide, be elaborate on each slide. Do not repeat points that have already been made in the script. Use creative license to make the application more fleshed out.",
                },
            ],
        },
    ]

    for signed_url in image_urls:
        messages[0]["content"].append({"type": "image_url", "image_url": {"url": signed_url}})

    try:
        # Request completion from the GPT-4 Vision model
        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=messages,
            max_tokens=4096,
        )
        # Print or use the response from OpenAI
        print(response.choices[0].message.content)
        return response.choices[0].message.content
    except Exception as e:
        print('\n\n\n', e)


# Combine all of the text and pipe it to OpenAI Text to Speech API, get the audio file from the API
def generate_text_to_speech(text_result, user_apiKey, modelChoice, voiceChoice):
    """
    Combine all of the text and pipe it to OpenAI Text to Speech API, get the audio file from the API
    """
    client = OpenAI(api_key=user_apiKey)
    speech_file_path = Path(__file__).parent / "speech.mp3"

    # Define the chunk size (you may need to adjust this based on the API's requirements)
    chunk_size = 4000

    print("Generating audio file... \n")
    
    chunks = [text_result[i:i + chunk_size] for i in range(0, len(text_result), chunk_size)]

    # Initialize an empty list to store the audio chunks
    audio_chunks = []

    print("Chunking audio file... \n")
    for chunk in chunks:
        response = client.audio.speech.create(
            model=modelChoice,
            voice=voiceChoice,
            input=chunk,
        )
        audio_chunks.append(response.content)

    # Concatenate the audio chunks
    audio = b"".join(audio_chunks)
    print("Chunks Done? \n")

    # Write the concatenated audio to the file
    with open(speech_file_path, "wb") as file:
        file.write(audio)

    print("Audio file generated! \n")
# Periodically delete the folder and all of its contents from supabase storage
def delete_folder_from_supabase_storage(pdf_filename):
    """
    Delete folder and all of its contents from supabase storage after a delay
    """
    print("Deleting folder after results... \n")

    folder_path = f"{pdf_filename}/"
    list_files_folder = supabase.storage.from_(supabase_bucket_name).list(path=folder_path)
    for file_object in list_files_folder:
        file_name = file_object['name']
        file_path = f"{pdf_filename}/{file_name}"
        supabase.storage.from_(supabase_bucket_name).remove(file_path)

    print("Folder deleted! \n", pdf_filename)    