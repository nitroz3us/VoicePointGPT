import os
import fitz
import string
import datetime
from io import BytesIO
from pathlib import Path
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI, Request, Form, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi import Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
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
        pdf_filename = f"{current_time}_"

        convert_pdf_to_images(data, pdf_filename) # Convert PDF to images, and upload to supabase storage
        urls = retrieve_urls(pdf_filename) # Retrieve signed urls for image files in supabase storage

        return {"result": urls} # return result
    
# Endpoint to delete files in Supabase storage
@app.post("/delete-files", response_class=JSONResponse)
async def delete_files(request: Request, pdf_filename: str = Form(...)):
    list_of_file_paths = pdf_filename.split(',')
    print("\n\n\nList of File Paths (after split): \n\n\n", list_of_file_paths)

    for file_path in list_of_file_paths:
        try:
            supabase.storage.from_(supabase_bucket_name).remove(file_path)
            print(f"File '{file_path}' deleted successfully.")
        except Exception as e:
            print(f"Error deleting file '{file_path}': {e}")

# Convert PDF to image, enumerate pages
def convert_pdf_to_images(data: bytes, pdf_filename: str):
    pdf_document = fitz.open("pdf", data)
    
    # Use string.ascii_lowercase for lowercase letters
    alphabet = string.ascii_lowercase
    
    for page_number in range(pdf_document.page_count):
        print("PDF converting to images... \n")
        page = pdf_document.load_page(page_number)
        image = page.get_pixmap()

        pil_image = Image.frombytes("RGB", (image.width, image.height), image.samples)
        image_bytes_io = BytesIO()
        pil_image.save(image_bytes_io, format="PNG")
        image_bytes = image_bytes_io.getvalue()

        numeric_part = page_number // len(alphabet) + 1
        letter = alphabet[page_number % len(alphabet)]
        combined_name = f"{numeric_part}{letter}"  # Numeric part increases first
        # Upload image to supabase storage
        upload_image_to_supabase(image_bytes, pdf_filename, combined_name)

    pdf_document.close()

# Upload those pages to supabase storage, create a folder using the name of the PDF file, and store the images in that folder
def upload_image_to_supabase(image_bytes: bytes, pdf_filename: str, page_name: str):
    print("Uploading images... \n")
    path_on_supastorage = f"{pdf_filename}/page_{page_name}.png"
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
