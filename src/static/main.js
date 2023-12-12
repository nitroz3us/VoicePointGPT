var voiceChoice = document.getElementById("voiceChoice")
var dragDropContainer = document.getElementById("dragDropContainer")
var dragDropInput = document.getElementById("dragDropInput")
var submitBtn = document.getElementById("submitBtn");
var loadingSpinner = document.getElementById("loadingSpinner");
var scriptText = document.getElementById("scriptText");
var loadingSpinnerSave = document.getElementById("loadingSpinnerSave");
var saveBtn = document.getElementById("saveBtn");
var modelChoice = document.getElementById("modelChoice");
var apiKeyInput = document.getElementById("apiKeyInput")
var narrateBtn = document.getElementById("narrateBtn");
var audioDiv = document.getElementById("audioDiv");
var loadingAudioSpinner = document.getElementById("loadingAudioSpinner");
var totalWords = document.getElementById("totalWords");
var totalMinutes = document.getElementById("totalMinutes");
var totalSeconds = document.getElementById("totalSeconds");
const audioElement = document.querySelector('audio');

const apiUrl = "https://api.openai.com/v1/audio/speech";
const visionAPIUrl = "https://api.openai.com/v1/chat/completions";

function dataFileDnD() {
  return {
      files: [],
      fileDragging: null,
      fileDropping: null,
      humanFileSize(size) {
          const i = Math.floor(Math.log(size) / Math.log(1024));
          return (
              (size / Math.pow(1024, i)).toFixed(2) * 1 +
              " " +
              ["B", "kB", "MB", "GB", "TB"][i]
          );
      },
      remove(index) {
          let files = [];
          files.splice(index, 1);
          // reset the file input
          this.files = createFileList(files);
          document.getElementById("dragDropInput").files = this.files;

          
      },
      drop(e) {
          let removed, add;
          let files = [...this.files];

          removed = files.splice(this.fileDragging, 1);
          files.splice(this.fileDropping, 0, ...removed);

          this.files = createFileList(files);

          this.fileDropping = null;
          this.fileDragging = null;
      },
      dragenter(e) {
          let targetElem = e.target.closest("[draggable]");

          this.fileDropping = targetElem.getAttribute("data-index");
      },
      dragstart(e) {
          this.fileDragging = e.target
              .closest("[draggable]")
              .getAttribute("data-index");
          e.dataTransfer.effectAllowed = "move";
      },
      loadFile(file) {
          const preview = document.querySelectorAll(".preview");
          const blobUrl = URL.createObjectURL(file);

          preview.forEach(elem => {
              elem.onload = () => {
                  URL.revokeObjectURL(elem.src); // free memory
              };
          });

          return blobUrl;
      },
      addFiles(e) {
          const files = [...e.target.files].filter((file) => file.type === "application/pdf");
          if (files.length > 0) {
              this.files = createFileList([], [files[0]]);
              this.formData = new FormData();
              this.formData.append("file", files[0]);
          }
      },
        
  };
}

function toggleModal() {
  var modal = document.getElementById("modal");
  var backdrop = document.getElementById("modal-backdrop");
  var body = document.body;


  if (modal.style.display === "none" || modal.style.display === "") {
    modal.style.display = "block";
    backdrop.style.display = "block";
    body.style.overflow = 'hidden'; // Disable scrolling

  } else {
    modal.style.display = "none";
    backdrop.style.display = "none";
    body.style.overflow = ''; // Enable scrolling

  }
}

// fetch the result from backend/fastapi
async function generateScript() {
  clearResultBody();
  // Disable the button and show loading spinner
  submitBtn.disabled = true;
  // hide submitBtn
  submitBtn.classList.add("hidden");
  loadingSpinner.classList.remove("hidden");
  narrateBtn.classList.add("hidden");

  let imageUrls = []; // Define imageUrls outside the try block

  try {
    // Fetch the form data asynchronously
    const data = new FormData(document.getElementById("generateForm"));
    const response = await fetch("/", {
      method: "POST",
      body: data,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data. Status: ${response.status}`);
    }

    const responseData = await response.json();
    
    if (responseData.error) {
      
      throw new Error(responseData.error);
    }

    imageUrls = responseData.result; // Update imageUrls inside the try block

    var finalResult = await getResultFromOpenAI(imageUrls);
    var wordCount = finalResult.split(" ").length;

    if (!finalResult) {
      throw new Error("Failed to get result from OpenAI.");
    }

    scriptText.innerText = finalResult;
    getWordCount(wordCount);
  } catch (error) {
    loadingSpinner.classList.add("hidden");
    submitBtn.disabled = false;
    submitBtn.classList.remove("hidden");
    narrateBtn.classList.add("hidden");
    console.error("Error: ", error.message);
    toast('Error', error.message, toastStyles.error, 7000);
  } finally {    
    // Delete files only if imageUrls is defined
    if (imageUrls.length > 0) {
      loadingSpinner.classList.add("hidden");
      submitBtn.disabled = false;
      submitBtn.classList.remove("hidden");
      narrateBtn.classList.remove("hidden");
      await deleteFiles(imageUrls);
    }
  }
}


//    { type: "text", text: "Analyze the images in such a way that you are doing a presentation. The user will give you the slides in order from first to last. Each image is one slide. Title slides should only be a few words or ignored. Each individual slide should provide a narrative that is relevant to the slide, be elaborate on each slide. Do not repeat points that have already been made in the script. Use creative license to make the application more fleshed out."}

async function getResultFromOpenAI(imageUrls) {
  // Build messages array based on imageUrls
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze the images in such a way that you are doing a presentation. Pretend that you are presenting to an audience. The user will give you the slides in order from first to last. Most importantly, each image is 1 slide. For title slides with less than 10 words, make the script one that transitions to the new title. Each individual slide should have a narrative that is relevant to the slide. Each slide should be more than 2 sentences. Do not use big bold words. Do not write the slide numbers. Do not repeat points that have already been made in the script. Use creative license to make the presentation more fleshed out."
        },
      ],
    },
  ];

  // Append image URLs to messages
  for (const imageUrl of imageUrls) {
    messages[0].content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });
  }

  // Make the API request to Vision API
  try{
    const response = await fetch(visionAPIUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeyInput.value}`,
        // Add any other headers if needed
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: messages,
        max_tokens: 4096,
      }),
    });
    
    // Check if the response is OK
    const resultData = await response.json();
    if (!response.ok) {
      narrateBtn.classList.add("hidden");
      toast('Error:', resultData.error.message, toastStyles.error, 7000);
    }else{
      return resultData.choices[0].message.content;
    }
    // Return the result
  }catch(error){
    await deleteFiles(imageUrls); 
  } 
}

// get word count and estimated time
function getWordCount(wordCount) {
  var averageReadingSpeed = 130; // words per minute
  var estimatedMinutes = wordCount / averageReadingSpeed;
  var minutes = Math.floor(estimatedMinutes); // round down the minutes
  var seconds = Math.round((estimatedMinutes % 1) * 60); // round up the seconds

  totalWords.innerText = wordCount;
  totalMinutes.innerText = minutes;
  totalSeconds.innerText = seconds;
}

async function generateSpeech() {
  loadingAudioSpinner.classList.remove("hidden");
  narrateBtn.classList.add("hidden");
  submitBtn.classList.add("hidden");
  
  const maxChunkSize = 4096; // Maximum token limit
  // Split the input text into chunks
  const textChunks = [];
  for (let i = 0; i < scriptText.innerText.length; i += maxChunkSize) {
    textChunks.push(scriptText.innerText.slice(i, i + maxChunkSize));
  }

  const audioChunks = [];

  for (const textChunk of textChunks) {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKeyInput.value}`,
      },
      body: JSON.stringify({
        model: modelChoice.value,
        voice: voiceChoice.value,
        input: textChunk,
      }),
    });

    loadingAudioSpinner.classList.remove("hidden");
    narrateBtn.classList.add("hidden");

    if (!response.ok) {
      audioDiv.classList.remove('hidden');
      narrateBtn.classList.remove("hidden");
      loadingAudioSpinner.classList.add("hidden");
      toast('Error', `Failed to generate audio: ${response.statusText}`, toastStyles.error, 2000);
      throw new Error(`Failed to generate audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    audioChunks.push(arrayBuffer);
  }

  // Concatenate audio chunks
  const concatenatedAudio = new Uint8Array(
    audioChunks.reduce((acc, chunk) => [...acc, ...new Uint8Array(chunk)], [])
  ).buffer;

  // Convert the ArrayBuffer to a Blob
  const blob = new Blob([concatenatedAudio], { type: 'audio/mp3' });

  // Create a data URL from the Blob
  const dataUrl = URL.createObjectURL(blob);

  // Get the existing <audio> element
  const audioElement = document.querySelector('audio');

  // Update the source of the <audio> element
  audioElement.src = dataUrl;

  // Play the audio
  audioElement.play();
  audioDiv.classList.remove('hidden');
  narrateBtn.classList.remove("hidden");
  submitBtn.classList.remove("hidden");
  loadingAudioSpinner.classList.add("hidden");
  toast('Success', 'Audio generated', toastStyles.success, 2000);
}

async function saveButton(){
  var apiKey = document.getElementById("apiKeyInput").value;
  // check if api key input is empty
  if(apiKey === ""){
    toast('Error', 'API key is empty', toastStyles.error, 2000);
    return;
  }else if(!isValidApiKeyFormat(apiKey)){
    toast('Error', 'Invalid API key format', toastStyles.error, 2000);
    return;
  }else if(!await validateApiKey(apiKey)){
    toast('Error', 'Invalid API key', toastStyles.error, 2000);
    return;
  }else{
    voiceChoice.disabled = false;
    dragDropInput.disabled = false;
    modelChoice.disabled = false;
    submitBtn.disabled = false;
    scriptText.contentEditable = true;
    dragDropContainer.classList.remove("border-gray-500");
    dragDropContainer.classList.add("border-indigo-500");
    dragDropInput.classList.add("cursor-pointer");
    voiceChoice.classList.add("cursor-pointer");
    modelChoice.classList.add("cursor-pointer");
    closeModal();
  }
}

function closeModal() {

  var modal = document.getElementById("modal");
  var backdrop = document.getElementById("modal-backdrop");
  var body = document.body;

  modal.style.display = "none";
  backdrop.style.display = "none";
  body.style.overflow = ''; // Enable scrolling
}

// Delete files from supabase storage
// Send a POST request to the backend to trigger /delete-files
async function deleteFiles(imageUrls) {
  var list_of_file_paths = [];

  // check if imageurls is not empty
  if(imageUrls.length > 0){
      
    imageUrls.forEach((imageUrl, index) => {
      const urlObject = new URL(imageUrl);
      const parts = urlObject.pathname.split("/");
      const pdfFilename = parts[parts.length - 2]; // FancyBear.pdf
      const pageFilename = parts[parts.length - 1]; // page_1.png
      const filepath = `${pdfFilename}/${pageFilename}`;
      list_of_file_paths.push(filepath);
    });

  }else{
    narrateBtn.classList.add("hidden");
    toast('Error', 'No PDF found', toastStyles.error, 7000);
  }
  // Make the API request
  const response = await fetch("/delete-files", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      pdf_filename: list_of_file_paths,
    }),
  });

  // Check if the response is OK
  if (response.ok) {
    console.log("Files deleted successfully");
  } else {
    console.error("Error deleting files:", response.statusText);
  }
}

function isValidApiKeyFormat(apiKey) {
  // Implement the validation logic for the API key format
  // Return true if the API key is valid, false otherwise
  // Example validation logic:
  return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey);
}

async function validateApiKey(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  loadingSpinnerSave.classList.remove("hidden");
  saveBtn.classList.add("hidden");

  try {
    const response = await fetch("https://api.openai.com/v1/engines", { headers });
    if (response.ok){
      toast('Success', 'API key is valid', toastStyles.success, 2000);
      loadingSpinnerSave.classList.add("hidden");
      saveBtn.classList.remove("hidden");
      return response.ok;
    }else{
      loadingSpinnerSave.classList.add("hidden");
      saveBtn.classList.remove("hidden");
      return false;
    }
  } catch (error) {
    return false;
  }
} 
// Close the modal on Escape key press
window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
  }
});



function clearResultBody() {
  scriptText.innerHTML = "";
  // Pause the audio (if playing)
  audioElement.pause();

  // Set the audio source to an empty string
  audioElement.src = '';

  // Hide the audio UI container
  audioDiv.classList.add('hidden');
}
