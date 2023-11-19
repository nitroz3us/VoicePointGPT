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

const apiUrl = "https://api.openai.com/v1/audio/speech";


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
  // Prevent the default form submission behavior  

  // Disable the button and show loading spinner
  submitBtn.disabled = true;
  // hide submitBtn
  submitBtn.classList.add("hidden");
  loadingSpinner.classList.remove("hidden");

  try {
    // Fetch the form data asynchronously
    const data = new FormData(document.getElementById("generateForm"));
    const response = await fetch("/", {
      method: "POST",
      body: data,
    });

    // Check if the response is OK (status code 200)
    if (response.ok) {
      // Parse the JSON response (if applicable)
      const responseData = await response.json(); // Assuming your response is JSON
      // Update the content or perform other actions based on the response data
      console.log(responseData);
      scriptText.innerText = responseData.result;

    } else {
      // Handle error cases
      console.error("Error:", response.status, response.statusText);
      toast('Error', response.statusText, toastStyles.error, 2000);
    }
  } catch (error) {
    console.error("Error:", error.message);
    toast('Error', error.message, toastStyles.error, 2000);
  } finally {
    // Enable the button and hide loading spinner
    loadingSpinner.classList.add("hidden");
    submitBtn.disabled = false;
    submitBtn.classList.remove("hidden");
    narrateBtn.classList.remove("hidden");
  }
}

async function generateSpeech() {
  
  const maxChunkSize = 4096; // Maximum token limit
  // Split the input text into chunks
  const textChunks = [];
  for (let i = 0; i < scriptText.value.length; i += maxChunkSize) {
    textChunks.push(scriptText.value.slice(i, i + maxChunkSize));
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
  loadingAudioSpinner.classList.add("hidden");
  toast('Success', 'Audio generated', toastStyles.success, 2000);
}



async function saveButton(){
  var apiKey = document.getElementById("apiKeyInput").value;
  // disable all input by default unless api key is valid
  const isValidApiKey = await validateApiKey(apiKey);  
  if (!isValidApiKeyFormat(apiKey) || !isValidApiKey) {
    toast('Error', 'Invalid API key format', toastStyles.error, 2000);
    loadingSpinnerSave.classList.add("hidden");
    saveBtn.classList.remove("hidden");
    return;
  }else{
    voiceChoice.disabled = false;
    dragDropInput.disabled = false;
    modelChoice.disabled = false;
    scriptText.disabled = false;
    submitBtn.disabled = false;
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

// Close the modal on Escape key press
window.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
  }
});

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
    }
  } catch (error) {
    return false;
  }
} 

