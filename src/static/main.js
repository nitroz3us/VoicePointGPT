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
// var editableDiv = document.getElementById('editableDiv');

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

  try {
    // Fetch the form data asynchronously
    const data = new FormData(document.getElementById("generateForm"));
    const response = await fetch("/", {
      method: "POST",
      body: data,
    });

    if(!response.ok){
      loadingSpinner.classList.add("hidden");
      submitBtn.disabled = false;
      submitBtn.classList.remove("hidden");
      narrateBtn.classList.add("hidden");
    }
    const responseData = await response.json(); // Assuming your response is JSON
    imageUrls = responseData.result; //get imageUrls from backend
    finalResult = await getResultFromOpenAI(imageUrls); // use imageurls to pipe to openai vision api


    // if finalResult reponse is not ok, then show error
    if(!finalResult){
      loadingSpinner.classList.add("hidden");
      submitBtn.disabled = false;
      submitBtn.classList.remove("hidden");
      narrateBtn.classList.add("hidden");
    }else{
      scriptText.innerText = finalResult; // print result
      // Do an estimate based on the number of words
    }
  } catch (error) {
    console.error("Error: (this error is when the user did not upload pdf)", error.message);
    toast('Error', 'No PDF found', toastStyles.error, 7000);

    // hide narrateBtn
    narrateBtn.classList.add("hidden");
  }finally {


    var list_of_file_paths = [];
    // check if imageurls is not empty
    if(imageUrls.length > 0){
      // Enable the button and hide loading spinner
      loadingSpinner.classList.add("hidden");
      submitBtn.disabled = false;
      submitBtn.classList.remove("hidden");
      narrateBtn.classList.remove("hidden");
      imageUrls.forEach((imageUrl, index) => {
        const urlObject = new URL(imageUrl);
        const parts = urlObject.pathname.split("/");
        const pdfFilename = parts[parts.length - 2]; // FancyBear.pdf
        const pageFilename = parts[parts.length - 1]; // page_1.png
        const filepath = `${pdfFilename}/${pageFilename}`;
        list_of_file_paths.push(filepath);
      });

      // call backend to delete files
      const deleteResponse = await fetch("/delete-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          pdf_filename: list_of_file_paths,  // replace with the actual pdf_filename
        }),
      });

      // Check if the response is OK
      if (deleteResponse.ok) {
        console.log("Files deleted successfully");
      } else {
        console.error("Error deleting files:", deleteResponse.statusText);
      }
    }else{
      narrateBtn.classList.add("hidden");
      toast('Error', 'No PDF found', toastStyles.error, 7000);
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
        { type: "text", text: "Analyze the images in such a way that you are doing a presentation. The user will give you the slides in order from first to last. Most importantly, each image is 1 slide. For title slides with less than 10 words, make the script one that transitions to the new title. Each individual slide should have a narrative that is relevant to the slide. Each slide should at least be more than 2 sentences. Do not write the slide numbers. Do not repeat points that have already been made in the script. Use creative license to make the presentation more fleshed out."
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

  // Make the API request
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
  
    // Handle the response as needed
    if (response.ok) {
      const resultData = await response.json();
      return resultData.choices[0].message.content;
      // Update the UI or perform other actions with the resultData
    } else {
      const errorData = await response.json();
      console.error("Error:", errorData.error.message);
      toast('Error:', errorData.error.message, toastStyles.error, 7000);
      narrateBtn.classList.add("hidden");
      // Handle error cases
    }
  }catch(error){
    console.log("error: ", error)
    toast('Error:', error.message, toastStyles.error, 7000);
  }
  
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
    // scriptText.disabled = false;
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

function clearResultBody() {
  scriptText.innerHTML = ""; // Clear the content
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


document.addEventListener('DOMContentLoaded', function () {
  handleBlur();
});

function handleFocus() {
  scriptText.classList.remove('placeholder');
  if (scriptText.innerHTML.trim() === 'Generated script will appear here') {
    scriptText.innerHTML = '';
  }
}

function handleBlur() {
  if (scriptText.innerHTML.trim() === '') {
    scriptText.innerHTML = 'Generated script will appear here';
    scriptText.classList.add('placeholder');
  }
}